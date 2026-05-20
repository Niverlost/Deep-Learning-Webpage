"""
Very Deep Convolutional Networks for Large-Scale Image Recognition
Karen Simonyan, Andrew Zisserman
2014
arXiv: https://arxiv.org/abs/1409.1556

========== 初学者导读 ==========
VGGNet 的核心思想：用很多个非常小的 3x3 卷积核堆叠，来代替之前常用的
大卷积核（比如 7x7 或 11x11）。这样做的好处是：
- 两个 3x3 卷积堆叠的感受野 ≈ 一个 5x5 卷积
- 三个 3x3 卷积堆叠的感受野 ≈ 一个 7x7 卷积
- 同时参数量更少，且中间多了一层非线性（ReLU），表达能力更强。

VGG-16 是论文中提出的 Configuration D，共 16 层带权重的层：
13 个卷积层 + 3 个全连接层。

注意：原论文没有使用 BatchNorm，因为 BatchNorm 是 2015 年才提出的。
"""

import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# 配置常数（与论文 Table 1, Configuration D 完全一致）
# ---------------------------------------------------------------------------
INPUT_SIZE = 224          # 输入图像的空间尺寸（高和宽）
NUM_CLASSES = 1000        # ImageNet 分类数

CONV_KERNEL = 3           # 所有卷积核尺寸都是 3x3（论文的核心设计选择）
CONV_STRIDE = 1           # 卷积步长为 1，保持空间分辨率不变
CONV_PAD = 1              # padding=1，配合 3x3 卷积，输出尺寸 = 输入尺寸

POOL_KERNEL = 2           # MaxPool 窗口大小 2x2
POOL_STRIDE = 2           # MaxPool 步长 2，每次将空间尺寸减半

FC6_OUT = 4096            # 第一个全连接层的输出维度
FC7_OUT = 4096            # 第二个全连接层的输出维度


# ---------------------------------------------------------------------------
# 关键概念（Key Concepts）
# ---------------------------------------------------------------------------
# 1. 感受野（Receptive Field）：网络每一层看到的原始输入图像的区域大小。
#    VGG 通过堆叠 3x3 卷积来扩大感受野，而不是用更大的卷积核。
#
# 2. 空间下采样（Spatial Downsampling）：MaxPool 2x2 stride=2 将特征图
#    高和宽各减半，从而逐步降低计算量，同时让高层特征包含更多语义信息。
#
# 3. 通道数翻倍策略：每次 MaxPool 后，通道数翻倍（64 -> 128 -> 256 -> 512）。
#    这是为了补偿空间分辨率下降带来的信息损失。


# ---------------------------------------------------------------------------
# 基础构建块
# ---------------------------------------------------------------------------
class ConvBlock(nn.Module):
    """
    基础卷积块：Conv3x3 -> ReLU

    论文中没有使用 BatchNorm，因为 VGG 发表于 2014 年，而 BatchNorm
    是 Ioffe & Szegedy 在 2015 年的论文中才提出的。
    """

    def __init__(self, in_ch: int, out_ch: int) -> None:
        super().__init__()
        # 卷积层：使用 3x3 卷积核，stride=1，padding=1
        # 这样输出特征图的空间尺寸与输入相同
        self.conv = nn.Conv2d(
            in_ch, out_ch,
            kernel_size=CONV_KERNEL,
            stride=CONV_STRIDE,
            padding=CONV_PAD,
        )
        # 激活函数：论文使用 ReLU（不是 LeakyReLU）
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # 先卷积，再激活
        return self.relu(self.conv(x))


# ---------------------------------------------------------------------------
# VGG-16 完整模型
# ---------------------------------------------------------------------------
class VGG16(nn.Module):
    """
    VGG-16 (Configuration D)

    网络结构概览：
    - 5 个卷积块（共 13 个卷积层）
    - 5 次 MaxPool 下采样
    - 3 个全连接层

    输入: (B, 3, 224, 224)   批次大小 B，3 通道 RGB，224x224 像素
    输出: (B, 1000)          1000 个 ImageNet 类别的 logits
    """

    def __init__(self, num_classes: int = NUM_CLASSES) -> None:
        super().__init__()

        # ==================== Block 1 ====================
        # 输入:  (B, 3,   224, 224)
        # 输出:  (B, 64,  224, 224) -> MaxPool -> (B, 64, 112, 112)
        self.block1 = nn.Sequential(
            ConvBlock(3, 64),    # 3 -> 64 通道
            ConvBlock(64, 64),   # 64 -> 64 通道（加深特征）
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # ==================== Block 2 ====================
        # 输入:  (B, 64,  112, 112)
        # 输出:  (B, 128, 112, 112) -> MaxPool -> (B, 128, 56, 56)
        self.block2 = nn.Sequential(
            ConvBlock(64, 128),   # 通道数翻倍：64 -> 128
            ConvBlock(128, 128),  # 128 -> 128
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # ==================== Block 3 ====================
        # 输入:  (B, 128, 56, 56)
        # 输出:  (B, 256, 56, 56) -> MaxPool -> (B, 256, 28, 28)
        self.block3 = nn.Sequential(
            ConvBlock(128, 256),  # 128 -> 256
            ConvBlock(256, 256),  # 256 -> 256
            ConvBlock(256, 256),  # 256 -> 256（Block 3 开始有 3 个卷积层）
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # ==================== Block 4 ====================
        # 输入:  (B, 256, 28, 28)
        # 输出:  (B, 512, 28, 28) -> MaxPool -> (B, 512, 14, 14)
        self.block4 = nn.Sequential(
            ConvBlock(256, 512),  # 256 -> 512
            ConvBlock(512, 512),  # 512 -> 512
            ConvBlock(512, 512),  # 512 -> 512
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # ==================== Block 5 ====================
        # 输入:  (B, 512, 14, 14)
        # 输出:  (B, 512, 14, 14) -> MaxPool -> (B, 512, 7, 7)
        self.block5 = nn.Sequential(
            ConvBlock(512, 512),  # 512 -> 512（通道数不再翻倍，保持 512）
            ConvBlock(512, 512),  # 512 -> 512
            ConvBlock(512, 512),  # 512 -> 512
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )
        # 经过 5 次 MaxPool（每次尺寸减半）：
        # 224 -> 112 -> 56 -> 28 -> 14 -> 7
        # 最终特征图尺寸: (B, 512, 7, 7)

        # ==================== 全连接分类器 ====================
        # FC6: 将特征图展平后映射到 4096 维
        self.fc6 = nn.Sequential(
            nn.Linear(512 * 7 * 7, FC6_OUT),  # 512*7*7 = 25088
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.5),                # 论文使用 Dropout 防止过拟合
        )

        # FC7: 第二个 4096 维全连接层
        self.fc7 = nn.Sequential(
            nn.Linear(FC6_OUT, FC7_OUT),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.5),
        )

        # FC8: 输出层，1000 个类别
        self.fc8 = nn.Linear(FC7_OUT, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        前向传播流程，带形状注释：
        """
        # x: (B, 3, 224, 224)
        x = self.block1(x)   # -> (B, 64, 112, 112)
        x = self.block2(x)   # -> (B, 128, 56, 56)
        x = self.block3(x)   # -> (B, 256, 28, 28)
        x = self.block4(x)   # -> (B, 512, 14, 14)
        x = self.block5(x)   # -> (B, 512, 7, 7)

        # 将特征图展平为一维向量
        x = torch.flatten(x, start_dim=1)  # -> (B, 512*7*7) = (B, 25088)

        x = self.fc6(x)  # -> (B, 4096)
        x = self.fc7(x)  # -> (B, 4096)
        x = self.fc8(x)  # -> (B, 1000)
        return x


# ---------------------------------------------------------------------------
# 教学演示（Educational Demo）
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # 创建模型实例
    model = VGG16(num_classes=NUM_CLASSES)

    # 构造一个假输入（模拟 2 张 224x224 的 RGB 图像）
    dummy = torch.randn(2, 3, INPUT_SIZE, INPUT_SIZE)

    # 前向传播
    out = model(dummy)

    # 统计参数量
    total_params = sum(p.numel() for p in model.parameters())

    print("=" * 50)
    print("VGG-16 教学演示")
    print("=" * 50)
    print(f"输入形状:  {dummy.shape}")
    print(f"输出形状: {out.shape}")
    print(f"总参数量: {total_params:,} (~{total_params / 1e6:.1f}M)")
    print("=" * 50)

    # ========== 课后练习（供读者尝试） ==========
    # 1. 将 VGG-16 改为 VGG-19（Configuration E）：
    #    在 Block3、Block4、Block5 中各增加一个 ConvBlock，
    #    使每个 block 有 4 个卷积层，总共 16 个卷积层 + 3 个 FC = 19 层。
    #
    # 2. 尝试将输入尺寸从 224 改为 128，观察输出形状是否仍然正确。
    #    （注意：FC 层的输入维度 512*7*7 需要相应修改。）
    #
    # 3. 对比：如果把所有 3x3 卷积换成 5x5 卷积，参数量会增加多少？
    #    （提示：卷积层参数量 ≈ kernel_h * kernel_w * in_ch * out_ch）
    #
    # 4. 思考题：为什么论文选择 3x3 而不是 5x5 或 7x7？
    #    （答案：更少的参数 + 更多的非线性激活 = 更强的表达能力）
