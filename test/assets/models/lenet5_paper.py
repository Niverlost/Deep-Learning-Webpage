"""
Gradient-Based Learning Applied to Document Recognition
Yann LeCun, Léon Bottou, Yoshua Bengio, Patrick Haffner
Proceedings of the IEEE, 1998
https://ieeexplore.ieee.org/document/726791

Paper-faithful implementation of LeNet-5.
"""

import torch
import torch.nn as nn


INPUT_CHANNELS = 1
INPUT_SIZE = 32
NUM_CLASSES = 10


class LeNet5(nn.Module):
    def __init__(self, num_classes: int = NUM_CLASSES) -> None:
        super(LeNet5, self).__init__()

        self.C1 = nn.Conv2d(INPUT_CHANNELS, 6, kernel_size=5, padding=0)
        self.S2 = nn.AvgPool2d(kernel_size=2, stride=2)

        self.C3 = nn.Conv2d(6, 16, kernel_size=5, padding=0)
        self.S4 = nn.AvgPool2d(kernel_size=2, stride=2)

        self.C5 = nn.Conv2d(16, 120, kernel_size=5, padding=0)
        self.F6 = nn.Linear(120, 84)
        self.out = nn.Linear(84, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = torch.tanh(self.C1(x))
        x = self.S2(x)
        x = torch.tanh(self.C3(x))
        x = self.S4(x)
        x = torch.tanh(self.C5(x))
        x = x.view(x.size(0), -1)
        x = torch.tanh(self.F6(x))
        x = self.out(x)
        return x


def count_parameters(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


if __name__ == "__main__":
    model = LeNet5(num_classes=NUM_CLASSES)
    x = torch.randn(2, INPUT_CHANNELS, INPUT_SIZE, INPUT_SIZE)
    y = model(x)
    print(f"Input shape:  {x.shape}")
    print(f"Output shape: {y.shape}")
    print(f"Parameters:   {count_parameters(model):,}")
