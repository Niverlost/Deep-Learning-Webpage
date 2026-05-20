"""
Very Deep Convolutional Networks for Large-Scale Image Recognition
Karen Simonyan, Andrew Zisserman
2014
arXiv: https://arxiv.org/abs/1409.1556

Paper-faithful VGG-16 (Configuration D) implementation.
No BatchNorm — VGG predates BatchNorm (Ioffe & Szegedy, 2015).
"""

import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# Configuration constants (from paper, Table 1, Configuration D)
# ---------------------------------------------------------------------------
INPUT_SIZE = 224          # spatial size of input images
NUM_CLASSES = 1000        # ImageNet classes

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


class VGG16(nn.Module):
    """VGG-16 (Configuration D) — 13 conv layers + 3 FC layers."""

    def __init__(self, num_classes: int = NUM_CLASSES) -> None:
        super().__init__()

        # Block 1: 2 conv(64)
        self.block1 = nn.Sequential(
            ConvBlock(3, 64),
            ConvBlock(64, 64),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Block 2: 2 conv(128)
        self.block2 = nn.Sequential(
            ConvBlock(64, 128),
            ConvBlock(128, 128),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Block 3: 3 conv(256)
        self.block3 = nn.Sequential(
            ConvBlock(128, 256),
            ConvBlock(256, 256),
            ConvBlock(256, 256),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Block 4: 3 conv(512)
        self.block4 = nn.Sequential(
            ConvBlock(256, 512),
            ConvBlock(512, 512),
            ConvBlock(512, 512),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Block 5: 3 conv(512)
        self.block5 = nn.Sequential(
            ConvBlock(512, 512),
            ConvBlock(512, 512),
            ConvBlock(512, 512),
            nn.MaxPool2d(kernel_size=POOL_KERNEL, stride=POOL_STRIDE),
        )

        # Classifier
        self.fc6 = nn.Sequential(
            nn.Linear(512 * 7 * 7, FC6_OUT),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.5),
        )
        self.fc7 = nn.Sequential(
            nn.Linear(FC6_OUT, FC7_OUT),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.5),
        )
        self.fc8 = nn.Linear(FC7_OUT, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.block1(x)
        x = self.block2(x)
        x = self.block3(x)
        x = self.block4(x)
        x = self.block5(x)
        x = torch.flatten(x, start_dim=1)
        x = self.fc6(x)
        x = self.fc7(x)
        x = self.fc8(x)
        return x


# ---------------------------------------------------------------------------
# Sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = VGG16(num_classes=NUM_CLASSES)
    dummy = torch.randn(2, 3, INPUT_SIZE, INPUT_SIZE)
    out = model(dummy)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Input shape:  {dummy.shape}")
    print(f"Output shape: {out.shape}")
    print(f"Total parameters: {total_params:,} (~{total_params / 1e6:.1f}M)")
