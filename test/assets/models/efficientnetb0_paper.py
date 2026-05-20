"""
EfficientNet: Rethinking Model Scaling for Convolutional Neural Networks
Mingxing Tan, Quoc V. Le
2019
https://arxiv.org/abs/1905.11946

Paper-faithful implementation of EfficientNet-B0 baseline.
"""

import torch
import torch.nn as nn


# Configuration constants
IMAGE_SIZE = 224
NUM_CLASSES = 1000
STEM_CHANNELS = 32
STEM_KERNEL = 3
STEM_STRIDE = 2
STEM_PADDING = 1

STAGES = [
    # (kernel, expansion, channels, repeats, stride)
    (3, 1, 16, 1, 1),
    (3, 6, 24, 2, 2),
    (5, 6, 40, 2, 2),
    (3, 6, 80, 3, 2),
    (5, 6, 112, 3, 1),
    (5, 6, 192, 4, 2),
    (3, 6, 320, 1, 1),
]

HEAD_CHANNELS = 1280
SE_REDUCTION = 4


class Swish(nn.Module):
    def forward(self, x):
        return x * torch.sigmoid(x)


class SEBlock(nn.Module):
    def __init__(self, channels, reduction):
        super().__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.fc1 = nn.Conv2d(channels, channels // reduction, kernel_size=1)
        self.swish = Swish()
        self.fc2 = nn.Conv2d(channels // reduction, channels, kernel_size=1)

    def forward(self, x):
        out = self.avg_pool(x)
        out = self.fc1(out)
        out = self.swish(out)
        out = self.fc2(out)
        out = torch.sigmoid(out)
        return x * out


class MBConv(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_size, expansion, stride, se_reduction):
        super().__init__()
        self.use_residual = (stride == 1 and in_channels == out_channels)
        hidden_dim = in_channels * expansion

        layers = []
        if expansion != 1:
            layers += [
                nn.Conv2d(in_channels, hidden_dim, kernel_size=1, bias=False),
                nn.BatchNorm2d(hidden_dim),
                Swish(),
            ]

        layers += [
            nn.Conv2d(hidden_dim, hidden_dim, kernel_size=kernel_size, stride=stride,
                      padding=(kernel_size - 1) // 2, groups=hidden_dim, bias=False),
            nn.BatchNorm2d(hidden_dim),
            Swish(),
            SEBlock(hidden_dim, se_reduction),
            nn.Conv2d(hidden_dim, out_channels, kernel_size=1, bias=False),
            nn.BatchNorm2d(out_channels),
        ]

        self.conv = nn.Sequential(*layers)

    def forward(self, x):
        out = self.conv(x)
        if self.use_residual:
            out = out + x
        return out


class EfficientNetB0(nn.Module):
    def __init__(self, num_classes=NUM_CLASSES):
        super().__init__()

        self.stem = nn.Sequential(
            nn.Conv2d(3, STEM_CHANNELS, kernel_size=STEM_KERNEL, stride=STEM_STRIDE,
                      padding=STEM_PADDING, bias=False),
            nn.BatchNorm2d(STEM_CHANNELS),
            Swish(),
        )

        layers = []
        in_channels = STEM_CHANNELS
        for k, exp, c, n, s in STAGES:
            for i in range(n):
                stride = s if i == 0 else 1
                layers.append(MBConv(in_channels, c, k, exp, stride, SE_REDUCTION))
                in_channels = c

        self.blocks = nn.Sequential(*layers)

        self.head = nn.Sequential(
            nn.Conv2d(in_channels, HEAD_CHANNELS, kernel_size=1, bias=False),
            nn.BatchNorm2d(HEAD_CHANNELS),
            Swish(),
        )

        self.avgpool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Linear(HEAD_CHANNELS, num_classes)

    def forward(self, x):
        x = self.stem(x)
        x = self.blocks(x)
        x = self.head(x)
        x = self.avgpool(x)
        x = x.flatten(1)
        x = self.fc(x)
        return x


if __name__ == "__main__":
    model = EfficientNetB0()
    x = torch.randn(2, 3, IMAGE_SIZE, IMAGE_SIZE)
    out = model(x)
    print(f"Input shape:  {x.shape}")
    print(f"Output shape: {out.shape}")
    total = sum(p.numel() for p in model.parameters())
    print(f"Total params: {total / 1e6:.2f}M")
