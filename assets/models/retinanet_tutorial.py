"""
Focal Loss for Dense Object Detection
Tsung-Yi Lin, Priya Goyal, Ross Girshick, Kaiming He, Piotr Dollar
ICCV 2017
arXiv: https://arxiv.org/abs/1708.02002

RetinaNet 初学者教程版实现

RetinaNet 是什么？
----------------
RetinaNet 是一个单阶段（one-stage）目标检测器。传统两阶段检测器（如 Faster R-CNN）
先生成候选框再分类，精度高但慢；单阶段检测器（如 YOLO、SSD）直接在密集网格上预测，
速度快但精度通常较低。RetinaNet 首次让单阶段检测器在精度上超越了两阶段检测器。

核心创新：
1. Focal Loss —— 解决单阶段检测器中极端 foreground-background 样本不平衡问题
2. FPN (Feature Pyramid Network) —— 多尺度特征融合，同时检测大目标和小目标
3. 两个共享权重的子网络 —— 分别预测类别和边界框偏移

关键概念：
- Anchor：在每个特征图位置上预设的一组参考框（3种尺度 × 3种长宽比 = 9个）
- FPN：从深层到浅层逐层上采样融合，生成 P3~P7 五个尺度特征图
- 分类子网：4层 3×3 卷积 + 1层输出 K×A 通道（K=类别数，A=anchor数）
- 回归子网：4层 3×3 卷积 + 1层输出 4×A 通道（4=框的偏移量参数）
"""

import math
import torch
import torch.nn as nn


# ============================
# 配置常量
# ============================

C = 80
# 类别数（不包含背景）。COCO 数据集有 80 个物体类别，背景通过 sigmoid 的 0 概率隐式表示

A = 9
# 每个特征图位置上的 anchor 数量 = 3 种尺度 × 3 种长宽比

FPN_OUT_CHANNELS = 256
# FPN 输出的通道数，也是两个子网络的输入通道数。论文中所有特征层统一为 256 通道


# ============================
# ResNet-50 Backbone
# ============================

class Bottleneck(nn.Module):
    """
    ResNet-50 的基本构建块 —— Bottleneck（瓶颈残差块）

    为什么叫 Bottleneck？
    因为中间层的通道数（planes）远小于输入/输出的通道数（planes * 4），
    形状像一个瓶颈：宽 -> 窄 -> 宽。

    结构：1×1 降维 -> 3×3 卷积 -> 1×1 升维
    相比直接使用两个 3×3 卷积，参数量大幅减少，计算更高效。
    """
    expansion = 4
    # 输出通道数是中间通道数的 4 倍

    def __init__(self, in_planes, planes, stride=1, downsample=None):
        super().__init__()
        # 第一层 1×1 卷积：降维，减少后续 3×3 卷积的计算量
        self.conv1 = nn.Conv2d(in_planes, planes, kernel_size=1, bias=False)
        self.bn1 = nn.BatchNorm2d(planes)

        # 第二层 3×3 卷积：提取空间特征，stride 控制下采样
        self.conv2 = nn.Conv2d(planes, planes, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(planes)

        # 第三层 1×1 卷积：升维回 4×planes
        self.conv3 = nn.Conv2d(planes, planes * self.expansion, kernel_size=1, bias=False)
        self.bn3 = nn.BatchNorm2d(planes * self.expansion)

        self.relu = nn.ReLU(inplace=True)
        self.downsample = downsample
        # 当输入输出尺寸不匹配时（stride>1 或通道数不同），用 1×1 卷积对 shortcut 做投影

    def forward(self, x):
        identity = x  # 保存输入，用于残差连接

        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)

        out = self.conv2(out)
        out = self.bn2(out)
        out = self.relu(out)

        out = self.conv3(out)
        out = self.bn3(out)

        # 如果尺寸不匹配，对 shortcut 做下采样/投影
        if self.downsample is not None:
            identity = self.downsample(x)

        out += identity  # 残差连接：F(x) + x
        out = self.relu(out)
        return out


class ResNet50(nn.Module):
    """
    ResNet-50 特征提取网络

    输入图像经过以下阶段：
    - conv1: 7×7 卷积，stride=2，将分辨率降为 1/4
    - maxpool: 3×3，stride=2，分辨率再降为 1/8
    - layer1 (c2): 3 个 Bottleneck，stride=1，输出 256 通道，分辨率 1/8
    - layer2 (c3): 4 个 Bottleneck，stride=2，输出 512 通道，分辨率 1/16
    - layer3 (c4): 6 个 Bottleneck，stride=2，输出 1024 通道，分辨率 1/32
    - layer4 (c5): 3 个 Bottleneck，stride=2，输出 2048 通道，分辨率 1/64

    RetinaNet 只使用 c3, c4, c5 送入 FPN。
    为什么不使用 c2？因为 c2 分辨率太高（1/8），计算开销大，且小目标在深层也有表示。
    """
    def __init__(self):
        super().__init__()
        self.in_planes = 64

        # 初始卷积层
        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        # 四个残差阶段
        self.layer1 = self._make_layer(64, 3, stride=1)   # c2
        self.layer2 = self._make_layer(128, 4, stride=2)  # c3
        self.layer3 = self._make_layer(256, 6, stride=2)  # c4
        self.layer4 = self._make_layer(512, 3, stride=2)  # c5

        # He 初始化（Kaiming 初始化），配合 ReLU 使用
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def _make_layer(self, planes, blocks, stride):
        """
        构建一个残差阶段（stage）

        Args:
            planes: 中间通道数
            blocks: Bottleneck 块的数量
            stride: 第一个块的 stride，控制是否下采样
        """
        downsample = None
        # 当 stride != 1（需要下采样）或输入输出通道数不匹配时，构建 shortcut 投影
        if stride != 1 or self.in_planes != planes * Bottleneck.expansion:
            downsample = nn.Sequential(
                nn.Conv2d(self.in_planes, planes * Bottleneck.expansion,
                          kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(planes * Bottleneck.expansion),
            )

        layers = []
        # 第一个 Bottleneck 可能带有下采样
        layers.append(Bottleneck(self.in_planes, planes, stride, downsample))
        self.in_planes = planes * Bottleneck.expansion

        # 后续 Bottleneck 保持尺寸不变
        for _ in range(1, blocks):
            layers.append(Bottleneck(self.in_planes, planes))

        return nn.Sequential(*layers)

    def forward(self, x):
        # 初始下采样：800×800 -> 400×400 -> 200×200
        x = self.conv1(x)      # [B, 64, H/2, W/2]
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)    # [B, 64, H/4, W/4]

        c2 = self.layer1(x)    # [B, 256, H/4, W/4]  (200×200 if input=800)
        c3 = self.layer2(c2)   # [B, 512, H/8, W/8]  (100×100)
        c4 = self.layer3(c3)   # [B, 1024, H/16, W/16] (50×50)
        c5 = self.layer4(c4)   # [B, 2048, H/32, W/32] (25×25)

        return c3, c4, c5


# ============================
# FPN (Feature Pyramid Network)
# ============================

class FPN(nn.Module):
    """
    特征金字塔网络

    为什么需要 FPN？
    深层特征（c5）语义信息丰富但空间分辨率低，适合检测大目标；
    浅层特征（c3）空间细节丰富但语义信息弱，适合检测小目标。
    FPN 通过自顶向下（top-down）路径和横向连接（lateral connection）融合多尺度特征，
    让每个尺度同时具备强语义和高分辨率。

    RetinaNet 的 FPN 与原始 FPN 论文的区别：
    1. 不使用 P2（从 c3 开始而非 c2），减少计算量
    2. P6 由 C5 经过 3×3 stride=2 卷积得到（而非最大池化）
    3. 额外增加 P7，由 P6 经过 ReLU + 3×3 stride=2 卷积得到
    """
    def __init__(self, in_channels_list, out_channels=256):
        super().__init__()
        # 横向连接：将 backbone 不同通道数的特征图统一为 out_channels
        self.lateral_c5 = nn.Conv2d(in_channels_list[2], out_channels, kernel_size=1)
        self.lateral_c4 = nn.Conv2d(in_channels_list[1], out_channels, kernel_size=1)
        self.lateral_c3 = nn.Conv2d(in_channels_list[0], out_channels, kernel_size=1)

        # 平滑卷积：融合后的特征图经过 3×3 卷积消除上采样带来的混叠效应
        self.smooth_p4 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
        self.smooth_p3 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)

        # P6: C5 经过 3×3 stride=2 卷积下采样
        self.p6 = nn.Conv2d(in_channels_list[2], out_channels, kernel_size=3, stride=2, padding=1)

        # P7: P6 经过 ReLU + 3×3 stride=2 卷积
        self.p7 = nn.Sequential(
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, stride=2, padding=1),
        )

        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_uniform_(m.weight, a=0)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def forward(self, c3, c4, c5):
        # 自顶向下路径
        p5 = self.lateral_c5(c5)   # [B, 256, H/32, W/32]

        # P4 = lateral_c4(c4) + upsample(P5)
        p4 = self.lateral_c4(c4)
        p4 = p4 + nn.functional.interpolate(p5, size=p4.shape[-2:], mode='nearest')
        p4 = self.smooth_p4(p4)    # [B, 256, H/16, W/16]

        # P3 = lateral_c3(c3) + upsample(P4)
        p3 = self.lateral_c3(c3)
        p3 = p3 + nn.functional.interpolate(p4, size=p3.shape[-2:], mode='nearest')
        p3 = self.smooth_p3(p3)    # [B, 256, H/8, W/8]

        # P6 和 P7 用于检测更大目标
        p6 = self.p6(c5)           # [B, 256, H/64, W/64]
        p7 = self.p7(p6)           # [B, 256, H/128, W/128]

        return p3, p4, p5, p6, p7


# ============================
# 分类子网络 (Classification Subnet)
# ============================

class ClassificationSubnet(nn.Module):
    """
    分类子网络：预测每个 anchor 属于每个类别的概率

    结构：
    - 4 个 3×3 卷积层，每个 256 通道，后接 ReLU
    - 1 个 3×3 卷积层，输出 K×A 通道（K=类别数，A=anchor数）
    - Sigmoid 激活（论文使用 sigmoid 而非 softmax，实现多标签分类）

    为什么用 sigmoid 而不是 softmax？
    因为目标检测中一个 anchor 可能同时属于多个类别的情况较少，
    但更关键的是 focal loss 是针对每个类别独立计算的，sigmoid 更自然。
    此外，sigmoid 避免了背景类占用一个通道，背景通过所有类别的低概率来表示。

    初始化技巧：
    分类卷积的 bias 初始化为 -log((1-pi)/pi)，其中 pi=0.01。
    这意味着训练开始时，模型预测每个 anchor 为前景的概率约为 0.01，
    与数据集中 foreground 的稀疏性一致，防止初始阶段被大量负样本淹没。
    """
    def __init__(self, num_classes=C, num_anchors=A, in_channels=256):
        super().__init__()
        self.num_classes = num_classes
        self.num_anchors = num_anchors

        # 4 个共享的 3×3 卷积层
        self.conv1 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.conv3 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.conv4 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)

        # 最终分类层：每个位置输出 K×A 个值
        self.cls = nn.Conv2d(in_channels, num_anchors * num_classes, kernel_size=3, padding=1)

        # 初始化：卷积权重用 N(0, 0.01)，bias 用特殊值
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.normal_(m.weight, mean=0, std=0.01)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

        pi = 0.01
        nn.init.constant_(self.cls.bias, -math.log((1 - pi) / pi))

    def forward(self, x):
        # 经过 4 层卷积 + ReLU，感受野逐渐增大
        x = nn.functional.relu(self.conv1(x))
        x = nn.functional.relu(self.conv2(x))
        x = nn.functional.relu(self.conv3(x))
        x = nn.functional.relu(self.conv4(x))
        x = self.cls(x)
        x = torch.sigmoid(x)  # 将输出转为概率
        return x


# ============================
# 回归子网络 (Box Regression Subnet)
# ============================

class BoxRegressionSubnet(nn.Module):
    """
    回归子网络：预测每个 anchor 到真实边界框的偏移量

    结构：
    - 4 个 3×3 卷积层，每个 256 通道，后接 ReLU
    - 1 个 3×3 卷积层，输出 4×A 通道

    输出 4 个值分别表示：
    - dx, dy: anchor 中心点相对于 GT 中心点的偏移（归一化后）
    - dw, dh: anchor 宽高相对于 GT 宽高的对数缩放因子

    注意：回归子网络与分类子网络结构几乎相同，但权重不共享！
    论文实验表明共享权重会降低性能。
    """
    def __init__(self, num_anchors=A, in_channels=256):
        super().__init__()
        self.num_anchors = num_anchors

        self.conv1 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.conv3 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.conv4 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)

        # 输出 4×A 通道：每个 anchor 预测 4 个回归参数
        self.reg = nn.Conv2d(in_channels, num_anchors * 4, kernel_size=3, padding=1)

        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.normal_(m.weight, mean=0, std=0.01)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def forward(self, x):
        x = nn.functional.relu(self.conv1(x))
        x = nn.functional.relu(self.conv2(x))
        x = nn.functional.relu(self.conv3(x))
        x = nn.functional.relu(self.conv4(x))
        x = self.reg(x)
        return x


# ============================
# RetinaNet 完整模型
# ============================

class RetinaNet(nn.Module):
    """
    RetinaNet 完整模型

    前向流程：
    1. 输入图像 [B, 3, H, W]
    2. ResNet-50 backbone 提取多尺度特征 c3, c4, c5
    3. FPN 融合生成 P3, P4, P5, P6, P7
    4. 分类子网和回归子网分别在每个 P 层上预测
    5. 输出：
       - cls_outs: 5 个张量，每个 [B, K×A, H_i, W_i]
       - reg_outs: 5 个张量，每个 [B, 4×A, H_i, W_i]

    Anchor 设置（论文）：
    - P3: 尺度 32，对应原图 32² 像素
    - P4: 尺度 64
    - P5: 尺度 128
    - P6: 尺度 256
    - P7: 尺度 512
    每层 3 个尺度 {2^0, 2^(1/3), 2^(2/3)} × 3 个比例 {1:2, 1:1, 2:1} = 9 个 anchor
    """
    def __init__(self, num_classes=C, num_anchors=A):
        super().__init__()
        self.backbone = ResNet50()
        self.fpn = FPN([512, 1024, 2048])  # c3, c4, c5 的通道数
        self.cls_subnet = ClassificationSubnet(num_classes, num_anchors)
        self.reg_subnet = BoxRegressionSubnet(num_anchors)

    def forward(self, x):
        # Backbone 特征提取
        c3, c4, c5 = self.backbone(x)

        # FPN 多尺度特征融合
        p3, p4, p5, p6, p7 = self.fpn(c3, c4, c5)

        # 在每个尺度上分别预测
        cls_outs = []
        reg_outs = []
        for p in (p3, p4, p5, p6, p7):
            cls_outs.append(self.cls_subnet(p))
            reg_outs.append(self.reg_subnet(p))

        return cls_outs, reg_outs


# ============================
# 主程序：教育演示
# ============================

if __name__ == "__main__":
    # 创建模型
    model = RetinaNet(num_classes=80, num_anchors=9)

    # 模拟输入：batch=2，3 通道，800×800 图像
    x = torch.randn(2, 3, 800, 800)

    # 前向传播
    cls_outs, reg_outs = model(x)

    print("=" * 60)
    print("RetinaNet 前向传播演示")
    print("=" * 60)
    print(f"\n输入图像尺寸: {x.shape}")
    print(f"  batch size: {x.shape[0]}")
    print(f"  通道数: {x.shape[1]} (RGB)")
    print(f"  高×宽: {x.shape[2]}×{x.shape[3]}")

    print("\n各 FPN 层输出尺寸:")
    for i, (cls, reg) in enumerate(zip(cls_outs, reg_outs)):
        level = i + 3
        print(f"  P{level}: 分类 {cls.shape} | 回归 {reg.shape}")
        # 解释每个尺度的空间分辨率
        h, w = cls.shape[2], cls.shape[3]
        total_anchors = h * w * A
        print(f"        -> 空间分辨率 {h}×{w}，该层 anchor 总数: {total_anchors}")

    total_anchors_all = sum(c.shape[2] * c.shape[3] * A for c in cls_outs)
    print(f"\n全部 5 层 anchor 总数: {total_anchors_all}")

    total_params = sum(p.numel() for p in model.parameters())
    print(f"\n模型总参数量: {total_params / 1e6:.2f}M")
    print("  (ResNet-50-FPN 约 36M，其中 backbone 占大部分)")

    print("\n" + "=" * 60)
    print("练习题（供读者尝试）：")
    print("=" * 60)
    print("1. 修改 num_classes=20，模拟 PASCAL VOC 数据集")
    print("2. 修改 num_anchors=3，只使用一种尺度和三种长宽比")
    print("3. 将 backbone 替换为 ResNet-101，观察参数量变化")
    print("4. 在 ClassificationSubnet 的 conv 层后添加 BatchNorm，观察输出变化")
    print("5. 尝试不同的输入尺寸（如 600×600 或 1333×800），看各层分辨率如何变化")
