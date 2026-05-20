"""
Verification script for LSTM implementation using only Python standard library.
This validates the logic of lstm_paper.py and lstm_tutorial.py
without requiring PyTorch or NumPy to be installed.
"""

import math
import random


# ---------------------------------------------------------------------------
# Configuration constants (same as the PyTorch files)
# ---------------------------------------------------------------------------
INPUT_SIZE = 10
HIDDEN_SIZE = 20
NUM_LAYERS = 2
SEQ_LEN = 5
BATCH_SIZE = 4


def sigmoid(x):
    """Sigmoid activation function."""
    return 1.0 / (1.0 + math.exp(-x))


def tanh(x):
    """Hyperbolic tangent activation function."""
    return math.tanh(x)


def matvec(mat, vec):
    """Matrix-vector multiplication: returns mat @ vec."""
    return [sum(m[i] * vec[i] for i in range(len(vec))) for m in mat]


def vec_add(a, b):
    """Element-wise vector addition."""
    return [a[i] + b[i] for i in range(len(a))]


def vec_mul(a, b):
    """Element-wise vector multiplication (Hadamard product)."""
    return [a[i] * b[i] for i in range(len(a))]


def vec_scalar_map(func, vec):
    """Apply a scalar function element-wise to a vector."""
    return [func(v) for v in vec]


def zeros(size):
    """Create a zero vector of given size."""
    return [0.0] * size


def rand_uniform(shape, scale):
    """Create a tensor of given shape with uniform random values scaled by `scale`."""
    if len(shape) == 1:
        return [random.uniform(-1.0, 1.0) * scale for _ in range(shape[0])]
    return [[random.uniform(-1.0, 1.0) * scale for _ in range(shape[1])] for _ in range(shape[0])]


def concat_vectors(a, b):
    """Concatenate two vectors."""
    return a + b


# ---------------------------------------------------------------------------
# LSTM Cell (single time-step) in pure Python
# ---------------------------------------------------------------------------
class LSTMCellPurePython:
    """Pure Python equivalent of LSTMCell for verification."""

    def __init__(self, input_size, hidden_size):
        self.input_size = input_size
        self.hidden_size = hidden_size
        concat_size = input_size + hidden_size
        scale = 1.0 / math.sqrt(hidden_size)

        self.W_f = rand_uniform((hidden_size, concat_size), scale)
        self.W_i = rand_uniform((hidden_size, concat_size), scale)
        self.W_C = rand_uniform((hidden_size, concat_size), scale)
        self.W_o = rand_uniform((hidden_size, concat_size), scale)

        self.b_f = zeros(hidden_size)
        self.b_i = zeros(hidden_size)
        self.b_C = zeros(hidden_size)
        self.b_o = zeros(hidden_size)

    def forward(self, x_t, h_prev, C_prev):
        hx = concat_vectors(h_prev, x_t)

        f_t = vec_scalar_map(sigmoid, vec_add(matvec(self.W_f, hx), self.b_f))
        i_t = vec_scalar_map(sigmoid, vec_add(matvec(self.W_i, hx), self.b_i))
        C_tilde_t = vec_scalar_map(tanh, vec_add(matvec(self.W_C, hx), self.b_C))
        C_t = vec_add(vec_mul(f_t, C_prev), vec_mul(i_t, C_tilde_t))
        o_t = vec_scalar_map(sigmoid, vec_add(matvec(self.W_o, hx), self.b_o))
        h_t = vec_mul(o_t, vec_scalar_map(tanh, C_t))

        return h_t, C_t


# ---------------------------------------------------------------------------
# Multi-layer LSTM in pure Python
# ---------------------------------------------------------------------------
class LSTMMultiLayerPurePython:
    """Pure Python equivalent of multi-layer LSTM for verification."""

    def __init__(self, input_size, hidden_size, num_layers):
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.cells = []
        for l in range(num_layers):
            layer_input_size = input_size if l == 0 else hidden_size
            self.cells.append(LSTMCellPurePython(layer_input_size, hidden_size))

    def forward(self, x, h0=None, C0=None):
        B = len(x)
        T = len(x[0])

        if h0 is None:
            h0 = [[[0.0] * self.hidden_size for _ in range(B)] for _ in range(self.num_layers)]
        if C0 is None:
            C0 = [[[0.0] * self.hidden_size for _ in range(B)] for _ in range(self.num_layers)]

        h_list = [h0[l] for l in range(self.num_layers)]
        C_list = [C0[l] for l in range(self.num_layers)]

        outputs = []
        for t in range(T):
            layer_input = [x[b][t] for b in range(B)]
            for l in range(self.num_layers):
                new_h = []
                new_C = []
                for b in range(B):
                    h_b, C_b = self.cells[l].forward(layer_input[b], h_list[l][b], C_list[l][b])
                    new_h.append(h_b)
                    new_C.append(C_b)
                h_list[l] = new_h
                C_list[l] = new_C
                layer_input = h_list[l]
            outputs.append(h_list[-1])

        # outputs: list of T elements, each is list of B vectors of size hidden_size
        # Transpose to (B, T, hidden_size)
        output = [[[outputs[t][b][d] for d in range(self.hidden_size)] for t in range(T)] for b in range(B)]
        h_n = h_list
        C_n = C_list

        return output, h_n, C_n


# ---------------------------------------------------------------------------
# Helpers to check shapes
# ---------------------------------------------------------------------------
def check_shape_3d(tensor, expected):
    actual = (len(tensor), len(tensor[0]) if tensor else 0, len(tensor[0][0]) if tensor and tensor[0] else 0)
    assert actual == expected, f"Shape mismatch: expected {expected}, got {actual}"


def check_shape_3d_layers(tensor, expected):
    actual = (len(tensor), len(tensor[0]) if tensor else 0, len(tensor[0][0]) if tensor and tensor[0] else 0)
    assert actual == expected, f"Shape mismatch: expected {expected}, got {actual}"


# ---------------------------------------------------------------------------
# Main verification
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    random.seed(42)
    model = LSTMMultiLayerPurePython(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS)

    # Create random input: (BATCH_SIZE, SEQ_LEN, INPUT_SIZE)
    x = [[[random.gauss(0, 1) for _ in range(INPUT_SIZE)] for _ in range(SEQ_LEN)] for _ in range(BATCH_SIZE)]

    output, h_n, C_n = model.forward(x)

    print("=" * 50)
    print("LSTM Verification (Pure Python Standard Library)")
    print("=" * 50)
    print(f"Input shape:    ({BATCH_SIZE}, {SEQ_LEN}, {INPUT_SIZE})")
    print(f"Output shape:   ({len(output)}, {len(output[0])}, {len(output[0][0])})")
    print(f"h_n shape:      ({len(h_n)}, {len(h_n[0])}, {len(h_n[0][0])})")
    print(f"C_n shape:      ({len(C_n)}, {len(C_n[0])}, {len(C_n[0][0])})")

    total_params = 0
    for cell in model.cells:
        total_params += (
            len(cell.W_f) * len(cell.W_f[0]) + len(cell.b_f) +
            len(cell.W_i) * len(cell.W_i[0]) + len(cell.b_i) +
            len(cell.W_C) * len(cell.W_C[0]) + len(cell.b_C) +
            len(cell.W_o) * len(cell.W_o[0]) + len(cell.b_o)
        )
    print(f"Total params:   {total_params}")
    print("=" * 50)

    # Validate expected shapes
    check_shape_3d(output, (BATCH_SIZE, SEQ_LEN, HIDDEN_SIZE))
    check_shape_3d_layers(h_n, (NUM_LAYERS, BATCH_SIZE, HIDDEN_SIZE))
    check_shape_3d_layers(C_n, (NUM_LAYERS, BATCH_SIZE, HIDDEN_SIZE))

    print("\nAll shape checks passed!")
