# ShipNow 产品详细设计方案

> 本文档是 ShipNow 第一版开发的产品与工程约束基准。  
> 目标是让 Codex 按照本文档实现一个稳定、受控、可真实上线使用的自用 AI 小独立站发布工作台。  
> 不做 0.5 过渡版；第一版要完整打通创建、生成、预览、修改、构建、发布、管理闭环。  
> 第二版能力不在本文档范围内，除“明确不做”章节外，不展开未来设想。

---

## 1. 项目概述

### 1.1 项目名称

ShipNow

### 1.2 ShipNow 自身访问地址

```text
https://boringmax.com/shipnow
```

ShipNow 本身也是 `boringmax.com` 下的一个独立管理后台入口。
它和 `shootman`、`loveadventure` 一样，属于 `boringmax` 站内的 path-based 子项目路由；不同的是，`ShipNow` 本身是一个独立的管理后台，不是纯展示型静态页。

### 1.3 ShipNow 生成项目的访问规则

预览地址：

```text
https://shipnow.boringmax.com/preview/{projectName}
```

正式地址：

```text
https://boringmax.com/{projectName}
```

示例：

```text
https://shipnow.boringmax.com/preview/gongde-basketball
https://boringmax.com/gongde-basketball
```

### 1.4 产品定位

ShipNow 是一个自用的 AI 小独立站快速发布工作台。

它不是完整在线 IDE，不是 Replit/Bolt/Lovable/Vercel 替代品，也不是通用低代码平台。

ShipNow 的核心目标是：

```text
输入一个小站想法 → AI 生成项目 → 在线预览 → 继续修改 → 一键发布 → 获得 boringmax.com/projectName 正式链接
```

### 1.5 第一版范围

第一版只支持由 ShipNow 生成和管理的纯前端静态项目。

第一版统一使用 `default-static-site` 模板，不再让创建流程先选项目分类。

如果需求明显是游戏，Codex 会根据用户的 prompt 自行切换为 Phaser 玩法；否则就沿用默认静态站点。

第一版不支持生成项目拥有自己的后端 API、数据库、登录系统、常驻服务进程或 Docker 服务。

注意：

- ShipNow 自身需要后端服务，用于管理项目、调用 Codex、执行构建、发布静态产物。
- “第一版不做后端应用”指的是 ShipNow 生成的子项目不做后端应用，不是指 ShipNow 自身没有后端。

---

## 2. 核心原则

开发过程中必须遵守以下原则：

1. ShipNow 是“小独立站发布工作台”，不是在线 IDE。
2. 第一版只生成纯前端静态站点。
3. 每个项目由统一默认模板 `default-static-site` 初始化。
4. Codex 只负责生成和修改项目源码，不负责发布、不负责改服务器配置。
5. 构建和发布由 ShipNow 后端通过固定流程执行。
6. 预览环境和正式环境严格分离。
7. 项目名必须严格校验，防止路径穿越、路由冲突和覆盖现有站点。
8. 生成项目不能随意新增依赖。
9. 生成项目不允许拥有后端服务。
10. 发布必须是静态构建产物发布，不暴露源码目录。
11. 任何失败都不能破坏当前线上正式版本。
12. 不写死 VPS 上已有 boringmax 项目的绝对路径，所有关键路径通过配置项管理。
13. ShipNow 必须有访问保护，不能公网裸奔。
14. 默认模板要有实用能力和成品感，不做空 Vite 模板。

---

## 3. 已拍板决策

### 3.1 ShipNow 自身技术栈

ShipNow 自身采用：

```text
Frontend: Vite + React + TypeScript + Tailwind CSS
Backend: Node.js + Fastify + TypeScript
Database: SQLite
Package Manager: pnpm
Process Manager: systemd
```

### 3.2 ShipNow 生成项目技术栈

所有由 ShipNow 创建的项目统一采用：

```text
Vite + React + TypeScript + Tailwind CSS + Phaser
```

其中 Phaser 默认集成在模板依赖中，但只有小游戏项目实际 import 使用。非游戏项目不需要加载 Phaser 代码。

### 3.3 包管理器

ShipNow 自身和 ShipNow 生成项目统一使用：

```text
pnpm
```

禁止在同一个项目体系中混用 npm、yarn、pnpm。

### 3.4 默认模板名称

```text
default-static-site
```

该模板不是空技术模板，而是一个面向真实小独立站发布的实用默认模板。

### 3.5 UI 组件实现方式

第一版不在生成项目时运行 shadcn/ui CLI。

默认模板内置一套 shadcn 风格的本地轻量 UI 组件，组件代码放在模板内，由生成项目直接继承使用。

### 3.6 默认模板依赖策略

默认模板内置依赖固定。

Codex 不允许为了实现单个项目随意新增依赖。除非 ShipNow 后台后续显式开放依赖审批能力，否则第一版禁止 Codex 修改 `package.json` 中的 dependencies/devDependencies。

### 3.7 游戏能力

默认模板集成 Phaser，并提供 Phaser 游戏宿主组件、基础场景结构和常用游戏 UI 组件。

小游戏项目必须优先使用模板内置的 Phaser 能力实现。

### 3.8 主题能力

第一版只提供浅色高级默认风格，不做用户可切换的深色/浅色主题。

模板需要使用 CSS 变量承载设计系统，为后续扩展保留结构，但第一版 UI 不提供主题切换功能。

### 3.9 访问保护

ShipNow 必须启用访问保护。

优先使用 Cloudflare Access 保护 `https://boringmax.com/shipnow` 和 `https://shipnow.boringmax.com/api`。

如果当前环境没有配置 Cloudflare Access，则必须通过 Caddy Basic Auth 保护 ShipNow 页面入口和 API 入口。

验收条件：

```text
ShipNow 不能在公网无认证访问。
Cloudflare Access 或 Caddy Basic Auth 至少启用一个。
```

### 3.10 当前 VPS 入口形态

在当前主机部署里，应用内部的路径模型和公网入口要分开看：

- ShipNow 代码里仍然存在 `/preview/:projectHandle` 这类预览路由，用来描述“项目预览页”的业务语义。
- 但在实际 VPS 上，公网预览域名已经单独切到 `shipnow.boringmax.com/preview/{projectName}`，不再通过 `boringmax.com/preview*` 暴露。
- 站点正式页则直接由 `boringmax.com/{projectName}` 的主站静态目录提供。

Caddy 的实际转发边界如下：

- `boringmax.com/shipnow` 进入 ShipNow 管理后台。
- `shipnow.boringmax.com/preview/{projectName}` 进入预览静态目录。
- `boringmax.com/{projectName}` 由主站静态目录提供正式发布内容。
- `shipnow.boringmax.com/api` 进入 ShipNow API。

这条入口形态是当前 VPS 的事实状态，后续实现和排障都应以此为准。

---

## 4. 用户目标与核心场景

### 4.1 创建小独立站

用户打开：

```text
https://boringmax.com/shipnow
```

填写：

- Project Name
- Idea / Prompt

点击创建。

ShipNow 创建项目目录，复制默认模板，调用 Codex 根据需求生成页面，构建成功后给出预览地址：

```text
https://shipnow.boringmax.com/preview/{projectName}
```

用户满意后点击发布，得到正式地址：

```text
https://boringmax.com/{projectName}
```

### 4.2 修改已有项目

用户进入项目详情页，输入修改需求，例如：

```text
把整体风格改得更高级一点，按钮不要太粉嫩，结算页更有梗。
```

ShipNow 调用 Codex 修改该项目源码。

修改后自动构建并更新预览地址。

正式地址不自动更新，必须用户点击 Publish 后才更新。

### 4.3 发布已有预览版本

用户点击 Publish。

ShipNow 将最近一次构建成功的预览版本发布到正式地址。

发布必须是原子切换或近似原子切换，不能让正式站点出现半发布状态。

### 4.4 查看和管理项目

用户可以在 ShipNow 首页查看所有项目：

- 项目名称
- 项目类型
- 当前状态
- 预览地址
- 正式地址
- 最近构建结果
- 最近修改时间
- 最近发布时间

用户可以进入详情页继续修改、重新构建、发布或删除项目。

---

## 5. 第一版明确不做

第一版不做以下功能：

- 完整在线 IDE
- 文件树编辑器
- 在线终端
- 用户注册
- 多用户权限系统
- 团队协作
- GitHub 集成
- 通用 CI/CD 平台
- 自定义域名管理
- 模板市场
- 多技术栈模板选择
- Next.js 项目
- Vue 项目
- Astro 项目
- 生成项目的后端 API
- 生成项目的数据库
- 生成项目的登录系统
- 生成项目的 Docker 服务
- 每个项目一个独立常驻进程
- 支付系统
- 项目计费
- 模型市场
- 公开 SaaS 化

第一版只做 ShipNow 自用场景，不考虑公开给他人使用。

---

## 6. 项目命名规则

### 6.1 Project Name 用途

`projectName` 同时用于：

```text
正式路径：https://boringmax.com/{projectName}
预览路径：https://shipnow.boringmax.com/preview/{projectName}
项目目录标识
数据库唯一标识
静态产物目录标识
```

### 6.2 合法格式

项目名必须满足：

```regex
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

规则：

- 只能包含小写英文字母、数字、中划线
- 不能包含大写字母
- 不能包含下划线
- 不能包含中文
- 不能包含空格
- 不能包含点号
- 不能包含斜杠
- 不能以中划线开头
- 不能以中划线结尾
- 不能出现连续中划线
- 长度建议 3 到 48 个字符

### 6.3 合法示例

```text
pixgallery
gongde-basketball
girlfriend-test
boring-tools
hello-shipnow
```

### 6.4 非法示例

```text
ShipNow
ship_now
ship now
我的项目
../test
api/test
hello.world
-game
game-
game--test
```

### 6.5 保留名称

以下名称禁止作为项目名：

```text
shipnow
api
admin
assets
static
preview
health
login
logout
auth
dashboard
settings
projects
new
system
public
private
```

其中 `shipnow` 必须保留，因为 ShipNow 自身访问路径为：

```text
https://boringmax.com/shipnow
```

### 6.6 重名规则

项目名全局唯一。

如果项目已存在，不允许重复创建。

---

## 7. 模板模式推断

### 7.1 创建项目不再显式选择类型

第一版创建项目表单只包含：

- Project Name
- Idea / Prompt

ShipNow 统一使用同一个 `default-static-site` 模板创建项目。

### 7.2 游戏模式自动推断

ShipNow 会根据用户的 prompt 自动判断是否需要游戏模式。

如果 prompt 明显是小游戏、互动玩法、投篮、Phaser、arcade 这类内容，Codex 应切换到游戏实现方式，并使用模板内置的 Phaser 能力。

否则默认沿用普通静态站点模式。

- 必须包含 hero、介绍、亮点、CTA。
- 页面必须有明确标题、描述和行动按钮。

如果 `projectType = article`：

- 必须提供良好的阅读排版。
- 移动端阅读体验必须清晰。

如果 `projectType = experiment`：

- 必须保持纯前端静态实现。
- 不允许引入后端或额外依赖。

---

## 8. 默认模板：default-static-site

### 8.1 模板定位

`default-static-site` 是 ShipNow 生成项目的唯一默认模板。

它的目标不是提供空白工程，而是提供一个具备真实小站常用能力的前端脚手架。

模板作用：

- 统一技术栈
- 统一构建方式
- 统一部署产物
- 统一视觉基础
- 统一路径兼容规则
- 统一组件使用方式
- 统一游戏基础能力
- 降低 Codex 自由发挥
- 提高生成成功率和成品质感

### 8.2 模板技术栈

```text
Vite
React
TypeScript
Tailwind CSS
Phaser
lucide-react
framer-motion
```

### 8.3 模板依赖

模板允许的 runtime dependencies：

```text
@vitejs/plugin-react
vite
typescript
react
react-dom
tailwindcss
postcss
autoprefixer
lucide-react
framer-motion
phaser
```

说明：

- `phaser` 默认集成，用于小游戏项目。
- 非游戏项目不应 import Phaser 相关模块。
- 默认模板内置本地 UI 组件，不依赖 shadcn CLI。
- 不允许 Codex 为具体项目新增额外依赖。
- 不允许引入后端框架。
- 不允许引入数据库客户端。
- 不允许引入大型图表库、3D 库、状态管理库，除非未来版本正式加入模板依赖白名单。

### 8.4 模板目录结构

概念结构如下，实际存储路径通过配置项指定，不写死绝对路径。

```text
templates/
  default-static-site/
    package.json
    pnpm-lock.yaml
    index.html
    vite.config.ts
    tsconfig.json
    postcss.config.js
    tailwind.config.ts
    SHIPNOW_TEMPLATE_GUIDE.md
    src/
      main.tsx
      App.tsx
      project.config.ts
      styles/
        globals.css
        tokens.css
      components/
        ui/
          Button.tsx
          Card.tsx
          Input.tsx
          Textarea.tsx
          Dialog.tsx
          Toast.tsx
          Badge.tsx
          Tabs.tsx
          Switch.tsx
          Slider.tsx
          Progress.tsx
        layouts/
          LandingLayout.tsx
          ToolLayout.tsx
          GameLayout.tsx
          GalleryLayout.tsx
          ArticleLayout.tsx
          ExperimentLayout.tsx
        share/
          CopyLinkButton.tsx
          ShareButton.tsx
          QRCodeBlock.tsx
          ResultCard.tsx
          ResultShareBlock.tsx
        game/
          PhaserGameHost.tsx
          createBaseScene.ts
          GameStartScreen.tsx
          GameOverScreen.tsx
          ScorePanel.tsx
          TouchControls.tsx
        states/
          EmptyState.tsx
          LoadingState.tsx
          ErrorState.tsx
          FallbackScreen.tsx
      hooks/
        useLocalStorage.ts
        useSessionStorage.ts
        useDebounce.ts
        useClipboard.ts
        useMediaQuery.ts
        useGameLoop.ts
        useKeyboard.ts
        usePointer.ts
        useSound.ts
      lib/
        cn.ts
        seo.ts
        download.ts
        random.ts
        format.ts
        storage.ts
      data/
        sampleData.ts
      error/
        ErrorBoundary.tsx
```

### 8.5 模板配置文件

每个生成项目必须包含：

```text
src/project.config.ts
```

结构：

```ts
export const projectConfig = {
  name: "project-name",
  title: "Project Title",
  description: "Project description",
  type: "landing",
  author: "BoringMax",
  publicUrl: "https://boringmax.com/project-name",
  previewUrl: "https://shipnow.boringmax.com/preview/project-name",
};
```

Codex 创建或修改项目时，必须优先维护该配置文件。

### 8.6 模板说明文档

模板必须包含：

```text
SHIPNOW_TEMPLATE_GUIDE.md
```

该文档写给 Codex，必须包含以下约束：

```text
你正在修改一个由 ShipNow 管理的纯前端静态项目。
不要更换技术栈。
不要添加后端服务。
不要添加数据库。
不要新增依赖。
不要修改构建命令。
不要假设网站部署在根路径 /。
不要写死 /assets 这种根路径资源。
优先使用 src/components 中已有组件。
优先使用 src/project.config.ts 维护站点信息。
确保 pnpm build 可以成功。
如果项目类型是 game，优先使用 PhaserGameHost 和 Phaser 相关基础组件。
如果项目类型不是 game，不要 import Phaser。
```

---

## 9. 默认模板增强能力

### 9.1 UI 组件

模板内置以下本地轻量组件：

- Button
- Card
- Input
- Textarea
- Dialog
- Toast
- Badge
- Tabs
- Switch
- Slider
- Progress

要求：

- 组件使用 TypeScript。
- 组件样式基于 Tailwind CSS。
- 组件不依赖外部 UI 框架。
- 组件风格统一，偏高级、轻量、干净。
- 不做花哨拟物，不做强烈彩色渐变，不做廉价 Bootstrap 风格。
- 所有组件默认支持移动端基本可用性。

### 9.2 设计系统

模板必须包含 CSS 变量和基础设计 token。

默认视觉风格：

```text
浅色
干净
轻盈
高级
适合独立站
适合小工具
适合创意小站
适合小游戏包装
```

基础规范：

- 页面背景使用低饱和浅色或近白色。
- 主色使用低饱和高级色，不使用高饱和大红大紫。
- 卡片使用细边框、轻阴影、大圆角。
- 按钮有清晰 hover/active 状态。
- 标题层级清楚。
- 正文阅读舒适。
- 移动端间距不能过密。
- 默认最大内容宽度合理，不让文本横向拉太长。

模板必须提供：

```text
tokens.css
globals.css
```

其中 `tokens.css` 管理颜色、圆角、阴影、间距等变量。

### 9.3 Layout 组件

模板内置以下布局：

- LandingLayout
- ToolLayout
- GameLayout
- GalleryLayout
- ArticleLayout
- ExperimentLayout

Codex 根据用户 prompt 和内容方向选择对应 Layout。

要求：

- Layout 只是结构组件，不是独立模板。
- Layout 必须兼容移动端。
- Layout 不应限制具体创意表达。
- Layout 必须提供基础页面边距、内容宽度和视觉结构。

### 9.4 分享与传播能力

模板必须内置：

- CopyLinkButton
- ShareButton
- QRCodeBlock
- ResultCard
- ResultShareBlock

用途：

- 快速复制正式链接
- 分享测试结果
- 展示小游戏结算结果
- 生成适合传播的结果卡片
- 显示二维码入口

说明：

- 第一版 QRCodeBlock 可以使用轻量原生实现或 SVG/Canvas 实现。
- 如果实现二维码需要新增依赖，则第一版不要新增二维码依赖，可以先提供复制链接和占位二维码块。
- 不允许为了二维码新增第三方库。

### 9.5 本地状态与常用 Hooks

模板必须内置：

- useLocalStorage
- useSessionStorage
- useDebounce
- useClipboard
- useMediaQuery
- useGameLoop
- useKeyboard
- usePointer
- useSound

用途：

- 保存用户输入
- 保存游戏分数
- 保存设置
- 复制结果
- 移动端判断
- 游戏循环
- 键盘控制
- 指针/触摸控制
- 音效开关

### 9.6 状态组件

模板必须内置：

- EmptyState
- LoadingState
- ErrorState
- FallbackScreen
- ErrorBoundary

要求：

- Codex 实现工具页、展示页时必须处理空状态。
- 构建出来的小站不能因为运行时错误直接白屏。
- ErrorBoundary 必须包裹 App 主体。

### 9.7 SEO 与分享元信息

模板必须支持基础 SEO 信息：

- title
- description
- favicon
- Open Graph 基础字段
- Twitter Card 基础字段

实现要求：

- `src/project.config.ts` 是站点元信息的源码。
- Codex 创建项目时必须同步更新 `index.html` 中的 title 和 meta description。
- `src/lib/seo.ts` 在运行时根据 `projectConfig` 更新 document title 和必要 meta。
- 不做 SSR。
- 不保证所有社交平台都能读取运行时更新的 meta，因此 `index.html` 的静态 meta 必须在生成阶段写入合理内容。

### 9.8 路径兼容能力

生成项目部署在子路径：

```text
https://boringmax.com/{projectName}
https://shipnow.boringmax.com/preview/{projectName}
```

所以模板必须满足：

- 不假设部署在域名根路径 `/`。
- 不写死 `/assets`。
- 静态资源优先使用相对路径。
- 不默认引入 React Router。
- 如果项目需要多页面感，优先用组件状态或 hash。
- Vite 构建必须在子路径部署下正常加载资源。
- 预览和正式路径一致，都以 `/{projectName}` 作为访问路径。

推荐 Vite base 策略：

```text
默认使用相对 base，保证静态资源在 /projectName 下可加载。
```

具体实现由 Codex 在模板内固定，不允许每个项目临时自由处理。

### 9.9 移动端适配

默认模板必须内置移动端优先能力：

- 响应式容器
- 移动端按钮尺寸
- 移动端卡片间距
- 移动端输入框可点击区域
- 安全区域适配
- 横竖屏基础兼容
- 小游戏触摸控制基础组件

生成项目必须在手机宽度下可用。

### 9.10 动效能力

模板内置 `framer-motion`。

允许使用：

- FadeIn
- SlideUp
- ScaleIn
- AnimatedNumber

要求：

- 动效克制。
- 不影响阅读。
- 不做满屏乱飞。
- 不阻塞交互。
- 不为了动效牺牲构建稳定性。

这些基础动效组件可以放在：

```text
src/components/ui
```

或：

```text
src/components/motion
```

如果新增 `motion` 目录，必须保持命名清晰。

### 9.11 Phaser 游戏能力

模板必须默认集成 Phaser，并提供：

- PhaserGameHost
- createBaseScene
- GameStartScreen
- GameOverScreen
- ScorePanel
- TouchControls

小游戏项目基本结构要求：

```text
开始界面
游戏主界面
结算界面
分数或结果
重新开始
移动端触摸操作
基础音效开关
```

Phaser 使用要求：

- 游戏代码必须局限在项目源码内。
- Phaser canvas 不能破坏页面整体布局。
- Phaser 容器必须响应式适配。
- 移动端必须有可操作的触摸控制。
- 游戏结束必须回到 React UI 的结算/分享区域，或提供同等功能。
- 非游戏项目不要 import Phaser。

### 9.12 下载与导出工具

模板内置：

- downloadText
- downloadJson
- copyToClipboard
- exportElementAsImage 占位函数

说明：

- `downloadText`、`downloadJson` 必须可用。
- `copyToClipboard` 必须可用。
- `exportElementAsImage` 第一版如果不引入依赖，可以只实现基础说明或轻量实现；不得为了截图导出新增依赖。
- Codex 不得为了导出图片新增 html2canvas 等依赖。

### 9.13 Mock 与随机工具

模板内置：

- sampleData.ts
- random.ts
- format.ts

用途：

- 随机文案
- 随机分数
- 随机标签
- 示例卡片
- 示例图片占位
- 测试类结果文案

---

## 10. ShipNow 系统架构

### 10.1 架构角色

ShipNow 包含以下部分：

```text
ShipNow Frontend
ShipNow Backend
SQLite Metadata Database
Task Runner
Codex Runner
Template Manager
Build Manager
Preview Publisher
Production Publisher
Static File Roots
Caddy / Cloudflare
```

### 10.2 职责划分

#### ShipNow Frontend

负责：

- 项目列表
- 创建项目表单
- 项目详情页
- 修改需求输入
- 任务状态展示
- 构建日志展示
- 预览链接展示
- 发布操作
- 删除操作

#### ShipNow Backend

负责：

- API
- 认证后的请求处理
- 项目名校验
- 数据库存储
- 任务创建
- 调用 Codex Runner
- 执行构建
- 发布预览产物
- 发布正式产物
- 写入日志
- 返回任务状态

#### Codex Runner

负责：

- 在受控项目目录中调用 Codex CLI
- 将用户 Prompt、模板约束和内部模式提示传给 Codex
- 捕获 stdout/stderr
- 记录日志
- 不做发布
- 不改 Caddy
- 不改系统配置

#### Build Manager

负责：

- 在项目 source 目录执行固定构建命令
- 捕获构建日志
- 校验 dist 产物存在
- 构建失败时阻止发布

#### Publisher

负责：

- 将构建成功的 dist 产物发布到预览环境
- 将当前预览版本发布到正式环境
- 保留正式发布快照
- 防止发布失败破坏线上版本

---

## 11. 配置项设计

不写死 VPS 上已有路径。ShipNow 必须通过配置项确定工作目录和静态目录。

推荐使用 `.env` 或系统环境变量。

### 11.1 必需配置项

```text
SHIPNOW_PORT
SHIPNOW_PUBLIC_BASE_URL
SHIPNOW_PREVIEW_BASE_URL
SHIPNOW_API_BASE_URL
SHIPNOW_APP_PREFIX
SHIPNOW_WORKSPACE_ROOT
SHIPNOW_TEMPLATE_ROOT
SHIPNOW_PREVIEW_STATIC_ROOT
SHIPNOW_PUBLIC_STATIC_ROOT
SHIPNOW_LOG_ROOT
SHIPNOW_DB_PATH
SHIPNOW_CODEX_BIN
SHIPNOW_TASK_TIMEOUT_SECONDS
```

### 11.2 推荐配置值语义

```text
SHIPNOW_PUBLIC_BASE_URL=https://boringmax.com
SHIPNOW_PREVIEW_BASE_URL=https://shipnow.boringmax.com/preview
SHIPNOW_API_BASE_URL=https://shipnow.boringmax.com/api
SHIPNOW_APP_PREFIX=/shipnow
```

`SHIPNOW_WORKSPACE_ROOT` 表示 ShipNow 的项目工作区根目录。

- 在本地开发时，它指向本地工作区路径。
- 在 VPS 部署时，它对应 `/opt/boringmax/shipnow`。

其他静态目录和日志目录由 Codex 根据现有 VPS 结构和本地开发环境分别配置，不在文档中写死。

### 11.3 启动校验

ShipNow 后端启动时必须校验：

- 必需配置项存在。
- 相关目录存在或可创建。
- SQLite 文件可读写。
- Codex CLI 可执行。
- pnpm 可执行。
- 默认模板目录存在。
- 预览静态根目录可写。
- 正式静态根目录可写。
- 日志目录可写。

如果校验失败，服务应启动失败并输出明确错误，不要在运行时默默失败。

### 11.4 截至 2026-05-25 的当前 VPS 实测现状

以下内容来自 2026-05-25 对目标 VPS 的实机检查，只用于约束第一版部署方案，不代表未来不可调整。当前 VPS 已完成主机原生迁移，公共 Web 入口和核心业务服务都已从 Docker 切换到 host service：

```text
Hostname: fine-bits-1.localdomain
Public IP: 89.208.242.44
OS: AlmaLinux 9.7 x86_64
Kernel: 5.14.0-611.30.1.el9_7.x86_64
CPU: 2 vCPU
Memory: 1.0 GiB
Disk: 20 GiB root disk, inspected available space about 13 GiB
```

当前机器上已确认：

- 主机层可用 `systemctl`。
- 当前 PATH 中可用 `node`、`npm`、`pnpm`。
- `sqlite3` 与 `codex` 仍未在 PATH 中确认到。
- 当前已上线的 host services 包括：

```text
caddy.service
postgresql.service
redis.service
sub2api.service
sing-box-hysteria2.service
```

- 公网 `80/443` 现在由主机 Caddy 直接接管，不再依赖 Docker 入口。
- `sub2api` 现在监听在 `127.0.0.1:8080`。
- `PostgreSQL` 现在监听在 `127.0.0.1:5432`。
- `Redis` 现在监听在 `127.0.0.1:6379`。
- `sing-box-hysteria2.service` 继续独立工作，监听 `UDP 443`，不参与 Web 入口迁移。
- 现有站点相关目录已存在：

```text
/opt/boringmax
/opt/boringmax/Caddyfile
/opt/boringmax/docker-compose.yml
/opt/boringmax/site
/opt/toptokenx/sub2api
/opt/toptokenx/sub2api/deploy/Caddyfile
```

- `/opt/boringmax/site` 当前已存在静态内容示例：

```text
/opt/boringmax/site/index.html
/opt/boringmax/site/loveadventure
/opt/boringmax/site/shootman
```

因此：

- ShipNow 第一版已经可以假设目标 VPS 具备 `node`、`npm`、`pnpm`。
- ShipNow 第一版仍不能假设目标 VPS 具备 `sqlite3`、`codex`。
- ShipNow 如果采用主机进程方式部署，应直接复用当前 host-native 入口模型，不要再依赖 Docker 作为公网入口。

---

## 12. 数据模型

第一版使用 SQLite 保存元数据。

### 12.1 projects 表

字段：

```text
id
name
title
type
status
preview_url
public_url
created_at
updated_at
last_built_at
last_published_at
last_successful_build_id
current_preview_release_id
current_public_release_id
deleted_at
```

约束：

- `name` 唯一。
- `type` 必须是固定枚举。
- `deleted_at` 为空表示未删除。

### 12.2 tasks 表

字段：

```text
id
project_name
type
status
prompt
started_at
finished_at
log_path
error_message
created_at
updated_at
```

任务类型：

```text
create_project
apply_change
rebuild
publish
delete_project
```

任务状态：

```text
pending
running
success
failed
cancelled
```

### 12.3 releases 表

字段：

```text
id
project_name
kind
source
release_path
created_at
published_at
build_task_id
is_current_preview
is_current_public
```

`kind`：

```text
preview
public
```

说明：

- 每次构建成功生成一个 preview release。
- 每次发布成功生成或激活一个 public release。
- 正式站点必须始终指向一个成功 release。

---

## 13. 项目状态设计

Project status 固定为：

```text
draft
generating
build_failed
preview_ready
published
publishing
publish_failed
deleted
```

含义：

- `draft`：项目记录已创建，但尚未生成成功。
- `generating`：Codex 正在生成或修改。
- `build_failed`：最近一次生成或构建失败。
- `preview_ready`：预览版本可用，存在未发布变更或尚未发布。
- `published`：正式版本已发布，且没有未发布的成功预览变更。
- `publishing`：正在发布。
- `publish_failed`：发布失败，正式版本保持不变。
- `deleted`：项目已删除或移入删除状态。

状态转换要求：

- 构建失败不能进入 `preview_ready`。
- 没有成功构建不能发布。
- 发布失败不能破坏已有 `published` 版本。
- 删除后不能继续修改、构建、发布。

---

## 14. API 设计

ShipNow API 统一挂在：

```text
https://shipnow.boringmax.com/api
```

### 14.1 项目列表

```http
GET /api/projects
```

返回所有未删除项目。

### 14.2 创建项目

```http
POST /api/projects
```

请求：

```json
{
  "name": "gongde-basketball",
  "type": "game",
  "title": "功德篮球",
  "prompt": "做一个反直觉功德篮球小游戏，玩家通过蓄力投篮获取功德值。"
}
```

响应：

```json
{
  "project": {
    "name": "gongde-basketball",
    "status": "generating",
    "previewUrl": "https://shipnow.boringmax.com/preview/gongde-basketball",
    "publicUrl": "https://boringmax.com/gongde-basketball"
  },
  "taskId": "task_xxx"
}
```

### 14.3 获取项目详情

```http
GET /api/projects/:projectName
```

### 14.4 修改项目

```http
POST /api/projects/:projectName/changes
```

请求：

```json
{
  "prompt": "把结算页做得更有梗，增加分享结果卡片。"
}
```

### 14.5 重新构建

```http
POST /api/projects/:projectName/rebuild
```

### 14.6 发布项目

```http
POST /api/projects/:projectName/publish
```

要求：

- 只有最近一次 preview release 构建成功，才能发布。
- 发布成功后更新 public release。
- 发布失败不得破坏当前正式版本。

### 14.7 删除项目

```http
DELETE /api/projects/:projectName
```

要求：

- 前端必须二次确认。
- 后端必须校验项目名。
- 删除不能影响其他项目。
- 删除后正式链接和预览链接应不可访问或返回 Caddy/静态默认 404。
- 第一版可以采用软删除数据库记录 + 移除静态 symlink/目录的方式。

### 14.8 获取任务状态

```http
GET /api/tasks/:taskId
```

### 14.9 获取任务日志

```http
GET /api/tasks/:taskId/logs
```

日志返回纯文本或结构化数组均可，但前端必须能清晰展示最近日志。

---

## 15. 任务执行规则

### 15.1 并发规则

第一版为了保护 VPS 资源，任务并发规则固定为：

```text
全局同时最多运行 1 个 Codex 任务。
同一项目同时最多运行 1 个任务。
```

如果已有任务运行，新任务进入 pending 队列。

### 15.2 超时规则

每个任务必须有超时。

默认：

```text
SHIPNOW_TASK_TIMEOUT_SECONDS=1800
```

即 30 分钟。

超时后：

- 标记任务 failed。
- 写入错误日志。
- 不更新预览。
- 不影响正式版本。

### 15.3 日志规则

每个任务必须有独立日志文件。

日志至少记录：

- 任务 ID
- 项目名
- 任务类型
- 开始时间
- 结束时间
- Codex 输出
- 构建输出
- 发布输出
- 错误信息

日志不得泄露：

- Codex 认证信息
- API Key
- Cloudflare Token
- SSH Key
- 系统环境变量中的秘密值

---

## 16. Codex Runner 设计

### 16.1 调用方式

ShipNow 后端通过配置项 `SHIPNOW_CODEX_BIN` 找到 Codex CLI。

Codex Runner 必须使用安全进程调用方式：

- 使用 spawn/execFile 类 API。
- 不使用 shell 拼接用户输入。
- 用户 prompt 通过 stdin、临时文件或安全参数传入。
- 工作目录固定为当前项目 source 目录。

### 16.2 Codex 工作目录

Codex 只能在当前项目的 source 目录内工作。

不允许 Codex：

- 修改 ShipNow 自身代码
- 修改其他项目代码
- 修改 Caddy 配置
- 修改系统服务
- 修改发布目录
- 读取服务器敏感目录

### 16.3 Codex Prompt 结构

ShipNow 调用 Codex 时必须组装结构化提示。

提示必须包含：

```text
1. 当前项目名称
2. 当前项目类型
3. 用户需求
4. 当前项目是 ShipNow 管理的纯前端静态项目
5. 使用 default-static-site 模板
6. 禁止新增依赖
7. 禁止后端服务
8. 禁止修改构建命令
9. 禁止假设部署在根路径 /
10. 必须保证 pnpm build 成功
11. 如果项目类型为 game，必须使用 Phaser
12. 优先使用模板已有 components/hooks/lib
```

### 16.4 创建项目时的 Codex 指令

创建项目时 Codex 的目标：

- 根据用户 prompt 实现一个完整可访问的小站。
- 更新 `src/project.config.ts`。
- 更新页面标题和描述。
- 使用模板已有 Layout 和 UI 组件。
- 如果需求明显是游戏，则使用 Phaser 和游戏宿主结构。
- 使用模板已有 UI 组件。
- 保证移动端可用。
- 保证 `pnpm build` 成功。

### 16.5 修改项目时的 Codex 指令

修改项目时 Codex 的目标：

- 只修改当前项目源码。
- 保持原有技术栈。
- 不新增依赖。
- 不引入后端。
- 根据用户修改需求调整页面。
- 不破坏已有核心功能。
- 保证 `pnpm build` 成功。

### 16.6 本地优先开发与同步

ShipNow 第一版开发流程必须本地优先：

- 新功能、改动、调试和构建验证优先在本地工作区完成。
- 重型安装、构建和测试不要求在 VPS 上执行。
- VPS 只承担部署、运行、预览和正式访问，不作为主要开发机。
- 开发完成后，再把确认过的结果同步到 VPS 的 `/opt/boringmax/shipnow`。
- 如果本地与 VPS 环境有差异，以本地开发效率和可重复性为先，VPS 只保留必要的运行时约束。

---

## 17. 创建项目流程

完整流程：

1. 用户在前端填写 Project Name、Title、Prompt。
2. 前端调用 `POST /api/projects`。
3. 后端校验项目名。
4. 后端校验项目名未被占用。
5. 后端创建 projects 记录，状态为 `draft`。
6. 后端创建任务 `create_project`，状态为 `pending`。
7. Task Runner 开始执行任务，状态改为 `running`。
8. 创建项目工作目录。
9. 复制 `default-static-site` 模板到项目 source 目录。
10. 写入项目初始配置。
11. 执行 `pnpm install --frozen-lockfile`。
12. 调用 Codex CLI 生成项目。
13. 执行 `pnpm build`。
14. 构建成功后创建 preview release。
15. 将 preview release 暴露到 `shipnow.boringmax.com/preview/{projectName}`。
16. 更新项目状态为 `preview_ready`。
17. 任务状态改为 `success`。
18. 前端展示预览地址。

失败规则：

- 任一步失败，任务状态为 `failed`。
- 项目状态为 `build_failed` 或 `draft`。
- 写入错误日志。
- 不创建正式发布。
- 不影响其他项目。

---

## 18. 修改项目流程

完整流程：

1. 用户进入项目详情页。
2. 用户输入修改需求。
3. 前端调用 `POST /api/projects/:projectName/changes`。
4. 后端校验项目存在且未删除。
5. 后端创建 `apply_change` 任务。
6. Task Runner 将项目状态改为 `generating`。
7. Codex Runner 在项目 source 目录内执行修改。
8. 执行 `pnpm build`。
9. 构建成功后创建新的 preview release。
10. 更新预览地址指向新 preview release。
11. 项目状态改为 `preview_ready`。
12. 正式站点保持不变。
13. 用户点击 Publish 后才更新正式站点。

失败规则：

- 构建失败不更新 preview release。
- 正式站点不受影响。
- 用户可以基于当前源码继续提交修复需求。
- 失败日志必须可查看。

---

## 19. 构建流程

### 19.1 固定构建命令

生成项目统一使用：

```bash
pnpm install --frozen-lockfile
pnpm build
```

### 19.2 构建产物

构建产物目录固定为：

```text
dist
```

### 19.3 构建校验

构建成功后必须校验：

- `dist` 目录存在。
- `dist/index.html` 存在。
- 构建命令退出码为 0。

如果缺少这些条件，视为构建失败。

---

## 20. 预览发布流程

### 20.1 预览地址

```text
https://shipnow.boringmax.com/preview/{projectName}
```

### 20.2 预览发布规则

每次构建成功后自动更新预览。

预览更新不影响正式地址。

### 20.3 预览静态产物

预览产物来自最近一次成功构建的 `dist`。

预览目录必须只暴露静态构建产物，不暴露源码。

### 20.4 预览失败

如果构建失败：

- 预览保持上一次成功版本。
- 如果没有上一次成功版本，则预览地址不可用。
- 页面显示构建错误日志。

---

## 21. 正式发布流程

### 21.1 正式地址

```text
https://boringmax.com/{projectName}
```

### 21.2 发布条件

只有满足以下条件才能发布：

- 项目未删除。
- 存在成功的 preview release。
- 最近一次构建成功。
- 当前没有正在运行的项目任务。

### 21.3 发布规则

发布时：

1. 读取当前 preview release。
2. 创建 public release。
3. 将正式地址指向新的 public release。
4. 更新项目状态为 `published`。
5. 记录 `last_published_at`。

### 21.4 发布安全

发布失败时：

- 当前正式版本必须保持不变。
- 不允许出现空目录覆盖正式站点。
- 不允许半复制状态对外可见。
- 错误日志必须可查看。

### 21.5 Release 保留

第一版必须保留至少最近 5 个正式 release。

超过 5 个的旧 release 可以清理。

清理不能删除当前正式 release。

---

## 22. 静态目录与 Caddy 原则

### 22.1 不写死绝对路径

本文档不规定 VPS 上具体绝对路径。

Codex 必须通过配置项读取：

```text
SHIPNOW_PREVIEW_STATIC_ROOT
SHIPNOW_PUBLIC_STATIC_ROOT
```

### 22.2 Caddy 路由目标

Caddy 需要满足：

```text
https://boringmax.com/shipnow
→ ShipNow 后端服务

https://shipnow.boringmax.com/api
→ ShipNow API

https://boringmax.com/{projectName}
→ 对应项目正式静态产物

https://shipnow.boringmax.com/preview/{projectName}
→ 对应项目预览静态产物
```

### 22.3 新项目不应手动改 Caddy

目标是：

```text
新增项目后，ShipNow 只需要创建静态产物映射，即可访问。
```

不应每新增一个项目就手动修改 Caddyfile。

ShipNow 页面入口必须服从 `boringmax` 现有的通用 path-based 规则，不需要为它单独预留特殊路由槽位。API 则走独立子域名入口。

如果当前 Caddy 结构不支持这种统一静态托管，Codex 需要输出明确的 Caddy 配置调整建议，并在得到用户实际部署确认前不要覆盖现有配置。

### 22.4 截至 2026-05-25 的当前 VPS 入口现状

当前 VPS 的公网 80/443 入口已经切换为主机直接运行的 Caddy。

已确认事实：

- 主机 Caddy 的配置文件来自：

```text
/etc/caddy/Caddyfile
```

- 当前主机 Caddy 已接管的站点包括：

```text
boringmax.com
toptokenx.com
api.toptokenx.com
```

- `boringmax.com` 的静态站点根目录为：

```text
/opt/boringmax/site
```

- `toptokenx.com, api.toptokenx.com` 反向代理到：

```text
127.0.0.1:8080
```

- `sing-box-hysteria2.service` 继续独立使用 `UDP 443`，不与 Web 入口冲突。
- `docker ps` 当前为空，说明生产流量已不再依赖 Docker 容器入口。
- Docker compose 文件仍保留在磁盘上作为历史/回滚参考，但不再是当前公网入口路径。

- ShipNow 页面入口仍然是 `boringmax.com/shipnow`，而 API 入口单独使用 `shipnow.boringmax.com/api`。
- 这意味着第一版实现时可以把页面和 API 的职责分开，不需要再兼容旧的混合入口模型。

---

## 23. 前端 UI 设计

### 23.1 整体风格

ShipNow 自身 UI 风格：

- 干净
- 工具型
- 轻量
- 明确
- 不做复杂 IDE
- 不做代码编辑器界面
- 不做过度装饰

### 23.2 页面结构

ShipNow 前端为单页应用，访问路径：

```text
/shipnow
```

内部视图包括：

- Project List
- New Project
- Project Detail
- Task Logs
- Settings/Status

可以使用前端状态切换或路由，但所有实际访问都在 `/shipnow` 下完成。

### 23.3 项目列表页

显示字段：

- Project Name
- Type
- Status
- Preview
- Production
- Last Build
- Last Published
- Updated At
- Actions

Actions：

- Open Preview
- Open Production
- Edit
- Rebuild
- Publish
- Delete

### 23.4 创建项目页

字段：

- Project Name
- Project Title
- Idea / Prompt

不再显示 Project Type 下拉，游戏模式由 prompt 自动推断。

按钮：

```text
Create Project
```

校验提示：

- 项目名为空
- 项目名格式错误
- 项目名已存在
- 项目名是保留名称
- Prompt 为空

### 23.5 项目详情页

展示：

- 项目名称
- 项目类型
- 当前状态
- 预览地址
- 正式地址
- 最近任务
- 最近构建结果
- 最近发布时间
- 修改需求输入框
- 任务日志

主要操作：

- Apply Change
- Rebuild
- Publish
- Open Preview
- Open Production
- Delete

### 23.6 预览方式

项目详情页必须提供预览链接。

如果实现 iframe 预览，iframe 只是增强，不作为验收硬依赖。

第一版验收核心是预览地址能稳定访问。

### 23.7 日志展示

前端通过轮询获取任务状态和日志。

轮询间隔：

```text
1500ms
```

任务结束后停止轮询。

日志区域需要：

- 展示运行中状态
- 展示成功/失败
- 支持滚动
- 保留错误信息
- 不需要做复杂日志搜索

---

## 24. 安全设计

### 24.1 访问保护

ShipNow 不能裸奔。

必须满足：

```text
Cloudflare Access 或 Caddy Basic Auth 至少启用一个。
```

### 24.2 路径安全

所有使用 projectName 构造路径的地方，必须先通过项目名白名单校验。

禁止：

```text
../
./
/
\
~
:
*
?
"
<
>
|
```

### 24.3 命令安全

禁止把用户输入直接拼接到 shell 命令。

必须使用安全参数调用。

### 24.4 Codex 权限边界

Codex 只允许操作当前项目 source 目录。

Codex 不允许：

- 改 Caddy
- 改 systemd
- 改 ShipNow 数据库
- 改其他项目
- 改发布目录
- 读取密钥
- 写系统目录

### 24.5 发布权限边界

发布由 ShipNow 后端固定逻辑执行。

Codex 不参与发布。

### 24.6 日志脱敏

日志写入前需要尽量避免输出敏感环境变量。

至少不能主动打印：

- API Key
- Token
- SSH Key
- Codex auth 信息
- Cloudflare credential
- 系统环境变量完整列表

---

## 25. 删除项目设计

### 25.1 删除确认

前端删除项目必须二次确认。

确认方式：

```text
输入项目名确认删除
```

### 25.2 删除行为

删除后：

- 项目状态标记为 `deleted`。
- 移除预览静态映射。
- 移除正式静态映射。
- 保留日志和数据库记录。
- 项目不在默认列表显示。
- 不允许继续修改、构建、发布。

### 25.3 删除安全

删除只能影响 ShipNow 管理的对应项目。

不能递归删除配置目录外的任何路径。

---

## 26. 错误处理

### 26.1 创建失败

创建失败时：

- 任务状态为 failed。
- 项目状态为 draft 或 build_failed。
- 展示失败日志。
- 不创建预览。
- 不创建正式发布。

### 26.2 Codex 修改失败

修改失败时：

- 任务状态为 failed。
- 不更新预览。
- 不影响正式站点。
- 展示 Codex 日志。

### 26.3 构建失败

构建失败时：

- 项目状态为 build_failed。
- 不允许发布。
- 预览保持上一次成功版本。
- 展示构建错误。

### 26.4 发布失败

发布失败时：

- 项目状态为 publish_failed。
- 正式版本保持原样。
- 展示发布错误。
- 允许用户重试发布。

### 26.5 任务超时

任务超时时：

- 任务状态为 failed。
- 写入 timeout 错误。
- 终止子进程。
- 不更新预览。
- 不影响正式版本。

---

## 27. 验收标准

### 27.1 ShipNow 访问保护

访问：

```text
https://boringmax.com/shipnow
```

预期：

- 未授权用户不能直接访问。
- 启用 Cloudflare Access 或 Caddy Basic Auth。
- 授权后可以进入 ShipNow 页面。

### 27.2 创建普通 Landing 项目

输入：

```text
Project Name: hello-shipnow
Project Title: Hello ShipNow
Prompt: 做一个极简高级的个人独立站首页，包含标题、介绍、亮点和按钮。
```

预期：

- 项目创建成功。
- 使用 `default-static-site` 模板。
- Codex 生成页面。
- `pnpm build` 成功。
- 可以访问 `https://shipnow.boringmax.com/preview/hello-shipnow`。
- 正式地址尚未更新，直到点击 Publish。

### 27.3 创建 Phaser 小游戏项目

输入：

```text
Project Name: gongde-basketball
Project Title: 功德篮球
Prompt: 做一个反直觉功德篮球小游戏，玩家通过蓄力投篮获得功德值，结算页要有梗并支持复制分享结果。
```

预期：

- 项目创建成功。
- Codex 使用模板内置 Phaser 能力。
- 页面包含开始界面、游戏界面、结算界面。
- 移动端有触摸操作方式。
- 结算页有结果展示和复制分享。
- `pnpm build` 成功。
- 可以访问 `https://shipnow.boringmax.com/preview/gongde-basketball`。

### 27.4 修改项目

输入修改需求：

```text
把视觉风格改得更像高级科技品牌官网，增加更有质感的 hero 区域。
```

预期：

- Codex 修改当前项目。
- 不新增依赖。
- 不引入后端。
- `pnpm build` 成功。
- 预览地址更新。
- 正式地址保持旧版本。

### 27.5 发布项目

点击 Publish。

预期：

- 正式地址 `https://boringmax.com/{projectName}` 可访问。
- 内容与当前预览版本一致。
- 项目状态变为 `published`。
- 记录发布时间。
- 保留 release 记录。

### 27.6 构建失败保护

让 Codex 产生一次构建失败。

预期：

- 项目状态为 build_failed。
- 错误日志可见。
- 不允许发布失败版本。
- 正式站点不受影响。
- 上一次成功预览不被覆盖。

### 27.7 发布失败保护

模拟发布失败。

预期：

- 当前正式站点不被破坏。
- 项目状态为 publish_failed。
- 错误日志可见。
- 可以重试发布。

### 27.8 项目名校验

输入以下非法名称：

```text
ShipNow
ship_now
ship now
我的项目
../test
shipnow
api
game--test
-game
game-
```

预期：

- 全部被拒绝。
- 前端和后端都必须校验。
- 后端校验是最终可信校验。

### 27.9 重名校验

创建同名项目两次。

预期：

- 第一次成功。
- 第二次失败。
- 返回明确错误信息。

### 27.10 删除项目

删除项目时输入项目名确认。

预期：

- 项目标记为 deleted。
- 默认项目列表不再显示。
- 预览地址不可访问。
- 正式地址不可访问或不再指向旧内容。
- 删除不影响其他项目。

---

## 28. Codex 开发注意事项

### 28.1 不要自由扩展范围

不要实现以下内容：

- 在线代码编辑器
- 文件管理器
- 终端
- 多用户系统
- Git 集成
- 后端项目部署
- Docker 编排
- 模板市场

### 28.2 不要改变核心技术选型

不要把 ShipNow 改成 Next.js。

不要把生成项目改成 Next.js。

不要把包管理器改成 npm 或 yarn。

不要替换默认模板机制。

### 28.3 不要写死现有 VPS 路径

所有路径通过配置项读取。

如果必须适配现有 Caddy 或目录结构，先检查当前结构，再写入配置。

不要盲目覆盖已有 Caddyfile。

### 28.4 优先保证闭环

第一版最重要的闭环：

```text
创建项目
→ Codex 生成
→ 构建
→ 预览
→ 修改
→ 再构建
→ 发布
→ 正式访问
```

如果某些 UI 增强和闭环冲突，优先保证闭环。

### 28.5 代码质量要求

- TypeScript 不允许大量 any。
- 后端 API 错误要有明确 message。
- 任务执行必须记录日志。
- 路径处理必须集中封装。
- projectName 校验必须前后端都有，后端为准。
- 构建和发布逻辑必须集中在独立模块。
- Codex Runner 必须和业务 API 解耦。
- 默认模板必须可以独立 `pnpm install`、`pnpm build`。

---

## 29. 推荐模块划分

### 29.1 ShipNow Backend

```text
server/
  index.ts
  config.ts
  db/
    index.ts
    schema.ts
    projectsRepo.ts
    tasksRepo.ts
    releasesRepo.ts
  routes/
    projects.ts
    tasks.ts
  services/
    ProjectService.ts
    TaskRunner.ts
    CodexRunner.ts
    TemplateManager.ts
    BuildManager.ts
    PreviewPublisher.ts
    ProductionPublisher.ts
    PathManager.ts
    LogManager.ts
  security/
    validateProjectName.ts
    sanitizeLog.ts
```

### 29.2 ShipNow Frontend

```text
src/
  App.tsx
  api/
    client.ts
    projects.ts
    tasks.ts
  components/
    ProjectList.tsx
    ProjectForm.tsx
    ProjectDetail.tsx
    TaskLogPanel.tsx
    StatusBadge.tsx
    ConfirmDeleteDialog.tsx
  pages/
    Dashboard.tsx
  styles/
    globals.css
```

### 29.3 Templates

```text
templates/
  default-static-site/
    ...
```

---

## 30. 最终产品定义

ShipNow 是部署在：

```text
https://boringmax.com/shipnow
```

的自用 AI 小独立站发布工作台。
它在路由上归属 `boringmax` 的 path-based 子项目体系，在产品功能上则是独立运行的管理后台。
它的 API 则通过 `https://shipnow.boringmax.com/api` 提供，页面与 API 分离但仍共享同一套 ShipNow 后端实现。

它通过统一默认模板 `default-static-site` 创建纯前端静态项目。默认模板内置 Vite、React、TypeScript、Tailwind CSS、Phaser、基础 UI 组件、设计系统、布局组件、分享组件、本地状态工具、SEO 支持、移动端适配、错误边界和常用小游戏能力。

ShipNow 生成项目的预览地址为：

```text
https://shipnow.boringmax.com/preview/{projectName}
```

正式地址为：

```text
https://boringmax.com/{projectName}
```

第一版必须完整实现：

```text
创建项目
AI 生成
构建
预览
修改
再构建
发布
项目管理
日志查看
访问保护
失败保护
```

第一版不做云端 IDE，不做后端项目，不做多技术栈，不做公开 SaaS。

核心目标是：

```text
让一个小 idea 能够在一个网页里快速变成 boringmax.com 下的真实可访问小独立站。
```
