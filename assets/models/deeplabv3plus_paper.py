"""
Encoder-Decoder with Atrous Separable Convolution for Semantic Image Segmentation
Liang-Chieh Chen, Yukun Zhu, George Papandreou, Florian Schroff, Hartwig Adam
ECCV 2018
arXiv: https://arxiv.org/abs/1802.02611

Paper-faithful PyTorch implementation of DeepLab v3+ with Modified Aligned Xception-65 backbone.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ------------------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------------------
NUM_CLASSES = 21
INPUT_SIZE = 512
OUTPUT_STRIDE = 16
LOW_LEVEL_CHANNELS = 48
ASPP_OUT_CHANNELS = 256
DECODER_CHANNELS = 256


# ------------------------------------------------------------------------------
# Architecture Blocks
# ------------------------------------------------------------------------------
class SeparableConv2d(nn.Module):
    """Depthwise separable convolution (depthwise + pointwise)."""

    def __init__(self, in_ch, out_ch, kernel_size=3, stride=1, padding=1,
                 dilation=1, bias=False):
        super().__init__()
        self.depthwise = nn.Conv2d(
            in_ch, in_ch, kernel_size, stride, padding, dilation,
            groups=in_ch, bias=bias
        )
        self.pointwise = nn.Conv2d(in_ch, out_ch, 1, 1, 0, 1, 1, bias=bias)

    def forward(self, x):
        x = self.depthwise(x)
        x = self.pointwise(x)
        return x


class XceptionBlock(nn.Module):
    """Xception residual block with separable convolutions."""

    def __init__(self, in_ch, out_ch, reps, stride=1, dilation=1,
                 start_with_relu=True, grow_first=True):
        super().__init__()

        if out_ch != in_ch or stride != 1:
            self.skip = nn.Sequential(
                nn.Conv2d(in_ch, out_ch, 1, stride, bias=False),
                nn.BatchNorm2d(out_ch),
            )
        else:
            self.skip = None

        layers = []
        filters = in_ch

        if grow_first:
            if start_with_relu:
                layers.append(nn.ReLU(inplace=True))
            layers.append(SeparableConv2d(in_ch, out_ch, 3, 1, dilation, dilation))
            layers.append(nn.BatchNorm2d(out_ch))
            filters = out_ch

        for i in range(reps - 1):
            if grow_first or i > 0:
                layers.append(nn.ReLU(inplace=True))
            layers.append(SeparableConv2d(filters, filters, 3, 1, dilation, dilation))
            layers.append(nn.BatchNorm2d(filters))

        if not grow_first:
            layers.append(nn.ReLU(inplace=True))
            layers.append(SeparableConv2d(in_ch, out_ch, 3, 1, dilation, dilation))
            layers.append(nn.BatchNorm2d(out_ch))

        if stride != 1:
            layers.append(nn.MaxPool2d(3, stride, 1))

        self.block = nn.Sequential(*layers)

    def forward(self, x):
        identity = x
        out = self.block(x)
        if self.skip is not None:
            identity = self.skip(x)
        out += identity
        return out


# ------------------------------------------------------------------------------
# Backbone: Modified Aligned Xception-65
# ------------------------------------------------------------------------------
class Xception65(nn.Module):
    """Modified Aligned Xception-65 backbone for DeepLab v3+.

    Entry flow  -> 1/4 low-level features, 1/16 high-level features
    Middle flow -> 16 repeats
    Exit flow   -> final encoder features
    """

    def __init__(self, output_stride=16):
        super().__init__()

        if output_stride == 16:
            entry_block3_stride = 2
            middle_dilation = 1
            exit_block_dilation = (1, 2)
        elif output_stride == 8:
            entry_block3_stride = 1
            middle_dilation = 2
            exit_block_dilation = (2, 4)
        else:
            raise ValueError("output_stride must be 8 or 16")

        # Entry flow
        self.conv1 = nn.Sequential(
            nn.Conv2d(3, 32, 3, 2, 1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
        )
        self.conv2 = nn.Sequential(
            nn.Conv2d(32, 64, 3, 1, 1, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
        )

        self.block1 = XceptionBlock(64, 128, 2, 2, 1, start_with_relu=False)
        self.block2 = XceptionBlock(128, 256, 2, 2, 1, start_with_relu=True)
        self.block3 = XceptionBlock(256, 728, 2, entry_block3_stride, 1, start_with_relu=True)

        # Middle flow (16 repeats)
        self.middle_blocks = nn.ModuleList([
            XceptionBlock(728, 728, 3, 1, middle_dilation, start_with_relu=True)
            for _ in range(16)
        ])

        # Exit flow
        self.block20 = XceptionBlock(728, 1024, 2, exit_block_dilation[0],
                                     exit_block_dilation[0], start_with_relu=True)
        self.block21 = nn.Sequential(
            SeparableConv2d(1024, 1536, 3, 1, exit_block_dilation[1], exit_block_dilation[1]),
            nn.BatchNorm2d(1536),
            nn.ReLU(inplace=True),
            SeparableConv2d(1536, 1536, 3, 1, exit_block_dilation[1], exit_block_dilation[1]),
            nn.BatchNorm2d(1536),
            nn.ReLU(inplace=True),
            SeparableConv2d(1536, 2048, 3, 1, exit_block_dilation[1], exit_block_dilation[1]),
            nn.BatchNorm2d(2048),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        # Entry flow
        x = self.conv1(x)
        x = self.conv2(x)
        x = self.block1(x)
        x = self.block2(x)
        low_level_feat = x  # 1/4 resolution
        x = self.block3(x)

        # Middle flow
        for block in self.middle_blocks:
            x = block(x)

        # Exit flow
        x = self.block20(x)
        x = self.block21(x)

        return x, low_level_feat


# ------------------------------------------------------------------------------
# ASPP: Atrous Spatial Pyramid Pooling
# ------------------------------------------------------------------------------
class ASPPConv(nn.Module):
    """Atrous convolution branch in ASPP."""

    def __init__(self, in_ch, out_ch, dilation):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=dilation, dilation=dilation, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.conv(x)


class ASPPPooling(nn.Module):
    """Image-level feature branch in ASPP."""

    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.gap = nn.AdaptiveAvgPool2d(1)
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        size = x.shape[2:]
        x = self.gap(x)
        x = self.conv(x)
        x = F.interpolate(x, size=size, mode='bilinear', align_corners=False)
        return x


class ASPP(nn.Module):
    """Atrous Spatial Pyramid Pooling module."""

    def __init__(self, in_ch, out_ch, rates=(6, 12, 18)):
        super().__init__()
        self.branches = nn.ModuleList([
            nn.Sequential(
                nn.Conv2d(in_ch, out_ch, 1, bias=False),
                nn.BatchNorm2d(out_ch),
                nn.ReLU(inplace=True),
            ),
            ASPPConv(in_ch, out_ch, rates[0]),
            ASPPConv(in_ch, out_ch, rates[1]),
            ASPPConv(in_ch, out_ch, rates[2]),
            ASPPPooling(in_ch, out_ch),
        ])
        self.project = nn.Sequential(
            nn.Conv2d(out_ch * 5, out_ch, 1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Dropout(0.5),
        )

    def forward(self, x):
        outs = [branch(x) for branch in self.branches]
        x = torch.cat(outs, dim=1)
        x = self.project(x)
        return x


# ------------------------------------------------------------------------------
# Decoder
# ------------------------------------------------------------------------------
class Decoder(nn.Module):
    """Simple yet effective decoder module."""

    def __init__(self, num_classes, low_level_channels=48, out_ch=256):
        super().__init__()
        self.low_level_conv = nn.Sequential(
            nn.Conv2d(256, low_level_channels, 1, bias=False),
            nn.BatchNorm2d(low_level_channels),
            nn.ReLU(inplace=True),
        )
        self.classifier = nn.Sequential(
            SeparableConv2d(low_level_channels + out_ch, out_ch, 3, 1, 1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            SeparableConv2d(out_ch, out_ch, 3, 1, 1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, num_classes, 1),
        )

    def forward(self, x, low_level_feat):
        low_level_feat = self.low_level_conv(low_level_feat)
        x = F.interpolate(x, size=low_level_feat.shape[2:], mode='bilinear', align_corners=False)
        x = torch.cat([x, low_level_feat], dim=1)
        x = self.classifier(x)
        return x


# ------------------------------------------------------------------------------
# Full Model
# ------------------------------------------------------------------------------
class DeepLabV3Plus(nn.Module):
    """DeepLab v3+ for semantic image segmentation."""

    def __init__(self, num_classes=21, output_stride=16):
        super().__init__()
        self.backbone = Xception65(output_stride)
        self.aspp = ASPP(2048, ASPP_OUT_CHANNELS)
        self.decoder = Decoder(num_classes, LOW_LEVEL_CHANNELS, DECODER_CHANNELS)

    def forward(self, x):
        input_size = x.shape[2:]
        x, low_level_feat = self.backbone(x)
        x = self.aspp(x)
        x = self.decoder(x, low_level_feat)
        x = F.interpolate(x, size=input_size, mode='bilinear', align_corners=False)
        return x


# ------------------------------------------------------------------------------
# Sanity Check
# ------------------------------------------------------------------------------
if __name__ == '__main__':
    model = DeepLabV3Plus(num_classes=NUM_CLASSES, output_stride=OUTPUT_STRIDE)
    x = torch.randn(2, 3, INPUT_SIZE, INPUT_SIZE)
    with torch.no_grad():
        out = model(x)
    total_params = sum(p.numel() for p in model.parameters())
    print(f'Input shape:  {x.shape}')
    print(f'Output shape: {out.shape}')
    print(f'Total parameters: {total_params / 1e6:.2f}M')
