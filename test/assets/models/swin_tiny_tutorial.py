"""
Swin Transformer: Hierarchical Vision Transformer Using Shifted Windows
Ze Liu et al., 2021

初学者友好的 Swin-Tiny (Swin-T) 教程实现。

Swin Transformer 的核心思想：
- 层次化 (Hierarchical)：像 CNN 一样逐层下采样，生成多尺度特征图，便于下游任务（检测、分割）。
- 窗口注意力 (Window Attention)：将特征图划分为不重叠的局部窗口，在窗口内计算自注意力，大幅降低计算复杂度。
- 移位窗口 (Shifted Window)：通过循环移位 (cyclic shift) 让相邻窗口的 patch 能够交互，弥补局部窗口的局限。

关键概念：
- Patch Partition: 将 224x224 图像切分为 4x4 的 patch，每个 patch 展平为 48 维向量。
- Linear Embedding: 将 48 维映射到 96 维，作为后续 Transformer 的输入维度。
- Window Attention (W-MSA): 在 7x7 的局部窗口内计算自注意力，复杂度从 O(N^2) 降到 O(N)。
- Shifted Window Attention (SW-MSA): 窗口偏移 3 个像素 (window_size // 2)，通过掩码注意力实现跨窗口信息交互。
- Patch Merging: 类似 CNN 的池化，将 2x2 相邻 patch 拼接后线性映射，实现 2x 下采样和通道翻倍。
- Relative Position Bias: 为注意力分数添加可学习的相对位置偏置，增强位置感知能力。
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ==================== 配置常量 ====================
IMG_SIZE = 224          # 输入图像尺寸 (高和宽)
NUM_CLASSES = 1000      # ImageNet 分类类别数
PATCH_SIZE = 4          # Patch 大小，4 表示 4x4 像素 -> 56x56 = 3136 个 patch
EMBED_DIM = 96          # 初始嵌入维度 (Linear Embedding 后的维度)
WINDOW_SIZE = 7         # 窗口注意力的大小，7x7 = 49 个 patch 构成一个窗口
MLP_RATIO = 4.0         # MLP 隐藏层维度 = EMBED_DIM * 4
DROP_RATE = 0.0         # Dropout 比率
ATTN_DROP_RATE = 0.0    # Attention 中的 Dropout 比率
DROP_PATH_RATE = 0.1    # DropPath (Stochastic Depth) 比率，随深度递增

# 每个 Stage 的 Swin Block 数量
# Stage 1: 2 层, Stage 2: 2 层, Stage 3: 6 层, Stage 4: 2 层
STAGE_DEPTHS = [2, 2, 6, 2]

# 每个 Stage 的多头注意力头数
# 论文规定：dim=96 -> 3 heads, dim=192 -> 6 heads, dim=384 -> 12 heads, dim=768 -> 24 heads
# 确保 dim 能被 num_heads 整除 (96/3=32, 192/6=32, 384/12=32, 768/24=32)
NUM_HEADS = [3, 6, 12, 24]


def window_partition(x, window_size):
    """
    将特征图划分为不重叠的窗口。

    输入 x: (B, H, W, C)
    输出 windows: (B * num_windows, window_size, window_size, C)

    示例：x=(2, 56, 56, 96), window_size=7
    -> view 为 (2, 8, 7, 8, 7, 96)
    -> permute 为 (2, 8, 8, 7, 7, 96)
    -> reshape 为 (128, 7, 7, 96)，共 2*8*8=128 个窗口
    """
    B, H, W, C = x.shape
    x = x.view(B, H // window_size, window_size, W // window_size, window_size, C)
    windows = x.permute(0, 1, 3, 2, 4, 5).contiguous()
    windows = windows.view(-1, window_size, window_size, C)
    return windows


def window_reverse(windows, window_size, H, W):
    """
    将窗口还原为特征图，是 window_partition 的逆操作。

    输入 windows: (B * num_windows, window_size, window_size, C)
    输出 x: (B, H, W, C)
    """
    B = int(windows.shape[0] / (H * W / window_size / window_size))
    x = windows.view(B, H // window_size, W // window_size, window_size, window_size, -1)
    x = x.permute(0, 1, 3, 2, 4, 5).contiguous()
    x = x.view(B, H, W, -1)
    return x


class WindowAttention(nn.Module):
    """
    基于窗口的多头自注意力 (Window-based Multi-Head Self-Attention, W-MSA)

    与标准 ViT 的全局注意力不同，这里只在每个 7x7 窗口内计算注意力。
    复杂度从 O(N^2) 降到 O(N * window_size^2)，其中 N = H * W。

    关键设计：
    1. QKV 投影：用一个 Linear 同时生成 Q, K, V。
    2. 相对位置偏置 (Relative Position Bias)：为注意力矩阵添加可学习的位置信息。
       这是 Swin 相比普通窗口注意力的重要改进，让模型感知 patch 的相对位置。
    3. 掩码注意力：在 Shifted Window 模式下，通过掩码屏蔽跨窗口的无效注意力。
    """
    def __init__(self, dim, window_size, num_heads, attn_drop=0.0, proj_drop=0.0):
        super().__init__()
        self.dim = dim
        self.window_size = window_size          # 窗口大小，默认 7
        self.num_heads = num_heads              # 注意力头数
        head_dim = dim // num_heads             # 每个头的维度，如 96/3=32
        self.scale = head_dim ** -0.5           # 缩放因子 1/sqrt(d_k)

        # 相对位置偏置表：shape ((2*7-1)^2, num_heads) = (169, num_heads)
        # 2*window_size-1 是坐标差值的范围 [-6, 6]
        self.relative_position_bias_table = nn.Parameter(
            torch.zeros((2 * window_size - 1) ** 2, num_heads)
        )

        # 预计算相对位置索引 (register_buffer 表示不需要梯度)
        coords_h = torch.arange(self.window_size)
        coords_w = torch.arange(self.window_size)
        # meshgrid 生成窗口内每个位置的坐标
        coords = torch.stack(torch.meshgrid([coords_h, coords_w], indexing="ij"))
        coords_flatten = torch.flatten(coords, 1)   # (2, 49)
        # 计算两两位置之间的相对坐标差
        relative_coords = coords_flatten[:, :, None] - coords_flatten[:, None, :]  # (2, 49, 49)
        relative_coords = relative_coords.permute(1, 2, 0).contiguous()
        # 将坐标偏移到非负范围
        relative_coords[:, :, 0] += self.window_size - 1
        relative_coords[:, :, 1] += self.window_size - 1
        # 将二维坐标压缩为一维索引
        relative_coords[:, :, 0] *= 2 * self.window_size - 1
        relative_position_index = relative_coords.sum(-1)   # (49, 49)
        self.register_buffer("relative_position_index", relative_position_index)

        # QKV 投影：dim -> 3*dim
        self.qkv = nn.Linear(dim, dim * 3)
        self.attn_drop = nn.Dropout(attn_drop)
        # 输出投影
        self.proj = nn.Linear(dim, dim)
        self.proj_drop = nn.Dropout(proj_drop)

        nn.init.trunc_normal_(self.relative_position_bias_table, std=0.02)

    def forward(self, x, mask=None):
        """
        输入 x: (B_, N, C)，其中 B_ 是窗口数量，N=window_size^2=49
        mask: 在 Shifted Window 时用于屏蔽无效注意力区域
        """
        B_, N, C = x.shape
        # 生成 QKV 并 reshape 为多头格式
        # qkv shape: (3, B_, num_heads, N, head_dim)
        qkv = self.qkv(x).reshape(B_, N, 3, self.num_heads, C // self.num_heads).permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]

        # 缩放并计算注意力分数
        q = q * self.scale
        attn = q @ k.transpose(-2, -1)   # (B_, num_heads, N, N)

        # 添加相对位置偏置
        # 根据预计算的索引从表中取偏置值
        relative_position_bias = self.relative_position_bias_table[
            self.relative_position_index.view(-1)
        ].view(
            self.window_size * self.window_size,
            self.window_size * self.window_size,
            -1,
        )
        relative_position_bias = relative_position_bias.permute(2, 0, 1).contiguous()  # (num_heads, 49, 49)
        attn = attn + relative_position_bias.unsqueeze(0)   # 广播到所有窗口

        # 如果有掩码（Shifted Window 模式），应用掩码
        if mask is not None:
            nW = mask.shape[0]
            # 将注意力 reshape 为 (B//nW, nW, num_heads, N, N)，加上掩码
            attn = attn.view(B_ // nW, nW, self.num_heads, N, N) + mask.unsqueeze(1).unsqueeze(0)
            attn = attn.view(-1, self.num_heads, N, N)
            attn = F.softmax(attn, dim=-1)
        else:
            attn = F.softmax(attn, dim=-1)

        attn = self.attn_drop(attn)
        # 用注意力权重对 V 加权求和
        x = (attn @ v).transpose(1, 2).reshape(B_, N, C)
        x = self.proj(x)
        x = self.proj_drop(x)
        return x


class Mlp(nn.Module):
    """
    前馈神经网络 (MLP)

    结构：Linear -> GELU -> Dropout -> Linear -> Dropout
    论文使用 GELU 激活函数，与 ViT 一致。
    中间层维度为 dim * mlp_ratio，通常是 4 倍。
    """
    def __init__(self, in_features, hidden_features=None, out_features=None, drop=0.0):
        super().__init__()
        out_features = out_features or in_features
        hidden_features = hidden_features or in_features
        self.fc1 = nn.Linear(in_features, hidden_features)   # 扩展维度
        self.act = nn.GELU()
        self.fc2 = nn.Linear(hidden_features, out_features)  # 压缩回原始维度
        self.drop = nn.Dropout(drop)

    def forward(self, x):
        x = self.fc1(x)
        x = self.act(x)
        x = self.drop(x)
        x = self.fc2(x)
        x = self.drop(x)
        return x


class SwinTransformerBlock(nn.Module):
    """
    Swin Transformer 基本块

    每个块包含：
    1. LayerNorm + Window Attention (W-MSA 或 SW-MSA) + 残差连接
    2. LayerNorm + MLP + 残差连接

    关键设计：
    - shift_size=0 时为 W-MSA（常规窗口注意力）
    - shift_size=window_size//2=3 时为 SW-MSA（移位窗口注意力）
    - 相邻两个块交替使用 W-MSA 和 SW-MSA

    移位窗口的实现：
    - 通过 torch.roll 将特征图循环移位
    - 此时窗口跨越了原本不相邻的区域，需要用掩码注意力屏蔽无效交互
    - 计算完注意力后再 roll 回来
    """
    def __init__(self, dim, num_heads, window_size=7, shift_size=0,
                 mlp_ratio=4.0, drop=0.0, attn_drop=0.0, drop_path=0.0):
        super().__init__()
        self.dim = dim
        self.num_heads = num_heads
        self.window_size = window_size
        self.shift_size = shift_size
        self.mlp_ratio = mlp_ratio

        self.norm1 = nn.LayerNorm(dim)
        self.attn = WindowAttention(
            dim, window_size, num_heads, attn_drop=attn_drop, proj_drop=drop
        )
        # DropPath (Stochastic Depth)：随机丢弃整个残差分支，用于正则化
        self.drop_path = nn.Identity() if drop_path == 0.0 else nn.Identity()
        self.norm2 = nn.LayerNorm(dim)
        mlp_hidden_dim = int(dim * mlp_ratio)
        self.mlp = Mlp(in_features=dim, hidden_features=mlp_hidden_dim, drop=drop)

    def forward(self, x, H, W):
        """
        输入 x: (B, H*W, C)，即展平后的特征图
        H, W: 特征图的空间尺寸
        """
        B, L, C = x.shape
        shortcut = x
        x = self.norm1(x)
        x = x.view(B, H, W, C)

        # 如果 H 或 W 不能被 window_size 整除，需要 pad
        pad_l = pad_t = 0
        pad_r = (self.window_size - W % self.window_size) % self.window_size
        pad_b = (self.window_size - H % self.window_size) % self.window_size
        x = F.pad(x, (0, 0, pad_l, pad_r, pad_t, pad_b))
        _, Hp, Wp, _ = x.shape

        # 如果是 Shifted Window，循环移位
        if self.shift_size > 0:
            shifted_x = torch.roll(x, shifts=(-self.shift_size, -self.shift_size), dims=(1, 2))
        else:
            shifted_x = x

        # 划分为窗口
        x_windows = window_partition(shifted_x, self.window_size)
        x_windows = x_windows.view(-1, self.window_size * self.window_size, C)

        # 如果是 Shifted Window，生成注意力掩码
        if self.shift_size > 0:
            img_mask = torch.zeros((1, Hp, Wp, 1), device=x.device)
            # 将特征图划分为 3x3=9 个区域，每个区域标不同数字
            h_slices = (
                (0, -self.window_size),
                (-self.window_size, -self.shift_size),
                (-self.shift_size, None),
            )
            w_slices = (
                (0, -self.window_size),
                (-self.window_size, -self.shift_size),
                (-self.shift_size, None),
            )
            cnt = 0
            for h in h_slices:
                for w in w_slices:
                    img_mask[:, h[0]:h[1], w[0]:w[1], :] = cnt
                    cnt += 1

            # 将 mask 也划分为窗口
            mask_windows = window_partition(img_mask, self.window_size)
            mask_windows = mask_windows.view(-1, self.window_size * self.window_size)
            # 窗口内 patch 的 mask 值相同则属于同一区域，可以互相注意
            attn_mask = mask_windows.unsqueeze(1) - mask_windows.unsqueeze(2)
            attn_mask = attn_mask.masked_fill(attn_mask != 0, float(-100.0)).masked_fill(attn_mask == 0, float(0.0))
        else:
            attn_mask = None

        # 执行窗口注意力
        attn_windows = self.attn(x_windows, mask=attn_mask)
        attn_windows = attn_windows.view(-1, self.window_size, self.window_size, C)

        # 将窗口还原为特征图
        shifted_x = window_reverse(attn_windows, self.window_size, Hp, Wp)

        # 如果是 Shifted Window，反向循环移位
        if self.shift_size > 0:
            x = torch.roll(shifted_x, shifts=(self.shift_size, self.shift_size), dims=(1, 2))
        else:
            x = shifted_x

        # 去掉 pad 部分
        if pad_r > 0 or pad_b > 0:
            x = x[:, :H, :W, :].contiguous()

        x = x.view(B, H * W, C)
        # 第一个残差连接：Attention 分支
        x = shortcut + self.drop_path(x)
        # 第二个残差连接：MLP 分支
        x = x + self.drop_path(self.mlp(self.norm2(x)))
        return x


class PatchMerging(nn.Module):
    """
    Patch 合并层：实现 2x 空间下采样和通道翻倍

    操作步骤：
    1. 将 2x2 相邻的 patch 在通道维度拼接 (类似 CNN 中的 stride=2 操作)
       - 取 (0,0), (1,0), (0,1), (1,1) 位置的 patch
    2. LayerNorm 归一化
    3. Linear 将 4*dim 映射到 2*dim

    输入 x: (B, H*W, C)
    输出 x: (B, H/2 * W/2, 2*C)

    示例：56x56, dim=96 -> 28x28, dim=192
    """
    def __init__(self, dim):
        super().__init__()
        self.dim = dim
        self.reduction = nn.Linear(4 * dim, 2 * dim, bias=False)
        self.norm = nn.LayerNorm(4 * dim)

    def forward(self, x, H, W):
        B, L, C = x.shape
        x = x.view(B, H, W, C)

        # 如果 H 或 W 是奇数，需要 pad
        pad_r = (2 - W % 2) % 2
        pad_b = (2 - H % 2) % 2
        x = F.pad(x, (0, 0, 0, pad_r, 0, pad_b))
        _, Hp, Wp, _ = x.shape

        # 选取 2x2 邻域的 4 个 patch
        x0 = x[:, 0::2, 0::2, :]   # 左上
        x1 = x[:, 1::2, 0::2, :]   # 左下
        x2 = x[:, 0::2, 1::2, :]   # 右上
        x3 = x[:, 1::2, 1::2, :]   # 右下
        x = torch.cat([x0, x1, x2, x3], -1)   # 在通道维度拼接: (B, H/2, W/2, 4*C)
        x = x.view(B, -1, 4 * C)

        x = self.norm(x)
        x = self.reduction(x)   # (B, H/2*W/2, 2*C)
        return x


class BasicLayer(nn.Module):
    """
    Swin Transformer 的一个 Stage

    每个 Stage 包含多个 SwinTransformerBlock：
    - 第 0, 2, 4... 个 block 使用 W-MSA (shift_size=0)
    - 第 1, 3, 5... 个 block 使用 SW-MSA (shift_size=window_size//2)

    Stage 之间通过 PatchMerging 进行下采样（最后一个 Stage 不需要）。
    """
    def __init__(self, dim, depth, num_heads, window_size=7, mlp_ratio=4.0,
                 drop=0.0, attn_drop=0.0, drop_path=0.0, downsample=None):
        super().__init__()
        self.blocks = nn.ModuleList([
            SwinTransformerBlock(
                dim=dim,
                num_heads=num_heads,
                window_size=window_size,
                shift_size=0 if (i % 2 == 0) else window_size // 2,   # 交替使用 W-MSA 和 SW-MSA
                mlp_ratio=mlp_ratio,
                drop=drop,
                attn_drop=attn_drop,
                drop_path=drop_path[i] if isinstance(drop_path, list) else drop_path,
            )
            for i in range(depth)
        ])
        self.downsample = downsample

    def forward(self, x, H, W):
        for blk in self.blocks:
            x = blk(x, H, W)
        if self.downsample is not None:
            x = self.downsample(x, H, W)
            H, W = (H + 1) // 2, (W + 1) // 2   # 下采样后空间尺寸减半
        return x, H, W


class PatchEmbed(nn.Module):
    """
    Patch Embedding 层

    将输入图像切分为 4x4 的 patch，并用卷积映射到 embed_dim 维度。
    相当于论文中的 Patch Partition + Linear Embedding。

    输入: (B, 3, 224, 224)
    输出: (B, 56*56, 96) = (B, 3136, 96)
    """
    def __init__(self, img_size=224, patch_size=4, in_chans=3, embed_dim=96):
        super().__init__()
        self.img_size = img_size
        self.patch_size = patch_size
        # 划分后的 patch 网格分辨率：224/4 = 56
        self.patches_resolution = [img_size // patch_size, img_size // patch_size]
        self.num_patches = self.patches_resolution[0] * self.patches_resolution[1]

        # 用 stride=patch_size 的卷积实现 patch 划分和线性映射
        self.proj = nn.Conv2d(in_chans, embed_dim, kernel_size=patch_size, stride=patch_size)
        self.norm = nn.LayerNorm(embed_dim)

    def forward(self, x):
        B, C, H, W = x.shape
        x = self.proj(x)            # (B, 96, 56, 56)
        x = x.flatten(2).transpose(1, 2)   # (B, 3136, 96)
        x = self.norm(x)
        return x


class SwinTransformer(nn.Module):
    """
    Swin Transformer (Swin-Tiny)

    整体流程：
    1. Patch Embedding: 4x4 patch partition + linear embedding -> (B, 3136, 96)
    2. Stage 1: 2x Swin Block (dim=96, heads=3) -> (B, 3136, 96)
       Patch Merging -> (B, 784, 192)
    3. Stage 2: 2x Swin Block (dim=192, heads=6) -> (B, 784, 192)
       Patch Merging -> (B, 196, 384)
    4. Stage 3: 6x Swin Block (dim=384, heads=12) -> (B, 196, 384)
       Patch Merging -> (B, 49, 768)
    5. Stage 4: 2x Swin Block (dim=768, heads=24) -> (B, 49, 768)
    6. LayerNorm + AdaptiveAvgPool1d -> (B, 768)
    7. Linear Head -> (B, 1000)

    为什么层次化设计优于 ViT 的单一尺度？
    - 多尺度特征天然适合检测、分割等下游任务
    - 逐步下采样降低计算量
    - 窗口注意力将复杂度从 O(N^2) 降到 O(N)
    """
    def __init__(
        self,
        img_size=IMG_SIZE,
        patch_size=PATCH_SIZE,
        in_chans=3,
        num_classes=NUM_CLASSES,
        embed_dim=EMBED_DIM,
        depths=STAGE_DEPTHS,
        num_heads=NUM_HEADS,
        window_size=WINDOW_SIZE,
        mlp_ratio=MLP_RATIO,
        drop_rate=DROP_RATE,
        attn_drop_rate=ATTN_DROP_RATE,
        drop_path_rate=DROP_PATH_RATE,
    ):
        super().__init__()
        self.num_classes = num_classes
        self.num_layers = len(depths)
        self.embed_dim = embed_dim
        # 最后一个 Stage 的输出维度
        self.num_features = int(embed_dim * 2 ** (self.num_layers - 1))
        self.mlp_ratio = mlp_ratio

        # Patch Embedding
        self.patch_embed = PatchEmbed(img_size, patch_size, in_chans, embed_dim)
        num_patches = self.patch_embed.num_patches
        patches_resolution = self.patch_embed.patches_resolution
        self.patches_resolution = patches_resolution

        # DropPath 比率随深度线性递增，从 0 到 drop_path_rate
        dpr = [x.item() for x in torch.linspace(0, drop_path_rate, sum(depths))]

        # 构建 4 个 Stage
        self.layers = nn.ModuleList()
        for i_layer in range(self.num_layers):
            layer = BasicLayer(
                dim=int(embed_dim * 2 ** i_layer),   # 每个 Stage 维度翻倍: 96, 192, 384, 768
                depth=depths[i_layer],
                num_heads=num_heads[i_layer],
                window_size=window_size,
                mlp_ratio=mlp_ratio,
                drop=drop_rate,
                attn_drop=attn_drop_rate,
                drop_path=dpr[sum(depths[:i_layer]):sum(depths[:i_layer + 1])],
                downsample=PatchMerging(int(embed_dim * 2 ** i_layer)) if (i_layer < self.num_layers - 1) else None,
            )
            self.layers.append(layer)

        # 最终归一化和分类头
        self.norm = nn.LayerNorm(self.num_features)
        self.avgpool = nn.AdaptiveAvgPool1d(1)   # 将 (B, 768, 49) -> (B, 768, 1)
        self.head = nn.Linear(self.num_features, num_classes) if num_classes > 0 else nn.Identity()

    def forward(self, x):
        # Step 1: Patch Embedding
        # x: (B, 3, 224, 224) -> (B, 3136, 96)
        x = self.patch_embed(x)
        H, W = self.patches_resolution   # 56, 56
        x = x.view(-1, H, W, self.embed_dim).flatten(1, 2)   # 保持 (B, H*W, C) 格式

        # Step 2-5: 4 个 Stage
        for layer in self.layers:
            x, H, W = layer(x, H, W)
            # Stage 1 后: (B, 3136, 96) -> downsample -> (B, 784, 192)
            # Stage 2 后: (B, 784, 192) -> downsample -> (B, 196, 384)
            # Stage 3 后: (B, 196, 384) -> downsample -> (B, 49, 768)
            # Stage 4 后: (B, 49, 768)

        # Step 6: 归一化 + 全局平均池化
        x = self.norm(x)          # (B, 49, 768)
        x = x.transpose(1, 2)     # (B, 768, 49)
        x = self.avgpool(x)       # (B, 768, 1)
        x = torch.flatten(x, 1)   # (B, 768)

        # Step 7: 分类头
        x = self.head(x)          # (B, 1000)
        return x


if __name__ == "__main__":
    model = SwinTransformer()
    x = torch.randn(2, 3, IMG_SIZE, IMG_SIZE)
    y = model(x)

    print(f"输入形状:  {x.shape}")       # (2, 3, 224, 224)
    print(f"输出形状: {y.shape}")        # (2, 1000)

    total = sum(p.numel() for p in model.parameters())
    print(f"总参数量: {total / 1e6:.1f}M")   # 约 28M

    # ==================== 练习题 ====================
    # 1. 尝试修改 WINDOW_SIZE 为 8 或 14，观察模型是否还能正常运行（注意 IMAGE_SIZE 需要能被整除）。
    # 2. 尝试修改 STAGE_DEPTHS 为 [2, 2, 18, 2]，这对应 Swin-Small，观察参数量如何变化。
    # 3. 思考：为什么 Swin Transformer 使用窗口注意力而非全局注意力？计算复杂度有何优势？
    # 4. 思考：Patch Merging 和 CNN 中的 MaxPool + 1x1 Conv 有什么异同？
    # 5. 尝试在 forward 中打印每个 Stage 后的 x.shape，直观感受层次化下采样过程。
