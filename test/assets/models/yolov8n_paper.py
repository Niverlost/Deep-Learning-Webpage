"""
YOLOv8-N (Nano) Object Detection Model
Paper: Ultralytics YOLOv8
Authors: Glenn Jocher, Ayush Chaurasia, Jing Qiu
Year: 2023
Link: https://github.com/ultralytics/ultralytics

This is the paper-faithful implementation of YOLOv8-N.
Input: 640 x 640 RGB image
Output: 3-scale detection maps (P3: 80x80, P4: 40x40, P5: 20x20)
Parameters: ~3.2M
"""

import torch
import torch.nn as nn


# ------------------------------------------------------------------------------
# Configuration Constants
# ------------------------------------------------------------------------------
NC = 80              # number of classes (COCO)
INPUT_SIZE = 640     # input image size
REG_MAX = 16         # DFL channels

# YOLOv8n depth/width scales
DEPTH_MULTIPLE = 0.33
WIDTH_MULTIPLE = 0.25
MAX_CHANNELS = 1024

# Base channels for each stage (before width scaling)
BASE_CHANNELS = [64, 128, 256, 512, 1024]

# Stage repeats (before depth scaling)
BACKBONE_REPEATS = [3, 6, 6, 3]  # C2f repeats at P2, P3, P4, P5
NECK_REPEATS = [3, 3, 3]         # C2f repeats in PANet


def make_divisible(v, divisor=8, min_value=None):
    """Ensure channel count is divisible by divisor."""
    if min_value is None:
        min_value = divisor
    new_v = max(min_value, int(v + divisor / 2) // divisor * divisor)
    if new_v < 0.9 * v:
        new_v += divisor
    return new_v


def autopad(k, p=None, d=1):
    """Auto padding to keep spatial resolution with stride=1."""
    if d > 1:
        k = d * (k - 1) + 1 if isinstance(k, int) else [d * (x - 1) + 1 for x in k]
    if p is None:
        p = k // 2 if isinstance(k, int) else [x // 2 for x in k]
    return p


# ------------------------------------------------------------------------------
# Basic Blocks
# ------------------------------------------------------------------------------
class Conv(nn.Module):
    """Standard convolution: Conv2d + BatchNorm + SiLU."""

    def __init__(self, c1, c2, k=1, s=1, p=None, g=1, d=1, act=True):
        super().__init__()
        self.conv = nn.Conv2d(c1, c2, k, s, autopad(k, p, d), groups=g, dilation=d, bias=False)
        self.bn = nn.BatchNorm2d(c2)
        self.act = nn.SiLU() if act is True else (act if isinstance(act, nn.Module) else nn.Identity())

    def forward(self, x):
        return self.act(self.bn(self.conv(x)))


class Bottleneck(nn.Module):
    """Standard bottleneck with optional shortcut."""

    def __init__(self, c1, c2, shortcut=True, g=1, k=(3, 3), e=0.5):
        super().__init__()
        c_ = int(c2 * e)
        self.cv1 = Conv(c1, c_, k[0], 1)
        self.cv2 = Conv(c_, c2, k[1], 1, g=g)
        self.add = shortcut and c1 == c2

    def forward(self, x):
        return x + self.cv2(self.cv1(x)) if self.add else self.cv2(self.cv1(x))


class C2f(nn.Module):
    """CSP Bottleneck with 2 convolutions (C2f)."""

    def __init__(self, c1, c2, n=1, shortcut=False, g=1, e=0.5):
        super().__init__()
        self.c = int(c2 * e)
        self.cv1 = Conv(c1, 2 * self.c, 1, 1)
        self.cv2 = Conv((2 + n) * self.c, c2, 1)
        self.m = nn.ModuleList(Bottleneck(self.c, self.c, shortcut, g, k=((3, 3), (3, 3)), e=1.0) for _ in range(n))

    def forward(self, x):
        y = list(self.cv1(x).chunk(2, 1))
        y.extend(m(y[-1]) for m in self.m)
        return self.cv2(torch.cat(y, 1))


class SPPF(nn.Module):
    """Spatial Pyramid Pooling - Fast (SPPF)."""

    def __init__(self, c1, c2, k=5):
        super().__init__()
        c_ = c1 // 2
        self.cv1 = Conv(c1, c_, 1, 1)
        self.cv2 = Conv(c_ * 4, c2, 1, 1)
        self.m = nn.MaxPool2d(kernel_size=k, stride=1, padding=k // 2)

    def forward(self, x):
        x = self.cv1(x)
        y1 = self.m(x)
        y2 = self.m(y1)
        y3 = self.m(y2)
        return self.cv2(torch.cat([x, y1, y2, y3], 1))


class DFL(nn.Module):
    """Distribution Focal Loss. Integral part of bbox regression."""

    def __init__(self, c1=16):
        super().__init__()
        self.conv = nn.Conv2d(c1, 1, 1, bias=False)
        self.conv.weight.data = nn.Parameter(torch.arange(c1, dtype=torch.float32).view(1, c1, 1, 1))
        self.c1 = c1

    def forward(self, x):
        b, c, a = x.shape
        return self.conv(x.view(b, 4, self.c1, a).transpose(2, 1).softmax(1)).view(b, 4, a)


# ------------------------------------------------------------------------------
# Backbone: CSPDarknet (Enhanced)
# ------------------------------------------------------------------------------
class Backbone(nn.Module):
    """YOLOv8 backbone: P1 -> P2 -> P3 -> P4 -> P5."""

    def __init__(self, w, d, max_channels):
        super().__init__()
        c1 = make_divisible(BASE_CHANNELS[0] * w, 8)
        c2 = make_divisible(BASE_CHANNELS[1] * w, 8)
        c3 = make_divisible(BASE_CHANNELS[2] * w, 8)
        c4 = make_divisible(BASE_CHANNELS[3] * w, 8)
        c5 = min(make_divisible(BASE_CHANNELS[4] * w, 8), max_channels)

        # P1/2
        self.stem = Conv(3, c1, k=3, s=2)
        # P2/4
        self.conv1 = Conv(c1, c2, k=3, s=2)
        self.c2f_1 = C2f(c2, c2, n=max(round(BACKBONE_REPEATS[0] * d), 1), shortcut=True)
        # P3/8
        self.conv2 = Conv(c2, c3, k=3, s=2)
        self.c2f_2 = C2f(c3, c3, n=max(round(BACKBONE_REPEATS[1] * d), 1), shortcut=True)
        # P4/16
        self.conv3 = Conv(c3, c4, k=3, s=2)
        self.c2f_3 = C2f(c4, c4, n=max(round(BACKBONE_REPEATS[2] * d), 1), shortcut=True)
        # P5/32
        self.conv4 = Conv(c4, c5, k=3, s=2)
        self.c2f_4 = C2f(c5, c5, n=max(round(BACKBONE_REPEATS[3] * d), 1), shortcut=True)
        self.sppf = SPPF(c5, c5, k=5)

    def forward(self, x):
        x = self.stem(x)      # P1: 320x320
        x = self.conv1(x)     # P2: 160x160
        x = self.c2f_1(x)
        p3 = self.conv2(x)    # P3: 80x80
        p3 = self.c2f_2(p3)
        p4 = self.conv3(p3)   # P4: 40x40
        p4 = self.c2f_3(p4)
        p5 = self.conv4(p4)   # P5: 20x20
        p5 = self.c2f_4(p5)
        p5 = self.sppf(p5)
        return p3, p4, p5


# ------------------------------------------------------------------------------
# Neck: PANet (FPN + PAN)
# ------------------------------------------------------------------------------
class Neck(nn.Module):
    """PANet: top-down FPN + bottom-up PAN."""

    def __init__(self, w, d, max_channels):
        super().__init__()
        c3 = make_divisible(BASE_CHANNELS[2] * w, 8)
        c4 = make_divisible(BASE_CHANNELS[3] * w, 8)
        c5 = min(make_divisible(BASE_CHANNELS[4] * w, 8), max_channels)

        # FPN: top-down
        self.up = nn.Upsample(scale_factor=2, mode='nearest')
        self.c2f_p4 = C2f(c5 + c4, c4, n=max(round(NECK_REPEATS[0] * d), 1), shortcut=False)
        self.c2f_p3 = C2f(c4 + c3, c3, n=max(round(NECK_REPEATS[1] * d), 1), shortcut=False)

        # PAN: bottom-up
        self.conv_p4 = Conv(c3, c3, k=3, s=2)
        self.c2f_n4 = C2f(c3 + c4, c4, n=max(round(NECK_REPEATS[2] * d), 1), shortcut=False)
        self.conv_p5 = Conv(c4, c4, k=3, s=2)
        self.c2f_n5 = C2f(c4 + c5, c5, n=max(round(NECK_REPEATS[2] * d), 1), shortcut=False)

    def forward(self, p3, p4, p5):
        # FPN
        f4 = self.c2f_p4(torch.cat([self.up(p5), p4], dim=1))
        f3 = self.c2f_p3(torch.cat([self.up(f4), p3], dim=1))
        # PAN
        n4 = self.c2f_n4(torch.cat([self.conv_p4(f3), f4], dim=1))
        n5 = self.c2f_n5(torch.cat([self.conv_p5(n4), p5], dim=1))
        return f3, n4, n5


# ------------------------------------------------------------------------------
# Head: Decoupled Head (Anchor-Free)
# ------------------------------------------------------------------------------
class Detect(nn.Module):
    """Decoupled detection head with DFL bbox regression."""

    def __init__(self, nc=80, reg_max=16, ch=()):
        super().__init__()
        self.nc = nc
        self.nl = len(ch)
        self.reg_max = reg_max
        self.no = nc + reg_max * 4

        c2 = max(16, ch[0] // 4, reg_max * 4)
        c3 = max(ch[0], min(nc, 100))

        self.cv2 = nn.ModuleList(
            nn.Sequential(Conv(x, c2, 3), Conv(c2, c2, 3), nn.Conv2d(c2, 4 * reg_max, 1))
            for x in ch
        )
        self.cv3 = nn.ModuleList(
            nn.Sequential(
                nn.Sequential(Conv(x, x, 3, g=x), Conv(x, c3, 1)),
                nn.Sequential(Conv(c3, c3, 3, g=c3), Conv(c3, c3, 1)),
                nn.Conv2d(c3, nc, 1),
            )
            for x in ch
        )
        self.dfl = DFL(reg_max) if reg_max > 1 else nn.Identity()

    def forward(self, x):
        for i in range(self.nl):
            x[i] = torch.cat((self.cv2[i](x[i]), self.cv3[i](x[i])), 1)
        return x


# ------------------------------------------------------------------------------
# Full Model
# ------------------------------------------------------------------------------
class YOLOv8n(nn.Module):
    """YOLOv8-Nano object detection model."""

    def __init__(self, nc=NC):
        super().__init__()
        self.backbone = Backbone(WIDTH_MULTIPLE, DEPTH_MULTIPLE, MAX_CHANNELS)
        self.neck = Neck(WIDTH_MULTIPLE, DEPTH_MULTIPLE, MAX_CHANNELS)

        ch = [
            make_divisible(BASE_CHANNELS[2] * WIDTH_MULTIPLE, 8),
            make_divisible(BASE_CHANNELS[3] * WIDTH_MULTIPLE, 8),
            min(make_divisible(BASE_CHANNELS[4] * WIDTH_MULTIPLE, 8), MAX_CHANNELS),
        ]
        self.head = Detect(nc=nc, reg_max=REG_MAX, ch=tuple(ch))

    def forward(self, x):
        p3, p4, p5 = self.backbone(x)
        f3, n4, n5 = self.neck(p3, p4, p5)
        return self.head([f3, n4, n5])


# ------------------------------------------------------------------------------
# Sanity Check
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    model = YOLOv8n(nc=80)
    x = torch.randn(1, 3, 640, 640)
    y = model(x)

    print(f"Input shape:  {x.shape}")
    print(f"P3 output:    {y[0].shape}")
    print(f"P4 output:    {y[1].shape}")
    print(f"P5 output:    {y[2].shape}")

    params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {params:,} ({params / 1e6:.2f}M)")
