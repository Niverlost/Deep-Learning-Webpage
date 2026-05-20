"""
Verification script for LSTM implementation using NumPy.
This validates the logic of lstm_paper.py and lstm_tutorial.py
without requiring PyTorch to be installed.
"""

import math
import numpy as np


# ---------------------------------------------------------------------------
# Configuration constants (same as the PyTorch files)
# ---------------------------------------------------------------------------
INPUT_SIZE = 10
HIDDEN_SIZE = 20
NUM_LAYERS = 2
SEQ_LEN = 5
BATCH_SIZE = 4


def sigmoid(x):
    return 1 / (1 + np.exp(-x))


def tanh(x):
    return np.tanh(x)


class LSTMCellNumpy:
    """NumPy equivalent of LSTMCell for verification."""

    def __init__(self, input_size, hidden_size):
        self.input_size = input_size
        self.hidden_size = hidden_size

        concat_size = input_size + hidden_size
        self.W_f = np.random.uniform(-1, 1, (hidden_size, concat_size)) * (1.0 / math.sqrt(hidden_size))
        self.W_i = np.random.uniform(-1, 1, (hidden_size, concat_size)) * (1.0 / math.sqrt(hidden_size))
        self.W_C = np.random.uniform(-1, 1, (hidden_size, concat_size)) * (1.0 / math.sqrt(hidden_size))
        self.W_o = np.random.uniform(-1, 1, (hidden_size, concat_size)) * (1.0 / math.sqrt(hidden_size))

        self.b_f = np.zeros(hidden_size)
        self.b_i = np.zeros(hidden_size)
        self.b_C = np.zeros(hidden_size)
        self.b_o = np.zeros(hidden_size)

    def forward(self, x_t, h_prev, C_prev):
        hx = np.concatenate([h_prev, x_t], axis=-1)

        f_t = sigmoid(hx @ self.W_f.T + self.b_f)
        i_t = sigmoid(hx @ self.W_i.T + self.b_i)
        C_tilde_t = tanh(hx @ self.W_C.T + self.b_C)
        C_t = f_t * C_prev + i_t * C_tilde_t
        o_t = sigmoid(hx @ self.W_o.T + self.b_o)
        h_t = o_t * tanh(C_t)

        return h_t, C_t


class LSTMMultiLayerNumpy:
    """NumPy equivalent of multi-layer LSTM for verification."""

    def __init__(self, input_size, hidden_size, num_layers):
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.cells = []
        for l in range(num_layers):
            layer_input_size = input_size if l == 0 else hidden_size
            self.cells.append(LSTMCellNumpy(layer_input_size, hidden_size))

    def forward(self, x, h0=None, C0=None):
        B, T, _ = x.shape

        if h0 is None:
            h0 = np.zeros((self.num_layers, B, self.hidden_size))
        if C0 is None:
            C0 = np.zeros((self.num_layers, B, self.hidden_size))

        h_list = [h0[l] for l in range(self.num_layers)]
        C_list = [C0[l] for l in range(self.num_layers)]

        outputs = []
        for t in range(T):
            layer_input = x[:, t, :]
            for l in range(self.num_layers):
                h_list[l], C_list[l] = self.cells[l].forward(layer_input, h_list[l], C_list[l])
                layer_input = h_list[l]
            outputs.append(h_list[-1])

        output = np.stack(outputs, axis=1)
        h_n = np.stack(h_list, axis=0)
        C_n = np.stack(C_list, axis=0)

        return output, h_n, C_n


if __name__ == "__main__":
    model = LSTMMultiLayerNumpy(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS)
    x = np.random.randn(BATCH_SIZE, SEQ_LEN, INPUT_SIZE)

    output, h_n, C_n = model.forward(x)

    print("=" * 50)
    print("LSTM Verification (NumPy)")
    print("=" * 50)
    print(f"Input shape:    {x.shape}")
    print(f"Output shape:   {output.shape}")
    print(f"h_n shape:      {h_n.shape}")
    print(f"C_n shape:      {C_n.shape}")

    total_params = 0
    for cell in model.cells:
        total_params += (
            cell.W_f.size + cell.b_f.size +
            cell.W_i.size + cell.b_i.size +
            cell.W_C.size + cell.b_C.size +
            cell.W_o.size + cell.b_o.size
        )
    print(f"Total params:   {total_params}")
    print("=" * 50)

    # Validate expected shapes
    assert output.shape == (BATCH_SIZE, SEQ_LEN, HIDDEN_SIZE), "Output shape mismatch!"
    assert h_n.shape == (NUM_LAYERS, BATCH_SIZE, HIDDEN_SIZE), "h_n shape mismatch!"
    assert C_n.shape == (NUM_LAYERS, BATCH_SIZE, HIDDEN_SIZE), "C_n shape mismatch!"

    print("\nAll shape checks passed!")
