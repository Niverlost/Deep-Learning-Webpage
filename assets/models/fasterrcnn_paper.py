"""
Faster R-CNN: Towards Real-Time Object Detection with Region Proposal Networks
Shaoqing Ren, Kaiming He, Ross Girshick, Jian Sun
2015 (NeurIPS 2015)
arXiv: https://arxiv.org/abs/1506.01497

Paper-faithful inference-only implementation.
Backbone: ResNet-50 (or VGG-16); here we use ResNet-50 for ~137M params.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# Configuration constants (from paper)
# ---------------------------------------------------------------------------
RPN_N = 3                     # sliding window size (3x3)
RPN_FEAT_DIM = 512            # intermediate dim after 3x3 conv (ResNet: 512)
NUM_ANCHORS = 9               # 3 scales x 3 ratios
NUM_CLASSES = 21              # COCO: 80 + 1 background; VOC: 20 + 1
ROI_POOL_SIZE = 7             # RoI Pooling output spatial size
FC_DIM = 1024                 # Fast R-CNN head FC dim (ResNet-50 C4 head)

ANCHOR_SCALES = (128, 256, 512)
ANCHOR_RATIOS = (0.5, 1.0, 2.0)


# ---------------------------------------------------------------------------
# ResNet-50 Backbone (shared conv layers)
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
    """ResNet-50 up to conv4 (C4), output stride 16."""

    def __init__(self):
        super().__init__()
        self.in_planes = 64

        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        self.layer1 = self._make_layer(64, 3, stride=1)
        self.layer2 = self._make_layer(128, 4, stride=2)
        self.layer3 = self._make_layer(256, 6, stride=2)
        # layer4 is intentionally omitted; Fast R-CNN head uses C4 features

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
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        return x


# ---------------------------------------------------------------------------
# RPN (Region Proposal Network)
# ---------------------------------------------------------------------------
class RPN(nn.Module):
    """
    3x3 conv sliding window + two sibling 1x1 convs (cls / reg).
    cls: 2k scores (object / not-object) per anchor.
    reg: 4k coordinates per anchor.
    """

    def __init__(self, in_channels, feat_dim=RPN_FEAT_DIM, num_anchors=NUM_ANCHORS):
        super().__init__()
        self.num_anchors = num_anchors

        self.conv = nn.Conv2d(in_channels, feat_dim, kernel_size=RPN_N, padding=RPN_N // 2)
        self.relu = nn.ReLU(inplace=True)

        self.cls_logits = nn.Conv2d(feat_dim, num_anchors * 2, kernel_size=1)
        self.bbox_pred = nn.Conv2d(feat_dim, num_anchors * 4, kernel_size=1)

    def forward(self, features):
        x = self.relu(self.conv(features))

        logits = self.cls_logits(x)          # (N, 2*A, H, W)
        bbox_reg = self.bbox_pred(x)          # (N, 4*A, H, W)

        # reshape to per-anchor predictions
        N, _, H, W = logits.shape
        logits = logits.view(N, 2, self.num_anchors, H, W).permute(0, 3, 4, 2, 1).contiguous()
        logits = logits.view(N, -1, 2)        # (N, H*W*A, 2)

        bbox_reg = bbox_reg.view(N, 4, self.num_anchors, H, W).permute(0, 3, 4, 2, 1).contiguous()
        bbox_reg = bbox_reg.view(N, -1, 4)    # (N, H*W*A, 4)

        return logits, bbox_reg


# ---------------------------------------------------------------------------
# RoI Pooling (simplified paper version)
# ---------------------------------------------------------------------------
class RoIPool(nn.Module):
    """RoI Pooling: quantize RoI onto feature grid and max-pool to fixed size."""

    def __init__(self, output_size, spatial_scale):
        super().__init__()
        self.output_size = output_size if isinstance(output_size, tuple) else (output_size, output_size)
        self.spatial_scale = spatial_scale

    def forward(self, features, rois):
        """
        features: (N, C, H, W)
        rois: (M, 5)  [batch_idx, x1, y1, x2, y2]
        """
        if rois.numel() == 0:
            return torch.empty(0, features.size(1), self.output_size[0], self.output_size[1], device=features.device)

        output = []
        for roi in rois:
            batch_idx = int(roi[0].item())
            x1, y1, x2, y2 = roi[1:].tolist()
            x1 = int(x1 * self.spatial_scale)
            y1 = int(y1 * self.spatial_scale)
            x2 = max(int(x2 * self.spatial_scale), x1 + 1)
            y2 = max(int(y2 * self.spatial_scale), y1 + 1)

            roi_feature = features[batch_idx:batch_idx + 1, :, y1:y2, x1:x2]
            pooled = F.adaptive_max_pool2d(roi_feature, self.output_size)
            output.append(pooled)

        return torch.cat(output, dim=0)


# ---------------------------------------------------------------------------
# Fast R-CNN Head
# ---------------------------------------------------------------------------
class FastRCNNHead(nn.Module):
    """
    Two FC layers + cls / reg branches.
    cls: (C + 1) class probabilities.
    reg: 4*C box deltas (class-specific regression).
    """

    def __init__(self, in_channels, roi_size, num_classes, fc_dim=FC_DIM):
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
# Full Faster R-CNN Model
# ---------------------------------------------------------------------------
class FasterRCNN(nn.Module):
    """
    Faster R-CNN = ResNet-50 backbone + RPN + RoI Pooling + Fast R-CNN head.
    Inference only.
    """

    def __init__(self, num_classes=NUM_CLASSES, roi_pool_size=ROI_POOL_SIZE):
        super().__init__()
        self.num_classes = num_classes
        self.roi_pool_size = roi_pool_size

        self.backbone = ResNet50Backbone()
        # C4 output channels = 256 * 4 = 1024
        self.rpn = RPN(in_channels=1024, feat_dim=RPN_FEAT_DIM, num_anchors=NUM_ANCHORS)
        self.roi_pool = RoIPool(output_size=roi_pool_size, spatial_scale=1.0 / 16.0)
        self.head = FastRCNNHead(in_channels=1024, roi_size=roi_pool_size, num_classes=num_classes, fc_dim=FC_DIM)

    def forward(self, images, proposals=None):
        """
        images: (N, 3, H, W)
        proposals: optional (M, 5) RoIs for second stage; if None, RPN proposals are used.
        Returns:
            rpn_logits, rpn_bbox_reg, cls_logits, bbox_deltas
        """
        features = self.backbone(images)

        rpn_logits, rpn_bbox_reg = self.rpn(features)

        if proposals is None:
            # dummy proposals for shape check (in real inference, use NMS on RPN outputs)
            N = images.size(0)
            proposals = torch.tensor([[i, 50, 50, 200, 200] for i in range(N)], dtype=torch.float32, device=images.device)

        pooled = self.roi_pool(features, proposals)
        cls_logits, bbox_deltas = self.head(pooled)

        return rpn_logits, rpn_bbox_reg, cls_logits, bbox_deltas


# ---------------------------------------------------------------------------
# Sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = FasterRCNN(num_classes=NUM_CLASSES)
    dummy = torch.randn(2, 3, 800, 800)
    rpn_cls, rpn_reg, cls_logits, bbox_deltas = model(dummy)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Input shape:        {dummy.shape}")
    print(f"RPN cls shape:      {rpn_cls.shape}")
    print(f"RPN reg shape:      {rpn_reg.shape}")
    print(f"Fast RCNN cls:      {cls_logits.shape}")
    print(f"Fast RCNN reg:      {bbox_deltas.shape}")
    print(f"Total parameters:   {total_params:,} (~{total_params / 1e6:.1f}M)")
