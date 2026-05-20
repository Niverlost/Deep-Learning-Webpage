"""
Visualizing and Understanding Convolutional Networks
Matthew D. Zeiler, Rob Fergus
ECCV 2014 (arXiv:1311.2901)
https://arxiv.org/abs/1311.2901

ZFNet 初学者教程版实现

ZFNet 是什么？
  ZFNet 是 AlexNet 的改进版，核心贡献不在于提出全新的网络结构，
  而在于通过可视化技术（反卷积网络）深入理解 CNN 各层学到了什么。
  作者通过可视化发现 AlexNet 第一层的大卷积核（11x11, stride=4）
  存在问题，于是将其改为更小的 7x7 卷积核、stride=2，
  使得网络能学到更丰富、更精细的特征。

关键概念：
  - 特征可视化：通过反卷积将中间层特征图映射回输入空间，
    观察网络在不同层关注的模式（边缘、纹理、形状、物体部件）。
  - 感受野：网络能"看到"的输入区域大小，ZFNet 通过减小 stride
    让第一层感受野更密集，保留更多空间信息。
"""

import torch
import torch.nn as nn


# ==================== 配置常量 ====================
# 输入图像尺寸：224x224 RGB 图像（ImageNet 标准尺寸）
INPUT_SIZE = 224

# 输出类别数：ImageNet 1000 类分类
NUM_CLASSES = 1000


class ZFNet(nn.Module):
    """
    ZFNet 完整模型

    网络结构概览（对比 AlexNet 的改进）：
      - Conv1: 7x7 (AlexNet 是 11x11)，stride=2 (AlexNet 是 4)
        -> 更小的卷积核和步幅，保留更多细节信息
      - Conv2-5: 与 AlexNet 类似，使用 5x5 和 3x3 卷积核
      - 3 个全连接层 (FC6, FC7, FC8)，最后输出 1000 维 logits

    为什么改进 Conv1？
      AlexNet 的 11x11 卷积核 + stride=4 导致第一层特征图非常粗糙，
      很多高频信息丢失。ZFNet 的 7x7 + stride=2 让特征图分辨率更高，
      可视化结果显示学到的特征更干净、更有区分性。
    """

    def __init__(self, num_classes: int = NUM_CLASSES) -> None:
        super(ZFNet, self).__init__()

        # ==================== 第一层卷积 ====================
        # 输入: (B, 3, 224, 224)
        # 卷积: 96 个 7x7 卷积核, stride=2, padding=0
        # 输出: (B, 96, 109, 109)
        # 计算: (224 - 7) // 2 + 1 = 109
        self.conv1 = nn.Conv2d(3, 96, kernel_size=7, stride=2, padding=0)
        self.relu1 = nn.ReLU(inplace=True)

        # 最大池化: 3x3, stride=2
        # 输出: (B, 96, 54, 54)
        # 计算: (109 - 3) // 2 + 1 = 54
        self.pool1 = nn.MaxPool2d(kernel_size=3, stride=2, padding=0)

        # ==================== 第二层卷积 ====================
        # 输入: (B, 96, 54, 54)
        # 卷积: 256 个 5x5 卷积核, stride=2, padding=2
        # 输出: (B, 256, 27, 27)
        # 计算: (54 + 2*2 - 5) // 2 + 1 = 27
        self.conv2 = nn.Conv2d(96, 256, kernel_size=5, stride=2, padding=2)
        self.relu2 = nn.ReLU(inplace=True)

        # 最大池化: 3x3, stride=2
        # 输出: (B, 256, 13, 13)
        # 计算: (27 - 3) // 2 + 1 = 13
        self.pool2 = nn.MaxPool2d(kernel_size=3, stride=2, padding=0)

        # ==================== 第三层卷积 ====================
        # 输入: (B, 256, 13, 13)
        # 卷积: 384 个 3x3 卷积核, stride=1, padding=1
        # 输出: (B, 384, 13, 13)  (stride=1 + padding=1 保持尺寸)
        self.conv3 = nn.Conv2d(256, 384, kernel_size=3, stride=1, padding=1)
        self.relu3 = nn.ReLU(inplace=True)

        # ==================== 第四层卷积 ====================
        # 输入: (B, 384, 13, 13)
        # 卷积: 384 个 3x3 卷积核, stride=1, padding=1
        # 输出: (B, 384, 13, 13)
        self.conv4 = nn.Conv2d(384, 384, kernel_size=3, stride=1, padding=1)
        self.relu4 = nn.ReLU(inplace=True)

        # ==================== 第五层卷积 ====================
        # 输入: (B, 384, 13, 13)
        # 卷积: 256 个 3x3 卷积核, stride=1, padding=1
        # 输出: (B, 256, 13, 13)
        self.conv5 = nn.Conv2d(384, 256, kernel_size=3, stride=1, padding=1)
        self.relu5 = nn.ReLU(inplace=True)

        # 最大池化: 3x3, stride=2
        # 输出: (B, 256, 6, 6)
        # 计算: (13 - 3) // 2 + 1 = 6
        self.pool3 = nn.MaxPool2d(kernel_size=3, stride=2, padding=0)

        # ==================== 全连接层 ====================
        # 将卷积特征图展平: 256 * 6 * 6 = 9216
        self.fc6 = nn.Linear(256 * 6 * 6, 4096)
        self.relu6 = nn.ReLU(inplace=True)
        # Dropout: 训练时随机丢弃 50% 神经元，防止过拟合
        self.dropout6 = nn.Dropout(p=0.5)

        self.fc7 = nn.Linear(4096, 4096)
        self.relu7 = nn.ReLU(inplace=True)
        self.dropout7 = nn.Dropout(p=0.5)

        # 最终分类层: 输出 1000 维 logits（未经过 softmax）
        self.fc8 = nn.Linear(4096, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        前向传播流程

        Args:
            x: 输入张量, shape (B, 3, 224, 224)

        Returns:
            logits: 输出张量, shape (B, 1000)
        """
        # Stage 1: 第一层卷积 + 池化
        # 输入 (B, 3, 224, 224) -> 输出 (B, 96, 54, 54)
        x = self.conv1(x)
        x = self.relu1(x)
        x = self.pool1(x)

        # Stage 2: 第二层卷积 + 池化
        # 输入 (B, 96, 54, 54) -> 输出 (B, 256, 13, 13)
        x = self.conv2(x)
        x = self.relu2(x)
        x = self.pool2(x)

        # Stage 3: 第三层卷积
        # 输入 (B, 256, 13, 13) -> 输出 (B, 384, 13, 13)
        x = self.conv3(x)
        x = self.relu3(x)

        # Stage 4: 第四层卷积
        # 输入 (B, 384, 13, 13) -> 输出 (B, 384, 13, 13)
        x = self.conv4(x)
        x = self.relu4(x)

        # Stage 5: 第五层卷积 + 池化
        # 输入 (B, 384, 13, 13) -> 输出 (B, 256, 6, 6)
        x = self.conv5(x)
        x = self.relu5(x)
        x = self.pool3(x)

        # 展平特征图，准备输入全连接层
        # (B, 256, 6, 6) -> (B, 9216)
        x = x.view(x.size(0), -1)

        # FC6: 9216 -> 4096
        x = self.fc6(x)
        x = self.relu6(x)
        x = self.dropout6(x)

        # FC7: 4096 -> 4096
        x = self.fc7(x)
        x = self.relu7(x)
        x = self.dropout7(x)

        # FC8: 4096 -> 1000 (分类 logits)
        x = self.fc8(x)
        return x


if __name__ == "__main__":
    # 创建模型实例
    model = ZFNet(num_classes=NUM_CLASSES)

    # 构造一个虚拟输入：batch_size=1, 3通道, 224x224
    dummy_input = torch.randn(1, 3, INPUT_SIZE, INPUT_SIZE)

    # 前向传播
    output = model(dummy_input)

    # 统计参数量
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)

    print("=" * 50)
    print("ZFNet 前向传播测试")
    print("=" * 50)
    print(f"输入形状:  {dummy_input.shape}")
    print(f"输出形状: {output.shape}")
    print(f"总参数量: {total_params:,}")
    print(f"可训练参数量: {trainable_params:,}")
    print("=" * 50)

    # ==================== 练习题 ====================
    # 1. 尝试将 Conv1 改回 AlexNet 的 11x11, stride=4，观察输出尺寸变化
    # 2. 尝试移除 Dropout，观察参数量是否有变化（提示：Dropout 没有可训练参数）
    # 3. 尝试将输入尺寸改为 227x227（AlexNet 原始尺寸），看哪些层的输出尺寸会变化
    # 4. 思考：为什么 ZFNet 的参数量（约 65M）比 AlexNet（约 60M）略多？
