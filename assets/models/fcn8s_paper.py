"""
Fully Convolutional Networks for Semantic Segmentation
Jonathan Long, Evan Shelhamer, Trevor Darrell
2015
arXiv: https://arxiv.org/abs/1411.4038

Paper-faithful FCN-8s (VGG-16 backbone) implementation.
No BatchNorm — FCN predates BatchNorm usage in segmentation.
"""

import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# Configuration constants (from paper)
# ---------------------------------------------------------------------------
NUM_CLASSES = 21          # PASCAL VOC classes (20 object + 1 background)

CONV_KERNEL = 3
CONV_STRIDE = 1
CONV_PAD = 1

POOL_KERNEL = 2
POOL_STRIDE = 2

FC6_OUT = 4096
FC7_OUT = 4096


# ---------------------------------------------------------------------------
# Architecture blocks
# ---------------------------------------------------------------------------
class ConvBlock(nn.Module):
    """Conv3x3 -> ReLU (no BatchNorm in the original paper)."""

    def __init__(self, in_ch: int, out_ch: int) -> None:
        super().__init__()
        self.conv = nn.Conv2d(
            in_ch, out_ch,
            kernel_size=CONV_KERNEL,
            stride=CONV_STRIDE,
            padding=CONV_PAD,
        )
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.relu(self.conv(x))


class FCN8s(nn.Module):
    """FCN-8s with VGG-16 backbone.

    Architecture:
      - VGG-16 blocks (pool3, pool4, pool5 with stride-2 maxpool)
      - FC6 -> conv 7x7, 4096
      - FC7 -> conv 1x1, 4096
      - FC8 -> conv 1x1, NUM_CLASSES
      - Skip connections from pool4 (stride 16) and pool3 (stride 8)
      - Learnable upsampling via transposed convolution
    """

    def __init__(self, num_classes: int = NUM_CLASSES) -> None:
        super().__init__()

        # Block 1: 2 conv(64) -> pool
        self.block1 = nn.Sequential(
            ConvBlock(3, 64),
            ConvBlock(64, 64),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Block 2: 2 conv(128) -> pool
        self.block2 = nn.Sequential(
            ConvBlock(64, 128),
            ConvBlock(128, 128),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Block 3: 3 conv(256) -> pool (stride 8)
        self.block3 = nn.Sequential(
            ConvBlock(128, 256),
            ConvBlock(256, 256),
            ConvBlock(256, 256),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Block 4: 3 conv(512) -> pool (stride 16)
        self.block4 = nn.Sequential(
            ConvBlock(256, 512),
            ConvBlock(512, 512),
            ConvBlock(512, 512),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Block 5: 3 conv(512) -> pool (stride 32)
        self.block5 = nn.Sequential(
            ConvBlock(512, 512),
            ConvBlock(512, 512),
            ConvBlock(512, 512),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Fully convolutional replacement of FC layers
        self.conv6 = nn.Sequential(
            nn.Conv2d(512, FC6_OUT, kernel_size=7, padding=3),
            nn.ReLU(inplace=True),
            nn.Dropout2d(p=0.5),
        )

        self.conv7 = nn.Sequential(
            nn.Conv2d(FC6_OUT, FC7_OUT, kernel_size=1),
            nn.ReLU(inplace=True),
            nn.Dropout2d(p=0.5),
        )

        self.conv8 = nn.Conv2d(FC7_OUT, num_classes, kernel_size=1)

        # Skip connection: pool4 -> 1x1 conv to num_classes
        self.score_pool4 = nn.Conv2d(512, num_classes, kernel_size=1)

        # Skip connection: pool3 -> 1x1 conv to num_classes
        self.score_pool3 = nn.Conv2d(256, num_classes, kernel_size=1)

        # Learnable upsampling via transposed convolution
        # conv7 2x upsample -> stride 16
        self.upscore2 = nn.ConvTranspose2d(
            num_classes, num_classes, kernel_size=4, stride=2, padding=1, bias=False
        )

        # fused (pool4 + upscore2) 2x upsample -> stride 8
        self.upscore_pool4 = nn.ConvTranspose2d(
            num_classes, num_classes, kernel_size=4, stride=2, padding=1, bias=False
        )

        # fused (pool3 + upscore_pool4) 8x upsample -> original size
        self.upscore8 = nn.ConvTranspose2d(
            num_classes, num_classes, kernel_size=16, stride=8, padding=4, bias=False
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = x

        h = self.block1(h)
        h = self.block2(h)
        pool3 = self.block3(h)
        pool4 = self.block4(pool3)
        pool5 = self.block5(pool4)

        conv7 = self.conv8(self.conv7(self.conv6(pool5)))

        # Upsample conv7 by 2x and fuse with pool4
        upscore2 = self.upscore2(conv7)
        score_pool4 = self.score_pool4(pool4)
        fuse_pool4 = upscore2 + score_pool4

        # Upsample fused by 2x and fuse with pool3
        upscore_pool4 = self.upscore_pool4(fuse_pool4)
        score_pool3 = self.score_pool3(pool3)
        fuse_pool3 = upscore_pool4 + score_pool3

        # Upsample to original input size by 8x
        out = self.upscore8(fuse_pool3)

        # Crop to match input size if needed
        _, _, H, W = x.shape
        out = out[:, :, :H, :W]

        return out


# ---------------------------------------------------------------------------
# Sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = FCN8s(num_classes=NUM_CLASSES)
    dummy = torch.randn(2, 3, 224, 224)
    out = model(dummy)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Input shape:  {dummy.shape}")
    print(f"Output shape: {out.shape}")
    print(f"Total parameters: {total_params:,} (~{total_params / 1e6:.1f}M)")
