"""
Going Deeper with Convolutions
Christian Szegedy, Wei Liu, Yangqing Jia, Pierre Sermanet, Scott Reed,
Dragomir Anguelov, Dumitru Erhan, Vincent Vanhoucke, Andrew Rabinovich
CVPR 2015 (arXiv:1409.4842)

Paper-faithful implementation of GoogLeNet (Inception v1).
"""

import torch
import torch.nn as nn


# ------------------------------------------------------------------
# Configuration constants (exact values from the paper)
# ------------------------------------------------------------------
INPUT_SIZE = 224
NUM_CLASSES = 1000
DROPOUT = 0.4


# ------------------------------------------------------------------
# Reusable building blocks
# ------------------------------------------------------------------
class BasicConv2d(nn.Module):
    """Conv2d + ReLU."""

    def __init__(self, in_channels, out_channels, **kwargs):
        super(BasicConv2d, self).__init__()
        self.conv = nn.Conv2d(in_channels, out_channels, bias=True, **kwargs)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        x = self.conv(x)
        x = self.relu(x)
        return x


class Inception(nn.Module):
    """
    Inception module with four parallel branches:
      1. 1x1 conv
      2. 1x1 conv -> 3x3 conv
      3. 1x1 conv -> 5x5 conv
      4. 3x3 maxpool -> 1x1 conv
    """

    def __init__(self, in_channels, ch1x1, ch3x3red, ch3x3, ch5x5red, ch5x5, pool_proj):
        super(Inception, self).__init__()
        self.branch1 = BasicConv2d(in_channels, ch1x1, kernel_size=1)

        self.branch2 = nn.Sequential(
            BasicConv2d(in_channels, ch3x3red, kernel_size=1),
            BasicConv2d(ch3x3red, ch3x3, kernel_size=3, padding=1),
        )

        self.branch3 = nn.Sequential(
            BasicConv2d(in_channels, ch5x5red, kernel_size=1),
            BasicConv2d(ch5x5red, ch5x5, kernel_size=5, padding=2),
        )

        self.branch4 = nn.Sequential(
            nn.MaxPool2d(kernel_size=3, stride=1, padding=1),
            BasicConv2d(in_channels, pool_proj, kernel_size=1),
        )

    def forward(self, x):
        b1 = self.branch1(x)
        b2 = self.branch2(x)
        b3 = self.branch3(x)
        b4 = self.branch4(x)
        return torch.cat([b1, b2, b3, b4], dim=1)


class AuxiliaryClassifier(nn.Module):
    """Auxiliary classifier attached to intermediate Inception outputs."""

    def __init__(self, in_channels, num_classes):
        super(AuxiliaryClassifier, self).__init__()
        self.avgpool = nn.AvgPool2d(kernel_size=5, stride=3)
        self.conv = BasicConv2d(in_channels, 128, kernel_size=1)
        self.fc1 = nn.Linear(2048, 1024)
        self.fc2 = nn.Linear(1024, num_classes)

    def forward(self, x):
        x = self.avgpool(x)
        x = self.conv(x)
        x = torch.flatten(x, 1)
        x = nn.functional.dropout(x, 0.7, training=self.training)
        x = self.fc1(x)
        x = nn.functional.relu(x, inplace=True)
        x = nn.functional.dropout(x, 0.7, training=self.training)
        x = self.fc2(x)
        return x


# ------------------------------------------------------------------
# GoogLeNet
# ------------------------------------------------------------------
class GoogLeNet(nn.Module):
    def __init__(self, num_classes=NUM_CLASSES, aux_logits=True):
        super(GoogLeNet, self).__init__()
        self.aux_logits = aux_logits

        # Stem
        self.conv1 = BasicConv2d(3, 64, kernel_size=7, stride=2, padding=3)
        self.maxpool1 = nn.MaxPool2d(3, stride=2, ceil_mode=True)
        self.lrn1 = nn.LocalResponseNorm(5, alpha=1e-4, beta=0.75, k=2)

        self.conv2 = BasicConv2d(64, 64, kernel_size=1)
        self.conv3 = BasicConv2d(64, 192, kernel_size=3, padding=1)
        self.lrn2 = nn.LocalResponseNorm(5, alpha=1e-4, beta=0.75, k=2)
        self.maxpool2 = nn.MaxPool2d(3, stride=2, ceil_mode=True)

        # Inception modules
        self.inception3a = Inception(192, 64, 96, 128, 16, 32, 32)
        self.inception3b = Inception(256, 128, 128, 192, 32, 96, 64)
        self.maxpool3 = nn.MaxPool2d(3, stride=2, ceil_mode=True)

        self.inception4a = Inception(480, 192, 96, 208, 16, 48, 64)
        self.inception4b = Inception(512, 160, 112, 224, 24, 64, 64)
        self.inception4c = Inception(512, 128, 128, 256, 24, 64, 64)
        self.inception4d = Inception(512, 112, 144, 288, 32, 64, 64)
        self.inception4e = Inception(528, 256, 160, 320, 32, 128, 128)
        self.maxpool4 = nn.MaxPool2d(3, stride=2, ceil_mode=True)

        self.inception5a = Inception(832, 256, 160, 320, 32, 128, 128)
        self.inception5b = Inception(832, 384, 192, 384, 48, 128, 128)

        # Auxiliary classifiers
        if aux_logits:
            self.aux1 = AuxiliaryClassifier(512, num_classes)
            self.aux2 = AuxiliaryClassifier(528, num_classes)

        # Classifier head
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.dropout = nn.Dropout(DROPOUT)
        self.fc = nn.Linear(1024, num_classes)

    def forward(self, x):
        x = self.conv1(x)
        x = self.maxpool1(x)
        x = self.lrn1(x)

        x = self.conv2(x)
        x = self.conv3(x)
        x = self.lrn2(x)
        x = self.maxpool2(x)

        x = self.inception3a(x)
        x = self.inception3b(x)
        x = self.maxpool3(x)

        x = self.inception4a(x)
        if self.training and self.aux_logits:
            aux1 = self.aux1(x)

        x = self.inception4b(x)
        x = self.inception4c(x)
        x = self.inception4d(x)
        if self.training and self.aux_logits:
            aux2 = self.aux2(x)

        x = self.inception4e(x)
        x = self.maxpool4(x)

        x = self.inception5a(x)
        x = self.inception5b(x)

        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        x = self.dropout(x)
        x = self.fc(x)

        if self.training and self.aux_logits:
            return x, aux2, aux1
        return x


# ------------------------------------------------------------------
# Sanity check
# ------------------------------------------------------------------
if __name__ == "__main__":
    model = GoogLeNet(num_classes=NUM_CLASSES, aux_logits=True)
    x = torch.randn(2, 3, INPUT_SIZE, INPUT_SIZE)

    model.train()
    out, aux2, aux1 = model(x)
    print("Input shape :", x.shape)
    print("Main output :", out.shape)
    print("Aux2 output :", aux2.shape)
    print("Aux1 output :", aux1.shape)

    model.eval()
    out_eval = model(x)
    print("Eval output :", out_eval.shape)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,}")
