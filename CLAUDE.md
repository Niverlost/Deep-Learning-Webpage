# Deep-Learning-Webpage

一个纯前端实现的交互式深度学习模型浏览与学习平台，涵盖 35+ 经典模型，从 LeNet-5 到 GPT-4。

- **部署**: GitHub Pages — <https://niverlost.github.io/Deep-Learning-Webpage>
- **GitHub**: `https://github.com/Niverlost/Deep-Learning-Webpage`
- **Gitee** (备份): `https://gitee.com/never-lost/deep-learning`

## 技术栈

- **语言**: HTML5, CSS3, JavaScript (ES6+)
- **无框架/无构建**: 纯静态文件，零依赖
- **模块系统**: ES6 Modules (`type="module"`)
- **路由**: Hash-based SPA 路由
- **存储**: localStorage（模型数据、用户认证、主题偏好、会话）

## 目录结构

```
.
├── assets/models.json      # 35+ 深度学习模型数据（核心数据源）
├── css/style.css           # 全局样式（明暗主题、响应式布局）
├── js/
│   ├── app.js              # 入口文件，import 所有模块并初始化
│   ├── router.js           # Hash 路由系统
│   ├── state.js            # 全局状态管理
│   ├── auth.js             # 用户认证（登录/注册/收藏/权限）
│   ├── utils.js            # 工具函数（格式化、debounce、加密）
│   ├── ui-components.js    # UI 组件工厂
│   ├── letter-system.js    # 字母小人交互系统
│   ├── viz-configs.js      # 模型架构可视化配置
│   └── viz-engine.js       # 模型架构可视化引擎
├── index.html              # 主页面（单页应用，含骨架屏）
├── CHANGELOG.md            # 更新日志
├── .gitignore              # Git 忽略配置（仅本地，不上传到远程仓库）
├── test/                   # 测试目录（不提交到仓库）
│   ├── index.html          # 测试入口（无限制，双击即可打开）
│   ├── js/models-data.js   # 模型数据（内联为 JS 变量，无需 fetch）
│   └── js/...              # 测试用 JS（去除了 import/export 的独立副本）
└── .trae/                  # Trae IDE 配置（仅本地）
```

## 两套环境的区分

项目维护两套并行的前端文件，用途不同：

| | **主文件 (js/ + index.html)** | **测试文件 (test/)** |
|------|------------------------------|---------------------|
| 用途 | 生产环境部署 | 内容设计/交互设计验证 |
| 安全 | 完整 CSP + `<base>` + ES6 Modules | 无限制，无额外安全防护 |
| 打开方式 | 部署到 GitHub Pages 或本地服务器 | 直接双击 test/index.html |
| 数据加载 | `fetch('assets/models.json')` | `<script>` 加载内联 JS 变量 |
| 脚本类型 | `type="module"`（ES6 Modules） | 普通 `<script>`（无模块限制） |

**原则**：
- 修改功能前先在 `test/` 中验证交互效果
- 确认无误后将改动同步到主文件
- `test/` 不上传到远程仓库

---

## 架构说明

### 数据流
- `assets/models.json` → 首次加载时读入 localStorage（键 `dl_viz_pro_models`）
- 所有 CRUD 操作读写 localStorage，页面刷新后从 localStorage 恢复
- 数据版本控制：`dl_viz_pro_version`，版本变化时重新加载默认数据

### 路由系统
- 使用 `window.location.hash` 实现 SPA 路由
- 格式：`#home`, `#category/图像分类`, `#model/1`, `#admin`
- 路由守卫：admin/favorites 视图需登录权限
- 视图切换时自动销毁 letter-system 和 viz-engine 实例

### 认证系统
- 本地存储用户名/密码（加盐哈希）
- 会话管理：`dlviz_session`（含 sessionId、用户名、失效时间）
- 权限分级：admin / user / visitor 三级

### 字母小人系统
- Hero 区域渲染 "Deep Learning" 字母
- 悬停、点击、靠近等鼠标交互反应
- 无交互时随机触发偷懒动作（打瞌睡、打哈欠等）
- 字母间社交互动（窃窃私语、传递眼神、排队跟随）

### 可视化引擎
- 使用 SVG 绘制模型架构图
- 每个模型有独立的 `viz-configs.js` 配置
- 支持 CNN、Transformer、ResNet 等多种架构的可视化

## 路径规则（GitHub Pages 子目录部署）

- **`<base>` 标签**: `<base href="/Deep-Learning-Webpage/">`
- **CSS/JS 引用**: 相对路径（受 base 影响），如 `href="css/style.css"`
- **JS fetch**: 相对路径（受 base 影响），如 `fetch('assets/models.json')`
- **JS 模块导入**: 相对路径（**不受 base 影响**，基于文件 URL），如 `import { ... } from './utils.js'`

## 编码规范

- **变量/函数**: camelCase（如 `loadModels`）
- **DOM ID / CSS class**: kebab-case（如 `modelGrid`, `model-grid`）
- **常量**: UPPER_SNAKE_CASE（如 `STORAGE_KEY`）
- **模块文件**: kebab-case（如 `ui-components.js`）
- **字符串**: 单引号 | **缩进**: 2 空格

### 禁止事项（主文件）
以下规则针对主文件（`js/` 和 `index.html`），`test/` 目录不受限：
- ❌ 不要使用 `file://` 协议相关代码
- ❌ 不要包含 `localhost` 或 `127.0.0.1` 的调试代码
- ❌ 不要提交敏感信息（密码、Token）
- ❌ 不要包含紧急调试代码（如 `?clear=true` 清除缓存）

### 生产环境清理（主文件）
部署前检查：删除所有 `console.log` / 注释掉的 `// DEBUG:` 代码 / `file://` 检测代码 / 紧急调试工具

## Commit 风格

中文 commit message，前缀标识类型：

| 类型 | 用途 | 示例 |
|------|------|------|
| `fix` | 修复 bug | `fix: 修复骨架屏不消失问题` |
| `feat` | 新增功能 | `feat: 添加模型对比功能` |
| `cleanup` | 清理代码 | `cleanup: 删除调试代码` |
| `docs` | 文档更新 | `docs: 更新 README` |
| `style` | 样式调整 | `style: 优化卡片间距` |

## 重要工作流

### 测试工作流
**所有修改必须先在 `test/` 目录测试验证，确认无误后再应用到主文件。**

```
1. 检查 test/ 中是否有对应文件，没有则从主文件复制
2. 在 test/ 中修改并本地测试（直接双击 test/index.html 打开）
3. 注意：test/ 是独立副本，已去除 import/export，修改后需手动同步到主文件
4. 确认修复有效后，将修改同步应用到主文件
5. 提交
```

禁止操作：
- ❌ 不要直接在主文件上修改未经验证的代码
- ❌ 不要将 `test/` 目录提交到仓库
- ❌ 不要在 `test/` 中修改后忘记同步到主文件

### 推送确认
**推送到远程仓库前必须先获得用户明确同意。** 完成后提交推送报告（目标仓库、修改摘要、提交信息、验证状态）。

### 双仓库同步
- **origin**: GitHub（主仓库）— 推送 `master` → `main`（触发 Pages 部署）
- **backup**: Gitee（备份仓库）— 推送 `master` → `master`
- 推 GitHub 后**必须**同步推 Gitee

### .gitignore 不上传
`.gitignore` 文件不得上传到远程仓库。如果被意外追踪，使用 `git rm --cached .gitignore` 移除追踪。

### 推送前检查清单
- [ ] 当前在 `master` 分支
- [ ] 远程仓库已配置（origin + backup）
- [ ] `.gitignore`、`test/`、`.trae/`、`CLAUDE.md` 未意外暂存（不用 `git add .`，手动添加要提交的文件）
- [ ] 修改后已在 `test/` 测试通过
- [ ] **已获得用户确认可以推送**
- [ ] 推送后验证 GitHub Pages + 同步 Gitee

### 代理配置
```bash
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
# 代理不可用时：git config --global --unset http.proxy
```

## GitHub Pages 部署

### 触发
推送到 `main` 分支后自动部署（1-3 分钟生效），推送 `master` 分支不会触发。

### 验证
1. 检查仓库文件：`https://github.com/Niverlost/Deep-Learning-Webpage`
2. 检查 Actions：`https://github.com/Niverlost/Deep-Learning-Webpage/actions`
3. 访问页面 `Ctrl+F5` 刷新，检查控制台 JS 错误

### 常见问题
| 现象 | 可能原因 | 解决方法 |
|------|----------|----------|
| 404 | Pages 未启用 | 检查 Settings → Pages |
| 骨架屏不消失 | `initApp()` 未调用 | 检查 app.js 末尾 |
| JS 模块加载失败 | `<base>` 路径错误 | 检查 index.html 的 base href |

## 开发注意事项

- **本地开发（主文件）**: 使用本地服务器（如 `python -m http.server`）避免 CORS 问题
- **本地测试（test/）**: 直接双击 `test/index.html` 打开，无需服务器，不受浏览器安全策略限制
- **CSP 策略**: 在 `index.html` meta 标签中定义，修改时注意同步
- **主题切换**: CSS 变量 + `data-theme` 属性
- **测试目录说明**: `test/` 不设安全防护，专注于内容设计和交互设计的验证。移除 `<base>`、放宽 CSP、去除 import/export、数据内联为 JS 变量，所有限制均为方便直接观察效果
- **同步注意**: 测试文件是主文件的独立副本，修改 `test/` 后需手动同步回 `js/`
