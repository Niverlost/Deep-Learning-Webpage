"""
BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding
Jacob Devlin, Ming-Wei Chang, Kenton Lee, Kristina Toutanova
ACL 2019 (arXiv:1810.04805)
https://arxiv.org/abs/1810.04805

初学者友好的 BERT-Base 教程实现。

什么是 BERT?
----------
BERT (Bidirectional Encoder Representations from Transformers) 是一种基于 Transformer Encoder
的深度双向语言表示模型。它通过在大规模无标注文本上进行预训练，学习到丰富的语言知识，
然后只需增加一个简单的输出层即可微调（fine-tune）到各种下游 NLP 任务上。

核心创新概念:
1. 双向上下文 (Bidirectional Context): 与 GPT 等单向模型不同，BERT 在每一层都同时利用
   左侧和右侧的上下文信息，通过 Masked Language Model (MLM) 实现真正的深度双向表示。
2. 预训练 + 微调范式 (Pre-training + Fine-tuning): 先在大量无标注数据上预训练通用语言表示，
   再用少量标注数据微调具体任务，极大减少了对任务特定架构的依赖。
3. [CLS] 与 [SEP] 特殊标记: [CLS] 用于分类任务，其最终隐藏状态作为整个序列的聚合表示；
   [SEP] 用于分隔句子对（如问答中的问题和答案）。
4. 三种嵌入相加: Token Embeddings + Position Embeddings + Segment Embeddings，
   让模型同时感知词义、位置和句子归属。
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# 配置常量 (BERT-Base, 论文 Section 3 + Appendix A.2)
# ---------------------------------------------------------------------------
L = 12              # Transformer Encoder 层数: 论文中堆叠了 12 层
H = 768             # 隐藏层维度: 每个 token 被映射到的向量维度
A = 12              # 注意力头数: 多头注意力中并行的注意力头数量
d_ff = 3072         # 前馈网络中间层维度: 4 * H，论文明确说明为 4H
max_seq_len = 512   # 最大序列长度: 模型能处理的最长序列
vocab_size = 30522  # 词汇表大小: WordPiece 分词后的词汇量
dropout = 0.1       # Dropout 比例: 防止过拟合，训练时随机丢弃 10%


d_k = H // A        # 每个注意力头的 key/query 维度: 768 / 12 = 64
d_v = H // A        # 每个注意力头的 value 维度: 768 / 12 = 64


# ---------------------------------------------------------------------------
# BERT 嵌入层 (BERT Embeddings)
# ---------------------------------------------------------------------------
class BertEmbeddings(nn.Module):
    """
    BERT 的输入嵌入层，由三种嵌入相加而成。

    直观理解:
    想象你在读一篇双语文章，你需要知道:
    1. 每个词是什么意思 (word_embeddings)
    2. 这个词在句子中的第几个位置 (position_embeddings)
    3. 这个词属于第一句还是第二句 (token_type_embeddings)

    结构:
    Token Embeddings (词嵌入) + Position Embeddings (位置嵌入) + Segment Embeddings (句子嵌入)
    -> LayerNorm -> Dropout

    注意:
    - BERT 使用可学习的位置嵌入 (nn.Embedding)，而非 Transformer 中的正弦/余弦位置编码。
      这是因为 BERT 的输入长度固定为 max_seq_len，可学习嵌入更简单直接。
    - token_type_embeddings 只有 2 个类别 (0 和 1)，分别表示句子 A 和句子 B。
    """
    def __init__(self):
        super().__init__()
        # 词嵌入: 将词汇表索引映射为 H 维向量
        self.word_embeddings = nn.Embedding(vocab_size, H)
        # 位置嵌入: 为每个位置 (0 ~ max_seq_len-1) 学习一个 H 维向量
        self.position_embeddings = nn.Embedding(max_seq_len, H)
        # 句子嵌入: 区分句子 A (0) 和句子 B (1)
        self.token_type_embeddings = nn.Embedding(2, H)
        # LayerNorm: 对最后一个维度 (H) 做归一化，eps=1e-12 是 BERT 原始实现中的值
        self.layer_norm = nn.LayerNorm(H, eps=1e-12)
        self.dropout = nn.Dropout(dropout)

    def forward(self, input_ids, token_type_ids=None):
        # input_ids 形状: (batch_size, seq_len)
        seq_len = input_ids.size(1)

        # 生成位置索引: [0, 1, 2, ..., seq_len-1]，形状 (1, seq_len)
        pos_ids = torch.arange(seq_len, dtype=torch.long, device=input_ids.device).unsqueeze(0)

        # 如果没有提供 token_type_ids，默认全为 0（单句任务）
        if token_type_ids is None:
            token_type_ids = torch.zeros_like(input_ids)

        # 三种嵌入分别查找
        w = self.word_embeddings(input_ids)           # (batch, seq_len, H)
        p = self.position_embeddings(pos_ids)         # (1, seq_len, H)
        t = self.token_type_embeddings(token_type_ids)  # (batch, seq_len, H)

        # 将三种嵌入相加，得到最终输入表示
        embeddings = w + p + t

        # LayerNorm + Dropout
        embeddings = self.layer_norm(embeddings)
        embeddings = self.dropout(embeddings)
        return embeddings


# ---------------------------------------------------------------------------
# BERT 自注意力 (BERT Self-Attention)
# ---------------------------------------------------------------------------
class BertSelfAttention(nn.Module):
    """
    BERT 中的多头自注意力机制。

    直观理解:
    自注意力让序列中的每个 token 都能"看到"所有其他 token，并根据相关性加权组合信息。
    因为是双向的（没有掩码限制），所以 [CLS] 能看到整句话，每个词也能看到左右两边的上下文。

    与原始 Transformer 的区别:
    - BERT 使用可学习的位置嵌入，而非正弦/余弦编码。
    - BERT 是 Encoder，自注意力没有掩码（所有位置互相可见）。
    """
    def __init__(self):
        super().__init__()
        # Q, K, V 的线性投影层: 将 H 维输入映射到 H 维输出
        # 注意: BERT 原始实现中，Q/K/V/O 的权重是独立的（没有共享）
        self.W_Q = nn.Linear(H, H)   # 将输入映射到 Query
        self.W_K = nn.Linear(H, H)   # 将输入映射到 Key
        self.W_V = nn.Linear(H, H)   # 将输入映射到 Value
        self.W_O = nn.Linear(H, H)   # 将多头输出拼接后投影回 H 维
        self.dropout = nn.Dropout(dropout)

    def forward(self, hidden_states, attention_mask=None):
        # hidden_states 形状: (batch_size, seq_len, H)
        batch_size = hidden_states.size(0)
        seq_len = hidden_states.size(1)

        # 1. 线性投影并 reshape 为多头格式
        # 形状变化: (batch, seq_len, H) -> (batch, seq_len, A, d_k) -> (batch, A, seq_len, d_k)
        Q = self.W_Q(hidden_states).view(batch_size, seq_len, A, d_k).transpose(1, 2)
        K = self.W_K(hidden_states).view(batch_size, seq_len, A, d_k).transpose(1, 2)
        V = self.W_V(hidden_states).view(batch_size, seq_len, A, d_v).transpose(1, 2)

        # 2. 计算缩放点积注意力分数
        # scores 形状: (batch, A, seq_len, seq_len)
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)

        # 3. 应用 attention_mask（padding mask）
        # 在 BERT 中，attention_mask 用于屏蔽 padding 位置（使其不影响 softmax）
        # mask 值为 -10000 的位置在 softmax 后会趋近于 0
        if attention_mask is not None:
            scores = scores + attention_mask

        # 4. Softmax 得到注意力权重
        attn = F.softmax(scores, dim=-1)
        attn = self.dropout(attn)

        # 5. 用注意力权重对 V 加权求和
        context = torch.matmul(attn, V)   # (batch, A, seq_len, d_v)

        # 6. 拼接多头输出并投影
        context = context.transpose(1, 2).contiguous().view(batch_size, seq_len, H)
        output = self.W_O(context)
        output = self.dropout(output)
        return output


# ---------------------------------------------------------------------------
# BERT 自注意力输出层 (BERT Self-Output)
# ---------------------------------------------------------------------------
class BertSelfOutput(nn.Module):
    """
    自注意力子层的输出处理: Dense -> Dropout -> 残差连接 -> LayerNorm

    为什么残差连接在前馈之后?
    BERT 原始实现中，残差连接是在 dense + dropout 之后、LayerNorm 之前进行的。
    这与原始 Transformer (LayerNorm 在子层之前，即 Pre-LN) 不同，
    BERT 使用的是 Post-LN: 子层 -> 残差 -> LayerNorm。
    """
    def __init__(self):
        super().__init__()
        self.dense = nn.Linear(H, H)
        self.layer_norm = nn.LayerNorm(H, eps=1e-12)
        self.dropout = nn.Dropout(dropout)

    def forward(self, hidden_states, input_tensor):
        # hidden_states: 自注意力的输出
        # input_tensor: 自注意力之前的输入（用于残差连接）
        hidden_states = self.dense(hidden_states)
        hidden_states = self.dropout(hidden_states)
        hidden_states = self.layer_norm(hidden_states + input_tensor)   # 残差连接 + LayerNorm
        return hidden_states


# ---------------------------------------------------------------------------
# BERT 注意力模块 (BERT Attention)
# ---------------------------------------------------------------------------
class BertAttention(nn.Module):
    """
    完整的注意力子层: Self-Attention + Self-Output (含残差和 LayerNorm)

    结构:
    hidden_states -> BertSelfAttention -> BertSelfOutput -> attention_output
                          |                       ^
                          |_______________________|
                               (残差连接)
    """
    def __init__(self):
        super().__init__()
        self.self = BertSelfAttention()
        self.output = BertSelfOutput()

    def forward(self, hidden_states, attention_mask=None):
        self_outputs = self.self(hidden_states, attention_mask)
        attention_output = self.output(self_outputs, hidden_states)
        return attention_output


# ---------------------------------------------------------------------------
# BERT 中间层 (BERT Intermediate)
# ---------------------------------------------------------------------------
class BertIntermediate(nn.Module):
    """
    前馈网络的扩展部分: Linear(H -> d_ff) + GELU 激活

    直观理解:
    注意力层负责"全局交互"（token 之间的关系），
    前馈层负责"局部变换"（对每个位置的向量做非线性变换，增加模型表达能力）。

    注意:
    - BERT 使用 GELU 激活函数，而非原始 Transformer 的 ReLU。
      GELU 更平滑，在深层网络中表现更好，已成为现代 Transformer 的标准选择。
    - d_ff = 3072 = 4 * H，这是 Transformer 论文中的标准设置。
    """
    def __init__(self):
        super().__init__()
        self.dense = nn.Linear(H, d_ff)   # 扩展维度: 768 -> 3072

    def forward(self, hidden_states):
        hidden_states = self.dense(hidden_states)
        hidden_states = F.gelu(hidden_states)   # GELU 激活
        return hidden_states


# ---------------------------------------------------------------------------
# BERT 输出层 (BERT Output)
# ---------------------------------------------------------------------------
class BertOutput(nn.Module):
    """
    前馈网络的压缩部分: Linear(d_ff -> H) -> Dropout -> 残差连接 -> LayerNorm

    结构:
    intermediate_output -> dense -> dropout -> + attention_output -> layer_norm
                                               ^
                                               | (残差连接)
    """
    def __init__(self):
        super().__init__()
        self.dense = nn.Linear(d_ff, H)   # 压缩维度: 3072 -> 768
        self.layer_norm = nn.LayerNorm(H, eps=1e-12)
        self.dropout = nn.Dropout(dropout)

    def forward(self, hidden_states, input_tensor):
        # input_tensor 是 attention_output，用于残差连接
        hidden_states = self.dense(hidden_states)
        hidden_states = self.dropout(hidden_states)
        hidden_states = self.layer_norm(hidden_states + input_tensor)
        return hidden_states


# ---------------------------------------------------------------------------
# BERT 编码器层 (BERT Layer)
# ---------------------------------------------------------------------------
class BertLayer(nn.Module):
    """
    单个 BERT Encoder 层，由两个子层组成:
    1. 多头自注意力 (Multi-Head Self-Attention)
    2. 逐位置前馈网络 (Position-wise Feed-Forward Network)

    每个子层都有残差连接和 LayerNorm（Post-LN 结构）。

    前向流程:
    hidden_states -> Attention -> attention_output -> Intermediate -> output
         |__________________________^                    |____________^
              (残差连接 1)                                (残差连接 2)
    """
    def __init__(self):
        super().__init__()
        self.attention = BertAttention()
        self.intermediate = BertIntermediate()
        self.output = BertOutput()

    def forward(self, hidden_states, attention_mask=None):
        # 1. 自注意力子层
        attention_output = self.attention(hidden_states, attention_mask)

        # 2. 前馈子层
        intermediate_output = self.intermediate(attention_output)
        layer_output = self.output(intermediate_output, attention_output)
        return layer_output


# ---------------------------------------------------------------------------
# BERT 编码器 (BERT Encoder)
# ---------------------------------------------------------------------------
class BertEncoder(nn.Module):
    """
    BERT 编码器，由 L=12 个相同的 BertLayer 堆叠而成。

    为什么堆叠 12 层?
    深层网络可以逐层提取更抽象的特征:
    - 底层 (1-3 层): 主要学习词法信息（词性、分词等）
    - 中层 (4-9 层): 主要学习句法信息（依存关系、短语结构等）
    - 高层 (10-12 层): 主要学习语义信息（指代消解、语义角色等）

    输出: 与输入等长的上下文表示序列，每个位置都编码了整个输入序列的深层双向信息。
    """
    def __init__(self):
        super().__init__()
        # 堆叠 12 个 BertLayer
        self.layer = nn.ModuleList([BertLayer() for _ in range(L)])

    def forward(self, hidden_states, attention_mask=None):
        for layer_module in self.layer:
            hidden_states = layer_module(hidden_states, attention_mask)
        return hidden_states


# ---------------------------------------------------------------------------
# BERT Pooler
# ---------------------------------------------------------------------------
class BertPooler(nn.Module):
    """
    Pooler 层: 提取 [CLS] token 的表示用于分类任务。

    直观理解:
    [CLS] 是加在每个输入序列开头的特殊标记（Classification）。
    在预训练时，[CLS] 的表示被用于 Next Sentence Prediction (NSP) 任务。
    在微调时，[CLS] 的表示通常作为整个序列的聚合表示，输入到分类器中。

    结构: 取第一个 token ([CLS]) -> Linear(H -> H) -> Tanh

    注意: Pooler 只在微调分类任务时使用，token-level 任务（如 NER、QA）
          通常使用 encoder_output 的每个位置，而不是 pooled_output。
    """
    def __init__(self):
        super().__init__()
        self.dense = nn.Linear(H, H)
        self.activation = nn.Tanh()

    def forward(self, hidden_states):
        # 取第一个 token ([CLS]) 的隐藏状态
        first_token_tensor = hidden_states[:, 0]   # (batch_size, H)
        pooled_output = self.dense(first_token_tensor)
        pooled_output = self.activation(pooled_output)
        return pooled_output


# ---------------------------------------------------------------------------
# 完整 BERT 模型 (BertModel)
# ---------------------------------------------------------------------------
class BertModel(nn.Module):
    """
    完整的 BERT-Base 模型。

    结构:
    Input -> Embeddings -> Encoder (x12) -> Pooler
                |                              |
                v                              v        sequence_output (batch, seq_len, H)
                                       pooled_output (batch, H)

    输入:
    - input_ids: token 索引，形状 (batch_size, seq_len)
    - token_type_ids: 句子 A/B 标识，形状 (batch_size, seq_len)，单句任务可为 None
    - attention_mask: padding 掩码，形状 (batch_size, seq_len)，1 表示有效 token，0 表示 padding

    输出:
    - sequence_output: 每个 token 的隐藏表示，形状 (batch_size, seq_len, H)
                       用于 token-level 任务（NER、问答等）。
    - pooled_output: [CLS] token 的聚合表示，形状 (batch_size, H)
                     用于句子-level 任务（分类、推理等）。

    注意: 本实现只包含模型架构，不包含预训练任务（MLM、NSP）和微调分类头。
    """
    def __init__(self):
        super().__init__()
        self.embeddings = BertEmbeddings()
        self.encoder = BertEncoder()
        self.pooler = BertPooler()

    def forward(self, input_ids, token_type_ids=None, attention_mask=None):
        # 处理 attention_mask: 将 (batch, seq_len) 扩展为 (batch, 1, 1, seq_len)
        # 并转换为 additive mask: 有效位置为 0，padding 位置为 -10000
        if attention_mask is not None:
            attention_mask = attention_mask.unsqueeze(1).unsqueeze(2)
            attention_mask = (1.0 - attention_mask) * -10000.0

        # 1. 嵌入层: Token + Position + Segment
        embedding_output = self.embeddings(input_ids, token_type_ids)
        # 形状: (batch_size, seq_len, H)

        # 2. 编码器: 12 层 Transformer Encoder
        encoder_output = self.encoder(embedding_output, attention_mask)
        # 形状: (batch_size, seq_len, H)

        # 3. Pooler: 提取 [CLS] 表示
        pooled_output = self.pooler(encoder_output)
        # 形状: (batch_size, H)

        return encoder_output, pooled_output


# ---------------------------------------------------------------------------
# 教育演示 (Educational Demo)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # 创建模型实例
    model = BertModel()

    # 构造虚拟输入数据
    # batch_size = 2, seq_len = 32
    input_ids = torch.randint(0, vocab_size, (2, 32))       # 随机 token 索引
    token_type_ids = torch.zeros_like(input_ids)            # 单句任务，全为 0
    attention_mask = torch.ones_like(input_ids)             # 无 padding，全为 1

    # 前向传播
    seq_output, pooled_output = model(input_ids, token_type_ids, attention_mask)

    print("=" * 60)
    print("BERT-Base 基础演示")
    print("=" * 60)
    print(f"输入 token IDs 形状:    {input_ids.shape}")
    print(f"  -> (batch_size={input_ids.size(0)}, seq_len={input_ids.size(1)})")
    print(f"\n序列输出形状:           {seq_output.shape}")
    print(f"  -> (batch_size={seq_output.size(0)}, seq_len={seq_output.size(1)}, hidden_size={seq_output.size(2)})")
    print(f"  -> 每个 token 都有一个 {H} 维的上下文表示")
    print(f"\n[CLS] Pooler 输出形状:  {pooled_output.shape}")
    print(f"  -> (batch_size={pooled_output.size(0)}, hidden_size={pooled_output.size(1)})")
    print(f"  -> [CLS] token 的聚合表示，用于句子分类任务")

    total_params = sum(p.numel() for p in model.parameters())
    print(f"\n模型总参数量: {total_params:,}")
    print(f"  -> 论文报告 BERT-Base 约 110M 参数")
    print(f"  -> 当前模型参数量差异主要来自词汇表大小和实现细节")

    print("\n" + "=" * 60)
    print("课后练习 (尝试修改以下部分来加深理解):")
    print("=" * 60)
    print("1. 将 L 改为 24，H 改为 1024，A 改为 16，观察参数量变化（BERT-Large）")
    print("2. 修改 attention_mask，将某些位置设为 0，观察这些位置对输出的影响")
    print("3. 将 F.gelu 替换为 F.relu，比较两种激活函数的效果差异")
    print("4. 在 BertSelfAttention 中打印 attn 矩阵，观察注意力权重的分布")
    print("5. 尝试构造 token_type_ids，模拟句子对输入（如问答任务）")
