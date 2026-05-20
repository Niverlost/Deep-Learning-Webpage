"""
Squeeze-and-Excitation Networks
Jie Hu, Li Shen, Samuel Albanie, Gang Sun, Enhua Wu
2018 (CVPR 2018 / TPAMI 2019)
arXiv: https://arxiv.org/abs/1709.01507

Paper-faithful implementation of SE-ResNet-50.
SE block is inserted into every Bottleneck block before the residual addition.
"""

import torch
import torch.nn as nn


# ------------------------------------------------------------------
# Configuration constants (exact values from the paper)
# ------------------------------------------------------------------
INPUT_SIZE = 224
NUM_CLASSES = 1000
REDUCTION = 16


# ------------------------------------------------------------------
# SE block
# ------------------------------------------------------------------
class SEBlock(nn.Module):
    def __init__(self, channels, reduction=REDUCTION):
        super().__init__()
        self.avgpool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Sequential(
            nn.Linear(channels, channels // reduction, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(channels // reduction, channels, bias=False),
            nn.Sigmoid(),
        )

    def forward(self, x):
        b, c, _, _ = x.size()
        y = self.avgpool(x).view(b, c)
        y = self.fc(y).view(b, c, 1, 1)
        return x * y.expand_as(x)


# ------------------------------------------------------------------
# Bottleneck block with SE
# ------------------------------------------------------------------
class SEBottleneck(nn.Module):
    expansion = 4

    def __init__(self, in_planes, planes, stride=1, reduction=REDUCTION):
        super().__init__()
        self.conv1 = nn.Conv2d(in_planes, planes, kernel_size=1, bias=False)
        self.bn1 = nn.BatchNorm2d(planes)
        self.conv2 = nn.Conv2d(planes, planes, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(planes)
        self.conv3 = nn.Conv2d(planes, planes * self.expansion, kernel_size=1, bias=False)
        self.bn3 = nn.BatchNorm2d(planes * self.expansion)
        self.relu = nn.ReLU(inplace=True)
        self.se = SEBlock(planes * self.expansion, reduction)

        self.shortcut = nn.Sequential()
        if stride != 1 or in_planes != planes * self.expansion:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_planes, planes * self.expansion, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(planes * self.expansion),
            )

    def forward(self, x):
        out = self.relu(self.bn1(self.conv1(x)))
        out = self.relu(self.bn2(self.conv2(out)))
        out = self.bn3(self.conv3(out))
        out = self.se(out)
        out += self.shortcut(x)
        out = self.relu(out)
        return out


# ------------------------------------------------------------------
# SE-ResNet-50
# ------------------------------------------------------------------
class SEResNet50(nn.Module):
    def __init__(self, num_classes=NUM_CLASSES, reduction=REDUCTION):
        super().__init__()
        self.in_planes = 64

        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        self.layer1 = self._make_layer(64, 3, stride=1, reduction=reduction)
        self.layer2 = self._make_layer(128, 4, stride=2, reduction=reduction)
        self.layer3 = self._make_layer(256, 6, stride=2, reduction=reduction)
        self.layer4 = self._make_layer(512, 3, stride=2, reduction=reduction)

        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(512 * SEBottleneck.expansion, num_classes)

    def _make_layer(self, planes, num_blocks, stride, reduction):
        layers = [SEBottleneck(self.in_planes, planes, stride, reduction)]
        self.in_planes = planes * SEBottleneck.expansion
        for _ in range(1, num_blocks):
            layers.append(SEBottleneck(self.in_planes, planes, 1, reduction))
        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)

        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)

        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        x = self.fc(x)
        return x


# ------------------------------------------------------------------
# Sanity check
# ------------------------------------------------------------------
if __name__ == "__main__":
    model = SEResNet50(num_classes=NUM_CLASSES)
    dummy = torch.randn(2, 3, INPUT_SIZE, INPUT_SIZE)
    out = model(dummy)
    total = sum(p.numel() for p in model.parameters())
    print(f"Input shape:  {dummy.shape}")
    print(f"Output shape: {out.shape}")
    print(f"Total params: {total / 1e6:.1f}M")
