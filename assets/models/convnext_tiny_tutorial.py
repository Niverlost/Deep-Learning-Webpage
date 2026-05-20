"""
A ConvNet for the 2020s
Zhuang Liu, Hanzi Mao, Chao-Yuan Wu, Christoph Feichtenhofer, Trevor Darrell, Saining Xie
CVPR 2022
arXiv: https://arxiv.org/abs/2201.03545

ConvNeXt-Tiny 初学者教程版

本模型是一个纯卷积神经网络（CNN），通过借鉴 Transformer 的设计思想（如大核卷积、LayerNorm、GELU 激活等），
在 ImageNet 分类任务上取得了与 Vision Transformer 相媲美的性能。

关键概念：
- Depthwise Convolution（深度可分离卷积）: 大幅减少参数量，同时保持大感受野
- LayerNorm（层归一化）: 替代 BatchNorm，更稳定，尤其在大 batch size 时
- GELU 激活函数: Transformer 中常用的平滑激活函数
- 残差连接（Residual Connection）: 帮助梯度流动，训练更深的网络
"""

import torch
import torch.nn as nn


# ==================== 配置常量 ====================
IN_CHANNELS = 3          # 输入图像通道数：RGB 图像为 3
NUM_CLASSES = 1000       # ImageNet 分类类别数
STEM_CHANNELS = 96       # Stem 层输出通道数，对应 Patch Embedding 的维度
STAGE_CHANNELS = [96, 192, 384, 768]   # 四个 Stage 的通道数，逐层翻倍
STAGE_DEPTHS = [3, 3, 9, 3]            # 每个 Stage 中 ConvNeXt Block 的重复次数
KERNEL_SIZE = 7          # 深度可分离卷积的核大小，7x7 提供大感受野
EXPANSION_RATIO = 4      # MLP 中间层的通道扩展倍数（类似 Transformer 的 MLP ratio=4）


class ConvNeXtBlock(nn.Module):
    """
    ConvNeXt 基础模块，设计灵感来源于 Transformer Block。

    结构顺序：
    1. Depthwise Conv 7x7（大核卷积，提供全局感受野）
    2. LayerNorm（通道维度归一化）
    3. Pointwise Conv 1x1（升维，扩展 4 倍）
    4. GELU 激活函数
    5. Pointwise Conv 1x1（降维，投影回原维度）
    6. 残差连接（Residual Connection）

    注意：论文使用 LayerNorm 而非 BatchNorm，因为 LayerNorm 对 batch size 不敏感，
    且与现代 Transformer 的设计保持一致。
    """
    def __init__(self, dim):
        super().__init__()
        # 深度可分离卷积：groups=dim 表示每个通道独立卷积
        # 7x7 大核卷积提供与 Swin Transformer 窗口注意力相当的感受野
        self.dwconv = nn.Conv2d(
            dim, dim,
            kernel_size=KERNEL_SIZE,
            padding=KERNEL_SIZE // 2,   # 保持空间分辨率不变（same padding）
            groups=dim                   # Depthwise：每个通道单独卷积
        )

        # LayerNorm：对最后一个维度（通道维度）进行归一化
        # eps=1e-6 是论文使用的数值稳定性参数
        self.norm = nn.LayerNorm(dim, eps=1e-6)

        # 第一个 1x1 卷积（Pointwise Conv），使用 Linear 实现，等价于 1x1 Conv
        # 将通道数扩展 4 倍，增加模型表达能力
        self.pwconv1 = nn.Linear(dim, EXPANSION_RATIO * dim)

        # GELU 激活函数：高斯误差线性单元，Transformer 中的标准选择
        # 相比 ReLU 更平滑，有助于梯度传播
        self.act = nn.GELU()

        # 第二个 1x1 卷积，将通道数投影回原维度
        self.pwconv2 = nn.Linear(EXPANSION_RATIO * dim, dim)

    def forward(self, x):
        shortcut = x  # 保存输入用于残差连接

        # Step 1: Depthwise Conv
        # 输入形状: (B, C, H, W)
        x = self.dwconv(x)
        # 输出形状: (B, C, H, W) — 空间分辨率和通道数均不变

        # Step 2: LayerNorm
        # PyTorch 的 LayerNorm 默认对最后一个维度操作
        # 需要将通道维度移到最后: (B, C, H, W) -> (B, H, W, C)
        x = x.permute(0, 2, 3, 1)
        x = self.norm(x)
        # 输出形状: (B, H, W, C)

        # Step 3-4: Pointwise Conv 升维 + GELU 激活
        x = self.pwconv1(x)
        # 输出形状: (B, H, W, 4*C)
        x = self.act(x)

        # Step 5: Pointwise Conv 降维
        x = self.pwconv2(x)
        # 输出形状: (B, H, W, C)

        # 将通道维度移回标准位置: (B, H, W, C) -> (B, C, H, W)
        x = x.permute(0, 3, 1, 2)

        # Step 6: 残差连接
        # 将原始输入与变换后的特征相加，帮助梯度反向传播
        x = shortcut + x
        return x


class DownsampleLayer(nn.Module):
    """
    下采样层，用于 Stage 之间的过渡。

    结构：
    1. LayerNorm（在通道维度上归一化）
    2. 2x2 卷积，stride=2（将空间分辨率减半，同时调整通道数）

    注意：论文使用 2x2 卷积配合 stride=2 进行下采样，
    而非传统的 MaxPool 或 3x3 卷积 stride=2。
    """
    def __init__(self, in_dim, out_dim):
        super().__init__()
        self.norm = nn.LayerNorm(in_dim, eps=1e-6)
        # 2x2 卷积，stride=2：空间分辨率减半（H/2, W/2），通道数变为 out_dim
        self.conv = nn.Conv2d(in_dim, out_dim, kernel_size=2, stride=2)

    def forward(self, x):
        # 输入形状: (B, C, H, W)
        # 先进行 LayerNorm，需要将通道维度移到最后
        x = x.permute(0, 2, 3, 1)
        x = self.norm(x)
        # 恢复维度顺序以便进行卷积操作
        x = x.permute(0, 3, 1, 2)
        # 下采样卷积
        x = self.conv(x)
        # 输出形状: (B, out_dim, H/2, W/2)
        return x


class ConvNeXtTiny(nn.Module):
    """
    ConvNeXt-Tiny 完整模型。

    前向流程：
    1. Stem: 4x4 卷积，stride=4（将 224x224 下采样为 56x56，类似 Patch Embedding）
    2. Stage 1: Downsample + 3 个 ConvNeXt Block，96 通道
    3. Stage 2: Downsample + 3 个 ConvNeXt Block，192 通道
    4. Stage 3: Downsample + 9 个 ConvNeXt Block，384 通道
    5. Stage 4: Downsample + 3 个 ConvNeXt Block，768 通道
    6. Global Average Pooling + LayerNorm + 全连接层 -> 1000 类输出

    空间分辨率变化：
    224x224 (输入)
    -> 56x56 (Stem, stride=4)
    -> 28x28 (Stage 1->2, stride=2)
    -> 14x14 (Stage 2->3, stride=2)
    -> 7x7   (Stage 3->4, stride=2)
    """
    def __init__(self, in_channels=IN_CHANNELS, num_classes=NUM_CLASSES):
        super().__init__()
        # Stem 层：4x4 卷积，stride=4
        # 将输入图像从 224x224 下采样到 56x56，同时提取初始特征
        # 这类似于 Vision Transformer 中的 Patch Embedding
        self.stem = nn.Conv2d(in_channels, STEM_CHANNELS, kernel_size=4, stride=4)

        # 构建四个 Stage
        self.stages = nn.ModuleList()
        # dims[0] 是 Stem 输出通道，dims[1:] 是各 Stage 的通道数
        dims = [STEM_CHANNELS] + STAGE_CHANNELS
        for i in range(len(STAGE_CHANNELS)):
            # 每个 Stage 包含若干个 ConvNeXt Block
            stage = nn.Sequential(
                *[ConvNeXtBlock(dims[i + 1]) for _ in range(STAGE_DEPTHS[i])]
            )
            self.stages.append(stage)

        # 构建下采样层，连接相邻 Stage
        self.downsamples = nn.ModuleList()
        for i in range(len(STAGE_CHANNELS)):
            self.downsamples.append(
                DownsampleLayer(dims[i], dims[i + 1])
            )

        # 最后的 LayerNorm 和分类头
        self.norm = nn.LayerNorm(STAGE_CHANNELS[-1], eps=1e-6)
        self.head = nn.Linear(STAGE_CHANNELS[-1], num_classes)

    def forward(self, x):
        # 输入形状: (B, 3, 224, 224)
        x = self.stem(x)
        # Stem 输出: (B, 96, 56, 56)

        # 依次通过每个 Stage
        for i in range(len(self.stages)):
            x = self.downsamples[i](x)   # 下采样
            x = self.stages[i](x)         # ConvNeXt Blocks
        # Stage 4 输出: (B, 768, 7, 7)

        # 将通道维度移到最后，进行 LayerNorm
        x = x.permute(0, 2, 3, 1)
        x = self.norm(x)
        # 形状: (B, 7, 7, 768)

        # Global Average Pooling：对空间维度取平均
        # (B, 7, 7, 768) -> (B, 768)
        x = x.mean(dim=[1, 2])

        # 分类头：全连接层映射到类别数
        x = self.head(x)
        # 输出形状: (B, 1000)
        return x


if __name__ == "__main__":
    # 创建模型实例
    model = ConvNeXtTiny()

    # 创建模拟输入：2 张 224x224 的 RGB 图像
    x = torch.randn(2, 3, 224, 224)

    # 前向传播
    y = model(x)

    # 打印输入输出形状
    print(f"输入形状:  {x.shape}")
    print(f"输出形状: {y.shape}")

    # 计算并打印总参数量
    total_params = sum(p.numel() for p in model.parameters())
    print(f"总参数量: {total_params:,}")

    # ==================== 读者练习 ====================
    # 1. 尝试修改 STEM_CHANNELS 的值（如改为 64 或 128），观察参数量和输出形状的变化
    # 2. 尝试修改 STAGE_DEPTHS（如将 Stage 3 的 9 改为 6），观察参数量变化
    # 3. 尝试将 KERNEL_SIZE 从 7 改为 3 或 5，对比感受野和参数量的变化
    # 4. 尝试将 EXPANSION_RATIO 从 4 改为 2 或 8，观察模型容量的变化
    # 5. 思考：为什么论文使用 LayerNorm 而不是 BatchNorm？在什么场景下 LayerNorm 更有优势？
