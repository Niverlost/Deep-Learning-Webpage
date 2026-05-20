"""
Learning Representations by Back-propagating Errors
David E. Rumelhart, Geoffrey E. Hinton, Ronald J. Williams
Nature, 1986
https://www.nature.com/articles/323533a0

Paper-faithful implementation of the backpropagation algorithm
applied to a multilayer perceptron (MLP) on the XOR problem.
No autograd — all gradients computed manually via the chain rule.
"""

import math
import random


# ------------------------------------------------------------------
# Configuration constants (matching the paper's MLP setup)
# ------------------------------------------------------------------
INPUT_DIM   = 2      # number of input features (XOR: two bits)
HIDDEN_DIM  = 4      # number of hidden units
OUTPUT_DIM  = 1      # number of output units
SEED        = 1986   # reproducibility
LR          = 0.5    # learning rate eta
EPOCHS      = 10000  # training iterations

# XOR dataset — the classic non-linearly separable problem
X = [[0.0, 0.0],
     [0.0, 1.0],
     [1.0, 0.0],
     [1.0, 1.0]]
Y = [[0.0],
     [1.0],
     [1.0],
     [0.0]]


# ------------------------------------------------------------------
# Activation functions
# ------------------------------------------------------------------
def sigmoid(z):
    return 1.0 / (1.0 + math.exp(-z))


def sigmoid_derivative(a):
    return a * (1.0 - a)


# ------------------------------------------------------------------
# Small matrix utilities (pure Python, no external dependencies)
# ------------------------------------------------------------------
def mat_zeros(rows, cols):
    return [[0.0] * cols for _ in range(rows)]


def mat_add(A, B):
    rows, cols = len(A), len(A[0])
    if len(B) == 1:
        return [[A[i][j] + B[0][j] for j in range(cols)] for i in range(rows)]
    return [[A[i][j] + B[i][j] for j in range(cols)] for i in range(rows)]


def mat_sub(A, B):
    rows, cols = len(A), len(A[0])
    if len(B) == 1:
        return [[A[i][j] - B[0][j] for j in range(cols)] for i in range(rows)]
    return [[A[i][j] - B[i][j] for j in range(cols)] for i in range(rows)]


def mat_mul(A, B):
    rows_a, cols_a = len(A), len(A[0])
    rows_b, cols_b = len(B), len(B[0])
    assert cols_a == rows_b
    C = mat_zeros(rows_a, cols_b)
    for i in range(rows_a):
        for j in range(cols_b):
            s = 0.0
            for k in range(cols_a):
                s += A[i][k] * B[k][j]
            C[i][j] = s
    return C


def mat_transpose(A):
    rows, cols = len(A), len(A[0])
    return [[A[i][j] for i in range(rows)] for j in range(cols)]


def mat_scalar_mul(A, s):
    rows, cols = len(A), len(A[0])
    return [[A[i][j] * s for j in range(cols)] for i in range(rows)]


def mat_hadamard(A, B):
    rows, cols = len(A), len(A[0])
    return [[A[i][j] * B[i][j] for j in range(cols)] for i in range(rows)]


def mat_sum_rows(A):
    rows, cols = len(A), len(A[0])
    return [[sum(A[i][j] for i in range(rows))] for j in range(cols)]


def mat_mean(A):
    rows, cols = len(A), len(A[0])
    total = sum(A[i][j] for i in range(rows) for j in range(cols))
    return total / (rows * cols)


def mat_apply(A, func):
    rows, cols = len(A), len(A[0])
    return [[func(A[i][j]) for j in range(cols)] for i in range(rows)]


# ------------------------------------------------------------------
# MLP with manual back-propagation
# ------------------------------------------------------------------
class MLP:
    def __init__(self, input_dim, hidden_dim, output_dim, seed=SEED):
        random.seed(seed)

        # Layer 1: input -> hidden
        self.W1 = [[random.gauss(0.0, 1.0) for _ in range(hidden_dim)] for _ in range(input_dim)]
        self.b1 = [[0.0] * hidden_dim]

        # Layer 2: hidden -> output
        self.W2 = [[random.gauss(0.0, 1.0) for _ in range(output_dim)] for _ in range(hidden_dim)]
        self.b2 = [[0.0] * output_dim]

    # --------------------------------------------------------------
    # Forward pass
    # --------------------------------------------------------------
    def forward(self, x):
        self.z1 = mat_add(mat_mul(x, self.W1), self.b1)
        self.a1 = mat_apply(self.z1, sigmoid)

        self.z2 = mat_add(mat_mul(self.a1, self.W2), self.b2)
        self.a2 = mat_apply(self.z2, sigmoid)

        return self.a2

    # --------------------------------------------------------------
    # Backward pass — chain rule applied manually
    # --------------------------------------------------------------
    def backward(self, x, y):
        m = len(x)

        # Output layer error
        dz2 = mat_hadamard(mat_sub(self.a2, y), mat_apply(self.a2, sigmoid_derivative))
        dW2 = mat_scalar_mul(mat_mul(mat_transpose(self.a1), dz2), 1.0 / m)
        db2 = mat_transpose(mat_sum_rows(dz2))
        db2 = mat_scalar_mul(db2, 1.0 / m)

        # Hidden layer error — back-propagated from output layer
        dz1 = mat_hadamard(mat_mul(dz2, mat_transpose(self.W2)), mat_apply(self.a1, sigmoid_derivative))
        dW1 = mat_scalar_mul(mat_mul(mat_transpose(x), dz1), 1.0 / m)
        db1 = mat_transpose(mat_sum_rows(dz1))
        db1 = mat_scalar_mul(db1, 1.0 / m)

        return dW1, db1, dW2, db2

    # --------------------------------------------------------------
    # Parameter update — stochastic gradient descent
    # --------------------------------------------------------------
    def update(self, dW1, db1, dW2, db2, lr=LR):
        self.W1 = mat_sub(self.W1, mat_scalar_mul(dW1, lr))
        self.b1 = mat_sub(self.b1, mat_scalar_mul(db1, lr))
        self.W2 = mat_sub(self.W2, mat_scalar_mul(dW2, lr))
        self.b2 = mat_sub(self.b2, mat_scalar_mul(db2, lr))

    # --------------------------------------------------------------
    # Training loop
    # --------------------------------------------------------------
    def train(self, x, y, epochs=EPOCHS, lr=LR):
        for epoch in range(epochs):
            out = self.forward(x)
            diff = mat_sub(out, y)
            sq = mat_hadamard(diff, diff)
            loss = mat_mean(sq) * 0.5

            dW1, db1, dW2, db2 = self.backward(x, y)
            self.update(dW1, db1, dW2, db2, lr)

            if epoch % 1000 == 0:
                print(f"Epoch {epoch:5d} | Loss: {loss:.6f}")

        return loss

    # --------------------------------------------------------------
    # Inference
    # --------------------------------------------------------------
    def predict(self, x):
        return self.forward(x)


# ------------------------------------------------------------------
# Main sanity check
# ------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("Backpropagation (Rumelhart et al., 1986)")
    print("=" * 60)

    model = MLP(INPUT_DIM, HIDDEN_DIM, OUTPUT_DIM)
    print(f"\nArchitecture: {INPUT_DIM}-{HIDDEN_DIM}-{OUTPUT_DIM}")
    print(f"Total parameters: {INPUT_DIM*HIDDEN_DIM + HIDDEN_DIM + HIDDEN_DIM*OUTPUT_DIM + OUTPUT_DIM}")

    print("\n--- Training ---")
    final_loss = model.train(X, Y, epochs=EPOCHS, lr=LR)

    print("\n--- Evaluation ---")
    preds = model.predict(X)
    for xi, yi, pi in zip(X, Y, preds):
        print(f"Input: {xi} | Target: {yi[0]} | Prediction: {pi[0]:.6f}")

    print(f"\nFinal MSE Loss: {final_loss:.6f}")
    rounded = [round(p[0]) for p in preds]
    print(f"All predictions rounded: {rounded}")
