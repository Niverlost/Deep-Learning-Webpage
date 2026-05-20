"""
Faster R-CNN: Towards Real-Time Object Detection with Region Proposal Networks
Shaoqing Ren, Kaiming He, Ross Girshick, Jian Sun
2015 (NeurIPS 2015)
arXiv: https://arxiv.org/abs/1506.01497

本文件是面向初学者的教程版实现，包含大量中文注释，帮助理解 Faster R-CNN 的每个模块。

【什么是 Faster R-CNN？】
Faster R-CNN 是一个两阶段目标检测网络：
  1. 第一阶段 (RPN): 在特征图上滑动一个小网络，预测"物体可能出现的位置"（候选框）。
  2. 第二阶段 (Fast R-CNN): 将候选框对应的特征提取出来，做分类和精细的框回归。

【核心创新】
- RPN (Region Proposal Network): 用神经网络替代传统算法（如 Selective Search）生成候选框。
- Anchor: 在每个位置预设 k 个不同大小/长宽比的参考框，网络只预测相对偏移。
- 共享特征: RPN 和 Fast R-CNN 共享同一个 CNN 主干，计算量大幅降低。
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# 配置常数（论文中的超参数）
# ---------------------------------------------------------------------------
RPN_N = 3                     # RPN 滑动窗口大小: 3x3
RPN_FEAT_DIM = 512            # 3x3卷积后的特征维度 (ResNet-50 用 512)
NUM_ANCHORS = 9               # 每个位置的 anchor 数量 = 3种尺度 x 3种长宽比
NUM_CLASSES = 21              # 检测类别数 (VOC: 20类 + 1背景; COCO: 80类 + 1背景)
ROI_POOL_SIZE = 7             # RoI Pooling 输出尺寸: 7x7
FC_DIM = 1024                 # Fast R-CNN 全连接层维度

ANCHOR_SCALES = (128, 256, 512)    # anchor 的三种尺度（像素）
ANCHOR_RATIOS = (0.5, 1.0, 2.0)    # anchor 的三种长宽比


# ---------------------------------------------------------------------------
# 关键概念：Anchor（锚框）
# ---------------------------------------------------------------------------
# 论文提出 Anchor 机制来解决多尺度检测问题。
# 传统方法需要构建图像金字塔或多尺度滤波器，计算量大。
# Faster R-CNN 在每个滑动窗口位置预设 k=9 个 anchor（3尺度 x 3比例），
# 网络只需预测每个 anchor 的"前景/背景"概率和相对于 anchor 的坐标偏移。
# 这相当于在特征图上构建了一个"回归参考金字塔"。


# ---------------------------------------------------------------------------
# ResNet-50 主干网络（共享卷积层）
# ---------------------------------------------------------------------------
class Bottleneck(nn.Module):
    """
    ResNet-50 的瓶颈残差块 (Bottleneck Residual Block)。
    包含 1x1 -> 3x3 -> 1x1 三层卷积，中间层降维/升维以减少计算量。
    """
    expansion = 4  # 输出通道数 = 输入通道数 x 4

    def __init__(self, in_planes, planes, stride=1):
        super().__init__()
        # 1x1 卷积: 降维
        self.conv1 = nn.Conv2d(in_planes, planes, kernel_size=1, bias=False)
        self.bn1 = nn.BatchNorm2d(planes)
        # 3x3 卷积: 提取空间特征（可能下采样）
        self.conv2 = nn.Conv2d(planes, planes, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(planes)
        # 1x1 卷积: 升维到 4*planes
        self.conv3 = nn.Conv2d(planes, planes * self.expansion, kernel_size=1, bias=False)
        self.bn3 = nn.BatchNorm2d(planes * self.expansion)
        self.relu = nn.ReLU(inplace=True)

        # 捷径连接 (shortcut): 当输入输出维度不匹配时，用 1x1 卷积投影
        self.shortcut = nn.Sequential()
        if stride != 1 or in_planes != planes * self.expansion:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_planes, planes * self.expansion, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(planes * self.expansion),
            )

    def forward(self, x):
        out = self.relu(self.bn1(self.conv1(x)))   # 1x1 降维
        out = self.relu(self.bn2(self.conv2(out))) # 3x3 特征提取
        out = self.bn3(self.conv3(out))             # 1x1 升维
        out += self.shortcut(x)                     # 残差连接: F(x) + x
        out = self.relu(out)
        return out


class ResNet50Backbone(nn.Module):
    """
    ResNet-50 主干网络，只取到 conv4 (即 layer3)。
    原因: Faster R-CNN 使用 C4 特征图，输出步长 (stride) = 16。
    输入 800x800 -> conv1 (s2) -> maxpool (s2) -> layer1 -> layer2 (s2) -> layer3 (s2)
    最终特征图大小约为 50x50。
    """

    def __init__(self):
        super().__init__()
        self.in_planes = 64

        # 初始卷积: 7x7, stride=2, 将分辨率减半
        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        # 最大池化: 3x3, stride=2, 分辨率再减半
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        # 四个残差阶段 (layer1~layer4)
        # layer1: 3个 Bottleneck, 输出 256通道, stride=1
        self.layer1 = self._make_layer(64, 3, stride=1)
        # layer2: 4个 Bottleneck, 输出 512通道, stride=2 (下采样)
        self.layer2 = self._make_layer(128, 4, stride=2)
        # layer3: 6个 Bottleneck, 输出 1024通道, stride=2 (下采样)
        self.layer3 = self._make_layer(256, 6, stride=2)
        # layer4 被省略: Faster R-CNN 的 Fast R-CNN head 直接接在 C4 后面

    def _make_layer(self, planes, num_blocks, stride):
        """构建一个残差阶段。"""
        layers = [Bottleneck(self.in_planes, planes, stride)]
        self.in_planes = planes * Bottleneck.expansion
        for _ in range(1, num_blocks):
            layers.append(Bottleneck(self.in_planes, planes, stride=1))
        return nn.Sequential(*layers)

    def forward(self, x):
        # 输入 x: (N, 3, H, W)
        x = self.conv1(x)      # (N, 64, H/2, W/2)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)    # (N, 64, H/4, W/4)
        x = self.layer1(x)     # (N, 256, H/4, W/4)
        x = self.layer2(x)     # (N, 512, H/8, W/8)
        x = self.layer3(x)     # (N, 1024, H/16, W/16)  <-- C4 特征
        return x


# ---------------------------------------------------------------------------
# RPN (Region Proposal Network) 区域提议网络
# ---------------------------------------------------------------------------
class RPN(nn.Module):
    """
    RPN 是 Faster R-CNN 的第一阶段，是一个全卷积网络 (FCN)。
    它在共享特征图上滑动一个 3x3 的小网络，每个位置预测 k 个 anchor 的:
      - 前景/背景分数 (cls)
      - 框回归偏移量 (reg)
    """

    def __init__(self, in_channels, feat_dim=RPN_FEAT_DIM, num_anchors=NUM_ANCHORS):
        super().__init__()
        self.num_anchors = num_anchors

        # 3x3 滑动窗口卷积: 提取每个位置的局部特征
        # 论文中 n=3, 有效感受野在输入图像上很大 (VGG: 228像素)
        self.conv = nn.Conv2d(in_channels, feat_dim, kernel_size=RPN_N, padding=RPN_N // 2)
        self.relu = nn.ReLU(inplace=True)

        # 两个并行的 1x1 卷积层（论文中的 "sibling fully-connected layers"）
        # 由于滑动窗口共享权重，FC 层自然实现为 1x1 卷积
        self.cls_logits = nn.Conv2d(feat_dim, num_anchors * 2, kernel_size=1)
        # 输出 2k: 每个 anchor 的前景/背景分数 (softmax 二分类)

        self.bbox_pred = nn.Conv2d(feat_dim, num_anchors * 4, kernel_size=1)
        # 输出 4k: 每个 anchor 的坐标偏移 (dx, dy, dw, dh)

    def forward(self, features):
        """
        参数:
            features: 主干网络输出的特征图 (N, C, H, W)
        返回:
            logits:   (N, H*W*k, 2)   前景/背景分数
            bbox_reg: (N, H*W*k, 4)   框回归偏移
        """
        x = self.relu(self.conv(features))

        # cls 分支: (N, 2*A, H, W)
        logits = self.cls_logits(x)
        # reg 分支: (N, 4*A, H, W)
        bbox_reg = self.bbox_pred(x)

        # reshape 为每个 anchor 的预测
        N, _, H, W = logits.shape
        # (N, 2, A, H, W) -> (N, H, W, A, 2) -> (N, H*W*A, 2)
        logits = logits.view(N, 2, self.num_anchors, H, W).permute(0, 3, 4, 2, 1).contiguous()
        logits = logits.view(N, -1, 2)

        # (N, 4, A, H, W) -> (N, H, W, A, 4) -> (N, H*W*A, 4)
        bbox_reg = bbox_reg.view(N, 4, self.num_anchors, H, W).permute(0, 3, 4, 2, 1).contiguous()
        bbox_reg = bbox_reg.view(N, -1, 4)

        return logits, bbox_reg


# ---------------------------------------------------------------------------
# RoI Pooling
# ---------------------------------------------------------------------------
class RoIPool(nn.Module):
    """
    RoI Pooling 将不同大小的候选框特征转换为固定大小 (如 7x7)。
    原理: 将每个 RoI 量化为特征图上的网格，然后在每个网格内做最大池化。
    这是 Fast R-CNN 的关键层，使得后续全连接层可以处理变长输入。
    """

    def __init__(self, output_size, spatial_scale):
        super().__init__()
        self.output_size = output_size if isinstance(output_size, tuple) else (output_size, output_size)
        self.spatial_scale = spatial_scale  # 图像坐标到特征图坐标的缩放比例

    def forward(self, features, rois):
        """
        参数:
            features: (N, C, H, W) 共享特征图
            rois: (M, 5) 候选框 [batch_idx, x1, y1, x2, y2]（图像坐标）
        返回:
            pooled: (M, C, output_h, output_w) 固定大小的特征
        """
        if rois.numel() == 0:
            return torch.empty(0, features.size(1), self.output_size[0], self.output_size[1], device=features.device)

        output = []
        for roi in rois:
            batch_idx = int(roi[0].item())
            x1, y1, x2, y2 = roi[1:].tolist()

            # 将图像坐标映射到特征图坐标
            x1 = int(x1 * self.spatial_scale)
            y1 = int(y1 * self.spatial_scale)
            x2 = max(int(x2 * self.spatial_scale), x1 + 1)
            y2 = max(int(y2 * self.spatial_scale), y1 + 1)

            # 提取对应区域的特征
            roi_feature = features[batch_idx:batch_idx + 1, :, y1:y2, x1:x2]
            # 自适应最大池化到固定大小
            pooled = F.adaptive_max_pool2d(roi_feature, self.output_size)
            output.append(pooled)

        return torch.cat(output, dim=0)


# ---------------------------------------------------------------------------
# Fast R-CNN Head
# ---------------------------------------------------------------------------
class FastRCNNHead(nn.Module):
    """
    Fast R-CNN 的第二阶段：对 RoI Pooling 后的特征做分类和精细回归。
    结构: 两个全连接层 (FC) + 两个并行输出分支。
      - cls 分支: 输出 (C+1) 类概率（含背景）
      - reg 分支: 输出 4*C 个坐标偏移（每类一个框）
    """

    def __init__(self, in_channels, roi_size, num_classes, fc_dim=FC_DIM):
        super().__init__()
        # 将 7x7 的特征图展平后接 FC
        self.fc1 = nn.Linear(in_channels * roi_size * roi_size, fc_dim)
        self.fc2 = nn.Linear(fc_dim, fc_dim)
        self.relu = nn.ReLU(inplace=True)

        # 分类层: (C + 1) 类（含背景）
        self.cls_score = nn.Linear(fc_dim, num_classes)
        # 回归层: 每类 4 个坐标偏移 -> 共 4*C
        self.bbox_pred = nn.Linear(fc_dim, num_classes * 4)

    def forward(self, x):
        """
        参数:
            x: (M, C, roi_size, roi_size) RoI Pooling 输出
        返回:
            cls_logits: (M, num_classes) 未归一化的类别分数
            bbox_deltas: (M, num_classes * 4) 每类的框回归偏移
        """
        x = torch.flatten(x, start_dim=1)  # (M, C*roi_size*roi_size)
        x = self.relu(self.fc1(x))         # (M, fc_dim)
        x = self.relu(self.fc2(x))         # (M, fc_dim)

        cls_logits = self.cls_score(x)     # (M, num_classes)
        bbox_deltas = self.bbox_pred(x)    # (M, num_classes * 4)
        return cls_logits, bbox_deltas


# ---------------------------------------------------------------------------
# 完整的 Faster R-CNN 模型
# ---------------------------------------------------------------------------
class FasterRCNN(nn.Module):
    """
    Faster R-CNN 完整模型 = ResNet-50 主干 + RPN + RoI Pooling + Fast R-CNN Head。

    前向流程:
      1. 图像经过 ResNet-50 主干 -> C4 特征图 (stride=16)
      2. RPN 在特征图上滑动 -> 预测 anchor 的前景/背景分数和框偏移
      3. 根据 RPN 输出选取 Top-K 候选框 (实际推理中需 NMS)
      4. RoI Pooling 将候选框特征转为固定大小 7x7
      5. Fast R-CNN Head 对每个 RoI 分类并精细回归框位置
    """

    def __init__(self, num_classes=NUM_CLASSES, roi_pool_size=ROI_POOL_SIZE):
        super().__init__()
        self.num_classes = num_classes
        self.roi_pool_size = roi_pool_size

        # 主干网络: ResNet-50 到 C4
        self.backbone = ResNet50Backbone()
        # C4 输出通道数 = 256 * 4 = 1024
        # RPN: 输入 1024 通道，输出 2k 分数 + 4k 坐标
        self.rpn = RPN(in_channels=1024, feat_dim=RPN_FEAT_DIM, num_anchors=NUM_ANCHORS)
        # RoI Pooling: 将特征图坐标缩放 1/16
        self.roi_pool = RoIPool(output_size=roi_pool_size, spatial_scale=1.0 / 16.0)
        # Fast R-CNN Head
        self.head = FastRCNNHead(in_channels=1024, roi_size=roi_pool_size, num_classes=num_classes, fc_dim=FC_DIM)

    def forward(self, images, proposals=None):
        """
        参数:
            images: (N, 3, H, W) 输入图像
            proposals: 可选，外部传入的候选框 (M, 5)。若为 None，使用 dummy proposals。
        返回:
            rpn_logits:   (N, H*W*k, 2)   RPN 前景/背景分数
            rpn_bbox_reg: (N, H*W*k, 4)   RPN 框回归偏移
            cls_logits:   (M, num_classes) Fast R-CNN 类别分数
            bbox_deltas:  (M, num_classes*4) Fast R-CNN 框回归偏移
        """
        # 1. 特征提取
        features = self.backbone(images)

        # 2. RPN 预测
        rpn_logits, rpn_bbox_reg = self.rpn(features)

        # 3. 候选框生成（实际推理中应使用 NMS 从 RPN 输出筛选）
        if proposals is None:
            N = images.size(0)
            # 这里用 dummy proposals 做形状验证
            proposals = torch.tensor([[i, 50, 50, 200, 200] for i in range(N)], dtype=torch.float32, device=images.device)

        # 4. RoI Pooling
        pooled = self.roi_pool(features, proposals)

        # 5. Fast R-CNN Head
        cls_logits, bbox_deltas = self.head(pooled)

        return rpn_logits, rpn_bbox_reg, cls_logits, bbox_deltas


# ---------------------------------------------------------------------------
# 教育演示 (Educational Demo)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # 创建模型
    model = FasterRCNN(num_classes=NUM_CLASSES)

    # 模拟输入: 2张 800x800 的图像
    dummy = torch.randn(2, 3, 800, 800)

    # 前向传播
    rpn_cls, rpn_reg, cls_logits, bbox_deltas = model(dummy)

    # 统计参数量
    total_params = sum(p.numel() for p in model.parameters())

    print("=" * 60)
    print("Faster R-CNN 教程版 - 前向传播形状验证")
    print("=" * 60)
    print(f"输入图像形状:        {dummy.shape}")
    print(f"RPN 分类输出:        {rpn_cls.shape}  (每张图 H*W*9 个 anchor 的前景/背景分数)")
    print(f"RPN 回归输出:        {rpn_reg.shape}  (每张图 H*W*9 个 anchor 的坐标偏移)")
    print(f"Fast R-CNN 分类:     {cls_logits.shape}  (每个 proposal 的 21 类分数)")
    print(f"Fast R-CNN 回归:     {bbox_deltas.shape}  (每类 4 个坐标偏移)")
    print(f"总参数量:            {total_params:,} (~{total_params / 1e6:.1f}M)")
    print("=" * 60)

    # 形状计算说明
    # 输入 800x800 -> backbone (stride=16) -> 特征图约 50x50
    # anchor 数量 = 50 * 50 * 9 = 22,500
    print("\n【形状计算验证】")
    print(f"特征图大小约: 800/16 = {800//16} x {800//16}")
    print(f"Anchor 总数:  {800//16} x {800//16} x {NUM_ANCHORS} = {(800//16)**2 * NUM_ANCHORS}")
    print(f"RPN cls 第二维: {rpn_cls.shape[1]} (应约等于 {(800//16)**2 * NUM_ANCHORS})")

    # -----------------------------------------------------------------------
    # 课后练习 (Exercise)
    # -----------------------------------------------------------------------
    print("\n【课后练习】")
    print("1. 尝试修改 ANCHOR_SCALES 和 ANCHOR_RATIOS，观察 RPN 输出形状变化。")
    print("2. 将 backbone 换成 VGG-16，需要修改哪些层？")
    print("3. 思考: 为什么 RPN 的 cls 输出是 2k 而不是 k 个分数？")
    print("   提示: 论文使用 softmax 二分类区分前景/背景，而非 sigmoid。")
    print("4. 尝试实现 NMS (非极大值抑制) 来替代 dummy proposals。")
