

# **给 Codex 的UI重构执行方案 **

```text
你现在要重构 ShipNow 的 UI。

重要说明：
本任务不是普通功能开发，而是视觉还原与交互重构任务。
当前 ShipNow 页面太像后台 dashboard，需要重构为 chat-first 的用户端 vibe coding + 自动部署工作台。

请优先阅读以下设计资料：

1. docs/shipnow-ui-redesign/shipnow_ui_interaction_redesign_v1.1.md
2. docs/shipnow-ui-redesign/images/ 下的全部 UI 设计图

如果这些文件不存在，请先在项目根目录中搜索：
- shipnow_ui_interaction_redesign
- shipnow_ui_redesign
- images
- UI
- design

你的目标不是“结构大概对上”，而是尽可能还原设计稿的视觉语言：
- 浅色 ivory 背景
- mint / sage 低饱和点缀
- 黑色主按钮
- 大圆角卡片
- 轻柔阴影
- 充分留白
- chat-first 主界面
- 移动端优先
- 不要 dashboard 感
- 不要表格
- 不要密集系统信息

请严格按照以下阶段执行。
```

------

## **阶段 0：先理解现有项目**

```text
先完成代码阅读，不要急着改 UI。

请检查：
1. 项目技术栈
2. 当前页面入口
3. 当前样式方案
4. 当前组件结构
5. 当前 ShipNow 页面对应的文件
6. 当前数据/API 调用方式
7. 是否已有 preview / publish / project / task 相关接口

输出一个简短分析：
- 当前 UI 文件在哪里
- 当前样式文件在哪里
- 哪些组件可以复用
- 哪些组件应该重写
- 本次会修改哪些文件
```

------

## **阶段 1：建立 Design Tokens**

```text
先建立统一设计令牌，不要直接写页面。

新增或改造一个全局样式文件，例如：

src/styles/shipnow-tokens.css
或 app/shipnow/shipnow-tokens.css
或根据项目实际结构决定。

必须包含以下 tokens：

颜色：
--sn-color-mint: #B7F1DF;
--sn-color-sage: #E8F5EF;
--sn-color-ivory: #FAF7F3;
--sn-color-cream: #F7F6F2;
--sn-color-stone: #E7E5E1;
--sn-color-ink: #0F1115;
--sn-color-muted: #6B6F76;
--sn-color-border: rgba(15, 17, 21, 0.08);
--sn-color-danger-bg: #FDECEC;
--sn-color-danger-text: #B42318;
--sn-color-warning-bg: #FFF5D6;
--sn-color-warning-text: #8A5A00;

圆角：
--sn-radius-sm: 8px;
--sn-radius-md: 12px;
--sn-radius-lg: 16px;
--sn-radius-xl: 24px;
--sn-radius-2xl: 32px;

阴影：
--sn-shadow-soft: 0 8px 24px rgba(15, 17, 21, 0.04);
--sn-shadow-card: 0 12px 32px rgba(15, 17, 21, 0.06);
--sn-shadow-floating: 0 24px 80px rgba(15, 17, 21, 0.10);

字体：
优先使用 Inter / system-ui。
如果项目已有字体系统，保持兼容，但视觉上要接近设计稿。

强制要求：
1. 后续所有 ShipNow UI 样式必须复用这些 tokens。
2. 不允许在组件里随机写新的颜色、圆角、阴影。
3. 不允许使用浓重阴影、强渐变、后台 dashboard 风格配色。
```

------

## **阶段 2：先做组件系统页面**

```text
不要一上来就改真实业务页面。

请先实现一个 ShipNow UI 组件系统页面：

路径可以是：
/shipnow/design-system
或 /design-system/shipnow
按项目路由结构决定。

这个页面用于视觉验收，必须展示以下组件：

1. Button
- Primary
- Secondary
- Ghost
- Destructive
- Icon button

2. StatusChip
- Preview ready
- Published
- Building
- Needs fix

3. QuickActionChip
- 优化文案
- 调整配色
- 增加页面
- 上传图片
- 修复问题

4. ChatBubble
- 用户气泡
- ShipNow 助手气泡
- 执行中状态

5. AssistantActionCard
展示：
- 预览缩略图
- 版本名，例如 v2 · Home Updated
- 变更摘要
- Open preview
- Publish
- Continue editing

6. ProjectCard
展示：
- 项目缩略图
- 项目名
- 描述
- 状态
- 更新时间
- 更多操作按钮

7. BottomComposer
展示：
- 附件按钮
- 输入框
- 发送按钮
- Preview
- Publish

8. TopBar
展示三种状态：
- 主工作台顶部栏
- 项目顶部栏
- 预览页顶部栏

9. Drawer
展示：
- 左侧项目抽屉
- 右侧状态抽屉

10. ConfirmationSheet
展示：
- 发布确认弹层
- 删除确认弹层

11. EmptyState
展示：
- 没有项目
- 没有发布记录

12. Icon Set
使用统一线性图标风格。

组件页面的目标：
先让组件质感接近设计图，再拼真实页面。
```

------

## **阶段 3：实现视觉参考静态页**

```text
在接真实业务逻辑前，请先做一个静态视觉参考页：

路径：
/shipnow/visual-reference

目标：
尽可能还原设计图里的移动端主工作台。

页面内容可以使用 mock 数据，不接 API。

必须包含：

1. 顶部栏
- 汉堡菜单
- ShipNow
- Preview ready 状态标签
- 新建项目按钮

2. 当前项目头部
- bannercheck
- Marketing banner site
- 更多按钮

3. 对话消息流
- 用户消息：帮我创建一个产品宣传页，突出速度快、部署简单，风格要简洁高级。
- ShipNow 回复：好的！我为你生成了一个简洁高级的产品宣传页。
- AssistantActionCard：v1 · Home
- 用户消息：把配色换成薄荷绿主色，文案再简洁有力一点。
- ShipNow 回复：已应用薄荷绿主色，并优化文案表达。
- AssistantActionCard：v2 · Home Updated

4. 快捷操作 chips
- 优化文案
- 调整配色
- 增加页面
- 上传图片
- 修复问题

5. 底部固定输入区
- 附件按钮
- 输入框
- 发送按钮
- Preview
- Publish

视觉要求：
- mobile-first
- 390px 宽度下必须好看
- 不允许出现表格
- 不允许出现 dashboard 统计卡片
- 不允许出现 workspace / API / source path
- 页面第一视觉中心必须是对话流
- bottom composer 必须固定在底部
- 卡片必须有充足留白、圆角、轻阴影
```

------

## **阶段 4：实现真实移动端工作台**

```text
完成视觉参考页后，再改真实 /shipnow 页面。

目标：
把当前 dashboard-first 页面重构为 chat-first 工作台。

手机端结构必须是：

顶部：
☰ ShipNow / 当前项目名 / 当前状态 / +

中间：
当前项目对话流
结果卡片
快捷操作 chips

底部：
固定 composer
Preview / Publish / Send

左抽屉：
新建项目
模板中心
项目管理
最近发布
设置与偏好

右抽屉：
项目状态
预览地址
线上地址
最近任务
发布历史
技术日志入口
高级设置

不要在主界面展示：
- Projects / Active / Published / Failed 统计卡片
- 项目表格
- Workspace 路径
- API URL
- Source 路径
- Latest Task
- Task Status
- Raw logs
- Build command
```

------

## **阶段 5：实现首页 / 新建项目 / 模板 / 项目列表**

```text
实现 ShipNow 首页和项目入口。

未选择项目时，不展示 dashboard。
展示 conversational new project entry。

首页内容：

ShipNow
用一句话创建、修改、预览并发布一个小网站。

推荐入口：
- 创建产品官网
- 做一个小游戏
- 创建个人主页
- 创建一个小工具

主输入框：
“告诉 ShipNow 你想做什么？”

底部或下方：
最近项目卡片列表。

模板中心：
使用卡片布局，不使用表格。

模板包含：
- 产品官网
- Landing Page
- 个人主页
- 小工具
- 小游戏
- 空白项目

项目管理：
使用卡片列表。
展示：
- 项目名
- 简短描述
- 状态标签
- 更新时间
- 更多操作
```

------

## **阶段 6：实现预览与发布流程**

```text
实现用户视角的预览和发布体验。

预览页：
- 全屏预览
- 顶部：返回编辑 / 项目名 / 发布
- 底部：继续修改 / 发布

发布确认：
使用底部弹层或 modal。
展示：
- 即将发布到哪个地址
- 当前版本
- 确认发布按钮
- 取消按钮

发布成功：
展示：
- 发布成功
- 线上地址
- 打开网站
- 复制链接
- 继续编辑

发布失败：
展示：
- 发布失败
- 人类可读原因
- ShipNow 自动修复
- 查看日志
- 稍后再试

失败时不允许直接把 raw log 甩给用户。
日志只能作为高级入口。
```

------

## **阶段 7：桌面端响应式适配**

```text
桌面端可以是三栏布局，但仍然必须 chat-first。

桌面结构：

左侧：
项目 / 模板 / 新建项目

中间：
当前项目对话工作台

右侧：
当前状态 / 预览 / 发布 / 发布历史

要求：
1. 中央对话区是视觉中心。
2. 左右栏不能抢主流程。
3. 右侧状态栏可折叠。
4. 不要恢复 dashboard 统计面板。
5. 不要使用项目表格作为主展示。
```

------

## **阶段 8：截图验收与视觉修复**

```text
完成后必须进行截图验收。

请使用 Playwright 或项目已有 E2E/截图工具。

至少截图以下页面：

1. /shipnow/design-system
2. /shipnow/visual-reference
3. /shipnow 移动端首页，宽度 390px
4. /shipnow/project/:projectName 移动端工作台，宽度 390px
5. /shipnow/project/:projectName 桌面端，宽度 1440px
6. 预览页
7. 发布确认弹层
8. 发布成功 / 发布失败状态

截图保存到：

screenshots/shipnow-ui-redesign/

然后输出视觉差异清单，至少检查：

- 是否还有 dashboard 感
- 是否以对话为视觉中心
- 手机端是否没有表格
- 底部 composer 是否固定
- 预览 / 发布按钮是否明显
- 卡片圆角是否接近设计图
- 留白是否足够
- 阴影是否轻柔
- 颜色是否使用 tokens
- 状态标签是否克制
- 字体层级是否清晰
- 左右抽屉是否符合设计说明
```

------

## **阶段 9：禁止事项**

```text
以下事情不要做：

1. 不要只把现有 dashboard 稍微美化。
2. 不要继续保留顶部 Projects / Active / Published / Failed 统计卡片。
3. 不要在手机端展示项目表格。
4. 不要在主界面展示 workspace、API、source path。
5. 不要让用户面对 raw logs。
6. 不要把预览和发布藏到二级入口。
7. 不要随机写 CSS。
8. 不要每个组件单独定义颜色、圆角、阴影。
9. 不要过度使用渐变、玻璃拟态、科技风。
10. 不要为了功能完整牺牲视觉还原。
```

------

## **阶段 10：验收标准**

```text
最终验收标准：

1. 手机端打开 ShipNow，第一眼必须像一个 AI 创作工作台，而不是管理后台。
2. 用户可以清楚地看到：
   - 当前项目
   - 对话内容
   - 输入框
   - 预览按钮
   - 发布按钮
3. 项目管理必须是卡片或抽屉，不是表格。
4. 系统状态、日志、路径必须收纳在右侧状态抽屉或高级入口。
5. 所有核心组件必须复用统一 design tokens。
6. 页面视觉必须接近设计图中的 ivory / mint / ink 风格。
7. 完成后必须提供截图路径和视觉差异说明。
```

------

## **输出要求**

```text
完成后请输出：

1. 实际修改的文件列表
2. 新增的组件列表
3. 新增的路由列表
4. 如何启动和查看页面
5. 截图保存路径
6. 已知和设计稿仍有差异的地方
7. 下一轮建议优化点
```
