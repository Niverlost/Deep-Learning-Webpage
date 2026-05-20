"""
BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding
Jacob Devlin, Ming-Wei Chang, Kenton Lee, Kristina Toutanova
ACL 2019 (arXiv:1810.04805)
https://arxiv.org/abs/1810.04805

Paper-faithful PyTorch implementation of BERT-Base architecture.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Configuration constants (BERT-Base, Section 3 + Appendix A.2)
# ---------------------------------------------------------------------------
L = 12          # Number of Transformer encoder layers
H = 768         # Hidden size
A = 12          # Number of self-attention heads
d_ff = 3072     # Feed-forward intermediate size (4 * H)
max_seq_len = 512
vocab_size = 30522
dropout = 0.1


d_k = H // A
d_v = H // A


# ---------------------------------------------------------------------------
# Architecture blocks
# ---------------------------------------------------------------------------
class BertEmbeddings(nn.Module):
    def __init__(self):
        super().__init__()
        self.word_embeddings = nn.Embedding(vocab_size, H)
        self.position_embeddings = nn.Embedding(max_seq_len, H)
        self.token_type_embeddings = nn.Embedding(2, H)
        self.layer_norm = nn.LayerNorm(H, eps=1e-12)
        self.dropout = nn.Dropout(dropout)

    def forward(self, input_ids, token_type_ids=None):
        seq_len = input_ids.size(1)
        pos_ids = torch.arange(seq_len, dtype=torch.long, device=input_ids.device).unsqueeze(0)
        if token_type_ids is None:
            token_type_ids = torch.zeros_like(input_ids)

        w = self.word_embeddings(input_ids)
        p = self.position_embeddings(pos_ids)
        t = self.token_type_embeddings(token_type_ids)
        embeddings = w + p + t
        embeddings = self.layer_norm(embeddings)
        embeddings = self.dropout(embeddings)
        return embeddings


class BertSelfAttention(nn.Module):
    def __init__(self):
        super().__init__()
        self.W_Q = nn.Linear(H, H)
        self.W_K = nn.Linear(H, H)
        self.W_V = nn.Linear(H, H)
        self.W_O = nn.Linear(H, H)
        self.dropout = nn.Dropout(dropout)

    def forward(self, hidden_states, attention_mask=None):
        batch_size = hidden_states.size(0)
        seq_len = hidden_states.size(1)

        Q = self.W_Q(hidden_states).view(batch_size, seq_len, A, d_k).transpose(1, 2)
        K = self.W_K(hidden_states).view(batch_size, seq_len, A, d_k).transpose(1, 2)
        V = self.W_V(hidden_states).view(batch_size, seq_len, A, d_v).transpose(1, 2)

        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)
        if attention_mask is not None:
            scores = scores + attention_mask
        attn = F.softmax(scores, dim=-1)
        attn = self.dropout(attn)

        context = torch.matmul(attn, V)
        context = context.transpose(1, 2).contiguous().view(batch_size, seq_len, H)
        output = self.W_O(context)
        output = self.dropout(output)
        return output


class BertSelfOutput(nn.Module):
    def __init__(self):
        super().__init__()
        self.dense = nn.Linear(H, H)
        self.layer_norm = nn.LayerNorm(H, eps=1e-12)
        self.dropout = nn.Dropout(dropout)

    def forward(self, hidden_states, input_tensor):
        hidden_states = self.dense(hidden_states)
        hidden_states = self.dropout(hidden_states)
        hidden_states = self.layer_norm(hidden_states + input_tensor)
        return hidden_states


class BertAttention(nn.Module):
    def __init__(self):
        super().__init__()
        self.self = BertSelfAttention()
        self.output = BertSelfOutput()

    def forward(self, hidden_states, attention_mask=None):
        self_outputs = self.self(hidden_states, attention_mask)
        attention_output = self.output(self_outputs, hidden_states)
        return attention_output


class BertIntermediate(nn.Module):
    def __init__(self):
        super().__init__()
        self.dense = nn.Linear(H, d_ff)

    def forward(self, hidden_states):
        hidden_states = self.dense(hidden_states)
        hidden_states = F.gelu(hidden_states)
        return hidden_states


class BertOutput(nn.Module):
    def __init__(self):
        super().__init__()
        self.dense = nn.Linear(d_ff, H)
        self.layer_norm = nn.LayerNorm(H, eps=1e-12)
        self.dropout = nn.Dropout(dropout)

    def forward(self, hidden_states, input_tensor):
        hidden_states = self.dense(hidden_states)
        hidden_states = self.dropout(hidden_states)
        hidden_states = self.layer_norm(hidden_states + input_tensor)
        return hidden_states


class BertLayer(nn.Module):
    def __init__(self):
        super().__init__()
        self.attention = BertAttention()
        self.intermediate = BertIntermediate()
        self.output = BertOutput()

    def forward(self, hidden_states, attention_mask=None):
        attention_output = self.attention(hidden_states, attention_mask)
        intermediate_output = self.intermediate(attention_output)
        layer_output = self.output(intermediate_output, attention_output)
        return layer_output


# ---------------------------------------------------------------------------
# Encoder
# ---------------------------------------------------------------------------
class BertEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.layer = nn.ModuleList([BertLayer() for _ in range(L)])

    def forward(self, hidden_states, attention_mask=None):
        for layer_module in self.layer:
            hidden_states = layer_module(hidden_states, attention_mask)
        return hidden_states


# ---------------------------------------------------------------------------
# Pooler
# ---------------------------------------------------------------------------
class BertPooler(nn.Module):
    def __init__(self):
        super().__init__()
        self.dense = nn.Linear(H, H)
        self.activation = nn.Tanh()

    def forward(self, hidden_states):
        first_token_tensor = hidden_states[:, 0]
        pooled_output = self.dense(first_token_tensor)
        pooled_output = self.activation(pooled_output)
        return pooled_output


# ---------------------------------------------------------------------------
# Full BERT model
# ---------------------------------------------------------------------------
class BertModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.embeddings = BertEmbeddings()
        self.encoder = BertEncoder()
        self.pooler = BertPooler()

    def forward(self, input_ids, token_type_ids=None, attention_mask=None):
        if attention_mask is not None:
            attention_mask = attention_mask.unsqueeze(1).unsqueeze(2)
            attention_mask = (1.0 - attention_mask) * -10000.0

        embedding_output = self.embeddings(input_ids, token_type_ids)
        encoder_output = self.encoder(embedding_output, attention_mask)
        pooled_output = self.pooler(encoder_output)
        return encoder_output, pooled_output


# ---------------------------------------------------------------------------
# __main__ sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = BertModel()
    input_ids = torch.randint(0, vocab_size, (2, 32))
    token_type_ids = torch.zeros_like(input_ids)
    attention_mask = torch.ones_like(input_ids)

    seq_output, pooled_output = model(input_ids, token_type_ids, attention_mask)
    print("Input shape:        ", input_ids.shape)
    print("Sequence output:    ", seq_output.shape)
    print("Pooled output [CLS]:", pooled_output.shape)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters:   {total_params:,}")
