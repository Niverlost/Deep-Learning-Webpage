"""
An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale
Alexey Dosovitskiy et al., 2020
arXiv: https://arxiv.org/abs/2010.11929

Paper-faithful implementation of ViT-Base/16.
"""

import torch
import torch.nn as nn


IMG_SIZE = 224
PATCH_SIZE = 16
NUM_CLASSES = 1000
D = 768
NUM_HEADS = 12
MLP_DIM = 3072
NUM_LAYERS = 12
DROPOUT = 0.1

NUM_PATCHES = (IMG_SIZE // PATCH_SIZE) ** 2
NUM_TOKENS = NUM_PATCHES + 1


class MultiHeadAttention(nn.Module):
    def __init__(self, d, num_heads, dropout):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = d // num_heads
        self.scale = self.head_dim ** -0.5

        self.qkv = nn.Linear(d, d * 3)
        self.proj = nn.Linear(d, d)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        B, N, D = x.shape
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim).permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]

        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)
        attn = self.dropout(attn)

        x = (attn @ v).transpose(1, 2).reshape(B, N, D)
        x = self.proj(x)
        x = self.dropout(x)
        return x


class MLP(nn.Module):
    def __init__(self, d, mlp_dim, dropout):
        super().__init__()
        self.fc1 = nn.Linear(d, mlp_dim)
        self.act = nn.GELU()
        self.dropout1 = nn.Dropout(dropout)
        self.fc2 = nn.Linear(mlp_dim, d)
        self.dropout2 = nn.Dropout(dropout)

    def forward(self, x):
        x = self.fc1(x)
        x = self.act(x)
        x = self.dropout1(x)
        x = self.fc2(x)
        x = self.dropout2(x)
        return x


class TransformerEncoderBlock(nn.Module):
    def __init__(self, d, num_heads, mlp_dim, dropout):
        super().__init__()
        self.norm1 = nn.LayerNorm(d)
        self.attn = MultiHeadAttention(d, num_heads, dropout)
        self.norm2 = nn.LayerNorm(d)
        self.mlp = MLP(d, mlp_dim, dropout)

    def forward(self, x):
        x = x + self.attn(self.norm1(x))
        x = x + self.mlp(self.norm2(x))
        return x


class ViT(nn.Module):
    def __init__(
        self,
        img_size=IMG_SIZE,
        patch_size=PATCH_SIZE,
        num_classes=NUM_CLASSES,
        d=D,
        num_layers=NUM_LAYERS,
        num_heads=NUM_HEADS,
        mlp_dim=MLP_DIM,
        dropout=DROPOUT,
    ):
        super().__init__()
        self.patch_embed = nn.Conv2d(3, d, kernel_size=patch_size, stride=patch_size)
        self.cls_token = nn.Parameter(torch.zeros(1, 1, d))
        self.pos_embed = nn.Parameter(torch.zeros(1, NUM_TOKENS, d))
        self.dropout = nn.Dropout(dropout)

        self.encoder = nn.Sequential(
            *[TransformerEncoderBlock(d, num_heads, mlp_dim, dropout) for _ in range(num_layers)]
        )
        self.norm = nn.LayerNorm(d)
        self.head = nn.Linear(d, num_classes)

    def forward(self, x):
        B = x.shape[0]
        x = self.patch_embed(x)
        x = x.flatten(2).transpose(1, 2)

        cls = self.cls_token.expand(B, -1, -1)
        x = torch.cat([cls, x], dim=1)
        x = x + self.pos_embed
        x = self.dropout(x)

        x = self.encoder(x)
        x = self.norm(x)
        x = x[:, 0]
        x = self.head(x)
        return x


if __name__ == "__main__":
    model = ViT()
    x = torch.randn(2, 3, IMG_SIZE, IMG_SIZE)
    y = model(x)
    print(f"Input shape:  {x.shape}")
    print(f"Output shape: {y.shape}")
    total = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total / 1e6:.1f}M")
