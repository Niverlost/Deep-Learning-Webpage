"""
YOLOv3: An Incremental Improvement
Joseph Redmon, Ali Farhadi, 2018

初学者教程版 - YOLOv3 目标检测网络

YOLOv3 是什么？
----------------
YOLO (You Only Look Once) 是一种单阶段目标检测算法。与两阶段检测器（如 Faster R-CNN）
不同，YOLO 将检测问题转化为回归问题，一次性预测所有边界框的位置、置信度和类别概率。

YOLOv3 相比前代的改进：
1. 使用 Darknet-53 作为主干网络，引入残差连接（借鉴 ResNet）
2. 多尺度预测（借鉴 FPN）：在 3 个不同尺度上检测目标
3. 使用逻辑回归预测置信度，而非 softmax 分类
4. 更好的小目标检测能力

关键概念
--------
- Anchor（先验框）：通过 K-means 聚类得到的预设框，帮助网络更容易学习
- 多尺度检测：大特征图检测小物体，小特征图检测大物体
- 残差连接：缓解深层网络的梯度消失问题
"""

import torch
import torch.nn as nn


# ==============================================================================
# 配置常量
# ==============================================================================
C = 80               # COCO 数据集类别数
B = 3                # 每个格子预测的 anchor 数量
INPUT_SIZE = 416     # 输入图像尺寸（论文常用 416x416 或 608x608）
S_LIST = [13, 26, 52]  # 三个尺度的特征图大小（对应 416 输入）

# COCO 数据集上通过 K-means 聚类得到的 9 个先验框（w, h）
# 按尺度分组：前3个大框对应小特征图（检测大物体），中间3个对应中特征图，后3个对应大特征图
ANCHORS = [
    [116, 90], [156, 198], [373, 326],   # 13x13 特征图使用（大物体）
    [30, 61], [62, 45], [59, 119],       # 26x26 特征图使用（中物体）
    [10, 13], [16, 30], [33, 23],        # 52x52 特征图使用（小物体）
]


# ==============================================================================
# 基础模块
# ==============================================================================
class ConvBlock(nn.Module):
    """
    YOLOv3 的基础卷积块：Conv + BatchNorm + LeakyReLU

    为什么使用 LeakyReLU(0.1) 而不是 ReLU？
    - 论文作者发现 LeakyReLU 在深层网络中表现更稳定
    - 负值区域保留小梯度，避免神经元"死亡"

    为什么使用 BatchNorm？
    - 从 YOLOv2 开始引入，加速收敛，减少对初始化的敏感
    """
    def __init__(self, in_ch, out_ch, kernel_size, stride=1, padding=0):
        super().__init__()
        self.conv = nn.Conv2d(in_ch, out_ch, kernel_size, stride, padding, bias=False)
        self.bn = nn.BatchNorm2d(out_ch)
        self.act = nn.LeakyReLU(0.1, inplace=True)

    def forward(self, x):
        return self.act(self.bn(self.conv(x)))


class ResidualBlock(nn.Module):
    """
    残差块：Darknet-53 的核心组件（借鉴 ResNet）

    结构：
        输入 ──┬──> 1x1 Conv（降维）──> 3x3 Conv（升维）──> 相加 ──> 输出
             └──> 跳跃连接 ─────────────────────────────────┘

    为什么使用残差连接？
    - Darknet-53 有 53 层卷积，非常深
    - 残差连接让梯度可以直接回传，缓解梯度消失
    - 网络可以学习"恒等映射"，至少不会比浅层网络差

    通道变化：
        输入: in_ch ──> 1x1 Conv ──> hidden_ch ──> 3x3 Conv ──> in_ch ──> 输出: in_ch
    """
    def __init__(self, in_ch, hidden_ch):
        super().__init__()
        # 1x1 卷积降维：减少计算量，同时增加非线性
        self.conv1 = ConvBlock(in_ch, hidden_ch, 1)
        # 3x3 卷积升维：恢复通道数，提取空间特征
        self.conv2 = ConvBlock(hidden_ch, in_ch, 3, padding=1)

    def forward(self, x):
        residual = x          # 保存输入用于跳跃连接
        out = self.conv1(x)   # 降维到 hidden_ch
        out = self.conv2(out) # 升维回 in_ch
        return out + residual # 残差相加（关键！）


# ==============================================================================
# 主干网络：Darknet-53
# ==============================================================================
class Darknet53(nn.Module):
    """
    Darknet-53：YOLOv3 的特征提取主干网络

    为什么叫 Darknet-53？
    - 总共有 53 层可训练卷积层（不含 BatchNorm 和激活层）
    - 由 YOLOv2 的 Darknet-19 进化而来，更深更强大

    结构（5 个阶段）：
    ┌─────────────────────────────────────────────────────────────┐
    │  输入: 3x416x416                                            │
    │  ├──> Conv(3, 32, 3x3) ──> 32x416x416                      │
    │  ├──> Layer1: 下采样 + 1x Residual  ──> 64x208x208         │
    │  ├──> Layer2: 下采样 + 2x Residual  ──> 128x104x104        │
    │  ├──> Layer3: 下采样 + 8x Residual  ──> 256x52x52   ◄── 小物体检测分支
    │  ├──> Layer4: 下采样 + 8x Residual  ──> 512x26x26   ◄── 中物体检测分支
    │  └──> Layer5: 下采样 + 4x Residual  ──> 1024x13x13  ◄── 大物体检测分支
    └─────────────────────────────────────────────────────────────┘

    注意：YOLOv3 没有使用全连接层和池化层，全部使用卷积 + stride=2 下采样
    """
    def __init__(self):
        super().__init__()
        # 初始卷积：3 通道 RGB 图像 -> 32 通道特征图
        self.conv1 = ConvBlock(3, 32, 3, padding=1)

        # 5 个阶段，每个阶段先下采样，然后堆叠残差块
        # 参数: (输入通道, 输出通道, 残差块数量)
        self.layer1 = self._make_layer(32, 64, 1)     # 208x208
        self.layer2 = self._make_layer(64, 128, 2)    # 104x104
        self.layer3 = self._make_layer(128, 256, 8)   # 52x52
        self.layer4 = self._make_layer(256, 512, 8)   # 26x26
        self.layer5 = self._make_layer(512, 1024, 4)  # 13x13

    def _make_layer(self, in_ch, out_ch, num_blocks):
        """
        构建一个阶段：
        1. 下采样卷积（stride=2）：空间尺寸减半，通道数翻倍
        2. 堆叠 num_blocks 个残差块
        """
        layers = [ConvBlock(in_ch, out_ch, 3, stride=2, padding=1)]
        for _ in range(num_blocks):
            layers.append(ResidualBlock(out_ch, out_ch // 2))
        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.conv1(x)      # 32x416x416
        x = self.layer1(x)     # 64x208x208
        x = self.layer2(x)     # 128x104x104
        out3 = self.layer3(x)  # 256x52x52   ──> 用于小物体检测
        out4 = self.layer4(out3)  # 512x26x26 ──> 用于中物体检测
        out5 = self.layer5(out4)  # 1024x13x13 ──> 用于大物体检测
        return out3, out4, out5


# ==============================================================================
# 检测头：YOLO Head（官方结构）
# ==============================================================================
class YOLOHead(nn.Module):
    """
    YOLO 检测头：将特征图转换为检测结果

    官方 cfg 文件结构（以 1024 通道输入为例）：
        1x1 Conv(1024->512) -> 3x3 Conv(512->1024)
        -> 1x1 Conv(1024->512) -> 3x3 Conv(512->1024)
        -> 1x1 Conv(1024->512) -> 3x3 Conv(512->1024)
        -> 1x1 Conv(1024->255) 线性输出

    输出通道数 = B * (5 + C) = 3 * 85 = 255
    - B=3：每个格子预测 3 个 anchor
    - 5：tx, ty, tw, th（4 个坐标偏移）+ objectness（1 个置信度）
    - C=80：COCO 80 个类别的概率

    为什么坐标用偏移量而不是绝对值？
    - 网络更容易学习小的偏移量
    - 结合 anchor 的先验信息，收敛更快
    """
    def __init__(self, in_ch, num_classes):
        super().__init__()
        out_ch = B * (5 + num_classes)  # 255 for COCO
        hid = in_ch // 2

        # 6 层卷积：交替使用 1x1 降维和 3x3 提取空间特征
        self.conv1 = ConvBlock(in_ch, hid, 1)           # 降维
        self.conv2 = ConvBlock(hid, in_ch, 3, padding=1)  # 升维+空间融合
        self.conv3 = ConvBlock(in_ch, hid, 1)           # 降维
        self.conv4 = ConvBlock(hid, in_ch, 3, padding=1)  # 升维+空间融合
        self.conv5 = ConvBlock(in_ch, hid, 1)           # 降维
        self.conv6 = ConvBlock(hid, in_ch, 3, padding=1)  # 升维+空间融合（分支输出）
        # 最终输出层：1x1 卷积，无激活（线性输出）
        self.conv_out = nn.Conv2d(in_ch, out_ch, 1)

    def forward(self, x):
        x = self.conv1(x)
        x = self.conv2(x)
        x = self.conv3(x)
        x = self.conv4(x)
        x = self.conv5(x)
        branch = self.conv6(x)   # 用于上采样的分支（通道数 = in_ch）
        out = self.conv_out(branch)  # 检测结果输出
        return out, branch


# ==============================================================================
# 上采样模块（FPN 特征金字塔）
# ==============================================================================
class UpsampleBlock(nn.Module):
    """
    上采样 + 通道调整模块

    为什么需要上采样？
    - YOLOv3 借鉴了 FPN（特征金字塔网络）的思想
    - 深层特征（小特征图）语义信息丰富，但位置信息粗糙
    - 浅层特征（大特征图）位置信息精确，但语义信息较弱
    - 通过上采样将深层特征与浅层特征融合，兼顾语义和位置

    操作步骤：
    1. 1x1 卷积调整通道数（减少计算量）
    2. 最近邻插值上采样 2 倍（空间尺寸翻倍）
    """
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv = ConvBlock(in_ch, out_ch, 1)
        self.upsample = nn.Upsample(scale_factor=2, mode="nearest")

    def forward(self, x):
        x = self.conv(x)
        x = self.upsample(x)
        return x


# ==============================================================================
# 完整模型：YOLOv3
# ==============================================================================
class YOLOv3(nn.Module):
    """
    YOLOv3 完整网络

    前向传播流程：
    ┌─────────────────────────────────────────────────────────────────────┐
    │  输入图像: (B, 3, 416, 416)                                         │
    │                                                                     │
    │  ┌───────────────────────────────────────────────────────────────┐  │
    │  │ Backbone: Darknet-53                                          │  │
    │  │  └──> 输出 3 个尺度特征图                                      │  │
    │  │      out3: 256x52x52  (stride=8)                              │  │
    │  │      out4: 512x26x26  (stride=16)                             │  │
    │  │      out5: 1024x13x13 (stride=32)                             │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │  ┌───────────────────────────────────────────────────────────────┐  │
    │  │ 大物体检测分支 (13x13)                                         │  │
    │  │  out5(1024) ──> YOLOHead(1024) ──> out_large: (B,255,13,13)  │  │
    │  │                    └──> branch_large: 1024x13x13              │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │  ┌───────────────────────────────────────────────────────────────┐  │
    │  │ 中物体检测分支 (26x26)                                         │  │
    │  │  branch_large(1024) ──> Upsample(1024->256) ──> 256x26x26    │  │
    │  │      + out4(512x26x26) ──> concat ──> 768x26x26              │  │
    │  │      ──> YOLOHead(768) ──> out_medium: (B,255,26,26)         │  │
    │  │                    └──> branch_medium: 768x26x26              │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │  ┌───────────────────────────────────────────────────────────────┐  │
    │  │ 小物体检测分支 (52x52)                                         │  │
    │  │  branch_medium(768) ──> Upsample(768->128) ──> 128x52x52     │  │
    │  │      + out3(256x52x52) ──> concat ──> 384x52x52              │  │
    │  │      ──> YOLOHead(384) ──> out_small: (B,255,52,52)          │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │  输出: (out_large, out_medium, out_small)                           │
    └─────────────────────────────────────────────────────────────────────┘

    多尺度检测的优势：
    - 13x13：感受野大，适合检测大物体（如大象、沙发）
    - 26x26：感受野中等，适合检测中等物体（如狗、自行车）
    - 52x52：感受野小，适合检测小物体（如鸟、手机）
    """
    def __init__(self, num_classes=C):
        super().__init__()
        self.num_classes = num_classes
        self.backbone = Darknet53()

        # 三个检测头，分别处理不同尺度
        # 输入通道数 = concat 后的总通道数
        self.head_large = YOLOHead(1024, num_classes)   # 13x13，大物体
        self.upsample1 = UpsampleBlock(1024, 256)        # 上采样到 26x26

        self.head_medium = YOLOHead(768, num_classes)   # 26x26，中物体
        self.upsample2 = UpsampleBlock(768, 128)         # 上采样到 52x52

        self.head_small = YOLOHead(384, num_classes)    # 52x52，小物体

    def forward(self, x):
        # 主干网络提取三个尺度的特征
        out3, out4, out5 = self.backbone(x)

        # 大物体检测：13x13
        out_large, branch_large = self.head_large(out5)

        # 中物体检测：26x26
        x1 = self.upsample1(branch_large)      # 1024x13x13 -> 256x26x26
        x1 = torch.cat([x1, out4], dim=1)      # 256 + 512 = 768 通道
        out_medium, branch_medium = self.head_medium(x1)

        # 小物体检测：52x52
        x2 = self.upsample2(branch_medium)     # 768x26x26 -> 128x52x52
        x2 = torch.cat([x2, out3], dim=1)      # 128 + 256 = 384 通道
        out_small, _ = self.head_small(x2)

        return out_large, out_medium, out_small


# ==============================================================================
# 教学演示
# ==============================================================================
if __name__ == "__main__":
    print("=" * 60)
    print("YOLOv3 模型结构演示")
    print("=" * 60)

    # 创建模型
    model = YOLOv3(num_classes=80)

    # 创建模拟输入：batch=1, 3通道, 416x416
    x = torch.randn(1, 3, 416, 416)
    print(f"\n输入图像尺寸: {x.shape}")
    print("  含义: 1 张图片, 3 个 RGB 通道, 416x416 像素")

    # 前向传播
    out_large, out_medium, out_small = model(x)

    print("\n输出特征图（三个尺度）：")
    print(f"  大物体检测 (13x13): {out_large.shape}")
    print(f"    含义: 13x13 个格子, 每个格子预测 3 个 anchor")
    print(f"    每个 anchor 预测: 4 坐标 + 1 置信度 + 80 类别 = 85 个值")
    print(f"    总通道: 3 x 85 = 255")

    print(f"\n  中物体检测 (26x26): {out_medium.shape}")
    print(f"    含义: 26x26 个格子, 同样每个格子 3 个 anchor")

    print(f"\n  小物体检测 (52x52): {out_small.shape}")
    print(f"    含义: 52x52 个格子, 适合检测小物体")

    # 计算总参数量
    total_params = sum(p.numel() for p in model.parameters())
    print(f"\n模型总参数量: {total_params:,}")
    print(f"  约 {total_params / 1e6:.1f}M（论文报告约 62M for YOLOv3-608）")

    # 计算总预测框数量
    total_boxes = sum(s * s * B for s in S_LIST)
    print(f"\n总预测框数量: {total_boxes}")
    print(f"  13x13: {13*13*3} 个")
    print(f"  26x26: {26*26*3} 个")
    print(f"  52x52: {52*52*3} 个")

    print("\n" + "=" * 60)
    print("练习建议：")
    print("=" * 60)
    print("1. 尝试修改 INPUT_SIZE 为 608，观察输出特征图尺寸变化")
    print("2. 修改 num_classes 为你自己的数据集类别数")
    print("3. 打印 model 的每一层，观察通道数变化")
    print("4. 思考：为什么小物体检测使用大特征图（52x52）？")
    print("   答案：大特征图保留更多空间细节，适合定位小物体")
    print("=" * 60)
