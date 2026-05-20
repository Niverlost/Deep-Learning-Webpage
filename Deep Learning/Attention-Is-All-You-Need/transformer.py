"""
Transformer — PyTorch Implementation
Paper: "Attention Is All You Need"
       (Vaswani et al., NeurIPS 2017, arXiv:1706.03762)

Architecture follows Section 3 of the paper exactly:
  - Encoder:  N=6 layers, each with Multi-Head Self-Attention + FFN
  - Decoder:  N=6 layers, each with Masked Self-Attention + Cross-Attention + FFN
  - d_model=512, h=8, d_k=d_v=64, d_ff=2048, dropout=0.1
  - Sinusoidal positional encoding, post-LN (original paper style)
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F

# ---------------------------------------------------------------------------
# Configuration (base model from the paper, Table 3)
# ---------------------------------------------------------------------------
D_MODEL  = 512     # model dimension
N_LAYERS = 6       # number of encoder / decoder layers
H        = 8       # number of attention heads
D_FF     = 2048    # feed-forward inner dimension
D_K      = 64      # key / query dimension per head  (= D_MODEL // H)
D_V      = 64      # value dimension per head        (= D_MODEL // H)
DROPOUT  = 0.1
PAD_IDX  = 0       # padding index (for masking)

# ---------------------------------------------------------------------------
# Scaled Dot-Product Attention  (Section 3.2.1)
# ---------------------------------------------------------------------------
class ScaledDotProductAttention(nn.Module):
    def __init__(self, dropout=DROPOUT):
        super().__init__()
        self.dropout = nn.Dropout(dropout)

    def forward(self, Q, K, V, mask=None):
        # Q, K, V: (B, h, seq_len, d_k)
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(D_K)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))
        attn = self.dropout(F.softmax(scores, dim=-1))
        return torch.matmul(attn, V), attn

# ---------------------------------------------------------------------------
# Multi-Head Attention  (Section 3.2.2)
# ---------------------------------------------------------------------------
class MultiHeadAttention(nn.Module):
    def __init__(self):
        super().__init__()
        assert D_MODEL % H == 0
        self.d_k = D_K
        self.d_v = D_V
        self.h = H

        self.W_Q = nn.Linear(D_MODEL, H * D_K, bias=False)
        self.W_K = nn.Linear(D_MODEL, H * D_K, bias=False)
        self.W_V = nn.Linear(D_MODEL, H * D_V, bias=False)
        self.W_O = nn.Linear(H * D_V, D_MODEL, bias=False)

        self.attention = ScaledDotProductAttention()

    def forward(self, Q, K, V, mask=None):
        B, seq_len_q, _ = Q.shape
        _, seq_len_k, _ = K.shape

        # Linear projections and reshape to (B, h, seq_len, d_k)
        Q = self.W_Q(Q).view(B, seq_len_q, self.h, self.d_k).transpose(1, 2)
        K = self.W_K(K).view(B, seq_len_k, self.h, self.d_k).transpose(1, 2)
        V = self.W_V(V).view(B, seq_len_k, self.h, self.d_v).transpose(1, 2)

        # Attention
        out, attn = self.attention(Q, K, V, mask)

        # Concatenate heads
        out = out.transpose(1, 2).contiguous().view(B, seq_len_q, -1)
        return self.W_O(out), attn

# ---------------------------------------------------------------------------
# Position-wise Feed-Forward Network  (Section 3.3)
# ---------------------------------------------------------------------------
class FeedForward(nn.Module):
    def __init__(self):
        super().__init__()
        self.linear1 = nn.Linear(D_MODEL, D_FF)
        self.linear2 = nn.Linear(D_FF, D_MODEL)
        self.dropout = nn.Dropout(DROPOUT)

    def forward(self, x):
        return self.linear2(self.dropout(F.relu(self.linear1(x))))

# ---------------------------------------------------------------------------
# Sinusoidal Positional Encoding  (Section 3.5, Table 1)
# ---------------------------------------------------------------------------
class PositionalEncoding(nn.Module):
    def __init__(self, max_len=5000):
        super().__init__()
        pe = torch.zeros(max_len, D_MODEL)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, D_MODEL, 2, dtype=torch.float) *
                             (-math.log(10000.0) / D_MODEL))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)  # (1, max_len, D_MODEL)
        self.register_buffer('pe', pe)

    def forward(self, x):
        # x: (B, seq_len, D_MODEL)
        return x + self.pe[:, :x.size(1), :]

# ---------------------------------------------------------------------------
# Embedding (shared between encoder & decoder, Section 3.2, bottom of p.5)
# ---------------------------------------------------------------------------
class Embeddings(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        self.lut = nn.Embedding(vocab_size, D_MODEL, padding_idx=PAD_IDX)
        self.d_model = D_MODEL

    def forward(self, x):
        return self.lut(x) * math.sqrt(self.d_model)

# ---------------------------------------------------------------------------
# Encoder Layer  (Section 3.1)
# ---------------------------------------------------------------------------
class EncoderLayer(nn.Module):
    def __init__(self):
        super().__init__()
        self.self_attn = MultiHeadAttention()
        self.ffn = FeedForward()
        self.norm1 = nn.LayerNorm(D_MODEL)
        self.norm2 = nn.LayerNorm(D_MODEL)
        self.dropout1 = nn.Dropout(DROPOUT)
        self.dropout2 = nn.Dropout(DROPOUT)

    def forward(self, x, mask=None):
        # Sub-layer 1: Multi-Head Self-Attention + Add & Norm
        attn_out, _ = self.self_attn(x, x, x, mask)
        x = self.norm1(x + self.dropout1(attn_out))

        # Sub-layer 2: FFN + Add & Norm
        ffn_out = self.ffn(x)
        x = self.norm2(x + self.dropout2(ffn_out))
        return x

# ---------------------------------------------------------------------------
# Encoder (Stack of N=6 layers)
# ---------------------------------------------------------------------------
class Encoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.ModuleList([EncoderLayer() for _ in range(N_LAYERS)])

    def forward(self, x, mask=None):
        for layer in self.layers:
            x = layer(x, mask)
        return x

# ---------------------------------------------------------------------------
# Decoder Layer  (Section 3.1)
# ---------------------------------------------------------------------------
class DecoderLayer(nn.Module):
    def __init__(self):
        super().__init__()
        # Sub-layer 1: Masked Self-Attention
        self.masked_attn = MultiHeadAttention()
        # Sub-layer 2: Cross-Attention (encoder-decoder attention)
        self.cross_attn = MultiHeadAttention()
        # Sub-layer 3: FFN
        self.ffn = FeedForward()

        self.norm1 = nn.LayerNorm(D_MODEL)
        self.norm2 = nn.LayerNorm(D_MODEL)
        self.norm3 = nn.LayerNorm(D_MODEL)
        self.dropout1 = nn.Dropout(DROPOUT)
        self.dropout2 = nn.Dropout(DROPOUT)
        self.dropout3 = nn.Dropout(DROPOUT)

    def forward(self, x, memory, src_mask=None, tgt_mask=None):
        # Sub-layer 1: Masked Self-Attention
        attn_out, _ = self.masked_attn(x, x, x, tgt_mask)
        x = self.norm1(x + self.dropout1(attn_out))

        # Sub-layer 2: Cross-Attention (Q=decoder, K,V=encoder)
        attn_out, _ = self.cross_attn(x, memory, memory, src_mask)
        x = self.norm2(x + self.dropout2(attn_out))

        # Sub-layer 3: FFN
        ffn_out = self.ffn(x)
        x = self.norm3(x + self.dropout3(ffn_out))
        return x

# ---------------------------------------------------------------------------
# Decoder (Stack of N=6 layers)
# ---------------------------------------------------------------------------
class Decoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.ModuleList([DecoderLayer() for _ in range(N_LAYERS)])

    def forward(self, x, memory, src_mask=None, tgt_mask=None):
        for layer in self.layers:
            x = layer(x, memory, src_mask, tgt_mask)
        return x

# ---------------------------------------------------------------------------
# Full Transformer  (Figure 1)
# ---------------------------------------------------------------------------
class Transformer(nn.Module):
    """
    Full Transformer model as described in "Attention Is All You Need".

    Args:
        src_vocab_size: source vocabulary size
        tgt_vocab_size: target vocabulary size
    """
    def __init__(self, src_vocab_size, tgt_vocab_size):
        super().__init__()
        self.src_embed   = Embeddings(src_vocab_size)
        self.tgt_embed   = Embeddings(tgt_vocab_size)
        self.pos_enc     = PositionalEncoding()
        self.encoder     = Encoder()
        self.decoder     = Decoder()
        self.generator   = nn.Linear(D_MODEL, tgt_vocab_size, bias=False)

        # Shared embedding weights (Section 3.2, 5.1)
        self.tgt_embed.lut.weight = self.generator.weight

        self._init_parameters()

    def _init_parameters(self):
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)

    def forward(self, src, tgt, src_mask=None, tgt_mask=None):
        # src, tgt: (B, seq_len)
        src_emb = self.pos_enc(self.src_embed(src))
        tgt_emb = self.pos_enc(self.tgt_embed(tgt))

        memory = self.encoder(src_emb, src_mask)
        out = self.decoder(tgt_emb, memory, src_mask, tgt_mask)

        return self.generator(out)

    # -----------------------------------------------------------------------
    # Helper: generate look-ahead mask for decoder self-attention  (p.5)
    # -----------------------------------------------------------------------
    @staticmethod
    def generate_subsequent_mask(sz):
        """Upper-triangular matrix to mask future positions."""
        return torch.triu(torch.full((sz, sz), float('-inf')), diagonal=1)

    # -----------------------------------------------------------------------
    # Helper: padding mask
    # -----------------------------------------------------------------------
    @staticmethod
    def generate_padding_mask(seq, pad_idx=PAD_IDX):
        """Mask padding positions. Returns (B, 1, 1, seq_len)."""
        return (seq != pad_idx).unsqueeze(1).unsqueeze(2)


# ---------------------------------------------------------------------------
# Quick sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    B, SRC_LEN, TGT_LEN = 2, 10, 12
    SRC_VOCAB, TGT_VOCAB = 100, 100

    model = Transformer(SRC_VOCAB, TGT_VOCAB)
    src = torch.randint(1, SRC_VOCAB, (B, SRC_LEN))
    tgt = torch.randint(1, TGT_VOCAB, (B, TGT_LEN))

    src_pad_mask = model.generate_padding_mask(src)
    tgt_pad_mask = model.generate_padding_mask(tgt)
    tgt_sub_mask = (model.generate_subsequent_mask(TGT_LEN) == 0).unsqueeze(0)
    tgt_mask = tgt_pad_mask & tgt_sub_mask  # combine padding + look-ahead

    out = model(src, tgt, src_pad_mask, tgt_mask)
    print(f"src shape      : {src.shape}")
    print(f"tgt shape      : {tgt.shape}")
    print(f"output shape   : {out.shape}")
    print(f"Expected       : ({B}, {TGT_LEN}, {TGT_VOCAB})")
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total params   : {total_params:,}")
