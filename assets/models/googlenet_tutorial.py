"""
Going Deeper with Convolutions (GoogLeNet / Inception v1)
Christian Szegedy 等, 2014 (CVPR 2015)
arXiv: 1409.4842

本文件是面向初学者、带有详细中文注释的 GoogLeNet 实现。
GoogLeNet 是 ILSVRC 2014 图像分类冠军，核心创新是 Inception 模块：
在同一层内并行使用 1x1、3x3、5x5 卷积和 3x3 池化，然后将结果在通道维度拼接。

关键概念：
- 多尺度特征融合：不同大小的卷积核捕捉不同尺度的空间信息
- 1x1 卷积降维：在 3x3 和 5x5 卷积之前先用 1x1 卷积减少通道数，降低计算量
- 辅助分类器 (Auxiliary Classifier)：在网络中间层增加额外的分类分支，
  帮助梯度回传、缓解梯度消失，同时起到模型融合的正则化效果
- 全局平均池化替代全连接层：大幅减少参数量
"""

import torch
import torch.nn as nn


# ------------------------------------------------------------------
# 配置常量
# ------------------------------------------------------------------
INPUT_SIZE = 224          # 输入图像尺寸 (高和宽)
NUM_CLASSES = 1000        # ImageNet 分类类别数
DROPOUT = 0.4             # 主分类器前的 Dropout 概率


# ------------------------------------------------------------------
# 基础构建块
# ------------------------------------------------------------------
class BasicConv2d(nn.Module):
    """
    最基础的卷积单元：Conv2d + ReLU。

    论文中使用 ReLU 作为激活函数（而非 LeakyReLU 或 PReLU），
    这是当时的主流选择，计算简单且能有效缓解梯度消失。
    """

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
    Inception 模块 —— GoogLeNet 的核心创新。

    结构：四条并行分支，最后将输出在通道维度拼接 (concatenate)。
    ┌─────────────────────────────────────────────────────────────┐
    │  输入特征图 (C, H, W)                                        │
    │     ├─ Branch 1: 1x1 卷积 ────────────────────────┐        │
    │     ├─ Branch 2: 1x1 卷积 -> 3x3 卷积 ────────────┤        │
    │     ├─ Branch 3: 1x1 卷积 -> 5x5 卷积 ────────────┤── concat
    │     └─ Branch 4: 3x3 MaxPool -> 1x1 卷积 ─────────┘        │
    │                         输出特征图 (C', H, W)               │
    └─────────────────────────────────────────────────────────────┘

    注意：四条分支的输出特征图高和宽必须相同，才能拼接。
    通过合适的 padding 保证这一点：
      - 1x1 卷积: padding=0
      - 3x3 卷积: padding=1
      - 5x5 卷积: padding=2
      - 3x3 MaxPool (stride=1): padding=1

    参数说明：
      in_channels: 输入通道数
      ch1x1:       Branch 1 的 1x1 卷积输出通道数
      ch3x3red:    Branch 2 中 1x1 降维卷积的输出通道数
      ch3x3:       Branch 2 中 3x3 卷积的输出通道数
      ch5x5red:    Branch 3 中 1x1 降维卷积的输出通道数
      ch5x5:       Branch 3 中 5x5 卷积的输出通道数
      pool_proj:   Branch 4 中 1x1 卷积的输出通道数
    """

    def __init__(self, in_channels, ch1x1, ch3x3red, ch3x3, ch5x5red, ch5x5, pool_proj):
        super(Inception, self).__init__()

        # Branch 1: 1x1 卷积 —— 直接对输入进行通道变换，计算最轻量
        self.branch1 = BasicConv2d(in_channels, ch1x1, kernel_size=1)

        # Branch 2: 1x1 降维 -> 3x3 卷积
        # 先用 1x1 卷积将通道数从 in_channels 降到 ch3x3red，
        # 再用 3x3 卷积提取空间特征。这是 "Network in Network" 的思想。
        self.branch2 = nn.Sequential(
            BasicConv2d(in_channels, ch3x3red, kernel_size=1),
            BasicConv2d(ch3x3red, ch3x3, kernel_size=3, padding=1),
        )

        # Branch 3: 1x1 降维 -> 5x5 卷积
        # 5x5 卷积感受野更大，能捕捉更大范围的模式，但计算量也大，
        # 所以先用 1x1 卷积降维至关重要。
        self.branch3 = nn.Sequential(
            BasicConv2d(in_channels, ch5x5red, kernel_size=1),
            BasicConv2d(ch5x5red, ch5x5, kernel_size=5, padding=2),
        )

        # Branch 4: 3x3 MaxPool -> 1x1 卷积
        # 池化操作能保留显著特征并提供一定的平移不变性，
        # 后面接 1x1 卷积调整通道数。
        self.branch4 = nn.Sequential(
            nn.MaxPool2d(kernel_size=3, stride=1, padding=1),
            BasicConv2d(in_channels, pool_proj, kernel_size=1),
        )

    def forward(self, x):
        b1 = self.branch1(x)   # (B, ch1x1, H, W)
        b2 = self.branch2(x)   # (B, ch3x3, H, W)
        b3 = self.branch3(x)   # (B, ch5x5, H, W)
        b4 = self.branch4(x)   # (B, pool_proj, H, W)
        # 在通道维度 (dim=1) 拼接四条分支的输出
        return torch.cat([b1, b2, b3, b4], dim=1)


class AuxiliaryClassifier(nn.Module):
    """
    辅助分类器 (Auxiliary Classifier)。

    论文在 Inception(4a) 和 Inception(4d) 之后各连接了一个辅助分类器。
    作用：
    1. 缓解深层网络的梯度消失问题 —— 中间层也能直接接收分类任务的梯度信号
    2. 提供额外的正则化 —— 相当于对中间特征进行 "模型融合"
    3. 训练时总损失 = 主损失 + 0.3 * aux1_loss + 0.3 * aux2_loss

    结构：AvgPool(5x5, stride=3) -> Conv1x1(128) -> FC(1024) -> FC(1000)
    """

    def __init__(self, in_channels, num_classes):
        super(AuxiliaryClassifier, self).__init__()
        # 平均池化：将 14x14 的特征图下采样到 4x4
        self.avgpool = nn.AvgPool2d(kernel_size=5, stride=3)
        # 1x1 卷积调整通道数为 128
        self.conv = BasicConv2d(in_channels, 128, kernel_size=1)
        # 全连接层：128 * 4 * 4 = 2048
        self.fc1 = nn.Linear(2048, 1024)
        self.fc2 = nn.Linear(1024, num_classes)

    def forward(self, x):
        x = self.avgpool(x)           # (B, C, 4, 4)
        x = self.conv(x)              # (B, 128, 4, 4)
        x = torch.flatten(x, 1)       # (B, 2048)
        x = nn.functional.dropout(x, 0.7, training=self.training)
        x = self.fc1(x)               # (B, 1024)
        x = nn.functional.relu(x, inplace=True)
        x = nn.functional.dropout(x, 0.7, training=self.training)
        x = self.fc2(x)               # (B, num_classes)
        return x


# ------------------------------------------------------------------
# 完整的 GoogLeNet 模型
# ------------------------------------------------------------------
class GoogLeNet(nn.Module):
    """
    GoogLeNet (Inception v1) 完整网络。

    网络结构概览（从输入到输出）：
    -----------------------------------------------------------------------------
    层                输出尺寸        操作说明
    -----------------------------------------------------------------------------
    输入              3x224x224       RGB 图像
    Conv1             64x112x112      7x7 卷积, stride=2, padding=3
    MaxPool1          64x56x56        3x3 最大池化, stride=2
    LRN1              64x56x56        局部响应归一化
    Conv2             64x56x56        1x1 卷积 (降维/通道变换)
    Conv3             192x56x56       3x3 卷积, padding=1
    LRN2              192x56x56       局部响应归一化
    MaxPool2          192x28x28       3x3 最大池化, stride=2
    Inception(3a)     256x28x28       64+128+32+32 = 256 通道
    Inception(3b)     480x28x28       128+192+96+64 = 480 通道
    MaxPool3          480x14x14       3x3 最大池化, stride=2
    Inception(4a)     512x14x14       192+208+48+64 = 512 通道  <- Aux1 分支点
    Inception(4b)     512x14x14       160+224+64+64 = 512 通道
    Inception(4c)     512x14x14       128+256+64+64 = 512 通道
    Inception(4d)     528x14x14       112+288+64+64 = 528 通道  <- Aux2 分支点
    Inception(4e)     832x14x14       256+320+128+128 = 832 通道
    MaxPool4          832x7x7         3x3 最大池化, stride=2
    Inception(5a)     832x7x7         256+320+128+128 = 832 通道
    Inception(5b)     1024x7x7        384+384+128+128 = 1024 通道
    AvgPool           1024x1x1        全局平均池化 (替代全连接层)
    Dropout           1024            丢弃概率 0.4
    FC                1000            全连接层输出分类结果
    -----------------------------------------------------------------------------

    关于 LRN (Local Response Normalization):
    论文中在 Conv1 后和 Conv3 后使用了 LRN。
    LRN 是 AlexNet 中提出的归一化方法，对局部神经元的响应进行竞争抑制，
    增强泛化能力。后续研究表明 BatchNorm 效果更好，但这里严格按论文实现。
    """

    def __init__(self, num_classes=NUM_CLASSES, aux_logits=True):
        super(GoogLeNet, self).__init__()
        self.aux_logits = aux_logits

        # ==================== Stem (主干起始部分) ====================
        self.conv1 = BasicConv2d(3, 64, kernel_size=7, stride=2, padding=3)
        self.maxpool1 = nn.MaxPool2d(3, stride=2, ceil_mode=True)
        self.lrn1 = nn.LocalResponseNorm(5, alpha=1e-4, beta=0.75, k=2)

        self.conv2 = BasicConv2d(64, 64, kernel_size=1)
        self.conv3 = BasicConv2d(64, 192, kernel_size=3, padding=1)
        self.lrn2 = nn.LocalResponseNorm(5, alpha=1e-4, beta=0.75, k=2)
        self.maxpool2 = nn.MaxPool2d(3, stride=2, ceil_mode=True)

        # ==================== Inception 3 ====================
        self.inception3a = Inception(192, 64, 96, 128, 16, 32, 32)
        self.inception3b = Inception(256, 128, 128, 192, 32, 96, 64)
        self.maxpool3 = nn.MaxPool2d(3, stride=2, ceil_mode=True)

        # ==================== Inception 4 ====================
        self.inception4a = Inception(480, 192, 96, 208, 16, 48, 64)
        self.inception4b = Inception(512, 160, 112, 224, 24, 64, 64)
        self.inception4c = Inception(512, 128, 128, 256, 24, 64, 64)
        self.inception4d = Inception(512, 112, 144, 288, 32, 64, 64)
        self.inception4e = Inception(528, 256, 160, 320, 32, 128, 128)
        self.maxpool4 = nn.MaxPool2d(3, stride=2, ceil_mode=True)

        # ==================== Inception 5 ====================
        self.inception5a = Inception(832, 256, 160, 320, 32, 128, 128)
        self.inception5b = Inception(832, 384, 192, 384, 48, 128, 128)

        # ==================== 辅助分类器 ====================
        if aux_logits:
            # aux1 接在 inception4a 之后，输入通道数为 512
            self.aux1 = AuxiliaryClassifier(512, num_classes)
            # aux2 接在 inception4d 之后，输入通道数为 528
            self.aux2 = AuxiliaryClassifier(528, num_classes)

        # ==================== 分类头 ====================
        # 全局平均池化：将 7x7 的特征图池化为 1x1，替代全连接层
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.dropout = nn.Dropout(DROPOUT)
        self.fc = nn.Linear(1024, num_classes)

    def forward(self, x):
        # ----- Stem -----
        x = self.conv1(x)         # (B, 64, 112, 112)
        x = self.maxpool1(x)      # (B, 64, 56, 56)
        x = self.lrn1(x)          # (B, 64, 56, 56)

        x = self.conv2(x)         # (B, 64, 56, 56)
        x = self.conv3(x)         # (B, 192, 56, 56)
        x = self.lrn2(x)          # (B, 192, 56, 56)
        x = self.maxpool2(x)      # (B, 192, 28, 28)

        # ----- Inception 3 -----
        x = self.inception3a(x)   # (B, 256, 28, 28)
        x = self.inception3b(x)   # (B, 480, 28, 28)
        x = self.maxpool3(x)      # (B, 480, 14, 14)

        # ----- Inception 4 -----
        x = self.inception4a(x)   # (B, 512, 14, 14)
        if self.training and self.aux_logits:
            aux1 = self.aux1(x)   # 辅助分类器 1 输出 (B, num_classes)

        x = self.inception4b(x)   # (B, 512, 14, 14)
        x = self.inception4c(x)   # (B, 512, 14, 14)
        x = self.inception4d(x)   # (B, 528, 14, 14)
        if self.training and self.aux_logits:
            aux2 = self.aux2(x)   # 辅助分类器 2 输出 (B, num_classes)

        x = self.inception4e(x)   # (B, 832, 14, 14)
        x = self.maxpool4(x)      # (B, 832, 7, 7)

        # ----- Inception 5 -----
        x = self.inception5a(x)   # (B, 832, 7, 7)
        x = self.inception5b(x)   # (B, 1024, 7, 7)

        # ----- Classifier Head -----
        x = self.avgpool(x)       # (B, 1024, 1, 1)
        x = torch.flatten(x, 1)   # (B, 1024)
        x = self.dropout(x)       # (B, 1024)
        x = self.fc(x)            # (B, num_classes)

        if self.training and self.aux_logits:
            return x, aux2, aux1
        return x


# ------------------------------------------------------------------
# 教育演示
# ------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("GoogLeNet (Inception v1) 教育演示")
    print("=" * 60)

    # 创建模型
    model = GoogLeNet(num_classes=NUM_CLASSES, aux_logits=True)

    # 创建虚拟输入：2 张 3x224x224 的图像
    x = torch.randn(2, 3, INPUT_SIZE, INPUT_SIZE)
    print(f"\n输入张量形状: {x.shape}")
    print("含义: 批次大小=2, 通道=3(RGB), 高=224, 宽=224")

    # 训练模式前向传播
    model.train()
    out, aux2, aux1 = model(x)
    print(f"\n--- 训练模式 (train) ---")
    print(f"主分类器输出形状 : {out.shape}   (批次, 类别数)")
    print(f"辅助分类器 2 输出: {aux2.shape}   (从 inception4d 后引出)")
    print(f"辅助分类器 1 输出: {aux1.shape}   (从 inception4a 后引出)")

    # 评估模式前向传播
    model.eval()
    out_eval = model(x)
    print(f"\n--- 评估模式 (eval) ---")
    print(f"模型输出形状: {out_eval.shape}")
    print("注意：评估模式下辅助分类器不生效，只有一个输出")

    # 参数量统计
    total_params = sum(p.numel() for p in model.parameters())
    print(f"\n模型总参数量: {total_params:,}")
    print("(论文报告约 6.8M 参数，包含辅助分类器)")

    print("\n" + "=" * 60)
    print("思考题 / 动手练习:")
    print("=" * 60)
    print("1. 尝试将 aux_logits=False，观察参数量和输出变化。")
    print("2. 尝试修改某个 Inception 模块的通道数，观察输出形状是否改变。")
    print("3. 思考：为什么 1x1 卷积能起到 '降维' 和减少计算量的作用？")
    print("4. 对比：如果将全局平均池化替换为全连接层，参数量会增加多少？")
    print("=" * 60)
