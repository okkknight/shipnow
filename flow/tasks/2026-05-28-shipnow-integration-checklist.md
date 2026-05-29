# ShipNow 联调功能清单

- Title: ShipNow 主流程前后端联调
- Objective: 把主产品页面与后端 API、任务执行、预览发布链路完整打通，并清掉主流程中残留的开发期 mock / 占位逻辑。
- Scope:
  - 只覆盖主产品主流程：`home`、`templates`、`projects`、`project/:projectId`、`project/:projectId/preview`、`project/:projectId/publish-success`、`project/:projectId/publish-failure`
  - 只覆盖主流程里的抽屉、确认弹层、状态区、日志区、发布链路和错误态
  - `design-system`、`visual-reference`、模板 starter 的示意文案保留为参考，不纳入主流程联调验收
- Verification:
  - `pnpm build`
  - 本地浏览器按页面逐项验证
  - API 返回、页面状态、任务状态、日志状态一致

## 联调前提

- [x] 主流程里的测试项目和 smoke 数据已清理
- [x] 首页已回到空态
- [x] 本地开发服务可启动，`/api/projects` 可返回真实列表
- [ ] 确认是否需要在本轮一起补齐访问保护

## 1. 数据边界与 mock 清理

- [ ] 主流程页面只从后端接口取数据，不再使用本地假列表
- [ ] 首页最近项目、项目列表、项目详情、任务流都只读 API 返回值
- [ ] 清理主流程里任何仍在使用的占位文案、假状态、假结果卡
- [ ] 保留 `design-system` / `visual-reference` 的示意数据，不把参考页误删成真实页面
- [ ] 确认模板 starter 内容属于模板工程，不属于主流程 mock

## 2. 首页联调

- [ ] `GET /api/projects` 正确驱动首页最近项目区
- [ ] 首屏输入框可以直接创建项目
- [ ] 模板 chips 只负责预填 prompt，不产生假项目
- [ ] 新建项目后能自动刷新列表并跳转到新项目页
- [ ] 空态、加载态、错误态文案都能正确显示

## 3. 模板中心联调

- [ ] 模板卡片只负责预填 prompt 或进入创建上下文
- [ ] 选择模板后，首页 composer 中能拿到对应 prompt
- [ ] “导入现有项目”保持为次要动作，不误导成真实导入流程
- [ ] 模板页与项目页的路由跳转正常

## 4. 项目列表与项目详情联调

- [ ] `GET /api/projects/:projectId` 正确填充项目详情
- [ ] 项目卡片状态映射正确：`draft / generating / preview_ready / published / build_failed / publish_failed / deleted`
- [ ] `messages`、`events`、`tasks`、`releases` 的时间线和状态区一致
- [ ] 项目名编辑、保存、错误提示可走通
- [ ] 侧边抽屉里的最近项目和当前项目状态同步更新

## 5. 创建 / 修改 / 重新构建联调

- [ ] `POST /api/projects` 可创建新项目
- [ ] `POST /api/projects/:projectId/changes` 可把修改请求写入任务队列
- [ ] `POST /api/projects/:projectId/rebuild` 可仅重建、不改内容
- [ ] 创建、修改、重建三条链路都能正确流转状态：`pending -> running -> success / failed`
- [ ] 任务日志可轮询或读取，不出现空白页
- [ ] 失败时能回写错误信息到项目详情和任务记录

## 6. 预览联调

- [ ] `project/:projectId/preview` 能打开当前预览版本
- [ ] 预览页里的 `previewUrl` 与后端生成的地址一致
- [ ] `current-preview`、`preview/`、`releases/preview/` 的链路正确
- [ ] 预览页的返回编辑、继续修改按钮可用
- [ ] 预览失败时有明确兜底文案

## 7. 发布联调

- [ ] `POST /api/projects/:projectId/publish` 只发布最近一次成功的预览
- [ ] 发布前确认弹层能正确拦截和确认
- [ ] 发布成功页能打开正式站点、复制链接、继续编辑
- [ ] 发布失败页能引导自动修复、查看日志、继续编辑
- [ ] `current-public`、`index.html`、`releases/public/` 的切换链路正确

## 8. 删除与重命名联调

- [ ] `POST /api/projects/:projectId/rename` 能同步更新展示名和公开句柄
- [ ] 旧 `publicHandle` 能继续重定向到新句柄
- [ ] `DELETE /api/projects/:projectId` 能安全删除项目
- [ ] 删除后保留任务日志，删除任务不再因为日志目录缺失而崩溃
- [ ] 删除后项目列表、详情页、预览页都能正确回到空态或 404

## 9. 状态与错误联调

- [ ] `generating`、`preview_ready`、`published`、`build_failed`、`publish_failed` 的用户文案统一
- [ ] 加载态、空态、失败态不再出现开发期占位话术
- [ ] API 4xx / 5xx 能正确回到前端可读错误
- [ ] 自动修复入口可根据失败摘要生成任务
- [ ] 任务失败后不会把当前正式站点误覆盖

## 10. 浏览器验收顺序

- [ ] `home`
- [ ] `templates`
- [ ] `projects`
- [ ] `project/:projectId`
- [ ] `project/:projectId/preview`
- [ ] `project/:projectId/publish-success`
- [ ] `project/:projectId/publish-failure`
- [ ] `design-system`
- [ ] `visual-reference`

## 11. 完成标准

- [ ] 主流程页面不再依赖开发期 mock 数据
- [ ] 创建、修改、构建、预览、发布、删除、重命名全链路可跑通
- [ ] 任务日志和状态更新在页面上能闭环
- [ ] `pnpm build` 通过
- [ ] 浏览器验收没有阻断级问题

