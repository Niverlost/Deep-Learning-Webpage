"""
Densely Connected Convolutional Networks
Gao Huang, Zhuang Liu, Laurens van der Maaten, Kilian Q. Weinberger
CVPR 2017
https://arxiv.org/abs/1608.06993

Paper-faithful implementation of DenseNet-121.
"""

import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# Configuration constants (exact values from the paper, Table 1)
# ---------------------------------------------------------------------------
GROWTH_RATE = 32          # k = 32
THETA = 0.5               # compression factor in Transition layers
NUM_CLASSES = 1000        # ImageNet
INPUT_SIZE = 224

# Number of layers in each DenseBlock for DenseNet-121
NUM_LAYERS = [6, 12, 24, 16]

# Initial convolution
INIT_CHANNELS = 64


# ---------------------------------------------------------------------------
# Architecture blocks
# ---------------------------------------------------------------------------
class _DenseLayer(nn.Module):
    """Single dense layer: BN -> ReLU -> 3x3 Conv (no bottleneck for DenseNet-121)."""

    def __init__(self, in_channels: int, growth_rate: int = GROWTH_RATE):
        super().__init__()
        self.bn = nn.BatchNorm2d(in_channels)
        self.relu = nn.ReLU(inplace=True)
        self.conv = nn.Conv2d(
            in_channels, growth_rate,
            kernel_size=3, stride=1, padding=1, bias=False
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.conv(self.relu(self.bn(x)))
        return torch.cat([x, out], dim=1)


class _DenseBlock(nn.Module):
    """DenseBlock consisting of `num_layers` _DenseLayer modules."""

    def __init__(self, num_layers: int, in_channels: int, growth_rate: int = GROWTH_RATE):
        super().__init__()
        layers = []
        for i in range(num_layers):
            layers.append(_DenseLayer(in_channels + i * growth_rate, growth_rate))
        self.block = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class _Transition(nn.Module):
    """Transition layer: BN -> ReLU -> 1x1 Conv (compression) -> 2x2 AvgPool."""

    def __init__(self, in_channels: int, theta: float = THETA):
        super().__init__()
        out_channels = int(in_channels * theta)
        self.bn = nn.BatchNorm2d(in_channels)
        self.relu = nn.ReLU(inplace=True)
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size=1, stride=1, bias=False)
        self.pool = nn.AvgPool2d(kernel_size=2, stride=2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.conv(self.relu(self.bn(x)))
        x = self.pool(x)
        return x


# ---------------------------------------------------------------------------
# Full model
# ---------------------------------------------------------------------------
class DenseNet121(nn.Module):
    """DenseNet-121 for ImageNet classification."""

    def __init__(self, num_classes: int = NUM_CLASSES):
        super().__init__()

        # Initial convolution + pooling
        self.conv1 = nn.Conv2d(3, INIT_CHANNELS, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(INIT_CHANNELS)
        self.relu = nn.ReLU(inplace=True)
        self.pool1 = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        # DenseBlock1: 6 layers
        self.dense1 = _DenseBlock(NUM_LAYERS[0], INIT_CHANNELS, GROWTH_RATE)
        num_channels = INIT_CHANNELS + NUM_LAYERS[0] * GROWTH_RATE  # 64 + 6*32 = 256
        self.trans1 = _Transition(num_channels, THETA)
        num_channels = int(num_channels * THETA)  # 128

        # DenseBlock2: 12 layers
        self.dense2 = _DenseBlock(NUM_LAYERS[1], num_channels, GROWTH_RATE)
        num_channels = num_channels + NUM_LAYERS[1] * GROWTH_RATE  # 128 + 12*32 = 512
        self.trans2 = _Transition(num_channels, THETA)
        num_channels = int(num_channels * THETA)  # 256

        # DenseBlock3: 24 layers
        self.dense3 = _DenseBlock(NUM_LAYERS[2], num_channels, GROWTH_RATE)
        num_channels = num_channels + NUM_LAYERS[2] * GROWTH_RATE  # 256 + 24*32 = 1024
        self.trans3 = _Transition(num_channels, THETA)
        num_channels = int(num_channels * THETA)  # 512

        # DenseBlock4: 16 layers
        self.dense4 = _DenseBlock(NUM_LAYERS[3], num_channels, GROWTH_RATE)
        num_channels = num_channels + NUM_LAYERS[3] * GROWTH_RATE  # 512 + 16*32 = 1024

        # Final BN + classifier
        self.bn_final = nn.BatchNorm2d(num_channels)
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(num_channels, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.pool1(x)

        x = self.dense1(x)
        x = self.trans1(x)

        x = self.dense2(x)
        x = self.trans2(x)

        x = self.dense3(x)
        x = self.trans3(x)

        x = self.dense4(x)
        x = self.bn_final(x)
        x = self.relu(x)
        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        x = self.fc(x)
        return x


# ---------------------------------------------------------------------------
# Sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = DenseNet121(num_classes=1000)
    x = torch.randn(2, 3, 224, 224)
    y = model(x)
    print(f"Input shape:  {x.shape}")
    print(f"Output shape: {y.shape}")
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,} (~{total_params / 1e6:.1f}M)")
