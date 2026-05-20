"""
Backpropagation — PyTorch Implementation (Manual, from first principles)
Paper: "Learning representations by back-propagating errors"
       (Rumelhart, Hinton & Williams, Nature 1986, Vol. 323, pp. 533–536)

This code implements the exact algorithm described in the 1986 paper:
  - Feedforward multi-layer network with sigmoid (logistic) units
  - Error measure: E = 0.5 * Σ (target - output)²   (Equation in Fig 1)
  - Backward pass using the chain rule:
      δ_j = (t_j - o_j) · o_j · (1 - o_j)                    (output layer)
      δ_j = o_j · (1 - o_j) · Σ_k δ_k · w_{jk}               (hidden layer)
  - Weight update: Δw_{ij} = η · δ_j · o_i                    (Eq. 7)
  - Momentum:      Δw_{ij}(n+1) = η·δ_j·o_i + α·Δw_{ij}(n)    (Eq. 8)
  - Bias weights are learned identically (always-on input = 1)

Paper demonstrations reproduced here:
  1. XOR (exclusive-OR) — a classic non-linearly separable problem
  2. Family resemblance task (structured binary patterns)
"""

import math
import torch

# Configuration matching the paper's standard setup
LEARNING_RATE = 0.5
MOMENTUM = 0.9
SEED = 42


# ---------------------------------------------------------------------------
# Sigmoid unit  (the "neurone-like unit" from the paper)
# ---------------------------------------------------------------------------
def sigmoid(x):
    """Logistic sigmoid activation: o_j = 1 / (1 + exp(-net_j))."""
    return 1.0 / (1.0 + torch.exp(-x))


def sigmoid_derivative(o):
    """Derivative of logistic sigmoid: o_j * (1 - o_j)."""
    return o * (1.0 - o)


# ---------------------------------------------------------------------------
# Fully-connected layer (manual — no nn.Linear)
# ---------------------------------------------------------------------------
class LinearLayer:
    """
    A single layer of the network.

    Stores its own weights, biases, and momentum deltas exactly as the
    paper describes: every unit is a 'neurone-like unit' with a logistic
    activation function.
    """

    def __init__(self, n_input, n_output, lr=LEARNING_RATE, momentum=MOMENTUM):
        self.lr = lr
        self.momentum = momentum

        # Weight init: small random values (paper uses [-0.3, 0.3])
        self.weights = (torch.rand(n_output, n_input) - 0.5) * 0.6
        self.bias = (torch.rand(n_output) - 0.5) * 0.6

        # Momentum buffers
        self.dw = torch.zeros_like(self.weights)
        self.db = torch.zeros_like(self.bias)

        # Cache for backward pass
        self.input = None    # raw input x
        self.act = None      # sigmoid activation output

    def forward(self, x):
        """Forward pass: compute net input -> apply sigmoid."""
        self.input = x  # (batch, n_input)
        net = x @ self.weights.T + self.bias  # (batch, n_output)
        self.act = sigmoid(net)
        return self.act

    def backward(self, delta):
        """
        Backward pass (paper Eq. 6-8).

        Args:
            delta: gradient dE/d(net_output), shape (batch, n_output)
                   i.e. already multiplied by sigmoid'(net)

        Returns:
            delta_prev: gradient for the layer below, (batch, n_input)
        """
        # delta_w = delta_j * o_i  summed over patterns (Eq. 7)
        grad_w = delta.T @ self.input  # (n_output, n_input)
        grad_b = delta.sum(dim=0)      # (n_output,)

        # Update with momentum (Eq. 8)
        self.dw = self.momentum * self.dw + self.lr * grad_w
        self.db = self.momentum * self.db + self.lr * grad_b
        self.weights = self.weights + self.dw
        self.bias = self.bias + self.db

        # delta for the previous layer:
        #   delta_prev_j = sigmoid'(input_j) * sum_k delta_k * w_jk   (Eq. 6)
        delta_prev = (delta @ self.weights) * sigmoid_derivative(self.input)
        return delta_prev


# ---------------------------------------------------------------------------
# Multi-Layer Network (the paper's full model)
# ---------------------------------------------------------------------------
class BackpropNetwork:
    """
    Feedforward network trained by back-propagating errors.

    Exactly mirrors the description in Rumelhart, Hinton & Williams (1986):
      - Layered structure of deterministic, neuron-like units
      - Logistic activation for all hidden and output units
      - Half squared-error loss
      - Gradient descent via the chain rule (back-propagation)
      - Optional momentum term to accelerate learning
    """

    def __init__(self, layer_sizes, lr=LEARNING_RATE, momentum=MOMENTUM):
        """
        Args:
            layer_sizes: list of ints, e.g. [2, 4, 1]  →  2 inputs → 4 hidden → 1 output
            lr: learning rate (η)
            momentum: momentum factor (α)
        """
        self.layers = []
        for i in range(len(layer_sizes) - 1):
            self.layers.append(
                LinearLayer(layer_sizes[i], layer_sizes[i + 1], lr, momentum)
            )

    def forward(self, x):
        """Run a forward pass through all layers."""
        for layer in self.layers:
            x = layer.forward(x)
        return x

    def backward(self, target):
        """
        Backward pass: compute output error and propagate it back.

        Paper equations used:
          Output layer:  δ_j = (t_j - o_j) · o_j · (1 - o_j)
          Hidden layer:  δ_j = o_j · (1 - o_j) · Σ_k δ_k · w_{jk}
        """
        # Output error (Eq. bottom of p.534)
        output = self.layers[-1].act
        delta = (target - output) * sigmoid_derivative(output)

        # Propagate backward through all layers
        for layer in reversed(self.layers):
            delta = layer.backward(delta)

    def train_step(self, x, target):
        """Single training step: forward + backward."""
        self.forward(x)
        self.backward(target)
        loss = 0.5 * ((target - self.layers[-1].act) ** 2).sum() / target.size(0)
        return loss.item()

    def predict(self, x):
        """Forward pass with no side effects (for inference)."""
        with torch.no_grad():
            for layer in self.layers:
                x = sigmoid(x @ layer.weights.T + layer.bias)
        return x


# ---------------------------------------------------------------------------
# Demo 1: XOR (exclusive-OR) — the classic non-linear test
# ---------------------------------------------------------------------------
def demo_xor():
    print("=" * 54)
    print("Demo 1: XOR - the classic non-linearly separable problem")
    print("=" * 54)

    torch.manual_seed(SEED)
    net = BackpropNetwork([2, 4, 1], lr=0.5, momentum=0.9)

    # XOR dataset
    X = torch.tensor([[0.0, 0.0],
                      [0.0, 1.0],
                      [1.0, 0.0],
                      [1.0, 1.0]])
    y = torch.tensor([[0.0], [1.0], [1.0], [0.0]])

    epochs = 2000
    for epoch in range(epochs):
        loss = net.train_step(X, y)
        if epoch % 400 == 0:
            print(f"  epoch {epoch:4d}  —  loss = {loss:.6f}")

    print(f"  epoch {epochs-1:4d}  --  loss = {loss:.6f}")
    print()

    # Final predictions
    preds = net.predict(X)
    print("  XOR results (paper Fig. 2 - family resemblance task):")
    for i, (inp, target) in enumerate(zip(X, y)):
        print(f"    {inp.tolist()} -> {preds[i].item():.4f}  (target {target.item()})")

    correct = ((preds > 0.5) == (y > 0.5)).sum().item()
    print(f"\n  Accuracy: {correct}/4 correct")
    print()


# ---------------------------------------------------------------------------
# Demo 2: Binary parity / family resemblance (similar to paper Fig. 2)
# ---------------------------------------------------------------------------
def demo_parity():
    print("=" * 54)
    print("Demo 2: 3-bit parity - structure discovery by hidden units")
    print("=" * 54)
    print("  (Similar to the 'family resemblance' task in Fig. 2 of the paper)")
    print()

    torch.manual_seed(SEED)
    net = BackpropNetwork([3, 6, 1], lr=0.5, momentum=0.9)

    # 3-bit parity: output = sum of bits mod 2
    X = torch.tensor([[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1],
                      [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]],
                     dtype=torch.float)
    y = torch.tensor([[0], [1], [1], [0], [1], [0], [0], [1]],
                     dtype=torch.float)

    epochs = 3000
    for epoch in range(epochs):
        loss = net.train_step(X, y)
        if epoch % 600 == 0:
            print(f"  epoch {epoch:4d}  --  loss = {loss:.6f}")

    print(f"  epoch {epochs-1:4d}  --  loss = {loss:.6f}")
    print()

    preds = net.predict(X)
    print("  Parity predictions (each input -> predicted output):")
    for i, (inp, target) in enumerate(zip(X, y)):
        flag = "OK" if (preds[i].item() > 0.5) == (target.item() > 0.5) else "XX"
        print(f"    {inp.tolist()} -> {preds[i].item():.4f}  (target {int(target.item())})  {flag}")
    print()


# ---------------------------------------------------------------------------
# Demo 3: Manual backpropagation from first principles (the paper's math)
# ---------------------------------------------------------------------------
def demo_manual_xor():
    print("=" * 54)
    print("Demo 3: Manual backprop - showing the paper's math step by step")
    print("=" * 54)
    print("  This replicates the paper's algorithm using raw tensor ops,")
    print("  without any abstracted 'layer' objects.")
    print()

    torch.manual_seed(SEED)
    n_input, n_hidden, n_output = 2, 4, 1
    lr, alpha = 0.5, 0.9

    # Random initial weights (small, as in the paper)
    W1 = (torch.rand(n_hidden, n_input) - 0.5) * 0.6
    b1 = (torch.rand(n_hidden) - 0.5) * 0.6
    W2 = (torch.rand(n_output, n_hidden) - 0.5) * 0.6
    b2 = (torch.rand(n_output) - 0.5) * 0.6

    # Momentum buffers
    dW1 = torch.zeros_like(W1)
    db1 = torch.zeros_like(b1)
    dW2 = torch.zeros_like(W2)
    db2 = torch.zeros_like(b2)

    # XOR data
    X = torch.tensor([[0.0, 0.0], [0.0, 1.0], [1.0, 0.0], [1.0, 1.0]])
    y = torch.tensor([[0.0], [1.0], [1.0], [0.0]])

    for epoch in range(2001):
        # ---- Forward pass (Eq. 1-3 in the paper: net → o) ----
        h_net = X @ W1.T + b1    # hidden layer net input
        h = sigmoid(h_net)        # hidden layer activation  (Eq. 1)
        o_net = h @ W2.T + b2    # output layer net input
        o = sigmoid(o_net)        # output layer activation  (Eq. 2)

        # ---- Error measure (half squared error, Fig 1) ----
        loss = 0.5 * ((y - o) ** 2).sum() / X.size(0)

        # ---- Backward pass (chain rule, Fig 2) ----
        # Output error: delta_k = (t_k - o_k) * o_k * (1 - o_k)   (Eq. in Fig 2)
        delta_o = (y - o) * sigmoid_derivative(o)

        # Hidden error: delta_j = o_j * (1 - o_j) * sum_k delta_k * w_jk  (Eq. 6)
        delta_h = sigmoid_derivative(h) * (delta_o @ W2)

        # ---- Weight updates ----
        # delta_w = eta * delta_j * o_i  (Eq. 7), with momentum (Eq. 8)
        dW2 = alpha * dW2 + lr * (delta_o.T @ h)
        db2 = alpha * db2 + lr * delta_o.sum(dim=0)
        dW1 = alpha * dW1 + lr * (delta_h.T @ X)
        db1 = alpha * db1 + lr * delta_h.sum(dim=0)

        W2 = W2 + dW2
        b2 = b2 + db2
        W1 = W1 + dW1
        b1 = b1 + db1

        if epoch % 500 == 0:
            print(f"  epoch {epoch:4d}  --  loss = {loss.item():.6f}")

    with torch.no_grad():
        h = sigmoid(X @ W1.T + b1)
        o = sigmoid(h @ W2.T + b2)
        print(f"  epoch {2000:4d}  --  loss = {loss.item():.6f}")
        print()
        for inp, target, pred in zip(X, y, o):
            print(f"    {inp.tolist()} -> {pred.item():.4f}  (target {int(target.item())})")
    print()


# ---------------------------------------------------------------------------
# Main: run all demos
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    demo_xor()
    demo_parity()
    demo_manual_xor()
