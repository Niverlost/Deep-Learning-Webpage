"""
Squeeze-and-Excitation Networks
Jie Hu, Li Shen, Samuel Albanie, Gang Sun, Enhua Wu
2018 (CVPR 2018 / TPAMI 2019)
arXiv: https://arxiv.org/abs/1709.01507

========== 关键概念 (Key Concepts) ==========
1. 通道注意力 (Channel Attention):
   传统 CNN 的卷积操作在每个通道上是平等的，没有区分哪些通道更重要。
   SENet 提出：不同通道的特征对最终分类的贡献不同，应该让网络自动学习每个通道的权重。

2. Squeeze (压缩):
   使用全局平均池化 (Global Average Pooling, GAP) 将每个特征图 HxW 压缩成一个数值。
   这样每个通道得到一个标量描述符，代表该通道的全局信息。
   公式: z_c = (1 / HxW) * sum(u_c(i, j))

3. Excitation (激励):
   用一个小的全连接网络 (FC -> ReLU -> FC -> Sigmoid) 学习通道间的非线性依赖。
   第一个 FC 降维 (channel -> channel//reduction)，第二个 FC 升维回原始通道数。
   Sigmoid 将输出限制在 (0, 1)，作为每个通道的权重。

4. Scale (缩放):
   将学习到的通道权重乘回原始特征图，增强重要通道，抑制不重要通道。

5. SE-ResNet-50:
   在 ResNet-50 的每个 Bottleneck block 中插入 SE 模块。
   SE 模块放在最后一个 1x1 卷积和 BatchNorm 之后、残差相加之前。
   Reduction ratio = 16 是论文默认设置，平衡性能和计算量。
"""

import torch
import torch.nn as nn


# ------------------------------------------------------------------
# 配置常量
# ------------------------------------------------------------------
INPUT_SIZE = 224       # 输入图像尺寸 (ImageNet 标准)
NUM_CLASSES = 1000     # ImageNet 类别数
REDUCTION = 16         # SE 模块降维比例，论文默认 16


# ------------------------------------------------------------------
# SE 模块 (Squeeze-and-Excitation Block)
# ------------------------------------------------------------------
class SEBlock(nn.Module):
    """
    Squeeze-and-Excitation 模块

    作用: 对输入特征图的每个通道学习一个权重，然后按通道重新加权。

    结构:
        1. Squeeze:   全局平均池化，将 (B, C, H, W) -> (B, C, 1, 1) -> (B, C)
        2. Excitation: 两个 FC 层 + ReLU + Sigmoid，(B, C) -> (B, C//r) -> (B, C)
        3. Scale:      将权重 (B, C, 1, 1) 广播乘回输入特征图

    参数:
        channels:   输入通道数
        reduction:  降维比例，默认 16。越大则 FC 层参数量越少。
    """

    def __init__(self, channels, reduction=REDUCTION):
        super().__init__()

        # Squeeze: 全局平均池化，将空间维度 HxW 压缩为 1x1
        # 输出形状: (B, C, 1, 1)
        self.avgpool = nn.AdaptiveAvgPool2d(1)

        # Excitation: 两个全连接层组成的瓶颈结构
        self.fc = nn.Sequential(
            # 第1个 FC: 降维，减少参数量和计算量
            # 输入 C，输出 C//reduction
            nn.Linear(channels, channels // reduction, bias=False),
            nn.ReLU(inplace=True),  # 非线性激活，学习复杂依赖

            # 第2个 FC: 升维回原始通道数
            # 输入 C//reduction，输出 C
            nn.Linear(channels // reduction, channels, bias=False),
            nn.Sigmoid(),  # 输出 (0,1) 范围的权重
        )

    def forward(self, x):
        b, c, h, w = x.size()  # 记录输入形状，例如 (2, 256, 56, 56)

        # Squeeze: 全局平均池化 -> (B, C, 1, 1)
        y = self.avgpool(x)
        # 展平为 (B, C)，以便输入全连接层
        y = y.view(b, c)

        # Excitation: FC 学习通道权重 -> (B, C)
        y = self.fc(y)
        # 恢复为 (B, C, 1, 1)，便于广播乘法
        y = y.view(b, c, 1, 1)

        # Scale: 将权重乘回原始特征图
        # y.expand_as(x) 将 (B, C, 1, 1) 广播为 (B, C, H, W)
        # 每个通道的所有空间位置共享同一个权重
        return x * y.expand_as(x)


# ------------------------------------------------------------------
# SE-Bottleneck 残差块
# ------------------------------------------------------------------
class SEBottleneck(nn.Module):
    """
    带 SE 模块的 Bottleneck 残差块

    相比普通 Bottleneck，在最后一个 1x1 卷积之后、残差相加之前插入了 SE 模块。
    这样 SE 模块可以重新校准卷积输出的通道响应，然后再与 shortcut 相加。

    结构:
        1x1 降维 -> BN -> ReLU
        -> 3x3 卷积 -> BN -> ReLU
        -> 1x1 升维 -> BN
        -> SE 模块 (重新加权通道)
        -> + shortcut
        -> ReLU

    参数:
        in_planes:  输入通道数
        planes:     中间层通道数（1x1降维后的通道数）
        stride:     步长，通常为1或2
        reduction:  SE 模块的降维比例
    """
    expansion = 4  # 升维倍数：输出通道 = 中间通道 * 4

    def __init__(self, in_planes, planes, stride=1, reduction=REDUCTION):
        super().__init__()

        # ---- 主路径 (Main Path) ----
        # 第1层：1x1 卷积，降维（例如 256 -> 64）
        self.conv1 = nn.Conv2d(in_planes, planes, kernel_size=1, bias=False)
        self.bn1 = nn.BatchNorm2d(planes)

        # 第2层：3x3 卷积，提取空间特征
        # stride 可能为2（下采样），padding=1 保持空间尺寸
        self.conv2 = nn.Conv2d(planes, planes, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(planes)

        # 第3层：1x1 卷积，升维回高维（例如 64 -> 256）
        self.conv3 = nn.Conv2d(planes, planes * self.expansion, kernel_size=1, bias=False)
        self.bn3 = nn.BatchNorm2d(planes * self.expansion)

        self.relu = nn.ReLU(inplace=True)

        # ---- SE 模块 (核心创新) ----
        # 放在最后一个卷积之后、残差相加之前
        # 对升维后的特征图 (planes * 4 通道) 做通道注意力
        self.se = SEBlock(planes * self.expansion, reduction)

        # ---- 捷径 (Shortcut Connection) ----
        # 当维度不匹配时，用 1x1 卷积做投影
        self.shortcut = nn.Sequential()
        if stride != 1 or in_planes != planes * self.expansion:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_planes, planes * self.expansion, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(planes * self.expansion),
            )

    def forward(self, x):
        identity = x  # 保存输入用于残差连接

        # 主路径
        out = self.conv1(x)       # 1x1 降维
        out = self.bn1(out)
        out = self.relu(out)

        out = self.conv2(out)     # 3x3 空间卷积
        out = self.bn2(out)
        out = self.relu(out)

        out = self.conv3(out)     # 1x1 升维
        out = self.bn3(out)       # 先不加 ReLU，要和 SE 输出保持一致

        # SE 模块：重新校准通道权重
        # 这一步是 SENet 的核心：让每个通道乘以一个学习到的标量权重
        out = self.se(out)

        # 残差连接：主路径输出 + 捷径输出
        out += self.shortcut(identity)
        out = self.relu(out)      # 相加后再做 ReLU

        return out


# ------------------------------------------------------------------
# SE-ResNet-50 完整模型
# ------------------------------------------------------------------
class SEResNet50(nn.Module):
    """
    SE-ResNet-50 完整网络结构

    在 ResNet-50 的每个 Bottleneck block 中加入 SE 模块。
    SE 模块只增加了少量参数量（约 2.5M），但显著提升了分类精度。

    前向流程 (以 224x224 输入为例):
        1. conv1:   7x7, stride=2  -> 112x112, 64通道
        2. maxpool: 3x3, stride=2  -> 56x56, 64通道
        3. layer1 (conv2_x): 3个 SE-Bottleneck, stride=1 -> 56x56, 256通道
        4. layer2 (conv3_x): 4个 SE-Bottleneck, stride=2 -> 28x28, 512通道
        5. layer3 (conv4_x): 6个 SE-Bottleneck, stride=2 -> 14x14, 1024通道
        6. layer4 (conv5_x): 3个 SE-Bottleneck, stride=2 -> 7x7, 2048通道
        7. avgpool: 全局平均池化 -> 1x1, 2048通道
        8. fc: 全连接层 -> 1000类输出
    """

    def __init__(self, num_classes=NUM_CLASSES, reduction=REDUCTION):
        super().__init__()
        self.in_planes = 64   # 当前通道数，随 layer 构建而更新

        # ---- 初始卷积层 (Stem) ----
        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)

        # ---- 残差层 (Residual Layers) ----
        # 每个 layer 包含多个 SE-Bottleneck block
        # layer1: 3个 block, 64 -> 256, 不下采样 (stride=1)
        self.layer1 = self._make_layer(64, 3, stride=1, reduction=reduction)
        # layer2: 4个 block, 128 -> 512, 下采样 (stride=2)
        self.layer2 = self._make_layer(128, 4, stride=2, reduction=reduction)
        # layer3: 6个 block, 256 -> 1024, 下采样 (stride=2)
        self.layer3 = self._make_layer(256, 6, stride=2, reduction=reduction)
        # layer4: 3个 block, 512 -> 2048, 下采样 (stride=2)
        self.layer4 = self._make_layer(512, 3, stride=2, reduction=reduction)

        # ---- 分类头 (Classifier Head) ----
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(512 * SEBottleneck.expansion, num_classes)

    def _make_layer(self, planes, num_blocks, stride, reduction):
        """
        构建一个残差层（包含多个 SE-Bottleneck block）

        参数:
            planes:      中间通道数
            num_blocks:  block 数量
            stride:      第一个 block 的 stride（控制是否下采样）
            reduction:   SE 模块降维比例
        """
        layers = []
        # 第一个 block 可能带下采样
        layers.append(SEBottleneck(self.in_planes, planes, stride, reduction))
        self.in_planes = planes * SEBottleneck.expansion  # 更新通道数

        # 后续 block 不下采样，stride=1
        for _ in range(1, num_blocks):
            layers.append(SEBottleneck(self.in_planes, planes, stride=1, reduction=reduction))

        return nn.Sequential(*layers)

    def forward(self, x):
        # Stem
        x = self.conv1(x)       # (B, 3, 224, 224) -> (B, 64, 112, 112)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)     # (B, 64, 112, 112) -> (B, 64, 56, 56)

        # Residual layers (每个 block 内部都有 SE 模块)
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
    model = SEResNet50(num_classes=NUM_CLASSES)
    dummy = torch.randn(2, 3, INPUT_SIZE, INPUT_SIZE)
    out = model(dummy)
    total = sum(p.numel() for p in model.parameters())

    print(f"输入形状:  {dummy.shape}")
    print(f"输出形状:  {out.shape}")
    print(f"总参数量:  {total / 1e6:.1f}M")

    # ========== 课后练习 (Exercises) ==========
    # 1. 尝试将 REDUCTION 从 16 改为 8 或 32，观察参数量和模型容量的变化。
    #    reduction 越小，SE 模块参数量越多，模型表达能力越强。
    # 2. 将 SE 模块中的 Sigmoid 换成 Softmax，观察输出分布的变化。
    #    (提示：Sigmoid 是每个通道独立的，Softmax 是通道间竞争的)
    # 3. 尝试把 SE 模块放在残差相加之后（而不是之前），看看是否影响训练。
    # 4. 对比 ResNet-50 和 SE-ResNet-50 的参数量，理解 SE 模块的轻量性。
    # 5. 将 Squeeze 中的全局平均池化改为全局最大池化，观察效果差异。
