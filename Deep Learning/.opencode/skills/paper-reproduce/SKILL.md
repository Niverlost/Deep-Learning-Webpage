---
name: paper-reproduce
description: >
  Reproduce a deep learning paper's model architecture 1:1 in PyTorch.
  Use when the user asks to "reproduce", "implement", "replicate", or "复现"
  a named paper/model (e.g. YOLOv1, ResNet, Transformer). Use ONLY for
  imaging/ML papers with a specific architecture table or figure; do NOT
  use for general coding tasks.
---

# Paper Reproduce Workflow

## Steps

### 1. Research the paper

- Search the web for the user-mentioned model paper (original + any early versions).
- Read the paper thoroughly, especially the **architecture section**, **table of layers**, and any **figure showing the network structure**.
- Search supplementary resources (blog posts, existing implementations, reviews) to clarify ambiguous details.
- Identify key architectural hyperparameters: input size, output tensor shape, number of layers/channels, kernel sizes, strides, paddings, activation functions, normalization, dropout, etc.
- Note: some papers (e.g. YOLOv1) do not use BatchNorm — do not add it unless the paper explicitly says so.

### 2. Write the 1:1 PyTorch implementation

- Create a single `.py` file with clean, well-structured code.
- The code must be **beginner-friendly**: use descriptive variable names, logical grouping, and short comments where the paper's architecture deviates from modern conventions.
- Structure as follows (in order):
  1. **Header docstring**: paper title, authors, year, and a short note on what this file is.
  2. **Configuration constants** (e.g. `S=7`, `B=2`, `C=20` for YOLOv1).
  3. **Helper blocks**: reusable `nn.Module` sub-blocks (e.g. `ConvBlock` for Conv+Activation).
  4. **Backbone / encoder**: the feature extractor, grouped by spatial-resolution stages.
  5. **Detection head / decoder / classifier**: the task-specific layers after the backbone.
  6. **Full model**: `nn.Module` that composes backbone + head, including any final reshape/permute to match the paper's output tensor.
  7. **`__main__` sanity check**: create a dummy input, run forward pass, print input/output shapes and total parameter count.
- Follow the paper's layer table **exactly** — kernel size, stride, padding, number of channels, number of repeats.
- Activation: paper typically uses LeakyReLU(0.1). Do NOT add BatchNorm unless the paper uses it.
- Do **not** add extraneous comments or emoji.
- Do **not** write the loss function, training loop, or data loader unless the user explicitly asks.

### 3. Verify the implementation

- Run the file with `python <filename>.py`.
- Confirm:
  - Output tensor shape matches the paper (e.g. `(B, 30, 7, 7)` for YOLOv1).
  - No runtime errors.
  - Parameter count is reasonable (check against paper if reported).
- Fix any errors.

### 4. Save & organize

- Create a folder named after the paper title (e.g. `You-Only-Look-Once`).
- Save both the paper PDF (downloaded from arXiv or other source) and the `.py` file into that folder.
- If the paper cannot be downloaded as PDF, save a `.txt` or `.md` summary of the architecture alongside the code.
