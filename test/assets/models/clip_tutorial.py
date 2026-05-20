"""
Learning Transferable Visual Models From Natural Language Supervision
Alec Radford et al., ICML 2021
arXiv: https://arxiv.org/abs/2103.00020

CLIP (Contrastive Language-Image Pre-training) 初学者教程版实现

关键概念:
- 对比学习 (Contrastive Learning): 让匹配的图文对在向量空间中距离近，不匹配的远离
- 双塔架构 (Dual-Tower): 图像和文本分别通过独立的编码器提取特征
- 零样本迁移 (Zero-shot Transfer): 预训练后无需微调即可用于下游任务
- ViT (Vision Transformer): 将图像切分为patch序列，用Transformer处理视觉信息
"""

import math
import torch
from torch import nn


# ==================== 配置常量 ====================
# 联合嵌入空间维度，图像和文本最终都映射到这个维度
EMBED_DIM = 512

# --- 图像编码器配置 (ViT-B/32) ---
IMAGE_RESOLUTION = 224      # 输入图像分辨率 224x224
VISION_LAYERS = 12          # Transformer Encoder 层数
VISION_WIDTH = 768          # 隐藏层维度 (d_model)
VISION_PATCH_SIZE = 32      # 每个patch的大小 32x32
VISION_HEADS = 12           # 多头注意力头数 = 768 // 64 = 12

# --- 文本编码器配置 (Transformer) ---
CONTEXT_LENGTH = 77         # 最大序列长度，包括 <|startoftext|> 和 <|endoftext|>
VOCAB_SIZE = 49408          # BPE词表大小，包含特殊token
TRANSFORMER_WIDTH = 512     # 文本Transformer的隐藏层维度
TRANSFORMER_HEADS = 8       # 多头注意力头数 = 512 // 64 = 8
TRANSFORMER_LAYERS = 12     # Transformer Encoder 层数


# ==================== 基础组件 ====================

class LayerNorm(nn.LayerNorm):
    """
    自定义 LayerNorm，支持 fp16 混合精度训练。

    原始torch的LayerNorm在fp16下可能数值不稳定，
    因此先转为fp32计算，再转回原始类型。
    """
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        orig_type = x.dtype
        ret = super().forward(x.type(torch.float32))
        return ret.type(orig_type)


class QuickGELU(nn.Module):
    """
    快速 GELU 激活函数近似。

    标准 GELU: x * Φ(x)，其中 Φ 是高斯CDF。
    QuickGELU 使用 sigmoid(1.702x) 近似，计算更快，CLIP论文中使用此版本。
    """
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x * torch.sigmoid(1.702 * x)


class ResidualAttentionBlock(nn.Module):
    """
    Transformer 编码器层：多头自注意力 + MLP，带残差连接和Pre-LN。

    结构 (Pre-LN):
        x = x + Attention(LN_1(x))
        x = x + MLP(LN_2(x))

    注意：CLIP使用Pre-LN（先归一化再计算），而非原始的Post-LN。
    """
    def __init__(self, d_model: int, n_head: int, attn_mask: torch.Tensor = None):
        super().__init__()
        # 多头自注意力：d_model 被分成 n_head 个头，每个头维度 = d_model // n_head
        self.attn = nn.MultiheadAttention(d_model, n_head)
        self.ln_1 = LayerNorm(d_model)  # 注意力前的LayerNorm

        # MLP: 先升维4倍，再降回原维度，提供非线性表达能力
        self.mlp = nn.Sequential(
            nn.Linear(d_model, d_model * 4),  # 升维: 768->3072 (或 512->2048)
            QuickGELU(),                       # 激活函数
            nn.Linear(d_model * 4, d_model)    # 降维回到原维度
        )
        self.ln_2 = LayerNorm(d_model)  # MLP前的LayerNorm

        self.attn_mask = attn_mask  # 因果掩码（仅文本编码器使用）

    def attention(self, x: torch.Tensor) -> torch.Tensor:
        # 将掩码移动到与输入相同的设备和数据类型
        self.attn_mask = self.attn_mask.to(dtype=x.dtype, device=x.device) if self.attn_mask is not None else None
        # self-attention: query=key=value=x
        return self.attn(x, x, x, need_weights=False, attn_mask=self.attn_mask)[0]

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Pre-LN + 残差连接
        x = x + self.attention(self.ln_1(x))  # 自注意力分支
        x = x + self.mlp(self.ln_2(x))         # MLP分支
        return x


class Transformer(nn.Module):
    """
    堆叠多个 ResidualAttentionBlock 形成 Transformer Encoder。

    输入输出形状: (seq_len, batch_size, d_model)
    注意：PyTorch的MultiheadAttention期望 (L, N, E) 格式
    """
    def __init__(self, width: int, layers: int, heads: int, attn_mask: torch.Tensor = None):
        super().__init__()
        self.width = width      # d_model
        self.layers = layers    # 层数
        # 堆叠 layers 个残差注意力块
        self.resblocks = nn.Sequential(*[
            ResidualAttentionBlock(width, heads, attn_mask) for _ in range(layers)
        ])

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.resblocks(x)


# ==================== 图像编码器 ====================

class VisionTransformer(nn.Module):
    """
    ViT-B/32 图像编码器：将图像切分为patch，用Transformer提取特征。

    处理流程:
    1. Patch Embedding: 224x224 -> 7x7=49 patches，每个patch 32x32
    2. 添加 [CLS] token 和位置编码
    3. 12层 Transformer Encoder
    4. 取 [CLS] token 输出，投影到联合嵌入空间

    输入: (batch_size, 3, 224, 224)
    输出: (batch_size, EMBED_DIM=512)
    """
    def __init__(
        self,
        input_resolution: int,   # 224
        patch_size: int,         # 32
        width: int,              # 768
        layers: int,             # 12
        heads: int,              # 12
        output_dim: int,         # 512
    ):
        super().__init__()
        self.input_resolution = input_resolution
        self.output_dim = output_dim

        # Patch Embedding: 用卷积实现，kernel_size=stride=patch_size
        # 输入 (B, 3, 224, 224) -> 输出 (B, 768, 7, 7)
        self.conv1 = nn.Conv2d(
            in_channels=3, out_channels=width, kernel_size=patch_size, stride=patch_size, bias=False
        )

        scale = width ** -0.5  # 初始化缩放因子

        # [CLS] token: 可学习的分类token，最终用它代表整图特征
        self.class_embedding = nn.Parameter(scale * torch.randn(width))

        # 位置编码: (num_patches + 1, width) = (49 + 1, 768) = (50, 768)
        # +1 是因为要包含 [CLS] token
        self.positional_embedding = nn.Parameter(
            scale * torch.randn((input_resolution // patch_size) ** 2 + 1, width)
        )

        self.ln_pre = LayerNorm(width)  # Transformer前的LayerNorm

        # 12层 Transformer Encoder
        self.transformer = Transformer(width, layers, heads)

        self.ln_post = LayerNorm(width)  # Transformer后的LayerNorm

        # 投影矩阵: 将768维图像特征映射到512维联合嵌入空间
        self.proj = nn.Parameter(scale * torch.randn(width, output_dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, 3, 224, 224)
        x = self.conv1(x)  # -> (B, 768, 7, 7)

        # 将空间维度展平: (B, 768, 7, 7) -> (B, 768, 49) -> (B, 49, 768)
        x = x.reshape(x.shape[0], x.shape[1], -1)
        x = x.permute(0, 2, 1)  # -> (B, 49, 768)

        # 添加 [CLS] token: (B, 1, 768)
        cls_embed = self.class_embedding.to(x.dtype)
        cls_embed = cls_embed + torch.zeros(x.shape[0], 1, x.shape[-1], dtype=x.dtype, device=x.device)
        x = torch.cat([cls_embed, x], dim=1)  # -> (B, 50, 768)

        # 添加位置编码: 让模型知道每个patch的空间位置
        x = x + self.positional_embedding.to(x.dtype)  # -> (B, 50, 768)
        x = self.ln_pre(x)

        # 调整维度顺序以适配 PyTorch MultiheadAttention: (L, N, E)
        x = x.permute(1, 0, 2)  # -> (50, B, 768)
        x = self.transformer(x)  # -> (50, B, 768)
        x = x.permute(1, 0, 2)  # -> (B, 50, 768)

        # 取 [CLS] token 的输出作为整图表示 (索引0)
        x = self.ln_post(x[:, 0, :])  # -> (B, 768)

        # 投影到联合嵌入空间
        if self.proj is not None:
            x = x @ self.proj  # -> (B, 512)

        return x


# ==================== 完整 CLIP 模型 ====================

class CLIP(nn.Module):
    """
    CLIP 双塔模型：同时编码图像和文本到同一向量空间。

    架构概览:
    - 图像塔: ViT-B/32 (约86M参数)
      输入 (B, 3, 224, 224) -> 输出 (B, 512)
    - 文本塔: Transformer Encoder x12 (约63M参数)
      输入 (B, 77) token IDs -> 输出 (B, 512)

    联合嵌入空间: 图像和文本都映射到512维，通过余弦相似度衡量匹配程度。
    """
    def __init__(
        self,
        embed_dim: int,           # 联合嵌入维度 512
        image_resolution: int,    # 224
        vision_layers: int,       # 12
        vision_width: int,        # 768
        vision_patch_size: int,   # 32
        context_length: int,      # 77
        vocab_size: int,          # 49408
        transformer_width: int,   # 512
        transformer_heads: int,   # 8
        transformer_layers: int,  # 12
    ):
        super().__init__()
        self.context_length = context_length

        # --- 图像编码器 ---
        # vision_heads = width // 64 = 768 // 64 = 12
        vision_heads = vision_width // 64
        self.visual = VisionTransformer(
            input_resolution=image_resolution,
            patch_size=vision_patch_size,
            width=vision_width,
            layers=vision_layers,
            heads=vision_heads,
            output_dim=embed_dim,
        )

        # --- 文本编码器 ---
        # 文本Transformer使用因果掩码（causal mask），确保每个token只能看到前面的token
        self.transformer = Transformer(
            width=transformer_width,
            layers=transformer_layers,
            heads=transformer_heads,
            attn_mask=self.build_attention_mask(),
        )

        # Token Embedding: 将token ID映射为向量 (49408, 512)
        self.vocab_size = vocab_size
        self.token_embedding = nn.Embedding(vocab_size, transformer_width)

        # 可学习的位置编码: (77, 512)
        self.positional_embedding = nn.Parameter(torch.empty(self.context_length, transformer_width))

        self.ln_final = LayerNorm(transformer_width)  # 最终LayerNorm

        # 文本投影矩阵: (512, 512)，将文本特征映射到联合嵌入空间
        self.text_projection = nn.Parameter(torch.empty(transformer_width, embed_dim))

        # 可学习的温度参数，控制softmax的平滑程度，初始值对应温度=0.07
        self.logit_scale = nn.Parameter(torch.ones([]) * math.log(1 / 0.07))

        self.initialize_parameters()

    def initialize_parameters(self):
        """参数初始化策略"""
        # Token embedding: 正态分布 N(0, 0.02)
        nn.init.normal_(self.token_embedding.weight, std=0.02)
        # 位置编码: 正态分布 N(0, 0.01)
        nn.init.normal_(self.positional_embedding, std=0.01)

        # Transformer 各层初始化
        proj_std = (self.transformer.width ** -0.5) * ((2 * self.transformer.layers) ** -0.5)
        attn_std = self.transformer.width ** -0.5
        fc_std = (2 * self.transformer.width) ** -0.5
        for block in self.transformer.resblocks:
            nn.init.normal_(block.attn.in_proj_weight, std=attn_std)
            nn.init.normal_(block.attn.out_proj.weight, std=proj_std)
            nn.init.normal_(block.mlp[0].weight, std=fc_std)
            nn.init.normal_(block.mlp[2].weight, std=proj_std)

        # 文本投影矩阵初始化
        if self.text_projection is not None:
            nn.init.normal_(self.text_projection, std=self.transformer.width ** -0.5)

    def build_attention_mask(self):
        """
        构建因果注意力掩码 (causal attention mask)。

        上三角矩阵，上三角为 -inf，下三角和对角线为 0。
        在softmax后，-inf 变为 0，实现每个token只能attend到前面的token。
        """
        mask = torch.empty(self.context_length, self.context_length)
        mask.fill_(float("-inf"))
        mask.triu_(1)  # 上三角（不含对角线）设为 -inf
        return mask

    @property
    def dtype(self):
        """获取模型权重数据类型（支持fp16）"""
        return self.visual.conv1.weight.dtype

    def encode_image(self, image: torch.Tensor) -> torch.Tensor:
        """
        编码图像。

        Args:
            image: (batch_size, 3, 224, 224) 的图像张量
        Returns:
            (batch_size, 512) 的图像特征向量
        """
        return self.visual(image.type(self.dtype))

    def encode_text(self, text: torch.Tensor) -> torch.Tensor:
        """
        编码文本。

        Args:
            text: (batch_size, 77) 的token ID张量
        Returns:
            (batch_size, 512) 的文本特征向量
        """
        # Token Embedding: (B, 77) -> (B, 77, 512)
        x = self.token_embedding(text).type(self.dtype)

        # 加上位置编码
        x = x + self.positional_embedding.type(self.dtype)

        # 调整维度: (B, 77, 512) -> (77, B, 512)
        x = x.permute(1, 0, 2)
        x = self.transformer(x)  # -> (77, B, 512)
        x = x.permute(1, 0, 2)   # -> (B, 77, 512)

        x = self.ln_final(x).type(self.dtype)

        # 提取 <|endoftext|> token 的特征作为句子表示
        # text.argmax(dim=-1) 找到每个序列中最后一个非padding token的位置
        x = x[torch.arange(x.shape[0]), text.argmax(dim=-1)] @ self.text_projection

        return x

    def forward(self, image: torch.Tensor, text: torch.Tensor):
        """
        前向传播：计算图像-文本相似度。

        Args:
            image: (B, 3, 224, 224)
            text:  (B, 77)
        Returns:
            logits_per_image: (B, B) 图像到文本的相似度
            logits_per_text:  (B, B) 文本到图像的相似度
        """
        # 分别编码图像和文本
        image_features = self.encode_image(image)  # (B, 512)
        text_features = self.encode_text(text)      # (B, 512)

        # L2归一化：使特征位于单位球面上，点积=余弦相似度
        image_features = image_features / image_features.norm(dim=1, keepdim=True)
        text_features = text_features / text_features.norm(dim=1, keepdim=True)

        # 计算相似度矩阵，并用温度参数缩放
        logit_scale = self.logit_scale.exp()
        logits_per_image = logit_scale * image_features @ text_features.t()
        logits_per_text = logits_per_image.t()

        return logits_per_image, logits_per_text


# ==================== 主程序演示 ====================

if __name__ == "__main__":
    # 创建模型实例
    model = CLIP(
        embed_dim=EMBED_DIM,
        image_resolution=IMAGE_RESOLUTION,
        vision_layers=VISION_LAYERS,
        vision_width=VISION_WIDTH,
        vision_patch_size=VISION_PATCH_SIZE,
        context_length=CONTEXT_LENGTH,
        vocab_size=VOCAB_SIZE,
        transformer_width=TRANSFORMER_WIDTH,
        transformer_heads=TRANSFORMER_HEADS,
        transformer_layers=TRANSFORMER_LAYERS,
    )

    # 创建模拟输入
    batch_size = 2
    dummy_image = torch.randn(batch_size, 3, IMAGE_RESOLUTION, IMAGE_RESOLUTION)
    # 模拟token序列：最后一个token设为较大值模拟 <|endoftext|>
    dummy_text = torch.randint(0, VOCAB_SIZE, (batch_size, CONTEXT_LENGTH))
    dummy_text[:, -1] = VOCAB_SIZE - 1  # 假设最后一个token是结束符

    # 前向传播
    image_features = model.encode_image(dummy_image)
    text_features = model.encode_text(dummy_text)
    logits_per_image, logits_per_text = model(dummy_image, dummy_text)

    # 打印形状信息
    print("=" * 50)
    print("CLIP ViT-B/32 模型前向传播演示")
    print("=" * 50)
    print(f"输入图像形状:       {dummy_image.shape}")
    print(f"输入文本形状:       {dummy_text.shape}")
    print(f"图像特征形状:       {image_features.shape}")
    print(f"文本特征形状:       {text_features.shape}")
    print(f"图像->文本 logits:  {logits_per_image.shape}")
    print(f"文本->图像 logits:  {logits_per_text.shape}")

    # 统计参数量
    total_params = sum(p.numel() for p in model.parameters())
    print(f"总参数量:           {total_params:,}")

    # 各组件参数量
    visual_params = sum(p.numel() for p in model.visual.parameters())
    text_params = sum(p.numel() for p in model.token_embedding.parameters())
    text_params += sum(p.numel() for p in model.positional_embedding)
    text_params += sum(p.numel() for p in model.transformer.parameters())
    text_params += sum(p.numel() for p in model.ln_final.parameters())
    text_params += sum(p.numel() for p in model.text_projection)
    print(f"图像编码器参数:     {visual_params:,}")
    print(f"文本编码器参数:     {text_params:,}")
    print("=" * 50)

    """
    练习建议:
    1. 尝试修改 EMBED_DIM，观察输出维度变化
    2. 将 VISION_PATCH_SIZE 改为16，看看patch数量和参数量如何变化
    3. 打印 build_attention_mask() 的矩阵，理解因果掩码的形状
    4. 对比 encode_image 和 encode_text 的输出，理解双塔架构
    """
