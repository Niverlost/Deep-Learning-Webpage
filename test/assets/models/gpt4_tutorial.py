"""
GPT-4 Technical Report
Authors: OpenAI
Year: 2023
arXiv: https://arxiv.org/abs/2303.08774

============================================================
初学者指南：GPT-4 概念实现
============================================================

GPT-4 是什么？
--------------
GPT-4 是 OpenAI 发布的大型语言模型。与 GPT-2/GPT-3 不同，GPT-4 采用了
"混合专家"(Mixture of Experts, MoE) 架构，这使得它能在保持巨大参数量的
同时，每次推理只激活部分参数，提高计算效率。

本代码实现什么？
----------------
由于 GPT-4 的精确架构未公开，本代码基于公开信息实现了一个"概念验证"版本：
- 使用 GPT-2 的基础架构但大幅放大规模
- 引入 MoE 层，展示其核心思想
- 使用现代改进：RMSNorm、SwiGLU、RoPE 位置编码

关键概念 (Key Concepts)
-----------------------
1. Transformer Decoder: 只使用解码器部分的自回归语言模型
2. 因果注意力 (Causal Attention): 只能看到当前位置及之前的token
3. 混合专家 (MoE): 多个"专家"网络，门控网络决定用哪几个
4. 参数共享: 词嵌入层与输出层共享权重，减少参数量
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================================
# 配置常量
# ============================================================

N_LAYERS = 48          # Transformer 层数：GPT-4 比 GPT-3 (96层) 更深
N_HEADS = 64           # 注意力头数：每个头学习不同的注意力模式
D_MODEL = 8192         # 模型隐藏维度：决定模型的"宽度"
D_HEAD = D_MODEL // N_HEADS   # 每个注意力头的维度: 8192 / 64 = 128
D_FF = D_MODEL * 4     # 前馈网络中间层维度：通常是 d_model 的 4 倍
NUM_EXPERTS = 8        # 专家数量：MoE 的核心，有8个专家网络
TOP_K = 2              # 每次激活的专家数：只选2个，节省计算
VOCAB_SIZE = 100256    # 词表大小：GPT-4 使用更大的 tokenizer
MAX_SEQ_LEN = 8192     # 最大序列长度：支持更长的上下文
DROPOUT = 0.0          # Dropout 率：大模型通常不用 dropout


# ============================================================
# RMSNorm 归一化层
# ============================================================

class RMSNorm(nn.Module):
    """
    RMSNorm (Root Mean Square Layer Normalization)

    为什么用 RMSNorm 而不是 LayerNorm？
    -----------------------------------
    LayerNorm 计算均值和方差进行归一化，而 RMSNorm 只计算均方根(RMS)。
    研究表明 RMSNorm 在大型语言模型中表现相当，且计算更简单。
    公式: output = x / RMS(x) * weight
          RMS(x) = sqrt(mean(x^2))
    """

    def __init__(self, dim: int, eps: float = 1e-6):
        super().__init__()
        self.eps = eps  # 防止除零的小常数
        # 可学习的缩放参数，初始为1
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # 计算均方根: sqrt(mean(x^2))
        rms = x.pow(2).mean(dim=-1, keepdim=True).sqrt()
        # 归一化并乘以可学习权重
        x_norm = x / (rms + self.eps)
        return self.weight * x_norm


# ============================================================
# 旋转位置编码 (RoPE)
# ============================================================

class RotaryPositionalEmbedding(nn.Module):
    """
    Rotary Position Embedding (RoPE) - 旋转位置编码

    为什么用 RoPE 而不是绝对位置编码？
    ----------------------------------
    GPT-2 使用可学习的位置嵌入(绝对位置编码)。
    RoPE 通过旋转矩阵将位置信息注入注意力计算，具有更好的外推性
    (即可以处理比训练时更长的序列)。

    原理：将查询(Q)和键(K)向量在二维平面上旋转一个与位置相关的角度，
    使得点积自然包含相对位置信息。
    """

    def __init__(self, d_head: int, max_seq_len: int = MAX_SEQ_LEN, theta: float = 10000.0):
        super().__init__()
        self.d_head = d_head
        # 计算频率：不同维度使用不同的旋转速度
        inv_freq = 1.0 / (theta ** (torch.arange(0, d_head, 2).float() / d_head))
        self.register_buffer("inv_freq", inv_freq)

        # 预计算所有位置的正弦/余弦值，避免重复计算
        t = torch.arange(max_seq_len, dtype=torch.float32)
        # 外积：每个位置 × 每个频率
        freqs = torch.einsum("i,j->ij", t, self.inv_freq)
        # 拼接得到完整的旋转角度
        emb = torch.cat([freqs, freqs], dim=-1)
        self.register_buffer("cos_cached", emb.cos()[None, None, :, :])
        self.register_buffer("sin_cached", emb.sin()[None, None, :, :])

    def forward(self, x: torch.Tensor, seq_len: int) -> tuple[torch.Tensor, torch.Tensor]:
        """返回当前序列长度对应的 cos 和 sin 缓存。"""
        return (
            self.cos_cached[:, :, :seq_len, :],
            self.sin_cached[:, :, :seq_len, :],
        )


def apply_rotary_pos_emb(x: torch.Tensor, cos: torch.Tensor, sin: torch.Tensor) -> torch.Tensor:
    """
    应用旋转位置编码到输入张量。

    参数:
        x: 输入张量，形状 (..., d_head)
        cos, sin: 预计算的位置编码

    原理：将向量分成两半，在二维平面上旋转
        [x1, x2] 旋转后 -> [x1*cos - x2*sin, x1*sin + x2*cos]
    """
    d = x.shape[-1]
    x1, x2 = x[..., : d // 2], x[..., d // 2 :]  # 分成两半
    return torch.cat([x1 * cos - x2 * sin, x1 * sin + x2 * cos], dim=-1)


# ============================================================
# 因果自注意力层
# ============================================================

class CausalSelfAttention(nn.Module):
    """
    因果自注意力 (Causal Self-Attention)

    这是 Transformer 的核心组件。"因果"意味着每个token只能看到自己和之前的token，
    不能看到未来的token（这是语言模型的关键，因为我们要预测下一个词）。

    多头注意力 (Multi-Head Attention):
    --------------------------------
    将注意力分成多个"头"，每个头学习不同的注意力模式。
    例如：一个头可能关注语法关系，另一个关注语义关系。

    形状变化:
        输入:  (B, T, D_MODEL)     B=批次, T=序列长度, D_MODEL=模型维度
        Q/K/V: (B, N_HEADS, T, D_HEAD)  分成多个头
        输出:  (B, T, D_MODEL)
    """

    def __init__(self):
        super().__init__()
        self.n_heads = N_HEADS      # 64个注意力头
        self.d_head = D_HEAD        # 每个头128维
        self.d_model = D_MODEL      # 总维度8192

        # 合并的 Q/K/V 投影：将输入投影到 3*d_model 维度，然后分成Q、K、V
        self.c_attn = nn.Linear(D_MODEL, 3 * D_MODEL, bias=False)
        # 输出投影：将注意力结果映射回模型维度
        self.c_proj = nn.Linear(D_MODEL, D_MODEL, bias=False)

        # 旋转位置编码
        self.rope = RotaryPositionalEmbedding(D_HEAD)

        # 因果掩码：下三角矩阵，确保只能看到当前及之前的位置
        # 形状: (1, 1, MAX_SEQ_LEN, MAX_SEQ_LEN)
        self.register_buffer(
            "bias",
            torch.tril(torch.ones(MAX_SEQ_LEN, MAX_SEQ_LEN)).view(1, 1, MAX_SEQ_LEN, MAX_SEQ_LEN),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.size()  # 批次大小, 序列长度, 模型维度

        # 1. 计算 Q, K, V
        # c_attn 输出形状: (B, T, 3*D_MODEL)
        q, k, v = self.c_attn(x).split(self.d_model, dim=2)

        # 2. 重塑为多头形状: (B, N_HEADS, T, D_HEAD)
        q = q.view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        k = k.view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        v = v.view(B, T, self.n_heads, self.d_head).transpose(1, 2)

        # 3. 应用旋转位置编码
        cos, sin = self.rope(q, T)
        q = apply_rotary_pos_emb(q, cos, sin)
        k = apply_rotary_pos_emb(k, cos, sin)

        # 4. 计算注意力分数: Q @ K^T / sqrt(d_head)
        # 形状: (B, N_HEADS, T, T)
        att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(self.d_head))

        # 5. 应用因果掩码：将未来位置设为 -inf（softmax后变为0）
        att = att.masked_fill(self.bias[:, :, :T, :T] == 0, float("-inf"))

        # 6. Softmax 归一化
        att = F.softmax(att, dim=-1)

        # 7. 注意力加权求和: (B, N_HEADS, T, T) @ (B, N_HEADS, T, D_HEAD)
        # 结果: (B, N_HEADS, T, D_HEAD)
        y = att @ v

        # 8. 合并多头: (B, T, D_MODEL)
        y = y.transpose(1, 2).contiguous().view(B, T, C)

        # 9. 输出投影
        return self.c_proj(y)


# ============================================================
# 专家网络 (Expert)
# ============================================================

class Expert(nn.Module):
    """
    单个专家网络 (SwiGLU 前馈网络)

    MoE 中的每个"专家"本质上是一个前馈神经网络(FFN)。
    这里使用 SwiGLU 激活函数，这是现代大模型的标准选择。

    SwiGLU 结构:
        output = W2( SiLU(W1(x)) * W3(x) )
        - SiLU (Sigmoid Linear Unit): 平滑的激活函数
        - * : 逐元素乘法 (门控机制)
        - 需要三个权重矩阵 W1, W2, W3

    为什么用 SwiGLU 而不是 ReLU/GELU？
    ----------------------------------
    SwiGLU 在大型语言模型中表现更好，它结合了门控机制，
    可以学习更复杂的非线性变换。
    """

    def __init__(self):
        super().__init__()
        self.w1 = nn.Linear(D_MODEL, D_FF, bias=False)  # 升维: 8192 -> 32768
        self.w2 = nn.Linear(D_FF, D_MODEL, bias=False)  # 降维: 32768 -> 8192
        self.w3 = nn.Linear(D_MODEL, D_FF, bias=False)  # 门控分支

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # SwiGLU: SiLU(W1(x)) * W3(x) 然后通过 W2
        return self.w2(F.silu(self.w1(x)) * self.w3(x))


# ============================================================
# 混合专家层 (MoE Layer)
# ============================================================

class MoELayer(nn.Module):
    """
    混合专家层 (Mixture of Experts Layer) - GPT-4 的核心创新

    核心思想:
    --------
    传统 Transformer 每层只有一个前馈网络(FFN)。
    MoE 用多个"专家"(Expert)替代单个 FFN，并通过"门控网络"(Gating Network)
    决定每个输入token应该由哪几个专家处理。

    为什么这样做？
    -------------
    1. 扩展模型容量：总参数量 = 专家数 × 单个专家参数量
       8个专家 = 8倍容量，但每次只激活2个，计算量只增加约2倍
    2. 专业化学习：不同专家可以学习不同类型的知识
       例如：一个专家学代码，一个学数学，一个学日常对话...

    工作流程:
    ---------
    1. 门控网络为每个token计算对所有专家的"偏好分数"
    2. 选择 Top-K 个分数最高的专家
    3. 只将token发送给这 K 个专家处理
    4. 加权聚合 K 个专家的输出

    形状变化:
        输入:  (B, T, D_MODEL)
        输出:  (B, T, D_MODEL)
    """

    def __init__(self):
        super().__init__()
        self.num_experts = NUM_EXPERTS  # 8个专家
        self.top_k = TOP_K              # 每次选2个

        # 门控网络：决定每个token用哪些专家
        # 输入: D_MODEL, 输出: NUM_EXPERTS (每个专家的分数)
        self.gate = nn.Linear(D_MODEL, NUM_EXPERTS, bias=False)

        # 创建所有专家网络
        self.experts = nn.ModuleList([Expert() for _ in range(NUM_EXPERTS)])

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.shape

        # 1. 展平批次和序列维度，方便并行处理所有token
        # 形状: (B*T, D_MODEL)
        x_flat = x.view(-1, C)

        # 2. 门控网络计算每个token对所有专家的分数
        # gate_logits 形状: (B*T, NUM_EXPERTS)
        gate_logits = self.gate(x_flat)

        # 3. Softmax 得到概率分布，然后取 Top-K
        # weights: (B*T, TOP_K) - 选中专家的权重
        # selected_experts: (B*T, TOP_K) - 选中专家的索引
        weights, selected_experts = torch.topk(F.softmax(gate_logits, dim=-1), self.top_k, dim=-1)

        # 4. 归一化权重，使选中的 K 个专家权重和为1
        weights = weights / weights.sum(dim=-1, keepdim=True)

        # 5. 初始化输出
        output = torch.zeros_like(x_flat)

        # 6. 遍历每个专家，处理被选中它的token
        for i, expert in enumerate(self.experts):
            # 找出哪些token选择了当前专家
            # mask 形状: (B*T,)
            mask = (selected_experts == i).any(dim=-1)

            if mask.any():
                # 提取需要当前专家处理的token
                expert_input = x_flat[mask]  # (N_selected, D_MODEL)

                # 通过专家网络
                expert_out = expert(expert_input)  # (N_selected, D_MODEL)

                # 获取这些token对当前专家的权重
                # 形状: (N_selected, TOP_K, 1)
                expert_weights = weights[mask][selected_experts[mask] == i].view(-1, self.top_k, 1)
                # 对 K 个专家的权重求和（一个token可能被同一个专家选中多次，虽然概率低）
                expert_weights = expert_weights.sum(dim=1)

                # 加权累加到输出
                output[mask] += expert_weights * expert_out

        # 7. 恢复原始形状
        return output.view(B, T, C)


# ============================================================
# Transformer 块
# ============================================================

class TransformerBlock(nn.Module):
    """
    单个 Transformer 解码器块

    结构 (Pre-Norm):
    ----------------
    输入 -> RMSNorm -> 注意力 -> 残差连接 -> RMSNorm -> MoE -> 残差连接 -> 输出

    为什么用 Pre-Norm？
    ------------------
    Pre-Norm (先归一化再计算) 比 Post-Norm 更稳定，更容易训练深层网络。
    GPT-4 有48层，Pre-Norm 是必要的。

    残差连接 (Residual Connection):
    -----------------------------
    x = x + sublayer(norm(x))
    残差连接帮助梯度流动，使得训练超深网络成为可能。
    """

    def __init__(self):
        super().__init__()
        self.ln1 = RMSNorm(D_MODEL)   # 注意力前的归一化
        self.attn = CausalSelfAttention()
        self.ln2 = RMSNorm(D_MODEL)   # MoE前的归一化
        self.moe = MoELayer()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # 注意力子层 + 残差连接
        x = x + self.attn(self.ln1(x))
        # MoE子层 + 残差连接
        x = x + self.moe(self.ln2(x))
        return x


# ============================================================
# 完整的 GPT-4 模型
# ============================================================

class GPT4(nn.Module):
    """
    GPT-4 概念实现

    整体流程:
    ---------
    1. 词嵌入 (Token Embedding): 将整数token ID映射为向量
    2. N 个 Transformer 块: 逐层提取和转换特征
    3. 最终归一化
    4. 语言模型头 (LM Head): 将特征映射回词表维度，预测下一个token

    权重共享:
    ---------
    词嵌入层 (wte) 和输出层 (lm_head) 共享权重矩阵。
    这是 GPT 系列的传统，减少参数量并提升性能。
    """

    def __init__(self):
        super().__init__()
        # 词嵌入层: 将token ID (0~VOCAB_SIZE-1) 映射为 D_MODEL 维向量
        self.wte = nn.Embedding(VOCAB_SIZE, D_MODEL)

        # 堆叠 N_LAYERS 个 Transformer 块
        self.blocks = nn.ModuleList([TransformerBlock() for _ in range(N_LAYERS)])

        # 最终归一化
        self.ln_f = RMSNorm(D_MODEL)

        # 语言模型头: 将 D_MODEL 维特征映射到词表大小，得到每个token的预测分数
        self.lm_head = nn.Linear(D_MODEL, VOCAB_SIZE, bias=False)

        # 权重共享: 词嵌入和输出投影共享权重
        self.wte.weight = self.lm_head.weight

        # 初始化权重
        self.apply(self._init_weights)

    def _init_weights(self, module: nn.Module) -> None:
        """使用正态分布初始化权重，标准差0.02是GPT系列的标准。"""
        if isinstance(module, nn.Linear):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
        elif isinstance(module, nn.Embedding):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, idx: torch.Tensor) -> torch.Tensor:
        """
        前向传播

        参数:
            idx: 输入token序列，形状 (B, T)
                 B = batch size (批次大小)
                 T = sequence length (序列长度)

        返回:
            logits: 每个位置对每个词的预测分数，形状 (B, T, VOCAB_SIZE)
        """
        B, T = idx.size()

        # 1. 词嵌入: (B, T) -> (B, T, D_MODEL)
        x = self.wte(idx)

        # 2. 通过所有 Transformer 块
        for block in self.blocks:
            x = block(x)

        # 3. 最终归一化
        x = self.ln_f(x)

        # 4. 投影到词表维度: (B, T, D_MODEL) -> (B, T, VOCAB_SIZE)
        logits = self.lm_head(x)

        return logits


# ============================================================
# 主程序：教育演示
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("GPT-4 概念实现 - 教育演示")
    print("=" * 60)

    # 创建模型
    print("\n[1] 创建模型...")
    model = GPT4()

    # 创建虚拟输入: 1个样本，128个token
    print("[2] 创建虚拟输入...")
    dummy_input = torch.randint(0, VOCAB_SIZE, (1, 128))
    print(f"    输入形状: {dummy_input.shape}")
    print(f"    含义: 批次大小=1, 序列长度=128")

    # 前向传播
    print("[3] 执行前向传播...")
    output = model(dummy_input)
    print(f"    输出形状: {output.shape}")
    print(f"    含义: 批次大小=1, 序列长度=128, 词表大小={VOCAB_SIZE}")
    print(f"    即：每个位置预测下一个token的分数")

    # 计算参数量
    print("[4] 统计参数量...")
    total_params = sum(p.numel() for p in model.parameters())
    print(f"    总参数量: {total_params:,}")
    print(f"    约 {total_params / 1e9:.2f} B (十亿)")

    # 分析各组件参数量
    print("\n[5] 各组件参数量分析:")
    print(f"    词嵌入层: {model.wte.weight.numel():,}")
    print(f"    Transformer块数: {N_LAYERS}")

    # 单个块的参数量
    sample_block = model.blocks[0]
    block_params = sum(p.numel() for p in sample_block.parameters())
    print(f"    单个块参数量: {block_params:,}")
    print(f"    所有块总参数量: {block_params * N_LAYERS:,}")

    print("\n" + "=" * 60)
    print("练习建议 (Exercises):")
    print("=" * 60)
    print("1. 尝试修改 N_LAYERS 和 D_MODEL，观察参数量变化")
    print("2. 修改 NUM_EXPERTS 和 TOP_K，理解 MoE 的容量与计算权衡")
    print("3. 将模型改为普通 FFN (不用 MoE)，比较参数量差异")
    print("4. 尝试生成文本：用 softmax + 采样从 logits 中选取下一个 token")
    print("=" * 60)
