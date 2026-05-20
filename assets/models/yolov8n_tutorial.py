"""
YOLOv8-N (Nano) 目标检测模型 - 初学者教程版
论文: Ultralytics YOLOv8
作者: Glenn Jocher, Ayush Chaurasia, Jing Qiu
年份: 2023
链接: https://github.com/ultralytics/ultralytics

本文件是面向初学者和学生的教学版本，包含详细的注释和解释。

================================================================================
模型简介
================================================================================
YOLOv8 是 Ultralytics 公司于 2023 年推出的目标检测模型，是 YOLO 系列的重大更新。
与之前版本相比，YOLOv8 的主要改进包括：

1. C2f 模块: 替代 C3 模块，增强特征融合能力
2. Anchor-Free 设计: 不再需要预定义锚框，直接预测目标中心点和宽高
3. 解耦头 (Decoupled Head): 分类和回归任务使用独立的检测头
4. 分布焦点损失 (DFL): 将边界框坐标建模为概率分布，提高回归精度

================================================================================
关键概念
================================================================================
- Backbone (骨干网络): 负责从输入图像中提取多尺度特征
- Neck (颈部网络): 使用 PANet 进行特征融合，结合高层语义和低层空间信息
- Head (检测头): 输出最终的分类概率和边界框坐标
- CSP (Cross Stage Partial): 跨阶段部分连接，减少计算量同时保持精度
- FPN (Feature Pyramid Network): 自顶向下的特征金字塔，融合多尺度特征
"""

import torch
import torch.nn as nn


# ------------------------------------------------------------------------------
# 配置常量
# ------------------------------------------------------------------------------
NC = 80              # 类别数量 (COCO 数据集有 80 个类别)
INPUT_SIZE = 640     # 输入图像尺寸 (640x640)
REG_MAX = 16         # DFL (Distribution Focal Loss) 的通道数

# YOLOv8n 的深度和宽度缩放因子
# n (nano) 是最小的版本，通过减小深度和宽度来减少参数量
DEPTH_MULTIPLE = 0.33   # 深度因子: 控制模块重复次数 (如 C2f 中的 Bottleneck 数量)
WIDTH_MULTIPLE = 0.25   # 宽度因子: 控制通道数
MAX_CHANNELS = 1024     # 最大通道数限制

# 各阶段的基础通道数 (在应用宽度缩放之前)
BASE_CHANNELS = [64, 128, 256, 512, 1024]

# Backbone 中各阶段 C2f 模块的重复次数 (在应用深度缩放之前)
BACKBONE_REPEATS = [3, 6, 6, 3]  # P2, P3, P4, P5 阶段的重复次数

# Neck 中 C2f 模块的重复次数
NECK_REPEATS = [3, 3, 3]


def make_divisible(v, divisor=8, min_value=None):
    """
    确保通道数能被 divisor 整除。
    原因: 硬件加速器 (如 GPU/TPU) 对特定对齐的通道数更高效。
    """
    if min_value is None:
        min_value = divisor
    new_v = max(min_value, int(v + divisor / 2) // divisor * divisor)
    if new_v < 0.9 * v:
        new_v += divisor
    return new_v


def autopad(k, p=None, d=1):
    """
    自动计算填充大小，使得 stride=1 时空间分辨率保持不变。
    公式: padding = (kernel_size - 1) // 2
    """
    if d > 1:
        k = d * (k - 1) + 1 if isinstance(k, int) else [d * (x - 1) + 1 for x in k]
    if p is None:
        p = k // 2 if isinstance(k, int) else [x // 2 for x in k]
    return p


# ------------------------------------------------------------------------------
# 基础模块
# ------------------------------------------------------------------------------
class Conv(nn.Module):
    """
    标准卷积模块: Conv2d + BatchNorm + SiLU 激活函数。

    这是 YOLOv8 中最基础的构建块，几乎所有层都使用这个结构。

    参数:
        c1: 输入通道数
        c2: 输出通道数
        k: 卷积核大小 (默认 1x1)
        s: 步长 (默认 1，不改变空间尺寸)
        p: 填充 (默认自动计算)
        g: 分组卷积数 (默认 1，标准卷积)
        d: 空洞卷积率 (默认 1)
        act: 是否使用激活函数 (默认 True，使用 SiLU)

    形状变化:
        输入: (B, c1, H, W)
        输出: (B, c2, H/s, W/s)
    """

    def __init__(self, c1, c2, k=1, s=1, p=None, g=1, d=1, act=True):
        super().__init__()
        # 卷积层: 提取空间特征
        self.conv = nn.Conv2d(c1, c2, k, s, autopad(k, p, d), groups=g, dilation=d, bias=False)
        # 批归一化: 稳定训练，加速收敛
        self.bn = nn.BatchNorm2d(c2)
        # SiLU 激活函数: Sigmoid Linear Unit, 平滑的非线性激活
        # 公式: SiLU(x) = x * sigmoid(x)
        self.act = nn.SiLU() if act is True else (act if isinstance(act, nn.Module) else nn.Identity())

    def forward(self, x):
        return self.act(self.bn(self.conv(x)))


class Bottleneck(nn.Module):
    """
    瓶颈模块 (Bottleneck): 两个 3x3 卷积 + 可选残差连接。

    设计思想:
    - 第一个 1x1 卷积 (或 3x3) 降维，减少计算量
    - 第二个 3x3 卷积在降维后的空间上操作
    - 残差连接 (shortcut) 帮助梯度传播，缓解梯度消失

    参数:
        c1: 输入通道数
        c2: 输出通道数
        shortcut: 是否使用残差连接 (需要 c1 == c2)
        g: 分组卷积数
        k: 两个卷积的核大小
        e: 通道扩展/压缩因子
    """

    def __init__(self, c1, c2, shortcut=True, g=1, k=(3, 3), e=0.5):
        super().__init__()
        # 隐藏层通道数 = 输出通道数 * 扩展因子
        c_ = int(c2 * e)
        # 第一个卷积: 降维
        self.cv1 = Conv(c1, c_, k[0], 1)
        # 第二个卷积: 升维回原始通道数
        self.cv2 = Conv(c_, c2, k[1], 1, g=g)
        # 只有当输入输出通道相同且 shortcut=True 时才使用残差连接
        self.add = shortcut and c1 == c2

    def forward(self, x):
        # 如果有残差连接: 输出 = 输入 + 卷积结果
        # 否则: 输出 = 卷积结果
        return x + self.cv2(self.cv1(x)) if self.add else self.cv2(self.cv1(x))


class C2f(nn.Module):
    """
    C2f 模块 (Cross-stage Feature Fusion with 2 convolutions)。

    这是 YOLOv8 的核心创新，替代了 YOLOv5 中的 C3 模块。

    处理流程:
    1. 输入经过 1x1 卷积，通道数翻倍
    2. 将特征图在通道维度上分成两半 (chunk)
    3. 一半直接保留，另一半经过多个 Bottleneck 模块
    4. 将所有特征拼接 (concat)，再经过 1x1 卷积压缩通道

    相比 C3 的优势:
    - C3 是串联 Bottleneck，C2f 是并联，获得更多梯度流信息
    - 保留了更多浅层特征，改善小目标检测

    参数:
        c1: 输入通道数
        c2: 输出通道数
        n: Bottleneck 重复次数
        shortcut: Bottleneck 是否使用残差连接
        g: 分组卷积数
        e: 通道因子 (默认 0.5)
    """

    def __init__(self, c1, c2, n=1, shortcut=False, g=1, e=0.5):
        super().__init__()
        # 隐藏通道数
        self.c = int(c2 * e)
        # 第一步: 1x1 卷积将通道扩展为 2*c (为后续 split 做准备)
        self.cv1 = Conv(c1, 2 * self.c, 1, 1)
        # 最后一步: 1x1 卷积将拼接后的通道压缩为 c2
        # 输入通道数 = 2*c (直接传递部分) + n*c (n个Bottleneck的输出)
        self.cv2 = Conv((2 + n) * self.c, c2, 1)
        # n 个 Bottleneck 模块
        self.m = nn.ModuleList(
            Bottleneck(self.c, self.c, shortcut, g, k=((3, 3), (3, 3)), e=1.0)
            for _ in range(n)
        )

    def forward(self, x):
        # cv1 输出通道为 2*c，在通道维度 (dim=1) 上分成两份
        y = list(self.cv1(x).chunk(2, 1))
        # y[0] 直接保留，y[1] 经过第一个 Bottleneck
        # 然后将输出追加到列表中，供下一个 Bottleneck 使用
        y.extend(m(y[-1]) for m in self.m)
        # 拼接所有特征，再经过 cv2 压缩通道
        return self.cv2(torch.cat(y, 1))


class SPPF(nn.Module):
    """
    快速空间金字塔池化 (Spatial Pyramid Pooling - Fast)。

    作用: 在不改变输入尺寸的情况下，扩大感受野，融合多尺度特征。

    相比 SPP (Spatial Pyramid Pooling):
    - SPP 使用多个不同尺寸的池化核 (如 5x5, 9x9, 13x13)
    - SPPF 使用多个串联的 5x5 MaxPool，计算更快但效果等价

    处理流程:
    1. 1x1 卷积降维到 c_/2
    2. 串联 3 次 5x5 MaxPool (感受野等价于 5x5, 9x9, 13x13)
    3. 将原始特征和 3 次池化结果拼接
    4. 1x1 卷积恢复到目标通道数

    参数:
        c1: 输入通道数
        c2: 输出通道数
        k: 池化核大小 (默认 5)
    """

    def __init__(self, c1, c2, k=5):
        super().__init__()
        c_ = c1 // 2
        self.cv1 = Conv(c1, c_, 1, 1)
        # 4 倍通道: 原始 + 3 次池化结果
        self.cv2 = Conv(c_ * 4, c2, 1, 1)
        # 5x5 MaxPool，stride=1 保持空间尺寸
        self.m = nn.MaxPool2d(kernel_size=k, stride=1, padding=k // 2)

    def forward(self, x):
        x = self.cv1(x)
        y1 = self.m(x)
        y2 = self.m(y1)
        y3 = self.m(y2)
        # 拼接: [原始, 1次池化, 2次池化, 3次池化]
        return self.cv2(torch.cat([x, y1, y2, y3], 1))


class DFL(nn.Module):
    """
    分布焦点损失 (Distribution Focal Loss)。

    传统目标检测直接回归边界框坐标 (如 x, y, w, h)。
    DFL 将坐标回归转化为分类问题:
    - 将坐标范围离散化为 reg_max 个区间
    - 预测每个区间的概率分布
    - 最终坐标 = 概率分布的期望值 (加权平均)

    优势:
    - 对标注噪声更鲁棒
    - 可以建模边界的不确定性 (模糊边界 vs 清晰边界)
    - 通过分布形状反映预测置信度

    参数:
        c1: 离散化区间数量 (默认 16)
    """

    def __init__(self, c1=16):
        super().__init__()
        # 1x1 卷积实现加权求和，权重为 [0, 1, 2, ..., c1-1]
        self.conv = nn.Conv2d(c1, 1, 1, bias=False)
        self.conv.weight.data = nn.Parameter(torch.arange(c1, dtype=torch.float32).view(1, c1, 1, 1))
        self.c1 = c1

    def forward(self, x):
        """
        输入: (B, 4*reg_max, H*W) - 4 个坐标的概率分布
        输出: (B, 4, H*W) - 4 个坐标的回归值
        """
        b, c, a = x.shape
        # reshape -> softmax (归一化为概率) -> 加权求和
        return self.conv(x.view(b, 4, self.c1, a).transpose(2, 1).softmax(1)).view(b, 4, a)


# ------------------------------------------------------------------------------
# 骨干网络 (Backbone): CSPDarknet (增强版)
# ------------------------------------------------------------------------------
class Backbone(nn.Module):
    """
    YOLOv8 骨干网络: 从输入图像提取多尺度特征。

    结构 (从输入到输出):
    - P1/2:  640x640 -> 320x320  (2倍下采样)
    - P2/4:  320x320 -> 160x160  (4倍下采样)
    - P3/8:  160x160 ->  80x80   (8倍下采样)  -> 输出给 Neck
    - P4/16:  80x80  ->  40x40   (16倍下采样) -> 输出给 Neck
    - P5/32:  40x40  ->  20x20   (32倍下采样) -> 输出给 Neck

    每个阶段使用 Conv (3x3, s=2) 进行下采样，然后使用 C2f 提取特征。
    最后经过 SPPF 扩大感受野。
    """

    def __init__(self, w, d, max_channels):
        super().__init__()
        # 应用宽度缩放后的各阶段通道数
        c1 = make_divisible(BASE_CHANNELS[0] * w, 8)   # P1 通道数
        c2 = make_divisible(BASE_CHANNELS[1] * w, 8)   # P2 通道数
        c3 = make_divisible(BASE_CHANNELS[2] * w, 8)   # P3 通道数
        c4 = make_divisible(BASE_CHANNELS[3] * w, 8)   # P4 通道数
        c5 = min(make_divisible(BASE_CHANNELS[4] * w, 8), max_channels)  # P5 通道数

        # P1/2: 640x640 -> 320x320
        self.stem = Conv(3, c1, k=3, s=2)

        # P2/4: 320x320 -> 160x160
        self.conv1 = Conv(c1, c2, k=3, s=2)
        # C2f 模块: n = round(3 * 0.33) = 1 个 Bottleneck
        self.c2f_1 = C2f(c2, c2, n=max(round(BACKBONE_REPEATS[0] * d), 1), shortcut=True)

        # P3/8: 160x160 -> 80x80
        self.conv2 = Conv(c2, c3, k=3, s=2)
        # C2f 模块: n = round(6 * 0.33) = 2 个 Bottleneck
        self.c2f_2 = C2f(c3, c3, n=max(round(BACKBONE_REPEATS[1] * d), 1), shortcut=True)

        # P4/16: 80x80 -> 40x40
        self.conv3 = Conv(c3, c4, k=3, s=2)
        # C2f 模块: n = round(6 * 0.33) = 2 个 Bottleneck
        self.c2f_3 = C2f(c4, c4, n=max(round(BACKBONE_REPEATS[2] * d), 1), shortcut=True)

        # P5/32: 40x40 -> 20x20
        self.conv4 = Conv(c4, c5, k=3, s=2)
        # C2f 模块: n = round(3 * 0.33) = 1 个 Bottleneck
        self.c2f_4 = C2f(c5, c5, n=max(round(BACKBONE_REPEATS[3] * d), 1), shortcut=True)
        # SPPF: 扩大感受野
        self.sppf = SPPF(c5, c5, k=5)

    def forward(self, x):
        """
        前向传播，返回 P3, P4, P5 三个尺度的特征图。

        形状变化:
            输入: (B, 3, 640, 640)
            P3:   (B, c3, 80, 80)
            P4:   (B, c4, 40, 40)
            P5:   (B, c5, 20, 20)
        """
        x = self.stem(x)      # P1: 320x320
        x = self.conv1(x)     # P2: 160x160
        x = self.c2f_1(x)
        p3 = self.conv2(x)    # P3: 80x80
        p3 = self.c2f_2(p3)
        p4 = self.conv3(p3)   # P4: 40x40
        p4 = self.c2f_3(p4)
        p5 = self.conv4(p4)   # P5: 20x20
        p5 = self.c2f_4(p5)
        p5 = self.sppf(p5)
        return p3, p4, p5


# ------------------------------------------------------------------------------
# 颈部网络 (Neck): PANet (FPN + PAN)
# ------------------------------------------------------------------------------
class Neck(nn.Module):
    """
    PANet 特征融合网络: 结合 FPN (自顶向下) 和 PAN (自底向上)。

    为什么需要 Neck?
    - 深层特征 (P5) 语义信息丰富，但空间分辨率低，对小目标检测不利
    - 浅层特征 (P3) 空间信息丰富，但语义信息弱
    - Neck 将两者融合，使每个尺度都包含丰富的语义和空间信息

    FPN (Feature Pyramid Network) - 自顶向下:
    - 将高层语义信息传递到低层
    - 使用上采样 (Upsample) 恢复空间分辨率
    - 通过 Concat 与对应尺度的 Backbone 特征融合

    PAN (Path Aggregation Network) - 自底向上:
    - 将低层空间信息传递到高层
    - 使用卷积下采样
    - 进一步增强多尺度特征融合
    """

    def __init__(self, w, d, max_channels):
        super().__init__()
        c3 = make_divisible(BASE_CHANNELS[2] * w, 8)
        c4 = make_divisible(BASE_CHANNELS[3] * w, 8)
        c5 = min(make_divisible(BASE_CHANNELS[4] * w, 8), max_channels)

        # ---------- FPN: 自顶向下 ----------
        # 最近邻上采样: 2倍放大，通道数不变
        self.up = nn.Upsample(scale_factor=2, mode='nearest')

        # P5 上采样后与 P4 拼接 -> C2f -> 得到融合后的 P4 特征
        # 输入通道: c5 (上采样后) + c4 (backbone P4)
        self.c2f_p4 = C2f(c5 + c4, c4, n=max(round(NECK_REPEATS[0] * d), 1), shortcut=False)

        # 融合后的 P4 上采样后与 P3 拼接 -> C2f -> 得到融合后的 P3 特征
        # 输入通道: c4 (上采样后) + c3 (backbone P3)
        self.c2f_p3 = C2f(c4 + c3, c3, n=max(round(NECK_REPEATS[1] * d), 1), shortcut=False)

        # ---------- PAN: 自底向上 ----------
        # P3 下采样后与融合 P4 拼接 -> C2f
        self.conv_p4 = Conv(c3, c3, k=3, s=2)
        self.c2f_n4 = C2f(c3 + c4, c4, n=max(round(NECK_REPEATS[2] * d), 1), shortcut=False)

        # 融合后的 N4 下采样后与 P5 拼接 -> C2f
        self.conv_p5 = Conv(c4, c4, k=3, s=2)
        self.c2f_n5 = C2f(c4 + c5, c5, n=max(round(NECK_REPEATS[2] * d), 1), shortcut=False)

    def forward(self, p3, p4, p5):
        """
        参数:
            p3: Backbone P3 特征 (B, c3, 80, 80)
            p4: Backbone P4 特征 (B, c4, 40, 40)
            p5: Backbone P5 特征 (B, c5, 20, 20)

        返回:
            f3: 最终 P3 特征 (B, c3, 80, 80) - 用于检测小目标
            n4: 最终 P4 特征 (B, c4, 40, 40) - 用于检测中等目标
            n5: 最终 P5 特征 (B, c5, 20, 20) - 用于检测大目标
        """
        # FPN: 自顶向下融合
        f4 = self.c2f_p4(torch.cat([self.up(p5), p4], dim=1))
        f3 = self.c2f_p3(torch.cat([self.up(f4), p3], dim=1))

        # PAN: 自底向上融合
        n4 = self.c2f_n4(torch.cat([self.conv_p4(f3), f4], dim=1))
        n5 = self.c2f_n5(torch.cat([self.conv_p5(n4), p5], dim=1))

        return f3, n4, n5


# ------------------------------------------------------------------------------
# 检测头 (Head): 解耦头 (Decoupled Head) + Anchor-Free
# ------------------------------------------------------------------------------
class Detect(nn.Module):
    """
    YOLOv8 检测头: 解耦设计 + Anchor-Free + DFL。

    解耦头 (Decoupled Head):
    - 传统耦合头: 分类和回归共享同一组特征和卷积层
    - 解耦头: 分类和回归使用独立的卷积分支
    - 原因: 分类关注语义信息，回归关注几何/位置信息，任务目标不同

    Anchor-Free:
    - 不再使用预定义的锚框 (Anchor Boxes)
    - 直接预测每个特征点的目标中心点偏移和宽高
    - 优势: 减少超参数，简化训练，加速推理

    DFL (Distribution Focal Loss):
    - 将边界框回归从直接预测坐标值改为预测概率分布
    - 输出 reg_max * 4 个值 (4 个坐标，每个坐标 reg_max 个离散值)
    - 最终坐标 = 概率分布的期望值

    参数:
        nc: 类别数量
        reg_max: DFL 离散化区间数
        ch: 三个检测层的输入通道数元组
    """

    def __init__(self, nc=80, reg_max=16, ch=()):
        super().__init__()
        self.nc = nc                    # 类别数
        self.nl = len(ch)               # 检测层数 (3: P3, P4, P5)
        self.reg_max = reg_max          # DFL 通道数
        self.no = nc + reg_max * 4      # 每个锚点的输出数

        # 回归分支的中间通道数
        c2 = max(16, ch[0] // 4, reg_max * 4)
        # 分类分支的中间通道数
        c3 = max(ch[0], min(nc, 100))

        # ---------- 回归分支 (BBox Regression) ----------
        # 每个检测层独立的回归头
        # 结构: Conv(3x3) -> Conv(3x3) -> Conv2d(1x1, 4*reg_max)
        self.cv2 = nn.ModuleList(
            nn.Sequential(Conv(x, c2, 3), Conv(c2, c2, 3), nn.Conv2d(c2, 4 * reg_max, 1))
            for x in ch
        )

        # ---------- 分类分支 (Classification) ----------
        # 每个检测层独立的分类头
        # 结构: DWConv(3x3) -> Conv(1x1) -> DWConv(3x3) -> Conv(1x1) -> Conv2d(1x1, nc)
        # 使用 DWConv (Depthwise Conv) 减少参数量
        self.cv3 = nn.ModuleList(
            nn.Sequential(
                nn.Sequential(Conv(x, x, 3, g=x), Conv(x, c3, 1)),
                nn.Sequential(Conv(c3, c3, 3, g=c3), Conv(c3, c3, 1)),
                nn.Conv2d(c3, nc, 1),
            )
            for x in ch
        )

        # DFL 模块: 将分布转换为坐标值
        self.dfl = DFL(reg_max) if reg_max > 1 else nn.Identity()

    def forward(self, x):
        """
        参数:
            x: 三个尺度的特征图列表 [P3, P4, P5]

        返回:
            三个尺度的预测结果，每个结果为 (B, nc + 4*reg_max, H, W)
            - 前 nc 个通道: 类别概率
            - 后 4*reg_max 个通道: 边界框分布 (xywh)
        """
        for i in range(self.nl):
            # 拼接回归和分类输出
            x[i] = torch.cat((self.cv2[i](x[i]), self.cv3[i](x[i])), 1)
        return x


# ------------------------------------------------------------------------------
# 完整模型
# ------------------------------------------------------------------------------
class YOLOv8n(nn.Module):
    """
    YOLOv8-Nano 目标检测完整模型。

    组成:
    1. Backbone: 提取 P3, P4, P5 三个尺度的特征
    2. Neck: PANet 融合多尺度特征
    3. Head: 解耦检测头输出分类和回归结果

    前向流程:
    输入图像 (3, 640, 640)
        -> Backbone -> [P3, P4, P5]
        -> Neck -> [f3, n4, n5]
        -> Head -> [out_p3, out_p4, out_p5]

    输出:
        out_p3: (B, 144, 80, 80)  # 小目标检测
        out_p4: (B, 144, 40, 40)  # 中等目标检测
        out_p5: (B, 144, 20, 20)  # 大目标检测
        (其中 144 = 80 类别 + 64 DFL = nc + reg_max*4)
    """

    def __init__(self, nc=NC):
        super().__init__()
        # 骨干网络: 特征提取
        self.backbone = Backbone(WIDTH_MULTIPLE, DEPTH_MULTIPLE, MAX_CHANNELS)
        # 颈部网络: 特征融合
        self.neck = Neck(WIDTH_MULTIPLE, DEPTH_MULTIPLE, MAX_CHANNELS)

        # 检测头的输入通道数
        ch = [
            make_divisible(BASE_CHANNELS[2] * WIDTH_MULTIPLE, 8),
            make_divisible(BASE_CHANNELS[3] * WIDTH_MULTIPLE, 8),
            min(make_divisible(BASE_CHANNELS[4] * WIDTH_MULTIPLE, 8), MAX_CHANNELS),
        ]
        # 检测头
        self.head = Detect(nc=nc, reg_max=REG_MAX, ch=tuple(ch))

    def forward(self, x):
        """
        完整前向传播。

        参数:
            x: 输入图像 (B, 3, 640, 640)

        返回:
            三个尺度的预测特征图列表
        """
        p3, p4, p5 = self.backbone(x)
        f3, n4, n5 = self.neck(p3, p4, p5)
        return self.head([f3, n4, n5])


# ------------------------------------------------------------------------------
# 教学演示
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    # 创建模型实例
    model = YOLOv8n(nc=80)

    # 创建随机输入 (模拟一张 640x640 的 RGB 图像)
    x = torch.randn(1, 3, 640, 640)

    # 前向传播
    y = model(x)

    print("=" * 60)
    print("YOLOv8-Nano 模型前向传播演示")
    print("=" * 60)
    print(f"\n输入图像形状:  {x.shape}")
    print(f"  -> 批次大小: {x.shape[0]}")
    print(f"  -> 通道数:   {x.shape[1]} (RGB)")
    print(f"  -> 图像尺寸: {x.shape[2]}x{x.shape[3]}")

    print(f"\n输出特征图:")
    print(f"  P3 (小目标):  {y[0].shape} -> 80x80 网格，每个网格预测一个目标")
    print(f"  P4 (中目标):  {y[1].shape} -> 40x40 网格，每个网格预测一个目标")
    print(f"  P5 (大目标):  {y[2].shape} -> 20x20 网格，每个网格预测一个目标")

    print(f"\n输出通道解析:")
    print(f"  总通道数: {y[0].shape[1]} = {NC} (类别) + {REG_MAX*4} (DFL边界框)")
    print(f"  其中 DFL: 4个坐标 * {REG_MAX}个离散值 = {REG_MAX*4}")

    # 计算总参数量
    params = sum(p.numel() for p in model.parameters())
    print(f"\n模型总参数量: {params:,} ({params / 1e6:.2f}M)")
    print(f"  (YOLOv8n 官方标称约 3.2M 参数)")

    print("\n" + "=" * 60)
    print("练习建议:")
    print("=" * 60)
    print("1. 尝试修改 WIDTH_MULTIPLE 和 DEPTH_MULTIPLE 观察参数量变化")
    print("2. 尝试修改 REG_MAX 看看对输出通道数的影响")
    print("3. 将模型切换到 eval() 模式，观察 BatchNorm 行为变化")
    print("4. 尝试使用 torchsummary 或 thop 库计算 FLOPs")
