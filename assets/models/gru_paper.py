"""
Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation
Kyunghyun Cho, Bart van Merrienboer, Caglar Gulcehre, Dzmitry Bahdanau, Fethi Bougares, Holger Schwenk, Yoshua Bengio
2014
arXiv: https://arxiv.org/abs/1406.1078

Paper-faithful PyTorch implementation of GRU (Gated Recurrent Unit).
"""

import math
import torch
import torch.nn as nn


class GRUCell(nn.Module):
    def __init__(self, input_size: int, hidden_size: int):
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size

        self.W_r = nn.Linear(input_size + hidden_size, hidden_size)
        self.W_z = nn.Linear(input_size + hidden_size, hidden_size)
        self.W = nn.Linear(input_size + hidden_size, hidden_size)

    def forward(self, x_t: torch.Tensor, h_prev: torch.Tensor) -> torch.Tensor:
        concat = torch.cat([h_prev, x_t], dim=-1)

        r_t = torch.sigmoid(self.W_r(concat))
        z_t = torch.sigmoid(self.W_z(concat))

        concat_reset = torch.cat([r_t * h_prev, x_t], dim=-1)
        h_tilde = torch.tanh(self.W(concat_reset))

        h_t = (1 - z_t) * h_prev + z_t * h_tilde
        return h_t


class GRU(nn.Module):
    def __init__(self, input_size: int, hidden_size: int, num_layers: int = 1):
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        self.cells = nn.ModuleList()
        for layer in range(num_layers):
            layer_input_size = input_size if layer == 0 else hidden_size
            self.cells.append(GRUCell(layer_input_size, hidden_size))

    def forward(self, x: torch.Tensor, h_0: torch.Tensor = None) -> tuple[torch.Tensor, torch.Tensor]:
        batch_size, seq_len, _ = x.shape
        device = x.device

        if h_0 is None:
            h_0 = torch.zeros(self.num_layers, batch_size, self.hidden_size, device=device)

        h_t = h_0
        outputs = []

        for t in range(seq_len):
            x_t = x[:, t, :]
            for layer, cell in enumerate(self.cells):
                h_t[layer] = cell(x_t, h_t[layer])
                x_t = h_t[layer]
            outputs.append(x_t)

        output = torch.stack(outputs, dim=1)
        return output, h_t


if __name__ == "__main__":
    input_size = 128
    hidden_size = 256
    num_layers = 2
    batch_size = 4
    seq_len = 10

    model = GRU(input_size, hidden_size, num_layers)
    x = torch.randn(batch_size, seq_len, input_size)

    output, h_n = model(x)

    print(f"Input shape:  {x.shape}")
    print(f"Output shape: {output.shape}")
    print(f"Hidden shape: {h_n.shape}")

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,}")
