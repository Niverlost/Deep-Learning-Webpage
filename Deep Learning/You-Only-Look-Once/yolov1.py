"""
YOLOv1 — PyTorch Implementation
Paper: "You Only Look Once: Unified, Real-Time Object Detection"
       (Redmon et al., CVPR 2016, arXiv:1506.02640)

Architecture follows Table 1 in the paper exactly:
  - 24 convolutional layers + 2 fully-connected layers
  - Leaky ReLU (negative_slope=0.1) after every conv and the first FC
  - Dropout (p=0.5) between the two FC layers
  - Final output: (S, S, B*5 + C)  with S=7, B=2, C=20 → (7, 7, 30)
"""

import torch
import torch.nn as nn

# ---------------------------------------------------------------------------
# Configuration (from the paper)
# ---------------------------------------------------------------------------
S = 7          # grid size
B = 2          # number of bounding boxes per cell
C = 20         # number of classes (PASCAL VOC)

# ---------------------------------------------------------------------------
# Helper: a single Conv → LeakyReLU block (BatchNorm is NOT used in YOLOv1)
# ---------------------------------------------------------------------------
class ConvBlock(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_size, stride=1, padding=0):
        super().__init__()
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size, stride, padding, bias=False)
        self.lrelu = nn.LeakyReLU(negative_slope=0.1, inplace=True)

    def forward(self, x):
        return self.lrelu(self.conv(x))

# ---------------------------------------------------------------------------
# Backbone: 24 convolutional layers grouped by spatial-resolution stages
# ---------------------------------------------------------------------------
class Backbone(nn.Module):
    def __init__(self):
        super().__init__()

        # ----- Stage 1:  448 -> 112 -------------------------------------------------
        self.stage1 = nn.Sequential(
            ConvBlock(3, 64, 7, stride=2, padding=3),    # 448 -> 224
            nn.MaxPool2d(2, 2),                            # 224 -> 112
        )

        # ----- Stage 2: 112 -> 56 ---------------------------------------------------
        self.stage2 = nn.Sequential(
            ConvBlock(64, 192, 3, padding=1),             # 112 -> 112
            nn.MaxPool2d(2, 2),                            # 112 -> 56
        )

        # ----- Stage 3: 56 -> 28 ----------------------------------------------------
        self.stage3 = nn.Sequential(
            ConvBlock(192, 128, 1),
            ConvBlock(128, 256, 3, padding=1),
            ConvBlock(256, 256, 1),
            ConvBlock(256, 512, 3, padding=1),
            nn.MaxPool2d(2, 2),                            # 56 -> 28
        )

        # ----- Stage 4: 28 -> 14 ----------------------------------------------------
        # Four repetitions of 1x1→3x3
        self.stage4 = nn.Sequential(
            ConvBlock(512, 256, 1),
            ConvBlock(256, 512, 3, padding=1),
            ConvBlock(512, 256, 1),
            ConvBlock(256, 512, 3, padding=1),
            ConvBlock(512, 256, 1),
            ConvBlock(256, 512, 3, padding=1),
            ConvBlock(512, 256, 1),
            ConvBlock(256, 512, 3, padding=1),
            ConvBlock(512, 512, 1),
            ConvBlock(512, 1024, 3, padding=1),
            nn.MaxPool2d(2, 2),                            # 28 -> 14
        )

        # ----- Stage 5: 14 -> 7 -----------------------------------------------------
        self.stage5 = nn.Sequential(
            ConvBlock(1024, 512, 1),
            ConvBlock(512, 1024, 3, padding=1),
            ConvBlock(1024, 512, 1),
            ConvBlock(512, 1024, 3, padding=1),
            ConvBlock(1024, 1024, 3, padding=1),
            ConvBlock(1024, 1024, 3, stride=2, padding=1),  # 14 -> 7
        )

        # ----- Stage 6: 7 -> 7 ------------------------------------------------------
        self.stage6 = nn.Sequential(
            ConvBlock(1024, 1024, 3, padding=1),
            ConvBlock(1024, 1024, 3, padding=1),
        )

    def forward(self, x):
        x = self.stage1(x)
        x = self.stage2(x)
        x = self.stage3(x)
        x = self.stage4(x)
        x = self.stage5(x)
        x = self.stage6(x)
        return x                                    # (B, 1024, 7, 7)

# ---------------------------------------------------------------------------
# Fully-connected detection head
# ---------------------------------------------------------------------------
class DetectionHead(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(1024 * 7 * 7, 4096)
        self.lrelu = nn.LeakyReLU(negative_slope=0.1, inplace=True)
        self.dropout = nn.Dropout(p=0.5)
        self.fc2 = nn.Linear(4096, S * S * (B * 5 + C))

    def forward(self, x):
        x = torch.flatten(x, start_dim=1)
        x = self.lrelu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        return x                                    # (B, 1470)

# ---------------------------------------------------------------------------
# Full YOLOv1 model
# ---------------------------------------------------------------------------
class YOLOv1(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = Backbone()
        self.head = DetectionHead()

    def forward(self, x):
        x = self.backbone(x)
        x = self.head(x)
        x = x.view(-1, S, S, B * 5 + C)            # (B, 7, 7, 30)
        # Permute to (B, C + B*5, S, S) i.e. (B, 30, 7, 7) for loss computation
        x = x.permute(0, 3, 1, 2)
        return x


# ---------------------------------------------------------------------------
# Quick sanity check when run directly
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = YOLOv1()
    dummy = torch.randn(2, 3, 448, 448)
    out = model(dummy)
    print(f"Input : {dummy.shape}")
    print(f"Output: {out.shape}")
    print(f"Expected: (2, {B*5+C}, {S}, {S}) = (2, 30, 7, 7)")
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,}")
