"""
Attention Is All You Need
Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit,
Llion Jones, Aidan N. Gomez, Łukasz Kaiser, Illia Polosukhin
NeurIPS 2017
https://arxiv.org/abs/1706.03762

初学者友好的 Transformer (base) 教程实现。

什么是 Transformer?
-----------------
Transformer 是一种完全基于注意力机制（Attention）的序列到序列（Seq2Seq）模型，
彻底摒弃了之前 RNN/LSTM 中的循环结构，实现了极高的并行化训练效率。
它最初用于机器翻译任务（如英德翻译），但已成为现代 NLP、CV、语音等领域的基石架构。

核心创新概念:
1. 自注意力（Self-Attention）: 让序列中的每个位置都能直接"看到"所有其他位置，
   捕捉长距离依赖关系，而不需要像 RNN 那样逐步传递信息。
2. 多头注意力（Multi-Head Attention）: 将注意力机制并行执行多次，
   让模型同时关注不同子空间的信息（如语法、语义、指代等）。
3. 位置编码（Positional Encoding）: 由于模型没有循环或卷积来感知顺序，
   我们通过正弦/余弦函数将位置信息注入到输入嵌入中。
4. 残差连接 + LayerNorm: 帮助深层网络稳定训练，防止梯度消失。
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# 配置常量 (Transformer base, 论文 Table 3)
# ---------------------------------------------------------------------------
d_model = 512          # 模型隐藏维度: 每个词被映射到的向量维度
n_heads = 8            # 注意力头数: 多头注意力中并行的注意力头数量
d_ff = 2048            # 前馈网络中间层维度: 通常是 d_model 的 4 倍
n_encoder_layers = 6   # Encoder 层数: 论文中堆叠了 6 个相同的 EncoderLayer
n_decoder_layers = 6   # Decoder 层数: 同样堆叠 6 个 DecoderLayer
dropout = 0.1          # Dropout 比例: 防止过拟合，训练时随机丢弃 10% 的神经元
max_seq_len = 512      # 最大序列长度: 模型能处理的最长序列（含位置编码）
vocab_size = 37000     # 词汇表大小: WMT 英德数据集约 37000 个词


d_k = d_model // n_heads   # 每个注意力头的 key/query 维度: 512 / 8 = 64
d_v = d_model // n_heads   # 每个注意力头的 value 维度: 512 / 8 = 64


# ---------------------------------------------------------------------------
# 缩放点积注意力 (Scaled Dot-Product Attention)
# ---------------------------------------------------------------------------
class ScaledDotProductAttention(nn.Module):
    """
    注意力机制的核心计算单元。

    直观理解:
    想象你在读一句话，注意力机制就是计算"当前词"与"句子中每个词"的相关性，
    然后根据相关性加权求和，得到当前词的上下文表示。

    公式: Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V

    为什么要除以 sqrt(d_k)?
    当 d_k 很大时，QK^T 的点积值会变得非常大，导致 softmax 梯度极小，
    难以训练。除以 sqrt(d_k) 可以缩放数值范围，保持梯度稳定。
    """
    def __init__(self):
        super().__init__()

    def forward(self, Q, K, V, mask=None):
        # Q, K, V 形状: (batch_size, n_heads, seq_len, d_k) 或 (..., d_k)
        # 计算注意力分数: Q 与 K 的转置相乘
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)

        # 掩码操作 (mask): 在 Decoder 的自注意力中，需要防止看到未来的词
        # mask 为 0 的位置填充一个极小的负数，使 softmax 后接近 0
        if mask is not None:
            scores = scores.masked_fill(mask == 0, -1e9)

        # 对分数做 softmax，得到注意力权重 (每行之和为 1)
        attn = F.softmax(scores, dim=-1)

        # 用注意力权重对 V 加权求和，得到输出
        output = torch.matmul(attn, V)
        return output, attn


# ---------------------------------------------------------------------------
# 多头注意力 (Multi-Head Attention)
# ---------------------------------------------------------------------------
class MultiHeadAttention(nn.Module):
    """
    将注意力机制"复制" n_heads 次，每个头独立学习不同的注意力模式。

    直观理解:
    就像多人同时阅读一篇文章，有人关注语法结构，有人关注情感色彩，
    有人关注实体指代。多头机制让模型同时从多个角度理解输入。

    步骤:
    1. 用线性层将输入映射到 Q, K, V
    2. 将 Q, K, V 拆分成 n_heads 份
    3. 对每个头独立计算缩放点积注意力
    4. 将所有头的输出拼接起来
    5. 用线性层投影回 d_model 维度
    6. Dropout + 残差连接 + LayerNorm
    """
    def __init__(self):
        super().__init__()
        # 四个线性投影层: Q, K, V 的输入投影 + 输出投影
        self.W_Q = nn.Linear(d_model, n_heads * d_k)   # 将输入映射到 Q
        self.W_K = nn.Linear(d_model, n_heads * d_k)   # 将输入映射到 K
        self.W_V = nn.Linear(d_model, n_heads * d_v)   # 将输入映射到 V
        self.W_O = nn.Linear(n_heads * d_v, d_model)   # 将多头输出拼接后投影回 d_model

        self.attention = ScaledDotProductAttention()
        self.dropout = nn.Dropout(dropout)
        # LayerNorm: 对最后一个维度 (d_model) 做归一化，eps 防止除零
        self.layer_norm = nn.LayerNorm(d_model, eps=1e-6)

    def forward(self, query, key, value, mask=None):
        batch_size = query.size(0)
        len_q = query.size(1)    # query 序列长度
        len_k = key.size(1)      # key 序列长度
        len_v = value.size(1)    # value 序列长度

        # 1. 线性投影并 reshape 为多头格式
        # 形状变化: (batch, seq_len, d_model) -> (batch, seq_len, n_heads, d_k) -> (batch, n_heads, seq_len, d_k)
        Q = self.W_Q(query).view(batch_size, len_q, n_heads, d_k).transpose(1, 2)
        K = self.W_K(key).view(batch_size, len_k, n_heads, d_k).transpose(1, 2)
        V = self.W_V(value).view(batch_size, len_v, n_heads, d_v).transpose(1, 2)

        # 2. 计算缩放点积注意力
        # context 形状: (batch, n_heads, seq_len, d_v)
        context, attn = self.attention(Q, K, V, mask=mask)

        # 3. 拼接多头输出
        # 形状变化: (batch, n_heads, seq_len, d_v) -> (batch, seq_len, n_heads * d_v)
        context = context.transpose(1, 2).contiguous().view(batch_size, len_q, n_heads * d_v)

        # 4. 输出投影
        output = self.W_O(context)

        # 5. Dropout + 残差连接 + LayerNorm
        # 残差连接: 将输入直接加到输出上，帮助梯度流动，缓解梯度消失
        output = self.dropout(output)
        output = self.layer_norm(output + query)
        return output, attn


# ---------------------------------------------------------------------------
# 逐位置前馈网络 (Position-wise Feed-Forward Network)
# ---------------------------------------------------------------------------
class PositionwiseFeedForward(nn.Module):
    """
    对每个位置独立应用相同的前馈网络。

    结构: Linear(d_model -> d_ff) -> ReLU -> Dropout -> Linear(d_ff -> d_model)

    直观理解:
    注意力层负责"全局交互"（词与词之间的关系），
    前馈层负责"局部变换"（对每个位置的向量做非线性变换，增加模型表达能力）。

    注意: "Position-wise" 意味着同一个前馈网络独立作用于序列中的每个位置，
    位置之间不共享信息（不像卷积有局部感受野）。
    """
    def __init__(self):
        super().__init__()
        self.w_1 = nn.Linear(d_model, d_ff)   # 扩展维度: 512 -> 2048
        self.w_2 = nn.Linear(d_ff, d_model)   # 压缩维度: 2048 -> 512
        self.dropout = nn.Dropout(dropout)
        self.layer_norm = nn.LayerNorm(d_model, eps=1e-6)

    def forward(self, x):
        residual = x
        x = self.w_1(x)          # 第一次线性变换
        x = F.relu(x)            # ReLU 激活: 引入非线性
        x = self.dropout(x)      # Dropout 正则化
        x = self.w_2(x)          # 第二次线性变换
        x = self.dropout(x)      # 再次 Dropout
        x = self.layer_norm(x + residual)   # 残差连接 + LayerNorm
        return x


# ---------------------------------------------------------------------------
# 位置编码 (Positional Encoding)
# ---------------------------------------------------------------------------
class PositionalEncoding(nn.Module):
    """
    使用正弦和余弦函数为每个位置生成唯一的编码向量。

    为什么需要位置编码?
    Transformer 没有循环或卷积结构，如果不加位置信息，
    模型会把 "我爱你" 和 "你爱我" 视为完全相同的输入（只是词的排列）。
    位置编码让模型感知到词在序列中的绝对位置和相对位置。

    公式 (论文 Eq. 2):
    PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
    PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))

    优点:
    1. 可以处理任意长度的序列（超过训练时的 max_seq_len 也可以外推）
    2. 相对位置可以通过线性变换得到 (sin(a+b) = sin(a)cos(b)+cos(a)sin(b))
    3. 值域在 [-1, 1] 之间，与词嵌入的尺度匹配
    """
    def __init__(self):
        super().__init__()
        # 预计算位置编码矩阵，形状: (1, max_seq_len, d_model)
        pe = torch.zeros(max_seq_len, d_model)

        # position: (max_seq_len, 1), 表示每个位置的索引
        position = torch.arange(0, max_seq_len, dtype=torch.float).unsqueeze(1)

        # div_term: 不同维度使用不同的频率，形成从低频到高频的波长
        # 使用指数形式避免逐元素幂运算
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )

        # 偶数维度用 sin，奇数维度用 cos
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)

        # 增加 batch 维度，形状变为 (1, max_seq_len, d_model)
        pe = pe.unsqueeze(0)

        # 注册为 buffer（不是模型参数，不需要梯度更新）
        self.register_buffer('pe', pe)

    def forward(self, x):
        # 将位置编码加到输入上
        # x 形状: (batch_size, seq_len, d_model)
        # pe 形状: (1, max_seq_len, d_model)
        return x + self.pe[:, :x.size(1), :]


# ---------------------------------------------------------------------------
# Encoder 层
# ---------------------------------------------------------------------------
class EncoderLayer(nn.Module):
    """
    单个 Encoder 层，由两个子层组成:
    1. 多头自注意力 (Multi-Head Self-Attention)
    2. 逐位置前馈网络 (Position-wise Feed-Forward Network)

    每个子层都有残差连接和 LayerNorm。

    在 Encoder 中，自注意力的 Q, K, V 都来自同一个输入序列，
    因此每个位置都能"看到"输入序列中的所有位置（双向注意力）。
    """
    def __init__(self):
        super().__init__()
        self.self_attn = MultiHeadAttention()
        self.pos_ffn = PositionwiseFeedForward()

    def forward(self, enc_input, self_attn_mask=None):
        # 自注意力: Q=K=V=enc_input
        enc_output, enc_self_attn = self.self_attn(
            enc_input, enc_input, enc_input, mask=self_attn_mask
        )
        # 前馈网络
        enc_output = self.pos_ffn(enc_output)
        return enc_output, enc_self_attn


# ---------------------------------------------------------------------------
# Decoder 层
# ---------------------------------------------------------------------------
class DecoderLayer(nn.Module):
    """
    单个 Decoder 层，由三个子层组成:
    1. 带掩码的多头自注意力 (Masked Multi-Head Self-Attention)
    2. 多头编码器-解码器注意力 (Multi-Head Encoder-Decoder Attention)
    3. 逐位置前馈网络 (Position-wise Feed-Forward Network)

    掩码自注意力的作用:
    在训练时，Decoder 需要预测下一个词，因此不能"偷看"未来的词。
    通过上三角掩码矩阵（future positions 设为 0），确保位置 i 只能关注到位置 <= i。

    编码器-解码器注意力的作用:
    Decoder 通过这一层"查询" Encoder 的输出，决定应该关注源序列的哪些部分来生成当前词。
    这类似于传统 Seq2Seq 中的注意力机制。
    """
    def __init__(self):
        super().__init__()
        self.self_attn = MultiHeadAttention()      # 掩码自注意力
        self.enc_attn = MultiHeadAttention()       # 编码器-解码器交叉注意力
        self.pos_ffn = PositionwiseFeedForward()   # 前馈网络

    def forward(self, dec_input, enc_output, self_attn_mask=None, dec_enc_attn_mask=None):
        # 1. 掩码自注意力: Q=K=V=dec_input，使用上三角掩码防止看到未来词
        dec_output, dec_self_attn = self.self_attn(
            dec_input, dec_input, dec_input, mask=self_attn_mask
        )

        # 2. 交叉注意力: Q=dec_output, K=V=enc_output
        # Decoder 查询 Encoder 的输出，获取源语言信息
        dec_output, dec_enc_attn = self.enc_attn(
            dec_output, enc_output, enc_output, mask=dec_enc_attn_mask
        )

        # 3. 前馈网络
        dec_output = self.pos_ffn(dec_output)
        return dec_output, dec_self_attn, dec_enc_attn


# ---------------------------------------------------------------------------
# Encoder (编码器)
# ---------------------------------------------------------------------------
class Encoder(nn.Module):
    """
    Transformer 编码器，由 N=6 个相同的 EncoderLayer 堆叠而成。

    前向流程:
    1. 词嵌入: 将输入词索引映射为 d_model 维向量
    2. 位置编码: 加入位置信息
    3. Dropout: 正则化
    4. 6 层 EncoderLayer: 逐层提取特征
    5. 最终 LayerNorm: 稳定输出分布

    输出: 与输入等长的上下文表示序列，每个位置都编码了整个输入序列的信息。
    """
    def __init__(self):
        super().__init__()
        # 词嵌入层: 将词汇表中的词索引映射为 d_model 维的密集向量
        self.src_word_emb = nn.Embedding(vocab_size, d_model)
        self.pos_encoding = PositionalEncoding()
        self.dropout = nn.Dropout(dropout)
        # 堆叠 6 个 EncoderLayer
        self.layers = nn.ModuleList([EncoderLayer() for _ in range(n_encoder_layers)])
        self.layer_norm = nn.LayerNorm(d_model, eps=1e-6)

    def forward(self, src_seq, src_mask=None):
        # src_seq 形状: (batch_size, src_seq_len)
        enc_output = self.src_word_emb(src_seq)       # (batch, src_len, d_model)
        enc_output = self.pos_encoding(enc_output)    # 加入位置信息
        enc_output = self.dropout(enc_output)         # 正则化

        for layer in self.layers:
            enc_output, _ = layer(enc_output, self_attn_mask=src_mask)

        enc_output = self.layer_norm(enc_output)
        return enc_output


# ---------------------------------------------------------------------------
# Decoder (解码器)
# ---------------------------------------------------------------------------
class Decoder(nn.Module):
    """
    Transformer 解码器，由 N=6 个相同的 DecoderLayer 堆叠而成。

    前向流程:
    1. 词嵌入: 将目标词索引映射为 d_model 维向量
    2. 位置编码: 加入位置信息
    3. Dropout: 正则化
    4. 6 层 DecoderLayer: 逐层生成表示
       - 每层先做掩码自注意力（只看已生成的词）
       - 再做交叉注意力（查询 Encoder 输出）
       - 最后前馈网络
    5. 最终 LayerNorm

    输出: 目标序列的上下文表示，用于最终投影到词汇表概率分布。
    """
    def __init__(self):
        super().__init__()
        self.tgt_word_emb = nn.Embedding(vocab_size, d_model)
        self.pos_encoding = PositionalEncoding()
        self.dropout = nn.Dropout(dropout)
        self.layers = nn.ModuleList([DecoderLayer() for _ in range(n_decoder_layers)])
        self.layer_norm = nn.LayerNorm(d_model, eps=1e-6)

    def forward(self, tgt_seq, enc_output, tgt_mask=None, src_mask=None):
        # tgt_seq 形状: (batch_size, tgt_seq_len)
        dec_output = self.tgt_word_emb(tgt_seq)       # (batch, tgt_len, d_model)
        dec_output = self.pos_encoding(dec_output)    # 加入位置信息
        dec_output = self.dropout(dec_output)         # 正则化

        for layer in self.layers:
            dec_output, _, _ = layer(
                dec_output, enc_output,
                self_attn_mask=tgt_mask,
                dec_enc_attn_mask=src_mask
            )

        dec_output = self.layer_norm(dec_output)
        return dec_output


# ---------------------------------------------------------------------------
# 完整 Transformer 模型
# ---------------------------------------------------------------------------
class Transformer(nn.Module):
    """
    完整的 Transformer 序列到序列模型。

    结构:
    Encoder -> Decoder -> Linear Projection -> Softmax (在训练时通常在外部计算)

    输入:
    - src_seq: 源语言序列，形状 (batch_size, src_seq_len)
    - tgt_seq: 目标语言序列（右移一位，用于教师强制训练），形状 (batch_size, tgt_seq_len)

    输出:
    - seq_logit: 未归一化的词汇表分数，形状 (batch_size, tgt_seq_len, vocab_size)
      外部通常接 CrossEntropyLoss 计算损失。

    推理时 (Inference):
    与训练不同，推理时 tgt_seq 是逐步生成的:
    1. 先输入 <bos> (开始标记)
    2. 模型预测第一个词
    3. 将预测的词拼接到输入，预测第二个词
    4. 重复直到预测出 <eos> (结束标记) 或达到最大长度
    """
    def __init__(self):
        super().__init__()
        self.encoder = Encoder()
        self.decoder = Decoder()
        # 输出投影层: 将 d_model 维的解码器输出映射到词汇表大小
        # bias=False 是因为论文中使用了权重共享（embedding 和 projection 共享权重）
        self.projection = nn.Linear(d_model, vocab_size, bias=False)

    def forward(self, src_seq, tgt_seq, src_mask=None, tgt_mask=None):
        # 编码源序列
        enc_output = self.encoder(src_seq, src_mask=src_mask)

        # 解码目标序列（使用编码器输出作为交叉注意力的 K, V）
        dec_output = self.decoder(
            tgt_seq, enc_output,
            tgt_mask=tgt_mask,
            src_mask=src_mask
        )

        # 投影到词汇表维度
        seq_logit = self.projection(dec_output)
        return seq_logit


# ---------------------------------------------------------------------------
# 教育演示 (Educational Demo)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # 创建模型实例
    model = Transformer()

    # 构造虚拟输入数据
    # batch_size = 2, src_seq_len = 10, tgt_seq_len = 12
    src = torch.randint(0, vocab_size, (2, 10))   # 源语言序列
    tgt = torch.randint(0, vocab_size, (2, 12))   # 目标语言序列

    # 前向传播
    out = model(src, tgt)

    print("=" * 60)
    print("Transformer 基础演示")
    print("=" * 60)
    print(f"输入源序列形状 (src):  {src.shape}")
    print(f"输入目标序列形状 (tgt): {tgt.shape}")
    print(f"模型输出形状 (out):     {out.shape}")
    print(f"  -> 解释: (batch_size={out.size(0)}, tgt_seq_len={out.size(1)}, vocab_size={out.size(2)})")
    print(f"  -> 每个时间步输出 vocab_size 个分数，表示下一个词的概率分布")

    total_params = sum(p.numel() for p in model.parameters())
    print(f"\n模型总参数量: {total_params:,}")
    print(f"  -> 论文报告 base 模型约 65M 参数")
    print(f"  -> 当前模型参数量差异主要来自词汇表大小和实现细节")

    print("\n" + "=" * 60)
    print("课后练习 (尝试修改以下部分来加深理解):")
    print("=" * 60)
    print("1. 将 n_heads 改为 1，观察模型行为变化（单头 vs 多头）")
    print("2. 将 n_encoder_layers 改为 2，观察参数量和输出质量变化")
    print("3. 修改 PositionalEncoding 中的 math.log(10000.0)，观察不同频率的影响")
    print("4. 尝试构造一个 tgt_mask（上三角矩阵），验证 Decoder 的掩码机制")
    print("5. 将 F.relu 替换为 F.gelu，观察现代 Transformer 变体的差异")
