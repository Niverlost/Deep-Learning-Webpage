"""
Long Short-Term Memory
Authors: Sepp Hochreiter, Jürgen Schmidhuber
Year: 1997
arXiv: Neural Computation 9(8):1735-1780, 1997

Paper-faithful implementation of the original LSTM cell and multi-layer LSTM.
"""

import math
import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------
INPUT_SIZE = 10
HIDDEN_SIZE = 20
NUM_LAYERS = 2
SEQ_LEN = 5
BATCH_SIZE = 4


# ---------------------------------------------------------------------------
# LSTM Cell (single time-step)
# ---------------------------------------------------------------------------
class LSTMCell(nn.Module):
    """
    Single LSTM cell as described in Hochreiter & Schmidhuber (1997).

    Equations (paper notation):
        f_t = sigmoid(W_f · [h_{t-1}, x_t] + b_f)
        i_t = sigmoid(W_i · [h_{t-1}, x_t] + b_i)
        C_tilde_t = tanh(W_C · [h_{t-1}, x_t] + b_C)
        C_t = f_t * C_{t-1} + i_t * C_tilde_t
        o_t = sigmoid(W_o · [h_{t-1}, x_t] + b_o)
        h_t = o_t * tanh(C_t)
    """

    def __init__(self, input_size: int, hidden_size: int):
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size

        # Concatenated weights for [h_{t-1}, x_t]
        self.W_f = nn.Parameter(torch.empty(hidden_size, input_size + hidden_size))
        self.W_i = nn.Parameter(torch.empty(hidden_size, input_size + hidden_size))
        self.W_C = nn.Parameter(torch.empty(hidden_size, input_size + hidden_size))
        self.W_o = nn.Parameter(torch.empty(hidden_size, input_size + hidden_size))

        self.b_f = nn.Parameter(torch.zeros(hidden_size))
        self.b_i = nn.Parameter(torch.zeros(hidden_size))
        self.b_C = nn.Parameter(torch.zeros(hidden_size))
        self.b_o = nn.Parameter(torch.zeros(hidden_size))

        self._reset_parameters()

    def _reset_parameters(self):
        std = 1.0 / math.sqrt(self.hidden_size)
        for p in self.parameters():
            nn.init.uniform_(p, -std, std)

    def forward(self, x_t: torch.Tensor, h_prev: torch.Tensor, C_prev: torch.Tensor):
        """
        Args:
            x_t:   (B, input_size)
            h_prev:(B, hidden_size)
            C_prev:(B, hidden_size)

        Returns:
            h_t:   (B, hidden_size)
            C_t:   (B, hidden_size)
        """
        hx = torch.cat([h_prev, x_t], dim=-1)  # (B, hidden_size + input_size)

        f_t = torch.sigmoid(torch.matmul(hx, self.W_f.t()) + self.b_f)
        i_t = torch.sigmoid(torch.matmul(hx, self.W_i.t()) + self.b_i)
        C_tilde_t = torch.tanh(torch.matmul(hx, self.W_C.t()) + self.b_C)
        C_t = f_t * C_prev + i_t * C_tilde_t
        o_t = torch.sigmoid(torch.matmul(hx, self.W_o.t()) + self.b_o)
        h_t = o_t * torch.tanh(C_t)

        return h_t, C_t


# ---------------------------------------------------------------------------
# Multi-layer LSTM
# ---------------------------------------------------------------------------
class LSTM(nn.Module):
    """
    Stacked LSTM with num_layers layers.

    Each layer processes the full sequence using LSTMCell,
    feeding hidden states of layer l-1 as input to layer l.
    """

    def __init__(self, input_size: int, hidden_size: int, num_layers: int = 1):
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        self.cells = nn.ModuleList()
        for l in range(num_layers):
            layer_input_size = input_size if l == 0 else hidden_size
            self.cells.append(LSTMCell(layer_input_size, hidden_size))

    def forward(self, x: torch.Tensor, h0: torch.Tensor = None, C0: torch.Tensor = None):
        """
        Args:
            x:   (B, T, input_size)
            h0:  (num_layers, B, hidden_size) or None
            C0:  (num_layers, B, hidden_size) or None

        Returns:
            output: (B, T, hidden_size)  -- hidden states from last layer
            h_n:    (num_layers, B, hidden_size)
            C_n:    (num_layers, B, hidden_size)
        """
        B, T, _ = x.size()

        if h0 is None:
            h0 = x.new_zeros(self.num_layers, B, self.hidden_size)
        if C0 is None:
            C0 = x.new_zeros(self.num_layers, B, self.hidden_size)

        h_list = [h0[l] for l in range(self.num_layers)]
        C_list = [C0[l] for l in range(self.num_layers)]

        outputs = []
        for t in range(T):
            layer_input = x[:, t, :]
            for l in range(self.num_layers):
                h_list[l], C_list[l] = self.cells[l](layer_input, h_list[l], C_list[l])
                layer_input = h_list[l]
            outputs.append(h_list[-1])

        output = torch.stack(outputs, dim=1)  # (B, T, hidden_size)
        h_n = torch.stack(h_list, dim=0)      # (num_layers, B, hidden_size)
        C_n = torch.stack(C_list, dim=0)      # (num_layers, B, hidden_size)

        return output, h_n, C_n


# ---------------------------------------------------------------------------
# Sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = LSTM(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS)
    x = torch.randn(BATCH_SIZE, SEQ_LEN, INPUT_SIZE)

    output, h_n, C_n = model(x)

    print(f"Input shape:    {x.shape}")
    print(f"Output shape:   {output.shape}")
    print(f"h_n shape:      {h_n.shape}")
    print(f"C_n shape:      {C_n.shape}")

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total params:   {total_params}")
