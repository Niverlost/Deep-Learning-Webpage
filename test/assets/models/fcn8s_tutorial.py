"""
Fully Convolutional Networks for Semantic Segmentation
Jonathan Long, Evan Shelhamer, Trevor Darrell
2015

本文件是 FCN-8s 的初学者教程版本。

什么是语义分割？
  语义分割是计算机视觉任务，目标是为图像中的每个像素分配一个类别标签
  （例如：人、车、狗、背景）。这与图像分类（只预测整张图的类别）不同。

FCN 的核心思想：
  1. 将传统 CNN 末尾的全连接层（FC）替换为卷积层，使网络可以接受任意尺寸的输入，
     并输出对应尺寸的特征图。
  2. 使用反卷积（转置卷积）进行上采样，将粗糙的特征图恢复到原图尺寸。
  3. 引入 Skip Connection（跳跃连接），将浅层的高分辨率特征与深层的高语义特征融合，
     从而提升分割边界的精细度。

FCN-8s 的含义：
  "8s" 表示最终输出的特征图相对于输入图像的步长（stride）为 8。
  它融合了来自 pool3（stride 8）、pool4（stride 16）和 conv7（stride 32）的信息。
"""

import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# 配置常量（与论文一致）
# ---------------------------------------------------------------------------
NUM_CLASSES = 21          # PASCAL VOC 数据集：20 个物体类别 + 1 个背景类别

CONV_KERNEL = 3           # VGG 使用的卷积核尺寸：3x3
CONV_STRIDE = 1           # 卷积步长：1（保持空间尺寸）
CONV_PAD = 1              # 填充：1（配合 3x3 卷积保持尺寸不变）

POOL_KERNEL = 2           # 池化窗口：2x2
POOL_STRIDE = 2           # 池化步长：2（每次空间尺寸减半）

FC6_OUT = 4096            # 原 VGG 中 FC6 的输出维度，现改为卷积输出通道数
FC7_OUT = 4096            # 原 VGG 中 FC7 的输出维度


# ---------------------------------------------------------------------------
# 基础模块
# ---------------------------------------------------------------------------
class ConvBlock(nn.Module):
    """
    基础卷积块：Conv3x3 -> ReLU

    论文中 VGG 网络不使用 BatchNorm（BatchNorm 在 2015 年才广泛使用），
    因此这里只包含卷积和激活函数。
    """

    def __init__(self, in_ch: int, out_ch: int) -> None:
        super().__init__()
        self.conv = nn.Conv2d(
            in_ch, out_ch,
            kernel_size=CONV_KERNEL,
            stride=CONV_STRIDE,
            padding=CONV_PAD,
        )
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.relu(self.conv(x))


# ---------------------------------------------------------------------------
# FCN-8s 完整模型
# ---------------------------------------------------------------------------
class FCN8s(nn.Module):
    """
    FCN-8s 语义分割网络（VGG-16  backbone）

    网络流程：
      1. VGG-16 特征提取（block1 ~ block5），得到不同尺度的特征图
      2. 将原全连接层（FC6/FC7/FC8）改为卷积层（conv6/conv7/conv8）
      3. 使用 Skip Connection 融合 pool3、pool4 和 conv7 的信息
      4. 通过转置卷积逐步上采样，恢复到原图尺寸

    输入: (B, 3, H, W) 任意尺寸的 RGB 图像
    输出: (B, NUM_CLASSES, H, W) 每个像素的类别分数图
    """

    def __init__(self, num_classes: int = NUM_CLASSES) -> None:
        super().__init__()

        # ------------------- VGG-16 Backbone -------------------
        # Block 1: 2 层 conv(64) -> MaxPool
        # 输入: (B, 3, H, W)    输出: (B, 64, H/2, W/2)
        self.block1 = nn.Sequential(
            ConvBlock(3, 64),
            ConvBlock(64, 64),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Block 2: 2 层 conv(128) -> MaxPool
        # 输入: (B, 64, H/2, W/2)    输出: (B, 128, H/4, W/4)
        self.block2 = nn.Sequential(
            ConvBlock(64, 128),
            ConvBlock(128, 128),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Block 3: 3 层 conv(256) -> MaxPool
        # 此时空间尺寸为原图的 1/8，称为 "stride 8"
        # 输入: (B, 128, H/4, W/4)    输出: (B, 256, H/8, W/8)
        self.block3 = nn.Sequential(
            ConvBlock(128, 256),
            ConvBlock(256, 256),
            ConvBlock(256, 256),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Block 4: 3 层 conv(512) -> MaxPool
        # 此时空间尺寸为原图的 1/16，称为 "stride 16"
        # 输入: (B, 256, H/8, W/8)    输出: (B, 512, H/16, W/16)
        self.block4 = nn.Sequential(
            ConvBlock(256, 512),
            ConvBlock(512, 512),
            ConvBlock(512, 512),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Block 5: 3 层 conv(512) -> MaxPool
        # 此时空间尺寸为原图的 1/32，称为 "stride 32"
        # 输入: (B, 512, H/16, W/16)    输出: (B, 512, H/32, W/32)
        self.block5 = nn.Sequential(
            ConvBlock(512, 512),
            ConvBlock(512, 512),
            ConvBlock(512, 512),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # ------------------- 全卷积替换 FC 层 -------------------
        # 原 VGG 中 FC6 是 7x7 的卷积（因为经过 5 次池化后特征图为 7x7）
        # 这里使用 padding=3 使输出空间尺寸保持不变
        # 输入: (B, 512, H/32, W/32)    输出: (B, 4096, H/32, W/32)
        self.conv6 = nn.Sequential(
            nn.Conv2d(512, FC6_OUT, kernel_size=7, padding=3),
            nn.ReLU(inplace=True),
            nn.Dropout2d(p=0.5),   # 论文中使用 0.5 dropout 防止过拟合
        )

        # 原 FC7 -> 1x1 卷积
        # 输入: (B, 4096, H/32, W/32)    输出: (B, 4096, H/32, W/32)
        self.conv7 = nn.Sequential(
            nn.Conv2d(FC6_OUT, FC7_OUT, kernel_size=1),
            nn.ReLU(inplace=True),
            nn.Dropout2d(p=0.5),
        )

        # 原 FC8 -> 1x1 卷积，输出类别数
        # 输入: (B, 4096, H/32, W/32)    输出: (B, num_classes, H/32, W/32)
        self.conv8 = nn.Conv2d(FC7_OUT, num_classes, kernel_size=1)

        # ------------------- Skip Connections -------------------
        # pool4 的 1x1 卷积：将 512 通道映射到 num_classes 通道
        # 用于与 conv7 上采样后的特征图相加
        self.score_pool4 = nn.Conv2d(512, num_classes, kernel_size=1)

        # pool3 的 1x1 卷积：将 256 通道映射到 num_classes 通道
        # 用于与 pool4 融合后上采样的特征图相加
        self.score_pool3 = nn.Conv2d(256, num_classes, kernel_size=1)

        # ------------------- 可学习上采样（转置卷积） -------------------
        # upscore2: conv7 2x 上采样，从 stride 32 -> stride 16
        # kernel=4, stride=2, 无偏置（论文设置）
        self.upscore2 = nn.ConvTranspose2d(
            num_classes, num_classes, kernel_size=4, stride=2, bias=False
        )

        # upscore_pool4: 融合 pool4 后再 2x 上采样，从 stride 16 -> stride 8
        self.upscore_pool4 = nn.ConvTranspose2d(
            num_classes, num_classes, kernel_size=4, stride=2, bias=False
        )

        # upscore8: 融合 pool3 后 8x 上采样，从 stride 8 -> stride 1（原图尺寸）
        self.upscore8 = nn.ConvTranspose2d(
            num_classes, num_classes, kernel_size=16, stride=8, bias=False
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        前向传播流程（带特征图尺寸变化注释）

        假设输入尺寸为 (B, 3, 224, 224)
        """
        h = x

        # VGG backbone 特征提取
        h = self.block1(h)        # (B, 64, 112, 112)
        h = self.block2(h)        # (B, 128, 56, 56)
        pool3 = self.block3(h)    # (B, 256, 28, 28)  —— stride 8
        pool4 = self.block4(pool3)  # (B, 512, 14, 14)  —— stride 16
        pool5 = self.block5(pool4)  # (B, 512, 7, 7)    —— stride 32

        # 全卷积层
        conv7 = self.conv8(self.conv7(self.conv6(pool5)))
        # conv7: (B, num_classes, 7, 7)

        # ---- FCN-8s 融合策略 ----
        # Step 1: conv7 2x 上采样 -> 与 pool4 融合
        upscore2 = self.upscore2(conv7)
        # upscore2: (B, num_classes, 16, 16)  [7*2=14, 但转置卷积 kernel=4 会多出一点]

        score_pool4 = self.score_pool4(pool4)
        # score_pool4: (B, num_classes, 14, 14)

        # 相加融合（需要裁剪到相同尺寸）
        fuse_pool4 = upscore2 + score_pool4
        # fuse_pool4: (B, num_classes, 14, 14)

        # Step 2: fuse_pool4 2x 上采样 -> 与 pool3 融合
        upscore_pool4 = self.upscore_pool4(fuse_pool4)
        # upscore_pool4: (B, num_classes, 30, 30)

        score_pool3 = self.score_pool3(pool3)
        # score_pool3: (B, num_classes, 28, 28)

        fuse_pool3 = upscore_pool4 + score_pool3
        # fuse_pool3: (B, num_classes, 28, 28)

        # Step 3: 8x 上采样到原图尺寸
        out = self.upscore8(fuse_pool3)
        # out: (B, num_classes, 240, 240)  [28*8=224, 但 kernel=16 会多出一点]

        # 裁剪到与输入完全一致的尺寸
        _, _, H, W = x.shape
        out = out[:, :, :H, :W]
        # out: (B, num_classes, 224, 224)

        return out


# ---------------------------------------------------------------------------
# 教育演示
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = FCN8s(num_classes=NUM_CLASSES)
    dummy = torch.randn(2, 3, 224, 224)
    out = model(dummy)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"输入尺寸:  {dummy.shape}")
    print(f"输出尺寸: {out.shape}")
    print(f"总参数量: {total_params:,} (~{total_params / 1e6:.1f}M)")

    # ------------------- 练习建议 -------------------
    # 1. 尝试修改输入尺寸（如 320x480），观察输出是否保持相同空间尺寸。
    # 2. 对比 FCN-32s（不使用 skip connection）和 FCN-16s（只用 pool4），
    #    看看分割边界的精细度有何不同。
    # 3. 将 backbone 从 VGG-16 换成 ResNet-50，体验现代分割网络的设计。
