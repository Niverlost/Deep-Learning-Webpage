"""
YOLOv3: An Incremental Improvement
Joseph Redmon, Ali Farhadi
2018
arXiv: https://arxiv.org/abs/1804.02767

Paper-faithful implementation of YOLOv3 with Darknet-53 backbone.
"""

import torch
import torch.nn as nn


# ------------------------------------------------------------------------------
# Configuration constants
# ------------------------------------------------------------------------------
C = 80
B = 3
INPUT_SIZE = 416
S_LIST = [13, 26, 52]
ANCHORS = [
    [116, 90], [156, 198], [373, 326],
    [30, 61], [62, 45], [59, 119],
    [10, 13], [16, 30], [33, 23],
]


# ------------------------------------------------------------------------------
# Architecture blocks
# ------------------------------------------------------------------------------
class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch, kernel_size, stride=1, padding=0):
        super().__init__()
        self.conv = nn.Conv2d(in_ch, out_ch, kernel_size, stride, padding, bias=False)
        self.bn = nn.BatchNorm2d(out_ch)
        self.act = nn.LeakyReLU(0.1, inplace=True)

    def forward(self, x):
        return self.act(self.bn(self.conv(x)))


class ResidualBlock(nn.Module):
    def __init__(self, in_ch, hidden_ch):
        super().__init__()
        self.conv1 = ConvBlock(in_ch, hidden_ch, 1)
        self.conv2 = ConvBlock(hidden_ch, in_ch, 3, padding=1)

    def forward(self, x):
        residual = x
        out = self.conv1(x)
        out = self.conv2(out)
        return out + residual


# ------------------------------------------------------------------------------
# Backbone: Darknet-53
# ------------------------------------------------------------------------------
class Darknet53(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = ConvBlock(3, 32, 3, padding=1)

        self.layer1 = self._make_layer(32, 64, 1)
        self.layer2 = self._make_layer(64, 128, 2)
        self.layer3 = self._make_layer(128, 256, 8)
        self.layer4 = self._make_layer(256, 512, 8)
        self.layer5 = self._make_layer(512, 1024, 4)

    def _make_layer(self, in_ch, out_ch, num_blocks):
        layers = [ConvBlock(in_ch, out_ch, 3, stride=2, padding=1)]
        for _ in range(num_blocks):
            layers.append(ResidualBlock(out_ch, out_ch // 2))
        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.conv1(x)
        x = self.layer1(x)
        x = self.layer2(x)
        out3 = self.layer3(x)
        out4 = self.layer4(out3)
        out5 = self.layer5(out4)
        return out3, out4, out5


# ------------------------------------------------------------------------------
# Detection head (official YOLOv3 structure)
# ------------------------------------------------------------------------------
class YOLOHead(nn.Module):
    def __init__(self, in_ch, num_classes, branch_ch=None):
        super().__init__()
        out_ch = B * (5 + num_classes)
        hid = in_ch // 2
        branch_ch = branch_ch or hid

        self.conv1 = ConvBlock(in_ch, hid, 1)
        self.conv2 = ConvBlock(hid, in_ch, 3, padding=1)
        self.conv3 = ConvBlock(in_ch, hid, 1)
        self.conv4 = ConvBlock(hid, in_ch, 3, padding=1)
        self.conv5 = ConvBlock(in_ch, branch_ch, 1)
        self.conv6 = ConvBlock(branch_ch, in_ch, 3, padding=1)
        self.conv_out = nn.Conv2d(in_ch, out_ch, 1)

    def forward(self, x):
        x = self.conv1(x)
        x = self.conv2(x)
        x = self.conv3(x)
        x = self.conv4(x)
        branch = self.conv5(x)
        x = self.conv6(branch)
        out = self.conv_out(x)
        return out, branch


# ------------------------------------------------------------------------------
# FPN-like upsample + concat
# ------------------------------------------------------------------------------
class UpsampleBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv = ConvBlock(in_ch, out_ch, 1)
        self.upsample = nn.Upsample(scale_factor=2, mode="nearest")

    def forward(self, x):
        x = self.conv(x)
        x = self.upsample(x)
        return x


# ------------------------------------------------------------------------------
# Full model
# ------------------------------------------------------------------------------
class YOLOv3(nn.Module):
    def __init__(self, num_classes=C):
        super().__init__()
        self.num_classes = num_classes
        self.backbone = Darknet53()

        self.head_large = YOLOHead(1024, num_classes, branch_ch=512)
        self.upsample1 = UpsampleBlock(512, 256)

        self.head_medium = YOLOHead(768, num_classes, branch_ch=256)
        self.upsample2 = UpsampleBlock(256, 128)

        self.head_small = YOLOHead(384, num_classes, branch_ch=128)

    def forward(self, x):
        out3, out4, out5 = self.backbone(x)

        # Large objects: 13x13
        out_large, branch_large = self.head_large(out5)

        # Medium objects: 26x26
        x1 = self.upsample1(branch_large)
        x1 = torch.cat([x1, out4], dim=1)
        out_medium, branch_medium = self.head_medium(x1)

        # Small objects: 52x52
        x2 = self.upsample2(branch_medium)
        x2 = torch.cat([x2, out3], dim=1)
        out_small, _ = self.head_small(x2)

        return out_large, out_medium, out_small


# ------------------------------------------------------------------------------
# Sanity check
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    model = YOLOv3(num_classes=80)
    x = torch.randn(1, 3, 416, 416)
    out_large, out_medium, out_small = model(x)

    print("Input shape:", x.shape)
    print("Large  output (13x13):", out_large.shape)
    print("Medium output (26x26):", out_medium.shape)
    print("Small  output (52x52):", out_small.shape)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,}")
