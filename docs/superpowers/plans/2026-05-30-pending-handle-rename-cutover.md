# ShipNow 待生效改名与发布切换实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把项目重命名改成“先挂起、后生效”的产品流程：用户改 handle 时只生成一条待生效记录，页面立即显示新名字和“发布后生效”状态；正式站点与预览仍继续使用旧 handle，直到下一次发布成功时才把新 handle 切成唯一正式身份。

**Architecture:** 现有 ShipNow 仍然负责项目、预览和发布，但 rename 不再直接改 `publicHandle`，而是新增一组 pending 字段记录待生效的公开名。UI 立即展示 pending 状态，发布流程在成功时统一完成 cutover：先把 pending handle 提升为当前 canonical handle，再写出对应的预览/正式发布产物，并清理旧 handle 的发布态记录。这样 rename 与 publish 在语义上分离，但在最终切换时仍然是一次受控的发布操作。

**Tech Stack:** Fastify, SQLite, TypeScript, React, Vite, existing ShipNow project/task/release model

---

## Scope Lock

- 本计划只改 ShipNow 的改名与发布语义，不改 VPS 域名策略，不引入新的网关项目
- 允许旧 handle 在“待生效”阶段继续正常访问，直到下一次发布完成切换
- 不要求保留旧 handle 的历史兼容路由；切换后旧 handle 可以直接失效
- 不把 rename 做成 publish；rename 只是挂起身份变更，publish 才负责最终切换
- 不要求先把所有站点文件系统迁到 `publicHandle` 目录；先把产品流程和状态模型理顺，降低改名风险

## Current State That This Plan Builds On

- 现有 rename 行为已经能立即改 `displayName` / `publicHandle`，并写入 `project_aliases`
- 现有 publish 行为会把最新 preview release 复制到 public release，并把 `publicHandle` 注入 base href
- UI 已有 rename sheet、project drawer 和 publish 流程，改动主要集中在状态展示与提交语义
- 数据库已经有 `projects`、`releases`、`project_aliases` 这些表，适合在 `projects` 上加 pending 字段而不是重做整个模型

## Decisions Already Locked

- `projectId` 继续作为内部主键，不暴露给公开访问路径
- `publicHandle` 是当前正式公开名
- 待生效改名只写入 pending 状态，不直接覆盖当前 `publicHandle`
- 用户在 UI 上看到的是“新名字 + 发布后生效”，而不是“现在就改了线上地址”
- 发布成功时才完成最终切换

---

### Task 1: 给项目表和视图加上 pending handle 状态

**Files:**
- Modify: `server/types.ts`
- Modify: `server/db.ts`
- Modify: `server/shipnowManager.ts`
- Modify: `src/types.ts`
- Modify: `src/api.ts`
- Create: `server/pending-handle-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { ShipNowStore } from './db.js';

test('staging a rename keeps the live handle unchanged and records a pending handle', () => {
  const store = createTempStore();
  const project = store.createProject({
    projectId: 'proj_123456abcd',
    displayName: 'untitle-tmkj',
    publicHandle: 'untitle-tmkj',
    type: 'landing',
    title: 'Untitle',
    prompt: 'Make a landing page',
    sourceRoot: '/tmp/source',
  });

  const next = store.stageProjectHandleRename(project.project_id, 'moon-diary');
  assert.equal(next?.public_handle, 'untitle-tmkj');
  assert.equal(next?.pending_public_handle, 'moon-diary');
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --import tsx --test server/pending-handle-state.test.ts
```

Expected: fail because `pending_public_handle` and the staging helper do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Add these columns to `projects`:

```sql
pending_public_handle TEXT,
pending_public_handle_created_at TEXT,
pending_public_handle_applied_at TEXT
```

Add these fields to `ProjectRecord` and `ProjectView`:

```ts
pending_public_handle: string | null;
pending_public_handle_created_at: string | null;
pending_public_handle_applied_at: string | null;
```

Add a dedicated staging API on the store instead of mutating `public_handle` immediately:

```ts
stageProjectHandleRename(projectId: string, pendingPublicHandle: string): ProjectRecord | null
clearPendingProjectHandle(projectId: string): ProjectRecord | null
```

The staging method must:
- leave `public_handle` untouched
- set `pending_public_handle`
- set `pending_public_handle_created_at`
- clear any previous alias bookkeeping only if needed for the new workflow

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
node --import tsx --test server/pending-handle-state.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/types.ts server/db.ts server/shipnowManager.ts src/types.ts src/api.ts server/pending-handle-state.test.ts
git commit -m "feat: add pending handle state"
```

---

### Task 2: 把 rename 接口改成“待生效”，不要直接改当前公开名

**Files:**
- Modify: `server/shipnowManager.ts`
- Modify: `server/app.ts`
- Modify: `src/App.tsx`
- Modify: `src/api.ts`
- Modify: `server/types.ts`
- Create: `server/pending-handle-rename.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { strict as assert } from 'node:assert';
import test from 'node:test';

test('rename only stages a pending handle and keeps the live handle', async () => {
  const manager = createTempManager();
  const project = await manager.createProject({ prompt: 'Build a simple landing page.' });

  const renamed = await manager.renameProject({
    projectId: project.projectId,
    displayName: 'moon-diary',
  });

  assert.equal(renamed.publicHandle, 'untitle-tmkj');
  assert.equal(renamed.pendingPublicHandle, 'moon-diary');
  assert.match(renamed.statusHint, /发布后生效/);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --import tsx --test server/pending-handle-rename.test.ts
```

Expected: fail because `renameProject()` still mutates `public_handle` immediately and the UI/API do not expose pending state yet.

- [ ] **Step 3: Write the minimal implementation**

Change `renameProject()` so it:
- validates the new handle as before
- writes only `pending_public_handle`
- keeps `public_handle` unchanged
- emits an event like `project_rename_pending`
- returns a view that exposes both the live handle and the pending handle

The rename response should make it clear that the new handle is not yet active:

```ts
{
  publicHandle: 'untitle-tmkj',
  pendingPublicHandle: 'moon-diary',
  handleStatusLabel: '发布后生效'
}
```

Update the rename modal and project drawer to show:
- 当前公开地址
- 待生效公开地址
- 状态文案：`发布后生效`

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
node --import tsx --test server/pending-handle-rename.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/shipnowManager.ts server/app.ts src/App.tsx src/api.ts server/types.ts server/pending-handle-rename.test.ts
git commit -m "feat: stage project rename until publish"
```

---

### Task 3: 在发布成功时完成 handle 切换，并清理旧 handle 的发布态

**Files:**
- Modify: `server/shipnowManager.ts`
- Modify: `server/storage.ts`
- Modify: `server/db.ts`
- Modify: `server/types.ts`
- Create: `server/pending-handle-publish.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { strict as assert } from 'node:assert';
import test from 'node:test';

test('publish finalizes the pending handle and clears the staging state', async () => {
  const manager = createTempManager();
  const project = await manager.createProject({ prompt: 'Build a simple landing page.' });
  await manager.renameProject({ projectId: project.projectId, displayName: 'moon-diary' });
  await manager.publish(project.projectId);

  const refreshed = manager.getProject(project.projectId);
  assert.equal(refreshed?.publicHandle, 'moon-diary');
  assert.equal(refreshed?.pendingPublicHandle, null);
  assert.equal(refreshed?.status, 'published');
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --import tsx --test server/pending-handle-publish.test.ts
```

Expected: fail because publish still only copies the latest preview release and does not know about staged rename cutover.

- [ ] **Step 3: Write the minimal implementation**

Publish should perform these steps in order:

1. Read the current project and check whether `pending_public_handle` exists.
2. If there is a pending handle, use it as the publish target for the final public release.
3. Copy the latest preview release into the new public release path.
4. Rewrite the public release HTML base to the final live handle.
5. Commit the project update by setting `public_handle = pending_public_handle`.
6. Clear `pending_public_handle` and its timestamps.
7. Remove or archive the old public release artifacts so the old handle no longer stays in the live tree.
8. Record a `project_rename_applied` event and then the normal publish success event.

Important: the cutover must stay inside the publish transaction boundary as much as the current code allows, so a failed publish does not leave the project half-renamed.

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
node --import tsx --test server/pending-handle-publish.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/shipnowManager.ts server/storage.ts server/db.ts server/types.ts server/pending-handle-publish.test.ts
git commit -m "feat: finalize pending rename on publish"
```

---

### Task 4: 把 UI 文案和状态展示改成“发布后生效”

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/types.ts`
- Modify: `src/api.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { render } from '@testing-library/react';
import { PendingRenameBadge } from './App';

test('pending rename badge shows publish-after-effect copy', () => {
  const { getByText } = render(
    <PendingRenameBadge
      liveHandle="untitle-tmkj"
      pendingHandle="moon-diary"
    />
  );

  expect(getByText('moon-diary')).toBeTruthy();
  expect(getByText('发布后生效')).toBeTruthy();
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
pnpm test -- --runInBand
```

Expected: fail because the UI still treats rename as immediate and does not render the pending state.

- [ ] **Step 3: Write the minimal implementation**

Update the rename sheet and project detail surfaces so they show:
- 当前公开句柄
- 待生效公开句柄
- 标签：`发布后生效`

Update the project list and drawer copy so the user can immediately see:
- 已改名但未发布
- 线上仍然是旧 handle

Keep the action semantics clear:
- `重命名` 只是保存待生效变更
- `发布` 才真正生效

Add a subdued but visible status chip instead of reusing the existing published/publishing chip styles so the user can distinguish “已发布” from “待生效”.

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
pnpm test -- --runInBand
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/styles.css src/types.ts src/api.ts
git commit -m "feat: show pending rename state in ui"
```

---

### Task 5: 补一套端到端验收，确认改名不影响当前线上站点，发布后才切换

**Files:**
- Modify: `docs/handoff/CHANGELOG.md`
- Modify: `PROJECT_CONTEXT.md`
- Modify: `docs/SHIPNOW_VPS_DEPLOYMENT.md`
- Create: `server/pending-handle-e2e.test.ts`

- [ ] **Step 1: Run the smoke flow**

验证顺序：

```bash
pnpm build
curl -I http://127.0.0.1:8090/health
```

然后在本地或浏览器里走一次：
- 创建项目
- 发布一次
- 改 handle，但不发布
- 确认线上仍然是旧 handle
- 再发布
- 确认新 handle 生效，旧 handle 不再是正式入口

- [ ] **Step 2: Write the end-to-end test**

```ts
test('rename is pending until publish and switches on successful publish', async () => {
  const manager = createTempManager();
  const project = await manager.createProject({ prompt: 'Build a simple landing page.' });
  const liveHandle = project.publicHandle;

  await manager.renameProject({ projectId: project.projectId, displayName: 'moon-diary' });
  assert.equal(manager.getProject(project.projectId)?.publicHandle, liveHandle);

  await manager.publish(project.projectId);
  assert.equal(manager.getProject(project.projectId)?.publicHandle, 'moon-diary');
});
```

- [ ] **Step 3: Commit**

```bash
git add server/pending-handle-e2e.test.ts docs/handoff/CHANGELOG.md PROJECT_CONTEXT.md docs/SHIPNOW_VPS_DEPLOYMENT.md
git commit -m "docs: record pending rename publish cutover"
```

---

## Self-Review

### Spec coverage

- `rename` 不再等于 `publish`：Task 2、Task 3
- 改名先挂起、页面显示“发布后生效”：Task 2、Task 4
- 改名前线上仍使用旧 handle：Task 2
- 发布成功时才切换到新 handle：Task 3
- 旧 handle 在切换后失效：Task 3、Task 5

### Placeholder scan

- 没有把关键产品行为写成 `TODO` 或 `later`
- 每个阶段都明确写了要改的文件、要加的测试和要跑的命令
- 没有把 rename 伪装成 publish，语义边界是清楚的

### Type consistency

- `pending_public_handle`、`pending_public_handle_created_at`、`pending_public_handle_applied_at` 在 DB、后端、前端三层保持一致
- `renameProject()` 的返回值必须同时能表达 live handle 和 pending handle
- `publish()` 在当前任务模型里仍然是单一入口，但它会承担最终 cutover 的职责
