"""
SSD: Single Shot MultiBox Detector
Wei Liu, Dragomir Anguelov, Dumitru Erhan, Christian Szegedy, Scott Reed, Cheng-Yang Fu, Alexander C. Berg
ECCV 2016
arXiv: https://arxiv.org/abs/1512.02325

================================================================================
【这是什么？】
SSD 是一种"单阶段"目标检测模型。传统的目标检测（如 R-CNN 系列）需要分两步：
先找出可能包含物体的区域（候选框），再对每个区域进行分类。而 SSD 只用
一个神经网络的前向传播，就能同时预测"物体在哪里"和"物体是什么"，因此
速度非常快，适合实时应用。

【核心思想】
1. 多尺度特征图检测：在不同分辨率的特征图上同时预测，小特征图检测大物体，
   大特征图检测小物体。
2. 默认框（Default Boxes / Anchor）：在每个特征图的每个位置预先定义一组
   不同形状和大小的框，网络只需要预测"真实框相对于默认框的偏移"。
3. 卷积预测：直接用 3x3 卷积在特征图上预测位置和类别，不需要全连接层。
================================================================================
"""

import torch
import torch.nn as nn


# ------------------------------------------------------------------------------
# 配置常量（与论文完全一致）
# ------------------------------------------------------------------------------

INPUT_SIZE = 300          # 输入图像尺寸：300x300 像素
NUM_CLASSES = 21          # VOC 数据集：20 个物体类别 + 1 个背景类

# 6 个特征图的空间分辨率（从高分辨率到低分辨率）
# 分辨率越高，感受野越小，适合检测小物体；分辨率越低，感受野越大，适合检测大物体
FEATURE_MAPS = [38, 19, 10, 5, 3, 1]

# 默认框的最小和最大尺度（单位：像素，相对于 300x300 输入）
# 论文公式：s_k = s_min + (s_max - s_min) * (k - 1) / (m - 1)
MIN_SIZES = [30, 60, 111, 162, 213, 264]
MAX_SIZES = [60, 111, 162, 213, 264, 315]

# 每个特征图使用的长宽比（1 默认始终存在，额外添加 sqrt(s_k * s_{k+1}) 的框）
ASPECT_RATIOS = [[2], [2, 3], [2, 3], [2, 3], [2], [2]]

# 每个位置预测的默认框数量
# 例如：conv4_3 只有 ratio=2（即 1:2 和 2:1），加上 ratio=1，共 4 个框
NUM_ANCHORS = [4, 6, 6, 6, 4, 4]

# conv4_3 特征图的 L2 归一化缩放因子（论文中设为 20）
# 因为 conv4_3 的数值尺度与其他层不同，需要归一化
L2NORM_SCALE = 20


# ------------------------------------------------------------------------------
# 关键概念：L2 归一化
# ------------------------------------------------------------------------------
# 论文发现 conv4_3 特征图的数值尺度与其他层不同（大约 20 倍左右）。
# 如果不做处理，会导致训练不稳定。因此引入可学习的 L2 归一化层，
# 先对每个通道做 L2 归一化，再乘以一个可学习的缩放系数。
# ------------------------------------------------------------------------------

class L2Norm(nn.Module):
    """
    对通道维度进行 L2 归一化，然后乘以可学习的缩放系数。

    输入: (B, C, H, W)
    输出: (B, C, H, W) — 每个通道的 L2 范数被归一化为 1，再乘以 gamma
    """
    def __init__(self, n_channels, scale):
        super().__init__()
        self.n_channels = n_channels
        self.gamma = scale          # 初始缩放值
        self.eps = 1e-10            # 防止除零
        # 可学习的缩放参数，形状为 (C,)，每个通道一个缩放值
        self.weight = nn.Parameter(torch.Tensor(n_channels))
        nn.init.constant_(self.weight, self.gamma)

    def forward(self, x):
        # 计算每个像素位置在所有通道上的 L2 范数
        # norm: (B, 1, H, W)
        norm = x.pow(2).sum(dim=1, keepdim=True).sqrt() + self.eps
        # 归一化
        x = x / norm
        # 乘以可学习的缩放系数 (1, C, 1, 1)
        out = self.weight.view(1, -1, 1, 1) * x
        return out


# ------------------------------------------------------------------------------
# 主干网络：VGG-16（修改版）
# ------------------------------------------------------------------------------
# 论文使用 VGG-16 作为特征提取器，但做了以下修改：
# 1. 保留到 conv4_3，去掉原来的全连接层
# 2. conv5 的池化从 stride=2 改为 stride=2（保持 19x19）
# 3. 原来的 fc6、fc7 改为卷积层：fc6 用 3x3 空洞卷积 (dilation=6)，fc7 用 1x1
# ------------------------------------------------------------------------------

class VGGBase(nn.Module):
    """
    VGG-16 修改版主干网络。

    输入: (B, 3, 300, 300)
    输出: conv4_3 (B, 512, 38, 38), conv7 (B, 1024, 19, 19)
    """
    def __init__(self):
        super().__init__()
        # ---------- Stage 1: conv1_1 - conv1_2 ----------
        # 输入: 3 通道 300x300，输出: 64 通道 150x150
        self.conv1 = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),  # 300 -> 150
        )

        # ---------- Stage 2: conv2_1 - conv2_2 ----------
        # 输入: 64 通道 150x150，输出: 128 通道 75x75
        self.conv2 = nn.Sequential(
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),  # 150 -> 75
        )

        # ---------- Stage 3: conv3_1 - conv3_3 ----------
        # 输入: 128 通道 75x75，输出: 256 通道 38x38
        # 注意：这里使用 ceil_mode=True，因为 75/2 = 37.5，向上取整为 38
        self.conv3 = nn.Sequential(
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2, ceil_mode=True),  # 75 -> 38
        )

        # ---------- Stage 4: conv4_1 - conv4_3 ----------
        # 输入: 256 通道 38x38，输出: 512 通道 38x38（不池化，保留分辨率）
        self.conv4 = nn.Sequential(
            nn.Conv2d(256, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )

        # ---------- Stage 5: conv5_1 - conv5_3 ----------
        # 先池化到 19x19，然后继续卷积
        # 输入: 512 通道 38x38，输出: 512 通道 19x19
        self.conv5 = nn.Sequential(
            nn.MaxPool2d(kernel_size=2, stride=2),  # 38 -> 19
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )

        # ---------- fc6 和 fc7（改为卷积层）----------
        # fc6: 3x3 空洞卷积 (dilation=6)，模拟原来的全连接层感受野
        # 输入: 512 通道 19x19，输出: 1024 通道 19x19
        self.fc6 = nn.Sequential(
            nn.MaxPool2d(kernel_size=3, stride=1, padding=1),  # 保持 19x19
            nn.Conv2d(512, 1024, kernel_size=3, padding=6, dilation=6),
            nn.ReLU(inplace=True),
        )
        # fc7: 1x1 卷积，降维/整合特征
        # 输入: 1024 通道 19x19，输出: 1024 通道 19x19
        self.fc7 = nn.Sequential(
            nn.Conv2d(1024, 1024, kernel_size=1),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        x = self.conv1(x)      # (B, 64, 150, 150)
        x = self.conv2(x)      # (B, 128, 75, 75)
        x = self.conv3(x)      # (B, 256, 38, 38)
        conv4_3 = self.conv4(x)  # (B, 512, 38, 38)  ← 第一个检测特征图
        x = self.conv5(conv4_3)  # (B, 512, 19, 19)
        x = self.fc6(x)        # (B, 1024, 19, 19)
        conv7 = self.fc7(x)    # (B, 1024, 19, 19)  ← 第二个检测特征图
        return conv4_3, conv7


# ------------------------------------------------------------------------------
# 额外特征层（Extra Feature Layers）
# ------------------------------------------------------------------------------
# 在 VGG 之后，论文添加了 4 组额外的卷积层，逐步降低空间分辨率，
# 从而在不同尺度上检测物体。每组包含 1x1（降维）+ 3x3（提取特征+下采样）。
# ------------------------------------------------------------------------------

class ExtraLayers(nn.Module):
    """
    额外特征层：conv8_2, conv9_2, conv10_2, conv11_2

    输入: conv7 (B, 1024, 19, 19)
    输出: 4 个特征图，分辨率分别为 10x10, 5x5, 3x3, 1x1
    """
    def __init__(self):
        super().__init__()
        # ---------- conv8: 19x19 -> 10x10 ----------
        # 先用 1x1 降维到 256，再用 3x3(s=2) 提取特征并下采样
        self.conv8 = nn.Sequential(
            nn.Conv2d(1024, 256, kernel_size=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 512, kernel_size=3, stride=2, padding=1),
            nn.ReLU(inplace=True),
        )

        # ---------- conv9: 10x10 -> 5x5 ----------
        self.conv9 = nn.Sequential(
            nn.Conv2d(512, 128, kernel_size=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 256, kernel_size=3, stride=2, padding=1),
            nn.ReLU(inplace=True),
        )

        # ---------- conv10: 5x5 -> 3x3 ----------
        # 注意：这里 stride=1, padding=0，所以 5-3+1 = 3
        self.conv10 = nn.Sequential(
            nn.Conv2d(256, 128, kernel_size=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 256, kernel_size=3, stride=1, padding=0),
            nn.ReLU(inplace=True),
        )

        # ---------- conv11: 3x3 -> 1x1 ----------
        # stride=1, padding=0，所以 3-3+1 = 1
        self.conv11 = nn.Sequential(
            nn.Conv2d(256, 128, kernel_size=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 256, kernel_size=3, stride=1, padding=0),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        conv8_2 = self.conv8(x)    # (B, 512, 10, 10)   ← 第三个检测特征图
        conv9_2 = self.conv9(conv8_2)  # (B, 256, 5, 5)  ← 第四个检测特征图
        conv10_2 = self.conv10(conv9_2)  # (B, 256, 3, 3) ← 第五个检测特征图
        conv11_2 = self.conv11(conv10_2)  # (B, 256, 1, 1) ← 第六个检测特征图
        return conv8_2, conv9_2, conv10_2, conv11_2


# ------------------------------------------------------------------------------
# 检测头（Detection Head）
# ------------------------------------------------------------------------------
# 在每个特征图的每个位置上，我们需要预测：
# 1. 位置偏移 (loc): 默认框中心点的 (dx, dy) 和宽高 (dw, dh)，共 4 个值
# 2. 类别置信度 (conf): 每个类别的分数，共 num_classes 个值
#
# 这些预测通过 3x3 卷积直接完成，不经过全连接层。
# ------------------------------------------------------------------------------

class DetectionHead(nn.Module):
    """
    单个特征图的检测头。

    参数:
        in_channels: 输入特征图的通道数
        num_anchors: 该特征图每个位置的默认框数量
        num_classes: 类别数（包括背景）

    输入: (B, in_channels, H, W)
    输出: loc (B, num_anchors*4, H, W), conf (B, num_anchors*num_classes, H, W)
    """
    def __init__(self, in_channels, num_anchors, num_classes):
        super().__init__()
        # 位置预测：每个默认框预测 4 个偏移量
        self.loc = nn.Conv2d(in_channels, num_anchors * 4, kernel_size=3, padding=1)
        # 类别预测：每个默认框预测 num_classes 个分数
        self.conf = nn.Conv2d(in_channels, num_anchors * num_classes, kernel_size=3, padding=1)

    def forward(self, x):
        loc = self.loc(x)
        conf = self.conf(x)
        return loc, conf


# ------------------------------------------------------------------------------
# 完整的 SSD300 模型
# ------------------------------------------------------------------------------

class SSD300(nn.Module):
    """
    SSD300 完整模型。

    前向传播流程：
    1. 输入图像 (B, 3, 300, 300)
    2. VGG 主干提取 conv4_3 (38x38) 和 conv7 (19x19)
    3. 对 conv4_3 做 L2 归一化
    4. 额外特征层生成 conv8_2 (10x10), conv9_2 (5x5), conv10_2 (3x3), conv11_2 (1x1)
    5. 在 6 个特征图上分别用检测头预测位置和类别
    6. 将所有预测结果拼接，输出 (B, 8732, 4) 和 (B, 8732, num_classes)
    """
    def __init__(self, num_classes=NUM_CLASSES):
        super().__init__()
        self.num_classes = num_classes

        # 主干网络
        self.vgg = VGGBase()
        # L2 归一化（只对 conv4_3）
        self.l2norm = L2Norm(512, L2NORM_SCALE)
        # 额外特征层
        self.extras = ExtraLayers()

        # 检测头：为 6 个特征图分别定义 loc 和 conf 层
        # 通道数依次为: conv4_3(512), conv7(1024), conv8_2(512), conv9_2(256), conv10_2(256), conv11_2(256)
        self.loc_layers = nn.ModuleList([
            nn.Conv2d(512,  NUM_ANCHORS[0] * 4, kernel_size=3, padding=1),  # conv4_3
            nn.Conv2d(1024, NUM_ANCHORS[1] * 4, kernel_size=3, padding=1),  # conv7
            nn.Conv2d(512,  NUM_ANCHORS[2] * 4, kernel_size=3, padding=1),  # conv8_2
            nn.Conv2d(256,  NUM_ANCHORS[3] * 4, kernel_size=3, padding=1),  # conv9_2
            nn.Conv2d(256,  NUM_ANCHORS[4] * 4, kernel_size=3, padding=1),  # conv10_2
            nn.Conv2d(256,  NUM_ANCHORS[5] * 4, kernel_size=3, padding=1),  # conv11_2
        ])
        self.conf_layers = nn.ModuleList([
            nn.Conv2d(512,  NUM_ANCHORS[0] * num_classes, kernel_size=3, padding=1),
            nn.Conv2d(1024, NUM_ANCHORS[1] * num_classes, kernel_size=3, padding=1),
            nn.Conv2d(512,  NUM_ANCHORS[2] * num_classes, kernel_size=3, padding=1),
            nn.Conv2d(256,  NUM_ANCHORS[3] * num_classes, kernel_size=3, padding=1),
            nn.Conv2d(256,  NUM_ANCHORS[4] * num_classes, kernel_size=3, padding=1),
            nn.Conv2d(256,  NUM_ANCHORS[5] * num_classes, kernel_size=3, padding=1),
        ])

    def forward(self, x):
        # ---------- 主干特征提取 ----------
        conv4_3, conv7 = self.vgg(x)
        # conv4_3 数值尺度大，需要归一化
        conv4_3 = self.l2norm(conv4_3)  # (B, 512, 38, 38)

        # ---------- 额外特征层 ----------
        conv8_2, conv9_2, conv10_2, conv11_2 = self.extras(conv7)
        # conv8_2:  (B, 512, 10, 10)
        # conv9_2:  (B, 256, 5, 5)
        # conv10_2: (B, 256, 3, 3)
        # conv11_2: (B, 256, 1, 1)

        # 收集 6 个检测特征图
        features = [conv4_3, conv7, conv8_2, conv9_2, conv10_2, conv11_2]

        # ---------- 在每个特征图上预测 ----------
        loc_list = []
        conf_list = []
        for feat, loc_layer, conf_layer in zip(features, self.loc_layers, self.conf_layers):
            # loc:  (B, num_anchors*4, H, W)
            # conf: (B, num_anchors*num_classes, H, W)
            loc = loc_layer(feat)
            conf = conf_layer(feat)

            # 调整维度顺序：(B, C, H, W) -> (B, H, W, C)
            # 这样更容易 reshape 为 (B, H*W*num_anchors, ...)
            loc = loc.permute(0, 2, 3, 1).contiguous()
            conf = conf.permute(0, 2, 3, 1).contiguous()

            loc_list.append(loc)
            conf_list.append(conf)

        # ---------- 拼接所有预测 ----------
        # 每个元素 reshape 为 (B, num_positions*num_anchors, 4) 或 (..., num_classes)
        loc = torch.cat([o.view(o.size(0), -1, 4) for o in loc_list], dim=1)
        conf = torch.cat([o.view(o.size(0), -1, self.num_classes) for o in conf_list], dim=1)

        return loc, conf


# ==============================================================================
# 教育演示
# ==============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("SSD300 模型前向传播演示")
    print("=" * 70)

    # 创建模型
    model = SSD300(num_classes=21)

    # 模拟输入：2 张 300x300 的 RGB 图像
    x = torch.randn(2, 3, 300, 300)
    print(f"\n【输入】图像张量形状: {x.shape}")
    print("        含义: 2 张图片，3 个颜色通道，300x300 像素")

    # 前向传播
    loc, conf = model(x)

    print(f"\n【输出】")
    print(f"  位置预测 (loc):   {loc.shape}")
    print(f"    含义: 每张图片预测 {loc.shape[1]} 个默认框，每个框 4 个偏移量 (cx, cy, w, h)")
    print(f"  类别预测 (conf):  {conf.shape}")
    print(f"    含义: 每张图片预测 {conf.shape[1]} 个默认框，每个框 {conf.shape[2]} 个类别的分数")

    # 计算总参数量
    total_params = sum(p.numel() for p in model.parameters())
    print(f"\n【模型规模】总参数量: {total_params:,} (~{total_params / 1e6:.1f}M)")
    print("  论文报告 SSD300-VGG16 约 26M 参数")

    # 验证默认框总数
    num_anchors = sum(f * f * a for f, a in zip(FEATURE_MAPS, NUM_ANCHORS))
    print(f"\n【默认框统计】")
    print(f"  总默认框数: {num_anchors}")
    print(f"  各层贡献:")
    for i, (f, a) in enumerate(zip(FEATURE_MAPS, NUM_ANCHORS)):
        count = f * f * a
        print(f"    特征图 {i+1}: {f}x{f} × {a} 个框 = {count} 个")
    assert loc.size(1) == num_anchors, f"期望 {num_anchors} 个框，实际得到 {loc.size(1)}"
    print(f"  验证通过！")

    print("\n" + "=" * 70)
    print("【思考题 / 练习】")
    print("=" * 70)
    print("""
1. 为什么 SSD 需要在多个尺度的特征图上检测？
   提示：考虑小物体和大物体在不同分辨率特征图上的表现。

2. 修改 NUM_CLASSES 为 81（COCO 数据集），观察参数量如何变化。
   提示：主要是 conf 层的参数量变化。

3. 尝试将 conv10_2 和 conv11_2 的 stride 改为 2，观察输出形状。
   思考：这对检测性能可能有什么影响？

4. L2Norm 层中的 self.weight 是可学习的，它的作用是什么？
   提示：如果所有通道都使用相同的缩放值，会有什么问题？
""")
