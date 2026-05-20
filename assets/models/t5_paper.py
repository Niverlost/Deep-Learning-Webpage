"""
Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer
Authors: Colin Raffel et al.
Year: 2019
arXiv: https://arxiv.org/abs/1910.10683

This is the paper-faithful implementation of T5-Base.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


VOCAB_SIZE = 32128
D_MODEL = 768
D_FF = 2048
NUM_LAYERS = 12
NUM_HEADS = 12
D_KV = 64
MAX_SEQ_LEN = 512
DROPOUT = 0.1
EPS = 1e-6


class RelativePositionBias(nn.Module):
    def __init__(self, num_buckets: int, max_distance: int, n_heads: int):
        super().__init__()
        self.num_buckets = num_buckets
        self.max_distance = max_distance
        self.n_heads = n_heads
        self.relative_attention_bias = nn.Embedding(num_buckets, n_heads)

    @staticmethod
    def _relative_position_bucket(relative_position, num_buckets, max_distance):
        ret = 0
        n = -relative_position
        num_buckets //= 2
        ret += (n < 0).long() * num_buckets
        n = torch.abs(n)
        max_exact = num_buckets // 2
        is_small = n < max_exact
        val_if_large = max_exact + (
            torch.log(n.float() / max_exact)
            / math.log(max_distance / max_exact)
            * (num_buckets - max_exact)
        ).long()
        val_if_large = torch.minimum(val_if_large, torch.full_like(val_if_large, num_buckets - 1))
        ret += torch.where(is_small, n, val_if_large)
        return ret

    def forward(self, query_length: int, key_length: int):
        device = self.relative_attention_bias.weight.device
        context_position = torch.arange(query_length, dtype=torch.long, device=device)[:, None]
        memory_position = torch.arange(key_length, dtype=torch.long, device=device)[None, :]
        relative_position = memory_position - context_position
        rp_bucket = self._relative_position_bucket(
            relative_position, self.num_buckets, self.max_distance
        )
        values = self.relative_attention_bias(rp_bucket)
        values = values.permute(2, 0, 1).unsqueeze(0)
        return values


class T5LayerNorm(nn.Module):
    def __init__(self, d_model: int, eps: float = EPS):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(d_model))
        self.eps = eps

    def forward(self, x):
        variance = x.to(torch.float32).pow(2).mean(-1, keepdim=True)
        x = x / torch.sqrt(variance + self.eps)
        return self.weight * x


class T5DenseActDense(nn.Module):
    def __init__(self, d_model: int, d_ff: int, dropout: float):
        super().__init__()
        self.wi = nn.Linear(d_model, d_ff, bias=False)
        self.wo = nn.Linear(d_ff, d_model, bias=False)
        self.dropout = nn.Dropout(dropout)
        self.act = F.relu

    def forward(self, x):
        x = self.wi(x)
        x = self.act(x)
        x = self.dropout(x)
        x = self.wo(x)
        return x


class T5Attention(nn.Module):
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

        query_states = self.q(hidden_states)
        query_states = query_states.view(batch_size, seq_length, self.n_heads, self.d_kv).transpose(1, 2)

        if key_value_states is not None:
            key_states = self.k(key_value_states)
            value_states = self.v(key_value_states)
            key_length = key_value_states.shape[1]
        else:
            key_states = self.k(hidden_states)
            value_states = self.v(hidden_states)
            key_length = seq_length

        key_states = key_states.view(batch_size, key_length, self.n_heads, self.d_kv).transpose(1, 2)
        value_states = value_states.view(batch_size, key_length, self.n_heads, self.d_kv).transpose(1, 2)

        if past_key_value is not None:
            key_states = torch.cat([past_key_value[0], key_states], dim=2)
            value_states = torch.cat([past_key_value[1], value_states], dim=2)
            key_length = key_states.shape[2]

        if use_cache:
            present_key_value = (key_states, value_states)
        else:
            present_key_value = None

        scores = torch.matmul(query_states, key_states.transpose(-1, -2))

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
        attn_output = torch.matmul(attn_weights, value_states)
        attn_output = attn_output.transpose(1, 2).contiguous().view(batch_size, seq_length, self.d_model)
        attn_output = self.o(attn_output)

        return attn_output, present_key_value, position_bias


class T5LayerSelfAttention(nn.Module):
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
        hidden_states = hidden_states + self.dropout(attention_output)
        return hidden_states, present_key_value, position_bias


class T5LayerCrossAttention(nn.Module):
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
    def __init__(self, d_model, n_heads, d_kv, d_ff, dropout, is_decoder, has_relative_attention_bias):
        super().__init__()
        self.is_decoder = is_decoder
        self.layer = nn.ModuleList()
        self.layer.append(T5LayerSelfAttention(
            d_model, n_heads, d_kv, dropout, is_decoder, has_relative_attention_bias
        ))
        if is_decoder:
            self.layer.append(T5LayerCrossAttention(d_model, n_heads, d_kv, dropout))
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

        ffn_layer_index = 2 if self.is_decoder and encoder_hidden_states is not None else 1
        hidden_states = self.layer[ffn_layer_index](hidden_states)

        return hidden_states, present_key_value, position_bias


class T5Stack(nn.Module):
    def __init__(self, vocab_size, d_model, n_layers, n_heads, d_kv, d_ff, dropout, max_seq_len, is_decoder=False):
        super().__init__()
        self.is_decoder = is_decoder
        self.embed_tokens = nn.Embedding(vocab_size, d_model)
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
        hidden_states = self.embed_tokens(input_ids)
        hidden_states = self.dropout(hidden_states)

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
        self.encoder.embed_tokens.weight = self.decoder.embed_tokens.weight
        self.lm_head.weight = self.decoder.embed_tokens.weight

    def forward(
        self,
        input_ids,
        decoder_input_ids,
        attention_mask=None,
        decoder_attention_mask=None,
    ):
        encoder_outputs, _ = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )
        decoder_outputs, _ = self.decoder(
            input_ids=decoder_input_ids,
            attention_mask=decoder_attention_mask,
            encoder_hidden_states=encoder_outputs,
            encoder_attention_mask=attention_mask,
        )
        lm_logits = self.lm_head(decoder_outputs)
        return lm_logits


def count_parameters(model):
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

    print(f"Input shape:        {input_ids.shape}")
    print(f"Decoder input shape:{decoder_input_ids.shape}")
    print(f"Output shape:       {output.shape}")
    print(f"Total parameters:   {count_parameters(model):,}")
