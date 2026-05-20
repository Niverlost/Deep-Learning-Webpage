"""
MobileNets: Efficient Convolutional Neural Networks for Mobile Vision Applications
Andrew G. Howard, Menglong Zhu, Bo Chen, Dmitry Kalenichenko, Weijun Wang,
Tobias Weyand, Marco Andreetto, Hartwig Adam
Google Inc., 2017
arXiv: https://arxiv.org/abs/1704.04861

Paper-faithful implementation of MobileNetV1.
"""

import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# Configuration constants (from the paper, Table 1)
# ---------------------------------------------------------------------------
INPUT_SIZE = 224
NUM_CLASSES = 1000
WIDTH_MULTIPLIER = 1.0


# ---------------------------------------------------------------------------
# Architecture blocks
# ---------------------------------------------------------------------------
class DepthwiseSeparableConv(nn.Module):
    """Depthwise separable convolution: depthwise + pointwise."""

    def __init__(self, in_ch: int, out_ch: int, stride: int = 1):
        super().__init__()
        self.depthwise = nn.Conv2d(
            in_ch, in_ch, kernel_size=3, stride=stride, padding=1,
            groups=in_ch, bias=False,
        )
        self.bn1 = nn.BatchNorm2d(in_ch)
        self.relu1 = nn.ReLU(inplace=True)

        self.pointwise = nn.Conv2d(
            in_ch, out_ch, kernel_size=1, stride=1, padding=0, bias=False,
        )
        self.bn2 = nn.BatchNorm2d(out_ch)
        self.relu2 = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.depthwise(x)
        x = self.bn1(x)
        x = self.relu1(x)
        x = self.pointwise(x)
        x = self.bn2(x)
        x = self.relu2(x)
        return x


# ---------------------------------------------------------------------------
# Full model
# ---------------------------------------------------------------------------
class MobileNetV1(nn.Module):
    """MobileNetV1 architecture (Table 1 in the paper)."""

    def __init__(self, num_classes: int = NUM_CLASSES, width_mult: float = WIDTH_MULTIPLIER):
        super().__init__()

        def _make_divisible(v: float, divisor: int = 8) -> int:
            """Ensure channel count is divisible by divisor (common practice)."""
            return int((v + divisor / 2) // divisor * divisor)

        def _round(ch: int) -> int:
            return _make_divisible(ch * width_mult)

        # Initial full convolution
        self.conv1 = nn.Sequential(
            nn.Conv2d(3, _round(32), kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(_round(32)),
            nn.ReLU(inplace=True),
        )

        # Depthwise separable convolutions (Table 1)
        self.separable_convs = nn.Sequential(
            DepthwiseSeparableConv(_round(32),  _round(64),  stride=1),   # conv_ds_1
            DepthwiseSeparableConv(_round(64),  _round(128), stride=2),  # conv_ds_2
            DepthwiseSeparableConv(_round(128), _round(128), stride=1),  # conv_ds_3
            DepthwiseSeparableConv(_round(128), _round(256), stride=2),  # conv_ds_4
            DepthwiseSeparableConv(_round(256), _round(256), stride=1),  # conv_ds_5
            DepthwiseSeparableConv(_round(256), _round(512), stride=2),  # conv_ds_6
            DepthwiseSeparableConv(_round(512), _round(512), stride=1),  # conv_ds_7
            DepthwiseSeparableConv(_round(512), _round(512), stride=1),  # conv_ds_8
            DepthwiseSeparableConv(_round(512), _round(512), stride=1),  # conv_ds_9
            DepthwiseSeparableConv(_round(512), _round(512), stride=1),  # conv_ds_10
            DepthwiseSeparableConv(_round(512), _round(512), stride=1),  # conv_ds_11
            DepthwiseSeparableConv(_round(512), _round(1024), stride=2), # conv_ds_12
            DepthwiseSeparableConv(_round(1024), _round(1024), stride=1), # conv_ds_13
        )

        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(_round(1024), num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.conv1(x)
        x = self.separable_convs(x)
        x = self.avgpool(x)
        x = x.view(x.size(0), -1)
        x = self.fc(x)
        return x


# ---------------------------------------------------------------------------
# Sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = MobileNetV1(num_classes=1000, width_mult=1.0)
    dummy = torch.randn(2, 3, 224, 224)
    out = model(dummy)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Input shape:  {dummy.shape}")
    print(f"Output shape: {out.shape}")
    print(f"Total params: {total_params:,}")
