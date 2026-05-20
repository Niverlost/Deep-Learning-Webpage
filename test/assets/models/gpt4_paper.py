"""
GPT-4 Technical Report
Authors: OpenAI
Year: 2023
arXiv: https://arxiv.org/abs/2303.08774

Note: This is a conceptual implementation based on publicly available information.
GPT-4's exact architecture is not publicly disclosed. This implementation scales
up GPT-2's architecture with MoE (Mixture of Experts) layers to demonstrate
the core concepts discussed in the technical report.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


N_LAYERS = 48
N_HEADS = 64
D_MODEL = 8192
D_HEAD = D_MODEL // N_HEADS
D_FF = D_MODEL * 4
NUM_EXPERTS = 8
TOP_K = 2
VOCAB_SIZE = 100256
MAX_SEQ_LEN = 8192
DROPOUT = 0.0


class RMSNorm(nn.Module):
    def __init__(self, dim: int, eps: float = 1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        rms = x.pow(2).mean(dim=-1, keepdim=True).sqrt()
        x_norm = x / (rms + self.eps)
        return self.weight * x_norm


class RotaryPositionalEmbedding(nn.Module):
    def __init__(self, d_head: int, max_seq_len: int = MAX_SEQ_LEN, theta: float = 10000.0):
        super().__init__()
        self.d_head = d_head
        inv_freq = 1.0 / (theta ** (torch.arange(0, d_head, 2).float() / d_head))
        self.register_buffer("inv_freq", inv_freq)
        t = torch.arange(max_seq_len, dtype=torch.float32)
        freqs = torch.einsum("i,j->ij", t, self.inv_freq)
        emb = torch.cat([freqs, freqs], dim=-1)
        self.register_buffer("cos_cached", emb.cos()[None, None, :, :])
        self.register_buffer("sin_cached", emb.sin()[None, None, :, :])

    def forward(self, x: torch.Tensor, seq_len: int) -> tuple[torch.Tensor, torch.Tensor]:
        return (
            self.cos_cached[:, :, :seq_len, :],
            self.sin_cached[:, :, :seq_len, :],
        )


def apply_rotary_pos_emb(x: torch.Tensor, cos: torch.Tensor, sin: torch.Tensor) -> torch.Tensor:
    d = x.shape[-1]
    x1, x2 = x[..., : d // 2], x[..., d // 2 :]
    return torch.cat([x1 * cos - x2 * sin, x1 * sin + x2 * cos], dim=-1)


class CausalSelfAttention(nn.Module):
    def __init__(self):
        super().__init__()
        self.n_heads = N_HEADS
        self.d_head = D_HEAD
        self.d_model = D_MODEL
        self.c_attn = nn.Linear(D_MODEL, 3 * D_MODEL, bias=False)
        self.c_proj = nn.Linear(D_MODEL, D_MODEL, bias=False)
        self.rope = RotaryPositionalEmbedding(D_HEAD)
        self.register_buffer(
            "bias",
            torch.tril(torch.ones(MAX_SEQ_LEN, MAX_SEQ_LEN)).view(1, 1, MAX_SEQ_LEN, MAX_SEQ_LEN),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.size()
        q, k, v = self.c_attn(x).split(self.d_model, dim=2)
        q = q.view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        k = k.view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        v = v.view(B, T, self.n_heads, self.d_head).transpose(1, 2)

        cos, sin = self.rope(q, T)
        q = apply_rotary_pos_emb(q, cos, sin)
        k = apply_rotary_pos_emb(k, cos, sin)

        att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(self.d_head))
        att = att.masked_fill(self.bias[:, :, :T, :T] == 0, float("-inf"))
        att = F.softmax(att, dim=-1)
        y = att @ v
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        return self.c_proj(y)


class Expert(nn.Module):
    def __init__(self):
        super().__init__()
        self.w1 = nn.Linear(D_MODEL, D_FF, bias=False)
        self.w2 = nn.Linear(D_FF, D_MODEL, bias=False)
        self.w3 = nn.Linear(D_MODEL, D_FF, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.w2(F.silu(self.w1(x)) * self.w3(x))


class MoELayer(nn.Module):
    def __init__(self):
        super().__init__()
        self.num_experts = NUM_EXPERTS
        self.top_k = TOP_K
        self.gate = nn.Linear(D_MODEL, NUM_EXPERTS, bias=False)
        self.experts = nn.ModuleList([Expert() for _ in range(NUM_EXPERTS)])

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.shape
        x_flat = x.view(-1, C)
        gate_logits = self.gate(x_flat)
        weights, selected_experts = torch.topk(F.softmax(gate_logits, dim=-1), self.top_k, dim=-1)
        weights = weights / weights.sum(dim=-1, keepdim=True)

        output = torch.zeros_like(x_flat)
        for i, expert in enumerate(self.experts):
            mask = (selected_experts == i).any(dim=-1)
            if mask.any():
                expert_input = x_flat[mask]
                expert_out = expert(expert_input)
                expert_weights = weights[mask][selected_experts[mask] == i].view(-1, self.top_k, 1)
                expert_weights = expert_weights.sum(dim=1)
                output[mask] += expert_weights * expert_out

        return output.view(B, T, C)


class TransformerBlock(nn.Module):
    def __init__(self):
        super().__init__()
        self.ln1 = RMSNorm(D_MODEL)
        self.attn = CausalSelfAttention()
        self.ln2 = RMSNorm(D_MODEL)
        self.moe = MoELayer()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attn(self.ln1(x))
        x = x + self.moe(self.ln2(x))
        return x


class GPT4(nn.Module):
    def __init__(self):
        super().__init__()
        self.wte = nn.Embedding(VOCAB_SIZE, D_MODEL)
        self.blocks = nn.ModuleList([TransformerBlock() for _ in range(N_LAYERS)])
        self.ln_f = RMSNorm(D_MODEL)
        self.lm_head = nn.Linear(D_MODEL, VOCAB_SIZE, bias=False)
        self.wte.weight = self.lm_head.weight

        self.apply(self._init_weights)

    def _init_weights(self, module: nn.Module) -> None:
        if isinstance(module, nn.Linear):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
        elif isinstance(module, nn.Embedding):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, idx: torch.Tensor) -> torch.Tensor:
        B, T = idx.size()
        x = self.wte(idx)
        for block in self.blocks:
            x = block(x)
        x = self.ln_f(x)
        logits = self.lm_head(x)
        return logits


if __name__ == "__main__":
    model = GPT4()
    dummy_input = torch.randint(0, VOCAB_SIZE, (1, 128))
    output = model(dummy_input)
    print(f"Input shape:  {dummy_input.shape}")
    print(f"Output shape: {output.shape}")
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,}")
