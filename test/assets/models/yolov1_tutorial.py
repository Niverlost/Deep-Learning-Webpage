"""
You Only Look Once: Unified, Real-Time Object Detection
Joseph Redmon, Santosh Divvala, Ross Girshick, Ali Farhadi
CVPR 2016
arXiv: https://arxiv.org/abs/1506.02640

YOLOv1 初学者教程版实现

什么是 YOLOv1？
----------------
YOLO（You Only Look Once）是一种端到端的目标检测模型。与传统检测方法（如 R-CNN 系列）
先生成候选框再分类的两阶段流程不同，YOLO 将检测视为一个单一的回归问题：
直接从图像像素一次性预测出边界框的坐标和类别概率。

核心思想：
- 将输入图像划分为 S x S 的网格（grid）
- 每个网格单元负责预测 B 个边界框（bounding box）
- 每个边界框包含 5 个值：[x, y, w, h, confidence]
- 每个网格单元还预测 C 个类别的条件概率
- 最终输出：S x S x (B*5 + C) 的张量

关键概念（Key Concepts）
-----------------------
1. 网格预测（Grid-based Prediction）：
   图像被划分为 7x7 网格，每个网格负责检测中心落在该网格内的目标。

2. 边界框（Bounding Box）：
   每个网格预测 2 个边界框，包含相对坐标 (x, y) 和宽高 (w, h)，以及置信度。

3. 置信度（Confidence）：
   表示该框包含目标的概率乘以预测框与真实框的 IoU。

4. 统一损失（Unified Loss）：
   YOLO 使用一个多任务损失函数同时优化定位误差、分类误差和置信度误差。

5. 全卷积到全连接的过渡：
   YOLOv1 使用 CNN 提取特征后，通过全连接层直接回归输出，这是 v1 的标志性设计
   （后续版本如 YOLOv2 改用全卷积网络）。
"""

import torch
import torch.nn as nn


# ==================== 配置常量 ====================
# 这些超参数直接来自论文，决定了模型的输入输出维度

S = 7  # 网格划分数：将图像划分为 S x S = 7 x 7 = 49 个网格单元
B = 2  # 每个网格预测的边界框数量：论文设为 2，可同时检测多个重叠目标
C = 20  # 类别数量：PASCAL VOC 数据集有 20 个类别（人、车、狗等）
INPUT_SIZE = 448  # 输入图像尺寸：论文将图像 resize 为 448 x 448 RGB

# 输出通道数计算：
# 每个网格输出 B 个框，每个框 5 个值 (x, y, w, h, conf)，加上 C 个类别概率
# 总输出维度 = S x S x (B * 5 + C) = 7 x 7 x 30 = 1470
OUTPUT_DIM = S * S * (B * 5 + C)


class ConvBlock(nn.Module):
    """
    YOLOv1 的基础卷积块。

    论文中没有使用 Batch Normalization（BatchNorm 在当时尚未成为标准做法），
    而是直接在卷积后接 LeakyReLU 激活函数。

    为什么用 LeakyReLU 而非 ReLU？
    - ReLU 在负半区梯度为 0，可能导致"神经元死亡"
    - LeakyReLU(0.1) 在负半区保留 0.1 的斜率，允许负值信息微弱传播
    - 这有助于深层网络（24 层卷积）的稳定训练
    """

    def __init__(self, in_channels, out_channels, kernel_size, stride=1, padding=0):
        super().__init__()
        # 卷积层：提取空间特征
        # in_channels: 输入特征图的通道数
        # out_channels: 输出特征图的通道数（即卷积核数量）
        # kernel_size: 卷积核大小，论文中主要使用 1x1 和 3x3
        # stride: 步长，控制下采样程度
        # padding: 填充，保持特征图尺寸
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size, stride, padding)

        # 激活函数：LeakyReLU(negative_slope=0.1)
        # 论文明确使用此激活函数，最后一层除外（用线性激活）
        self.activation = nn.LeakyReLU(0.1)

    def forward(self, x):
        # 前向传播：先卷积，再激活
        # 输入形状: (batch, in_channels, H, W)
        # 输出形状: (batch, out_channels, H', W')
        return self.activation(self.conv(x))


class YOLOv1(nn.Module):
    """
    YOLOv1 完整网络架构。

    网络结构概览（受 GoogLeNet 启发）：
    - 24 个卷积层（Conv + LeakyReLU）
    - 4 个 MaxPool 层（下采样）
    - 2 个全连接层（FC）
    - 总参数量约 8.7M

    特征提取策略：
    1. 早期层（低层）：大卷积核（7x7）、少通道（64）→ 提取边缘、纹理等低级特征
    2. 中期层（中层）：中等卷积核（3x3）、中等通道（256-512）→ 提取部件、形状
    3. 后期层（高层）：小卷积核（3x3）、多通道（1024）→ 提取语义、目标级特征

    1x1 卷积的作用：
    - 降维/升维，减少计算量
    - 增加网络深度和非线性能力
    - 这是 GoogLeNet（Inception）网络的关键技巧
    """

    def __init__(self, S=7, B=2, C=20):
        super().__init__()
        self.S = S  # 网格数
        self.B = B  # 每个网格的边界框数
        self.C = C  # 类别数

        # ==================== 特征提取器（24 层卷积）====================
        # 按论文 Table 1 逐层构建
        # 注意：论文中的层编号从 1 开始，这里按顺序列出

        self.features = nn.Sequential(
            # --- Stage 1: 448 -> 224 ---
            # Layer 1: 7x7 卷积，64 通道，stride=2
            # 输入: (B, 3, 448, 448) -> 输出: (B, 64, 224, 224)
            # 大卷积核快速降低空间维度，同时提取低级特征
            ConvBlock(3, 64, 7, stride=2, padding=3),
            # MaxPool: 224 -> 112
            nn.MaxPool2d(2, 2),

            # --- Stage 2: 112 -> 56 ---
            # Layer 2: 3x3 卷积，192 通道
            # 输入: (B, 64, 112, 112) -> 输出: (B, 192, 112, 112)
            ConvBlock(64, 192, 3, padding=1),
            # MaxPool: 112 -> 56
            nn.MaxPool2d(2, 2),

            # --- Stage 3: 56 -> 28 ---
            # Layer 3-6: 1x1/3x3 交替，增加通道数到 512
            # 这是 GoogLeNet 风格的"瓶颈"结构
            ConvBlock(192, 128, 1),          # 1x1 降维
            ConvBlock(128, 256, 3, padding=1),  # 3x3 提取特征
            ConvBlock(256, 256, 1),          # 1x1 降维
            ConvBlock(256, 512, 3, padding=1),  # 3x3 提取特征，通道扩至 512
            # MaxPool: 56 -> 28
            nn.MaxPool2d(2, 2),

            # --- Stage 4: 28 -> 14 ---
            # Layer 7-14: 4 组 [1x1x256, 3x3x512] 重复
            # 这是论文中的重复模块，增加网络深度而不显著增加参数量
            ConvBlock(512, 256, 1),
            ConvBlock(256, 512, 3, padding=1),
            ConvBlock(512, 256, 1),
            ConvBlock(256, 512, 3, padding=1),
            ConvBlock(512, 256, 1),
            ConvBlock(256, 512, 3, padding=1),
            ConvBlock(512, 256, 1),
            ConvBlock(256, 512, 3, padding=1),

            # Layer 15: 过渡到 1024 通道
            ConvBlock(512, 512, 1),
            ConvBlock(512, 1024, 3, padding=1),
            # MaxPool: 28 -> 14
            nn.MaxPool2d(2, 2),

            # --- Stage 5: 14 -> 7 ---
            # Layer 16-19: 2 组 [1x1x512, 3x3x1024] 重复
            ConvBlock(1024, 512, 1),
            ConvBlock(512, 1024, 3, padding=1),
            ConvBlock(1024, 512, 1),
            ConvBlock(512, 1024, 3, padding=1),

            # Layer 20-22: 连续 3x3 卷积，进一步提取高层语义特征
            ConvBlock(1024, 1024, 3, padding=1),
            # 这一层 stride=2，将 14x14 下采样到 7x7
            # 输入: (B, 1024, 14, 14) -> 输出: (B, 1024, 7, 7)
            ConvBlock(1024, 1024, 3, stride=2, padding=1),

            # Layer 23-24: 最后两个 3x3 卷积，保持 7x7 空间维度
            # 输入/输出: (B, 1024, 7, 7)
            ConvBlock(1024, 1024, 3, padding=1),
            ConvBlock(1024, 1024, 3, padding=1),
        )

        # ==================== 全连接层（回归头）====================
        # YOLOv1 的独特设计：将卷积特征展平后，用全连接层直接回归输出
        # 后续版本（YOLOv2/v3 等）改用全卷积网络，但 v1 使用 FC 层

        self.fc = nn.Sequential(
            # 将 4D 特征图展平为 1D 向量
            # 输入: (B, 1024, 7, 7) -> 展平后: (B, 1024*7*7) = (B, 50176)
            nn.Flatten(),

            # FC1: 50176 -> 4096
            # 这是一个巨大的全连接层，是参数量的主要来源
            # 论文在此层后使用 Dropout(0.5) 防止过拟合
            nn.Linear(1024 * S * S, 4096),
            nn.LeakyReLU(0.1),
            nn.Dropout(0.5),  # 训练时随机丢弃 50% 神经元，增强泛化能力

            # FC2: 4096 -> 1470 (7*7*30)
            # 最后一层使用线性激活（无激活函数），直接输出回归值
            # 输出包含每个网格的边界框坐标、置信度和类别概率
            nn.Linear(4096, S * S * (B * 5 + C)),
        )

    def forward(self, x):
        """
        前向传播流程：

        步骤 1: 特征提取
          输入: (batch, 3, 448, 448)
          经过 24 层卷积 + 4 次 MaxPool
          输出: (batch, 1024, 7, 7)

        步骤 2: 展平与回归
          展平: (batch, 1024, 7, 7) -> (batch, 50176)
          经过两个全连接层
          输出: (batch, 1470)

        步骤 3: 重塑为网格格式
          view: (batch, 1470) -> (batch, 7, 7, 30)
          permute: (batch, 7, 7, 30) -> (batch, 30, 7, 7)
          这样每个 (7, 7) 空间位置对应 30 个通道的预测值
        """
        # 卷积特征提取
        x = self.features(x)  # (B, 1024, 7, 7)

        # 全连接层回归
        x = self.fc(x)  # (B, 1470)

        # 重塑为 (B, S, S, B*5+C) = (B, 7, 7, 30)
        x = x.view(-1, self.S, self.S, self.B * 5 + self.C)

        # 置换维度为 (B, 30, 7, 7)，便于后续处理
        # 通道维度在前是 PyTorch 的默认图像格式 (NCHW)
        return x.permute(0, 3, 1, 2)


if __name__ == "__main__":
    # ==================== 教育演示 ====================

    # 创建模型实例
    model = YOLOv1(S=S, B=B, C=C)

    # 创建模拟输入：1 张 3 通道 448x448 图像
    dummy_input = torch.randn(1, 3, INPUT_SIZE, INPUT_SIZE)

    # 前向传播
    output = model(dummy_input)

    # 打印结果
    print("=" * 50)
    print("YOLOv1 前向传播演示")
    print("=" * 50)
    print(f"输入图像形状:  {dummy_input.shape}")
    print(f"  - batch size: {dummy_input.shape[0]}")
    print(f"  - 通道数: {dummy_input.shape[1]} (RGB)")
    print(f"  - 高 x 宽: {dummy_input.shape[2]} x {dummy_input.shape[3]}")
    print()
    print(f"输出张量形状: {output.shape}")
    print(f"  - batch size: {output.shape[0]}")
    print(f"  - 通道数: {output.shape[1]} (B*5+C = {B}*5+{C} = {B*5+C})")
    print(f"  - 网格: {output.shape[2]} x {output.shape[3]} (S x S)")
    print()

    # 计算总参数量
    total_params = sum(p.numel() for p in model.parameters())
    print(f"模型总参数量: {total_params:,}")
    print(f"  约 {total_params / 1e6:.2f} M")
    print()

    # 输出张量解读
    print("输出张量解读:")
    print(f"  每个网格单元 ({S}x{S}) 输出 {B*5+C} 个值:")
    print(f"    - 边界框 1: [x, y, w, h, confidence] = 5 个值")
    print(f"    - 边界框 2: [x, y, w, h, confidence] = 5 个值")
    print(f"    - 类别概率: {C} 个值 (PASCAL VOC 20 类)")
    print(f"  总计: {S}x{S}x{B*5+C} = {S*S*(B*5+C)} 个预测值")
    print("=" * 50)

    # ==================== 练习建议 ====================
    # 读者可以尝试以下修改来加深理解：
    #
    # 练习 1: 修改 S, B, C 的值
    #   尝试 S=14（更精细的网格）、B=3（更多边界框）、C=80（COCO 数据集）
    #   观察输出形状如何变化
    #
    # 练习 2: 添加 BatchNorm
    #   在 ConvBlock 的卷积和激活之间添加 nn.BatchNorm2d
    #   注意：这不是论文原版，但现代实现通常这样做
    #
    # 练习 3: 替换全连接层为卷积层
    #   将 fc 层替换为 1x1 卷积，模拟 YOLOv2 的全卷积设计
    #   这样输入可以是任意尺寸（全卷积网络的优点）
    #
    # 练习 4: 实现损失函数
    #   论文使用多任务损失：坐标损失 + 置信度损失 + 分类损失
    #   尝试实现 YOLOv1 的损失函数
