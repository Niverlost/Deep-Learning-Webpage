# 前端设计系统

> 基于 dl-viz-pro 的 Apple Liquid Glass 设计风格，精确记录每个视觉元素的实现细节。

---

## 1. 设计哲学

**Apple-style Dark Premium** — 深色基底 + 毛玻璃层次 + 蓝色强调色。

核心关键词：**通透、层次、克制、响应**

---

## 2. 色彩系统

### 2.1 Dark Mode（默认）

```
背景层级（由深到浅）：
--bg-base:     #000000    页面底色
--bg-surface:  rgba(28,28,30,0.72)   面板底色（毛玻璃）
--bg-elevated: rgba(44,44,46,0.72)   悬浮层底色
--bg-card:     rgba(36,36,38,0.60)   卡片底色
--bg-card-hover: rgba(48,48,50,0.70) 卡片悬停
--bg-input:    rgba(36,36,38,0.60)   输入框底色
```

```
文字层级：
--text-primary:   #f5f5f7   标题、正文
--text-secondary: #86868b   副文本、描述
--text-muted:     #6e6e73   辅助信息
```

```
强调色（蓝色系）：
--accent-primary:   #007AFF  主按钮、链接、选中态
--accent-secondary: #0A84FF  主按钮悬停
--accent-light:     rgba(0,122,255,0.15)  蓝色弱背景
--accent-glow:      rgba(0,122,255,0.3)   蓝色发光
```

```
语义色：
--success: #30D158    --success-light: rgba(48,209,88,0.15)
--danger:  #FF453A    --danger-light:  rgba(255,69,58,0.15)
--warning: #FF9F0A    --warning-light: rgba(255,159,10,0.15)
```

```
毛玻璃材质（核心特征）：
--glass-bg:    rgba(255,255,255,0.08)
--glass-border: rgba(255,255,255,0.18)
--glass-hover: rgba(255,255,255,0.12)
--glass-blur:  20px
```

```
边框：
--border:       rgba(255,255,255,0.08)
--border-hover: rgba(255,255,255,0.16)
--border-active: rgba(0,122,255,0.5)
```

```
阴影（柔和弥散）：
--shadow-sm: 0 2px 8px  rgba(0,0,0,0.25)
--shadow-md: 0 4px 16px rgba(0,0,0,0.30)
--shadow-lg: 0 8px 32px rgba(0,0,0,0.35)
--shadow-xl: 0 16px 48px rgba(0,0,0,0.40)
```

### 2.2 Light Mode

通过 `[data-theme="light"]` 覆盖变量：
- 卡片背景从 `rgba(36,36,38,0.60)` 改为 `rgba(255,255,255,0.90)`
- 文字从 `#f5f5f7` 改为 `#1d1d1f`
- 阴影从黑色改为浅灰
- 毛玻璃材质从 `rgba(255,255,255,0.08)` 改为 `rgba(120,120,128,0.08)`
- 边框从 `rgba(255,255,255,0.08)` 改为 `rgba(60,60,67,0.12)`

---

## 3. 字体系统

| 类型 | 属性 | 说明 |
|------|------|------|
| 标题字体 | `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif` | 系统原生渲染 |
| 正文字体 | `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif` | 同标题字体族 |
| 等宽字体 | `'SF Mono', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace` | 代码块 |
| h1 | `clamp(1.5rem, 4vw, 2.5rem), 700, tracking -0.02em` | Hero 标题 |
| h2 | `1.75rem, 700, tracking -0.02em` | 详情页标题、模态框标题 |
| h3 | `1.25rem, 700, tracking -0.01em` | 卡片名称 |
| body | `16px, 400, line-height 1.6, color text-secondary` | 正文描述 |
| small | `0.8125rem, color text-muted` | Meta 信息 |

---

## 4. 空间与布局

### 4.1 间距体系（8px 基准）

| 级别 | 值 | 用途 |
|------|-----|------|
| xs | 4px | 标签内间距 |
| sm | 8px | 按钮间距、标签间距 |
| md | 16px | 卡片内间距、组件间距 |
| lg | 24px | 模块间距 |
| xl | 32px | 分类卡片 padding |
| 2xl | 48px | 模态框 padding |

### 4.2 圆角体系

| 级别 | 值 | 用途 |
|------|-----|------|
| xs | 8px | 标签、code |
| sm | 12px | 小按钮、输入框 |
| md | 16px | 按钮、面板、模型卡片图标框 |
| lg | 20px | 大面板、分类卡片图标框 |
| xl | 28px | 卡片（分类卡片、模型卡片、模态框） |
| full | 9999px | 年份标签、筛选按钮、箭头按钮 |

### 4.3 布局参数

```
header-height: 48px
container-max: 980px
container-padding: 20px
```

---

## 5. 组件设计

### 5.1 导航栏（Header）

- `position: fixed; top: 0; z-index: 100`
- 毛玻璃背景：`backdrop-filter: blur(20px) saturate(180%)` + `rgba(255,255,255,0.08)`
- 底部边框：`1px solid rgba(255,255,255,0.18)`
- 导航按钮：hover 变亮、active 蓝色高亮 + 蓝色弱背景
- 高度 48px，极致紧凑
- Logo：26px SVG 图标 + "Deep Learning Explorer" 文字

### 5.2 Hero 区域

- **标题**：`Deep Learning Explorer`（`clamp(1.5rem, 4vw, 2.5rem)`, 700 weight, 居中）
- **副标题**：`交互式探索 35+ 经典深度学习模型的架构与原理`（`clamp(0.875rem, 2vw, 1.125rem)`, text-secondary, 居中）
- **字母舞台**：13 个字母小人，由 `initLetterStage()` 动态生成
- **统计卡片**（毛玻璃底板）：3 个指标竖线分隔
  - 经典模型（动态数量）/ 研究领域（动态数量）/ 年跨度（动态范围）
  - 统计值使用蓝色渐变文字（`-webkit-background-clip: text`）
- **行动按钮**：`btn-primary` 样式，SVG 图标 + "学习路径" 文字
- **背景特效**：鼠标跟踪多层 Spotlight（蓝紫粉 Mesh 渐变）
  - 包含：有机扰动 SVG 滤镜、色差分离（红/蓝通道）、高光核心、高光边缘、漂浮微粒
  - 使用 RAF 节流平滑插值（lerp 系数 0.12）
- **统计卡 3D 倾斜**：`perspective(800px) rotateX/Y`，鼠标跟踪 `--tilt-x/y`
- **按钮磁性吸附**：鼠标靠近时按钮微微位移
- 入场动画：`fadeInUp` 错峰（标题 0ms → 副标题 100ms → 统计 300ms → 按钮 400ms）

### 5.3 分类卡片（首页模块网格）

```
┌─────────────────────────┐      hover:
│  ┌────┐                 │  →   上移 6px + 缩放 1.01
│  │ 🧠 │                 │  →   阴影从 sm 到 xl
│  └────┘                 │  →   涟漪光晕跟随鼠标
│  图像分类                │
│  从 BP 到 ViT...         │
│  42 个模型          →    │
└─────────────────────────┘
```

- 网格：`repeat(auto-fill, minmax(280px, 1fr))`, gap 20px
- 卡片：`padding 32px`, `border-radius 28px`, 毛玻璃背景
- 图标框：`56px × 56px`，毛玻璃背景，`border-radius: 20px`
- 分类名称：`1.375rem, 700, tracking -0.02em`
- 分类描述：`0.9375rem, text-secondary, line-height 1.6`
- 模型数量：`0.875rem, text-muted, font-weight 500`
- 箭头按钮：右下角，`32px` 圆形，毛玻璃背景，hover 时变蓝右移 4px
- 涟漪：`::after` 伪元素 — `radial-gradient(600px circle at var(--ripple-x) var(--ripple-y), ...)`, mousemove 更新坐标
- `data-color` 支持：blue / purple / green / orange / pink / cyan
- 分类 badge：右上角绝对定位，`padding 6px 14px`, `border-radius full`, 毛玻璃背景
- 入场：`fadeInUp 0.5s ease-out`, 逐卡延迟 `index × 0.08s`

### 5.4 模型卡片（分类页）

```
┌──────────────────────────────────────┐
│ [♡]  ConvNeXt              [2022]    │
│ ┌────┐                               │
│ │icon│ 图像分类                        │
│ └────┘ 纯卷积架构，借鉴 Transformer...  │
│                                      │
│ [架构] CNN       [参数] 22M          │
│                                      │
│ CNN  卷积  分类  ImageNet  +2         │
│                                      │
│                [ 查看详情 → ]          │
└──────────────────────────────────────┘
```

- 网格：`repeat(auto-fill, minmax(360px, 1fr))`, gap 20px
- 卡片：`padding 28px`, `border-radius 28px`, 毛玻璃背景
- **无顶部视觉装饰条**（区别于旧版）
- 图标框：`48px × 48px`，毛玻璃背景，`border-radius: 16px`
- 收藏按钮：右上角绝对定位，`aria-pressed` 状态
- 名称 + 年份同行：
  - 名称：`1.25rem, 700, line-height 1.3, tracking -0.01em`
  - 年份：蓝色 pill 徽章，`padding 4px 10px`, `background: var(--accent-light)`, `color: var(--accent-primary)`
- 分类 pill 徽章：`padding 4px 12px`, 毛玻璃背景, `border: 1px solid var(--border)`
- 描述最多 3 行（`-webkit-line-clamp: 3`），`0.9375rem, line-height 1.6`
- Meta 信息：图标 + 文字，紧凑排列（架构 + 参数量），`0.8125rem, text-muted`
- 标签：最多 4 个，超出显示 `+N`，`gap 8px`
- "查看详情 →" 文本链接：`color: var(--accent-primary)`, hover 时 `gap` 增大 + 下划线
- 入场：`fadeInUp 0.4s ease-out`, 逐卡延迟 `index × 0.05s`
- hover：`translateY(-6px) scale(1.01)` + 阴影增大到 `shadow-xl`
- active：`translateY(-2px) scale(0.99)`

### 5.5 按钮系统

| 类型 | 样式 | 用途 |
|------|------|------|
| btn-primary | 蓝色背景 + 白色文字 | 主要操作 |
| btn-secondary | 毛玻璃背景 + 边框 | 次要操作 |
| btn-danger | 红色弱背景 + 红色文字 | 危险操作 |
| btn-ghost | 无背景 + 蓝色文字 | 文字操作 |
| btn-sm | 缩小版 (padding 更小) | 卡片内操作 |

所有按钮带有：`border-radius 16px`、`font-weight 600`、hover 时 `translateY(-1px)`。

### 5.6 搜索与筛选栏

- 搜索框：`padding-left 48px` 为图标留空间，`border-radius 16px`
  - focus 时蓝色边框 + `box-shadow: 0 0 0 4px var(--accent-light)`
  - 搜索图标 focus 时变蓝
- 筛选按钮：`border-radius full`, active 蓝色弱背景 + 蓝色文字
- 对比按钮：毛玻璃背景，SVG 图标 + "对比" 文字

### 5.7 模态框

- 覆盖层：`rgba(0,0,0,0.5)` 背景, `z-index: 200`
- 内容区：毛玻璃背景, `border-radius 28px`
- 详情模态框：`max-width 600px`, `padding 48px`
- 登录模态框：`max-width 440px`, `padding 48px`, 居中文字
- 打开动画：`scale(0.96) translateY(-12px)` → `scale(1) translateY(0)`，`opacity: 0` → `1`
- 关闭按钮：右上角，`20px` SVG，hover 旋转变色
- 点击背景关闭、ESC 关闭、滚动锁定

### 5.8 模型详情模态框（快速预览）

```
┌────────────────────────────────────────────┐
│  ×  Faster R-CNN                           │
│  Faster R-CNN: Towards Real-Time...        │
│  [2015] [目标检测] [CNN + RPN]              │
│                                            │
│  ┌────────────┐ ┌────────────┐            │
│  │ 作者       │ │ 机构       │            │
│  │ Shaoqing.. │ │ Microsoft  │            │
│  └────────────┘ └────────────┘            │
│  ┌────────────┐ ┌────────────┐            │
│  │ 架构       │ │ 参数量     │            │
│  │ CNN + RPN  │ │ 约 137M    │            │
│  └────────────┘ └────────────┘            │
│                                            │
│  Faster R-CNN 是目标检测领域的里程碑...      │
│                                            │
│  核心创新                                   │
│  区域提议网络（RPN）——与检测网络共享...       │
│                                            │
│  [RPN] [两阶段检测] [锚框] [实时检测]        │
│                                            │
│  [论文链接]  [查看完整详情 →]               │
└────────────────────────────────────────────┘
```

- 触发方式：点击模型卡片打开模态框
- Hero 区域：标题 + 全称 + 徽章行（年份/分类/架构）
- 信息网格：`grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`
  - 每个信息项：`background: var(--bg-elevated)`, `padding 16px 20px`, `border-radius 16px`
  - Label：`0.75rem, text-muted, uppercase, tracking 0.5px, font-weight 600`
  - Value：`1rem, text-primary, font-weight 600`
- 描述：`line-height 1.8, font-size 1rem`
- 核心创新：同描述样式
- 标签：`padding 8px 16px`, `border-radius full`, 毛玻璃背景
- 操作按钮：论文链接（蓝色弱背景 + 蓝色文字）+ "查看完整详情" 按钮

### 5.9 模型详情页（完整页面）

```
┌──────────────────────┬──────────────────────┐
│                      │                      │
│   网络结构可视化      │   ▼ 简介             │
│   (SVG blocks)       │   描述文本...         │
│                      │                      │
│   层信息              │   ▼ 核心创新          │
│   选中层显示详情       │   创新点文本...       │
│                      │                      │
│   代码实现            │   ▼ 详细信息          │
│   [复制代码]          │   作者/机构/参数/...  │
│                      │                      │
│                      │   ▼ 参考链接          │
│                      │   论文 / 代码         │
│                      │                      │
│                      │   ▼ 标签              │
│                      │   tag1 tag2 tag3      │
└──────────────────────┴──────────────────────┘
```

- 双栏布局：`grid-template-columns: 1fr 400px`, gap 24px
- 左侧主区域：
  - Hero：模型名称 + 全称 + 徽章行
  - 网络结构可视化面板
  - 层信息面板
  - 代码实现面板（PyTorch）+ 复制按钮
- 右侧侧边栏：
  - `position: sticky`, `top: calc(var(--header-height) + 24px)`
  - `max-height: calc(100vh - var(--header-height) - 48px)`
  - `overflow-y: auto`
- 手风琴面板：
  - 每个面板：`border 1px solid var(--border)`, `border-radius 20px`, 毛玻璃背景
  - Header：`padding 16px 20px`, `font-weight 600`, hover 时背景变亮
  - 箭头：`20px`, 展开时旋转 90 度
  - Body：`max-height 0` → `max-height 800px` 过渡
  - 内容：`padding 0 20px 20px`, `line-height 1.7`
  - 面板列表：简介（默认展开）、核心创新、详细信息、参考链接、标签

### 5.10 对比模式

- 底部浮动对比栏：`position: fixed; bottom: 0; z-index: 100`
- 显示已选模型数量 + 模型名称标签
- 操作：清空 + 开始对比
- 卡片对比模式：左上角显示复选框，选中时蓝色边框

---

## 6. 动画设计

### 6.1 缓动函数

| 名称 | 值 | 用途 |
|------|-----|------|
| `ease-out` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | 默认过渡 |
| `apple-spring` | `cubic-bezier(0.32, 0.72, 0, 1)` | 弹性悬停、卡片过渡 |
| `spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 字母弹跳、入场 |
| `ease-in-out` | `cubic-bezier(0.42, 0, 0.58, 1)` | 对称过渡 |

### 6.2 动画时长

```
--duration-fast:   200ms   微交互（hover、focus）
--duration-normal: 300ms   组件过渡（卡片、面板）
--duration-slow:   500ms   大区域过渡（hero、页面切换）
```

### 6.3 入场动画

所有卡片使用 `fadeInUp` keyframe：`opacity: 0 → 1, translateY: 24px → 0`。

- 分类卡片：`0.5s ease-out`, 逐卡延迟 `index × 0.08s`
- 模型卡片：`0.4s ease-out`, 逐卡延迟 `index × 0.05s`
- Hero 内容：`0.5s ease-out`, 层级交错延迟

### 6.4 微交互

| 交互 | 效果 |
|------|------|
| 卡片 hover | `translateY(-6px) scale(1.01)` + 阴影增大到 `shadow-xl` |
| 卡片 active | `translateY(-2px) scale(0.99)` |
| 按钮 hover | `translateY(-1px)` |
| Hero 统计卡 tilt | `perspective(800px) rotateX/Y` + 内部追光 |
| 分类卡片涟漪 | `radial-gradient` 光晕跟随鼠标 |
| 模型卡片收藏 | 心形图标填充变化 + `scale(1.15)` |

---

## 7. 响应式设计

| 断点 | 适配 |
|------|------|
| ≥980px | 标准桌面布局 |
| 768-979px | 缩小 padding，卡片网格 `min-width` 下调 |
| 480-767px | 单列卡片，导航隐藏文字仅显示图标 |
| <480px | 最小化 padding，hero 标题缩小 |

---

## 8. 无障碍

| 特性 | 实现 |
|------|------|
| 跳过导航 | `<a class="skip-link" href="#app">` |
| 键盘导航 | 所有可交互元素 `tabindex="0"`, `role="button"` |
| 焦点可见 | `:focus-visible` 蓝色轮廓 |
| 屏幕阅读器 | `aria-label`, `aria-live` 区域, `aria-expanded` 手风琴 |
| 减少动效 | `prefers-reduced-motion` 检测，跳过所有动画 |
| 对比度 | WCAG AA 标准，深色模式下文字对比度 ≥4.5:1 |

---

## 9. 主题切换

- HTML 内联脚本（阻塞渲染前执行）：读取 `localStorage` → 回退 `prefers-color-scheme` → 默认 dark
- 通过 `document.documentElement.setAttribute('data-theme', theme)` 即时设置
- 按钮切换：`toggleTheme()` — 切换属性 + 保存到 localStorage

---

## 10. 生产适配

### 10.1 CSP 策略

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:;
connect-src 'self';
frame-ancestors 'none';
form-action 'self';
object-src 'none';
```

### 10.2 `<base>` 标签

`<base href="/Deep-Learning-Webpage/">` — 仅主文件，测试环境移除

### 10.3 性能要点

- 卡片 `contain: layout style paint` 限制重绘范围
- Hero Spotlight 使用 RAF 节流（lerp 平滑插值）
- 统计卡 3D 倾斜使用 RAF 节流
- 骨架屏在 JS 启动完成前占位

---

## 11. 完整 CSS 变量速查

```css
:root {
  /* 背景 */
  --bg-base: #000000;
  --bg-surface: rgba(28,28,30,0.72);
  --bg-elevated: rgba(44,44,46,0.72);
  --bg-card: rgba(36,36,38,0.60);
  --bg-card-hover: rgba(48,48,50,0.70);
  --bg-input: rgba(36,36,38,0.60);
  /* 文字 */
  --text-primary: #f5f5f7;
  --text-secondary: #86868b;
  --text-muted: #6e6e73;
  /* 强调 */
  --accent-primary: #007AFF;
  --accent-secondary: #0A84FF;
  --accent-light: rgba(0,122,255,0.15);
  --accent-glow: rgba(0,122,255,0.3);
  /* 语义 */
  --success: #30D158; --success-light: rgba(48,209,88,0.15);
  --danger: #FF453A;  --danger-light: rgba(255,69,58,0.15);
  --warning: #FF9F0A; --warning-light: rgba(255,159,10,0.15);
  /* 毛玻璃 */
  --glass-bg: rgba(255,255,255,0.08);
  --glass-border: rgba(255,255,255,0.18);
  --glass-hover: rgba(255,255,255,0.12);
  --glass-blur: 20px;
  /* 边框 */
  --border: rgba(255,255,255,0.08);
  --border-hover: rgba(255,255,255,0.16);
  --border-active: rgba(0,122,255,0.5);
  /* 阴影 */
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.25);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.30);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.35);
  --shadow-xl: 0 16px 48px rgba(0,0,0,0.40);
  /* 圆角 */
  --radius-xs: 8px; --radius-sm: 12px; --radius-md: 16px;
  --radius-lg: 20px; --radius-xl: 28px; --radius-full: 9999px;
  /* 缓动 */
  --ease-out: cubic-bezier(0.25,0.1,0.25,1);
  --ease-in-out: cubic-bezier(0.42,0,0.58,1);
  --spring: cubic-bezier(0.34,1.56,0.64,1);
  --apple-spring: cubic-bezier(0.32,0.72,0,1);
  /* 时长 */
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  /* 字体 */
  --font-heading: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  /* 布局 */
  --header-height: 48px;
  --container-max: 980px;
  --container-padding: 20px;
}
```
