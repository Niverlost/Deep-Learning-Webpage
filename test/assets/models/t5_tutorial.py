"""
Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer
Authors: Colin Raffel et al.
Year: 2019
arXiv: https://arxiv.org/abs/1910.10683

本文件是 T5-Base 的初学者友好教程实现。

T5 是什么？
T5 (Text-to-Text Transfer Transformer) 将所有 NLP 任务统一为“文本到文本”的转换问题。
无论是翻译、摘要、问答还是分类，输入是文本，输出也是文本。

关键概念：
- Encoder-Decoder 架构: 编码器读取源文本，解码器生成目标文本。
- 相对位置编码 (Relative Position Bias): T5 不使用传统的正弦/余弦绝对位置编码，
  而是在 Attention 的 score 上加入一个基于相对位置的偏置项，让模型学习位置关系。
- Pre-Norm: LayerNorm 放在残差连接之前，有助于深层网络的训练稳定性。
- 简化的 Attention: 无 bias 的 Linear 投影，缩放因子固定为 1（不除以 sqrt(d_k)）。
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ========================= 配置常量 =========================
VOCAB_SIZE = 32128       # SentencePiece 词表大小
D_MODEL = 768            # 模型隐藏层维度，决定模型容量
D_FF = 2048              # 前馈网络中间层维度 (通常为 4 * d_model)
NUM_LAYERS = 12          # Encoder 和 Decoder 各自的层数
NUM_HEADS = 12           # 多头注意力中的头数
D_KV = 64                # 每个注意力头的维度 (d_model // n_heads = 768 // 12 = 64)
MAX_SEQ_LEN = 512        # 最大序列长度
DROPOUT = 0.1            # Dropout 比率，用于正则化
EPS = 1e-6               # LayerNorm 中的数值稳定常数


class RelativePositionBias(nn.Module):
    """
    相对位置偏置模块。

    传统 Transformer 使用绝对位置编码（正弦/余弦），而 T5 使用相对位置偏置。
    它将 query 和 key 之间的相对距离映射到一个可学习的偏置值，加到 attention score 上。
    这样模型可以更好地捕捉 token 之间的相对距离关系。
    """
    def __init__(self, num_buckets: int, max_distance: int, n_heads: int):
        super().__init__()
        self.num_buckets = num_buckets
        self.max_distance = max_distance
        self.n_heads = n_heads
        # 可学习的偏置嵌入表: [num_buckets, n_heads]
        self.relative_attention_bias = nn.Embedding(num_buckets, n_heads)

    @staticmethod
    def _relative_position_bucket(relative_position, num_buckets, max_distance):
        """
        将相对位置映射到 bucket 索引。

        策略：
        - 区分正负方向（左侧/右侧）。
        - 近距离使用精确 bucket。
        - 远距离使用对数压缩，减少 bucket 数量。
        """
        ret = 0
        n = -relative_position
        num_buckets //= 2
        # 正负方向各占一半 bucket
        ret += (n < 0).long() * num_buckets
        n = torch.abs(n)
        max_exact = num_buckets // 2
        is_small = n < max_exact
        # 对远距离进行对数压缩
        val_if_large = max_exact + (
            torch.log(n.float() / max_exact)
            / math.log(max_distance / max_exact)
            * (num_buckets - max_exact)
        ).long()
        val_if_large = torch.minimum(val_if_large, torch.full_like(val_if_large, num_buckets - 1))
        ret += torch.where(is_small, n, val_if_large)
        return ret

    def forward(self, query_length: int, key_length: int):
        """
        生成相对位置偏置矩阵，形状为 [1, n_heads, query_length, key_length]。
        """
        device = self.relative_attention_bias.weight.device
        # context_position: [query_length, 1]
        context_position = torch.arange(query_length, dtype=torch.long, device=device)[:, None]
        # memory_position: [1, key_length]
        memory_position = torch.arange(key_length, dtype=torch.long, device=device)[None, :]
        # relative_position: [query_length, key_length]
        relative_position = memory_position - context_position
        rp_bucket = self._relative_position_bucket(
            relative_position, self.num_buckets, self.max_distance
        )
        # values: [query_length, key_length, n_heads]
        values = self.relative_attention_bias(rp_bucket)
        # 调整为 [1, n_heads, query_length, key_length]
        values = values.permute(2, 0, 1).unsqueeze(0)
        return values


class T5LayerNorm(nn.Module):
    """
    T5 使用的 LayerNorm（无 bias 项）。

    与标准 PyTorch LayerNorm 的区别：
    - 只有 weight，没有 bias。
    - 在 float32 中计算方差以保证数值稳定性。
    """
    def __init__(self, d_model: int, eps: float = EPS):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(d_model))
        self.eps = eps

    def forward(self, x):
        # 在 float32 中计算方差，避免低精度下的数值问题
        variance = x.to(torch.float32).pow(2).mean(-1, keepdim=True)
        x = x / torch.sqrt(variance + self.eps)
        return self.weight * x


class T5DenseActDense(nn.Module):
    """
    T5 的前馈网络 (FFN)。

    结构: Linear(d_model -> d_ff) -> ReLU -> Dropout -> Linear(d_ff -> d_model)
    注意: T5 原始论文使用 ReLU，后续 T5.1.1 改用 GELU。
    """
    def __init__(self, d_model: int, d_ff: int, dropout: float):
        super().__init__()
        self.wi = nn.Linear(d_model, d_ff, bias=False)   # 扩展维度
        self.wo = nn.Linear(d_ff, d_model, bias=False)   # 投影回原始维度
        self.dropout = nn.Dropout(dropout)
        self.act = F.relu

    def forward(self, x):
        x = self.wi(x)       # [B, L, d_model] -> [B, L, d_ff]
        x = self.act(x)      # ReLU 激活
        x = self.dropout(x)  # 正则化
        x = self.wo(x)       # [B, L, d_ff] -> [B, L, d_model]
        return x


class T5Attention(nn.Module):
    """
    T5 的简化注意力机制。

    与标准 Transformer Attention 的区别：
    1. 所有 Linear 层无 bias。
    2. 不除以 sqrt(d_k) 进行缩放（缩放因子固定为 1）。
    3. 支持相对位置偏置。
    4. 支持 Cross-Attention（Decoder 中使用）。
    5. 支持 KV Cache（推理加速）。
    """
    def __init__(
        self,
        d_model: int,
        n_heads: int,
        d_kv: int,
        dropout: float,
        is_decoder: bool = False,
        has_relative_attention_bias: bool = False,
    ):
        super().__init__()
        self.is_decoder = is_decoder
        self.has_relative_attention_bias = has_relative_attention_bias
        self.n_heads = n_heads
        self.d_kv = d_kv
        self.d_model = d_model
        self.dropout = nn.Dropout(dropout)

        # Q, K, V, O 投影，均无 bias
        self.q = nn.Linear(d_model, n_heads * d_kv, bias=False)
        self.k = nn.Linear(d_model, n_heads * d_kv, bias=False)
        self.v = nn.Linear(d_model, n_heads * d_kv, bias=False)
        self.o = nn.Linear(n_heads * d_kv, d_model, bias=False)

        if self.has_relative_attention_bias:
            self.relative_attention_bias = RelativePositionBias(
                num_buckets=32, max_distance=128, n_heads=n_heads
            )

    def forward(
        self,
        hidden_states,
        mask=None,
        key_value_states=None,
        position_bias=None,
        past_key_value=None,
        use_cache=False,
    ):
        batch_size, seq_length = hidden_states.shape[:2]

        # Q 投影并分头: [B, L, d_model] -> [B, n_heads, L, d_kv]
        query_states = self.q(hidden_states)
        query_states = query_states.view(batch_size, seq_length, self.n_heads, self.d_kv).transpose(1, 2)

        # K, V 投影
        if key_value_states is not None:
            # Cross-Attention: 使用 encoder 的输出作为 K, V
            key_states = self.k(key_value_states)
            value_states = self.v(key_value_states)
            key_length = key_value_states.shape[1]
        else:
            # Self-Attention: 使用自身作为 K, V
            key_states = self.k(hidden_states)
            value_states = self.v(hidden_states)
            key_length = seq_length

        key_states = key_states.view(batch_size, key_length, self.n_heads, self.d_kv).transpose(1, 2)
        value_states = value_states.view(batch_size, key_length, self.n_heads, self.d_kv).transpose(1, 2)

        # 拼接 past_key_value（用于推理时的 KV Cache）
        if past_key_value is not None:
            key_states = torch.cat([past_key_value[0], key_states], dim=2)
            value_states = torch.cat([past_key_value[1], value_states], dim=2)
            key_length = key_states.shape[2]

        if use_cache:
            present_key_value = (key_states, value_states)
        else:
            present_key_value = None

        # Attention Score: [B, n_heads, L, d_kv] @ [B, n_heads, d_kv, L] -> [B, n_heads, L, L]
        scores = torch.matmul(query_states, key_states.transpose(-1, -2))

        # 添加位置偏置和 mask
        if position_bias is None:
            if self.has_relative_attention_bias:
                position_bias = self.relative_attention_bias(seq_length, key_length)
            else:
                position_bias = torch.zeros(
                    (1, self.n_heads, seq_length, key_length),
                    device=scores.device, dtype=scores.dtype
                )
            if mask is not None:
                position_bias = position_bias + mask

        scores += position_bias
        attn_weights = F.softmax(scores.float(), dim=-1).type_as(scores)
        attn_weights = self.dropout(attn_weights)
        # [B, n_heads, L, L] @ [B, n_heads, L, d_kv] -> [B, n_heads, L, d_kv]
        attn_output = torch.matmul(attn_weights, value_states)
        # 合并多头: [B, n_heads, L, d_kv] -> [B, L, d_model]
        attn_output = attn_output.transpose(1, 2).contiguous().view(batch_size, seq_length, self.d_model)
        attn_output = self.o(attn_output)

        return attn_output, present_key_value, position_bias


class T5LayerSelfAttention(nn.Module):
    """
    带 Pre-Norm 的自注意力子层。

    Pre-Norm 结构: LayerNorm -> Attention -> Dropout -> Residual
    与 Post-Norm 的区别：LayerNorm 在残差连接之前，训练更稳定。
    """
    def __init__(self, d_model, n_heads, d_kv, dropout, is_decoder, has_relative_attention_bias):
        super().__init__()
        self.SelfAttention = T5Attention(
            d_model, n_heads, d_kv, dropout,
            is_decoder=is_decoder,
            has_relative_attention_bias=has_relative_attention_bias,
        )
        self.layer_norm = T5LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, hidden_states, attention_mask=None, position_bias=None, past_key_value=None, use_cache=False):
        normed = self.layer_norm(hidden_states)
        attention_output, present_key_value, position_bias = self.SelfAttention(
            normed,
            mask=attention_mask,
            position_bias=position_bias,
            past_key_value=past_key_value,
            use_cache=use_cache,
        )
        # 残差连接
        hidden_states = hidden_states + self.dropout(attention_output)
        return hidden_states, present_key_value, position_bias


class T5LayerCrossAttention(nn.Module):
    """
    带 Pre-Norm 的交叉注意力子层（仅 Decoder 使用）。

    交叉注意力让 Decoder 能够关注 Encoder 的输出，实现源文本到目标文本的信息传递。
    """
    def __init__(self, d_model, n_heads, d_kv, dropout):
        super().__init__()
        self.EncDecAttention = T5Attention(
            d_model, n_heads, d_kv, dropout, is_decoder=True, has_relative_attention_bias=False
        )
        self.layer_norm = T5LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, hidden_states, key_value_states, attention_mask=None, position_bias=None):
        normed = self.layer_norm(hidden_states)
        attention_output, _, position_bias = self.EncDecAttention(
            normed,
            mask=attention_mask,
            key_value_states=key_value_states,
            position_bias=position_bias,
        )
        hidden_states = hidden_states + self.dropout(attention_output)
        return hidden_states, position_bias


class T5LayerFF(nn.Module):
    """
    带 Pre-Norm 的前馈网络子层。

    结构: LayerNorm -> FFN -> Dropout -> Residual
    """
    def __init__(self, d_model, d_ff, dropout):
        super().__init__()
        self.DenseReluDense = T5DenseActDense(d_model, d_ff, dropout)
        self.layer_norm = T5LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, hidden_states):
        forwarded_states = self.layer_norm(hidden_states)
        forwarded_states = self.DenseReluDense(forwarded_states)
        hidden_states = hidden_states + self.dropout(forwarded_states)
        return hidden_states


class T5Block(nn.Module):
    """
    T5 的基本构建块。

    Encoder Block: Self-Attention -> FFN
    Decoder Block: Self-Attention (Masked) -> Cross-Attention -> FFN

    每个子层都使用 Pre-Norm + 残差连接。
    """
    def __init__(self, d_model, n_heads, d_kv, d_ff, dropout, is_decoder, has_relative_attention_bias):
        super().__init__()
        self.is_decoder = is_decoder
        self.layer = nn.ModuleList()
        # 自注意力层
        self.layer.append(T5LayerSelfAttention(
            d_model, n_heads, d_kv, dropout, is_decoder, has_relative_attention_bias
        ))
        # 交叉注意力层（仅 Decoder）
        if is_decoder:
            self.layer.append(T5LayerCrossAttention(d_model, n_heads, d_kv, dropout))
        # 前馈网络层
        self.layer.append(T5LayerFF(d_model, d_ff, dropout))

    def forward(
        self,
        hidden_states,
        attention_mask=None,
        encoder_hidden_states=None,
        encoder_attention_mask=None,
        past_key_value=None,
        use_cache=False,
    ):
        if past_key_value is not None:
            expected_num_past_key_values = 2 if encoder_hidden_states is None else 4
            assert len(past_key_value) == expected_num_past_key_values

        self_attn_past_key_value = past_key_value[:2] if past_key_value is not None else None
        cross_attn_past_key_value = past_key_value[2:] if past_key_value is not None else None

        # Self-Attention
        self_attention_outputs = self.layer[0](
            hidden_states,
            attention_mask=attention_mask,
            position_bias=None,
            past_key_value=self_attn_past_key_value,
            use_cache=use_cache,
        )
        hidden_states = self_attention_outputs[0]
        present_key_value = self_attention_outputs[1]
        position_bias = self_attention_outputs[2]

        # Cross-Attention（Decoder 且存在 encoder 输出时）
        if self.is_decoder and encoder_hidden_states is not None:
            cross_attention_outputs = self.layer[1](
                hidden_states,
                key_value_states=encoder_hidden_states,
                attention_mask=encoder_attention_mask,
                position_bias=None,
            )
            hidden_states = cross_attention_outputs[0]
            cross_attn_present_key_value = cross_attention_outputs[1]
            if present_key_value is not None:
                present_key_value = present_key_value + cross_attn_present_key_value
            else:
                present_key_value = cross_attn_present_key_value

        # FFN
        ffn_layer_index = 2 if self.is_decoder and encoder_hidden_states is not None else 1
        hidden_states = self.layer[ffn_layer_index](hidden_states)

        return hidden_states, present_key_value, position_bias


class T5Stack(nn.Module):
    """
    T5 的 Encoder 或 Decoder 堆栈。

    由 N 个 T5Block 堆叠而成，最后接 LayerNorm 和 Dropout。
    """
    def __init__(self, vocab_size, d_model, n_layers, n_heads, d_kv, d_ff, dropout, max_seq_len, is_decoder=False):
        super().__init__()
        self.is_decoder = is_decoder
        # 词嵌入层，Encoder 和 Decoder 共享词表
        self.embed_tokens = nn.Embedding(vocab_size, d_model)
        # N 个 T5Block，只有第一层有相对位置偏置
        self.block = nn.ModuleList([
            T5Block(
                d_model, n_heads, d_kv, d_ff, dropout,
                is_decoder=is_decoder,
                has_relative_attention_bias=(i == 0),
            )
            for i in range(n_layers)
        ])
        self.final_layer_norm = T5LayerNorm(d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        input_ids=None,
        attention_mask=None,
        encoder_hidden_states=None,
        encoder_attention_mask=None,
        past_key_values=None,
        use_cache=False,
    ):
        # 词嵌入: [B, L] -> [B, L, d_model]
        hidden_states = self.embed_tokens(input_ids)
        hidden_states = self.dropout(hidden_states)

        # 将 attention_mask 转换为加性 mask
        if attention_mask is not None:
            attention_mask = attention_mask.unsqueeze(1).unsqueeze(1)
            attention_mask = (1.0 - attention_mask.float()) * torch.finfo(hidden_states.dtype).min

        if encoder_attention_mask is not None:
            encoder_attention_mask = encoder_attention_mask.unsqueeze(1).unsqueeze(1)
            encoder_attention_mask = (1.0 - encoder_attention_mask.float()) * torch.finfo(hidden_states.dtype).min

        present_key_values = () if use_cache else None

        for i, layer_module in enumerate(self.block):
            past_key_value = past_key_values[i] if past_key_values is not None else None
            layer_outputs = layer_module(
                hidden_states,
                attention_mask=attention_mask,
                encoder_hidden_states=encoder_hidden_states,
                encoder_attention_mask=encoder_attention_mask,
                past_key_value=past_key_value,
                use_cache=use_cache,
            )
            hidden_states = layer_outputs[0]
            if use_cache:
                present_key_values = present_key_values + (layer_outputs[1],)

        hidden_states = self.final_layer_norm(hidden_states)
        hidden_states = self.dropout(hidden_states)

        return hidden_states, present_key_values


class T5Model(nn.Module):
    """
    完整的 T5 模型。

    结构: Encoder -> Decoder -> LM Head
    - Encoder: 将输入文本编码为上下文表示。
    - Decoder: 自回归地生成目标文本。
    - LM Head: 将 Decoder 输出投影到词表空间，得到每个词的 logits。

    权重共享:
    - Encoder 和 Decoder 共享词嵌入权重。
    - LM Head 与 Decoder 词嵌入共享权重（减少参数量，提升性能）。
    """
    def __init__(
        self,
        vocab_size=VOCAB_SIZE,
        d_model=D_MODEL,
        d_ff=D_FF,
        n_layers=NUM_LAYERS,
        n_heads=NUM_HEADS,
        d_kv=D_KV,
        dropout=DROPOUT,
        max_seq_len=MAX_SEQ_LEN,
    ):
        super().__init__()
        self.encoder = T5Stack(
            vocab_size, d_model, n_layers, n_heads, d_kv, d_ff, dropout, max_seq_len, is_decoder=False
        )
        self.decoder = T5Stack(
            vocab_size, d_model, n_layers, n_heads, d_kv, d_ff, dropout, max_seq_len, is_decoder=True
        )
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)
        # 权重共享
        self.encoder.embed_tokens.weight = self.decoder.embed_tokens.weight
        self.lm_head.weight = self.decoder.embed_tokens.weight

    def forward(
        self,
        input_ids,
        decoder_input_ids,
        attention_mask=None,
        decoder_attention_mask=None,
    ):
        # Encoder 前向: [B, src_len] -> [B, src_len, d_model]
        encoder_outputs, _ = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )
        # Decoder 前向: [B, tgt_len] -> [B, tgt_len, d_model]
        decoder_outputs, _ = self.decoder(
            input_ids=decoder_input_ids,
            attention_mask=decoder_attention_mask,
            encoder_hidden_states=encoder_outputs,
            encoder_attention_mask=attention_mask,
        )
        # LM Head: [B, tgt_len, d_model] -> [B, tgt_len, vocab_size]
        lm_logits = self.lm_head(decoder_outputs)
        return lm_logits


def count_parameters(model):
    """计算模型的可训练参数量。"""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


if __name__ == "__main__":
    model = T5Model()
    batch_size = 2
    src_len = 32
    tgt_len = 16
    input_ids = torch.randint(0, VOCAB_SIZE, (batch_size, src_len))
    decoder_input_ids = torch.randint(0, VOCAB_SIZE, (batch_size, tgt_len))
    attention_mask = torch.ones(batch_size, src_len, dtype=torch.long)
    decoder_attention_mask = torch.ones(batch_size, tgt_len, dtype=torch.long)

    with torch.no_grad():
        output = model(input_ids, decoder_input_ids, attention_mask, decoder_attention_mask)

    print(f"输入形状:              {input_ids.shape}")
    print(f"解码器输入形状:        {decoder_input_ids.shape}")
    print(f"输出形状 (logits):     {output.shape}")
    print(f"总参数量:              {count_parameters(model):,}")

    # ========================= 读者练习 =========================
    # 1. 尝试修改 d_model 和 n_layers，观察参数量和输出形状的变化。
    # 2. 将激活函数从 ReLU 替换为 GELU（T5.1.1 的改进）。
    # 3. 实现一个简单的 greedy decoding 推理函数。
    # 4. 对比 Pre-Norm 和 Post-Norm 的训练稳定性差异。
