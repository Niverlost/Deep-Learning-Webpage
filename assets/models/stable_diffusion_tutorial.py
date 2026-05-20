"""
High-Resolution Image Synthesis with Latent Diffusion Models
Robin Rombach, Andreas Blattmann, Dominik Lorenz, Patrick Esser, Björn Ommer
CVPR 2022
https://arxiv.org/abs/2112.10752

初学者教程版 (Beginner-friendly tutorial implementation)

本模型是 Stable Diffusion (Latent Diffusion Model, LDM) 的简化实现，
核心思想：不在高维像素空间做扩散，而是在 VAE 压缩后的低维潜在空间做扩散，
大幅降低计算量，同时通过 Cross-Attention 引入文本条件控制生成内容。

关键概念:
- 潜在空间 (Latent Space): VAE 将图像压缩到的低维空间，扩散过程在此进行
- U-Net: 去噪网络的核心 backbone，带有 skip connection
- Cross-Attention: 将文本信息注入到图像特征中，实现文生图
- Time Embedding: 告诉模型当前处于扩散的哪个时间步
- CLIP: 将文本 prompt 编码为语义向量
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# 配置常量 (Stable Diffusion v1.4 超参数)
# ---------------------------------------------------------------------------
IMAGE_SIZE = 512               # 输入/输出图像分辨率
LATENT_CHANNELS = 4            # 潜在空间通道数 (VAE 编码后)
MODEL_CHANNELS = 320           # U-Net 基础通道数，决定模型宽度
CHANNEL_MULT = [1, 2, 4, 4]    # 每层的通道乘数: 320 -> 640 -> 1280 -> 1280
NUM_RES_BLOCKS = 2             # 每个分辨率下的 ResNetBlock 数量
ATTENTION_RESOLUTIONS = [4, 2, 1]  # 在哪些下采样倍数层加入 Attention (1x, 2x, 4x)
DROPOUT = 0.0                  # Dropout 概率 (推理时通常为 0)
NUM_HEADS = 8                  # Cross-Attention 的头数
CONTEXT_DIM = 768              # 文本条件向量维度 (CLIP 输出维度)
TRANSFORMER_DEPTH = 1          # SpatialTransformer 的层数
VAE_CH = 128                   # VAE 基础通道数
VAE_CH_MULT = [1, 2, 4, 4]     # VAE 下采样通道乘数
VAE_Z_CHANNELS = 4             # VAE 潜在变量通道数
CLIP_VOCAB_SIZE = 49408        # CLIP tokenizer 词表大小
CLIP_MAX_LENGTH = 77           # CLIP 最大文本长度
CLIP_EMBED_DIM = 768           # CLIP token embedding 维度
CLIP_HIDDEN_DIM = 3072         # CLIP MLP 隐藏层维度 (768 * 4)
CLIP_NUM_LAYERS = 12           # CLIP Transformer Encoder 层数
CLIP_NUM_HEADS = 12            # CLIP 注意力头数


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------
def timestep_embedding(timesteps, dim, max_period=10000):
    """
    正弦/余弦时间步嵌入 (Sinusoidal Time Embedding)。
    将整数时间步 t 编码为 dim 维向量，类似 Transformer 的位置编码。
    这让模型知道当前处于去噪过程的哪个阶段。
    """
    half = dim // 2
    # 频率序列，按指数衰减
    freqs = torch.exp(
        -math.log(max_period) * torch.arange(0, half, dtype=torch.float32) / half
    ).to(timesteps.device)
    args = timesteps[:, None].float() * freqs[None]
    embedding = torch.cat([torch.cos(args), torch.sin(args)], dim=-1)
    if dim % 2:
        embedding = torch.cat([embedding, torch.zeros_like(embedding[:, :1])], dim=-1)
    return embedding


class GroupNorm32(nn.GroupNorm):
    """GroupNorm，num_groups=32，论文中广泛使用。"""
    def __init__(self, num_channels):
        super().__init__(num_groups=32, num_channels=num_channels, eps=1e-6, affine=True)


# ---------------------------------------------------------------------------
# VAE (变分自编码器) - 感知压缩阶段
# ---------------------------------------------------------------------------
class VAEEncoder(nn.Module):
    """
    VAE 编码器：将 RGB 图像压缩为潜在变量。
    输入: (B, 3, H, W)
    输出: (B, 8, H/8, W/8) -> 拆分为 mean 和 logvar 各 (B, 4, H/8, W/8)
    """
    def __init__(self):
        super().__init__()
        self.conv_in = nn.Conv2d(3, VAE_CH, 3, padding=1)  # 初始卷积
        ch_in = VAE_CH
        self.down = nn.ModuleList()
        # 逐层下采样，通道数逐渐增加
        for i, mult in enumerate(VAE_CH_MULT):
            ch_out = VAE_CH * mult
            for _ in range(NUM_RES_BLOCKS):
                self.down.append(nn.Sequential(
                    GroupNorm32(ch_in),
                    nn.SiLU(),
                    nn.Conv2d(ch_in, ch_out, 3, padding=1),
                ))
                ch_in = ch_out
            # 每层最后下采样 (除了最后一层)
            if i != len(VAE_CH_MULT) - 1:
                self.down.append(nn.Conv2d(ch_in, ch_in, 3, stride=2, padding=1))
        self.mid = nn.Sequential(
            GroupNorm32(ch_in),
            nn.SiLU(),
            nn.Conv2d(ch_in, ch_in, 3, padding=1),
        )
        # 输出 mean 和 logvar (各一半通道)
        self.conv_out = nn.Conv2d(ch_in, VAE_Z_CHANNELS * 2, 3, padding=1)

    def forward(self, x):
        x = self.conv_in(x)
        for block in self.down:
            x = block(x)
        x = self.mid(x)
        x = self.conv_out(x)
        return x


class VAEDecoder(nn.Module):
    """
    VAE 解码器：将潜在变量还原为 RGB 图像。
    输入: (B, 4, H/8, W/8)
    输出: (B, 3, H, W)
    """
    def __init__(self):
        super().__init__()
        ch_in = VAE_CH * VAE_CH_MULT[-1]  # 从最大通道数开始
        self.conv_in = nn.Conv2d(VAE_Z_CHANNELS, ch_in, 3, padding=1)
        self.mid = nn.Sequential(
            GroupNorm32(ch_in),
            nn.SiLU(),
            nn.Conv2d(ch_in, ch_in, 3, padding=1),
        )
        self.up = nn.ModuleList()
        # 逐层上采样，通道数逐渐减少
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
    """
    完整 VAE：编码器 + 解码器 + 重参数化技巧。
    论文使用 KL-正则化 VAE，将图像压缩到潜在空间。
    """
    def __init__(self):
        super().__init__()
        self.encoder = VAEEncoder()
        self.decoder = VAEDecoder()

    def encode(self, x):
        """编码并返回 mean 和 logvar。"""
        h = self.encoder(x)
        mean, logvar = h.chunk(2, dim=1)
        return mean, logvar

    def reparameterize(self, mean, logvar):
        """重参数化技巧：从标准高斯采样，缩放平移得到潜在变量 z。"""
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mean + eps * std

    def decode(self, z):
        """从潜在变量解码为图像。"""
        return self.decoder(z)

    def forward(self, x):
        mean, logvar = self.encode(x)
        z = self.reparameterize(mean, logvar)
        return self.decode(z)


# ---------------------------------------------------------------------------
# CLIP Text Encoder - 文本编码器
# ---------------------------------------------------------------------------
class CLIPAttention(nn.Module):
    """
    CLIP 的多头自注意力层。
    与 Transformer 相同，使用因果掩码 (causal mask) 防止看到未来 token。
    """
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
        # 投影并拆分为多头
        q = self.q_proj(x).view(b, n, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(b, n, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(b, n, self.num_heads, self.head_dim).transpose(1, 2)
        # 缩放点积注意力
        attn = torch.matmul(q, k.transpose(-2, -1)) * self.scale
        if causal_mask is not None:
            attn = attn.masked_fill(causal_mask == 0, float("-inf"))
        attn = F.softmax(attn, dim=-1)
        out = torch.matmul(attn, v)
        out = out.transpose(1, 2).contiguous().view(b, n, CLIP_EMBED_DIM)
        return self.out_proj(out)


class CLIPMLP(nn.Module):
    """CLIP 的前馈网络：Linear -> GELU -> Linear。"""
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
    """
    CLIP Transformer Encoder 层。
    结构: LayerNorm -> Self-Attention -> Residual -> LayerNorm -> MLP -> Residual
    """
    def __init__(self):
        super().__init__()
        self.layer_norm1 = nn.LayerNorm(CLIP_EMBED_DIM, eps=1e-5)
        self.attn = CLIPAttention()
        self.layer_norm2 = nn.LayerNorm(CLIP_EMBED_DIM, eps=1e-5)
        self.mlp = CLIPMLP()

    def forward(self, x, causal_mask=None):
        # 预归一化 (Pre-LN) 结构
        x = x + self.attn(self.layer_norm1(x), causal_mask=causal_mask)
        x = x + self.mlp(self.layer_norm2(x))
        return x


class CLIPTextEncoder(nn.Module):
    """
    CLIP 文本编码器：将文本 token 序列编码为语义向量。
    输出: (B, 77, 768)，作为 U-Net Cross-Attention 的 condition。
    """
    def __init__(self):
        super().__init__()
        self.token_embedding = nn.Embedding(CLIP_VOCAB_SIZE, CLIP_EMBED_DIM)
        self.position_embedding = nn.Parameter(torch.randn(CLIP_MAX_LENGTH, CLIP_EMBED_DIM))
        self.layers = nn.ModuleList([CLIPEncoderLayer() for _ in range(CLIP_NUM_LAYERS)])
        self.final_layer_norm = nn.LayerNorm(CLIP_EMBED_DIM, eps=1e-5)

    def forward(self, text_tokens):
        b, n = text_tokens.shape
        # Token embedding + 可学习位置编码
        x = self.token_embedding(text_tokens)
        x = x + self.position_embedding[None, :n, :]
        # 因果掩码：上三角为 False (被 mask 掉)
        causal_mask = torch.triu(torch.ones(n, n, device=x.device), diagonal=1).bool()
        causal_mask = causal_mask.logical_not()[None, None, :, :]
        for layer in self.layers:
            x = layer(x, causal_mask=causal_mask)
        x = self.final_layer_norm(x)
        return x


# ---------------------------------------------------------------------------
# U-Net 核心模块
# ---------------------------------------------------------------------------
class ResBlock(nn.Module):
    """
    残差块，是 U-Net 的基本单元。
    特点:
    - GroupNorm + SiLU + Conv 的 in_layers
    - Time Embedding 通过 emb_layers 注入 (scale/shift 或直接相加)
    - Skip connection 保持梯度流动
    """
    def __init__(self, in_ch, out_ch, time_emb_dim, dropout=DROPOUT):
        super().__init__()
        self.in_layers = nn.Sequential(
            GroupNorm32(in_ch),
            nn.SiLU(),
            nn.Conv2d(in_ch, out_ch, 3, padding=1),
        )
        # 时间嵌入映射到通道数，用于条件化
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
        # 时间嵌入广播到空间维度
        emb_out = self.emb_layers(emb)[:, :, None, None]
        h = h + emb_out
        h = self.out_layers(h)
        return self.skip(x) + h


class CrossAttention(nn.Module):
    """
    交叉注意力层：将文本条件注入图像特征。
    Query 来自图像特征，Key/Value 来自文本编码。
    这是 Stable Diffusion 实现文生图的核心机制。
    """
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
        # 投影到 Q, K, V
        q = self.to_q(x).view(b, n, h, self.head_dim).transpose(1, 2)
        k = self.to_k(context).view(b, context.shape[1], h, self.head_dim).transpose(1, 2)
        v = self.to_v(context).view(b, context.shape[1], h, self.head_dim).transpose(1, 2)
        # 缩放点积注意力
        attn = torch.matmul(q, k.transpose(-2, -1)) * self.scale
        attn = F.softmax(attn, dim=-1)
        out = torch.matmul(attn, v)
        out = out.transpose(1, 2).contiguous().view(b, n, -1)
        return self.to_out(out)


class SpatialTransformer(nn.Module):
    """
    空间 Transformer：在图像特征上应用 Self-Attention 和 Cross-Attention。
    流程:
    1. GroupNorm + 1x1 Conv 投影到序列
    2. Self-Attention (图像特征内部交互)
    3. Cross-Attention (图像特征与文本条件交互)
    4. FeedForward
    5. 投影回图像空间 + Residual
    """
    def __init__(self, in_channels, num_heads, context_dim):
        super().__init__()
        inner_dim = in_channels
        self.norm = GroupNorm32(in_channels)
        self.proj_in = nn.Conv2d(in_channels, inner_dim, 1)
        self.attn1 = CrossAttention(inner_dim, inner_dim, num_heads)  # Self-attention
        self.attn2 = CrossAttention(inner_dim, context_dim, num_heads)  # Cross-attention
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
        # 将图像特征 (B, C, H, W) 转换为序列 (B, H*W, C)
        x = x.view(b, c, h * w).transpose(1, 2)
        # Self-attention: 图像特征内部交互
        x = self.attn1(self.norm1(x), x) + x
        # Cross-attention: 图像特征与文本条件交互 (核心！)
        x = self.attn2(self.norm2(x), context) + x
        # FeedForward
        x = self.ff(self.norm3(x)) + x
        # 转换回图像特征
        x = x.transpose(1, 2).view(b, c, h, w)
        x = self.proj_out(x)
        return x + x_in


class Downsample(nn.Module):
    """下采样层：使用 stride=2 的卷积，空间分辨率减半。"""
    def __init__(self, channels):
        super().__init__()
        self.op = nn.Conv2d(channels, channels, 3, stride=2, padding=1)

    def forward(self, x):
        return self.op(x)


class Upsample(nn.Module):
    """上采样层：先插值放大，再用卷积平滑。"""
    def __init__(self, channels):
        super().__init__()
        self.op = nn.Conv2d(channels, channels, 3, padding=1)

    def forward(self, x):
        x = F.interpolate(x, scale_factor=2, mode="nearest")
        return self.op(x)


# ---------------------------------------------------------------------------
# U-Net 去噪网络 (核心)
# ---------------------------------------------------------------------------
class UNet(nn.Module):
    """
    U-Net 是 Stable Diffusion 的去噪网络 (noise prediction network)。

    结构概览:
    - Input: 带噪潜在变量 (B, 4, 64, 64) + 时间步 t + 文本条件 context
    - Time Embedding: 正弦编码 -> MLP，注入每个 ResBlock
    - Down blocks (编码器): 逐层下采样，提取多尺度特征
    - Middle block (瓶颈): 最低分辨率处的 ResBlock + Attention
    - Up blocks (解码器): 逐层上采样，通过 skip connection 融合编码器特征
    - Output: 预测的噪声 (B, 4, 64, 64)

    Skip connection 是 U-Net 的关键：让解码器能访问高分辨率细节，
    帮助精确恢复图像结构。
    """
    def __init__(self):
        super().__init__()
        time_embed_dim = MODEL_CHANNELS * 4
        # 时间嵌入 MLP: 320 -> 1280 -> 1280
        self.time_embed = nn.Sequential(
            nn.Linear(MODEL_CHANNELS, time_embed_dim),
            nn.SiLU(),
            nn.Linear(time_embed_dim, time_embed_dim),
        )
        # 输入卷积: 4 -> 320
        self.input_blocks = nn.ModuleList([
            nn.Conv2d(LATENT_CHANNELS, MODEL_CHANNELS, 3, padding=1)
        ])
        ch = MODEL_CHANNELS
        input_block_chans = [ch]
        ds = 1  # 当前下采样倍数

        # --- Down blocks ---
        for level, mult in enumerate(CHANNEL_MULT):
            for _ in range(NUM_RES_BLOCKS):
                out_ch = MODEL_CHANNELS * mult
                layers = [ResBlock(ch, out_ch, time_embed_dim)]
                ch = out_ch
                # 在指定分辨率加入 SpatialTransformer (含 Cross-Attention)
                if ds in ATTENTION_RESOLUTIONS:
                    layers.append(SpatialTransformer(ch, NUM_HEADS, CONTEXT_DIM))
                self.input_blocks.append(nn.Sequential(*layers))
                input_block_chans.append(ch)
            # 层间下采样 (最后一层除外)
            if level != len(CHANNEL_MULT) - 1:
                self.input_blocks.append(Downsample(ch))
                input_block_chans.append(ch)
                ds *= 2

        # --- Middle block ---
        self.middle_block = nn.Sequential(
            ResBlock(ch, ch, time_embed_dim),
            SpatialTransformer(ch, NUM_HEADS, CONTEXT_DIM),
            ResBlock(ch, ch, time_embed_dim),
        )

        # --- Up blocks ---
        self.output_blocks = nn.ModuleList()
        for level, mult in list(enumerate(CHANNEL_MULT))[::-1]:
            for i in range(NUM_RES_BLOCKS + 1):
                ich = input_block_chans.pop()  # Skip connection 的通道数
                out_ch = MODEL_CHANNELS * mult
                layers = [ResBlock(ch + ich, out_ch, time_embed_dim)]
                ch = out_ch
                if ds in ATTENTION_RESOLUTIONS:
                    layers.append(SpatialTransformer(ch, NUM_HEADS, CONTEXT_DIM))
                # 上采样 (除了最高分辨率层)
                if level != 0 and i == NUM_RES_BLOCKS:
                    layers.append(Upsample(ch))
                    ds //= 2
                self.output_blocks.append(nn.Sequential(*layers))

        # 输出卷积
        self.out = nn.Sequential(
            GroupNorm32(ch),
            nn.SiLU(),
            nn.Conv2d(ch, LATENT_CHANNELS, 3, padding=1),
        )

    def forward(self, x, timesteps, context):
        """
        x: (B, 4, H, W) 带噪潜在变量
        timesteps: (B,) 时间步
        context: (B, 77, 768) 文本编码
        """
        # 时间步嵌入
        emb = timestep_embedding(timesteps, MODEL_CHANNELS)
        emb = self.time_embed(emb)

        hs = []  # 存储 skip connection 特征
        h = x

        # Down path
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

        # Middle
        for layer in self.middle_block:
            if isinstance(layer, ResBlock):
                h = layer(h, emb)
            elif isinstance(layer, SpatialTransformer):
                h = layer(h, context)
            else:
                h = layer(h)

        # Up path
        for module in self.output_blocks:
            h = torch.cat([h, hs.pop()], dim=1)  # Skip connection
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
# 完整 Latent Diffusion Model
# ---------------------------------------------------------------------------
class LatentDiffusion(nn.Module):
    """
    完整的潜在扩散模型，包含三个核心组件:
    1. VAE: 图像 <-> 潜在空间 的编解码器
    2. CLIP Text Encoder: 文本 -> 语义向量
    3. U-Net: 在潜在空间中进行去噪

    推理流程 (文生图):
    1. 文本 prompt 经 CLIP 编码为 context
    2. 从标准高斯采样随机噪声 z_T (潜在空间)
    3. 对 t = T...1，U-Net 预测噪声，逐步去噪得到 z_0
    4. VAE 解码器将 z_0 还原为图像
    """
    def __init__(self):
        super().__init__()
        self.unet = UNet()
        self.vae = VAE()
        self.text_encoder = CLIPTextEncoder()

    def forward(self, x, text_tokens, timesteps):
        """
        x: (B, 4, 64, 64) 潜在空间噪声
        text_tokens: (B, 77) 文本 token ID
        timesteps: (B,) 扩散时间步
        返回: (B, 4, 64, 64) 预测的噪声
        """
        context = self.text_encoder(text_tokens)
        t = timesteps
        h = self.unet(x, t, context)
        return h


# ---------------------------------------------------------------------------
# 教育演示
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = LatentDiffusion().to(device)

    batch_size = 1
    latent_h, latent_w = IMAGE_SIZE // 8, IMAGE_SIZE // 8  # 64x64
    x = torch.randn(batch_size, LATENT_CHANNELS, latent_h, latent_w).to(device)
    text_tokens = torch.randint(0, CLIP_VOCAB_SIZE, (batch_size, CLIP_MAX_LENGTH)).to(device)
    timesteps = torch.randint(0, 1000, (batch_size,)).to(device)

    with torch.no_grad():
        out = model(x, text_tokens, timesteps)

    print("=" * 60)
    print("Stable Diffusion (Latent Diffusion Model) 前向传播测试")
    print("=" * 60)
    print(f"输入潜在变量 shape:  {x.shape}")
    print(f"文本 tokens shape:   {text_tokens.shape}")
    print(f"时间步 shape:        {timesteps.shape}")
    print(f"预测噪声 shape:      {out.shape}")
    print("-" * 60)

    total_params = sum(p.numel() for p in model.parameters())
    unet_params = sum(p.numel() for p in model.unet.parameters())
    vae_params = sum(p.numel() for p in model.vae.parameters())
    clip_params = sum(p.numel() for p in model.text_encoder.parameters())

    print(f"U-Net 参数量:        {unet_params:,}")
    print(f"VAE 参数量:          {vae_params:,}")
    print(f"CLIP 参数量:         {clip_params:,}")
    print(f"总参数量:            {total_params:,}")
    print("=" * 60)

    # 练习建议
    print("\n【练习建议】")
    print("1. 尝试修改 IMAGE_SIZE 观察潜在空间分辨率变化")
    print("2. 修改 NUM_RES_BLOCKS 或 CHANNEL_MULT 观察参数量变化")
    print("3. 在 SpatialTransformer 中打印 attention map 的形状")
    print("4. 尝试实现 DDPM/DDIM 采样循环，完成完整文生图流程")
