"""
A ConvNet for the 2020s
Zhuang Liu, Hanzi Mao, Chao-Yuan Wu, Christoph Feichtenhofer, Trevor Darrell, Saining Xie
CVPR 2022
arXiv: https://arxiv.org/abs/2201.03545

Paper-faithful implementation of ConvNeXt-Tiny.
"""

import torch
import torch.nn as nn


IN_CHANNELS = 3
NUM_CLASSES = 1000
STEM_CHANNELS = 96
STAGE_CHANNELS = [96, 192, 384, 768]
STAGE_DEPTHS = [3, 3, 9, 3]
KERNEL_SIZE = 7
EXPANSION_RATIO = 4


class ConvNeXtBlock(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.dwconv = nn.Conv2d(dim, dim, kernel_size=KERNEL_SIZE, padding=KERNEL_SIZE // 2, groups=dim)
        self.norm = nn.LayerNorm(dim, eps=1e-6)
        self.pwconv1 = nn.Linear(dim, EXPANSION_RATIO * dim)
        self.act = nn.GELU()
        self.pwconv2 = nn.Linear(EXPANSION_RATIO * dim, dim)

    def forward(self, x):
        shortcut = x
        x = self.dwconv(x)
        x = x.permute(0, 2, 3, 1)
        x = self.norm(x)
        x = self.pwconv1(x)
        x = self.act(x)
        x = self.pwconv2(x)
        x = x.permute(0, 3, 1, 2)
        x = shortcut + x
        return x


class DownsampleLayer(nn.Module):
    def __init__(self, in_dim, out_dim):
        super().__init__()
        self.norm = nn.LayerNorm(in_dim, eps=1e-6)
        self.conv = nn.Conv2d(in_dim, out_dim, kernel_size=2, stride=2)

    def forward(self, x):
        x = x.permute(0, 2, 3, 1)
        x = self.norm(x)
        x = x.permute(0, 3, 1, 2)
        x = self.conv(x)
        return x


class ConvNeXtTiny(nn.Module):
    def __init__(self, in_channels=IN_CHANNELS, num_classes=NUM_CLASSES):
        super().__init__()
        self.stem = nn.Conv2d(in_channels, STEM_CHANNELS, kernel_size=4, stride=4)

        self.stages = nn.ModuleList()
        dims = [STEM_CHANNELS] + STAGE_CHANNELS
        for i in range(len(STAGE_CHANNELS)):
            stage = nn.Sequential(
                *[ConvNeXtBlock(dims[i + 1]) for _ in range(STAGE_DEPTHS[i])]
            )
            self.stages.append(stage)

        self.downsamples = nn.ModuleList()
        for i in range(len(STAGE_CHANNELS)):
            self.downsamples.append(
                DownsampleLayer(dims[i], dims[i + 1])
            )

        self.norm = nn.LayerNorm(STAGE_CHANNELS[-1], eps=1e-6)
        self.head = nn.Linear(STAGE_CHANNELS[-1], num_classes)

    def forward(self, x):
        x = self.stem(x)
        for i in range(len(self.stages)):
            x = self.downsamples[i](x)
            x = self.stages[i](x)
        x = x.permute(0, 2, 3, 1)
        x = self.norm(x)
        x = x.mean(dim=[1, 2])
        x = self.head(x)
        return x


if __name__ == "__main__":
    model = ConvNeXtTiny()
    x = torch.randn(2, 3, 224, 224)
    y = model(x)
    print(f"Input shape:  {x.shape}")
    print(f"Output shape: {y.shape}")
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,}")
