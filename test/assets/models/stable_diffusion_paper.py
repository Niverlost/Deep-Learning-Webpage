"""
High-Resolution Image Synthesis with Latent Diffusion Models
Robin Rombach, Andreas Blattmann, Dominik Lorenz, Patrick Esser, Björn Ommer
CVPR 2022
https://arxiv.org/abs/2112.10752

Paper-faithful implementation of Latent Diffusion Model (Stable Diffusion).
Simplified but structurally correct: U-Net + CLIP Text Encoder + VAE.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Configuration constants (Stable Diffusion v1.4)
# ---------------------------------------------------------------------------
IMAGE_SIZE = 512
LATENT_CHANNELS = 4
MODEL_CHANNELS = 320
CHANNEL_MULT = [1, 2, 4, 4]
NUM_RES_BLOCKS = 2
ATTENTION_RESOLUTIONS = [4, 2, 1]
DROPOUT = 0.0
NUM_HEADS = 8
CONTEXT_DIM = 768
TRANSFORMER_DEPTH = 1
VAE_CH = 128
VAE_CH_MULT = [1, 2, 4, 4]
VAE_Z_CHANNELS = 4
CLIP_VOCAB_SIZE = 49408
CLIP_MAX_LENGTH = 77
CLIP_EMBED_DIM = 768
CLIP_HIDDEN_DIM = 3072
CLIP_NUM_LAYERS = 12
CLIP_NUM_HEADS = 12


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------
def timestep_embedding(timesteps, dim, max_period=10000):
    half = dim // 2
    freqs = torch.exp(
        -math.log(max_period) * torch.arange(0, half, dtype=torch.float32) / half
    ).to(timesteps.device)
    args = timesteps[:, None].float() * freqs[None]
    embedding = torch.cat([torch.cos(args), torch.sin(args)], dim=-1)
    if dim % 2:
        embedding = torch.cat([embedding, torch.zeros_like(embedding[:, :1])], dim=-1)
    return embedding


class GroupNorm32(nn.GroupNorm):
    def __init__(self, num_channels):
        super().__init__(num_groups=32, num_channels=num_channels, eps=1e-6, affine=True)


# ---------------------------------------------------------------------------
# VAE (simplified AutoencoderKL structure)
# ---------------------------------------------------------------------------
class VAEEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv_in = nn.Conv2d(3, VAE_CH, 3, padding=1)
        ch_in = VAE_CH
        self.down = nn.ModuleList()
        for i, mult in enumerate(VAE_CH_MULT):
            ch_out = VAE_CH * mult
            for _ in range(NUM_RES_BLOCKS):
                self.down.append(nn.Sequential(
                    GroupNorm32(ch_in),
                    nn.SiLU(),
                    nn.Conv2d(ch_in, ch_out, 3, padding=1),
                ))
                ch_in = ch_out
            if i != len(VAE_CH_MULT) - 1:
                self.down.append(nn.Conv2d(ch_in, ch_in, 3, stride=2, padding=1))
        self.mid = nn.Sequential(
            GroupNorm32(ch_in),
            nn.SiLU(),
            nn.Conv2d(ch_in, ch_in, 3, padding=1),
        )
        self.conv_out = nn.Conv2d(ch_in, VAE_Z_CHANNELS * 2, 3, padding=1)

    def forward(self, x):
        x = self.conv_in(x)
        for block in self.down:
            x = block(x)
        x = self.mid(x)
        x = self.conv_out(x)
        return x


class VAEDecoder(nn.Module):
    def __init__(self):
        super().__init__()
        ch_in = VAE_CH * VAE_CH_MULT[-1]
        self.conv_in = nn.Conv2d(VAE_Z_CHANNELS, ch_in, 3, padding=1)
        self.mid = nn.Sequential(
            GroupNorm32(ch_in),
            nn.SiLU(),
            nn.Conv2d(ch_in, ch_in, 3, padding=1),
        )
        self.up = nn.ModuleList()
        for i, mult in enumerate(reversed(VAE_CH_MULT)):
            ch_out = VAE_CH * mult
            for _ in range(NUM_RES_BLOCKS + 1):
                self.up.append(nn.Sequential(
                    GroupNorm32(ch_in),
                    nn.SiLU(),
                    nn.Conv2d(ch_in, ch_out, 3, padding=1),
                ))
                ch_in = ch_out
            if i != len(VAE_CH_MULT) - 1:
                self.up.append(nn.Upsample(scale_factor=2, mode="nearest"))
        self.conv_out = nn.Sequential(
            GroupNorm32(ch_in),
            nn.SiLU(),
            nn.Conv2d(ch_in, 3, 3, padding=1),
        )

    def forward(self, x):
        x = self.conv_in(x)
        x = self.mid(x)
        for block in self.up:
            x = block(x)
        x = self.conv_out(x)
        return x


class VAE(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = VAEEncoder()
        self.decoder = VAEDecoder()

    def encode(self, x):
        h = self.encoder(x)
        mean, logvar = h.chunk(2, dim=1)
        return mean, logvar

    def reparameterize(self, mean, logvar):
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mean + eps * std

    def decode(self, z):
        return self.decoder(z)

    def forward(self, x):
        mean, logvar = self.encode(x)
        z = self.reparameterize(mean, logvar)
        return self.decode(z)


# ---------------------------------------------------------------------------
# CLIP Text Encoder (simplified)
# ---------------------------------------------------------------------------
class CLIPAttention(nn.Module):
    def __init__(self):
        super().__init__()
        self.num_heads = CLIP_NUM_HEADS
        self.head_dim = CLIP_EMBED_DIM // CLIP_NUM_HEADS
        self.scale = self.head_dim ** -0.5
        self.q_proj = nn.Linear(CLIP_EMBED_DIM, CLIP_EMBED_DIM)
        self.k_proj = nn.Linear(CLIP_EMBED_DIM, CLIP_EMBED_DIM)
        self.v_proj = nn.Linear(CLIP_EMBED_DIM, CLIP_EMBED_DIM)
        self.out_proj = nn.Linear(CLIP_EMBED_DIM, CLIP_EMBED_DIM)

    def forward(self, x, causal_mask=None):
        b, n, _ = x.shape
        q = self.q_proj(x).view(b, n, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(b, n, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(b, n, self.num_heads, self.head_dim).transpose(1, 2)
        attn = torch.matmul(q, k.transpose(-2, -1)) * self.scale
        if causal_mask is not None:
            attn = attn.masked_fill(causal_mask == 0, float("-inf"))
        attn = F.softmax(attn, dim=-1)
        out = torch.matmul(attn, v)
        out = out.transpose(1, 2).contiguous().view(b, n, CLIP_EMBED_DIM)
        return self.out_proj(out)


class CLIPMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(CLIP_EMBED_DIM, CLIP_HIDDEN_DIM)
        self.fc2 = nn.Linear(CLIP_HIDDEN_DIM, CLIP_EMBED_DIM)

    def forward(self, x):
        x = self.fc1(x)
        x = F.gelu(x)
        x = self.fc2(x)
        return x


class CLIPEncoderLayer(nn.Module):
    def __init__(self):
        super().__init__()
        self.layer_norm1 = nn.LayerNorm(CLIP_EMBED_DIM, eps=1e-5)
        self.attn = CLIPAttention()
        self.layer_norm2 = nn.LayerNorm(CLIP_EMBED_DIM, eps=1e-5)
        self.mlp = CLIPMLP()

    def forward(self, x, causal_mask=None):
        x = x + self.attn(self.layer_norm1(x), causal_mask=causal_mask)
        x = x + self.mlp(self.layer_norm2(x))
        return x


class CLIPTextEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.token_embedding = nn.Embedding(CLIP_VOCAB_SIZE, CLIP_EMBED_DIM)
        self.position_embedding = nn.Parameter(torch.randn(CLIP_MAX_LENGTH, CLIP_EMBED_DIM))
        self.layers = nn.ModuleList([CLIPEncoderLayer() for _ in range(CLIP_NUM_LAYERS)])
        self.final_layer_norm = nn.LayerNorm(CLIP_EMBED_DIM, eps=1e-5)

    def forward(self, text_tokens):
        b, n = text_tokens.shape
        x = self.token_embedding(text_tokens)
        x = x + self.position_embedding[None, :n, :]
        causal_mask = torch.triu(torch.ones(n, n, device=x.device), diagonal=1).bool()
        causal_mask = causal_mask.logical_not()[None, None, :, :]
        for layer in self.layers:
            x = layer(x, causal_mask=causal_mask)
        x = self.final_layer_norm(x)
        return x


# ---------------------------------------------------------------------------
# U-Net core blocks
# ---------------------------------------------------------------------------
class ResBlock(nn.Module):
    def __init__(self, in_ch, out_ch, time_emb_dim, dropout=DROPOUT):
        super().__init__()
        self.in_layers = nn.Sequential(
            GroupNorm32(in_ch),
            nn.SiLU(),
            nn.Conv2d(in_ch, out_ch, 3, padding=1),
        )
        self.emb_layers = nn.Sequential(
            nn.SiLU(),
            nn.Linear(time_emb_dim, out_ch),
        )
        self.out_layers = nn.Sequential(
            GroupNorm32(out_ch),
            nn.SiLU(),
            nn.Dropout(dropout),
            nn.Conv2d(out_ch, out_ch, 3, padding=1),
        )
        if in_ch == out_ch:
            self.skip = nn.Identity()
        else:
            self.skip = nn.Conv2d(in_ch, out_ch, 1)

    def forward(self, x, emb):
        h = self.in_layers(x)
        emb_out = self.emb_layers(emb)[:, :, None, None]
        h = h + emb_out
        h = self.out_layers(h)
        return self.skip(x) + h


class CrossAttention(nn.Module):
    def __init__(self, query_dim, context_dim, num_heads=NUM_HEADS):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = query_dim // num_heads
        self.scale = self.head_dim ** -0.5
        self.to_q = nn.Linear(query_dim, query_dim, bias=False)
        self.to_k = nn.Linear(context_dim, query_dim, bias=False)
        self.to_v = nn.Linear(context_dim, query_dim, bias=False)
        self.to_out = nn.Linear(query_dim, query_dim)

    def forward(self, x, context):
        b, n, _ = x.shape
        h = self.num_heads
        q = self.to_q(x).view(b, n, h, self.head_dim).transpose(1, 2)
        k = self.to_k(context).view(b, context.shape[1], h, self.head_dim).transpose(1, 2)
        v = self.to_v(context).view(b, context.shape[1], h, self.head_dim).transpose(1, 2)
        attn = torch.matmul(q, k.transpose(-2, -1)) * self.scale
        attn = F.softmax(attn, dim=-1)
        out = torch.matmul(attn, v)
        out = out.transpose(1, 2).contiguous().view(b, n, -1)
        return self.to_out(out)


class SpatialTransformer(nn.Module):
    def __init__(self, in_channels, num_heads, context_dim):
        super().__init__()
        inner_dim = in_channels
        self.norm = GroupNorm32(in_channels)
        self.proj_in = nn.Conv2d(in_channels, inner_dim, 1)
        self.attn1 = CrossAttention(inner_dim, inner_dim, num_heads)
        self.attn2 = CrossAttention(inner_dim, context_dim, num_heads)
        self.ff = nn.Sequential(
            nn.LayerNorm(inner_dim, eps=1e-6),
            nn.Linear(inner_dim, inner_dim * 4),
            nn.GELU(),
            nn.Linear(inner_dim * 4, inner_dim),
        )
        self.norm1 = nn.LayerNorm(inner_dim, eps=1e-6)
        self.norm2 = nn.LayerNorm(inner_dim, eps=1e-6)
        self.norm3 = nn.LayerNorm(inner_dim, eps=1e-6)
        self.proj_out = nn.Conv2d(inner_dim, in_channels, 1)

    def forward(self, x, context):
        b, c, h, w = x.shape
        x_in = x
        x = self.norm(x)
        x = self.proj_in(x)
        x = x.view(b, c, h * w).transpose(1, 2)
        x = self.attn1(self.norm1(x), x) + x
        x = self.attn2(self.norm2(x), context) + x
        x = self.ff(self.norm3(x)) + x
        x = x.transpose(1, 2).view(b, c, h, w)
        x = self.proj_out(x)
        return x + x_in


class Downsample(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.op = nn.Conv2d(channels, channels, 3, stride=2, padding=1)

    def forward(self, x):
        return self.op(x)


class Upsample(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.op = nn.Conv2d(channels, channels, 3, padding=1)

    def forward(self, x):
        x = F.interpolate(x, scale_factor=2, mode="nearest")
        return self.op(x)


# ---------------------------------------------------------------------------
# U-Net
# ---------------------------------------------------------------------------
class UNet(nn.Module):
    def __init__(self):
        super().__init__()
        time_embed_dim = MODEL_CHANNELS * 4
        self.time_embed = nn.Sequential(
            nn.Linear(MODEL_CHANNELS, time_embed_dim),
            nn.SiLU(),
            nn.Linear(time_embed_dim, time_embed_dim),
        )
        self.input_blocks = nn.ModuleList([
            nn.Conv2d(LATENT_CHANNELS, MODEL_CHANNELS, 3, padding=1)
        ])
        ch = MODEL_CHANNELS
        input_block_chans = [ch]
        ds = 1
        for level, mult in enumerate(CHANNEL_MULT):
            for _ in range(NUM_RES_BLOCKS):
                out_ch = MODEL_CHANNELS * mult
                layers = [ResBlock(ch, out_ch, time_embed_dim)]
                ch = out_ch
                if ds in ATTENTION_RESOLUTIONS:
                    layers.append(SpatialTransformer(ch, NUM_HEADS, CONTEXT_DIM))
                self.input_blocks.append(nn.Sequential(*layers))
                input_block_chans.append(ch)
            if level != len(CHANNEL_MULT) - 1:
                self.input_blocks.append(Downsample(ch))
                input_block_chans.append(ch)
                ds *= 2

        self.middle_block = nn.Sequential(
            ResBlock(ch, ch, time_embed_dim),
            SpatialTransformer(ch, NUM_HEADS, CONTEXT_DIM),
            ResBlock(ch, ch, time_embed_dim),
        )

        self.output_blocks = nn.ModuleList()
        for level, mult in list(enumerate(CHANNEL_MULT))[::-1]:
            for i in range(NUM_RES_BLOCKS + 1):
                ich = input_block_chans.pop()
                out_ch = MODEL_CHANNELS * mult
                layers = [ResBlock(ch + ich, out_ch, time_embed_dim)]
                ch = out_ch
                if ds in ATTENTION_RESOLUTIONS:
                    layers.append(SpatialTransformer(ch, NUM_HEADS, CONTEXT_DIM))
                if level != 0 and i == NUM_RES_BLOCKS:
                    layers.append(Upsample(ch))
                    ds //= 2
                self.output_blocks.append(nn.Sequential(*layers))

        self.out = nn.Sequential(
            GroupNorm32(ch),
            nn.SiLU(),
            nn.Conv2d(ch, LATENT_CHANNELS, 3, padding=1),
        )

    def forward(self, x, timesteps, context):
        emb = timestep_embedding(timesteps, MODEL_CHANNELS)
        emb = self.time_embed(emb)
        hs = []
        h = x
        for module in self.input_blocks:
            if isinstance(module, nn.Sequential):
                for layer in module:
                    if isinstance(layer, ResBlock):
                        h = layer(h, emb)
                    elif isinstance(layer, SpatialTransformer):
                        h = layer(h, context)
                    else:
                        h = layer(h)
            else:
                h = module(h)
            hs.append(h)
        for layer in self.middle_block:
            if isinstance(layer, ResBlock):
                h = layer(h, emb)
            elif isinstance(layer, SpatialTransformer):
                h = layer(h, context)
            else:
                h = layer(h)
        for module in self.output_blocks:
            h = torch.cat([h, hs.pop()], dim=1)
            for layer in module:
                if isinstance(layer, ResBlock):
                    h = layer(h, emb)
                elif isinstance(layer, SpatialTransformer):
                    h = layer(h, context)
                else:
                    h = layer(h)
        h = self.out(h)
        return h


# ---------------------------------------------------------------------------
# Full Latent Diffusion Model
# ---------------------------------------------------------------------------
class LatentDiffusion(nn.Module):
    def __init__(self):
        super().__init__()
        self.unet = UNet()
        self.vae = VAE()
        self.text_encoder = CLIPTextEncoder()

    def forward(self, x, text_tokens, timesteps):
        context = self.text_encoder(text_tokens)
        t = timesteps
        h = self.unet(x, t, context)
        return h


# ---------------------------------------------------------------------------
# __main__ sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = LatentDiffusion().to(device)

    batch_size = 1
    latent_h, latent_w = IMAGE_SIZE // 8, IMAGE_SIZE // 8
    x = torch.randn(batch_size, LATENT_CHANNELS, latent_h, latent_w).to(device)
    text_tokens = torch.randint(0, CLIP_VOCAB_SIZE, (batch_size, CLIP_MAX_LENGTH)).to(device)
    timesteps = torch.randint(0, 1000, (batch_size,)).to(device)

    with torch.no_grad():
        out = model(x, text_tokens, timesteps)

    print(f"Input latent shape:  {x.shape}")
    print(f"Text tokens shape:   {text_tokens.shape}")
    print(f"Timesteps shape:     {timesteps.shape}")
    print(f"Output noise shape:  {out.shape}")

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters:    {total_params:,}")
