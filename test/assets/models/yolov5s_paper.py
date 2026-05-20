"""
YOLOv5: An Incremental Improvement
Glenn Jocher, Ultralytics
2020
GitHub: https://github.com/ultralytics/yolov5

Paper-faithful implementation of YOLOv5-S (small).
Activation: SiLU (Swish) with BatchNorm.
Input: 640 x 640 RGB images.
Output: 3-scale detections (P3/8, P4/16, P5/32).
Parameters: ~7.2M
"""

import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# Configuration constants (exact from yolov5s.yaml)
# ---------------------------------------------------------------------------
NC = 80                     # number of classes (COCO)
INPUT_SIZE = 640
DEPTH_MULTIPLE = 0.33       # model depth multiple
WIDTH_MULTIPLE = 0.50       # layer channel multiple

ANCHORS = [
    [10, 13, 16, 30, 33, 23],      # P3/8
    [30, 61, 62, 45, 59, 119],     # P4/16
    [116, 90, 156, 198, 373, 326], # P5/32
]


def _make_divisible(v, divisor=8):
    """Ensure channel count is divisible by divisor (for hardware efficiency)."""
    return int((v + divisor / 2) // divisor * divisor)


def _scale_channels(c, width_multiple=WIDTH_MULTIPLE, divisor=8):
    """Scale channels by width_multiple and round to divisible value."""
    return _make_divisible(c * width_multiple, divisor)


def _scale_depth(n, depth_multiple=DEPTH_MULTIPLE):
    """Scale number of blocks by depth_multiple; round up to nearest int."""
    return max(round(n * depth_multiple), 1) if n > 1 else n


# ---------------------------------------------------------------------------
# Architecture blocks
# ---------------------------------------------------------------------------
class Conv(nn.Module):
    """Standard convolution: Conv2d + BatchNorm2d + SiLU."""

    def __init__(self, c1, c2, k=1, s=1, p=None, g=1, act=True):
        super().__init__()
        self.conv = nn.Conv2d(c1, c2, k, s, autopad(k, p), groups=g, bias=False)
        self.bn = nn.BatchNorm2d(c2)
        self.act = nn.SiLU() if act is True else (act if isinstance(act, nn.Module) else nn.Identity())

    def forward(self, x):
        return self.act(self.bn(self.conv(x)))


def autopad(k, p=None):
    """Pad to 'same' output shape."""
    if p is None:
        p = k // 2 if isinstance(k, int) else [x // 2 for x in k]
    return p


class Bottleneck(nn.Module):
    """Residual bottleneck: 1x1 conv -> 3x3 conv with optional shortcut."""

    def __init__(self, c1, c2, shortcut=True, g=1, e=0.5):
        super().__init__()
        c_ = int(c2 * e)
        self.cv1 = Conv(c1, c_, 1, 1)
        self.cv2 = Conv(c_, c2, 3, 1, g=g)
        self.add = shortcut and c1 == c2

    def forward(self, x):
        return x + self.cv2(self.cv1(x)) if self.add else self.cv2(self.cv1(x))


class C3(nn.Module):
    """CSP Bottleneck with 3 convolutions (C3 block)."""

    def __init__(self, c1, c2, n=1, shortcut=True, g=1, e=0.5):
        super().__init__()
        c_ = int(c2 * e)
        self.cv1 = Conv(c1, c_, 1, 1)
        self.cv2 = Conv(c1, c_, 1, 1)
        self.cv3 = Conv(2 * c_, c2, 1)
        self.m = nn.Sequential(*(Bottleneck(c_, c_, shortcut, g, e=1.0) for _ in range(n)))

    def forward(self, x):
        return self.cv3(torch.cat((self.m(self.cv1(x)), self.cv2(x)), dim=1))


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
        return self.cv2(torch.cat((x, y1, y2, self.m(y2)), dim=1))


class Concat(nn.Module):
    """Concatenate a list of tensors along dimension."""

    def __init__(self, dimension=1):
        super().__init__()
        self.d = dimension

    def forward(self, x):
        return torch.cat(x, self.d)


class Detect(nn.Module):
    """YOLOv5 detection head for P3, P4, P5."""

    stride = None

    def __init__(self, nc=80, anchors=(), ch=(), inplace=True):
        super().__init__()
        self.nc = nc
        self.no = nc + 5
        self.nl = len(anchors)
        self.na = len(anchors[0]) // 2
        self.grid = [torch.empty(0) for _ in range(self.nl)]
        self.anchor_grid = [torch.empty(0) for _ in range(self.nl)]
        self.register_buffer("anchors", torch.tensor(anchors).float().view(self.nl, -1, 2))
        self.m = nn.ModuleList(nn.Conv2d(x, self.no * self.na, 1) for x in ch)
        self.inplace = inplace

    def forward(self, x):
        for i in range(self.nl):
            x[i] = self.m[i](x[i])
            bs, _, ny, nx = x[i].shape
            x[i] = x[i].view(bs, self.na, self.no, ny, nx).permute(0, 1, 3, 4, 2).contiguous()
        return x


# ---------------------------------------------------------------------------
# Backbone: CSPDarknet53
# ---------------------------------------------------------------------------
class Backbone(nn.Module):
    """YOLOv5-S backbone with C3 blocks and SPPF."""

    def __init__(self):
        super().__init__()
        # P1/2
        self.stem = Conv(3, _scale_channels(64), 6, 2, 2)
        # P2/4
        self.conv1 = Conv(_scale_channels(64), _scale_channels(128), 3, 2)
        self.c3_1 = C3(_scale_channels(128), _scale_channels(128), n=_scale_depth(3), shortcut=True)
        # P3/8
        self.conv2 = Conv(_scale_channels(128), _scale_channels(256), 3, 2)
        self.c3_2 = C3(_scale_channels(256), _scale_channels(256), n=_scale_depth(6), shortcut=True)
        # P4/16
        self.conv3 = Conv(_scale_channels(256), _scale_channels(512), 3, 2)
        self.c3_3 = C3(_scale_channels(512), _scale_channels(512), n=_scale_depth(9), shortcut=True)
        # P5/32
        self.conv4 = Conv(_scale_channels(512), _scale_channels(1024), 3, 2)
        self.c3_4 = C3(_scale_channels(1024), _scale_channels(1024), n=_scale_depth(3), shortcut=True)
        self.sppf = SPPF(_scale_channels(1024), _scale_channels(1024), k=5)

    def forward(self, x):
        x = self.stem(x)       # P1/2
        x = self.conv1(x)
        x = self.c3_1(x)       # P2/4
        x = self.conv2(x)
        c3 = self.c3_2(x)      # P3/8  -> saved for neck
        x = self.conv3(c3)
        c4 = self.c3_3(x)      # P4/16 -> saved for neck
        x = self.conv4(c4)
        x = self.c3_4(x)       # P5/32
        x = self.sppf(x)
        return c3, c4, x


# ---------------------------------------------------------------------------
# Neck: PANet (FPN + PAN)
# ---------------------------------------------------------------------------
class Neck(nn.Module):
    """YOLOv5-S PANet neck."""

    def __init__(self):
        super().__init__()
        c3_out = _scale_channels(256)
        c4_out = _scale_channels(512)
        c5_out = _scale_channels(1024)

        # FPN: top-down
        self.conv_p5 = Conv(c5_out, _scale_channels(512), 1, 1)
        self.upsample1 = nn.Upsample(scale_factor=2, mode="nearest")
        self.concat1 = Concat(dimension=1)
        self.c3_fpn1 = C3(c4_out + _scale_channels(512), _scale_channels(512), n=_scale_depth(3), shortcut=False)

        self.conv_p4 = Conv(_scale_channels(512), _scale_channels(256), 1, 1)
        self.upsample2 = nn.Upsample(scale_factor=2, mode="nearest")
        self.concat2 = Concat(dimension=1)
        self.c3_fpn2 = C3(c3_out + _scale_channels(256), _scale_channels(256), n=_scale_depth(3), shortcut=False)

        # PAN: bottom-up
        self.conv_n3 = Conv(_scale_channels(256), _scale_channels(256), 3, 2)
        self.concat3 = Concat(dimension=1)
        self.c3_pan1 = C3(_scale_channels(512) + _scale_channels(256), _scale_channels(512), n=_scale_depth(3), shortcut=False)

        self.conv_n4 = Conv(_scale_channels(512), _scale_channels(512), 3, 2)
        self.concat4 = Concat(dimension=1)
        self.c3_pan2 = C3(_scale_channels(512) + _scale_channels(512), _scale_channels(1024), n=_scale_depth(3), shortcut=False)

    def forward(self, c3, c4, c5):
        # FPN
        p5 = self.conv_p5(c5)
        x = self.upsample1(p5)
        x = self.concat1([x, c4])
        p4 = self.c3_fpn1(x)

        x = self.conv_p4(p4)
        x = self.upsample2(x)
        x = self.concat2([x, c3])
        p3 = self.c3_fpn2(x)

        # PAN
        x = self.conv_n3(p3)
        x = self.concat3([x, p4])
        n4 = self.c3_pan1(x)

        x = self.conv_n4(n4)
        x = self.concat4([x, p5])
        n5 = self.c3_pan2(x)

        return p3, n4, n5


# ---------------------------------------------------------------------------
# Full model
# ---------------------------------------------------------------------------
class YOLOv5s(nn.Module):
    """YOLOv5-S object detector."""

    def __init__(self, nc=NC, anchors=ANCHORS):
        super().__init__()
        self.backbone = Backbone()
        self.neck = Neck()
        self.head = Detect(nc=nc, anchors=anchors, ch=[
            _scale_channels(256),
            _scale_channels(512),
            _scale_channels(1024),
        ])

    def forward(self, x):
        c3, c4, c5 = self.backbone(x)
        p3, p4, p5 = self.neck(c3, c4, c5)
        return self.head([p3, p4, p5])


# ---------------------------------------------------------------------------
# Sanity check
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    model = YOLOv5s(nc=NC, anchors=ANCHORS)
    dummy = torch.randn(1, 3, INPUT_SIZE, INPUT_SIZE)
    out = model(dummy)

    print(f"Input shape:  {dummy.shape}")
    for i, o in enumerate(out):
        print(f"Output P{i+3} shape: {o.shape}")

    total = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total:,}")
