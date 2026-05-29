# ShipNow 对话路由与实时进度流实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 ShipNow 工作台同时支持 `chat` 和 `task` 两种对话意图：`chat` 直接生成自然语言回复并回显到对话框，`task` 进入结构化执行链路并通过 SSE 把任务进度实时推入对话流。

**Architecture:** 在项目工作台的提交入口前增加一个严格的意图路由层，先让当前选定的 agent 客户端返回 `{"intent":"chat"|"task"}` 这样的结构化结果；`chat` 走轻量回复 prompt 并写入消息表，`task` 走完整任务 prompt 并创建任务、事件和日志。后端通过 SSE 把 `task_progress` 等结构化事件推送给前端，前端把消息和事件合并成统一时间线，任务日志继续保留在侧边栏作为细节视图。

**Tech Stack:** Fastify, SQLite, SSE/EventSource, Vite, React, TypeScript, existing Codex / Claude Code CLI runners

---

## Scope Lock

- 本计划只覆盖项目工作台里的对话输入和自动修复入口，不改 `POST /api/projects` 的“创建项目即任务”语义
- `createProject` 继续 task-first，因为新项目还没有可回放的工作台上下文
- `applyChange`、`auto-fix`、未来的项目内对话输入走同一套 `chat/task` 路由
- `chat` 和 `task` 都可以由 Codex 或 Claude Code 作为 agent 客户端执行，模型后端可随配置切换
- 歧义输入默认按 `chat` 处理，必要时再追问，不把不确定请求误送进执行链

## Current State That This Plan Builds On

- 后端已经能创建任务、写日志、写事件，也已经有 Codex / Claude Code 两条执行器路径
- `server/process.ts` 已支持 stdout / stderr 回调，足够把长任务期间的状态片段推入日志
- `src/App.tsx` 已经把 `messages + events` 合成时间线，但工作区当前还在过滤，只渲染消息
- `src/api.ts` 已有任务日志读取接口，适合继续保留为侧边栏细节视图

## Decisions Already Locked

- 默认依然优先使用 Codex 作为任务执行器
- chat 不需要单独的模型选择 UI，继续复用当前的 runner / backend 配置即可
- 不再使用死板模板回复，chat 的输出必须是真正的自然语言
- task 需要可视化进度，不只靠“已开始 / 已完成”两个点

---

### Task 1: 定义对话意图和 action 返回类型

**Files:**
- Create: `server/conversationPrompts.ts`
- Create: `server/conversation-router.test.ts`
- Modify: `server/types.ts`
- Modify: `src/types.ts`
- Modify: `server/shipnowManager.ts`
- Modify: `src/api.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'node:test';
import { parseConversationIntent } from './conversationPrompts.js';

describe('parseConversationIntent', () => {
  it('accepts strict JSON chat/task decisions', () => {
    expect(parseConversationIntent('{"intent":"chat"}')).toBe('chat');
    expect(parseConversationIntent('{"intent":"task"}')).toBe('task');
  });

  it('rejects freeform text', () => {
    expect(() => parseConversationIntent('chat')).toThrow(/intent/);
    expect(() => parseConversationIntent('{"type":"chat"}')).toThrow(/intent/);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --import tsx --test server/conversation-router.test.ts
```

Expected: fail because `parseConversationIntent` and the prompt helpers do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export type ConversationIntent = 'chat' | 'task';

export function parseConversationIntent(raw: string): ConversationIntent {
  const parsed = JSON.parse(raw) as { intent?: unknown };
  if (parsed.intent === 'chat' || parsed.intent === 'task') {
    return parsed.intent;
  }
  throw new Error('Conversation router must return {"intent":"chat"} or {"intent":"task"}');
}
```

Also add the response union that the frontend can consume:

```ts
export type ProjectActionResponse =
  | { kind: 'task'; project: ProjectView; taskId: string }
  | { kind: 'chat'; project: ProjectView; assistantMessage: ProjectMessageView };
```

把 `ProjectMessageView` 一并补到 `server/types.ts` 和 `src/types.ts`，两边字段保持完全一致：

```ts
export interface ProjectMessageView {
  id: string;
  projectId: string;
  taskId: string | null;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: string;
}
```

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
node --import tsx --test server/conversation-router.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/conversationPrompts.ts server/conversation-router.test.ts server/types.ts src/types.ts server/shipnowManager.ts src/api.ts
git commit -m "feat: add conversation intent routing types"
```

---

### Task 2: 把项目内输入拆成 router prompt、chat prompt、task prompt

**Files:**
- Create: `server/conversationPrompts.ts`
- Modify: `server/shipnowManager.ts`
- Modify: `src/App.tsx`
- Modify: `src/api.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'node:test';
import {
  buildConversationRouterPrompt,
  buildConversationChatPrompt,
  buildConversationTaskPrompt,
} from './conversationPrompts.js';

describe('conversation prompts', () => {
  it('keeps the router prompt strict and machine-readable', () => {
    const prompt = buildConversationRouterPrompt({
      displayName: 'Demo',
      projectId: 'abc123',
      publicHandle: 'demo',
    }, '帮我讨论一下这个按钮文案');

    expect(prompt).toContain('{"intent":"chat"}');
    expect(prompt).toContain('{"intent":"task"}');
    expect(prompt).toContain('只输出严格 JSON');
  });

  it('builds a chat prompt that forbids code changes', () => {
    const prompt = buildConversationChatPrompt({
      displayName: 'Demo',
      projectId: 'abc123',
      publicHandle: 'demo',
    }, '这个方案可行吗');

    expect(prompt).toContain('只做自然语言回复');
    expect(prompt).toContain('不要修改文件');
    expect(prompt).toContain('不要跑构建');
  });

  it('builds a task prompt without the intent gate', () => {
    const prompt = buildConversationTaskPrompt({
      displayName: 'Demo',
      projectId: 'abc123',
      publicHandle: 'demo',
    }, '帮我把这个页面改一下');

    expect(prompt).toContain('【用户原始需求开始】');
    expect(prompt).toContain('【用户原始需求结束】');
    expect(prompt).not.toContain('先判断用户本轮输入是否真的要求修改站点');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --import tsx --test server/conversationPrompts.test.ts
```

Expected: fail because the prompt helpers do not exist yet and the task prompt still includes the current intent gate.

- [ ] **Step 3: Write the minimal implementation**

```ts
export function buildConversationRouterPrompt(project: ConversationProjectContext, requestPrompt: string): string {
  return [
    `当前项目为 ${project.displayName}（projectId: ${project.projectId}, handle: ${project.publicHandle}）。`,
    '你是 ShipNow 的意图路由器，只需要判断当前输入是 chat 还是 task。',
    'chat = 纯聊天、讨论方案、解释原因、表达感受、给建议，不要求改代码。',
    'task = 明确要求创建、修改、修复、优化、实现当前站点。',
    '只输出严格 JSON，不要输出多余文字。',
    '输出只能是下面两种之一：',
    '{"intent":"chat"}',
    '{"intent":"task"}',
    '',
    '【用户原始需求开始】',
    requestPrompt,
    '【用户原始需求结束】',
  ].join('\n\n');
}
```

`buildConversationChatPrompt()` 和 `buildConversationTaskPrompt()` 也按职责拆开：

```ts
export function buildConversationChatPrompt(project: ConversationProjectContext, requestPrompt: string): string {
  return [
    `当前项目为 ${project.displayName}（projectId: ${project.projectId}, handle: ${project.publicHandle}）。`,
    '你是 ShipNow 的工作台助手，只做自然语言回复，不改文件，不跑构建，不宣称已经执行。',
    '如果用户在讨论方案、比较选择、询问原因、表达想法，就直接给出简洁、自然、可执行的建议。',
    '',
    '【用户原始需求开始】',
    requestPrompt,
    '【用户原始需求结束】',
  ].join('\n\n');
}
```

```ts
export function buildConversationTaskPrompt(project: ConversationProjectContext, requestPrompt: string): string {
  return [
    `当前项目为 ${project.displayName}（projectId: ${project.projectId}, handle: ${project.publicHandle}）。`,
    '这是 ShipNow 管理的静态站点项目。',
    '职责分工：ShipNow/程序负责创建工作区、复制模板、安装依赖、运行 pnpm build、生成 dist、把 dist 复制到预览/正式目录、切换 current-preview/current-public、记录日志和发布状态；agent 负责只在当前项目的 source/ 内实现用户需求。',
    '请把所有实现限制在当前项目的 source/ 目录内。',
    '可编辑范围包括 source/src、source/index.html、source/package.json、source/vite.config.ts、source/tsconfig.json，以及 source 里其他你需要的文件。',
    '不要修改 ShipNow 仓库本体，也不要手工编辑项目根目录下的 preview/、releases/、current-preview/、current-public/、logs/。',
    '如果需要新增依赖，只在 source/package.json 中调整，并让 pnpm install / pnpm build 处理锁文件和产物。',
    '如果需要页面、组件、路由、样式、资源、游戏或其它交互，请在 source 内自行组织实现；先完成一个最小可运行版本，再按需要迭代。',
    'ShipNow 会在 pnpm build 之后自动把 dist 复制到预览和正式发布目录，你不要直接往 preview/ 或 releases/ 写文件。',
    '',
    '【用户原始需求开始】',
    requestPrompt,
    '【用户原始需求结束】',
  ].join('\n\n');
}
```

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
node --import tsx --test server/conversationPrompts.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/conversationPrompts.ts server/shipnowManager.ts src/App.tsx src/api.ts
git commit -m "feat: split chat and task prompts"
```

---

### Task 3: 给 task 过程加结构化进度事件和 SSE 推送

**Files:**
- Create: `server/timelineBus.ts`
- Create: `server/timeline-stream.test.ts`
- Modify: `server/types.ts`
- Modify: `src/types.ts`
- Modify: `server/shipnowManager.ts`
- Modify: `server/app.ts`
- Modify: `src/api.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'node:test';
import { createTimelineBus } from './timelineBus.js';

describe('timeline bus', () => {
  it('broadcasts task progress events to subscribers', () => {
    const bus = createTimelineBus();
    const received: Array<{ type: string; detail: string | null }> = [];

    const unsubscribe = bus.subscribe('abc123', (event) => {
      received.push({ type: event.type, detail: event.detail });
    });

    bus.publish({
      projectId: 'abc123',
      taskId: 'task-1',
      type: 'task_progress',
      title: 'Codex 正在执行',
      detail: '正在修改首页布局。',
      data: { phase: 'agent_running' },
      createdAt: '2026-05-29T00:00:00.000Z',
    });

    unsubscribe();

    expect(received).toEqual([
      { type: 'task_progress', detail: '正在修改首页布局。' },
    ]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --import tsx --test server/timeline-stream.test.ts
```

Expected: fail because the in-memory pub/sub and the `task_progress` event type do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Add a small in-memory hub that lets the server publish events when a task moves through known phases and lets an SSE connection subscribe to one project:

```ts
export function createTimelineBus() {
  return {
    subscribe(projectId: string, listener: (event: ProjectEventView) => void) { /* ... */ },
    publish(event: ProjectEventView) { /* ... */ },
  };
}
```

把 SSE 发送的事件统一成一个可复用的 view 类型，和前端的时间线结构保持一致：

```ts
export interface ProjectEventView {
  id: string;
  projectId: string;
  taskId: string | null;
  type: string;
  title: string;
  detail: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}
```

Then wire it into task execution so the manager emits compact, human-readable `task_progress` events such as:

```ts
{
  type: 'task_progress',
  title: 'Codex 正在执行',
  detail: '正在处理当前修改，已运行 18 秒。',
  data: { phase: 'agent_running', runner: 'codex' }
}
```

Add an SSE endpoint that the frontend can open with `EventSource`:

```ts
app.get(apiRoute('projects/:projectId/timeline/stream'), async (request, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.flushHeaders?.();
});
```

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
node --import tsx --test server/timeline-stream.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/timelineBus.ts server/timeline-stream.test.ts server/types.ts src/types.ts server/shipnowManager.ts server/app.ts src/api.ts
git commit -m "feat: stream task progress events"
```

---

### Task 4: 在工作台时间线里渲染 chat 消息和 task 进度

**Files:**
- Create: `src/conversationTimeline.ts`
- Create: `src/conversationTimeline.test.ts`
- Create: `src/projectTimelineStream.ts`
- Modify: `src/App.tsx`
- Modify: `src/api.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'node:test';
import { buildConversationItems } from './conversationTimeline.js';

describe('conversation timeline', () => {
  it('keeps events instead of filtering them out', () => {
    const items = buildConversationItems({
      messages: [
        { id: 'm1', createdAt: '2026-05-29T10:00:00.000Z', role: 'assistant', content: '我先看一下方案。' },
      ],
      events: [
        { id: 'e1', createdAt: '2026-05-29T10:00:01.000Z', type: 'task_progress', title: 'Codex 正在执行', detail: '正在修改布局。' },
      ],
    });

    expect(items.map((item) => item.kind)).toEqual(['message', 'event']);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --import tsx --test src/conversationTimeline.test.ts
```

Expected: fail because the workspace still filters to message-only rendering and has no SSE subscription helper.

- [ ] **Step 3: Write the minimal implementation**

Remove the message-only filter in the workspace renderers and render event items explicitly:

```tsx
const visibleTimelineItems = timelineItems;

if (item.kind === 'event' && item.type === 'task_progress') {
  return <TaskProgressCard key={item.id} title={item.title} detail={item.detail} />;
}
```

Add an `EventSource` helper that subscribes to `/api/projects/:projectId/timeline/stream` and patches incoming events into the current detail state:

```ts
export function subscribeProjectTimeline(projectId: string, onEvent: (event: TimelineEvent) => void): EventSource {
  const source = new EventSource(`${API_BASE}/projects/${encodeURIComponent(projectId)}/timeline/stream`);
  source.onmessage = (message) => onEvent(JSON.parse(message.data) as TimelineEvent);
  return source;
}
```

Update the composer submit path so:

- `kind: 'chat'` appends an assistant message immediately and leaves the user in the same conversation
- `kind: 'task'` keeps the current task navigation flow and lets the timeline stream populate progress cards

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
node --import tsx --test src/conversationTimeline.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/projectTimelineStream.ts src/App.tsx src/api.ts src/types.ts
git commit -m "feat: render live conversation timeline"
```

---

### Task 5: 验证、浏览器验收和回放闭环

**Files:**
- Create: `server/conversation-router.test.ts`
- Create: `server/timeline-stream.test.ts`
- Modify: `docs/handoff/CHANGELOG.md` if the implementation changes the user-visible behavior

- [ ] **Step 1: Run the backend tests**

Run:

```bash
node --import tsx --test server/conversation-router.test.ts
node --import tsx --test server/timeline-stream.test.ts
```

Expected: both pass.

- [ ] **Step 2: Run the production build**

Run:

```bash
pnpm build
```

Expected: pass.

- [ ] **Step 3: Browser验收**

Open the project workspace in the in-app browser and verify all of the following:

1. 一句明显的讨论型输入会被当成 `chat`，页面只出现自然语言回复，不会创建任务
2. 一句明确的实现型输入会被当成 `task`，页面会出现任务卡和 `task_progress` 进度卡
3. 任务执行期间，时间线会持续更新，而不是只等到结束才出现结果
4. 右侧日志/状态面板继续保留原始日志，方便调试
5. 刷新页面后，已经持久化的消息和事件还能回放出来

- [ ] **Step 4: 收尾提交**

```bash
git add docs/superpowers/plans/2026-05-29-shipnow-conversation-router-and-progress-stream.md
git commit -m "docs: add conversation router implementation plan"
```

---

## Self-Review

### 1. Spec coverage

- `chat/task` 自动分流：Task 1 + Task 2
- chat 使用 Codex / Claude Code 作为 agent 客户端：Task 2
- task 保持完整执行链路，并能在工作期间看到进度：Task 3 + Task 4
- 对话流里不再只显示模板化回复：Task 2 + Task 4
- 保留日志侧栏作为细节视图：Task 3 + Task 4

### 2. Placeholder scan

- 没有使用 `TBD` / `TODO` / “类似于上一步” 这类占位说法
- 每个任务都写了具体文件、具体测试、具体命令和具体代码形状

### 3. Type consistency

- `ConversationIntent`、`ProjectActionResponse`、`task_progress`、SSE 端点名称在各任务里保持一致
- `chat` 只写消息，不创建任务；`task` 才进入任务队列，职责边界没有重叠
