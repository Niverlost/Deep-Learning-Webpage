"""
U-Net: Convolutional Networks for Biomedical Image Segmentation
Olaf Ronneberger, Philipp Fischer, Thomas Brox
2015, MICCAI
arXiv: https://arxiv.org/abs/1505.04597

初学者友好版实现。

U-Net 是什么？
  U-Net 是一种用于图像分割的卷积神经网络。它的名字来源于其 U 形的网络结构：
  左侧是编码器（下采样，提取特征），右侧是解码器（上采样，恢复空间分辨率），
  中间通过 Skip Connection 将编码器的特征直接传递到解码器，帮助网络保留精细的空间细节。

关键概念：
  - 编码器-解码器结构：编码器逐步压缩空间信息、扩展通道数；解码器逐步恢复空间分辨率。
  - Skip Connection（跳跃连接）：将编码器某层的特征图裁剪后拼接到对应解码器层，弥补上采样丢失的细节。
  - Valid 卷积：论文使用无 padding 的 3x3 卷积，每经过一层卷积，特征图尺寸缩小 2。
"""

import torch
import torch.nn as nn


# ==================== 配置常量 ====================
# 输入图像通道数：论文使用灰度图像（1通道）
IN_CHANNELS = 1

# 输出类别数：论文中是 2 类（细胞 / 背景）
N_CLASSES = 2

# 输入图像尺寸：论文原始尺寸为 572x572
INPUT_SIZE = 572

# 编码器各阶段的通道数
# 从浅层到深层，通道数翻倍，空间尺寸减半
ENC_CHANNELS = [64, 128, 256, 512, 1024]


class ConvBlock(nn.Module):
    """
    U-Net 的基础卷积块：两个 3x3 卷积 + ReLU。

    论文使用 valid 卷积（padding=0），因此每经过一层 3x3 卷积，
    特征图的高度和宽度都会减少 2。
    """
    def __init__(self, in_ch, out_ch):
        super().__init__()
        # 第一层 3x3 卷积：将输入通道映射到输出通道
        # 无 padding，尺寸变化：H x W -> (H-2) x (W-2)
        self.conv1 = nn.Conv2d(in_ch, out_ch, kernel_size=3)
        self.relu1 = nn.ReLU(inplace=True)

        # 第二层 3x3 卷积：保持通道数不变，进一步提取特征
        # 无 padding，尺寸变化：(H-2) x (W-2) -> (H-4) x (W-4)
        self.conv2 = nn.Conv2d(out_ch, out_ch, kernel_size=3)
        self.relu2 = nn.ReLU(inplace=True)

    def forward(self, x):
        x = self.conv1(x)
        x = self.relu1(x)
        x = self.conv2(x)
        x = self.relu2(x)
        return x


class Down(nn.Module):
    """
    下采样模块：MaxPool + ConvBlock

    作用：将特征图空间尺寸减半，通道数翻倍。
    这是编码器（Contracting Path）的基本单元。
    """
    def __init__(self, in_ch, out_ch):
        super().__init__()
        # 2x2 最大池化，stride=2：将 H x W 变为 H/2 x W/2
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2)
        # 池化后接两个 3x3 卷积
        self.conv = ConvBlock(in_ch, out_ch)

    def forward(self, x):
        x = self.pool(x)
        x = self.conv(x)
        return x


class Up(nn.Module):
    """
    上采样模块：Transposed Conv + Skip Connection + ConvBlock

    作用：将特征图空间尺寸翻倍，并与编码器对应层的特征拼接。
    这是解码器（Expansive Path）的基本单元。

    注意：由于编码器中的卷积是 valid（无 padding），特征图尺寸会缩小。
    因此 Skip Connection 拼接前需要对编码器特征进行中心裁剪，使其与上采样后的特征尺寸匹配。
    """
    def __init__(self, in_ch, out_ch):
        super().__init__()
        # 2x2 转置卷积（反卷积）：将 H x W 变为 2H x 2W
        # 通道数从 in_ch 减半到 out_ch
        self.up = nn.ConvTranspose2d(in_ch, out_ch, kernel_size=2, stride=2)

        # 拼接后的通道数为 in_ch（因为 up 输出 out_ch，skip 也输出 out_ch，拼接后为 2*out_ch = in_ch）
        # 然后经过两个 3x3 卷积，将通道数映射回 out_ch
        self.conv = ConvBlock(in_ch, out_ch)

    def forward(self, x1, x2):
        """
        Args:
            x1: 来自更深层的上采样特征（需要被放大）
            x2: 来自编码器对应层的 Skip Connection 特征（需要被裁剪）
        """
        # 上采样：空间尺寸翻倍
        x1 = self.up(x1)

        # 计算尺寸差异，对 x2 进行中心裁剪
        # 论文中由于 valid 卷积，编码器特征图比解码器对应层大，需要裁剪后拼接
        diff_h = x2.size(2) - x1.size(2)
        diff_w = x2.size(3) - x1.size(3)
        x2 = x2[:, :, diff_h // 2 : -diff_h // 2, diff_w // 2 : -diff_w // 2]

        # 在通道维度上拼接：Skip Connection 的核心操作
        x = torch.cat([x2, x1], dim=1)

        # 两个 3x3 卷积进一步融合特征
        x = self.conv(x)
        return x


class UNet(nn.Module):
    """
    U-Net 完整模型。

    前向传播流程：
      1. 输入 (1, 572, 572) 经过初始 ConvBlock -> (64, 568, 568)
      2. 编码器下采样 4 次，通道数逐步翻倍至 1024
      3. 解码器上采样 4 次，每次与编码器对应层 Skip Connection
      4. 最终 1x1 卷积输出 (2, 388, 388) 的分割图
    """
    def __init__(self, n_classes=N_CLASSES):
        super().__init__()
        # 初始卷积块：1 -> 64 通道
        self.inc = ConvBlock(IN_CHANNELS, ENC_CHANNELS[0])

        # 编码器（Contracting Path）：下采样 4 次
        self.down1 = Down(ENC_CHANNELS[0], ENC_CHANNELS[1])  # 64 -> 128
        self.down2 = Down(ENC_CHANNELS[1], ENC_CHANNELS[2])  # 128 -> 256
        self.down3 = Down(ENC_CHANNELS[2], ENC_CHANNELS[3])  # 256 -> 512
        self.down4 = Down(ENC_CHANNELS[3], ENC_CHANNELS[4])  # 512 -> 1024

        # 解码器（Expansive Path）：上采样 4 次
        self.up1 = Up(ENC_CHANNELS[4], ENC_CHANNELS[3])      # 1024 -> 512
        self.up2 = Up(ENC_CHANNELS[3], ENC_CHANNELS[2])      # 512 -> 256
        self.up3 = Up(ENC_CHANNELS[2], ENC_CHANNELS[1])      # 256 -> 128
        self.up4 = Up(ENC_CHANNELS[1], ENC_CHANNELS[0])      # 128 -> 64

        # 输出层：1x1 卷积，将 64 通道映射到类别数
        self.outc = nn.Conv2d(ENC_CHANNELS[0], n_classes, kernel_size=1)

    def forward(self, x):
        # 编码器路径
        x1 = self.inc(x)          # (1, 572, 572) -> (64, 568, 568)
        x2 = self.down1(x1)       # (64, 568, 568) -> (128, 280, 280)
        x3 = self.down2(x2)       # (128, 280, 280) -> (256, 136, 136)
        x4 = self.down3(x3)       # (256, 136, 136) -> (512, 64, 64)
        x5 = self.down4(x4)       # (512, 64, 64) -> (1024, 28, 28)

        # 解码器路径 + Skip Connections
        x = self.up1(x5, x4)      # (1024, 28, 28) -> (512, 52, 52)
        x = self.up2(x, x3)       # (512, 52, 52) -> (256, 100, 100)
        x = self.up3(x, x2)       # (256, 100, 100) -> (128, 196, 196)
        x = self.up4(x, x1)       # (128, 196, 196) -> (64, 388, 388)

        # 输出分割图
        logits = self.outc(x)     # (64, 388, 388) -> (2, 388, 388)
        return logits


def count_parameters(model):
    """统计模型可训练参数总量。"""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


if __name__ == "__main__":
    # 创建模型
    model = UNet(n_classes=N_CLASSES)

    # 构造一个虚拟输入：batch=1, 通道=1, 尺寸=572x572
    x = torch.randn(1, IN_CHANNELS, INPUT_SIZE, INPUT_SIZE)

    # 前向传播
    y = model(x)

    print("=" * 50)
    print("U-Net 初学者教程版")
    print("=" * 50)
    print(f"输入尺寸:  {x.shape}")
    print(f"输出尺寸:  {y.shape}")
    print(f"总参数量:  {count_parameters(model):,}")
    print("=" * 50)

    # 练习题（供读者尝试）：
    # 1. 将输入尺寸改为 256x256，观察输出尺寸变化。
    # 2. 将 n_classes 改为 3，模拟多类别分割任务。
    # 3. 尝试在 ConvBlock 中加入 BatchNorm，观察参数量和输出变化。
    #    （注意：论文原版没有使用 BatchNorm，这是现代改进版的做法。）
