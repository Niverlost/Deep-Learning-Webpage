"""
Focal Loss for Dense Object Detection
Tsung-Yi Lin, Priya Goyal, Ross Girshick, Kaiming He, Piotr Dollar
ICCV 2017
arXiv: https://arxiv.org/abs/1708.02002

Paper-faithful implementation of RetinaNet with ResNet-50-FPN backbone.
"""

import math
import torch
import torch.nn as nn
from torchvision.ops import sigmoid_focal_loss


C = 80
A = 9


class Bottleneck(nn.Module):
    expansion = 4

    def __init__(self, in_planes, planes, stride=1, downsample=None):
        super().__init__()
        self.conv1 = nn.Conv2d(in_planes, planes, kernel_size=1, bias=False)
        self.bn1 = nn.BatchNorm2d(planes)
        self.conv2 = nn.Conv2d(planes, planes, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(planes)
        self.conv3 = nn.Conv2d(planes, planes * self.expansion, kernel_size=1, bias=False)
        self.bn3 = nn.BatchNorm2d(planes * self.expansion)
        self.relu = nn.ReLU(inplace=True)
        self.downsample = downsample
        self.stride = stride

    def forward(self, x):
        identity = x

        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)

        out = self.conv2(out)
        out = self.bn2(out)
        out = self.relu(out)

        out = self.conv3(out)
        out = self.bn3(out)

        if self.downsample is not None:
            identity = self.downsample(x)

        out += identity
        out = self.relu(out)
        return out


class ResNet50(nn.Module):
    def __init__(self):
        super().__init__()
        self.in_planes = 64

        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        self.layer1 = self._make_layer(64, 3, stride=1)
        self.layer2 = self._make_layer(128, 4, stride=2)
        self.layer3 = self._make_layer(256, 6, stride=2)
        self.layer4 = self._make_layer(512, 3, stride=2)

        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def _make_layer(self, planes, blocks, stride):
        downsample = None
        if stride != 1 or self.in_planes != planes * Bottleneck.expansion:
            downsample = nn.Sequential(
                nn.Conv2d(self.in_planes, planes * Bottleneck.expansion, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(planes * Bottleneck.expansion),
            )
        layers = [Bottleneck(self.in_planes, planes, stride, downsample)]
        self.in_planes = planes * Bottleneck.expansion
        for _ in range(1, blocks):
            layers.append(Bottleneck(self.in_planes, planes))
        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)

        c2 = self.layer1(x)
        c3 = self.layer2(c2)
        c4 = self.layer3(c3)
        c5 = self.layer4(c4)
        return c3, c4, c5


class FPN(nn.Module):
    def __init__(self, in_channels_list, out_channels=256):
        super().__init__()
        self.lateral_c5 = nn.Conv2d(in_channels_list[2], out_channels, kernel_size=1)
        self.lateral_c4 = nn.Conv2d(in_channels_list[1], out_channels, kernel_size=1)
        self.lateral_c3 = nn.Conv2d(in_channels_list[0], out_channels, kernel_size=1)

        self.smooth_p4 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
        self.smooth_p3 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)

        self.p6 = nn.Conv2d(in_channels_list[2], out_channels, kernel_size=3, stride=2, padding=1)
        self.p7 = nn.Sequential(
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, stride=2, padding=1),
        )

        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_uniform_(m.weight, a=0)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def forward(self, c3, c4, c5):
        p5 = self.lateral_c5(c5)
        p4 = self.lateral_c4(c4)
        p4 = p4 + nn.functional.interpolate(p5, size=p4.shape[-2:], mode='nearest')
        p4 = self.smooth_p4(p4)

        p3 = self.lateral_c3(c3)
        p3 = p3 + nn.functional.interpolate(p4, size=p3.shape[-2:], mode='nearest')
        p3 = self.smooth_p3(p3)

        p6 = self.p6(c5)
        p7 = self.p7(p6)

        return p3, p4, p5, p6, p7


class ClassificationSubnet(nn.Module):
    def __init__(self, num_classes=C, num_anchors=A, in_channels=256):
        super().__init__()
        self.num_classes = num_classes
        self.num_anchors = num_anchors

        self.conv1 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.conv3 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.conv4 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.cls = nn.Conv2d(in_channels, num_anchors * num_classes, kernel_size=3, padding=1)

        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.normal_(m.weight, mean=0, std=0.01)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
        pi = 0.01
        nn.init.constant_(self.cls.bias, -math.log((1 - pi) / pi))

    def forward(self, x):
        x = nn.functional.relu(self.conv1(x))
        x = nn.functional.relu(self.conv2(x))
        x = nn.functional.relu(self.conv3(x))
        x = nn.functional.relu(self.conv4(x))
        x = self.cls(x)
        x = torch.sigmoid(x)
        return x


class BoxRegressionSubnet(nn.Module):
    def __init__(self, num_anchors=A, in_channels=256):
        super().__init__()
        self.num_anchors = num_anchors

        self.conv1 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.conv3 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.conv4 = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1)
        self.reg = nn.Conv2d(in_channels, num_anchors * 4, kernel_size=3, padding=1)

        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.normal_(m.weight, mean=0, std=0.01)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def forward(self, x):
        x = nn.functional.relu(self.conv1(x))
        x = nn.functional.relu(self.conv2(x))
        x = nn.functional.relu(self.conv3(x))
        x = nn.functional.relu(self.conv4(x))
        x = self.reg(x)
        return x


class RetinaNet(nn.Module):
    def __init__(self, num_classes=C, num_anchors=A):
        super().__init__()
        self.backbone = ResNet50()
        self.fpn = FPN([512, 1024, 2048])
        self.cls_subnet = ClassificationSubnet(num_classes, num_anchors)
        self.reg_subnet = BoxRegressionSubnet(num_anchors)

    def forward(self, x):
        c3, c4, c5 = self.backbone(x)
        p3, p4, p5, p6, p7 = self.fpn(c3, c4, c5)

        cls_outs = []
        reg_outs = []
        for p in (p3, p4, p5, p6, p7):
            cls_outs.append(self.cls_subnet(p))
            reg_outs.append(self.reg_subnet(p))

        return cls_outs, reg_outs


if __name__ == "__main__":
    model = RetinaNet(num_classes=80, num_anchors=9)
    x = torch.randn(2, 3, 800, 800)
    cls_outs, reg_outs = model(x)

    print("Input shape:", x.shape)
    for i, (cls, reg) in enumerate(zip(cls_outs, reg_outs)):
        print(f"P{i+3}  cls: {cls.shape}  reg: {reg.shape}")

    total = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total / 1e6:.2f}M")
