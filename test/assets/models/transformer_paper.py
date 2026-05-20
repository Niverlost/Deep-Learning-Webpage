"""
Attention Is All You Need
Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit,
Llion Jones, Aidan N. Gomez, Łukasz Kaiser, Illia Polosukhin
NeurIPS 2017
https://arxiv.org/abs/1706.03762

Paper-faithful PyTorch implementation of the Transformer (base) architecture.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Configuration constants (Transformer base, Table 3)
# ---------------------------------------------------------------------------
d_model = 512
n_heads = 8
d_ff = 2048
n_encoder_layers = 6
n_decoder_layers = 6
dropout = 0.1
max_seq_len = 512
vocab_size = 37000


d_k = d_model // n_heads
d_v = d_model // n_heads


# ---------------------------------------------------------------------------
# Architecture blocks
# ---------------------------------------------------------------------------
class ScaledDotProductAttention(nn.Module):
    def __init__(self):
        super().__init__()

    def forward(self, Q, K, V, mask=None):
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, -1e9)
        attn = F.softmax(scores, dim=-1)
        output = torch.matmul(attn, V)
        return output, attn


class MultiHeadAttention(nn.Module):
    def __init__(self):
        super().__init__()
        self.W_Q = nn.Linear(d_model, n_heads * d_k)
        self.W_K = nn.Linear(d_model, n_heads * d_k)
        self.W_V = nn.Linear(d_model, n_heads * d_v)
        self.W_O = nn.Linear(n_heads * d_v, d_model)
        self.attention = ScaledDotProductAttention()
        self.dropout = nn.Dropout(dropout)
        self.layer_norm = nn.LayerNorm(d_model, eps=1e-6)

    def forward(self, query, key, value, mask=None):
        batch_size = query.size(0)
        len_q, len_k, len_v = query.size(1), key.size(1), value.size(1)

        Q = self.W_Q(query).view(batch_size, len_q, n_heads, d_k).transpose(1, 2)
        K = self.W_K(key).view(batch_size, len_k, n_heads, d_k).transpose(1, 2)
        V = self.W_V(value).view(batch_size, len_v, n_heads, d_v).transpose(1, 2)

        context, attn = self.attention(Q, K, V, mask=mask)
        context = context.transpose(1, 2).contiguous().view(batch_size, len_q, n_heads * d_v)
        output = self.W_O(context)
        output = self.dropout(output)
        output = self.layer_norm(output + query)
        return output, attn


class PositionwiseFeedForward(nn.Module):
    def __init__(self):
        super().__init__()
        self.w_1 = nn.Linear(d_model, d_ff)
        self.w_2 = nn.Linear(d_ff, d_model)
        self.dropout = nn.Dropout(dropout)
        self.layer_norm = nn.LayerNorm(d_model, eps=1e-6)

    def forward(self, x):
        residual = x
        x = self.w_1(x)
        x = F.relu(x)
        x = self.dropout(x)
        x = self.w_2(x)
        x = self.dropout(x)
        x = self.layer_norm(x + residual)
        return x


class PositionalEncoding(nn.Module):
    def __init__(self):
        super().__init__()
        pe = torch.zeros(max_seq_len, d_model)
        position = torch.arange(0, max_seq_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)
        self.register_buffer('pe', pe)

    def forward(self, x):
        return x + self.pe[:, :x.size(1), :]


class EncoderLayer(nn.Module):
    def __init__(self):
        super().__init__()
        self.self_attn = MultiHeadAttention()
        self.pos_ffn = PositionwiseFeedForward()

    def forward(self, enc_input, self_attn_mask=None):
        enc_output, enc_self_attn = self.self_attn(enc_input, enc_input, enc_input, mask=self_attn_mask)
        enc_output = self.pos_ffn(enc_output)
        return enc_output, enc_self_attn


class DecoderLayer(nn.Module):
    def __init__(self):
        super().__init__()
        self.self_attn = MultiHeadAttention()
        self.enc_attn = MultiHeadAttention()
        self.pos_ffn = PositionwiseFeedForward()

    def forward(self, dec_input, enc_output, self_attn_mask=None, dec_enc_attn_mask=None):
        dec_output, dec_self_attn = self.self_attn(dec_input, dec_input, dec_input, mask=self_attn_mask)
        dec_output, dec_enc_attn = self.enc_attn(dec_output, enc_output, enc_output, mask=dec_enc_attn_mask)
        dec_output = self.pos_ffn(dec_output)
        return dec_output, dec_self_attn, dec_enc_attn


# ---------------------------------------------------------------------------
# Encoder
# ---------------------------------------------------------------------------
class Encoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.src_word_emb = nn.Embedding(vocab_size, d_model)
        self.pos_encoding = PositionalEncoding()
        self.dropout = nn.Dropout(dropout)
        self.layers = nn.ModuleList([EncoderLayer() for _ in range(n_encoder_layers)])
        self.layer_norm = nn.LayerNorm(d_model, eps=1e-6)

    def forward(self, src_seq, src_mask=None):
        enc_output = self.src_word_emb(src_seq)
        enc_output = self.pos_encoding(enc_output)
        enc_output = self.dropout(enc_output)
        for layer in self.layers:
            enc_output, _ = layer(enc_output, self_attn_mask=src_mask)
        enc_output = self.layer_norm(enc_output)
        return enc_output


# ---------------------------------------------------------------------------
# Decoder
# ---------------------------------------------------------------------------
class Decoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.tgt_word_emb = nn.Embedding(vocab_size, d_model)
        self.pos_encoding = PositionalEncoding()
        self.dropout = nn.Dropout(dropout)
        self.layers = nn.ModuleList([DecoderLayer() for _ in range(n_decoder_layers)])
        self.layer_norm = nn.LayerNorm(d_model, eps=1e-6)

    def forward(self, tgt_seq, enc_output, tgt_mask=None, src_mask=None):
        dec_output = self.tgt_word_emb(tgt_seq)
        dec_output = self.pos_encoding(dec_output)
        dec_output = self.dropout(dec_output)
        for layer in self.layers:
            dec_output, _, _ = layer(dec_output, enc_output, self_attn_mask=tgt_mask, dec_enc_attn_mask=src_mask)
        dec_output = self.layer_norm(dec_output)
        return dec_output


# ---------------------------------------------------------------------------
# Full Transformer
# ---------------------------------------------------------------------------
class Transformer(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = Encoder()
        self.decoder = Decoder()
        self.projection = nn.Linear(d_model, vocab_size, bias=False)

    def forward(self, src_seq, tgt_seq, src_mask=None, tgt_mask=None):
        enc_output = self.encoder(src_seq, src_mask=src_mask)
        dec_output = self.decoder(tgt_seq, enc_output, tgt_mask=tgt_mask, src_mask=src_mask)
        seq_logit = self.projection(dec_output)
        return seq_logit


# ---------------------------------------------------------------------------
# __main__ sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = Transformer()
    src = torch.randint(0, vocab_size, (2, 10))
    tgt = torch.randint(0, vocab_size, (2, 12))
    out = model(src, tgt)
    print("Input src shape:", src.shape)
    print("Input tgt shape:", tgt.shape)
    print("Output shape:   ", out.shape)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,}")
