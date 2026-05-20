"""
ImageNet Classification with Deep Convolutional Neural Networks
Alex Krizhevsky, Ilya Sutskever, Geoffrey E. Hinton
NIPS 2012

本文件是 AlexNet 的初学者友好版实现，适合希望理解网络每一层作用的读者。

关键概念（Key Concepts）:
1. ReLU 激活函数 —— 论文首次在大规模深度网络中证明 ReLU 比传统的 tanh/sigmoid 收敛更快。
2. Dropout 正则化 —— 在 FC6 和 FC7 中以 0.5 的概率随机丢弃神经元，有效防止过拟合。
3. 重叠池化（Overlapping Pooling）—— 使用 stride 小于 kernel_size 的 MaxPool，减少信息损失。
4. 双 GPU 并行 —— 原始论文使用两块 GTX 580 分别训练网络的两半；现代实现通常合并为单路。
"""

import torch
import torch.nn as nn


# 配置常量
INPUT_SIZE = 227          # 输入图像的宽和高（论文原文使用 224，但实际计算需 227 才能得到整数 55；PyTorch 官方实现采用 224 并调整 padding，此处按论文原始计算逻辑使用 227）
NUM_CLASSES = 1000        # ImageNet 数据集的类别数
DROPOUT = 0.5             # Dropout 丢弃概率，论文中 FC6 和 FC7 使用 0.5


class AlexNet(nn.Module):
    """
    AlexNet 完整模型。

    网络分为两大部分：
    - features（特征提取器）：由 5 个卷积层 + 3 个 MaxPool 层组成，负责从图像中提取层次化特征。
    - classifier（分类器）：由 3 个全连接层组成，负责将特征映射到 1000 个类别分数。
    """

    def __init__(self, num_classes: int = NUM_CLASSES, dropout: float = DROPOUT) -> None:
        super(AlexNet, self).__init__()

        # ==================== 特征提取器（卷积层部分）====================
        self.features = nn.Sequential(
            # ---- Conv1 ----
            # 输入:  (batch, 3, 224, 224)
            # 卷积:  96 个 11x11 卷积核, stride=4, padding=0
            # 输出:  (batch, 96, 55, 55)
            # 计算:  (224 - 11) / 4 + 1 = 54.25 -> 向下取整为 55
            nn.Conv2d(3, 96, kernel_size=11, stride=4, padding=0),
            nn.ReLU(inplace=True),  # ReLU 激活：负数截断为 0，正数保持不变

            # MaxPool1: 3x3 窗口, stride=2
            # 输入:  (batch, 96, 55, 55)
            # 输出:  (batch, 96, 27, 27)
            # 计算:  (55 - 3) / 2 + 1 = 27
            nn.MaxPool2d(kernel_size=3, stride=2),

            # ---- Conv2 ----
            # 输入:  (batch, 96, 27, 27)
            # 卷积:  256 个 5x5 卷积核, stride=1, padding=2
            # 输出:  (batch, 256, 27, 27)
            # padding=2 保证空间尺寸不变: (27 - 5 + 2*2) / 1 + 1 = 27
            nn.Conv2d(96, 256, kernel_size=5, stride=1, padding=2),
            nn.ReLU(inplace=True),

            # MaxPool2: 3x3 窗口, stride=2
            # 输入:  (batch, 256, 27, 27)
            # 输出:  (batch, 256, 13, 13)
            # 计算:  (27 - 3) / 2 + 1 = 13
            nn.MaxPool2d(kernel_size=3, stride=2),

            # ---- Conv3 ----
            # 输入:  (batch, 256, 13, 13)
            # 卷积:  384 个 3x3 卷积核, stride=1, padding=1
            # 输出:  (batch, 384, 13, 13)
            # padding=1 保证空间尺寸不变: (13 - 3 + 2*1) / 1 + 1 = 13
            nn.Conv2d(256, 384, kernel_size=3, stride=1, padding=1),
            nn.ReLU(inplace=True),

            # ---- Conv4 ----
            # 输入:  (batch, 384, 13, 13)
            # 卷积:  384 个 3x3 卷积核, stride=1, padding=1
            # 输出:  (batch, 384, 13, 13)
            nn.Conv2d(384, 384, kernel_size=3, stride=1, padding=1),
            nn.ReLU(inplace=True),

            # ---- Conv5 ----
            # 输入:  (batch, 384, 13, 13)
            # 卷积:  256 个 3x3 卷积核, stride=1, padding=1
            # 输出:  (batch, 256, 13, 13)
            nn.Conv2d(384, 256, kernel_size=3, stride=1, padding=1),
            nn.ReLU(inplace=True),

            # MaxPool3: 3x3 窗口, stride=2
            # 输入:  (batch, 256, 13, 13)
            # 输出:  (batch, 256, 6, 6)
            # 计算:  (13 - 3) / 2 + 1 = 6
            nn.MaxPool2d(kernel_size=3, stride=2),
        )

        # ==================== 分类器（全连接层部分）====================
        self.classifier = nn.Sequential(
            # Dropout: 以 0.5 的概率随机丢弃神经元，防止过拟合
            nn.Dropout(p=dropout),

            # FC6: 将卷积输出的 256*6*6=9216 维特征向量映射到 4096 维
            nn.Linear(256 * 6 * 6, 4096),
            nn.ReLU(inplace=True),

            # 再次 Dropout
            nn.Dropout(p=dropout),

            # FC7: 4096 -> 4096
            nn.Linear(4096, 4096),
            nn.ReLU(inplace=True),

            # FC8: 4096 -> 1000 (ImageNet 类别数)
            # 注意：最后一层不加激活函数，输出原始 logits，后续通常接 Softmax 或 CrossEntropyLoss
            nn.Linear(4096, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        前向传播流程：
        1. 通过 features 提取空间特征
        2. 将特征图展平为一维向量
        3. 通过 classifier 输出类别分数
        """
        x = self.features(x)               # (batch, 3, 224, 224) -> (batch, 256, 6, 6)
        x = x.view(x.size(0), 256 * 6 * 6) # 展平: (batch, 256, 6, 6) -> (batch, 9216)
        x = self.classifier(x)             # (batch, 9216) -> (batch, 1000)
        return x


if __name__ == "__main__":
    # 创建模型实例
    model = AlexNet(num_classes=NUM_CLASSES, dropout=DROPOUT)

    # 构造一个假的输入张量: batch_size=1, 3 通道, 224x224
    x = torch.randn(1, 3, INPUT_SIZE, INPUT_SIZE)

    # 前向传播
    y = model(x)

    # 打印输入输出形状
    print(f"输入形状:  {x.shape}")   # torch.Size([1, 3, 224, 224])
    print(f"输出形状: {y.shape}")   # torch.Size([1, 1000])

    # 统计总参数量
    total_params = sum(p.numel() for p in model.parameters())
    print(f"总参数量: {total_params:,}")

    # ==================== 读者练习（Exercise）====================
    # 1. 尝试将输入尺寸改为 227x227，观察输出形状是否仍然正确。
    #    （注意：论文原文描述存在 224 与 227 的争议；PyTorch 官方实现使用 224。）
    # 2. 将 Dropout 概率改为 0.0 和 0.8，观察训练时的过拟合/欠拟合倾向。
    # 3. 将 FC6 的输出维度从 4096 改为 2048，观察参数量变化。
    # 4. 尝试在卷积层后添加 BatchNorm（论文中未使用），观察收敛速度变化。
