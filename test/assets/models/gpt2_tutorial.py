"""
Language Models are Unsupervised Multitask Learners
Alec Radford, Jeffrey Wu, Rewon Child, David Luan, Dario Amodei, Ilya Sutskever
OpenAI, 2019
https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf

初学者友好的 GPT-2 Small (124M) 教程实现。

什么是 GPT-2?
-------------
GPT-2 是一个自回归语言模型，给定一段文本序列，它会预测下一个 token 是什么。
它只使用了 Transformer 的 Decoder 部分（没有 Encoder），通过因果掩码（causal mask）
确保模型在预测当前位置时只能看到之前的 token，不能"偷看"未来信息。

关键概念:
- Token Embedding: 将离散的 token ID 映射为连续的向量
- Position Embedding: 给模型提供位置信息（因为自注意力本身不知道位置顺序）
- Pre-Norm: 在每个子层（Attention / FFN）之前做 LayerNorm，训练更稳定
- Causal Mask: 上三角掩码，确保自回归特性
- GELU: GPT-2 使用的激活函数，比 ReLU 更平滑
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import math


# ---------------------------------------------------------------------------
# 配置常量 — 每个常量都附带解释
# ---------------------------------------------------------------------------

N_LAYERS = 12          # Transformer Decoder 层的数量，层数越多模型表达能力越强
N_HEADS = 12           # 多头注意力中的"头"数，12 个头可以并行关注不同方面的信息
D_MODEL = 768          # 模型的隐藏维度，每个 token 被表示为 768 维向量
D_FF = 3072            # 前馈网络的中间维度，通常是 d_model 的 4 倍 (768 * 4 = 3072)
MAX_SEQ_LEN = 1024     # 模型能处理的最大序列长度（单位：token）
VOCAB_SIZE = 50257     # 词表大小，使用 Byte Pair Encoding (BPE) 分词后的词汇量
DROPOUT = 0.1          # Dropout 比率，防止过拟合，训练时随机丢弃 10% 的神经元


# ---------------------------------------------------------------------------
# 架构模块
# ---------------------------------------------------------------------------

class MultiHeadSelfAttention(nn.Module):
    """
    掩码多头自注意力 (Masked Multi-Head Self-Attention)

    自注意力机制让序列中的每个位置都能"看到"其他所有位置，并根据相关性加权聚合信息。
    "多头"意味着我们并行计算多组注意力，每组关注不同的特征子空间。
    "掩码"确保模型只能看到当前位置及之前的位置（因果性 / causal）。
    """

    def __init__(self, d_model: int, n_heads: int, dropout: float, max_seq_len: int):
        super().__init__()
        assert d_model % n_heads == 0, "d_model 必须能被 n_heads 整除"
        self.n_heads = n_heads
        self.d_head = d_model // n_heads  # 每个头处理的维度: 768 / 12 = 64
        self.d_model = d_model

        # c_attn: 合并的 Q/K/V 投影，输入 d_model，输出 3*d_model
        # 论文中将 Q、K、V 的权重矩阵合并为一个大的线性层，效率更高
        self.c_attn = nn.Linear(d_model, 3 * d_model)

        # c_proj: 注意力输出投影，将多头结果拼接后映射回 d_model
        self.c_proj = nn.Linear(d_model, d_model)

        self.attn_dropout = nn.Dropout(dropout)
        self.resid_dropout = nn.Dropout(dropout)

        # 注册因果掩码为 buffer（不会参与梯度更新）
        # shape: (1, 1, max_seq_len, max_seq_len)
        # 下三角为 1，上三角为 0，确保位置 i 只能 attend 到 j <= i
        self.register_buffer(
            "mask",
            torch.tril(torch.ones(max_seq_len, max_seq_len)).view(1, 1, max_seq_len, max_seq_len)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.size()  # B: batch size, T: 序列长度, C: d_model (768)

        # 1) 计算 Q, K, V
        # c_attn 输出 shape: (B, T, 3*C)，然后 split 成 3 个 (B, T, C)
        q, k, v = self.c_attn(x).split(self.d_model, dim=2)

        # 2) reshape 为多头格式: (B, T, n_heads, d_head) -> (B, n_heads, T, d_head)
        # 这样每个头独立计算注意力
        q = q.view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        k = k.view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        v = v.view(B, T, self.n_heads, self.d_head).transpose(1, 2)

        # 3) 计算注意力分数: Q @ K^T / sqrt(d_head)
        # shape: (B, n_heads, T, T)
        att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(self.d_head))

        # 4) 应用因果掩码: 上三角位置填充 -inf，softmax 后变为 0
        # 这样位置 i 无法获取位置 i+1, i+2, ... 的信息
        att = att.masked_fill(self.mask[:, :, :T, :T] == 0, float("-inf"))

        # 5) softmax 归一化，使每行之和为 1
        att = F.softmax(att, dim=-1)

        # 6) dropout，随机丢弃一些注意力权重，防止过拟合
        att = self.attn_dropout(att)

        # 7) 注意力输出: 加权求和 V
        # shape: (B, n_heads, T, d_head)
        y = att @ v

        # 8) 将多头结果拼接回 (B, T, C)
        y = y.transpose(1, 2).contiguous().view(B, T, C)

        # 9) 输出投影 + dropout
        y = self.c_proj(y)
        y = self.resid_dropout(y)
        return y


class FeedForward(nn.Module):
    """
    前馈神经网络 (Feed-Forward Network, FFN)

    在注意力层之后，每个位置独立地通过一个两层的全连接网络。
    第一层将维度从 d_model 扩展到 d_ff (768 -> 3072)，
    第二层再投影回 d_model (3072 -> 768)。
    中间使用 GELU 激活函数。
    """

    def __init__(self, d_model: int, d_ff: int, dropout: float):
        super().__init__()
        # c_fc: "fully connected"，升维
        self.c_fc = nn.Linear(d_model, d_ff)
        # c_proj: 投影回原始维度
        self.c_proj = nn.Linear(d_ff, d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.c_fc(x)      # (B, T, d_model) -> (B, T, d_ff)
        x = F.gelu(x)         # GELU 激活: 比 ReLU 更平滑，在 0 附近有过渡区域
        x = self.c_proj(x)    # (B, T, d_ff) -> (B, T, d_model)
        x = self.dropout(x)   # 随机丢弃一部分输出
        return x


class TransformerBlock(nn.Module):
    """
    Transformer Decoder 块

    GPT-2 使用 Pre-Norm 结构：LayerNorm 放在子层之前，而不是原始 Transformer 的 Post-Norm。
    这有助于缓解深层网络的梯度消失问题，训练更稳定。

    每个块包含:
    1. LayerNorm -> Masked Multi-Head Self-Attention -> Residual
    2. LayerNorm -> Feed-Forward Network -> Residual
    """

    def __init__(self, d_model: int, n_heads: int, d_ff: int, dropout: float, max_seq_len: int):
        super().__init__()
        self.ln_1 = nn.LayerNorm(d_model)  # Attention 前的 LayerNorm
        self.attn = MultiHeadSelfAttention(d_model, n_heads, dropout, max_seq_len)
        self.ln_2 = nn.LayerNorm(d_model)  # FFN 前的 LayerNorm
        self.mlp = FeedForward(d_model, d_ff, dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Pre-Norm: 先归一化，再通过子层，最后加残差连接
        x = x + self.attn(self.ln_1(x))  # 残差连接保留原始信息，防止梯度消失
        x = x + self.mlp(self.ln_2(x))   # FFN 子层同样使用残差连接
        return x


# ---------------------------------------------------------------------------
# 完整模型
# ---------------------------------------------------------------------------

class GPT2(nn.Module):
    """
    GPT-2 Small 完整模型

    前向流程:
    1. Token Embedding: 将输入的 token ID 转为向量
    2. Position Embedding: 加上位置信息
    3. Dropout
    4. 重复 N_LAYERS 次 TransformerBlock
    5. 最终 LayerNorm
    6. 语言模型头: Linear(d_model -> vocab_size)，输出每个位置对所有 token 的预测分数
    """

    def __init__(
        self,
        vocab_size: int = VOCAB_SIZE,
        max_seq_len: int = MAX_SEQ_LEN,
        n_layers: int = N_LAYERS,
        n_heads: int = N_HEADS,
        d_model: int = D_MODEL,
        d_ff: int = D_FF,
        dropout: float = DROPOUT,
    ):
        super().__init__()
        self.vocab_size = vocab_size
        self.max_seq_len = max_seq_len
        self.n_layers = n_layers
        self.n_heads = n_heads
        self.d_model = d_model
        self.d_ff = d_ff

        # wte: word token embedding，将 token ID 映射为 d_model 维向量
        self.wte = nn.Embedding(vocab_size, d_model)

        # wpe: word position embedding，将位置索引映射为 d_model 维向量
        self.wpe = nn.Embedding(max_seq_len, d_model)

        self.drop = nn.Dropout(dropout)

        # h: 堆叠的 Transformer Decoder 块
        self.h = nn.ModuleList([
            TransformerBlock(d_model, n_heads, d_ff, dropout, max_seq_len)
            for _ in range(n_layers)
        ])

        # 最终 LayerNorm
        self.ln_f = nn.LayerNorm(d_model)

        # 语言模型头: 将隐藏状态映射回词表维度，得到每个 token 的预测 logits
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)

        # 权重初始化: 使用均值为 0、标准差为 0.02 的正态分布
        self.apply(self._init_weights)

    def _init_weights(self, module):
        """初始化线性层和嵌入层的权重"""
        if isinstance(module, nn.Linear):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                torch.nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            torch.nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, idx: torch.Tensor) -> torch.Tensor:
        """
        参数:
            idx: 输入 token ID，shape (B, T)
        返回:
            logits: 每个位置对词表中所有 token 的预测分数，shape (B, T, vocab_size)
        """
        B, T = idx.size()
        assert T <= self.max_seq_len, f"序列长度 {T} 超过最大限制 {self.max_seq_len}"

        # 生成位置索引: [0, 1, 2, ..., T-1]，shape (1, T)
        pos = torch.arange(0, T, dtype=torch.long, device=idx.device).unsqueeze(0)

        # Token Embedding + Position Embedding
        tok_emb = self.wte(idx)    # (B, T) -> (B, T, d_model)
        pos_emb = self.wpe(pos)    # (1, T) -> (1, T, d_model)
        x = self.drop(tok_emb + pos_emb)  # 广播相加后 dropout

        # 依次通过所有 Transformer 块
        for block in self.h:
            x = block(x)

        # 最终 LayerNorm
        x = self.ln_f(x)

        # 投影到词表维度，得到 logits
        logits = self.lm_head(x)   # (B, T, d_model) -> (B, T, vocab_size)
        return logits


# ---------------------------------------------------------------------------
# 教育演示
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    model = GPT2()

    # 构造虚拟输入: batch_size=2, sequence_length=128
    dummy_input = torch.randint(0, VOCAB_SIZE, (2, 128))
    output = model(dummy_input)

    print(f"输入 shape:  {dummy_input.shape}")
    print(f"输出 shape: {output.shape}")
    print(f"解释: 对于输入的每个 token，模型输出对词表中每个 token 的预测分数")

    n_params = sum(p.numel() for p in model.parameters())
    print(f"总参数量: {n_params:,} (~{n_params / 1e6:.1f}M)")

    # -----------------------------------------------------------------------
    # 练习建议 (供读者尝试):
    # 1. 修改 MAX_SEQ_LEN 看看模型输出 shape 如何变化
    # 2. 将 N_LAYERS 改为 6，观察参数量变化
    # 3. 尝试将 GELU 换成 ReLU，对比输出差异
    # 4. 打印某一层注意力矩阵的 shape，理解 (B, n_heads, T, T) 的含义
    # 5. 去掉因果掩码，观察模型是否还能正确训练（提示：会导致信息泄露）
    # -----------------------------------------------------------------------
