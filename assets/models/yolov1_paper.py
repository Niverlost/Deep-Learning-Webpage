"""
You Only Look Once: Unified, Real-Time Object Detection
Joseph Redmon, Santosh Divvala, Ross Girshick, Ali Farhadi
CVPR 2016
arXiv: https://arxiv.org/abs/1506.02640

Paper-faithful implementation of YOLOv1.
No BatchNorm (paper does not use it).
Activation: LeakyReLU(0.1), final layer linear.
"""

import torch
import torch.nn as nn


S = 7
B = 2
C = 20
INPUT_SIZE = 448


class ConvBlock(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_size, stride=1, padding=0):
        super().__init__()
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size, stride, padding)
        self.activation = nn.LeakyReLU(0.1)

    def forward(self, x):
        return self.activation(self.conv(x))


class YOLOv1(nn.Module):
    def __init__(self, S=7, B=2, C=20):
        super().__init__()
        self.S = S
        self.B = B
        self.C = C

        self.features = nn.Sequential(
            ConvBlock(3, 64, 7, stride=2, padding=3),
            nn.MaxPool2d(2, 2),

            ConvBlock(64, 192, 3, padding=1),
            nn.MaxPool2d(2, 2),

            ConvBlock(192, 128, 1),
            ConvBlock(128, 256, 3, padding=1),
            ConvBlock(256, 256, 1),
            ConvBlock(256, 512, 3, padding=1),
            nn.MaxPool2d(2, 2),

            ConvBlock(512, 256, 1),
            ConvBlock(256, 512, 3, padding=1),
            ConvBlock(512, 256, 1),
            ConvBlock(256, 512, 3, padding=1),
            ConvBlock(512, 256, 1),
            ConvBlock(256, 512, 3, padding=1),
            ConvBlock(512, 256, 1),
            ConvBlock(256, 512, 3, padding=1),

            ConvBlock(512, 512, 1),
            ConvBlock(512, 1024, 3, padding=1),
            nn.MaxPool2d(2, 2),

            ConvBlock(1024, 512, 1),
            ConvBlock(512, 1024, 3, padding=1),
            ConvBlock(1024, 512, 1),
            ConvBlock(512, 1024, 3, padding=1),

            ConvBlock(1024, 1024, 3, padding=1),
            ConvBlock(1024, 1024, 3, stride=2, padding=1),

            ConvBlock(1024, 1024, 3, padding=1),
            ConvBlock(1024, 1024, 3, padding=1),
        )

        self.fc = nn.Sequential(
            nn.Flatten(),
            nn.Linear(1024 * S * S, 4096),
            nn.LeakyReLU(0.1),
            nn.Dropout(0.5),
            nn.Linear(4096, S * S * (B * 5 + C)),
        )

    def forward(self, x):
        x = self.features(x)
        x = self.fc(x)
        x = x.view(-1, self.S, self.S, self.B * 5 + self.C)
        return x.permute(0, 3, 1, 2)


if __name__ == "__main__":
    model = YOLOv1(S=S, B=B, C=C)
    dummy = torch.randn(1, 3, INPUT_SIZE, INPUT_SIZE)
    out = model(dummy)

    print(f"Input shape:  {dummy.shape}")
    print(f"Output shape: {out.shape}")

    total = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total:,}")
