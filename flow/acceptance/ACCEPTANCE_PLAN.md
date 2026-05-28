# ShipNow UI Acceptance Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按“先手机端、后桌面端”的顺序，逐页验收 ShipNow 的 UI 重构结果，并持续记录问题、修复状态和进度。

**Architecture:** 这是一份活文档，负责把验收顺序、验收标准、问题登记和进度追踪统一到一个地方。手机端作为第一优先级，先验证入口页、核心工作台和结果页，再切到桌面端做同样顺序的对照验收；每个页面的发现都写回同一份问题清单，避免分散在聊天里。

**Tech Stack:** Markdown、Browser 验收、截图对照、页面路由验收、问题跟踪。

---

## 1. 验收范围

- 主产品页面
  - `home`
  - `templates`
  - `projects`
  - `project/:projectId`
  - `project/:projectId/preview`
  - `project/:projectId/publish-success`
  - `project/:projectId/publish-failure`
- 设计参考页面
  - `design-system`
  - `visual-reference`
- 通用浮层
  - 侧边抽屉
  - 状态抽屉
  - 发布确认弹层
  - 删除确认弹层

## 2. 验收顺序

### Mobile First

1. `home`
2. `templates`
3. `projects`
4. `project/:projectId`
5. `project/:projectId/preview`
6. `project/:projectId/publish-success`
7. `project/:projectId/publish-failure`
8. `design-system`
9. `visual-reference`

### Desktop Second

1. `home`
2. `templates`
3. `projects`
4. `project/:projectId`
5. `project/:projectId/preview`
6. `project/:projectId/publish-success`
7. `project/:projectId/publish-failure`
8. `design-system`
9. `visual-reference`

## 3. 每页统一验收标准

- 布局
  - 没有横向滚动
  - 主内容、侧栏和浮层不会互相挤压
  - 关键按钮始终在可见区域内
- 文案
  - 标题、说明、按钮语义清楚
  - 中英文混排保持一致，不出现突兀表达
- 交互
  - 返回、打开、关闭、发布、复制、删除等动作都能走通
  - 禁用态、加载态、确认态都能正确表现
- 状态
  - 空状态清楚
  - 进行中状态清楚
  - 成功和失败状态清楚
- 视觉
  - 字号、间距、圆角、阴影、颜色和层级统一
  - 不把旧后台感带回真实页面
- 一致性
  - 同类页面按钮风格一致
  - 同类卡片风格一致
  - 同类浮层风格一致

## 4. Mobile 验收清单

### 4.1 `home`

- 检查入口文案是否清楚
- 检查快捷模板是否一眼可点
- 检查底部 composer 是否始终好用
- 检查最近项目卡片是否可读
- 检查侧边抽屉开合是否顺滑
- 检查 390px 下是否有横向溢出

### 4.2 `templates`

- 检查模板卡片网格是否适合单手浏览
- 检查选中态是否明显
- 检查“导入现有项目”是否像次要动作
- 检查返回首页是否清晰
- 检查长文案是否会挤爆卡片

### 4.3 `projects`

- 检查项目列表是否适合扫视
- 检查空状态是否足够明确
- 检查新建入口是否容易找到
- 检查卡片点击是否有反馈
- 检查状态芯片是否足够区分成功、进行中和失败

### 4.4 `project/:projectId`

- 检查聊天流是否是主视觉中心
- 检查助手动作卡是否和消息流协调
- 检查快捷 chips 是否不会挤压 composer
- 检查 Preview / Publish 是否常驻且清楚
- 检查状态抽屉和项目抽屉是否不遮挡关键内容
- 检查长对话下是否还能顺滑滚动

### 4.5 `project/:projectId/preview`

- 检查预览页是否像“发布前检查页”
- 检查返回编辑和发布按钮是否足够明确
- 检查地址展示是否清楚
- 检查预览主体是否能稳定承载内容

### 4.6 `project/:projectId/publish-success`

- 检查成功反馈是否直接
- 检查打开网站、复制链接、继续编辑是否都好点
- 检查成功页是否能把用户自然引到下一步

### 4.7 `project/:projectId/publish-failure`

- 检查失败反馈是否够清楚
- 检查自动修复、查看日志、继续编辑是否都好找
- 检查失败态是否把人带回可行动路径，而不是只报错

### 4.8 `design-system`

- 检查设计系统页是否只承担展示和校准职责
- 检查参考组件是否没有真实业务页的错位感
- 检查参考页是否保持解释性样式但不产生横向滚动

### 4.9 `visual-reference`

- 检查视觉参考页是否清晰展示参考语义
- 检查参考壳和真实业务页是否已经分离
- 检查在小屏下是否仍然完整可读

## 5. Desktop 验收清单

### 5.1 `home`

- 检查双栏结构是否成立
- 检查输入区和最近项目区的主次是否合理
- 检查页面留白是否足够，但不空
- 检查桌面端是否比手机端更稳、更松

### 5.2 `templates`

- 检查模板网格是否适合桌面浏览
- 检查说明区是否能辅助理解模板差异
- 检查导入区是否像次要区域

### 5.3 `projects`

- 检查卡片密度是否适合桌面扫视
- 检查卡片列表是否容易横向铺开
- 检查空状态是否在大屏下仍然成立

### 5.4 `project/:projectId`

- 检查对话列和状态列是否分工清楚
- 检查快捷动作是否不会干扰主对话
- 检查底部 composer 是否像生产工具而不是演示组件
- 检查更多、预览、发布这些动作是否足够高频可达

### 5.5 `project/:projectId/preview`

- 检查预览画布是否足够像“发布前审阅”
- 检查右侧状态信息是否清楚、不过载
- 检查继续编辑和发布之间的层级关系是否合理

### 5.6 `project/:projectId/publish-success`

- 检查成功态是否有明确成就感
- 检查打开网站、复制链接、继续编辑是否顺手

### 5.7 `project/:projectId/publish-failure`

- 检查失败态是否保持清晰但不过度恐吓
- 检查自动修复和日志入口是否足够可见

### 5.8 `design-system`

- 检查设计系统页在大屏下的排版、密度和参考感
- 检查是否仍然保持“参考页”和“业务页”的边界

### 5.9 `visual-reference`

- 检查视觉参考页在桌面端是否更完整地展示布局语言
- 检查参考内容是否会误导为真实业务页

## 6. 问题登记格式

每次发现问题，都按下面格式补一条：

| ID | 页面 | 端 | 严重度 | 问题 | 复现方式 | 现象 | 预期 | 状态 | 责任人 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A-001 | home | mobile | P1 | 底部 composer 被遮挡 | 390px 打开首页并滚动到底部 | 输入框和按钮挤压 | 输入区始终完整可用 | open | Codex |  |

严重度建议：

- `P0`：阻断验收
- `P1`：明显影响使用或视觉主线
- `P2`：局部细节问题
- `P3`：可接受的轻微瑕疵

状态建议：

- `open`
- `in_progress`
- `fixed`
- `verified`
- `won't_fix`

## 7. 进度记录格式

每次验收一页，都补一条进度记录：

| 日期 | 阶段 | 页面 | 端 | 结果 | 发现问题数 | 已修复数 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-27 | mobile | home | mobile | in_progress | 0 | 0 | 先看入口页 |
| 2026-05-28 | mobile | project/:projectId/preview | mobile | verified | 0 | 0 | 预览页改为嵌入真实 previewUrl，项目内容不再共用 mock 壳 |
| 2026-05-28 | desktop | project/:projectId/preview | desktop | verified | 0 | 0 | 桌面预览页同步嵌入真实 previewUrl，两个项目预览内容已按各自站点变化 |
| 2026-05-28 | mobile | project/:projectId/preview | mobile | verified | 0 | 0 | 手机预览页去掉大圆卡，底部按钮贴近页面底部，预览中胶囊复用项目统一状态胶囊 |
| 2026-05-28 | mobile | project/:projectId/publish-success | mobile | verified | 0 | 0 | 成功页地址卡、复制提示与按钮宽度已统一 |
| 2026-05-28 | mobile | project/:projectId/publish-failure | mobile | verified | 0 | 0 | 失败页排版和成功页对齐，常见原因卡片已统一样式 |

建议记录规则：

- 一页一条记录，不要把多个页面混在同一条里
- 每次修复后补一次复验记录
- 同一个问题如果跨页影响，问题表里只保留一条主记录，其余页面用备注关联

## 8. 验收推进节奏

1. 先验手机端 `home`
2. 再按手机端页面顺序逐页推进
3. 每页验收完，立即登记问题和进度
4. 每修一个问题，立刻回到对应页面复验
5. 手机端全部收口后，再切桌面端同顺序验收
6. 如果一个问题会影响多个页面，先修共享组件或共用布局，再继续后续页面

## 9. 当前里程碑

- 当前阶段：UI 重构基本落地，预览页已切到真实 previewUrl，手机端验收基本收口，进入提交与最终复核
- 当前优先级：手机端先行
- 当前目标：把验收结果、问题和修复状态都收进这份文档里，并保持与已交付实现一致，预览内容按项目独立展示

## 10. 待补充项

- 具体的首轮验收结论
- 每个页面的截图链接或浏览器回放链接
- 真实发现的问题编号
- 已完成修复的复验记录
