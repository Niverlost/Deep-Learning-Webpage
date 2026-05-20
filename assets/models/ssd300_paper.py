"""
SSD: Single Shot MultiBox Detector
Wei Liu, Dragomir Anguelov, Dumitru Erhan, Christian Szegedy, Scott Reed, Cheng-Yang Fu, Alexander C. Berg
ECCV 2016
arXiv: https://arxiv.org/abs/1512.02325

Paper-faithful implementation of SSD300 (VGG16 backbone).
"""

import torch
import torch.nn as nn


# ------------------------------------------------------------------
# Configuration constants (exact values from the paper)
# ------------------------------------------------------------------
INPUT_SIZE = 300
NUM_CLASSES = 21  # VOC: 20 classes + background

# Feature map sizes and anchor counts per location
FEATURE_MAPS = [38, 19, 10, 5, 3, 1]
MIN_SIZES = [30, 60, 111, 162, 213, 264]
MAX_SIZES = [60, 111, 162, 213, 264, 315]
ASPECT_RATIOS = [[2], [2, 3], [2, 3], [2, 3], [2], [2]]
NUM_ANCHORS = [4, 6, 6, 6, 4, 4]  # matches aspect ratios + 1 (ratio=1)

# L2Norm scale for conv4_3
L2NORM_SCALE = 20


# ------------------------------------------------------------------
# Architecture blocks
# ------------------------------------------------------------------

class L2Norm(nn.Module):
    def __init__(self, n_channels, scale):
        super().__init__()
        self.n_channels = n_channels
        self.gamma = scale
        self.eps = 1e-10
        self.weight = nn.Parameter(torch.Tensor(n_channels))
        nn.init.constant_(self.weight, self.gamma)

    def forward(self, x):
        norm = x.pow(2).sum(dim=1, keepdim=True).sqrt() + self.eps
        x = x / norm
        out = self.weight.view(1, -1, 1, 1) * x
        return out


class VGGBase(nn.Module):
    """VGG-16 backbone up to conv4_3, then conv5 with dilation, then fc6/fc7 as conv layers."""

    def __init__(self):
        super().__init__()
        # conv1_1 - conv1_2
        self.conv1 = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),  # 150
        )
        # conv2_1 - conv2_2
        self.conv2 = nn.Sequential(
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),  # 75
        )
        # conv3_1 - conv3_3
        self.conv3 = nn.Sequential(
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2, ceil_mode=True),  # 38
        )
        # conv4_1 - conv4_3
        self.conv4 = nn.Sequential(
            nn.Conv2d(256, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )
        # conv5_1 - conv5_3 (dilated, no downsample)
        self.conv5 = nn.Sequential(
            nn.MaxPool2d(kernel_size=2, stride=2),  # 19
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )
        # fc6, fc7 as conv layers
        self.fc6 = nn.Sequential(
            nn.MaxPool2d(kernel_size=3, stride=1, padding=1),
            nn.Conv2d(512, 1024, kernel_size=3, padding=6, dilation=6),
            nn.ReLU(inplace=True),
        )
        self.fc7 = nn.Sequential(
            nn.Conv2d(1024, 1024, kernel_size=1),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        x = self.conv1(x)
        x = self.conv2(x)
        x = self.conv3(x)
        conv4_3 = self.conv4(x)
        x = self.conv5(conv4_3)
        x = self.fc6(x)
        conv7 = self.fc7(x)
        return conv4_3, conv7


class ExtraLayers(nn.Module):
    """Extra feature layers: conv8_2, conv9_2, conv10_2, conv11_2."""

    def __init__(self):
        super().__init__()
        self.conv8 = nn.Sequential(
            nn.Conv2d(1024, 256, kernel_size=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 512, kernel_size=3, stride=2, padding=1),
            nn.ReLU(inplace=True),
        )
        self.conv9 = nn.Sequential(
            nn.Conv2d(512, 128, kernel_size=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 256, kernel_size=3, stride=2, padding=1),
            nn.ReLU(inplace=True),
        )
        self.conv10 = nn.Sequential(
            nn.Conv2d(256, 128, kernel_size=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 256, kernel_size=3, stride=1, padding=0),
            nn.ReLU(inplace=True),
        )
        self.conv11 = nn.Sequential(
            nn.Conv2d(256, 128, kernel_size=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 256, kernel_size=3, stride=1, padding=0),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        conv8_2 = self.conv8(x)
        conv9_2 = self.conv9(conv8_2)
        conv10_2 = self.conv10(conv9_2)
        conv11_2 = self.conv11(conv10_2)
        return conv8_2, conv9_2, conv10_2, conv11_2


class DetectionHead(nn.Module):
    """Location and confidence prediction heads for one feature map."""

    def __init__(self, in_channels, num_anchors, num_classes):
        super().__init__()
        self.loc = nn.Conv2d(in_channels, num_anchors * 4, kernel_size=3, padding=1)
        self.conf = nn.Conv2d(in_channels, num_anchors * num_classes, kernel_size=3, padding=1)

    def forward(self, x):
        loc = self.loc(x)
        conf = self.conf(x)
        return loc, conf


# ------------------------------------------------------------------
# Full SSD300 model
# ------------------------------------------------------------------

class SSD300(nn.Module):
    def __init__(self, num_classes=NUM_CLASSES):
        super().__init__()
        self.num_classes = num_classes

        self.vgg = VGGBase()
        self.l2norm = L2Norm(512, L2NORM_SCALE)
        self.extras = ExtraLayers()

        # Detection heads for 6 feature maps
        # conv4_3 (512), conv7 (1024), conv8_2 (512), conv9_2 (256), conv10_2 (256), conv11_2 (256)
        self.loc_layers = nn.ModuleList([
            nn.Conv2d(512, NUM_ANCHORS[0] * 4, kernel_size=3, padding=1),
            nn.Conv2d(1024, NUM_ANCHORS[1] * 4, kernel_size=3, padding=1),
            nn.Conv2d(512, NUM_ANCHORS[2] * 4, kernel_size=3, padding=1),
            nn.Conv2d(256, NUM_ANCHORS[3] * 4, kernel_size=3, padding=1),
            nn.Conv2d(256, NUM_ANCHORS[4] * 4, kernel_size=3, padding=1),
            nn.Conv2d(256, NUM_ANCHORS[5] * 4, kernel_size=3, padding=1),
        ])
        self.conf_layers = nn.ModuleList([
            nn.Conv2d(512, NUM_ANCHORS[0] * num_classes, kernel_size=3, padding=1),
            nn.Conv2d(1024, NUM_ANCHORS[1] * num_classes, kernel_size=3, padding=1),
            nn.Conv2d(512, NUM_ANCHORS[2] * num_classes, kernel_size=3, padding=1),
            nn.Conv2d(256, NUM_ANCHORS[3] * num_classes, kernel_size=3, padding=1),
            nn.Conv2d(256, NUM_ANCHORS[4] * num_classes, kernel_size=3, padding=1),
            nn.Conv2d(256, NUM_ANCHORS[5] * num_classes, kernel_size=3, padding=1),
        ])

    def forward(self, x):
        conv4_3, conv7 = self.vgg(x)
        conv4_3 = self.l2norm(conv4_3)

        conv8_2, conv9_2, conv10_2, conv11_2 = self.extras(conv7)

        features = [conv4_3, conv7, conv8_2, conv9_2, conv10_2, conv11_2]

        loc_list = []
        conf_list = []
        for feat, loc_layer, conf_layer in zip(features, self.loc_layers, self.conf_layers):
            loc = loc_layer(feat)
            conf = conf_layer(feat)
            # (B, A*4, H, W) -> (B, H, W, A, 4)
            loc = loc.permute(0, 2, 3, 1).contiguous()
            conf = conf.permute(0, 2, 3, 1).contiguous()
            loc_list.append(loc)
            conf_list.append(conf)

        loc = torch.cat([o.view(o.size(0), -1, 4) for o in loc_list], dim=1)
        conf = torch.cat([o.view(o.size(0), -1, self.num_classes) for o in conf_list], dim=1)

        return loc, conf


# ------------------------------------------------------------------
# Sanity check
# ------------------------------------------------------------------

if __name__ == "__main__":
    model = SSD300(num_classes=21)
    x = torch.randn(2, 3, 300, 300)
    loc, conf = model(x)

    print(f"Input shape:  {x.shape}")
    print(f"Loc shape:    {loc.shape}")    # (2, 8732, 4)
    print(f"Conf shape:   {conf.shape}")   # (2, 8732, 21)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total params: {total_params:,} (~{total_params / 1e6:.1f}M)")

    # Verify anchor count
    num_anchors = sum(f * f * a for f, a in zip(FEATURE_MAPS, NUM_ANCHORS))
    assert loc.size(1) == num_anchors, f"Expected {num_anchors} anchors, got {loc.size(1)}"
    print(f"Anchor count: {num_anchors} (expected 8732)")
