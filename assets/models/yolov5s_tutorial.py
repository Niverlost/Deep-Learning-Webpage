"""
YOLOv5: An Incremental Improvement
Glenn Jocher, Ultralytics
2020
GitHub: https://github.com/ultralytics/yolov5

初学者教程版 YOLOv5-S (small) 实现。

本模型做什么？
  YOLOv5 是一个单阶段目标检测器，输入一张 RGB 图像，直接输出图像中所有目标的
  边界框坐标、置信度和类别概率。与两阶段检测器（如 Faster R-CNN）不同，YOLO
  系列只需"看一次"（You Only Look Once）图像即可完成检测与分类，因此速度极快。

关键概念：
  - CSP (Cross Stage Partial): 将特征图分成两部分，一部分经过残差块处理，
    另一部分直接传递，最后拼接。减少重复梯度信息，降低计算量。
  - PANet (Path Aggregation Network): 结合自顶向下（FPN）和自底向上两条路径，
    让深层语义特征与浅层位置特征充分融合。
  - SPPF (Spatial Pyramid Pooling - Fast): 用多个级联的 MaxPool 替代不同尺寸
    的池化核，在同等感受野下显著加速。
  - 多尺度检测 (P3/P4/P5): 在 8x、16x、32x 下采样三个尺度上同时检测，
    小目标用大分辨率特征图检测，大目标用小分辨率特征图检测。
"""

import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# 配置常数（与 yolov5s.yaml 完全一致）
# ---------------------------------------------------------------------------
NC = 80                     # 类别数（COCO 数据集有 80 类）
INPUT_SIZE = 640            # 输入图像尺寸：640x640
DEPTH_MULTIPLE = 0.33       # 深度缩放系数：控制 Bottleneck 重复次数
WIDTH_MULTIPLE = 0.50       # 宽度缩放系数：控制每层通道数

# 先验框（anchors），每组对应一个检测尺度
# P3/8  用于检测小目标（特征图尺寸 80x80）
# P4/16 用于检测中等目标（特征图尺寸 40x40）
# P5/32 用于检测大目标（特征图尺寸 20x20）
ANCHORS = [
    [10, 13, 16, 30, 33, 23],      # P3/8
    [30, 61, 62, 45, 59, 119],     # P4/16
    [116, 90, 156, 198, 373, 326], # P5/32
]


def _make_divisible(v, divisor=8):
    """
    将通道数调整为 divisor 的整数倍。
    原因：硬件（尤其是 GPU/TPU）对 8 的倍数通道数更高效。
    """
    return int((v + divisor / 2) // divisor * divisor)


def _scale_channels(c, width_multiple=WIDTH_MULTIPLE, divisor=8):
    """
    根据宽度缩放系数调整通道数。
    例如：基准 64 通道 * 0.5 = 32 通道。
    """
    return _make_divisible(c * width_multiple, divisor)


def _scale_depth(n, depth_multiple=DEPTH_MULTIPLE):
    """
    根据深度缩放系数调整 Bottleneck 重复次数。
    例如：基准 3 个 block * 0.33 ≈ 1 个 block。
    """
    return max(round(n * depth_multiple), 1) if n > 1 else n


# ---------------------------------------------------------------------------
# 基础模块
# ---------------------------------------------------------------------------
class Conv(nn.Module):
    """
    标准卷积块：Conv2d + BatchNorm2d + SiLU 激活。

    为什么用 SiLU（Swish）？
      论文作者发现 SiLU(x) = x * sigmoid(x) 比 ReLU 更平滑，
      在深层网络中梯度流动更稳定，且能带来轻微精度提升。
    为什么加 BatchNorm？
      加速收敛、稳定训练，YOLOv5 全网络均使用 BN。
    """

    def __init__(self, c1, c2, k=1, s=1, p=None, g=1, act=True):
        super().__init__()
        # 卷积层：bias=False，因为 BN 层已经包含可学习的 bias 项
        self.conv = nn.Conv2d(c1, c2, k, s, autopad(k, p), groups=g, bias=False)
        self.bn = nn.BatchNorm2d(c2)
        self.act = nn.SiLU() if act is True else (act if isinstance(act, nn.Module) else nn.Identity())

    def forward(self, x):
        return self.act(self.bn(self.conv(x)))


def autopad(k, p=None):
    """
    自动计算 padding，使输出空间尺寸与输入相同（stride=1 时）。
    公式：padding = kernel_size // 2
    """
    if p is None:
        p = k // 2 if isinstance(k, int) else [x // 2 for x in k]
    return p


class Bottleneck(nn.Module):
    """
    残差瓶颈块：1x1 降维 -> 3x3 卷积 -> 可选 shortcut。

    结构：
      输入 -> [1x1 conv] -> [3x3 conv] -> 输出
                |_________________________| (shortcut，若输入输出通道相同)

    为什么用 1x1 降维？
      减少 3x3 卷积的计算量（通道数少了）。
    """

    def __init__(self, c1, c2, shortcut=True, g=1, e=0.5):
        super().__init__()
        c_ = int(c2 * e)          # 隐藏层通道数（降维后的通道数）
        self.cv1 = Conv(c1, c_, 1, 1)   # 1x1 逐点卷积：降维
        self.cv2 = Conv(c_, c2, 3, 1, g=g)  # 3x3 空间卷积：提取特征
        self.add = shortcut and c1 == c2    # 只有通道相同时才用 shortcut

    def forward(self, x):
        # 若启用 shortcut：输出 = 输入 + 卷积结果（残差连接）
        return x + self.cv2(self.cv1(x)) if self.add else self.cv2(self.cv1(x))


class C3(nn.Module):
    """
    CSP Bottleneck（3 个卷积版本）。

    CSP 设计思想：
      将输入特征图沿通道维度分为两条路径：
        - 路径 A（cv1）：经过 n 个 Bottleneck 残差块处理
        - 路径 B（cv2）：直接传递，不做任何处理
      最后将两条路径在通道维度拼接，再用 1x1 卷积融合。

    好处：
      1. 减少梯度重复，提升学习效率。
      2. 降低计算量，同时保持精度。
    """

    def __init__(self, c1, c2, n=1, shortcut=True, g=1, e=0.5):
        super().__init__()
        c_ = int(c2 * e)          # 每条分支的通道数
        self.cv1 = Conv(c1, c_, 1, 1)   # 路径 A 的入口
        self.cv2 = Conv(c1, c_, 1, 1)   # 路径 B 的入口
        self.cv3 = Conv(2 * c_, c2, 1)  # 拼接后的融合卷积
        # n 个 Bottleneck 串联构成路径 A 的主干
        self.m = nn.Sequential(*(Bottleneck(c_, c_, shortcut, g, e=1.0) for _ in range(n)))

    def forward(self, x):
        # 路径 A 经过残差块，路径 B 直接传递，拼接后融合
        return self.cv3(torch.cat((self.m(self.cv1(x)), self.cv2(x)), dim=1))


class SPPF(nn.Module):
    """
    快速空间金字塔池化（Spatial Pyramid Pooling - Fast）。

    原始 SPP 使用多个不同尺寸的 MaxPool（如 5x5, 9x9, 13x13）。
    SPPF 的改进：用 3 次级联的 5x5 MaxPool 替代，获得等效感受野，但速度更快。

    输入输出尺寸不变（stride=1 的池化），通道数变化由 1x1 卷积控制。
    """

    def __init__(self, c1, c2, k=5):
        super().__init__()
        c_ = c1 // 2              # 先降维一半，减少池化后的计算量
        self.cv1 = Conv(c1, c_, 1, 1)
        self.cv2 = Conv(c_ * 4, c2, 1, 1)   # 4 份特征拼接：原图 + 3 次池化
        self.m = nn.MaxPool2d(kernel_size=k, stride=1, padding=k // 2)

    def forward(self, x):
        x = self.cv1(x)
        y1 = self.m(x)            # 第 1 次池化（等效 5x5 感受野）
        y2 = self.m(y1)           # 第 2 次池化（等效 9x9 感受野）
        y3 = self.m(y2)           # 第 3 次池化（等效 13x13 感受野）
        # 将 4 个尺度的特征在通道维度拼接
        return self.cv2(torch.cat((x, y1, y2, y3), dim=1))


class Concat(nn.Module):
    """简单的张量拼接模块，用于 FPN/PAN 中的特征融合。"""

    def __init__(self, dimension=1):
        super().__init__()
        self.d = dimension        # 默认沿通道维度（dim=1）拼接

    def forward(self, x):
        return torch.cat(x, self.d)


class Detect(nn.Module):
    """
    YOLOv5 检测头（Detect Head）。

    3 个检测层分别对应 P3、P4、P5 三个尺度。
    每个检测层输出：
      - 每个网格单元预测 3 个 anchor
      - 每个 anchor 预测 (x, y, w, h, obj_conf, cls1, cls2, ..., cls80)
      - 共 5 + 80 = 85 个数值

    输出形状：
      训练时：(batch, 3, H, W, 85)
      其中 3 是 anchor 数量，H/W 是特征图高宽。
    """

    stride = None

    def __init__(self, nc=80, anchors=(), ch=(), inplace=True):
        super().__init__()
        self.nc = nc              # 类别数
        self.no = nc + 5          # 每个 anchor 的输出数（xywh + obj + classes）
        self.nl = len(anchors)    # 检测层数（3 层：P3, P4, P5）
        self.na = len(anchors[0]) // 2  # 每层 anchor 数量（3 个）
        self.grid = [torch.empty(0) for _ in range(self.nl)]
        self.anchor_grid = [torch.empty(0) for _ in range(self.nl)]
        # 将 anchors 注册为 buffer（不参与训练，但会随模型保存）
        self.register_buffer("anchors", torch.tensor(anchors).float().view(self.nl, -1, 2))
        # 3 个 1x1 卷积，将特征图通道数映射到 na * no
        self.m = nn.ModuleList(nn.Conv2d(x, self.no * self.na, 1) for x in ch)
        self.inplace = inplace

    def forward(self, x):
        for i in range(self.nl):
            x[i] = self.m[i](x[i])    # 1x1 卷积调整通道数
            bs, _, ny, nx = x[i].shape
            # reshape: (B, 255, H, W) -> (B, 3, H, W, 85)
            x[i] = x[i].view(bs, self.na, self.no, ny, nx).permute(0, 1, 3, 4, 2).contiguous()
        return x


# ---------------------------------------------------------------------------
# Backbone（主干网络）：CSPDarknet53
# ---------------------------------------------------------------------------
class Backbone(nn.Module):
    """
    YOLOv5-S 主干网络。

    下采样策略：
      - 第 1 层：stride=2，640 -> 320
      - 第 2 层：stride=2，320 -> 160
      - 第 3 层：stride=2，160 -> 80   (P3)
      - 第 4 层：stride=2，80  -> 40   (P4)
      - 第 5 层：stride=2，40  -> 20   (P5)

    每经过一个 C3 块，感受野增大，语义信息更丰富。
    """

    def __init__(self):
        super().__init__()
        # P1/2: 640x640 -> 320x320
        # 用 6x6 卷积、stride=2 替代早期的 Focus 切片操作（v6.0 版本更新）
        self.stem = Conv(3, _scale_channels(64), 6, 2, 2)

        # P2/4: 320x320 -> 160x160
        self.conv1 = Conv(_scale_channels(64), _scale_channels(128), 3, 2)
        self.c3_1 = C3(_scale_channels(128), _scale_channels(128), n=_scale_depth(3), shortcut=True)

        # P3/8: 160x160 -> 80x80  （小目标检测特征图，需保存给 Neck）
        self.conv2 = Conv(_scale_channels(128), _scale_channels(256), 3, 2)
        self.c3_2 = C3(_scale_channels(256), _scale_channels(256), n=_scale_depth(6), shortcut=True)

        # P4/16: 80x80 -> 40x40  （中等目标检测特征图，需保存给 Neck）
        self.conv3 = Conv(_scale_channels(256), _scale_channels(512), 3, 2)
        self.c3_3 = C3(_scale_channels(512), _scale_channels(512), n=_scale_depth(9), shortcut=True)

        # P5/32: 40x40 -> 20x20  （大目标检测特征图）
        self.conv4 = Conv(_scale_channels(512), _scale_channels(1024), 3, 2)
        self.c3_4 = C3(_scale_channels(1024), _scale_channels(1024), n=_scale_depth(3), shortcut=True)
        self.sppf = SPPF(_scale_channels(1024), _scale_channels(1024), k=5)

    def forward(self, x):
        x = self.stem(x)          # (B, 32, 320, 320)
        x = self.conv1(x)         # (B, 64, 160, 160)
        x = self.c3_1(x)          # (B, 64, 160, 160)

        x = self.conv2(x)         # (B, 128, 80, 80)
        c3 = self.c3_2(x)         # (B, 128, 80, 80)  <- P3，保存给 Neck

        x = self.conv3(c3)        # (B, 256, 40, 40)
        c4 = self.c3_3(x)         # (B, 256, 40, 40)  <- P4，保存给 Neck

        x = self.conv4(c4)        # (B, 512, 20, 20)
        x = self.c3_4(x)          # (B, 512, 20, 20)
        c5 = self.sppf(x)         # (B, 512, 20, 20)  <- P5，经过 SPPF

        return c3, c4, c5


# ---------------------------------------------------------------------------
# Neck（特征融合网络）：PANet
# ---------------------------------------------------------------------------
class Neck(nn.Module):
    """
    PANet 特征融合网络。

    结构分为两部分：
      1. FPN（自顶向下）：将深层语义特征传递到浅层
         - P5 经过 1x1 卷积降维后上采样，与 P4 拼接
         - 融合后的特征再降维上采样，与 P3 拼接
      2. PAN（自底向上）：将浅层位置特征传递回深层
         - P3 经过 3x3 卷积下采样，与 FPN 的 P4 拼接
         - 融合后的特征再下采样，与 FPN 的 P5 拼接

    为什么需要双向融合？
      - FPN 让浅层获得语义信息（知道"是什么"）
      - PAN 让深层获得位置信息（知道"在哪里"）
      - 两者结合，检测精度更高。
    """

    def __init__(self):
        super().__init__()
        c3_out = _scale_channels(256)   # P3 通道数（128）
        c4_out = _scale_channels(512)   # P4 通道数（256）
        c5_out = _scale_channels(1024)  # P5 通道数（512）

        # ---------- FPN（自顶向下）----------
        # 将 P5 通道数减半，准备上采样与 P4 融合
        self.conv_p5 = Conv(c5_out, _scale_channels(512), 1, 1)
        self.upsample1 = nn.Upsample(scale_factor=2, mode="nearest")   # 20x20 -> 40x40
        self.concat1 = Concat(dimension=1)
        # 拼接后通道数 = P4(256) + upsampled_P5(256) = 512
        self.c3_fpn1 = C3(c4_out + _scale_channels(512), _scale_channels(512), n=_scale_depth(3), shortcut=False)

        # 将融合后的 P4 通道数减半，准备上采样与 P3 融合
        self.conv_p4 = Conv(_scale_channels(512), _scale_channels(256), 1, 1)
        self.upsample2 = nn.Upsample(scale_factor=2, mode="nearest")   # 40x40 -> 80x80
        self.concat2 = Concat(dimension=1)
        # 拼接后通道数 = P3(128) + upsampled_P4(128) = 256
        self.c3_fpn2 = C3(c3_out + _scale_channels(256), _scale_channels(256), n=_scale_depth(3), shortcut=False)

        # ---------- PAN（自底向上）----------
        # 将 FPN 输出的 P3 下采样，与 FPN 的 P4 融合
        self.conv_n3 = Conv(_scale_channels(256), _scale_channels(256), 3, 2)  # 80x80 -> 40x40
        self.concat3 = Concat(dimension=1)
        self.c3_pan1 = C3(_scale_channels(512) + _scale_channels(256), _scale_channels(512), n=_scale_depth(3), shortcut=False)

        # 将 PAN 的 P4 下采样，与 FPN 的 P5 融合
        self.conv_n4 = Conv(_scale_channels(512), _scale_channels(512), 3, 2)  # 40x40 -> 20x20
        self.concat4 = Concat(dimension=1)
        self.c3_pan2 = C3(_scale_channels(512) + _scale_channels(512), _scale_channels(1024), n=_scale_depth(3), shortcut=False)

    def forward(self, c3, c4, c5):
        # ---- FPN 自顶向下 ----
        p5 = self.conv_p5(c5)                 # (B, 256, 20, 20)
        x = self.upsample1(p5)                # (B, 256, 40, 40)
        x = self.concat1([x, c4])             # (B, 512, 40, 40)
        p4 = self.c3_fpn1(x)                  # (B, 256, 40, 40)

        x = self.conv_p4(p4)                  # (B, 128, 40, 40)
        x = self.upsample2(x)                 # (B, 128, 80, 80)
        x = self.concat2([x, c3])             # (B, 256, 80, 80)
        p3 = self.c3_fpn2(x)                  # (B, 128, 80, 80)

        # ---- PAN 自底向上 ----
        x = self.conv_n3(p3)                  # (B, 128, 40, 40)
        x = self.concat3([x, p4])             # (B, 384, 40, 40)
        n4 = self.c3_pan1(x)                  # (B, 256, 40, 40)

        x = self.conv_n4(n4)                  # (B, 256, 20, 20)
        x = self.concat4([x, p5])             # (B, 768, 20, 20)
        n5 = self.c3_pan2(x)                  # (B, 512, 20, 20)

        return p3, n4, n5


# ---------------------------------------------------------------------------
# 完整模型
# ---------------------------------------------------------------------------
class YOLOv5s(nn.Module):
    """
    YOLOv5-S 完整目标检测模型。

    前向流程：
      1. Backbone 提取 3 个尺度的特征图（P3, P4, P5）
      2. Neck 双向融合这些特征图
      3. Head 在每个尺度上预测边界框和类别

    输出：
      训练时返回 3 个张量的列表：
        - out[0]: (B, 3, 80, 80, 85)  <- P3，检测小目标
        - out[1]: (B, 3, 40, 40, 85)  <- P4，检测中等目标
        - out[2]: (B, 3, 20, 20, 85)  <- P5，检测大目标
    """

    def __init__(self, nc=NC, anchors=ANCHORS):
        super().__init__()
        self.backbone = Backbone()
        self.neck = Neck()
        self.head = Detect(
            nc=nc,
            anchors=anchors,
            ch=[
                _scale_channels(256),   # P3 输入通道数（128）
                _scale_channels(512),   # P4 输入通道数（256）
                _scale_channels(1024),  # P5 输入通道数（512）
            ]
        )

    def forward(self, x):
        c3, c4, c5 = self.backbone(x)     # 提取特征
        p3, p4, p5 = self.neck(c3, c4, c5)  # 融合特征
        return self.head([p3, p4, p5])    # 检测头预测


# ---------------------------------------------------------------------------
# 教育演示
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = YOLOv5s(nc=NC, anchors=ANCHORS)
    dummy = torch.randn(1, 3, INPUT_SIZE, INPUT_SIZE)
    out = model(dummy)

    print("=" * 60)
    print("YOLOv5-S 前向传播演示")
    print("=" * 60)
    print(f"输入图像尺寸:  {dummy.shape}")
    print(f"  -> batch=1, 3 通道(RGB), 高={INPUT_SIZE}, 宽={INPUT_SIZE}")
    print()

    scales = ["P3/8 (小目标)", "P4/16 (中等目标)", "P5/32 (大目标)"]
    for i, (o, name) in enumerate(zip(out, scales)):
        print(f"输出 {name}: {o.shape}")
        print(f"  -> 含义: (batch={o.shape[0]}, anchors={o.shape[1]}, "
              f"H={o.shape[2]}, W={o.shape[3]}, 数值={o.shape[4]})")
        print(f"  -> 数值组成: x, y, w, h, obj_conf, {NC} 个类别概率")
        print()

    total = sum(p.numel() for p in model.parameters())
    print(f"模型总参数量: {total:,} (~{total/1e6:.2f}M)")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # 读者练习（建议动手尝试）
    # -----------------------------------------------------------------------
    print("""
【读者练习】
1. 修改 NC=20，模拟 VOC 数据集，观察输出通道数变化。
2. 将输入尺寸改为 320x320，观察三个输出特征图的尺寸如何变化。
3. 尝试将 C3 块中的 shortcut=False，对比参数量和推理速度。
4. 在 Backbone 中打印每层输出形状，理解下采样过程。
""")
