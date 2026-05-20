"""
Training data-efficient image transformers & distillation through attention
Hugo Touvron, Matthieu Cord, Matthijs Douze, Francisco Massa, Alexandre Sablayrolles, Herve Jegou
2021

初学者友好的 DeiT (Data-efficient Image Transformer) 教程实现。

DeiT 的核心思想：
- 在 ViT 的基础上，引入一个额外的 Distillation Token，让模型通过注意力机制从教师网络学习。
- 无需海量预训练数据，仅在 ImageNet 上训练即可达到有竞争力的性能。
- Distillation Token 与 [CLS] token 地位对等，都通过自注意力与 patch tokens 交互。

关键概念：
- Distillation Token: 论文的核心创新。一个可学习的 token，其目标是复现教师网络的预测。
- Hard-label Distillation: 使用教师网络的硬标签（argmax 结果）作为额外监督信号，与真实标签各占一半权重。
- 双头输出: [CLS] token 经过分类头，Distillation token 经过蒸馏头，推理时取两者平均。
"""

import torch
import torch.nn as nn


# ==================== 配置常量 ====================
IMG_SIZE = 224          # 输入图像尺寸 (高和宽)
PATCH_SIZE = 16         # 每个 patch 的大小，16 表示 16x16 像素
NUM_CLASSES = 1000      # ImageNet 分类类别数
D = 768                 # 隐藏层维度，即每个 token 的向量长度
NUM_HEADS = 12          # 多头注意力中的头数，每个头处理 D/12 = 64 维
MLP_DIM = 3072          # MLP 中间层维度，通常是 D 的 4 倍
NUM_LAYERS = 12         # Transformer Encoder 的层数
DROPOUT = 0.1           # Dropout 比率，用于防止过拟合

NUM_PATCHES = (IMG_SIZE // PATCH_SIZE) ** 2   # 14x14 = 196 个 patch
NUM_PREFIX_TOKENS = 2                         # 2 个特殊 token: [CLS] + [DIST]
NUM_TOKENS = NUM_PATCHES + NUM_PREFIX_TOKENS  # 196 patches + 2 个特殊 token = 198


class MultiHeadAttention(nn.Module):
    """
    多头自注意力模块 (Multi-Head Self-Attention)

    作用：让序列中的每个 token 都能 "看到" 其他所有 token，并根据相关性加权聚合信息。
    为什么需要多头：将注意力分成多个子空间，让模型同时关注不同方面的信息。
    """
    def __init__(self, d, num_heads, dropout):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = d // num_heads      # 每个头的维度：768 / 12 = 64
        self.scale = self.head_dim ** -0.5   # 缩放因子 1/sqrt(d_k)，防止点积过大导致 softmax 梯度消失

        # 用一个线性层同时生成 Q, K, V，输出维度是 3D
        self.qkv = nn.Linear(d, d * 3)
        # 注意力输出投影层，将多头结果拼接后映射回 d 维
        self.proj = nn.Linear(d, d)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        B, N, D = x.shape  # B: batch size, N: token 数量 (198), D: 维度 (768)

        # 生成 QKV 并重塑为多头格式
        # qkv shape: (B, N, 3, num_heads, head_dim) -> permute -> (3, B, num_heads, N, head_dim)
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim).permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]   # 每个 shape: (B, num_heads, N, head_dim)

        # 计算注意力分数: (Q @ K^T) / sqrt(d_k)
        # attn shape: (B, num_heads, N, N)
        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)         # 对每一行做 softmax，得到注意力权重
        attn = self.dropout(attn)

        # 用注意力权重对 V 进行加权求和
        x = (attn @ v).transpose(1, 2).reshape(B, N, D)   # (B, N, D)
        x = self.proj(x)                    # 投影回原始维度
        x = self.dropout(x)
        return x


class MLP(nn.Module):
    """
    前馈神经网络 (Feed-Forward Network / MLP)

    作用：对每个 token 独立地进行非线性变换，增加模型表达能力。
    结构：Linear -> GELU -> Dropout -> Linear -> Dropout
    论文使用 GELU 而非 ReLU，因为 GELU 更平滑，在 Transformer 中表现更好。
    """
    def __init__(self, d, mlp_dim, dropout):
        super().__init__()
        self.fc1 = nn.Linear(d, mlp_dim)     # 扩展维度: 768 -> 3072
        self.act = nn.GELU()                 # GELU 激活函数
        self.dropout1 = nn.Dropout(dropout)
        self.fc2 = nn.Linear(mlp_dim, d)     # 压缩回原始维度: 3072 -> 768
        self.dropout2 = nn.Dropout(dropout)

    def forward(self, x):
        x = self.fc1(x)
        x = self.act(x)
        x = self.dropout1(x)
        x = self.fc2(x)
        x = self.dropout2(x)
        return x


class TransformerEncoderBlock(nn.Module):
    """
    Transformer Encoder 块

    采用 Pre-Norm 结构（论文使用的结构）：
        x = x + Sublayer(LayerNorm(x))
    这与原始的 Post-Norm (LayerNorm 在残差之后) 不同，Pre-Norm 更利于深层网络训练。

    每个块包含：
    1. LayerNorm + Multi-Head Attention + 残差连接
    2. LayerNorm + MLP + 残差连接
    """
    def __init__(self, d, num_heads, mlp_dim, dropout):
        super().__init__()
        self.norm1 = nn.LayerNorm(d)         # 第一个 LayerNorm，在 Attention 之前
        self.attn = MultiHeadAttention(d, num_heads, dropout)
        self.norm2 = nn.LayerNorm(d)         # 第二个 LayerNorm，在 MLP 之前
        self.mlp = MLP(d, mlp_dim, dropout)

    def forward(self, x):
        # Pre-Norm: 先归一化，再通过子层，最后残差连接
        x = x + self.attn(self.norm1(x))     # Attention 分支
        x = x + self.mlp(self.norm2(x))      # MLP 分支
        return x


class DeiT(nn.Module):
    """
    Data-efficient Image Transformer (DeiT-Base/16)

    整体流程：
    1. Patch Embedding: 用卷积将图像切分为 16x16 的 patch，每个 patch 映射为 768 维向量
    2. 添加 [CLS] token: 一个可学习的特殊 token，用于聚合全局信息进行分类
    3. 添加 [DIST] token: 论文核心创新，用于蒸馏学习，复现教师网络的预测
    4. 添加 Position Embedding: 为每个 token 添加位置信息（共 198 个 token）
    5. Transformer Encoder x12: 通过 12 层 Encoder 提取特征
       - [CLS] 和 [DIST] token 都与所有 patch tokens 通过自注意力交互
    6. LayerNorm: 最终归一化
    7. 双头输出:
       - 分类头 (head): 取 [CLS] token 输出 -> 1000 类
       - 蒸馏头 (head_dist): 取 [DIST] token 输出 -> 1000 类
       - 推理时取两者平均

    注意：DeiT-Base 的架构与 ViT-Base 几乎完全相同，
          唯一区别是增加了 Distillation Token 和对应的蒸馏头。
    """
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

        # Patch Embedding: Conv2d(3, 768, 16, 16)
        # 输入 (B, 3, 224, 224) -> 输出 (B, 768, 14, 14)
        # 相当于将图像划分为 14x14=196 个 patch，每个 patch 编码为 768 维
        self.patch_embed = nn.Conv2d(3, d, kernel_size=patch_size, stride=patch_size)

        # [CLS] token: 可学习的参数，shape (1, 1, 768)
        # 在每次 forward 时复制扩展到 batch size
        self.cls_token = nn.Parameter(torch.zeros(1, 1, d))

        # [DIST] token (蒸馏 token): 论文核心创新
        # 与 [CLS] token 地位对等，同样 shape (1, 1, 768)
        # 它通过自注意力与所有 patch tokens 交互，学习复现教师网络的预测
        self.dist_token = nn.Parameter(torch.zeros(1, 1, d))

        # Position Embedding: 可学习的参数，shape (1, 198, 768)
        # 为 198 个 token (196 patches + 1 CLS + 1 DIST) 各提供一个 768 维的位置向量
        self.pos_embed = nn.Parameter(torch.zeros(1, NUM_TOKENS, d))

        self.dropout = nn.Dropout(dropout)

        # Transformer Encoder: 12 个相同的 Encoder 块堆叠
        self.encoder = nn.Sequential(
            *[TransformerEncoderBlock(d, num_heads, mlp_dim, dropout) for _ in range(num_layers)]
        )

        # 最终 LayerNorm
        self.norm = nn.LayerNorm(d)

        # 分类头: 将 [CLS] token 的 768 维特征映射到 1000 个类别
        self.head = nn.Linear(d, num_classes)

        # 蒸馏头: 将 [DIST] token 的 768 维特征映射到 1000 个类别
        # 训练时监督信号来自教师网络；推理时与分类头结果取平均
        self.head_dist = nn.Linear(d, num_classes)

    def forward(self, x):
        B = x.shape[0]

        # Step 1: Patch Embedding
        # x: (B, 3, 224, 224) -> (B, 768, 14, 14)
        x = self.patch_embed(x)
        # flatten: (B, 768, 14, 14) -> (B, 768, 196) -> transpose -> (B, 196, 768)
        x = x.flatten(2).transpose(1, 2)

        # Step 2: 添加 [CLS] token 和 [DIST] token
        # cls: (B, 1, 768)，dist: (B, 1, 768)
        # 与 x (B, 196, 768) 拼接 -> (B, 198, 768)
        cls = self.cls_token.expand(B, -1, -1)
        dist = self.dist_token.expand(B, -1, -1)
        x = torch.cat([cls, dist, x], dim=1)

        # Step 3: 添加 Position Embedding 并 Dropout
        # pos_embed: (1, 198, 768)，广播到 (B, 198, 768)
        x = x + self.pos_embed
        x = self.dropout(x)

        # Step 4: Transformer Encoder
        # x: (B, 198, 768) -> (B, 198, 768)
        # [CLS] 和 [DIST] token 在每一层都通过自注意力与所有 patch tokens 交互
        x = self.encoder(x)

        # Step 5: 最终 LayerNorm
        x = self.norm(x)

        # Step 6: 双头输出
        # 取第一个 token ([CLS]) 的输出: (B, 198, 768) -> (B, 768)
        x_cls = x[:, 0]
        # 取第二个 token ([DIST]) 的输出: (B, 198, 768) -> (B, 768)
        x_dist = x[:, 1]

        # 分类头输出: (B, 768) -> (B, 1000)
        out_cls = self.head(x_cls)
        # 蒸馏头输出: (B, 768) -> (B, 1000)
        out_dist = self.head_dist(x_dist)

        # 推理时取两个头的平均（论文中的默认行为）
        return (out_cls + out_dist) / 2


if __name__ == "__main__":
    model = DeiT()
    x = torch.randn(2, 3, IMG_SIZE, IMG_SIZE)
    y = model(x)

    print(f"输入形状:  {x.shape}")      # (2, 3, 224, 224)
    print(f"输出形状: {y.shape}")       # (2, 1000)

    total = sum(p.numel() for p in model.parameters())
    print(f"总参数量: {total / 1e6:.1f}M")   # 约 87M (比 ViT-Base 略多，因为多了 dist token 和蒸馏头)

    # ==================== 练习题 ====================
    # 1. 思考：为什么 Distillation Token 比传统的 logit 蒸馏更有效？
    #    提示：注意 dist token 通过自注意力与 patch tokens 交互，而 logit 蒸馏只在输出层。
    # 2. 尝试将 num_prefix_tokens 改为 3，增加一个额外的可学习 token，观察输出形状。
    # 3. 比较 DeiT 和 ViT 的参数量差异，计算 dist_token、pos_embed 和 head_dist 各自贡献了多少参数。
    # 4. 思考：在推理时，如果只使用 head (丢弃 head_dist)，准确率会如何变化？为什么论文建议取平均？
