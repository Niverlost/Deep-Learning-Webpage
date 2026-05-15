# 字母小人交互系统设计方案

## 概述

字母小人系统（Letter Character System）是页面 Hero 区域 "Deep Learning" 字母的趣味交互系统。每个字母被视为一个有性格、有情绪、有社交行为的"小人"，通过鼠标/触摸交互和自动行为营造生动有趣的浏览体验。

---

## 1. 系统架构

### 1.1 设计模式

**核心引擎（rAF 驱动弹簧物理）+ 状态机（离散行为控制）+ 事件总线（交互路由）**

区别于单一大闭包 + CSS/JS 双轨动画的模式，本方案采用模块化架构：

- **SpringEngine** — 统一的弹簧物理引擎，驱动所有位置/旋转/缩放动画
- **StateMachine** — 每个字母一个状态机实例，管理互斥状态转换
- **EventBus** — 事件分发层，鼠标/触摸事件转化为统一交互事件，降低硬件耦合
- **CSS 仅做基础样式和纯视觉层（颜色、圆角、渐变）**，所有动画由 JS 统一驱动，彻底消除双轨冲突

### 1.2 模块结构

```
src/letter-system/
├── index.js             入口, 组装所有模块
├── spring-engine.js     弹簧物理引擎（rAF 循环）
├── state-machine.js     状态机定义与转换
├── emotion.js           情绪系统（切换 + 表情混合）
├── interactions.js      交互事件绑定（鼠标/触摸/键盘 → EventBus）
├── auto-behavior.js     偷懒动作 + 社交互动调度器
├── particles.js         Canvas 粒子引擎
├── sound.js             Web Audio 合成音效
├── config.js            所有可调参数
└── cleanup.js           资源管理与销毁
```

辅助系统（独立模块, 一次初始化全局可用）：

```
ParticleEngine    Canvas 粒子系统
SoundEngine       Web Audio 合成音效
TimeAwareness     时段感知
LetterMemory      点击记忆（localStorage）
```

---

## 2. 物理引擎

### 2.1 统一弹簧物理模型

由单一 rAF 循环驱动的弹簧物理系统，所有动画（位置、旋转、缩放、颜色插值）经过同一管道。

```
每帧:
  for each 字母:
    for each 维度 (x, y, rotation, scale):
      force = (target - current) × stiffness
      velocity = (velocity + force × mass) × damping
      current += velocity
```

与原始方案的关键区别：

1. **所有动画统一由弹簧物理驱动**——CSS animation 只做纯视觉装饰（颜色渐变、滤镜），不参与位置/变换。消除双轨冲突
2. **按用途分类使用不同弹簧参数**，而非所有动画一套参数
3. **引入 mass（质量）参数**，使不同字母对同一力的响应速度有差异（如 D 字母更"稳重"）

### 2.2 弹簧参数分类

| 用途 | 刚度 | 阻尼 | 质量 | 特性 |
|------|------|------|------|------|
| **hover 弹起** | 0.35 | 0.55 | 1.0 | 欠阻尼, 快速弹起 + 一次轻微过冲回正, 约 200ms |
| **身体倾斜** | 0.20 | 0.70 | 1.0 | 轻微过阻尼, 平滑跟随鼠标, 约 350ms |
| **吓退弹跳** | 0.30 | 0.50 | 1.2 | 欠阻尼, 明显回弹, 约 500ms |
| **爬行跟随** | 0.08 | 0.85 | 1.0 | 过阻尼, 慢速拖尾, 约 800ms |
| **情绪过渡** | 0.40 | 0.60 | 1.0 | 快速响应, 用于表情切换的微动画 |
| **呼吸微动** | 0.05 | 0.90 | 1.0 | 极度平滑, 不产生可感知的过冲 |

每个字母的 mass 可根据角色调整：D 字母 mass=1.3（更稳重）, 小写字母 mass=0.9（更活泼）。

### 2.3 单帧写入约束

弹簧物理是**唯一写入 `style.transform` 的模块**，写入格式：

```javascript
// 在 rAF 循环中统一构建
el.style.transform = `
  translate(${x}px, ${y}px)
  rotate(${rot}deg)
  scale(${scale})
`;
```

CSS animation 仅限于不影响布局的属性（`opacity`、`color`、`box-shadow`、`filter`），绝不对 `transform` 做动画。如需 CSS 定义关键帧路径，改用 Web Animations API 并通过同一个弹簧引擎驱动。

### 2.4 增强身体与阴影

身体反向补偿系数 `-rotation × 0.25`, 阴影动态参数映射与原始方案一致（缩放、透明度、模糊、偏移均按高度线性插值），仅在物理引擎中计算，不依赖 CSS。

---

## 3. 状态机

### 3.1 状态定义

每个字母同时只有一个活跃状态：

| 状态 | 触发条件 | 行为 | 优先级 | 能否打断 |
|------|----------|------|--------|----------|
| `idle` | 默认 / 退出其他状态后 | 呼吸 + 眨眼, 可触发 lazy | 最低 | — |
| `hover` | 鼠标悬停 | 弹起, happy 表情 | 中 | lazy |
| `lazy` | idle 下随机调度 | 偷懒动作 | 低 | — |
| `social` | 自动配对检测 | 字母间互动 | 中 | lazy |
| `scared` | 鼠标过近且慢速 | 向后弹跳 + scared 表情 | 最高 | lazy, social, hover |

### 3.2 状态转换流程

```
exitState(s)  →  统一入口
  ├─ 停止当前状态的定时器
  ├─ 清除当前状态的 CSS class
  └─ 调用当前状态的 onExit 钩子

enterState(s, newState)  →  统一入口
  ├─ exitState(s) 先退出当前
  ├─ s.state = newState
  ├─ 设置新状态的 CSS class
  └─ 调用新状态的 onEnter 钩子
```

所有状态转换通过 `transitionTo(s, newState)` 函数完成，**禁止直接修改 `s.state`**。

### 3.3 优先级与排队

```
transitionTo(s, 'scared', options)  // 跳转 + 当前状态被压入栈
transitionBack(s)                   // 从栈中恢复之前的状态
```

使用一个简单的长度为 1 的回退栈（而非完整优先级排队），记录被高优先级打断前的状态。这样做简单且覆盖了 90% 的场景：

```javascript
// scared 打断 lazy:
s.stateHistory = ['lazy'];
s.state = 'scared';
// scared 结束后:
s.state = s.stateHistory.pop(); // 'lazy'
```

### 3.4 评估

原始方案的问题已解决：
- ✅ 状态转换集中到 `transitionTo`，不再散落在各处
- ✅ scared 结束后回到之前的状态而非固定 idle
- ✅ hover 不再强行打断 lazy（仅在鼠标移入时才打断）
- ✅ 添加 `onEnter` / `onExit` 钩子供外部扩展

---

## 4. 交互系统

### 4.1 交互事件统一路由

原始方案中鼠标、触摸、键盘的事件分散在多处绑定，且 `click` 和 `dblclick` 冲突未处理。本方案引入简单的事件总线：

```
class InteractionBus {
  handlers = {};

  on(event, fn)        // 注册监听
  off(event, fn)       // 移除监听
  emit(event, data)    // 触发事件
  
  // 原始硬件事件统一转化为业务事件:
  // mousedown / touchstart → 'press'
  // mouseup / touchend    → 'release'
  // mousemove / touchmove → 'move'
  // mouseenter            → 'hover-start'
  // mouseleave            → 'hover-end'
  // click                 → 'tap'
  // dblclick              → 'double-tap'
  // keydown Enter/Space   → 'tap'
}
```

这样做的好处：
- 鼠标和触摸设备事件流统一，`interactions.js` 只需监听 `'tap'`、`'press'` 等业务事件
- `'tap'` 事件自带防抖——200ms 内连续两次 tap 视为 `'double-tap'`，单次 tap 延迟 200ms 确认非双击后触发。消除原始方案中双击触发两次 click 的 bug

### 4.2 鼠标交互

| 交互 | 业务事件 | 响应 |
|------|---------|------|
| 悬停 | `hover-start` | 切换到 hover 状态, 弹簧目标弹起 6px |
| 悬停离开 | `hover-end` | 恢复 idle / 前一个状态 |
| 单击 | `tap` | 被点击者 happy 表情, 其他字母瞳孔转向, 1.5s 恢复 |
| 双击 | `double-tap` | 旋转动画, 星星粒子, excited 表情 |
| 按住 | `press` | 压扁变形, surprised 表情 |
| 释放 | `release` | 弹性恢复 |
| 靠近 | `move` 自动计算 | 梯度身体反应（同 4.4） |
| 极近 + 慢速 | `move` 自动计算 | 吓退弹跳 |

### 4.3 触摸交互

触摸设备通过同一事件总线映射：

| 触摸操作 | 映射为业务事件 | 说明 |
|----------|---------------|------|
| 触摸并保持 120ms 以上 | `hover-start` | 延迟触发, 避免与 tap 冲突 |
| 触摸释放（保持 < 120ms） | `tap` | 轻触视为点击 |
| 触摸释放（保持 >= 120ms） | `hover-end` + `release` | 先结束 hover, 再释放 |
| 触摸下压 | `press` | 压扁效果 |
| 触摸滑动 | `move` | 身体反应 |

`tap` 事件始终延迟 200ms 以排除 `double-tap`——这意味着点击反馈比原始方案晚 200ms。替代方案是第一次触摸立即触发反馈，如果 200ms 内再次触摸则撤销上次反馈并执行双击逻辑。权衡后选择延迟方案，因为交互反馈可逆（撤销表情变化）比不可逆（已触发双击）更安全。

### 4.4 连续距离梯度反馈

与原始方案一致，使用连续梯度公式：

```
距离 d 时:
  倾斜幅度 = clamp(0, 1 - d/300, 1) × 8°
  踮脚幅度 = clamp(0, 1 - d/200, 1) × -6px
  推开幅度 = clamp(0, 1 - d/100, 1) × 8px
  情绪: d < 120px → curious
```

唯一变动：情绪切换条件从固定的 `gradientFactor > 0.4` 改为基于距离的连续映射 `d < 120px`，消除不直观的中间变量。

### 4.5 眼球跟随

与原始方案一致，瞳孔偏移 = `direction × min(distance × 0.008, 4px)`。

**改进**：不再通过 `updatePositionCache` 缓存位置，而是共享主 rAF 循环中计算的 `getBoundingClientRect` 值，确保身体反应和瞳孔追踪使用同一时刻的位置数据。

### 4.6 按住所导致的形变

按住时的压扁效果由弹簧物理驱动而非 CSS animation 实现：

```
press:
  scale_target = { x: 1.15, y: 0.85 }  // 横向拉伸、纵向压扁
  y_target = 3px                        // 轻微下沉

release:
  scale_target = { x: 1.0, y: 1.0 }
  y_target = -8px                       // 回弹上冲
  // 200ms 后回到 0
```

不再使用 `squashPress` / `squashRelease` CSS animation，彻底消除 CSS 与 JS 的 transform 冲突。

---

## 5. 自动行为系统

### 5.1 偷懒动作

与原始方案一致：idle 状态下随机触发，6 种动作。

**改进：**

1. **权重选择**：各动作不再是等概率触发

| 动作 | 权重 | 理由 |
|------|------|------|
| 走神发呆 | 30% | 最常见的偷懒行为 |
| 打瞌睡 | 25% | 次常见 |
| 偷看别处 | 20% | 介于两者之间 |
| 打哈欠 | 10% | 应比瞌睡少, 否则视觉疲劳 |
| 伸懒腰 | 10% | 同上 |
| 揉眼睛 | 5% | 仅作为醒来后的后继触发, 不直接调度 |

2. **所有偷懒动作使用弹簧物理驱动**，而非 CSS animation。例如打瞌睡的点头动作变为：

```javascript
// 原: el.style.animation = 'nodOff 3s ease-in-out infinite'
// 改为弹簧引擎定时切换目标值:
let nodTimer = setInterval(() => {
  springEngine.setTarget(s, { ty: s.ty === 0 ? -4 : 0 });
}, 1500);
```

3. **睡眠醒来后的揉眼睛作为 lazy 状态 exit 的事件响应**，而非用 `setTimeout` 在 exitLazy 中设置。更干净：

```javascript
onExitLazy(s) {
  if (previousEmotion === 'sleepy' && Math.random() < 0.3) {
    eventBus.once('idle-entered', () => scheduleLazy(s, 'rub-eyes'));
  }
}
```

### 5.2 社交互动

原始方案的社交互动（私语、眼神传递）调度逻辑未完整实现。本方案补全：

**窃窃私语检测**：每 5 秒扫描所有 idle 字母，找到距离最近的相邻字母对，有 30% 概率触发：

```
1. 计算所有 idle 字母的 DOM 距离
2. 找到距离最小的一对
3. 如果距离 < 相邻阈值(元素宽度 × 1.5):
   进入 social 状态
   两字母互相靠近 8px
   talking 表情
   持续 2 秒后恢复
   冷却 8 秒
```

**传递眼神**：每 3 秒随机选择两个 idle 字母：

```
1. 随机选择两个 idle 字母 (A, B)
2. A 的瞳孔锁定 B 的中心, B 的瞳孔锁定 A 的中心
3. 持续 1.5 秒后恢复
```

**庆祝跳跃**：保留每 5 次访问集体弹跳的设计。

---

## 6. 情绪系统

### 6.1 情绪定义

11 种情绪保持不变，改用 `<canvas>` 或 CSS `mask-image` 绘制表情而非 CSS class + 子元素组合，减少 DOM 嵌套层级。不过考虑到实现复杂度，保留原始 CSS class 方案亦可——关键是统一管理。

### 6.2 情绪切换

改进点：

1. **统一映射表**：瞳孔缩放值只维护一份（`emotion.js` 中的常量表），不再同时存在 JS `pupilScaleMap` 和 CSS `--pupil-scale` 两个副本

```javascript
export const EMOTION_PARAMS = {
  happy:    { pupilScale: 1.1, mouth: 'smile', blush: 0.6 },
  surprised:{ pupilScale: 0.8, mouth: 'circle', blush: 0 },
  scared:   { pupilScale: 0.7, mouth: 'tremble', blush: 0 },
  sleepy:   { pupilScale: 0.8, mouth: 'half-open', blush: 0 },
  // ...
};
```

2. **情绪切换过渡**：保留原始 50ms 挤压过渡帧的设计。挤压不再写 `style.transform`（防止与弹簧引擎冲突），改为在字符元素上叠加一个独立的内层容器，该容器只做挤压变形：

```html
<div class="letter-char">
  <div class="letter-squash-layer">  ← 情绪挤压专用, 仅此使用
    <div class="letter-body">
      ...
    </div>
  </div>
</div>
```

`letter-squash-layer` 的 transform 由情绪系统独占管理，与弹簧引擎互不干扰。

### 6.3 表情混合（EmotionBlender）

原始方案中 EmotionBlender 已实现但未接入系统。本方案将其正式集成到情绪切换中：

```javascript
transitionEmotion(s, 'happy', 'surprised', 0.7, 0.3) {
  // 权重 0.7 happy + 0.3 surprised
  const params = blend('happy', 'surprised', 0.7, 0.3);
  applyBlended(s, params);  // 写入 CSS 变量而非 style.transform
}
```

使用场景：从 `curious` → `happy` 用 0.6/0.4 混合过渡；从 `scared` → `neutral` 用 0.3/0.7 混合渐出。使情绪变化不再生硬跳变。

---

## 7. 粒子引擎

保留原始方案的设计：Canvas 为基础、6 种粒子类型、swap-and-pop 移除策略。

**改进：**

1. **Canvas z-index 改为动态计算**：检查页面中最高 z-index 元素（或通过配置传入），粒子 Canvas 设为 `max(z-indexes) - 1` 而非固定 100。避免覆盖模态框等上层元素
2. **粒子 `emit()` 添加可选回调 `onComplete`**：粒子全部消亡后触发，方便链式动画（如庆祝 → 粒子 → 粒子结束 → 文字提示）
3. **支持 Canvas 尺寸懒更新**：`resize()` 在粒子引擎 inactive 时不执行，减少不必要的重绘

---

## 8. 蛇形跟随

检测条件不变（快速移动触发），实现方式改为：

- **使用主 rAF 循环而非独立的 `requestAnimationFrame`**：蛇形跟随状态下的位置更新写入同一组弹簧目标值（`tx, ty, tr`），不再有独立 rAF 竞争 transform 写入
- 主 rAF 循环检测 `state === 'snake-following'` 时跳过呼吸动画，直接使用蛇形位置目标值

触发条件改进：

```
速度阈值: 25px/帧（原始 40px/帧偏高, 大多数用户的正常快速移动达不到）
连续帧数: 3 帧
冷却: 3000ms
最大持续: 3000ms 或鼠标速度降至 15px/帧 以下
```

---

## 9. 连击合唱

原始方案的问题：
- `chorus-singing` CSS class 无对应样式
- DOM 粒子不清理

修复：

```
1. 触发条件不变: 2 秒内 5 次点击
2. 效果改为:
   - 所有字母依次弹跳 (弹簧目标 ty = -12px, 间隔 80ms)
   - 同时触发 ParticleEngine.note() 生成 Canvas 音符粒子
   - 最后一个字母弹起后, 所有字母一起回到原位
3. 连击计数设一互斥锁: 合唱期间不计数, 结束后重置
```

---

## 10. 无障凝与性能

### 10.1 减少动效

保留 `prefers-reduced-motion` 检测。改进：

- 入场动画同样尊重该设置（原始方案中入场动画不受影响）
- `prefers-reduced-motion` 时仅保留基础呼吸和眼球跟随，跳过所有变换类动画

### 10.2 无障碍

除了原始的键盘支持，增加：

- 字母情绪变化时通过 `aria-live` 区域播报（如 "字母 D 跳了一下" → 屏幕阅读器读出）
- 蛇形跟随、合唱等多人互动触发时播报"字母们在跳舞"

### 10.3 定时器管理

吸取原始方案 `allTimers` 只增不减的教训，使用 **`setTimeout` + `clearTimeout` 包裹层**，定时器执行后自动从追踪集合中移除：

```javascript
export function createTimerTracker() {
  const timers = new Map();  // id → info
  let nextId = 1;

  function setTracked(fn, delay) {
    const id = nextId++;
    const timerId = setTimeout(() => {
      timers.delete(id);
      fn();
    }, delay);
    timers.set(id, { timerId, fn, delay });
    return id;
  }

  function clearTracked(id) {
    const entry = timers.get(id);
    if (entry) {
      clearTimeout(entry.timerId);
      timers.delete(id);
    }
  }

  function clearAll() {
    timers.forEach(entry => clearTimeout(entry.timerId));
    timers.clear();
  }

  return { set: setTracked, clear: clearTracked, clearAll, size: () => timers.size };
}
```

`Timers.size()` 可用于健康检查，辅助排查定时器泄漏。

### 10.4 位置缓存

缓存节流从 100ms 降至 50ms。同时监听 `scroll` 事件主动刷新缓存：

```javascript
let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      updatePositionCache();
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });
```

---

## 11. 参数配置总览

所有可调参数集中在 `config.js`：

```javascript
export default {
  spring: {
    hover:     { stiffness: 0.35, damping: 0.55, mass: 1.0 },
    body:      { stiffness: 0.20, damping: 0.70, mass: 1.0 },
    scared:    { stiffness: 0.30, damping: 0.50, mass: 1.2 },
    snake:     { stiffness: 0.08, damping: 0.85, mass: 1.0 },
    emotion:   { stiffness: 0.40, damping: 0.60, mass: 1.0 },
    breath:    { stiffness: 0.05, damping: 0.90, mass: 1.0 },
  },
  interactions: {
    hoverElevation: 6,              // px
    hoverScale: 1.05,
    scaredTriggerDist: 80,          // px
    scaredRecoveryDist: 120,        // px
    scaredSpeedThreshold: 15,       // px/帧
    pupilMaxOffset: 4,              // px
    pupilTrackingFactor: 0.008,
    gradientFar: 300,               // px
    gradientMid: 200,
    gradientNear: 100,
    tapDelay: 200,                  // ms, 双击判定窗口
    touchHoverDelay: 120,           // ms
  },
  snake: {
    speedThreshold: 25,             // px/帧
    consecutiveFrames: 3,
    cooldown: 3000,                 // ms
    maxDuration: 3000,              // ms
    slowThreshold: 15,              // px/帧
  },
  lazy: {
    checkInterval: 3000,            // ms, 间隔检查是否触发
    minInterval: 5000,              // ms, 上次触发后至少等待
    actions: {
      zoneOut:    { weight: 0.30, duration: [3000, 5000] },
      nodOff:     { weight: 0.25, duration: [4000, 7000] },
      peek:       { weight: 0.20, duration: [2000, 3000] },
      yawn:       { weight: 0.10, duration: 2500 },
      stretch:    { weight: 0.10, duration: 2000 },
      rubEyes:    { weight: 0.05, duration: 1500 },
    },
    wakeTransition: 400,            // ms, 唤醒动画时长
    postSleepRubChance: 0.30,
  },
  social: {
    whisperInterval: 5000,          // ms
    whisperRange: 1.5,              // 元素宽度的倍数
    whisperDuration: 2000,          // ms
    whisperCooldown: 8000,          // ms
    eyeContactInterval: 3000,       // ms
    eyeContactDuration: 1500,       // ms
  },
  chorus: {
    tapCount: 5,
    tapWindow: 2000,                // ms
    staggerDelay: 80,               // ms
    jumpHeight: -12,                // px
  },
  cache: {
    positionThrottle: 50,           // ms
  },
  memory: {
    celebrateEveryVisits: 5,
  },
  entrance: {
    defaultDuration: 0.8,           // s
    leaderDuration: 1.0,
    wakeDuration: 0.9,
    maxDelay: 0.96,                 // s
    bufferMs: 200,
  },
  particle: {
    baseZIndex: 100,
    swapAndPop: true,
  },
};
```

---

## 12. 实现路线

### Phase 1 — 基础设施
- 实现 `spring-engine.js`：统一的弹簧物理、rAF 循环、分类参数
- 实现 `state-machine.js`：`transitionTo` / `transitionBack`、状态栈、钩子系统
- 实现 `config.js`：所有参数集中管理
- 迁移字母 DOM 结构：内嵌 `squash-layer` 容器

### Phase 2 — 核心交互
- 实现 `interaction.js` 和 `EventBus`
- 将 hover / press / release / tap / double-tap 绑定到弹簧目标值
- 实现梯度身体反应和瞳孔追踪

### Phase 3 — 自动行为
- 实现偷懒动作调度器和权重选择
- 实现社交互动检测和配对
- 接入 EmotionBlender 表情混合

### Phase 4 — 辅助与完善
- 接入 Canvas 粒子引擎（修正 z-index）
- 接入 Web Audio 音效
- 无障碍改进
- 测试与调优
