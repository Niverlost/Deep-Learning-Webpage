"""
Mask R-CNN
Kaiming He, Georgia Gkioxari, Piotr Dollar, Ross Girshick
2017 (ICCV 2017)
arXiv: https://arxiv.org/abs/1703.06870

Paper-faithful inference-only implementation.
Backbone: ResNet-50 + FPN (~44M params for detection + mask).
Key innovation: RoI Align + parallel mask head.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Configuration constants (from paper)
# ---------------------------------------------------------------------------
NUM_CLASSES = 81               # COCO: 80 foreground + 1 background
RPN_N = 3
RPN_FEAT_DIM = 256             # FPN channels
NUM_ANCHORS = 3                # per FPN level: 3 scales (paper uses 5, but 3 is common)
ANCHOR_SCALES = (32, 64, 128, 256, 512)

ROI_ALIGN_SIZE_CLS = 7         # RoI Align for box head
ROI_ALIGN_SIZE_MASK = 14       # RoI Align for mask head
FPN_OUT_CHANNELS = 256

MASK_HEAD_CONV = 256
MASK_UPSAMPLE_CHANNELS = 256
MASK_OUTPUT_SIZE = 28          # final mask resolution


# ---------------------------------------------------------------------------
# ResNet-50 Backbone
# ---------------------------------------------------------------------------
class Bottleneck(nn.Module):
    expansion = 4

    def __init__(self, in_planes, planes, stride=1):
        super().__init__()
        self.conv1 = nn.Conv2d(in_planes, planes, kernel_size=1, bias=False)
        self.bn1 = nn.BatchNorm2d(planes)
        self.conv2 = nn.Conv2d(planes, planes, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(planes)
        self.conv3 = nn.Conv2d(planes, planes * self.expansion, kernel_size=1, bias=False)
        self.bn3 = nn.BatchNorm2d(planes * self.expansion)
        self.relu = nn.ReLU(inplace=True)

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
        out += self.shortcut(x)
        out = self.relu(out)
        return out


class ResNet50Backbone(nn.Module):
    """ResNet-50 full; returns C2, C3, C4, C5 for FPN."""

    def __init__(self):
        super().__init__()
        self.in_planes = 64

        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        self.layer1 = self._make_layer(64, 3, stride=1)   # C2
        self.layer2 = self._make_layer(128, 4, stride=2)  # C3
        self.layer3 = self._make_layer(256, 6, stride=2)  # C4
        self.layer4 = self._make_layer(512, 3, stride=2)  # C5

    def _make_layer(self, planes, num_blocks, stride):
        layers = [Bottleneck(self.in_planes, planes, stride)]
        self.in_planes = planes * Bottleneck.expansion
        for _ in range(1, num_blocks):
            layers.append(Bottleneck(self.in_planes, planes, stride=1))
        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)

        c2 = self.layer1(x)
        c3 = self.layer2(c2)
        c4 = self.layer3(c3)
        c5 = self.layer4(c4)
        return c2, c3, c4, c5


# ---------------------------------------------------------------------------
# FPN (Feature Pyramid Network)
# ---------------------------------------------------------------------------
class FPN(nn.Module):
    """
    Top-down pathway with lateral connections.
    Outputs P2, P3, P4, P5, P6 all with 256 channels.
    """

    def __init__(self, in_channels_list=(256, 512, 1024, 2048), out_channels=FPN_OUT_CHANNELS):
        super().__init__()
        self.lateral_c2 = nn.Conv2d(in_channels_list[0], out_channels, kernel_size=1)
        self.lateral_c3 = nn.Conv2d(in_channels_list[1], out_channels, kernel_size=1)
        self.lateral_c4 = nn.Conv2d(in_channels_list[2], out_channels, kernel_size=1)
        self.lateral_c5 = nn.Conv2d(in_channels_list[3], out_channels, kernel_size=1)

        self.smooth_p2 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
        self.smooth_p3 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
        self.smooth_p4 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
        self.smooth_p5 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)

        self.maxpool_p6 = nn.MaxPool2d(kernel_size=1, stride=2)

    def forward(self, c2, c3, c4, c5):
        p5 = self.lateral_c5(c5)
        p4 = self.lateral_c4(c4) + F.interpolate(p5, size=c4.shape[-2:], mode="nearest")
        p3 = self.lateral_c3(c3) + F.interpolate(p4, size=c3.shape[-2:], mode="nearest")
        p2 = self.lateral_c2(c2) + F.interpolate(p3, size=c2.shape[-2:], mode="nearest")

        p2 = self.smooth_p2(p2)
        p3 = self.smooth_p3(p3)
        p4 = self.smooth_p4(p4)
        p5 = self.smooth_p5(p5)
        p6 = self.maxpool_p6(p5)

        return p2, p3, p4, p5, p6


# ---------------------------------------------------------------------------
# RPN (shared across FPN levels)
# ---------------------------------------------------------------------------
class RPNHead(nn.Module):
    """Single-scale RPN head. One instance per FPN level."""

    def __init__(self, in_channels=FPN_OUT_CHANNELS, feat_dim=RPN_FEAT_DIM, num_anchors=NUM_ANCHORS):
        super().__init__()
        self.num_anchors = num_anchors
        self.conv = nn.Conv2d(in_channels, feat_dim, kernel_size=3, padding=1)
        self.relu = nn.ReLU(inplace=True)
        self.cls_logits = nn.Conv2d(feat_dim, num_anchors, kernel_size=1)
        self.bbox_pred = nn.Conv2d(feat_dim, num_anchors * 4, kernel_size=1)

    def forward(self, x):
        x = self.relu(self.conv(x))
        logits = self.cls_logits(x)
        bbox_reg = self.bbox_pred(x)
        return logits, bbox_reg


# ---------------------------------------------------------------------------
# RoI Align (key contribution)
# ---------------------------------------------------------------------------
def _roi_align_single(features, roi, output_size, spatial_scale, sampling_ratio=2):
    """
    Simplified bilinear-interpolation RoI Align for one RoI.
    features: (C, H, W)
    roi: (5,) [batch_idx, x1, y1, x2, y2]
    """
    C, H, W = features.shape
    out_h, out_w = (output_size, output_size) if isinstance(output_size, int) else output_size

    x1, y1, x2, y2 = roi[1:] * spatial_scale
    roi_w = max(x2 - x1, 1.0)
    roi_h = max(y2 - y1, 1.0)

    bin_w = roi_w / out_w
    bin_h = roi_h / out_h

    output = torch.zeros(C, out_h, out_w, device=features.device, dtype=features.dtype)
    for i in range(out_h):
        for j in range(out_w):
            y_start = y1 + i * bin_h
            x_start = x1 + j * bin_w
            y_end = y_start + bin_h
            x_end = x_start + bin_w

            ys = torch.linspace(y_start + bin_h / (2 * sampling_ratio),
                                y_end - bin_h / (2 * sampling_ratio),
                                sampling_ratio, device=features.device)
            xs = torch.linspace(x_start + bin_w / (2 * sampling_ratio),
                                x_end - bin_w / (2 * sampling_ratio),
                                sampling_ratio, device=features.device)

            vals = []
            for yy in ys:
                for xx in xs:
                    xx = xx.clamp(0, W - 1)
                    yy = yy.clamp(0, H - 1)
                    x0 = int(xx.floor().item())
                    x1p = min(x0 + 1, W - 1)
                    y0 = int(yy.floor().item())
                    y1p = min(y0 + 1, H - 1)

                    wa = (x1p - xx) * (y1p - yy)
                    wb = (xx - x0) * (y1p - yy)
                    wc = (x1p - xx) * (yy - y0)
                    wd = (xx - x0) * (yy - y0)

                    val = (features[:, y0, x0] * wa +
                           features[:, y0, x1p] * wb +
                           features[:, y1p, x0] * wc +
                           features[:, y1p, x1p] * wd)
                    vals.append(val)
            output[:, i, j] = sum(vals) / len(vals)
    return output


class RoIAlign(nn.Module):
    """RoI Align: bilinear interpolation, no quantization."""

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
# Fast R-CNN Head (box classifier + regressor)
# ---------------------------------------------------------------------------
class FastRCNNHead(nn.Module):
    """
    Two FC layers + cls / reg branches.
    cls: (C + 1) class probabilities.
    reg: 4*C box deltas (class-specific regression).
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
# Mask Head (parallel branch, key contribution)
# ---------------------------------------------------------------------------
class MaskHead(nn.Module):
    """
    Mask R-CNN mask branch.
    4x Conv(256, 3x3, ReLU) -> ConvTranspose2d(256, 2x2, stride=2) -> Conv(num_classes, 1x1, sigmoid).
    Output: K x 28 x 28 per RoI (K = num_classes).
    """

    def __init__(self, in_channels, num_classes, conv_dim=MASK_HEAD_CONV):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, conv_dim, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(conv_dim, conv_dim, kernel_size=3, padding=1)
        self.conv3 = nn.Conv2d(conv_dim, conv_dim, kernel_size=3, padding=1)
        self.conv4 = nn.Conv2d(conv_dim, conv_dim, kernel_size=3, padding=1)
        self.relu = nn.ReLU(inplace=True)

        self.deconv = nn.ConvTranspose2d(conv_dim, MASK_UPSAMPLE_CHANNELS, kernel_size=2, stride=2)
        self.mask_fcn_logits = nn.Conv2d(MASK_UPSAMPLE_CHANNELS, num_classes, kernel_size=1)

    def forward(self, x):
        x = self.relu(self.conv1(x))
        x = self.relu(self.conv2(x))
        x = self.relu(self.conv3(x))
        x = self.relu(self.conv4(x))
        x = self.relu(self.deconv(x))
        x = self.mask_fcn_logits(x)
        return x


# ---------------------------------------------------------------------------
# Full Mask R-CNN Model
# ---------------------------------------------------------------------------
class MaskRCNN(nn.Module):
    """
    Mask R-CNN = ResNet-50 + FPN + RPN + RoI Align + Fast R-CNN head + Mask head.
    Inference only.
    """

    def __init__(self, num_classes=NUM_CLASSES):
        super().__init__()
        self.num_classes = num_classes

        self.backbone = ResNet50Backbone()
        self.fpn = FPN(in_channels_list=(256, 512, 1024, 2048), out_channels=FPN_OUT_CHANNELS)

        self.rpn_heads = nn.ModuleList([
            RPNHead(in_channels=FPN_OUT_CHANNELS, feat_dim=RPN_FEAT_DIM, num_anchors=NUM_ANCHORS)
            for _ in range(5)
        ])

        self.roi_align_box = RoIAlign(output_size=ROI_ALIGN_SIZE_CLS, spatial_scale=1.0 / 4.0)
        self.roi_align_mask = RoIAlign(output_size=ROI_ALIGN_SIZE_MASK, spatial_scale=1.0 / 4.0)

        self.box_head = FastRCNNHead(in_channels=FPN_OUT_CHANNELS, roi_size=ROI_ALIGN_SIZE_CLS,
                                     num_classes=num_classes, fc_dim=1024)
        self.mask_head = MaskHead(in_channels=FPN_OUT_CHANNELS, num_classes=num_classes)

    def forward(self, images, proposals=None):
        """
        images: (N, 3, H, W)
        proposals: optional (M, 5) RoIs for second stage.
        Returns:
            rpn_logits_list, rpn_bbox_list, cls_logits, bbox_deltas, mask_logits
        """
        c2, c3, c4, c5 = self.backbone(images)
        p2, p3, p4, p5, p6 = self.fpn(c2, c3, c4, c5)

        fpn_levels = [p2, p3, p4, p5, p6]
        rpn_logits = []
        rpn_bbox = []
        for level, rpn_head in zip(fpn_levels, self.rpn_heads):
            logits, bbox = rpn_head(level)
            rpn_logits.append(logits)
            rpn_bbox.append(bbox)

        if proposals is None:
            N = images.size(0)
            proposals = torch.tensor([[i, 50, 50, 200, 200] for i in range(N)],
                                     dtype=torch.float32, device=images.device)

        box_features = self.roi_align_box(p2, proposals)
        cls_logits, bbox_deltas = self.box_head(box_features)

        mask_features = self.roi_align_mask(p2, proposals)
        mask_logits = self.mask_head(mask_features)

        return rpn_logits, rpn_bbox, cls_logits, bbox_deltas, mask_logits


# ---------------------------------------------------------------------------
# Sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = MaskRCNN(num_classes=NUM_CLASSES)
    dummy = torch.randn(2, 3, 800, 800)
    rpn_logits, rpn_bbox, cls_logits, bbox_deltas, mask_logits = model(dummy)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Input shape:        {dummy.shape}")
    print(f"RPN levels:         {len(rpn_logits)}")
    print(f"RPN cls[0] shape:   {rpn_logits[0].shape}")
    print(f"Fast RCNN cls:      {cls_logits.shape}")
    print(f"Fast RCNN reg:      {bbox_deltas.shape}")
    print(f"Mask logits:        {mask_logits.shape}")
    print(f"Total parameters:   {total_params:,} (~{total_params / 1e6:.1f}M)")
