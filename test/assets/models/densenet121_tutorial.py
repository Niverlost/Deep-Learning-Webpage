"""
Densely Connected Convolutional Networks (DenseNet-121)
Gao Huang, Zhuang Liu, Laurens van der Maaten, Kilian Q. Weinberger
CVPR 2017
https://arxiv.org/abs/1608.06993

本文件是 DenseNet-121 的初学者友好版实现，适合希望理解网络结构的学生和开发者。

DenseNet 的核心思想：
- 每一层都直接连接到前面所有层（密集连接），通过通道拼接 (concat) 实现特征复用。
- 相比 ResNet 的逐元素相加，DenseNet 的拼接方式能保留更多原始信息，缓解梯度消失。
- 参数更高效：DenseNet-121 只有约 8M 参数，却能取得与 ResNet-50 (25M) 相当的性能。
"""

import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# 配置常量（与论文 Table 1 完全一致）
# ---------------------------------------------------------------------------
GROWTH_RATE = 32          # k=32: 每个 DenseLayer 输出的新特征图通道数
THETA = 0.5               # 压缩因子：Transition 层将通道数压缩为原来的 0.5
NUM_CLASSES = 1000        # ImageNet 分类数
INPUT_SIZE = 224          # 输入图像尺寸

# DenseNet-121 每个 DenseBlock 包含的层数（论文中 121 = 6+12+24+16 + 3个Transition + 1个初始Conv）
NUM_LAYERS = [6, 12, 24, 16]

INIT_CHANNELS = 64        # 初始卷积层的输出通道数


# ---------------------------------------------------------------------------
# 核心模块
# ---------------------------------------------------------------------------
class _DenseLayer(nn.Module):
    """
    单个 Dense 层。

    结构: BN -> ReLU -> 3x3 Conv

    注意：DenseNet-121 使用非瓶颈层（1x1 -> 3x3），即论文中的非 bottleneck 版本。
    每层接收前面所有层的特征图，输出 k 个新特征图，然后与输入拼接。
    """

    def __init__(self, in_channels: int, growth_rate: int = GROWTH_RATE):
        super().__init__()
        # 批归一化：稳定训练，允许更高学习率
        self.bn = nn.BatchNorm2d(in_channels)
        # ReLU 激活：引入非线性
        self.relu = nn.ReLU(inplace=True)
        # 3x3 卷积：提取空间特征，输出 growth_rate 个新通道
        self.conv = nn.Conv2d(
            in_channels, growth_rate,
            kernel_size=3, stride=1, padding=1, bias=False
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x 的形状: (B, C_in, H, W)
        out = self.conv(self.relu(self.bn(x)))
        # out 的形状: (B, k, H, W)
        # 将新特征图与输入拼接，实现密集连接
        return torch.cat([x, out], dim=1)  # 形状: (B, C_in + k, H, W)


class _DenseBlock(nn.Module):
    """
    DenseBlock：由多个 DenseLayer 顺序堆叠而成。

    假设输入通道为 C_in，growth_rate=k，共 n 层：
    - 第1层输出: C_in + k
    - 第2层输出: C_in + 2k
    - ...
    - 第n层输出: C_in + n*k

    因此每个 DenseLayer 的输入通道数都不同，需要逐层计算。
    """

    def __init__(self, num_layers: int, in_channels: int, growth_rate: int = GROWTH_RATE):
        super().__init__()
        layers = []
        for i in range(num_layers):
            # 第 i 层的输入通道 = 初始通道 + 前面 i 层新增的通道
            layer_in_channels = in_channels + i * growth_rate
            layers.append(_DenseLayer(layer_in_channels, growth_rate))
        self.block = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class _Transition(nn.Module):
    """
    Transition 层：连接两个 DenseBlock，负责下采样和通道压缩。

    结构: BN -> ReLU -> 1x1 Conv (压缩) -> 2x2 AvgPool (下采样)

    作用：
    1. 1x1 卷积将通道数从 C 压缩为 theta*C，减少计算量。
    2. 平均池化将空间尺寸减半（H/2, W/2），扩大感受野。
    """

    def __init__(self, in_channels: int, theta: float = THETA):
        super().__init__()
        out_channels = int(in_channels * theta)  # 压缩后的通道数
        self.bn = nn.BatchNorm2d(in_channels)
        self.relu = nn.ReLU(inplace=True)
        # 1x1 卷积：跨通道信息融合 + 降维
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size=1, stride=1, bias=False)
        # 2x2 平均池化：下采样，stride=2 使空间尺寸减半
        self.pool = nn.AvgPool2d(kernel_size=2, stride=2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.conv(self.relu(self.bn(x)))  # 通道压缩
        x = self.pool(x)                       # 空间下采样
        return x


# ---------------------------------------------------------------------------
# 完整模型
# ---------------------------------------------------------------------------
class DenseNet121(nn.Module):
    """
    DenseNet-121 完整模型。

    前向流程：
    1. 初始卷积 (7x7, stride=2) + MaxPool -> 空间尺寸从 224x224 降到 56x56
    2. DenseBlock1 (6层) + Transition1 -> 56x56 -> 28x28
    3. DenseBlock2 (12层) + Transition2 -> 28x28 -> 14x14
    4. DenseBlock3 (24层) + Transition3 -> 14x14 -> 7x7
    5. DenseBlock4 (16层) -> 7x7
    6. GlobalAvgPool -> 1x1
    7. FC -> 1000 类
    """

    def __init__(self, num_classes: int = NUM_CLASSES):
        super().__init__()

        # ---------- 初始卷积 + 池化 ----------
        # 7x7 大卷积核快速提取低级特征，stride=2 下采样
        self.conv1 = nn.Conv2d(3, INIT_CHANNELS, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(INIT_CHANNELS)
        self.relu = nn.ReLU(inplace=True)
        # 3x3 MaxPool，stride=2，进一步下采样
        self.pool1 = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)
        # 此时特征图尺寸: 224/2/2 = 56x56

        # ---------- DenseBlock1: 6 层 ----------
        self.dense1 = _DenseBlock(NUM_LAYERS[0], INIT_CHANNELS, GROWTH_RATE)
        # 输出通道: 64 + 6*32 = 256
        num_channels = INIT_CHANNELS + NUM_LAYERS[0] * GROWTH_RATE  # 256
        self.trans1 = _Transition(num_channels, THETA)
        num_channels = int(num_channels * THETA)  # 128
        # 空间尺寸: 56x56 -> 28x28

        # ---------- DenseBlock2: 12 层 ----------
        self.dense2 = _DenseBlock(NUM_LAYERS[1], num_channels, GROWTH_RATE)
        # 输出通道: 128 + 12*32 = 512
        num_channels = num_channels + NUM_LAYERS[1] * GROWTH_RATE  # 512
        self.trans2 = _Transition(num_channels, THETA)
        num_channels = int(num_channels * THETA)  # 256
        # 空间尺寸: 28x28 -> 14x14

        # ---------- DenseBlock3: 24 层 ----------
        self.dense3 = _DenseBlock(NUM_LAYERS[2], num_channels, GROWTH_RATE)
        # 输出通道: 256 + 24*32 = 1024
        num_channels = num_channels + NUM_LAYERS[2] * GROWTH_RATE  # 1024
        self.trans3 = _Transition(num_channels, THETA)
        num_channels = int(num_channels * THETA)  # 512
        # 空间尺寸: 14x14 -> 7x7

        # ---------- DenseBlock4: 16 层 ----------
        self.dense4 = _DenseBlock(NUM_LAYERS[3], num_channels, GROWTH_RATE)
        # 输出通道: 512 + 16*32 = 1024
        num_channels = num_channels + NUM_LAYERS[3] * GROWTH_RATE  # 1024

        # ---------- 分类头 ----------
        self.bn_final = nn.BatchNorm2d(num_channels)
        # 全局平均池化：将 7x7 特征图压缩为 1x1，替代全连接层减少参数量
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(num_channels, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # 初始卷积 + 池化
        x = self.conv1(x)   # (B, 3, 224, 224) -> (B, 64, 112, 112)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.pool1(x)   # -> (B, 64, 56, 56)

        # Block 1
        x = self.dense1(x)  # -> (B, 256, 56, 56)
        x = self.trans1(x)  # -> (B, 128, 28, 28)

        # Block 2
        x = self.dense2(x)  # -> (B, 512, 28, 28)
        x = self.trans2(x)  # -> (B, 256, 14, 14)

        # Block 3
        x = self.dense3(x)  # -> (B, 1024, 14, 14)
        x = self.trans3(x)  # -> (B, 512, 7, 7)

        # Block 4
        x = self.dense4(x)  # -> (B, 1024, 7, 7)
        x = self.bn_final(x)
        x = self.relu(x)

        # 分类
        x = self.avgpool(x)  # -> (B, 1024, 1, 1)
        x = torch.flatten(x, 1)  # -> (B, 1024)
        x = self.fc(x)       # -> (B, 1000)
        return x


# ---------------------------------------------------------------------------
# 教育演示
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = DenseNet121(num_classes=1000)
    x = torch.randn(2, 3, 224, 224)
    y = model(x)

    print(f"输入形状:  {x.shape}")
    print(f"输出形状: {y.shape}")
    total_params = sum(p.numel() for p in model.parameters())
    print(f"总参数量: {total_params:,} (~{total_params / 1e6:.1f}M)")

    print("\n--- 关键概念回顾 ---")
    print("1. 密集连接 (Dense Connectivity): 每一层接收前面所有层的输出作为输入")
    print("2. Growth Rate (k=32): 每层只新增 32 个特征图，控制模型复杂度")
    print("3. Transition 层: 通过 1x1 卷积压缩通道数，通过池化下采样")
    print("4. 参数高效: 约 8M 参数，远小于 ResNet-50 的 25M")

    print("\n--- 练习题 ---")
    print("1. 尝试修改 GROWTH_RATE 为 16 或 48，观察参数量和输出形状的变化")
    print("2. 尝试修改 THETA 为 0.3 或 1.0，观察通道数变化")
    print("3. 对比 ResNet 的残差连接，思考 concat 和 add 的优缺点")
