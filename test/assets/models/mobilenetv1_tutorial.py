"""
MobileNets: Efficient Convolutional Neural Networks for Mobile Vision Applications
Andrew G. Howard 等, Google Inc., 2017
arXiv: https://arxiv.org/abs/1704.04861

================================================================================
【这是什么模型？】
MobileNetV1 是 Google 提出的一种轻量级卷积神经网络，专为移动设备和嵌入式设备设计。
它的核心创新是"深度可分离卷积"(Depthwise Separable Convolution)，将标准卷积拆分为
两步：先对每个输入通道单独做空间卷积(Depthwise)，再用 1x1 卷积(Pointwise)混合通道信息。
这样可以将计算量和参数量降低到原来的约 1/8 ~ 1/9，同时保持较高的精度。

【核心概念】
- 深度可分离卷积 = Depthwise Conv + Pointwise Conv
- 宽度乘数 (Width Multiplier): 控制每层的通道数，进一步缩小模型
- 分辨率乘数 (Resolution Multiplier): 控制输入图像分辨率
================================================================================
"""

import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# 配置常量（与论文 Table 1 一致）
# ---------------------------------------------------------------------------
INPUT_SIZE = 224          # 输入图像尺寸: 224x224（标准 ImageNet 尺寸）
NUM_CLASSES = 1000        # ImageNet 分类类别数
WIDTH_MULTIPLIER = 1.0    # 宽度乘数: 1.0 为标准模型，0.75/0.5/0.25 为更轻量版本


# ---------------------------------------------------------------------------
# 核心模块：深度可分离卷积
# ---------------------------------------------------------------------------
class DepthwiseSeparableConv(nn.Module):
    """
    深度可分离卷积块。

    标准卷积 (如 3x3x256x512) 同时做两件事：
    1) 在空间维度上滑动，提取局部特征
    2) 在通道维度上混合信息

    深度可分离卷积将这两步分开：
    - Depthwise: 每个输入通道单独做 3x3 卷积，只提取空间特征，不混合通道
    - Pointwise: 用 1x1 卷积混合通道信息，不改变空间尺寸

    参数量对比 (输入通道=c, 输出通道=c):
      标准 3x3 卷积:  3*3*c*c = 9c²
      深度可分离:     3*3*c + 1*1*c*c = 9c + c²  (约为标准卷积的 1/8 ~ 1/9)
    """

    def __init__(self, in_ch: int, out_ch: int, stride: int = 1):
        super().__init__()

        # Step 1: Depthwise Convolution（逐通道卷积）
        # groups=in_ch 表示每个输入通道独立卷积，输出通道数 = 输入通道数
        self.depthwise = nn.Conv2d(
            in_ch, in_ch,
            kernel_size=3,      # 论文使用 3x3 卷积核
            stride=stride,      # 下采样时 stride=2，否则 stride=1
            padding=1,          # padding=1 保持空间尺寸（stride=1 时）
            groups=in_ch,       # 关键：groups=in_ch 实现逐通道卷积
            bias=False,         # BatchNorm 会抵消 bias，所以设为 False
        )
        self.bn1 = nn.BatchNorm2d(in_ch)   # 批归一化：稳定训练、加速收敛
        self.relu1 = nn.ReLU(inplace=True) # 激活函数：论文使用 ReLU（后续版本改为 ReLU6）

        # Step 2: Pointwise Convolution（1x1 卷积，混合通道）
        self.pointwise = nn.Conv2d(
            in_ch, out_ch,
            kernel_size=1,      # 1x1 卷积，只混合通道，不改变空间尺寸
            stride=1,
            padding=0,
            bias=False,
        )
        self.bn2 = nn.BatchNorm2d(out_ch)
        self.relu2 = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # 输入形状: (B, in_ch, H, W)
        x = self.depthwise(x)   # 输出: (B, in_ch, H/s, W/s)  — 提取空间特征
        x = self.bn1(x)
        x = self.relu1(x)
        x = self.pointwise(x)   # 输出: (B, out_ch, H/s, W/s) — 混合通道信息
        x = self.bn2(x)
        x = self.relu2(x)
        return x


# ---------------------------------------------------------------------------
# 完整模型：MobileNetV1
# ---------------------------------------------------------------------------
class MobileNetV1(nn.Module):
    """
    MobileNetV1 完整架构（对应论文 Table 1）。

    前向流程概述：
    1. 标准 3x3 卷积（初始下采样到 112x112，通道扩到 32）
    2. 13 个深度可分离卷积层，逐步下采样并增加通道数
    3. 全局平均池化，将 7x7 特征图压缩为 1x1
    4. 全连接层输出 1000 维分类 logits

    各阶段空间尺寸变化（stride=2 时减半）：
    224 -> 112 -> 112 -> 56 -> 56 -> 28 -> 28 -> 14 -> 14x5 -> 7 -> 7 -> 1
    """

    def __init__(self, num_classes: int = NUM_CLASSES, width_mult: float = WIDTH_MULTIPLIER):
        super().__init__()

        def _make_divisible(v: float, divisor: int = 8) -> int:
            """
            将通道数调整为 divisor 的整数倍。
            这是工程上的常见做法，有利于硬件加速（如 SIMD）。
            """
            return int((v + divisor / 2) // divisor * divisor)

        def _round(ch: int) -> int:
            """根据宽度乘数调整通道数。"""
            return _make_divisible(ch * width_mult)

        # -------------------------------------------------------------------
        # 第一层：标准卷积（论文 Table 1 中的 Conv / s2）
        # -------------------------------------------------------------------
        # 输入: (B, 3, 224, 224)
        # 输出: (B, 32, 112, 112)   因为 stride=2，空间尺寸减半
        self.conv1 = nn.Sequential(
            nn.Conv2d(3, _round(32), kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(_round(32)),
            nn.ReLU(inplace=True),
        )

        # -------------------------------------------------------------------
        # 深度可分离卷积序列（论文 Table 1 中的 Conv dw / Conv pw）
        # -------------------------------------------------------------------
        # 注意：从 512 通道开始，连续 5 层保持 512->512（stride=1），这是论文中的重复结构
        self.separable_convs = nn.Sequential(
            # conv_ds_1:  32 -> 64,   stride=1,  尺寸 112x112
            DepthwiseSeparableConv(_round(32),  _round(64),  stride=1),
            # conv_ds_2:  64 -> 128,  stride=2,  尺寸 56x56
            DepthwiseSeparableConv(_round(64),  _round(128), stride=2),
            # conv_ds_3:  128 -> 128, stride=1,  尺寸 56x56
            DepthwiseSeparableConv(_round(128), _round(128), stride=1),
            # conv_ds_4:  128 -> 256, stride=2,  尺寸 28x28
            DepthwiseSeparableConv(_round(128), _round(256), stride=2),
            # conv_ds_5:  256 -> 256, stride=1,  尺寸 28x28
            DepthwiseSeparableConv(_round(256), _round(256), stride=1),
            # conv_ds_6:  256 -> 512, stride=2,  尺寸 14x14
            DepthwiseSeparableConv(_round(256), _round(512), stride=2),
            # conv_ds_7 ~ 11: 512 -> 512, 连续 5 层 stride=1，尺寸保持 14x14
            DepthwiseSeparableConv(_round(512), _round(512), stride=1),  # conv_ds_7
            DepthwiseSeparableConv(_round(512), _round(512), stride=1),  # conv_ds_8
            DepthwiseSeparableConv(_round(512), _round(512), stride=1),  # conv_ds_9
            DepthwiseSeparableConv(_round(512), _round(512), stride=1),  # conv_ds_10
            DepthwiseSeparableConv(_round(512), _round(512), stride=1),  # conv_ds_11
            # conv_ds_12: 512 -> 1024, stride=2, 尺寸 7x7
            DepthwiseSeparableConv(_round(512), _round(1024), stride=2),
            # conv_ds_13: 1024 -> 1024, stride=1, 尺寸 7x7
            DepthwiseSeparableConv(_round(1024), _round(1024), stride=1),
        )

        # 全局平均池化: (B, 1024, 7, 7) -> (B, 1024, 1, 1)
        # 论文使用 7x7 Average Pool，这里用 AdaptiveAvgPool2d 更通用
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))

        # 全连接分类层: 1024 -> 1000
        self.fc = nn.Linear(_round(1024), num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        前向传播流程，附带形状注释。

        输入:  (B, 3, 224, 224)
        输出:  (B, 1000)
        """
        x = self.conv1(x)           # (B, 32, 112, 112)
        x = self.separable_convs(x) # (B, 1024, 7, 7)
        x = self.avgpool(x)         # (B, 1024, 1, 1)
        x = x.view(x.size(0), -1)   # (B, 1024) — 展平为一维向量
        x = self.fc(x)              # (B, 1000) — 分类 logits
        return x


# ---------------------------------------------------------------------------
# 教学演示
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # 创建模型实例
    model = MobileNetV1(num_classes=1000, width_mult=1.0)

    # 模拟一批输入数据：2 张 224x224 的 RGB 图像
    dummy = torch.randn(2, 3, 224, 224)

    # 前向传播
    out = model(dummy)

    # 统计参数量
    total_params = sum(p.numel() for p in model.parameters())

    print("=" * 60)
    print("MobileNetV1 前向传播演示")
    print("=" * 60)
    print(f"输入形状:    {dummy.shape}")
    print(f"输出形状:    {out.shape}")
    print(f"总参数量:    {total_params:,}")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # 练习建议（供读者动手尝试）
    # -----------------------------------------------------------------------
    # 1. 修改 width_mult 为 0.5 或 0.25，观察参数量和输出形状的变化。
    # 2. 将 nn.ReLU 替换为 nn.ReLU6（论文后续版本及 TensorFlow 实现中使用），
    #    观察是否有任何变化（ReLU6 将输出限制在 [0, 6]，有助于量化）。
    # 3. 打印 model 的每一层，理解深度可分离卷积在 PyTorch 中的具体表示。
    # 4. 尝试将输入尺寸改为 192 或 160（对应论文中的分辨率乘数），
    #    观察最后 avgpool 前的特征图尺寸变化。
    # -----------------------------------------------------------------------
