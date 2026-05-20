"""
EfficientNet: Rethinking Model Scaling for Convolutional Neural Networks
Mingxing Tan, Quoc V. Le
2019

初学者友好的 EfficientNet-B0 实现。

EfficientNet 的核心思想是“复合缩放”(Compound Scaling)：
不像传统方法只增加网络的深度或宽度，EfficientNet 同时、均匀地缩放网络的
深度(depth)、宽度(width)和分辨率(resolution)，在精度和效率之间取得最佳平衡。

EfficientNet-B0 是该系列的基线模型，后续 B1-B7 都是在此基础上进行复合缩放得到的。
"""

import torch
import torch.nn as nn


# ==================== 配置常量 ====================
# 输入图像尺寸，B0 使用 224x224
IMAGE_SIZE = 224
# ImageNet 类别数
NUM_CLASSES = 1000

# Stem 层（初始卷积）配置
STEM_CHANNELS = 32   # 输出通道数
STEM_KERNEL = 3      # 卷积核大小 3x3
STEM_STRIDE = 2      # 步幅 2，将空间尺寸减半（224 -> 112）
STEM_PADDING = 1     # 填充 1，保持特征图边界信息

# MBConv 阶段配置：(kernel_size, expansion, out_channels, num_repeats, stride)
# 含义：
#   kernel_size: Depthwise 卷积核大小
#   expansion:   通道扩展倍数（1x1 扩展卷积会将通道数扩大多少倍）
#   out_channels: 该阶段输出通道数
#   num_repeats: 该阶段重复多少次 MBConv 块
#   stride:      第一个块的步幅（后续块步幅为 1）
STAGES = [
    (3, 1, 16, 1, 1),   # stage 1: 32 -> 16,  不缩小空间
    (3, 6, 24, 2, 2),   # stage 2: 16 -> 24,  空间减半 (112 -> 56)
    (5, 6, 40, 2, 2),   # stage 3: 24 -> 40,  空间减半 (56 -> 28)
    (3, 6, 80, 3, 2),   # stage 4: 40 -> 80,  空间减半 (28 -> 14)
    (5, 6, 112, 3, 1),  # stage 5: 80 -> 112, 空间不变 (14)
    (5, 6, 192, 4, 2),  # stage 6: 112 -> 192, 空间减半 (14 -> 7)
    (3, 6, 320, 1, 1),  # stage 7: 192 -> 320, 空间不变 (7)
]

# Head 层（最终 1x1 卷积）输出通道数
HEAD_CHANNELS = 1280

# SE 模块的通道缩减比例（将通道压缩为原来的 1/4）
SE_REDUCTION = 4


# ==================== 核心概念 ====================
# Key Concepts:
# 1. MBConv (Mobile Inverted Bottleneck Convolution):
#    源自 MobileNetV2，先通过 1x1 卷积扩展通道，再用 Depthwise 卷积提取空间特征，
#    最后通过 1x1 卷积投影回低维。这种“倒置瓶颈”结构比传统瓶颈更高效。
#
# 2. Depthwise Separable Convolution:
#    将标准卷积拆分为 Depthwise（逐通道卷积）+ Pointwise（1x1 卷积），
#    大幅减少参数量和计算量。
#
# 3. Squeeze-and-Excitation (SE):
#    对每个通道学习一个权重，让网络“关注”更重要的特征通道。
#    实现：全局平均池化 -> FC 压缩 -> 激活 -> FC 恢复 -> Sigmoid 加权
#
# 4. Swish 激活函数:
#    f(x) = x * sigmoid(x)，相比 ReLU 更平滑，在深层网络中表现更好。


class Swish(nn.Module):
    """
    Swish 激活函数: f(x) = x * sigmoid(x)

    为什么用 Swish 而不是 ReLU？
    - Swish 是平滑非单调函数，在负数区域也有微小梯度，缓解“神经元死亡”问题
    - Google Brain 的实验表明，Swish 在深层网络中通常优于 ReLU
    """
    def forward(self, x):
        return x * torch.sigmoid(x)


class SEBlock(nn.Module):
    """
    Squeeze-and-Excitation 模块（通道注意力机制）

    作用：让网络自动学习每个通道的重要性，给重要通道更高权重。

    流程：
    1. Squeeze: 全局平均池化，将 HxW 的特征图压缩为 1x1（每个通道一个数值）
    2. Excitation: 两个 1x1 卷积（相当于全连接层），先压缩通道再恢复，中间用 Swish 激活
    3. Scale: 用 Sigmoid 输出 0~1 的权重，与原特征图逐通道相乘
    """
    def __init__(self, channels, reduction):
        super().__init__()
        # Squeeze: 全局平均池化 -> 输出形状 (B, C, 1, 1)
        self.avg_pool = nn.AdaptiveAvgPool2d(1)

        # Excitation: 1x1 卷积实现 FC 效果
        # 先压缩到 C // reduction，再恢复到 C
        self.fc1 = nn.Conv2d(channels, channels // reduction, kernel_size=1)
        self.swish = Swish()
        self.fc2 = nn.Conv2d(channels // reduction, channels, kernel_size=1)

    def forward(self, x):
        # x: (B, C, H, W)
        out = self.avg_pool(x)        # -> (B, C, 1, 1)
        out = self.fc1(out)           # -> (B, C//r, 1, 1)
        out = self.swish(out)         # 非线性激活
        out = self.fc2(out)           # -> (B, C, 1, 1)
        out = torch.sigmoid(out)      # 权重归一化到 (0, 1)
        # 将权重广播到 (B, C, H, W) 并与原特征相乘
        return x * out


class MBConv(nn.Module):
    """
    Mobile Inverted Bottleneck Convolution Block

    这是 EfficientNet 的核心构建块，包含以下步骤：
    1. Expansion (1x1 Conv): 当 expansion > 1 时，先扩展通道数
    2. Depthwise Conv (kxk): 逐通道空间卷积，提取空间特征
    3. SE Module: 通道注意力，增强重要特征
    4. Projection (1x1 Conv): 将通道投影回低维（瓶颈层）
    5. Skip Connection: 当 stride=1 且输入输出通道相同时，添加残差连接

    注意：
    - 扩展卷积和 Depthwise 卷积后都有 BN + Swish
    - 投影卷积后只有 BN，没有激活（这是 MobileNetV2 的设计，防止信息损失）
    """
    def __init__(self, in_channels, out_channels, kernel_size, expansion, stride, se_reduction):
        super().__init__()
        # 判断是否可以使用残差连接：步幅为1且输入输出通道相同
        self.use_residual = (stride == 1 and in_channels == out_channels)

        # 扩展后的通道数
        hidden_dim = in_channels * expansion

        layers = []

        # Step 1: Expansion (1x1 点卷积)
        # 当 expansion == 1 时（如 stage 1），不需要扩展
        if expansion != 1:
            layers += [
                nn.Conv2d(in_channels, hidden_dim, kernel_size=1, bias=False),
                nn.BatchNorm2d(hidden_dim),
                Swish(),
            ]

        # Step 2: Depthwise Convolution (逐通道卷积)
        # groups=hidden_dim 表示每个通道独立卷积，这是 Depthwise 的核心
        # padding = (k-1)//2 保证空间尺寸在 stride=1 时不变
        layers += [
            nn.Conv2d(
                hidden_dim, hidden_dim,
                kernel_size=kernel_size,
                stride=stride,
                padding=(kernel_size - 1) // 2,
                groups=hidden_dim,   # Depthwise: 逐通道卷积
                bias=False
            ),
            nn.BatchNorm2d(hidden_dim),
            Swish(),
        ]

        # Step 3: SE 模块（通道注意力）
        layers += [SEBlock(hidden_dim, se_reduction)]

        # Step 4: Projection (1x1 点卷积，降维)
        # 注意：投影后不加激活函数，这是倒置瓶颈的关键设计
        layers += [
            nn.Conv2d(hidden_dim, out_channels, kernel_size=1, bias=False),
            nn.BatchNorm2d(out_channels),
        ]

        self.conv = nn.Sequential(*layers)

    def forward(self, x):
        out = self.conv(x)
        if self.use_residual:
            # 残差连接：帮助梯度流动，缓解梯度消失
            out = out + x
        return out


class EfficientNetB0(nn.Module):
    """
    EfficientNet-B0 完整模型

    网络流程（以 224x224 输入为例）：
    1. Stem:       3x3 Conv, stride=2  -> (B, 32, 112, 112)
    2. Stage 1:    MBConv1, 1层        -> (B, 16, 112, 112)
    3. Stage 2:    MBConv6, 2层        -> (B, 24, 56, 56)
    4. Stage 3:    MBConv6, 2层        -> (B, 40, 28, 28)
    5. Stage 4:    MBConv6, 3层        -> (B, 80, 14, 14)
    6. Stage 5:    MBConv6, 3层        -> (B, 112, 14, 14)
    7. Stage 6:    MBConv6, 4层        -> (B, 192, 7, 7)
    8. Stage 7:    MBConv6, 1层        -> (B, 320, 7, 7)
    9. Head:       1x1 Conv            -> (B, 1280, 7, 7)
    10. Pooling:   Global AvgPool      -> (B, 1280)
    11. Classifier: FC                 -> (B, 1000)
    """
    def __init__(self, num_classes=NUM_CLASSES):
        super().__init__()

        # Stem: 初始卷积层，快速降低空间分辨率同时提取低级特征
        self.stem = nn.Sequential(
            nn.Conv2d(3, STEM_CHANNELS, kernel_size=STEM_KERNEL,
                      stride=STEM_STRIDE, padding=STEM_PADDING, bias=False),
            nn.BatchNorm2d(STEM_CHANNELS),
            Swish(),
        )

        # MBConv 堆叠阶段
        layers = []
        in_channels = STEM_CHANNELS
        for stage_idx, (k, exp, c, n, s) in enumerate(STAGES):
            for i in range(n):
                # 每个阶段的第一个块使用指定 stride，后续块 stride=1
                stride = s if i == 0 else 1
                layers.append(MBConv(in_channels, c, k, exp, stride, SE_REDUCTION))
                in_channels = c  # 更新下一层的输入通道

        self.blocks = nn.Sequential(*layers)

        # Head: 最终 1x1 卷积，将通道映射到 1280
        self.head = nn.Sequential(
            nn.Conv2d(in_channels, HEAD_CHANNELS, kernel_size=1, bias=False),
            nn.BatchNorm2d(HEAD_CHANNELS),
            Swish(),
        )

        # 全局平均池化：将 7x7 空间维度压缩为 1x1
        self.avgpool = nn.AdaptiveAvgPool2d(1)

        # 全连接分类层
        self.fc = nn.Linear(HEAD_CHANNELS, num_classes)

    def forward(self, x):
        # x: (B, 3, 224, 224)
        x = self.stem(x)      # -> (B, 32, 112, 112)
        x = self.blocks(x)    # -> (B, 320, 7, 7)
        x = self.head(x)      # -> (B, 1280, 7, 7)
        x = self.avgpool(x)   # -> (B, 1280, 1, 1)
        x = x.flatten(1)      # -> (B, 1280)
        x = self.fc(x)        # -> (B, 1000)
        return x


if __name__ == "__main__":
    # ==================== 教育演示 ====================
    model = EfficientNetB0()

    # 创建随机输入（模拟一批 2 张 224x224 RGB 图像）
    x = torch.randn(2, 3, IMAGE_SIZE, IMAGE_SIZE)

    # 前向传播
    out = model(x)

    print("=" * 50)
    print("EfficientNet-B0 前向传播演示")
    print("=" * 50)
    print(f"输入形状:  {x.shape}")
    print(f"输出形状: {out.shape}")

    # 计算总参数量
    total = sum(p.numel() for p in model.parameters())
    print(f"总参数量: {total / 1e6:.2f}M")
    print("=" * 50)

    # ==================== 练习题 ====================
    # 尝试以下修改来加深理解：
    # 1. 将 SE_REDUCTION 从 4 改为 16，观察参数量变化（SE 模块参数量会减少）
    # 2. 修改 STAGES 中某个阶段的 num_repeats，观察输出形状是否变化
    # 3. 将 Swish 替换为 nn.ReLU()，比较参数量（不变）和可能的精度差异
    # 4. 在 MBConv 的投影层后添加 Swish，观察训练是否变慢（信息可能过早饱和）
