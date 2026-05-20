"""
Encoder-Decoder with Atrous Separable Convolution for Semantic Image Segmentation
Liang-Chieh Chen et al., ECCV 2018
arXiv: https://arxiv.org/abs/1802.02611

================================================================================
DeepLab v3+ 初学者教程版
================================================================================

【这是什么模型？】
DeepLab v3+ 是一个语义分割模型。语义分割的任务是：给图像中的每个像素分配一个类别标签
（例如：人、车、天空、道路等）。与图像分类（只给整图一个标签）不同，分割需要精确到像素级。

【核心思想】
1. 编码器-解码器 (Encoder-Decoder)：
   - 编码器（Encoder）用深层网络提取高级语义特征（"这是什么"）
   - 解码器（Decoder）逐步恢复空间分辨率，并结合底层细节特征（"在哪里"）

2. 空洞空间金字塔池化 (ASPP)：
   - 用不同膨胀率 (dilation rate) 的卷积核，同时捕获多尺度上下文信息
   - 膨胀率 = 卷积核元素之间的间隔，能在不增加参数的情况下扩大感受野

3. 深度可分离卷积 (Depthwise Separable Convolution)：
   - 将标准卷积拆分为两步：先对每个通道单独做空间卷积 (depthwise)，
     再用 1x1 卷积跨通道组合 (pointwise)
   - 大幅减少参数量和计算量，适合移动端部署

【关键概念】
- Output Stride (输出步长): 输入图像分辨率与输出特征图分辨率的比值。
  论文中常用 16（即特征图是原图的 1/16）。
- Low-level features: 编码器浅层输出的高分辨率特征，包含丰富的边缘/纹理信息。
- Atrous / Dilated Convolution: 带空洞的卷积，扩大感受野的同时保持特征图尺寸。
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ==============================================================================
# 配置常量
# ==============================================================================
NUM_CLASSES = 21       # PASCAL VOC 2012 数据集类别数（20个前景 + 1个背景）
INPUT_SIZE = 512       # 输入图像尺寸（高和宽），论文中常用 512x512
OUTPUT_STRIDE = 16     # 输出步长，16 表示最终特征图是原图的 1/16
LOW_LEVEL_CHANNELS = 48  # 底层特征经过 1x1 卷积后的通道数，论文实验得出 48 效果最佳
ASPP_OUT_CHANNELS = 256  # ASPP 模块输出通道数
DECODER_CHANNELS = 256   # 解码器中间通道数


# ==============================================================================
# 基础模块
# ==============================================================================
class SeparableConv2d(nn.Module):
    """
    深度可分离卷积 (Depthwise Separable Convolution)

    标准卷积的问题：
    - 一个 3x3 卷积核同时做"空间过滤"和"通道混合"
    - 参数量大：C_in * C_out * K * K

    深度可分离卷积的解决思路：
    - 将两个操作解耦：
      1) Depthwise: 每个输入通道单独做 3x3 卷积（groups=in_channels）
      2) Pointwise: 用 1x1 卷积跨通道组合信息
    - 参数量：C_in * K * K + C_in * C_out * 1 * 1，约为标准卷积的 1/8 ~ 1/9

    形状变化示例：
    - 输入: (B, 256, H, W)
    - Depthwise 后: (B, 256, H, W)  （通道数不变）
    - Pointwise 后: (B, out_ch, H, W)  （通道数变为 out_ch）
    """

    def __init__(self, in_ch, out_ch, kernel_size=3, stride=1, padding=1,
                 dilation=1, bias=False):
        super().__init__()
        # depthwise: groups=in_ch 表示每个通道独立卷积
        self.depthwise = nn.Conv2d(
            in_ch, in_ch, kernel_size, stride, padding, dilation,
            groups=in_ch, bias=bias
        )
        # pointwise: 1x1 卷积，只混合通道，不改变空间尺寸
        self.pointwise = nn.Conv2d(in_ch, out_ch, 1, 1, 0, 1, 1, bias=bias)

    def forward(self, x):
        x = self.depthwise(x)   # 每个通道独立做空间卷积
        x = self.pointwise(x)   # 1x1 卷积跨通道组合
        return x


class XceptionBlock(nn.Module):
    """
    Xception 残差块

    这是 Xception 网络的基本构建单元，包含：
    - 若干层深度可分离卷积 + BN + ReLU
    - 一个跳跃连接 (skip connection)，解决深层网络梯度消失问题

    参数说明：
    - in_ch / out_ch: 输入/输出通道数
    - reps: 块内可分离卷积的重复次数
    - stride: 下采样步长，>1 时通过 MaxPool 实现空间分辨率降低
    - dilation: 膨胀率，>1 时使用空洞卷积扩大感受野
    - start_with_relu: 块开始时是否先接 ReLU
    - grow_first: 是否先改变通道数（True: 先升/降维，再保持；False: 先保持，再改变）

    形状变化示例 (stride=2, in_ch=256, out_ch=512):
    - 输入: (B, 256, 56, 56)
    - 输出: (B, 512, 28, 28)  （空间减半，通道翻倍）
    """

    def __init__(self, in_ch, out_ch, reps, stride=1, dilation=1,
                 start_with_relu=True, grow_first=True):
        super().__init__()

        # 跳跃连接：当通道数或尺寸变化时，用 1x1 卷积对齐维度
        if out_ch != in_ch or stride != 1:
            self.skip = nn.Sequential(
                nn.Conv2d(in_ch, out_ch, 1, stride, bias=False),
                nn.BatchNorm2d(out_ch),
            )
        else:
            self.skip = None  # 维度一致，直接相加

        layers = []
        filters = in_ch

        # grow_first=True: 先做一次可分离卷积改变通道数
        if grow_first:
            if start_with_relu:
                layers.append(nn.ReLU(inplace=True))
            layers.append(SeparableConv2d(in_ch, out_ch, 3, 1, dilation, dilation))
            layers.append(nn.BatchNorm2d(out_ch))
            filters = out_ch  # 后续卷积使用新的通道数

        # 中间重复的可分离卷积（通道数不变）
        for i in range(reps - 1):
            if grow_first or i > 0:
                layers.append(nn.ReLU(inplace=True))
            layers.append(SeparableConv2d(filters, filters, 3, 1, dilation, dilation))
            layers.append(nn.BatchNorm2d(filters))

        # grow_first=False: 最后才改变通道数
        if not grow_first:
            layers.append(nn.ReLU(inplace=True))
            layers.append(SeparableConv2d(in_ch, out_ch, 3, 1, dilation, dilation))
            layers.append(nn.BatchNorm2d(out_ch))

        # 下采样：用 MaxPool 降低空间分辨率
        if stride != 1:
            layers.append(nn.MaxPool2d(3, stride, 1))

        self.block = nn.Sequential(*layers)

    def forward(self, x):
        identity = x
        out = self.block(x)
        if self.skip is not None:
            identity = self.skip(x)
        out += identity  # 残差连接：主路径 + 跳跃连接
        return out


# ==============================================================================
# 主干网络：改进版对齐 Xception-65 (Modified Aligned Xception-65)
# ==============================================================================
class Xception65(nn.Module):
    """
    DeepLab v3+ 的主干网络，基于 Xception 改进而来

    相比原始 Xception 的三处关键修改：
    1. 所有 MaxPool 替换为 stride=2 的深度可分离卷积（更平滑的下采样）
    2. Middle flow 从重复 8 次增加到 16 次（更深的网络）
    3. 每个 3x3 depthwise 卷积后都加了 BN 和 ReLU

    网络分为三部分：
    - Entry flow:  快速下采样，提取初级特征
    - Middle flow: 重复 16 次，深化语义特征
    - Exit flow:   最终特征提取，输出给 ASPP

    形状变化示例 (输入 512x512, output_stride=16):
    - 输入:  (B, 3,   512, 512)
    - conv1: (B, 32,  256, 256)   # stride=2
    - conv2: (B, 64,  256, 256)
    - block1:(B, 128, 128, 128)   # stride=2
    - block2:(B, 256,  64,  64)   # stride=2  <-- low_level_feat (1/4)
    - block3:(B, 728,  32,  32)   # stride=2
    - middle: (B, 728,  32,  32)  # 16次重复，空间不变
    - exit:  (B, 2048, 32,  32)   # 1/16，给 ASPP
    """

    def __init__(self, output_stride=16):
        super().__init__()

        # 根据 output_stride 决定膨胀率和步长策略
        # output_stride=16: 下采样到 1/16，后续用空洞卷积保持分辨率
        if output_stride == 16:
            entry_block3_stride = 2
            middle_dilation = 1
            exit_block_dilation = (1, 2)  # exit flow 的两个 block 分别用 dilation 1 和 2
        elif output_stride == 8:
            # output_stride=8: 更少下采样，更多空洞卷积
            entry_block3_stride = 1
            middle_dilation = 2
            exit_block_dilation = (2, 4)
        else:
            raise ValueError("output_stride 必须为 8 或 16")

        # -------------------- Entry flow --------------------
        # 两个标准卷积做初始特征提取和下采样
        self.conv1 = nn.Sequential(
            nn.Conv2d(3, 32, 3, 2, 1, bias=False),   # 3->32, stride=2: 512->256
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
        )
        self.conv2 = nn.Sequential(
            nn.Conv2d(32, 64, 3, 1, 1, bias=False),  # 32->64, stride=1: 256->256
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
        )

        # 三个 Xception block，逐步下采样并增加通道数
        self.block1 = XceptionBlock(64, 128, 2, 2, 1, start_with_relu=False)
        self.block2 = XceptionBlock(128, 256, 2, 2, 1, start_with_relu=True)
        self.block3 = XceptionBlock(256, 728, 2, entry_block3_stride, 1, start_with_relu=True)

        # -------------------- Middle flow --------------------
        # 重复 16 次的相同 block，深化特征表示
        # 这是 DeepLab v3+ 相比原始 Xception 的关键改动（从 8 次增加到 16 次）
        self.middle_blocks = nn.ModuleList([
            XceptionBlock(728, 728, 3, 1, middle_dilation, start_with_relu=True)
            for _ in range(16)
        ])

        # -------------------- Exit flow --------------------
        # 最后一个下采样 block + 两个空洞可分离卷积
        self.block20 = XceptionBlock(728, 1024, 2, exit_block_dilation[0],
                                     exit_block_dilation[0], start_with_relu=True)
        self.block21 = nn.Sequential(
            SeparableConv2d(1024, 1536, 3, 1, exit_block_dilation[1], exit_block_dilation[1]),
            nn.BatchNorm2d(1536),
            nn.ReLU(inplace=True),
            SeparableConv2d(1536, 1536, 3, 1, exit_block_dilation[1], exit_block_dilation[1]),
            nn.BatchNorm2d(1536),
            nn.ReLU(inplace=True),
            SeparableConv2d(1536, 2048, 3, 1, exit_block_dilation[1], exit_block_dilation[1]),
            nn.BatchNorm2d(2048),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        # Entry flow
        x = self.conv1(x)
        x = self.conv2(x)
        x = self.block1(x)
        x = self.block2(x)
        low_level_feat = x  # 保存 1/4 分辨率的底层特征，后续给 Decoder 用
        x = self.block3(x)

        # Middle flow: 16 次重复，空间分辨率不变
        for block in self.middle_blocks:
            x = block(x)

        # Exit flow
        x = self.block20(x)
        x = self.block21(x)

        return x, low_level_feat


# ==============================================================================
# ASPP: 空洞空间金字塔池化
# ==============================================================================
class ASPPConv(nn.Module):
    """
    ASPP 中的空洞卷积分支

    用指定膨胀率的 3x3 卷积扩大感受野：
    - dilation=6:  感受野约等于 13x13
    - dilation=12: 感受野约等于 25x25
    - dilation=18: 感受野约等于 37x37

    形状变化：
    - 输入: (B, 2048, H, W)
    - 输出: (B, 256, H, W)  （空间尺寸不变，通道压缩到 256）
    """

    def __init__(self, in_ch, out_ch, dilation):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=dilation, dilation=dilation, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.conv(x)


class ASPPPooling(nn.Module):
    """
    ASPP 中的图像级特征分支 (Image Pooling)

    动机：当物体很大时，空洞卷积可能只覆盖部分区域；
         全局平均池化能捕获整张图像的上下文信息。

    操作流程：
    1. 全局平均池化：将 (B, C, H, W) -> (B, C, 1, 1)
    2. 1x1 卷积压缩通道
    3. 双线性插值上采样回原始尺寸

    形状变化：
    - 输入: (B, 2048, H, W)
    - 输出: (B, 256, H, W)
    """

    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.gap = nn.AdaptiveAvgPool2d(1)  # 全局平均池化到 1x1
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        size = x.shape[2:]
        x = self.gap(x)      # (B, C, 1, 1)
        x = self.conv(x)     # (B, 256, 1, 1)
        # 上采样回原尺寸，与其他分支对齐
        x = F.interpolate(x, size=size, mode='bilinear', align_corners=False)
        return x


class ASPP(nn.Module):
    """
    空洞空间金字塔池化模块 (Atrous Spatial Pyramid Pooling)

    核心思想：用多个不同感受野的分支并行提取特征，再融合：
    1. 1x1 卷积分支：捕获局部信息（感受野 1x1）
    2. 3x3 空洞卷积 x3：分别用 dilation=6,12,18 捕获多尺度上下文
    3. 图像级池化分支：捕获全局上下文

    融合方式：5 个分支的输出在通道维度拼接 (concat)，
             再用 1x1 卷积压缩回 256 通道，最后接 Dropout 防止过拟合

    形状变化：
    - 输入: (B, 2048, 32, 32)
    - 输出: (B, 256, 32, 32)
    """

    def __init__(self, in_ch, out_ch, rates=(6, 12, 18)):
        super().__init__()
        self.branches = nn.ModuleList([
            # 分支 1: 1x1 卷积（局部信息）
            nn.Sequential(
                nn.Conv2d(in_ch, out_ch, 1, bias=False),
                nn.BatchNorm2d(out_ch),
                nn.ReLU(inplace=True),
            ),
            # 分支 2-4: 不同膨胀率的空洞卷积（多尺度上下文）
            ASPPConv(in_ch, out_ch, rates[0]),  # dilation=6
            ASPPConv(in_ch, out_ch, rates[1]),  # dilation=12
            ASPPConv(in_ch, out_ch, rates[2]),  # dilation=18
            # 分支 5: 图像级特征（全局上下文）
            ASPPPooling(in_ch, out_ch),
        ])
        # 融合 + 压缩：5 * 256 = 1280 通道 -> 256 通道
        self.project = nn.Sequential(
            nn.Conv2d(out_ch * 5, out_ch, 1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Dropout(0.5),  # 论文中使用 0.5 的 Dropout
        )

    def forward(self, x):
        outs = [branch(x) for branch in self.branches]
        x = torch.cat(outs, dim=1)  # 在通道维度拼接
        x = self.project(x)
        return x


# ==============================================================================
# 解码器 (Decoder)
# ==============================================================================
class Decoder(nn.Module):
    """
    DeepLab v3+ 的解码器模块

    为什么需要解码器？
    - ASPP 输出的是 1/16 分辨率的特征图，直接上采样到原图会很模糊
    - 解码器通过两步上采样 + 底层特征融合，恢复清晰的分割边界

    流程：
    1. 底层特征 (low_level_feat) 经过 1x1 卷积压缩到 48 通道
       （论文实验：48 通道比 64/32 效果更好）
    2. ASPP 输出上采样 4 倍，从 1/16 到 1/4
    3. 将两者在通道维度拼接
    4. 经过两个 3x3 深度可分离卷积细化特征
    5. 最后 1x1 卷积输出分类结果（此时还是 1/4 分辨率）

    形状变化示例：
    - x (ASPP 输出):           (B, 256, 32, 32)
    - low_level_feat:           (B, 256, 128, 128)
    - low_level_feat 压缩后:     (B, 48,  128, 128)
    - x 上采样后:               (B, 256, 128, 128)
    - 拼接后:                   (B, 304, 128, 128)
    - 最终输出:                 (B, 21,  128, 128)  # 1/4 分辨率
    """

    def __init__(self, num_classes, low_level_channels=48, out_ch=256):
        super().__init__()
        # 底层特征压缩：256 -> 48 通道
        self.low_level_conv = nn.Sequential(
            nn.Conv2d(256, low_level_channels, 1, bias=False),
            nn.BatchNorm2d(low_level_channels),
            nn.ReLU(inplace=True),
        )
        # 分类头：两个 3x3 深度可分离卷积 + 1x1 输出卷积
        self.classifier = nn.Sequential(
            SeparableConv2d(low_level_channels + out_ch, out_ch, 3, 1, 1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            SeparableConv2d(out_ch, out_ch, 3, 1, 1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, num_classes, 1),  # 输出每个像素的类别分数
        )

    def forward(self, x, low_level_feat):
        # 压缩底层特征通道数
        low_level_feat = self.low_level_conv(low_level_feat)
        # ASPP 输出上采样到与底层特征相同的空间尺寸
        x = F.interpolate(x, size=low_level_feat.shape[2:], mode='bilinear', align_corners=False)
        # 拼接：高层语义特征 + 底层细节特征
        x = torch.cat([x, low_level_feat], dim=1)
        # 细化并输出
        x = self.classifier(x)
        return x


# ==============================================================================
# 完整模型
# ==============================================================================
class DeepLabV3Plus(nn.Module):
    """
    DeepLab v3+ 完整模型

    前向传播流程：
    1. Backbone (Xception-65) 提取特征：
       - 得到 1/16 的高级特征 (2048 通道)
       - 得到 1/4 的底层特征 (256 通道)
    2. ASPP 对高级特征做多尺度融合 -> 256 通道
    3. Decoder 融合底层特征，细化分割 -> (B, 21, 128, 128)
    4. 最后 4 倍上采样到原图尺寸 -> (B, 21, 512, 512)

    输出说明：
    - 形状: (B, NUM_CLASSES, H, W)
    - 每个像素的值是未归一化的分数 (logits)，训练时配合 CrossEntropyLoss 使用
    - 推理时用 argmax 获取每个像素的类别
    """

    def __init__(self, num_classes=21, output_stride=16):
        super().__init__()
        self.backbone = Xception65(output_stride)
        self.aspp = ASPP(2048, ASPP_OUT_CHANNELS)
        self.decoder = Decoder(num_classes, LOW_LEVEL_CHANNELS, DECODER_CHANNELS)

    def forward(self, x):
        input_size = x.shape[2:]           # 保存输入尺寸，最后上采样用
        x, low_level_feat = self.backbone(x)  # 编码器
        x = self.aspp(x)                   # 多尺度特征融合
        x = self.decoder(x, low_level_feat)   # 解码器（输出 1/4 尺寸）
        x = F.interpolate(x, size=input_size, mode='bilinear', align_corners=False)
        return x


# ==============================================================================
# 教育演示
# ==============================================================================
if __name__ == '__main__':
    print("=" * 60)
    print("DeepLab v3+ 模型演示")
    print("=" * 60)

    # 创建模型
    model = DeepLabV3Plus(num_classes=NUM_CLASSES, output_stride=OUTPUT_STRIDE)

    # 创建虚拟输入：2张 3x512x512 的图像
    x = torch.randn(2, 3, INPUT_SIZE, INPUT_SIZE)
    print(f"\n输入张量形状: {x.shape}")
    print("  -> 含义: 2 张图像，3 个颜色通道 (RGB)，512x512 像素")

    # 前向传播（不计算梯度，节省内存）
    with torch.no_grad():
        out = model(x)

    print(f"\n输出张量形状: {out.shape}")
    print("  -> 含义: 2 张图像，21 个类别分数图，512x512 像素")
    print("  -> 每个像素有 21 个分数，对应 PASCAL VOC 的 21 个类别")

    # 计算参数量
    total_params = sum(p.numel() for p in model.parameters())
    print(f"\n模型总参数量: {total_params / 1e6:.2f}M")
    print("  -> 论文报告约 43M (Xception-65 backbone)")

    print("\n" + "=" * 60)
    print("【给读者的练习】")
    print("=" * 60)
    print("""
1. 修改 NUM_CLASSES = 2，做一个简单的二分类分割（前景/背景）。
2. 修改 OUTPUT_STRIDE = 8，观察特征图分辨率如何变化。
3. 将 backbone 换成 ResNet-101（需要自行实现或调用 torchvision）。
4. 在 Decoder 中增加一个上采样步骤，尝试一步从 1/16 直接到原图尺寸，
   对比两步上采样（1/16 -> 1/4 -> 原图）的分割边界质量。
5. 尝试将 SeparableConv2d 替换为普通 Conv2d，观察参数量变化。
""")
