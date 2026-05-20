"""
Mask R-CNN
Kaiming He, Georgia Gkioxari, Piotr Dollar, Ross Girshick
2017 (ICCV 2017)
arXiv: https://arxiv.org/abs/1703.06870

初学者教程版 (Beginner-friendly educational code)

本模型解决什么问题？
- 实例分割 (Instance Segmentation): 在一张图中检测出所有目标，并给每个目标画出精确的像素级掩码 (mask)。
- 与目标检测 (Faster R-CNN) 的区别：不仅输出边界框和类别，还为每个实例生成一个分割掩码。

关键创新点 (Key Concepts):
1. RoI Align: 用双线性插值替代 RoI Pooling 中的量化操作，解决了特征错位 (misalignment) 问题，使掩码边缘更精确。
2. 并行 Mask Head: 在 Fast R-CNN 的分类/回归分支之外，增加一个全卷积的 mask 预测分支，二者并行计算。
3. FPN (Feature Pyramid Network): 利用多尺度特征金字塔，提升对不同大小目标的检测能力。
4. 解耦掩码与类别：Mask 分支为每个类别预测一个掩码 (K x 28 x 28)，但训练时只使用 ground-truth 类别的掩码计算损失；推理时使用分类分支预测的类别来选取对应掩码。
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# 配置常量 (与论文一致)
# ---------------------------------------------------------------------------
NUM_CLASSES = 81               # COCO 数据集: 80 个前景类 + 1 个背景类
RPN_N = 3                      # RPN 滑动窗口大小 (3x3)
RPN_FEAT_DIM = 256             # FPN 输出通道数，也是 RPN 中间特征维度
NUM_ANCHORS = 3                # 每个 FPN 层级的锚框数量 (论文实际使用更多，这里取 3 便于理解)
ANCHOR_SCALES = (32, 64, 128, 256, 512)  # 锚框的尺度，对应 FPN 的 P2~P6

ROI_ALIGN_SIZE_CLS = 7         # 用于分类/回归头的 RoI Align 输出尺寸
ROI_ALIGN_SIZE_MASK = 14       # 用于 Mask 头的 RoI Align 输出尺寸
FPN_OUT_CHANNELS = 256         # FPN 所有输出层的统一通道数

MASK_HEAD_CONV = 256           # Mask Head 中卷积层的通道数
MASK_UPSAMPLE_CHANNELS = 256   # 反卷积层输出通道数
MASK_OUTPUT_SIZE = 28          # 最终掩码的空间分辨率 (28x28)


# ---------------------------------------------------------------------------
# ResNet-50 Backbone (骨干网络)
# ---------------------------------------------------------------------------
class Bottleneck(nn.Module):
    """
    ResNet-50 的 Bottleneck 残差块。
    由 1x1 -> 3x3 -> 1x1 三个卷积层组成，中间用 BatchNorm 和 ReLU 激活。
    shortcut 连接用于缓解梯度消失，使网络可以训练得更深。
    """
    expansion = 4  # 输出通道数是中间通道数的 4 倍

    def __init__(self, in_planes, planes, stride=1):
        super().__init__()
        # 1x1 降维
        self.conv1 = nn.Conv2d(in_planes, planes, kernel_size=1, bias=False)
        self.bn1 = nn.BatchNorm2d(planes)
        # 3x3 提取空间特征
        self.conv2 = nn.Conv2d(planes, planes, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(planes)
        # 1x1 升维
        self.conv3 = nn.Conv2d(planes, planes * self.expansion, kernel_size=1, bias=False)
        self.bn3 = nn.BatchNorm2d(planes * self.expansion)
        self.relu = nn.ReLU(inplace=True)

        # shortcut: 当维度变化时，用 1x1 卷积对齐通道和空间尺寸
        self.shortcut = nn.Sequential()
        if stride != 1 or in_planes != planes * self.expansion:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_planes, planes * self.expansion, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(planes * self.expansion),
            )

    def forward(self, x):
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.relu(self.bn2(self.conv2(out)))
        out = self.bn3(self.conv3(out))
        out += self.shortcut(x)  # 残差连接
        out = self.relu(out)
        return out


class ResNet50Backbone(nn.Module):
    """
    ResNet-50 骨干网络。
    输入: (N, 3, H, W)
    输出: C2, C3, C4, C5 四个阶段的特征图，供 FPN 使用。

    各阶段下采样率:
    - C2: stride 4  (原图 1/4)
    - C3: stride 8  (原图 1/8)
    - C4: stride 16 (原图 1/16)
    - C5: stride 32 (原图 1/32)
    """

    def __init__(self):
        super().__init__()
        self.in_planes = 64

        # 初始卷积: 7x7, stride=2, 快速降低分辨率
        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        # 四个残差阶段
        self.layer1 = self._make_layer(64, 3, stride=1)   # C2: 256 通道
        self.layer2 = self._make_layer(128, 4, stride=2)  # C3: 512 通道
        self.layer3 = self._make_layer(256, 6, stride=2)  # C4: 1024 通道
        self.layer4 = self._make_layer(512, 3, stride=2)  # C5: 2048 通道

    def _make_layer(self, planes, num_blocks, stride):
        layers = [Bottleneck(self.in_planes, planes, stride)]
        self.in_planes = planes * Bottleneck.expansion
        for _ in range(1, num_blocks):
            layers.append(Bottleneck(self.in_planes, planes, stride=1))
        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.conv1(x)    # (N, 64, H/2, W/2)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)  # (N, 64, H/4, W/4)

        c2 = self.layer1(x)  # (N, 256, H/4, W/4)
        c3 = self.layer2(c2) # (N, 512, H/8, W/8)
        c4 = self.layer3(c3) # (N, 1024, H/16, W/16)
        c5 = self.layer4(c4) # (N, 2048, H/32, W/32)
        return c2, c3, c4, c5


# ---------------------------------------------------------------------------
# FPN (Feature Pyramid Network, 特征金字塔网络)
# ---------------------------------------------------------------------------
class FPN(nn.Module):
    """
    FPN 通过自顶向下 (top-down) 的路径和横向连接 (lateral connections)，
    将深层语义特征与浅层位置特征融合，生成多尺度特征金字塔。

    输入: C2(256), C3(512), C4(1024), C5(2048)
    输出: P2, P3, P4, P5, P6 (全部为 256 通道)
    - P2~P5 用于 RPN 和后续检测/分割
    - P6 仅由 P5 下采样得到，用于检测更大目标
    """

    def __init__(self, in_channels_list=(256, 512, 1024, 2048), out_channels=FPN_OUT_CHANNELS):
        super().__init__()
        # 横向连接: 1x1 卷积统一通道数为 256
        self.lateral_c2 = nn.Conv2d(in_channels_list[0], out_channels, kernel_size=1)
        self.lateral_c3 = nn.Conv2d(in_channels_list[1], out_channels, kernel_size=1)
        self.lateral_c4 = nn.Conv2d(in_channels_list[2], out_channels, kernel_size=1)
        self.lateral_c5 = nn.Conv2d(in_channels_list[3], out_channels, kernel_size=1)

        # 平滑卷积: 3x3 消除上采样带来的混叠效应
        self.smooth_p2 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
        self.smooth_p3 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
        self.smooth_p4 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
        self.smooth_p5 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)

        # P6 由 P5 最大池化得到 (stride=2)
        self.maxpool_p6 = nn.MaxPool2d(kernel_size=1, stride=2)

    def forward(self, c2, c3, c4, c5):
        # 自顶向下: 先处理深层，再上采样并与浅层融合
        p5 = self.lateral_c5(c5)
        p4 = self.lateral_c4(c4) + F.interpolate(p5, size=c4.shape[-2:], mode="nearest")
        p3 = self.lateral_c3(c3) + F.interpolate(p4, size=c3.shape[-2:], mode="nearest")
        p2 = self.lateral_c2(c2) + F.interpolate(p3, size=c2.shape[-2:], mode="nearest")

        # 平滑处理
        p2 = self.smooth_p2(p2)
        p3 = self.smooth_p3(p3)
        p4 = self.smooth_p4(p4)
        p5 = self.smooth_p5(p5)
        p6 = self.maxpool_p6(p5)

        return p2, p3, p4, p5, p6


# ---------------------------------------------------------------------------
# RPN (Region Proposal Network, 区域提议网络)
# ---------------------------------------------------------------------------
class RPNHead(nn.Module):
    """
    RPN 在每个 FPN 层级上共享结构但不共享参数。
    3x3 滑动窗口提取特征，然后分两支:
    - cls: 预测每个锚框是否包含目标 (1 通道，用 sigmoid 等价于 2 分类)
    - reg: 预测每个锚框的坐标偏移 (4 通道)
    """

    def __init__(self, in_channels=FPN_OUT_CHANNELS, feat_dim=RPN_FEAT_DIM, num_anchors=NUM_ANCHORS):
        super().__init__()
        self.num_anchors = num_anchors
        self.conv = nn.Conv2d(in_channels, feat_dim, kernel_size=3, padding=1)
        self.relu = nn.ReLU(inplace=True)
        self.cls_logits = nn.Conv2d(feat_dim, num_anchors, kernel_size=1)      # 前景/背景分数
        self.bbox_pred = nn.Conv2d(feat_dim, num_anchors * 4, kernel_size=1)   # 坐标回归

    def forward(self, x):
        x = self.relu(self.conv(x))
        logits = self.cls_logits(x)   # (N, A, H, W)
        bbox_reg = self.bbox_pred(x)  # (N, A*4, H, W)
        return logits, bbox_reg


# ---------------------------------------------------------------------------
# RoI Align (关键改进: 双线性插值，无量化)
# ---------------------------------------------------------------------------
def _roi_align_single(features, roi, output_size, spatial_scale, sampling_ratio=2):
    """
    单 RoI 的 RoI Align 实现。
    与 RoI Pooling 的核心区别:
    - RoI Pooling: 将浮点坐标量化为整数，导致特征错位。
    - RoI Align: 保留浮点坐标，在每个 bin 内均匀采样若干点，用双线性插值计算特征值。

    features: (C, H, W)
    roi: (5,) [batch_idx, x1, y1, x2, y2]
    sampling_ratio: 每个 bin 内采样点数 (sampling_ratio x sampling_ratio)
    """
    C, H, W = features.shape
    out_h, out_w = (output_size, output_size) if isinstance(output_size, int) else output_size

    # 将 RoI 坐标映射到特征图尺度
    x1, y1, x2, y2 = roi[1:] * spatial_scale
    roi_w = max(x2 - x1, 1.0)
    roi_h = max(y2 - y1, 1.0)

    bin_w = roi_w / out_w
    bin_h = roi_h / out_h

    output = torch.zeros(C, out_h, out_w, device=features.device, dtype=features.dtype)
    for i in range(out_h):
        for j in range(out_w):
            # 当前 bin 的边界
            y_start = y1 + i * bin_h
            x_start = x1 + j * bin_w
            y_end = y_start + bin_h
            x_end = x_start + bin_w

            # 在 bin 内均匀采样 sampling_ratio x sampling_ratio 个点
            ys = torch.linspace(y_start + bin_h / (2 * sampling_ratio),
                                y_end - bin_h / (2 * sampling_ratio),
                                sampling_ratio, device=features.device)
            xs = torch.linspace(x_start + bin_w / (2 * sampling_ratio),
                                x_end - bin_w / (2 * sampling_ratio),
                                sampling_ratio, device=features.device)

            vals = []
            for yy in ys:
                for xx in xs:
                    # 限制在特征图范围内
                    xx = xx.clamp(0, W - 1)
                    yy = yy.clamp(0, H - 1)

                    # 双线性插值的四个邻近像素
                    x0 = int(xx.floor().item())
                    x1p = min(x0 + 1, W - 1)
                    y0 = int(yy.floor().item())
                    y1p = min(y0 + 1, H - 1)

                    # 双线性权重
                    wa = (x1p - xx) * (y1p - yy)
                    wb = (xx - x0) * (y1p - yy)
                    wc = (x1p - xx) * (yy - y0)
                    wd = (xx - x0) * (yy - y0)

                    val = (features[:, y0, x0] * wa +
                           features[:, y0, x1p] * wb +
                           features[:, y1p, x0] * wc +
                           features[:, y1p, x1p] * wd)
                    vals.append(val)
            # 取采样点的平均值作为该 bin 的特征
            output[:, i, j] = sum(vals) / len(vals)
    return output


class RoIAlign(nn.Module):
    """
    RoI Align 模块。
    相比 RoI Pooling，RoI Align 不进行任何量化，使用双线性插值精确提取特征，
    这对像素级的掩码分割至关重要。
    """

    def __init__(self, output_size, spatial_scale, sampling_ratio=2):
        super().__init__()
        self.output_size = output_size
        self.spatial_scale = spatial_scale
        self.sampling_ratio = sampling_ratio

    def forward(self, features, rois):
        """
        features: (N, C, H, W)
        rois: (M, 5) [batch_idx, x1, y1, x2, y2]
        """
        if rois.numel() == 0:
            size = (self.output_size, self.output_size) if isinstance(self.output_size, int) else self.output_size
            return torch.empty(0, features.size(1), size[0], size[1], device=features.device)

        outputs = []
        for roi in rois:
            batch_idx = int(roi[0].item())
            out = _roi_align_single(features[batch_idx], roi, self.output_size,
                                    self.spatial_scale, self.sampling_ratio)
            outputs.append(out)
        return torch.stack(outputs, dim=0)


# ---------------------------------------------------------------------------
# Fast R-CNN Head (分类 + 边界框回归)
# ---------------------------------------------------------------------------
class FastRCNNHead(nn.Module):
    """
    Fast R-CNN 检测头。
    将 RoI Align 提取的固定尺寸特征展平，经过两层全连接网络，输出:
    - cls: 每个 RoI 的类别概率 (num_classes)
    - reg: 每个类别的边界框偏移 (num_classes * 4)

    注意: 回归是类别相关的 (class-specific)，即每个类别预测一组框偏移。
    """

    def __init__(self, in_channels, roi_size, num_classes, fc_dim=1024):
        super().__init__()
        self.fc1 = nn.Linear(in_channels * roi_size * roi_size, fc_dim)
        self.fc2 = nn.Linear(fc_dim, fc_dim)
        self.relu = nn.ReLU(inplace=True)

        self.cls_score = nn.Linear(fc_dim, num_classes)
        self.bbox_pred = nn.Linear(fc_dim, num_classes * 4)

    def forward(self, x):
        x = torch.flatten(x, start_dim=1)
        x = self.relu(self.fc1(x))
        x = self.relu(self.fc2(x))
        cls_logits = self.cls_score(x)
        bbox_deltas = self.bbox_pred(x)
        return cls_logits, bbox_deltas


# ---------------------------------------------------------------------------
# Mask Head (并行分支，Mask R-CNN 的核心创新)
# ---------------------------------------------------------------------------
class MaskHead(nn.Module):
    """
    Mask R-CNN 的掩码预测分支。
    这是一个全卷积网络 (FCN)，与 Fast R-CNN Head 并行运行:
    - 4 层 3x3 卷积 (256 通道, ReLU)
    - 1 层 2x2 反卷积 (上采样 2 倍)
    - 1 层 1x1 卷积输出 num_classes 个通道 (每个类别一个掩码)

    输出: (M, num_classes, 28, 28)
    - 训练时: 只取 ground-truth 类别对应的通道计算损失。
    - 推理时: 取分类分支预测的类别对应的通道作为最终掩码。

    为什么用 FCN 而不是全连接层？
    - 全连接层会丢失空间结构，而 FCN 保留空间信息，适合像素级预测。
    """

    def __init__(self, in_channels, num_classes, conv_dim=MASK_HEAD_CONV):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, conv_dim, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(conv_dim, conv_dim, kernel_size=3, padding=1)
        self.conv3 = nn.Conv2d(conv_dim, conv_dim, kernel_size=3, padding=1)
        self.conv4 = nn.Conv2d(conv_dim, conv_dim, kernel_size=3, padding=1)
        self.relu = nn.ReLU(inplace=True)

        # 反卷积上采样: 14x14 -> 28x28
        self.deconv = nn.ConvTranspose2d(conv_dim, MASK_UPSAMPLE_CHANNELS, kernel_size=2, stride=2)
        # 最终 1x1 卷积: 为每个类别预测一个掩码
        self.mask_fcn_logits = nn.Conv2d(MASK_UPSAMPLE_CHANNELS, num_classes, kernel_size=1)

    def forward(self, x):
        x = self.relu(self.conv1(x))
        x = self.relu(self.conv2(x))
        x = self.relu(self.conv3(x))
        x = self.relu(self.conv4(x))
        x = self.relu(self.deconv(x))  # 上采样到 28x28
        x = self.mask_fcn_logits(x)     # (M, num_classes, 28, 28)
        return x


# ---------------------------------------------------------------------------
# 完整的 Mask R-CNN 模型
# ---------------------------------------------------------------------------
class MaskRCNN(nn.Module):
    """
    Mask R-CNN 完整模型 = ResNet-50 + FPN + RPN + RoI Align + Fast R-CNN Head + Mask Head

    前向流程 (Forward Flow):
    1. Backbone: 提取 C2, C3, C4, C5 多尺度特征
    2. FPN: 生成 P2, P3, P4, P5, P6 特征金字塔
    3. RPN: 在每个层级上预测前景/背景和锚框偏移，生成候选框 (proposals)
    4. RoI Align: 从 P2 上精确提取每个 proposal 的特征 (7x7 给 box head, 14x14 给 mask head)
    5. Box Head: 预测类别和精细边界框
    6. Mask Head: 预测每个类别的像素级掩码 (28x28)
    """

    def __init__(self, num_classes=NUM_CLASSES):
        super().__init__()
        self.num_classes = num_classes

        self.backbone = ResNet50Backbone()
        self.fpn = FPN(in_channels_list=(256, 512, 1024, 2048), out_channels=FPN_OUT_CHANNELS)

        # 每个 FPN 层级一个 RPN head (结构相同，参数独立)
        self.rpn_heads = nn.ModuleList([
            RPNHead(in_channels=FPN_OUT_CHANNELS, feat_dim=RPN_FEAT_DIM, num_anchors=NUM_ANCHORS)
            for _ in range(5)
        ])

        # RoI Align: 分别用于 box head 和 mask head
        self.roi_align_box = RoIAlign(output_size=ROI_ALIGN_SIZE_CLS, spatial_scale=1.0 / 4.0)
        self.roi_align_mask = RoIAlign(output_size=ROI_ALIGN_SIZE_MASK, spatial_scale=1.0 / 4.0)

        self.box_head = FastRCNNHead(in_channels=FPN_OUT_CHANNELS, roi_size=ROI_ALIGN_SIZE_CLS,
                                     num_classes=num_classes, fc_dim=1024)
        self.mask_head = MaskHead(in_channels=FPN_OUT_CHANNELS, num_classes=num_classes)

    def forward(self, images, proposals=None):
        """
        images: (N, 3, H, W)
        proposals: 可选，(M, 5) [batch_idx, x1, y1, x2, y2]

        返回:
            rpn_logits_list: 5 个层级的 RPN 分类输出
            rpn_bbox_list: 5 个层级的 RPN 回归输出
            cls_logits: Box head 的类别预测
            bbox_deltas: Box head 的框偏移预测
            mask_logits: Mask head 的掩码预测 (M, num_classes, 28, 28)
        """
        # 1. 骨干网络提取多尺度特征
        c2, c3, c4, c5 = self.backbone(images)

        # 2. FPN 生成特征金字塔
        p2, p3, p4, p5, p6 = self.fpn(c2, c3, c4, c5)

        # 3. RPN 在每个层级上预测
        fpn_levels = [p2, p3, p4, p5, p6]
        rpn_logits = []
        rpn_bbox = []
        for level, rpn_head in zip(fpn_levels, self.rpn_heads):
            logits, bbox = rpn_head(level)
            rpn_logits.append(logits)
            rpn_bbox.append(bbox)

        # 如果没有提供 proposals，生成 dummy proposals 用于形状验证
        if proposals is None:
            N = images.size(0)
            proposals = torch.tensor([[i, 50, 50, 200, 200] for i in range(N)],
                                     dtype=torch.float32, device=images.device)

        # 4. RoI Align 提取固定尺寸特征
        box_features = self.roi_align_box(p2, proposals)   # (M, 256, 7, 7)
        mask_features = self.roi_align_mask(p2, proposals) # (M, 256, 14, 14)

        # 5. Box Head: 分类 + 回归
        cls_logits, bbox_deltas = self.box_head(box_features)

        # 6. Mask Head: 像素级掩码
        mask_logits = self.mask_head(mask_features)

        return rpn_logits, rpn_bbox, cls_logits, bbox_deltas, mask_logits


# ---------------------------------------------------------------------------
# 教育演示 (Educational Demo)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = MaskRCNN(num_classes=NUM_CLASSES)
    dummy = torch.randn(2, 3, 800, 800)
    rpn_logits, rpn_bbox, cls_logits, bbox_deltas, mask_logits = model(dummy)

    total_params = sum(p.numel() for p in model.parameters())
    print("=" * 60)
    print("Mask R-CNN 前向传播形状检查")
    print("=" * 60)
    print(f"输入图像形状:        {dummy.shape}")
    print(f"FPN 层级数:          {len(rpn_logits)} (P2~P6)")
    print(f"RPN cls[0] 形状:     {rpn_logits[0].shape}  (P2 层级)")
    print(f"Fast R-CNN 分类:     {cls_logits.shape}  (M, num_classes)")
    print(f"Fast R-CNN 回归:     {bbox_deltas.shape}  (M, num_classes*4)")
    print(f"Mask 输出:           {mask_logits.shape}  (M, num_classes, 28, 28)")
    print(f"总参数量:            {total_params:,} (~{total_params / 1e6:.1f}M)")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # 给读者的练习 (Exercises)
    # -----------------------------------------------------------------------
    print("\n练习题:")
    print("1. 将 backbone 换成 ResNet-101，观察参数量和输出形状变化。")
    print("2. 修改 Mask Head 的输出分辨率从 28x28 到 56x56，需要调整哪些层？")
    print("3. 在推理时，如何根据 cls_logits 的预测结果选取 mask_logits 中对应的通道？")
    print("4. 尝试实现 RoI Align 的多线程/向量化版本以加速推理。")
    print("5. 为什么 Mask R-CNN 的 Mask Head 使用 sigmoid 而不是 softmax？")
    print("   (提示: 每个类别的掩码是独立预测的，类别竞争在分类分支已完成。)")
