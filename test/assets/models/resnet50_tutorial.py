"""
Deep Residual Learning for Image Recognition
Kaiming He, Xiangyu Zhang, Shaoqing Ren, Jian Sun
2016 (CVPR 2016)
arXiv: https://arxiv.org/abs/1512.03385

========== 关键概念 (Key Concepts) ==========
1. 残差连接 (Residual Connection / Shortcut):
   论文的核心创新。传统深层网络随着层数增加，训练精度反而下降（退化问题）。
   ResNet 引入了一个“捷径”：不是让网络直接学习 H(x)，而是学习 F(x) = H(x) - x，
   然后输出 F(x) + x。这样即使 F(x) 学不到东西，至少还能保留 x，保证网络不会比浅层更差。

2. Bottleneck 结构:
   为了减少计算量，ResNet-50/101/152 使用 1x1 -> 3x3 -> 1x1 的三层卷积结构。
   先用 1x1 降维，3x3 做空间卷积，再用 1x1 升维回高维。
   这比直接用两个 3x3 更快，参数量更少。

3. Batch Normalization:
   2015年的论文，BatchNorm 刚刚普及。ResNet 大量使用 BN 来稳定训练。
   注意：每个卷积层后面都有 BN，且 bias=False（因为 BN 已经包含了一个可学习的 bias）。

4. Projection Shortcut:
   当输入输出维度不匹配时（比如通道数变化或 stride=2 下采样），
   shortcut 不能简单做恒等映射，需要用 1x1 卷积做投影，调整通道数和空间尺寸。
"""

import torch
import torch.nn as nn


# ------------------------------------------------------------------
# 配置常量
# ------------------------------------------------------------------
INPUT_SIZE = 224       # 输入图像尺寸 (ImageNet 标准)
NUM_CLASSES = 1000     # ImageNet 类别数


# ------------------------------------------------------------------
# Bottleneck 残差块
# ------------------------------------------------------------------
class Bottleneck(nn.Module):
    """
    Bottleneck 残差块：1x1 降维 -> 3x3 卷积 -> 1x1 升维
    
    参数:
        in_planes: 输入通道数
        planes:    中间层通道数（1x1降维后的通道数）
        stride:    步长，通常为1（不下采样）或2（下采样）
    
    输出通道数 = planes * expansion (expansion=4)
    """
    expansion = 4  # 升维倍数：输出通道 = 中间通道 * 4

    def __init__(self, in_planes, planes, stride=1):
        super().__init__()

        # ---- 主路径 (Main Path) ----
        # 第1层：1x1 卷积，降维（例如 256 -> 64）
        self.conv1 = nn.Conv2d(in_planes, planes, kernel_size=1, bias=False)
        self.bn1 = nn.BatchNorm2d(planes)

        # 第2层：3x3 卷积，提取空间特征
        # stride 可能为2（下采样），padding=1 保持空间尺寸（除 stride=2 时减半）
        self.conv2 = nn.Conv2d(planes, planes, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(planes)

        # 第3层：1x1 卷积，升维回高维（例如 64 -> 256）
        self.conv3 = nn.Conv2d(planes, planes * self.expansion, kernel_size=1, bias=False)
        self.bn3 = nn.BatchNorm2d(planes * self.expansion)

        self.relu = nn.ReLU(inplace=True)

        # ---- 捷径 (Shortcut Connection) ----
        # 当维度不匹配时（stride!=1 或 通道数不同），用 1x1 卷积做投影
        self.shortcut = nn.Sequential()
        if stride != 1 or in_planes != planes * self.expansion:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_planes, planes * self.expansion, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(planes * self.expansion),
            )

    def forward(self, x):
        # 保存输入用于残差连接
        identity = x

        # 主路径
        out = self.conv1(x)      # 1x1 降维
        out = self.bn1(out)
        out = self.relu(out)

        out = self.conv2(out)    # 3x3 空间卷积
        out = self.bn2(out)
        out = self.relu(out)

        out = self.conv3(out)    # 1x1 升维
        out = self.bn3(out)      # 注意：这里先不加 ReLU，要和 shortcut 相加后再激活

        # 残差连接：主路径输出 + 捷径输出
        out += self.shortcut(identity)
        out = self.relu(out)     # 相加后再做 ReLU

        return out


# ------------------------------------------------------------------
# ResNet-50 完整模型
# ------------------------------------------------------------------
class ResNet50(nn.Module):
    """
    ResNet-50 完整网络结构
    
    前向流程 (以 224x224 输入为例):
        1. conv1:   7x7, stride=2  -> 112x112, 64通道
        2. maxpool: 3x3, stride=2  -> 56x56, 64通道
        3. layer1 (conv2_x): 3个 Bottleneck, stride=1 -> 56x56, 256通道
        4. layer2 (conv3_x): 4个 Bottleneck, stride=2 -> 28x28, 512通道
        5. layer3 (conv4_x): 6个 Bottleneck, stride=2 -> 14x14, 1024通道
        6. layer4 (conv5_x): 3个 Bottleneck, stride=2 -> 7x7, 2048通道
        7. avgpool: 全局平均池化 -> 1x1, 2048通道
        8. fc: 全连接层 -> 1000类输出
    """

    def __init__(self, num_classes=NUM_CLASSES):
        super().__init__()
        self.in_planes = 64   # 当前通道数，会随着 layer 的构建而更新

        # ---- 初始卷积层 (Stem) ----
        # 7x7 大卷积核快速降采样，提取低级特征
        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        # ---- 残差层 (Residual Layers) ----
        # layer1: 3个 block, 64 -> 256, 不下采样 (stride=1)
        self.layer1 = self._make_layer(64, 3, stride=1)
        # layer2: 4个 block, 128 -> 512, 下采样 (stride=2)
        self.layer2 = self._make_layer(128, 4, stride=2)
        # layer3: 6个 block, 256 -> 1024, 下采样 (stride=2)
        self.layer3 = self._make_layer(256, 6, stride=2)
        # layer4: 3个 block, 512 -> 2048, 下采样 (stride=2)
        self.layer4 = self._make_layer(512, 3, stride=2)

        # ---- 分类头 (Classifier Head) ----
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))  # 全局平均池化，替代全连接前的展平
        self.fc = nn.Linear(512 * Bottleneck.expansion, num_classes)

    def _make_layer(self, planes, num_blocks, stride):
        """
        构建一个残差层（包含多个 Bottleneck block）
        
        参数:
            planes:      中间通道数
            num_blocks:  block 数量
            stride:      第一个 block 的 stride（控制是否下采样）
        """
        layers = []
        # 第一个 block 可能带下采样
        layers.append(Bottleneck(self.in_planes, planes, stride))
        self.in_planes = planes * Bottleneck.expansion  # 更新通道数

        # 后续 block 不下采样，stride=1
        for _ in range(1, num_blocks):
            layers.append(Bottleneck(self.in_planes, planes, stride=1))

        return nn.Sequential(*layers)

    def forward(self, x):
        # Stem
        x = self.conv1(x)       # (B, 3, 224, 224) -> (B, 64, 112, 112)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)     # (B, 64, 112, 112) -> (B, 64, 56, 56)

        # Residual layers
        x = self.layer1(x)      # -> (B, 256, 56, 56)
        x = self.layer2(x)      # -> (B, 512, 28, 28)
        x = self.layer3(x)      # -> (B, 1024, 14, 14)
        x = self.layer4(x)      # -> (B, 2048, 7, 7)

        # Classifier
        x = self.avgpool(x)     # -> (B, 2048, 1, 1)
        x = torch.flatten(x, 1) # -> (B, 2048)
        x = self.fc(x)          # -> (B, 1000)
        return x


# ------------------------------------------------------------------
# 教学演示 (Educational Demo)
# ------------------------------------------------------------------
if __name__ == "__main__":
    model = ResNet50(num_classes=NUM_CLASSES)
    dummy = torch.randn(2, 3, INPUT_SIZE, INPUT_SIZE)
    out = model(dummy)
    total = sum(p.numel() for p in model.parameters())

    print(f"输入形状:  {dummy.shape}")
    print(f"输出形状:  {out.shape}")
    print(f"总参数量:  {total / 1e6:.1f}M")

    # ========== 课后练习 (Exercises) ==========
    # 1. 尝试将 Bottleneck.expansion 从 4 改为 2，观察参数量和输出通道的变化。
    # 2. 将 layer4 的 block 数量从 3 改为 6，模拟 ResNet-101 的部分结构。
    # 3. 把 nn.AdaptiveAvgPool2d 换成 nn.MaxPool2d，看看对输出形状的影响。
    # 4. 尝试移除某个 Bottleneck 中的 shortcut，观察训练时梯度是否会消失（退化问题）。
