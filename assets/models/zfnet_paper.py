"""
Visualizing and Understanding Convolutional Networks
Matthew D. Zeiler, Rob Fergus
ECCV 2014 (arXiv:1311.2901)
https://arxiv.org/abs/1311.2901

Paper-faithful PyTorch implementation of ZFNet.
"""

import torch
import torch.nn as nn


INPUT_SIZE = 224
NUM_CLASSES = 1000


class ZFNet(nn.Module):
    def __init__(self, num_classes: int = NUM_CLASSES) -> None:
        super(ZFNet, self).__init__()

        self.conv1 = nn.Conv2d(3, 96, kernel_size=7, stride=2, padding=0)
        self.relu1 = nn.ReLU(inplace=True)
        self.pool1 = nn.MaxPool2d(kernel_size=3, stride=2, padding=0)

        self.conv2 = nn.Conv2d(96, 256, kernel_size=5, stride=2, padding=2)
        self.relu2 = nn.ReLU(inplace=True)
        self.pool2 = nn.MaxPool2d(kernel_size=3, stride=2, padding=0)

        self.conv3 = nn.Conv2d(256, 384, kernel_size=3, stride=1, padding=1)
        self.relu3 = nn.ReLU(inplace=True)

        self.conv4 = nn.Conv2d(384, 384, kernel_size=3, stride=1, padding=1)
        self.relu4 = nn.ReLU(inplace=True)

        self.conv5 = nn.Conv2d(384, 256, kernel_size=3, stride=1, padding=1)
        self.relu5 = nn.ReLU(inplace=True)
        self.pool3 = nn.MaxPool2d(kernel_size=3, stride=2, padding=0)

        self.fc6 = nn.Linear(256 * 6 * 6, 4096)
        self.relu6 = nn.ReLU(inplace=True)
        self.dropout6 = nn.Dropout(p=0.5)

        self.fc7 = nn.Linear(4096, 4096)
        self.relu7 = nn.ReLU(inplace=True)
        self.dropout7 = nn.Dropout(p=0.5)

        self.fc8 = nn.Linear(4096, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.conv1(x)
        x = self.relu1(x)
        x = self.pool1(x)

        x = self.conv2(x)
        x = self.relu2(x)
        x = self.pool2(x)

        x = self.conv3(x)
        x = self.relu3(x)

        x = self.conv4(x)
        x = self.relu4(x)

        x = self.conv5(x)
        x = self.relu5(x)
        x = self.pool3(x)

        x = x.view(x.size(0), -1)

        x = self.fc6(x)
        x = self.relu6(x)
        x = self.dropout6(x)

        x = self.fc7(x)
        x = self.relu7(x)
        x = self.dropout7(x)

        x = self.fc8(x)
        return x


if __name__ == "__main__":
    model = ZFNet(num_classes=NUM_CLASSES)
    dummy_input = torch.randn(1, 3, INPUT_SIZE, INPUT_SIZE)
    output = model(dummy_input)

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)

    print(f"Input shape:  {dummy_input.shape}")
    print(f"Output shape: {output.shape}")
    print(f"Total params: {total_params:,}")
    print(f"Trainable params: {trainable_params:,}")
