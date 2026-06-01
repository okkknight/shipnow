# ShipNow 并发任务队列实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 ShipNow 在共享同一份项目数据的前提下，默认可以同时并发执行 10 个不同项目的生成任务；同一个项目仍然只允许一个活跃任务，任务状态、日志和恢复语义保持稳定。

**Architecture:** 用 SQLite 继续承担任务真相源，但把当前单全局 `runningTaskId + drain()` 串行器替换成固定并发数的 worker pool。worker 不直接扫描全表竞争，而是通过一个原子领取方法从数据库领取下一条 `pending` 任务；领取成功后才进入现有的 `executeTask()` 执行链路。这样可以在不引入 Redis / BullMQ 的前提下，把并发上限收敛为可配置、可测试、可恢复的本地实现。

**Tech Stack:** TypeScript, better-sqlite3, Node.js worker loops, existing Codex / Claude Code CLI runners, Fastify API shell

---

## Scope Lock

- 这次只解决“共享数据 + 多项目并发生成”，不做用户隔离、不加登录态、不引入多租户表结构
- 不引入外部队列服务，所有调度仍然在当前 ShipNow 进程 + SQLite 内完成
- 同一个项目仍然保持“最多一个 `pending/running` 任务”的限制，避免同项目并发改写
- 现有 task 日志、`task_started` / `task_completed` 事件、任务恢复逻辑继续沿用

## Current State That This Plan Builds On

- `server/shipnowManager.ts` 当前只有一个全局 `runningTaskId`，`drain()` 每次只执行一条任务
- `server/db.ts` 已经有 `createTask()`、`updateTask()`、`setTaskStatus()`、`listPendingTasks()`、`listRunningTasks()` 和 `activeTaskForProject()`
- `server/env.ts` 已经有 `taskTimeoutSeconds` 等运行配置解析入口，适合继续加并发阈值
- `server/task-recovery.test.ts` 已经在验证重启后 running task 的恢复路径，适合一起补并发后的恢复行为

## Decisions Already Locked

- 默认并发数先定为 `10`
- 并发上限必须可配置，后续机器资源或 provider 限流不够时能直接调小
- 新增实现优先保持小而清晰：任务领取、worker 调度、恢复逻辑各自有边界
- `taskQueue` 相关逻辑优先抽成独立模块，避免 `ShipNowManager` 继续膨胀

---

### Task 1: 给环境配置和 SQLite 任务表补“并发上限 + 原子领取”

**Files:**
- Modify: `server/env.ts`
- Modify: `server/db.ts`
- Create: `server/env.test.ts`
- Create: `server/task-claim.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv } from './env.js';
import { ShipNowStore } from './db.js';

test('loadEnv defaults task concurrency to 10', () => {
  const previous = process.env.SHIPNOW_TASK_CONCURRENCY;
  delete process.env.SHIPNOW_TASK_CONCURRENCY;

  try {
    const env = loadEnv();
    assert.equal((env as { taskConcurrency: number }).taskConcurrency, 10);
  } finally {
    if (previous === undefined) {
      delete process.env.SHIPNOW_TASK_CONCURRENCY;
    } else {
      process.env.SHIPNOW_TASK_CONCURRENCY = previous;
    }
  }
});

test('claimNextPendingTask returns pending tasks in created order and marks them running', () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-task-claim-'));
  try {
    const store = new ShipNowStore(join(root, 'shipnow.sqlite'), join(root, 'workspace', 'project'));
    const project = store.createProject({
      projectId: 'proj_123456abcd',
      displayName: 'untitle-7tj2',
      publicHandle: 'untitle-7tj2',
      type: 'landing',
      title: 'Demo project',
      prompt: 'Build a simple landing page.',
      sourceRoot: join(root, 'workspace', 'project', 'proj_123456abcd', 'source'),
      status: 'preview_ready',
    });
    const firstTask = store.createTask({
      projectId: project.project_id,
      type: 'rebuild',
      prompt: 'Rebuild the current project.',
      logPath: join(root, 'workspace', 'project', project.project_id, 'logs', 'task-1.log'),
    });
    const secondTask = store.createTask({
      projectId: project.project_id,
      type: 'publish',
      prompt: 'Publish the current project.',
      logPath: join(root, 'workspace', 'project', project.project_id, 'logs', 'task-2.log'),
    });

    const firstClaim = store.claimNextPendingTask(18_000);
    const secondClaim = store.claimNextPendingTask(18_000);
    const thirdClaim = store.claimNextPendingTask(18_000);

    assert.equal(firstClaim?.id, firstTask.id);
    assert.equal(firstClaim?.status, 'running');
    assert.equal(secondClaim?.id, secondTask.id);
    assert.equal(secondClaim?.status, 'running');
    assert.equal(thirdClaim, null);
    assert.equal(store.listPendingTasks().length, 0);
    assert.equal(store.listRunningTasks().length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
node --import tsx --test server/env.test.ts
node --import tsx --test server/task-claim.test.ts
```

Expected: fail because `taskConcurrency` and `claimNextPendingTask()` do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

`server/env.ts`:

```ts
export interface ShipNowEnv {
  // ...
  taskTimeoutSeconds: number;
  taskConcurrency: number;
  shipnowAppPrefix: string;
}

export function loadEnv(): ShipNowEnv {
  // ...
  return {
    // ...
    taskTimeoutSeconds: envInt('SHIPNOW_TASK_TIMEOUT_SECONDS', 1800),
    taskConcurrency: envInt('SHIPNOW_TASK_CONCURRENCY', 10),
    shipnowAppPrefix: envPrefix('SHIPNOW_APP_PREFIX', '/shipnow'),
  };
}
```

`server/db.ts`:

```ts
claimNextPendingTask(timeoutMs: number): TaskRecord | null {
  const transaction = this.db.transaction(() => {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1")
      .get() as TaskRecord | undefined;
    if (!row) {
      return null;
    }

    const startedAt = nowIso();
    const next: TaskRecord = {
      ...row,
      status: 'running',
      started_at: row.started_at ?? startedAt,
      timeout_ms: timeoutMs,
      active_pid: null,
      updated_at: startedAt,
    };

    const result = this.db
      .prepare(
        `
        UPDATE tasks SET
          status = @status,
          started_at = @started_at,
          timeout_ms = @timeout_ms,
          active_pid = @active_pid,
          updated_at = @updated_at
        WHERE id = @id AND status = 'pending'
      `
      )
      .run(next);

    return result.changes === 1 ? next : null;
  });

  return transaction();
}
```

- [ ] **Step 4: Run the tests again and confirm they pass**

Run:

```bash
node --import tsx --test server/env.test.ts
node --import tsx --test server/task-claim.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/env.ts server/db.ts server/env.test.ts server/task-claim.test.ts
git commit -m "feat: add task concurrency config and claim"
```

---

### Task 2: 用独立 worker pool 替换全局串行 drain

**Files:**
- Create: `server/taskQueue.ts`
- Modify: `server/shipnowManager.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { TaskQueuePool } from './taskQueue.js';

test('worker pool never exceeds its configured concurrency', async () => {
  let active = 0;
  let peak = 0;
  const tasks = [
    { id: 'task_1' },
    { id: 'task_2' },
    { id: 'task_3' },
    { id: 'task_4' },
  ];

  const pool = new TaskQueuePool({
    concurrency: 2,
    claimNextTask: async () => tasks.shift() ?? null,
    runTask: async (task: { id: string }) => {
      active += 1;
      peak = Math.max(peak, active);
      await sleep(20);
      active -= 1;
    },
  });

  pool.start();
  pool.notify();
  await sleep(150);
  await pool.stop();

  assert.equal(peak <= 2, true);
});

test('worker pool wakes idle workers when new tasks arrive', async () => {
  const claimed: string[] = [];
  const tasks: Array<{ id: string } | null> = [null];
  const pool = new TaskQueuePool({
    concurrency: 1,
    claimNextTask: async () => tasks.shift() ?? null,
    runTask: async (task: { id: string }) => {
      claimed.push(task.id);
    },
  });

  pool.start();
  pool.notify();
  await sleep(20);
  tasks.push({ id: 'task_late' });
  pool.notify();
  await sleep(20);
  await pool.stop();

  assert.deepEqual(claimed, ['task_late']);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --import tsx --test server/task-queue.test.ts
```

Expected: fail because `TaskQueuePool` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

`server/taskQueue.ts`:

```ts
export interface TaskQueuePoolOptions<TTask> {
  concurrency: number;
  claimNextTask: () => Promise<TTask | null>;
  runTask: (task: TTask) => Promise<void>;
}

export class TaskQueuePool<TTask> {
  private stopped = false;
  private started = false;
  private readonly workers: Promise<void>[] = [];
  private readonly wakeResolvers = new Set<() => void>();

  constructor(private readonly options: TaskQueuePoolOptions<TTask>) {}

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    for (let index = 0; index < this.options.concurrency; index += 1) {
      this.workers.push(this.workerLoop(index + 1));
    }
  }

  notify(): void {
    for (const resolve of this.wakeResolvers) {
      resolve();
    }
    this.wakeResolvers.clear();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.notify();
    await Promise.allSettled(this.workers);
  }

  private async waitForWork(): Promise<void> {
    if (this.stopped) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.wakeResolvers.add(resolve);
    });
  }

  private async workerLoop(_workerId: number): Promise<void> {
    while (!this.stopped) {
      const next = await this.options.claimNextTask();
      if (!next) {
        await this.waitForWork();
        continue;
      }
      await this.options.runTask(next);
    }
  }
}
```

`server/shipnowManager.ts`:

```ts
private readonly taskQueue: TaskQueuePool<TaskRecord>;

constructor(store: ShipNowStore, env: ShipNowEnv) {
  this.store = store;
  this.env = env;
  this.taskQueue = new TaskQueuePool<TaskRecord>({
    concurrency: this.env.taskConcurrency,
    claimNextTask: () => Promise.resolve(this.store.claimNextPendingTask(this.env.taskTimeoutSeconds * 1000)),
    runTask: (task) => this.executeTask(task),
  });
}

async initialize(): Promise<void> {
  await ensureWorkspaceRoots(this.env);
  await this.recoverInterruptedDeleteTasks();
  await this.recoverRunningTasks();
  this.taskQueue.start();
  this.taskQueue.notify();
}

async shutdown(): Promise<void> {
  for (const timer of this.recoveredTaskTimers.values()) {
    clearTimeout(timer);
  }
  this.recoveredTaskTimers.clear();
  await this.taskQueue.stop();
}

private scheduleDrain(): void {
  this.taskQueue.notify();
}
```

Also keep the existing task enqueue call sites wired to `scheduleDrain()` so the current event ordering stays intact while the internal implementation changes.

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
node --import tsx --test server/task-queue.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/taskQueue.ts server/shipnowManager.ts server/task-queue.test.ts
git commit -m "feat: add task queue worker pool"
```

---

### Task 3: 补 ShipNow 的并发回归测试并做全量验证

**Files:**
- Modify: `server/task-order.test.ts`
- Modify: `server/task-recovery.test.ts`
- Modify: `server/runner-settings.test.ts` or create `server/env.test.ts` as the definitive env guard
- Verify: `pnpm build`

- [ ] **Step 1: Write the failing regression test**

```ts
test('two different projects can have queued tasks at the same time without sharing a project lock', async () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-concurrency-regression-'));
  try {
    const store = new ShipNowStore(join(root, 'shipnow.sqlite'), join(root, 'workspace', 'project'));
    const projectA = store.createProject({
      projectId: 'proj_a123456789ab',
      displayName: 'untitle-a111',
      publicHandle: 'untitle-a111',
      type: 'landing',
      title: 'Project A',
      prompt: 'Build project A.',
      sourceRoot: join(root, 'workspace', 'project', 'proj_a123456789ab', 'source'),
      status: 'preview_ready',
    });
    const projectB = store.createProject({
      projectId: 'proj_b123456789ab',
      displayName: 'untitle-b111',
      publicHandle: 'untitle-b111',
      type: 'landing',
      title: 'Project B',
      prompt: 'Build project B.',
      sourceRoot: join(root, 'workspace', 'project', 'proj_b123456789ab', 'source'),
      status: 'preview_ready',
    });

    const taskA = store.createTask({
      projectId: projectA.project_id,
      type: 'rebuild',
      prompt: 'Rebuild A.',
      logPath: join(root, 'workspace', 'project', projectA.project_id, 'logs', 'task-a.log'),
    });
    const taskB = store.createTask({
      projectId: projectB.project_id,
      type: 'rebuild',
      prompt: 'Rebuild B.',
      logPath: join(root, 'workspace', 'project', projectB.project_id, 'logs', 'task-b.log'),
    });

    const claimedA = store.claimNextPendingTask(18_000);
    const claimedB = store.claimNextPendingTask(18_000);

    assert.equal(claimedA?.id, taskA.id);
    assert.equal(claimedB?.id, taskB.id);
    assert.equal(store.activeTaskForProject(projectA.project_id), true);
    assert.equal(store.activeTaskForProject(projectB.project_id), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the tests and confirm they fail before the implementation is in**

Run:

```bash
node --import tsx --test server/task-order.test.ts
node --import tsx --test server/task-recovery.test.ts
```

Expected: fail until the queue pool is wired into `ShipNowManager` and the new claim path is used.

- [ ] **Step 3: Make the integration changes**

Update `server/task-order.test.ts` so the existing order assertions still protect the queue wake ordering, but stop depending on the old serial `drain()` implementation.

Update `server/task-recovery.test.ts` so restart recovery still works when there are multiple queued workers, and `running` tasks with a missing `active_pid` still fail safely.

If the queue pool exposes a `notify()` wake method, keep `scheduleDrain()` as a compatibility wrapper around it so the current create/queue event ordering remains intact during the refactor.

- [ ] **Step 4: Run the full verification set**

Run:

```bash
node --import tsx --test server/env.test.ts server/task-claim.test.ts server/task-queue.test.ts server/task-order.test.ts server/task-recovery.test.ts
pnpm build
```

Expected:
- all tests pass
- Vite build succeeds
- no TypeScript errors in `server/`

- [ ] **Step 5: Commit**

```bash
git add server/env.ts server/db.ts server/taskQueue.ts server/shipnowManager.ts server/env.test.ts server/task-claim.test.ts server/task-queue.test.ts server/task-order.test.ts server/task-recovery.test.ts
git commit -m "feat: enable concurrent task workers"
```

---

## Self-Review Checklist

- `taskConcurrency` exists in the env layer and defaults to 10
- `claimNextPendingTask()` is atomic and returns only one pending task per call
- `ShipNowManager` no longer depends on a single global `runningTaskId` for scheduling
- the worker pool can wake on new tasks and stops cleanly on shutdown
- the same-project single-active-task rule is preserved
- tests cover env parsing, claim ordering, worker concurrency, and recovery
- `pnpm build` remains the final sanity check
