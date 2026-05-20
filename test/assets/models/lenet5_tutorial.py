"""
Gradient-Based Learning Applied to Document Recognition
Yann LeCun, Léon Bottou, Yoshua Bengio, Patrick Haffner
Proceedings of the IEEE, 1998

LeNet-5 初学者教程版实现

本文件是 LeNet-5 的入门级实现，带有详细的中文注释，
适合希望理解卷积神经网络基础结构的读者。

关键概念：
- 卷积层 (Convolution): 用可学习的滤波器提取局部特征
- 池化层 (Pooling): 降采样，减少计算量并提供平移不变性
- 全连接层 (Fully Connected): 将特征映射到最终类别分数
"""

import torch
import torch.nn as nn


# 配置常量
INPUT_CHANNELS = 1      # 输入通道数：1 表示灰度图像
INPUT_SIZE = 32         # 输入图像尺寸：32x32 像素
NUM_CLASSES = 10        # 输出类别数：数字 0-9，共 10 类


class LeNet5(nn.Module):
    """
    LeNet-5 网络结构

    这是最早的成功的卷积神经网络之一，专为手写数字识别设计。
    整体流程：卷积 -> 池化 -> 卷积 -> 池化 -> 卷积 -> 全连接 -> 全连接
    """

    def __init__(self, num_classes: int = NUM_CLASSES) -> None:
        super(LeNet5, self).__init__()

        # C1: 第一个卷积层
        # 输入: (B, 1, 32, 32) —— B 是 batch size，1 是灰度通道
        # 使用 6 个 5x5 的卷积核，无填充 (padding=0)
        # 输出: (B, 6, 28, 28) —— 32 - 5 + 1 = 28
        self.C1 = nn.Conv2d(INPUT_CHANNELS, 6, kernel_size=5, padding=0)

        # S2: 第一个池化层（下采样层）
        # 论文中使用的是平均池化 (Average Pooling)，而非现代常用的最大池化
        # 2x2 窗口，步幅为 2，将特征图尺寸减半
        # 输入: (B, 6, 28, 28)
        # 输出: (B, 6, 14, 14) —— 28 / 2 = 14
        self.S2 = nn.AvgPool2d(kernel_size=2, stride=2)

        # C3: 第二个卷积层
        # 使用 16 个 5x5 的卷积核
        # 输入: (B, 6, 14, 14)
        # 输出: (B, 16, 10, 10) —— 14 - 5 + 1 = 10
        # 注意：原始论文中 C3 使用了特殊的连接表（connection table），
        # 并非所有 6 个输入通道都连接到每个输出通道。
        # 为简化起见，这里使用完整的 6->16 连接，这是现代实现中最常见的做法。
        self.C3 = nn.Conv2d(6, 16, kernel_size=5, padding=0)

        # S4: 第二个池化层
        # 同样是 2x2 平均池化，步幅为 2
        # 输入: (B, 16, 10, 10)
        # 输出: (B, 16, 5, 5) —— 10 / 2 = 5
        self.S4 = nn.AvgPool2d(kernel_size=2, stride=2)

        # C5: 第三个卷积层（在原始论文中被称为卷积层，但实际上是全连接层）
        # 使用 120 个 5x5 的卷积核
        # 输入: (B, 16, 5, 5)
        # 输出: (B, 120, 1, 1) —— 5 - 5 + 1 = 1
        # 由于输出空间尺寸为 1x1，这一层等价于全连接层
        self.C5 = nn.Conv2d(16, 120, kernel_size=5, padding=0)

        # F6: 全连接层
        # 将 120 维特征向量映射到 84 维
        # 输入: (B, 120)
        # 输出: (B, 84)
        self.F6 = nn.Linear(120, 84)

        # Output: 输出层（全连接层）
        # 原始论文使用 RBF（径向基函数）作为输出层，
        # 但现代实现通常使用全连接层 + softmax（在损失函数中）
        # 输入: (B, 84)
        # 输出: (B, 10) —— 对应 10 个数字类别的分数
        self.out = nn.Linear(84, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        前向传播

        参数:
            x: 输入张量，形状为 (B, 1, 32, 32)

        返回:
            输出张量，形状为 (B, 10)
        """
        # C1 + tanh 激活
        # 论文使用 tanh 作为激活函数，而非现代网络中更常见的 ReLU
        # tanh 将输出压缩到 (-1, 1) 区间
        x = torch.tanh(self.C1(x))   # (B, 1, 32, 32) -> (B, 6, 28, 28)

        # S2 池化
        x = self.S2(x)               # (B, 6, 28, 28) -> (B, 6, 14, 14)

        # C3 + tanh 激活
        x = torch.tanh(self.C3(x))   # (B, 6, 14, 14) -> (B, 16, 10, 10)

        # S4 池化
        x = self.S4(x)               # (B, 16, 10, 10) -> (B, 16, 5, 5)

        # C5 + tanh 激活
        x = torch.tanh(self.C5(x))   # (B, 16, 5, 5) -> (B, 120, 1, 1)

        # 展平：将 (B, 120, 1, 1) 变为 (B, 120)
        x = x.view(x.size(0), -1)

        # F6 + tanh 激活
        x = torch.tanh(self.F6(x))   # (B, 120) -> (B, 84)

        # 输出层（无激活函数，原始分数）
        x = self.out(x)              # (B, 84) -> (B, 10)

        return x


def count_parameters(model: nn.Module) -> int:
    """计算模型的可训练参数总数"""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


if __name__ == "__main__":
    # 创建模型实例
    model = LeNet5(num_classes=NUM_CLASSES)

    # 创建模拟输入：batch size = 2，1 通道，32x32 像素
    x = torch.randn(2, INPUT_CHANNELS, INPUT_SIZE, INPUT_SIZE)

    # 前向传播
    y = model(x)

    # 打印结果
    print(f"输入形状:  {x.shape}")
    print(f"输出形状: {y.shape}")
    print(f"总参数量: {count_parameters(model):,}")

    # 练习题（供读者尝试）:
    # 1. 将激活函数从 tanh 改为 ReLU，观察输出变化
    # 2. 将平均池化 (AvgPool2d) 改为最大池化 (MaxPool2d)，比较效果
    # 3. 尝试修改输入尺寸（如 28x28），看看哪些层会报错，为什么？
    # 4. 在 C1 层之后添加 BatchNorm，观察参数量变化
