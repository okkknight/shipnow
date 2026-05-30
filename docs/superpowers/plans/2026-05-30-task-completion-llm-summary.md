# ShipNow 任务完成自然语言总结实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `task_completed` 卡片在任务成功后展示一段由 LLM 生成的自然语言总结，而不是固定模板；总结内容要足够短、足够自然，并且能安全回填到后续对话上下文里。失败时自动回退到现有短文案，不影响任务完成状态。

**Architecture:** 在现有任务成功链路后新增一个“后置总结”步骤。任务本体继续沿用 Codex / Claude Code 执行修改、构建和发布；任务结束后，后端会把任务类型、任务 prompt、日志尾段和最终结果拼成一个只负责“总结”的 prompt，再调用同一个 runner 生成简短中文总结。总结结果写入 `project_events.detail`，完整元数据放入 `data_json`。前端继续渲染 `detail`，因此第一版可以做到后端主导、前端零改动。为了防止总结内容过长影响后续 prompt，`buildConversationSessionContext` 里的 recent event 摘要要做长度收敛。

**Tech Stack:** TypeScript, SQLite, existing task/event timeline model, Codex / Claude Code CLI, React already rendering `event.detail`

---

## Scope Lock

- 这次只做“任务成功后的自然语言总结”，不改 chat / task 路由，不动创建项目的既有语义
- 不新增独立的总结服务，直接复用当前 runner 配置和 CLI 执行链路
- 不引入新的数据库表或迁移，`project_events.data_json` 已经足够承载额外元数据
- 不把原始 runner stdout 直接展示给用户，UI 仍然只渲染一段整理过的总结
- 不要求第一版把 `src/App.tsx` 改成读 `data.summary`，因为 `detail` 已经能承载最终摘要

## Current State That This Plan Builds On

- `server/shipnowManager.ts` 里已经有统一的 `executeTask()` 成功分支，当前 `task_completed` 事件详情还是固定模板
- `server/shipnowManager.ts` 里已经有 `runRunnerText()`，能拿到 runner 返回的纯文本
- `server/db.ts` 已经能通过 `getTaskLogText()` 回读任务日志
- `project_events` 已经有 `detail` 和 `data_json` 两个槽位，适合“短展示文案 + 结构化元数据”的组合
- `src/App.tsx` 已经把事件详情交给 `RichTextMessage` 渲染，支持自然语言、列表和 Markdown

## Decisions Already Locked

- 第一版的任务完成总结用同一个 runner 生成，优先保持和当前执行链一致
- 总结正文目标是 1 到 2 句，尽量控制在一个短段落里，不输出项目符号、代码块或多段说明
- 总结失败时一定要回退到当前的固定短文案，不能因为总结失败而影响任务卡展示
- 后续会话里用于回放的最近事件摘要必须做长度收敛，避免 prompt 被总结文案撑大

---

### Task 1: 定义任务完成总结的 prompt 和归一化规则

**Files:**
- Create: `server/taskCompletionSummary.ts`
- Create: `server/task-completion-summary.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTaskCompletionSummaryPrompt,
  normalizeTaskCompletionSummary,
} from './taskCompletionSummary.js';

test('buildTaskCompletionSummaryPrompt asks for a short natural-language summary', () => {
  const prompt = buildTaskCompletionSummaryPrompt({
    runnerName: 'codex',
    taskId: 'task_123',
    taskType: 'apply_change',
    projectDisplayName: 'untitle-8yru',
    taskPrompt: '帮我把首页按钮做得更明显',
    taskLogTail: 'Building project with pnpm build.\nDone.',
    finalOutcome: 'success',
  });

  assert.match(prompt, /只输出一段自然语言总结/);
  assert.match(prompt, /不要输出项目符号/);
  assert.match(prompt, /task_123/);
  assert.match(prompt, /帮我把首页按钮做得更明显/);
});

test('normalizeTaskCompletionSummary collapses whitespace and preserves short content', () => {
  assert.equal(
    normalizeTaskCompletionSummary('  首页更新完成。\n\n响应式已同步。  '),
    '首页更新完成。 响应式已同步。'
  );
  assert.equal(normalizeTaskCompletionSummary('   '), '');
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --import tsx --test server/task-completion-summary.test.ts
```

Expected: fail because the summary helpers do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Add a small helper module with a typed input contract:

```ts
import type { TaskRunnerName, TaskType } from './types.js';

export interface TaskCompletionSummaryInput {
  runnerName: TaskRunnerName;
  taskId: string;
  taskType: TaskType;
  projectDisplayName: string;
  taskPrompt: string;
  taskLogTail: string;
  finalOutcome: 'success' | 'failed';
}

export function buildTaskCompletionSummaryPrompt(input: TaskCompletionSummaryInput): string {
  return [
    '【工作目标】',
    '你只负责为 ShipNow 的任务结果写一段简短的自然语言总结。',
    '要求：只输出一段中文自然语言总结，不要输出项目符号、编号、代码块、标题或多余解释。',
    '要求：总结要说明本次任务做了什么、结果如何；如果有必要可以顺带提醒下一步。',
    '要求：尽量控制在 1 到 2 句内，保持简洁。',
    '要求：不要提自己是模型，不要提内部 prompt，不要编造未发生的结果。',
    '',
    `任务 ID：${input.taskId}`,
    `任务类型：${input.taskType}`,
    `项目：${input.projectDisplayName}`,
    `执行器：${input.runnerName}`,
    `最终结果：${input.finalOutcome}`,
    '',
    '【任务原始请求】',
    input.taskPrompt,
    '',
    '【任务日志尾段】',
    input.taskLogTail,
    '',
    '现在直接给出总结正文。',
  ].join('\n');
}

export function normalizeTaskCompletionSummary(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return collapsed.length > 0 ? collapsed : '';
}

export function summarizeText(content: string, maxLength = 120): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`;
}
```

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
node --import tsx --test server/task-completion-summary.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/taskCompletionSummary.ts server/task-completion-summary.test.ts
git commit -m "feat: add task completion summary prompt"
```

---

### Task 2: 把任务成功分支改成“先总结，再发完成事件”

**Files:**
- Modify: `server/shipnowManager.ts`
- Create: `server/task-completion-summary.integration.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ShipNowStore } from './db.js';
import { ShipNowManager } from './shipnowManager.js';
import type { ShipNowEnv } from './env.js';

function createTestEnv(root: string): ShipNowEnv {
  return {
    port: 3000,
    publicBaseUrl: 'http://localhost:3000',
    previewBaseUrl: 'http://localhost:3000/preview',
    shipnowApiBaseUrl: '/api',
    workspaceRoot: join(root, 'workspace'),
    templateRoot: join(root, 'templates'),
    publicStaticRoot: join(root, 'public'),
    dbPath: join(root, 'shipnow.sqlite'),
    codexBin: 'codex',
    claudeCodeBin: 'claude',
    claudeCodeAnthropicBaseUrl: 'https://api.deepseek.com/anthropic',
    claudeCodeAnthropicApiKey: 'test-key',
    claudeCodeModel: 'deepseek-v4-flash',
    defaultRunner: 'codex',
    taskTimeoutSeconds: 1800,
    shipnowAppPrefix: '/shipnow',
  };
}

function createTaskHarness() {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-task-summary-'));
  const store = new ShipNowStore(join(root, 'shipnow.sqlite'), join(root, 'public'));
  const manager = new ShipNowManager(store, createTestEnv(root));
  const project = store.createProject({
    projectId: 'proj_123456abcd',
    displayName: 'untitle-8yru',
    publicHandle: 'untitle-8yru',
    type: 'landing',
    title: 'Demo project',
    prompt: 'Build a simple landing page.',
    sourceRoot: join(root, 'workspace', 'proj_123456abcd'),
    status: 'preview_ready',
  });
  const task = store.createTask({
    projectId: project.project_id,
    type: 'publish',
    prompt: 'Publish the current preview.',
    runnerName: 'codex',
    logPath: join(root, 'public', project.project_id, 'logs', 'task.log'),
  });
  return { root, store, manager, project, task };
}

test('task completion event stores an llm summary when summary generation succeeds', async () => {
  const { root, manager, store, project, task } = createTaskHarness();

  try {
    (manager as unknown as { executePublish: () => Promise<void> }).executePublish = async () => {};
    (manager as unknown as { runRunnerText: () => Promise<string> }).runRunnerText = async () =>
      '首页按钮已调整并完成预览构建。';

    await (manager as unknown as { executeTask: (task: unknown) => Promise<void> }).executeTask(task);

    const events = store.listEvents(project.project_id);
    const completed = events.find((event) => event.type === 'task_completed');

    assert.equal(completed?.detail, '首页按钮已调整并完成预览构建。');
    assert.match(JSON.stringify(completed?.data ?? {}), /"summarySource":"llm"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --import tsx --test server/task-completion-summary.integration.test.ts
```

Expected: fail because `executeTask()` still writes the fixed template and does not call a summary step.

- [ ] **Step 3: Write the minimal implementation**

Change the task success flow in `executeTask()` so it does this in order:

1. Keep the task-specific execution logic unchanged
2. Mark the task as success
3. Read the task log text and take a tail slice, for example the last 12,000 characters
4. Build a summary prompt with `buildTaskCompletionSummaryPrompt(...)`
5. Call `runRunnerText(runnerName, summaryPrompt, project.source_root, summaryTimeoutMs)` where `summaryTimeoutMs = Math.min(this.env.taskTimeoutSeconds * 1000, 45_000)`
6. Normalize the returned text with `normalizeTaskCompletionSummary(...)`
7. If the summary is blank or throws, fall back to `任务 ${task.id} 已成功完成。`
8. Carry a `summarySource` flag so the event data can distinguish model text from fallback text
9. Create `task_completed` with:

```ts
const summaryTimeoutMs = Math.min(this.env.taskTimeoutSeconds * 1000, 45_000);
const logTail = this.store.getTaskLogText(task.id).slice(-12_000);
let summarySource: 'llm' | 'fallback' = 'fallback';
let summaryText = `任务 ${task.id} 已成功完成。`;

try {
  const rawSummary = await this.runRunnerText(
    runnerName,
    buildTaskCompletionSummaryPrompt({
      runnerName,
      taskId: task.id,
      taskType: task.type,
      projectDisplayName: project.display_name,
      taskPrompt: task.prompt,
      taskLogTail: logTail,
      finalOutcome: 'success',
    }),
    project.source_root,
    summaryTimeoutMs
  );
  const normalizedSummary = normalizeTaskCompletionSummary(rawSummary);
  if (normalizedSummary) {
    summaryText = normalizedSummary;
    summarySource = 'llm';
  }
} catch (error) {
  await this.store.appendTaskLogAsync(task.id, `Summary generation failed: ${String(error)}`);
}
```

Then create `task_completed` with:

```ts
{
  type: 'task_completed',
  title: '任务执行完成',
  detail: summaryText,
  data: {
    taskId: task.id,
    taskType: task.type,
    runnerName,
    summary: summaryText,
    summarySource: summarySource,
  },
}
```

`server/db.ts` 只需要继续使用现有的 `createEvent()` / `listEvents()` 结构，不需要迁库；直接复用 `getTaskLogText()` 读取任务日志即可，不要为了这一步引入新的日志系统。

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
node --import tsx --test server/task-completion-summary.integration.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/shipnowManager.ts server/task-completion-summary.integration.test.ts
git commit -m "feat: summarize completed tasks with llm"
```

---

### Task 3: 收紧后续会话里对最近事件的回放长度

**Files:**
- Modify: `server/shipnowManager.ts`
- Modify: `server/taskCompletionSummary.ts`
- Create: `server/conversation-session-context.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeText } from './taskCompletionSummary.js';

test('summaries used for session context stay short', () => {
  const text = summarizeText('第一句很长很长很长。\n第二句也很长很长很长。', 18);
  assert.equal(text, '第一句很长很长很长…。');
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --import tsx --test server/conversation-session-context.test.ts
```

Expected: fail because the helper is not yet exported from the shared summary utility.

- [ ] **Step 3: Write the minimal implementation**

Introduce or export a small helper that is reused for recent events as well as message snippets:

```ts
import { summarizeText } from './taskCompletionSummary.js';
```

Then change `buildConversationSessionContext()` so recent events always use the summarized version:

```ts
const recentEvents = detail.events.slice(-3).map((event) => {
  const description = event.detail?.trim();
  return description ? `${event.title}：${summarizeText(description)}` : event.title;
});
```

This keeps the new completion summary usable in future prompts without letting the text balloon.

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
node --import tsx --test server/conversation-session-context.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/shipnowManager.ts server/conversation-session-context.test.ts
git commit -m "feat: keep recent event summaries compact"
```

---

### Task 4: End-to-end verification and browser spot check

**Files:**
- No new files
- Verify: `server/task-completion-summary.test.ts`
- Verify: `server/task-completion-summary.integration.test.ts`
- Verify: `server/conversation-session-context.test.ts`
- Verify: `pnpm build`

- [ ] **Step 1: Run the focused test suite**

Run:

```bash
node --import tsx --test server/task-completion-summary.test.ts server/task-completion-summary.integration.test.ts server/conversation-session-context.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run the app build**

Run:

```bash
pnpm build
```

Expected: pass.

- [ ] **Step 3: Open the project page in the in-app browser**

Navigate to a project with a finished task and confirm:

- `任务执行完成` 卡片的正文是一段自然语言总结
- 这段总结读起来像人写的，不像固定模板
- 失败任务仍然继续显示现有失败事件，不受这次改动影响
- 消息流和时间线没有出现额外噪音

- [ ] **Step 4: Commit the final change set**

```bash
git add server/taskCompletionSummary.ts server/task-completion-summary.test.ts server/task-completion-summary.integration.test.ts server/conversation-session-context.test.ts server/shipnowManager.ts
git commit -m "feat: show llm summaries for completed tasks"
```

## Risks and Guardrails

- 如果 summary prompt 太松，runner 可能返回长段解释，所以 prompt 必须强制“只输出一段自然语言总结”
- 如果 summary 生成失败，不要阻断任务成功状态，也不要把失败原因直接塞到成功卡里
- 如果后续发现 log 尾段太长影响总结质量，再单独把日志读取改成真正的 tail helper，不要在第一版过度重构
- 如果后续会话 prompt 还是偏长，再按需收紧 recent event 截断长度，而不是把事件详情删掉
