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
    projectId: 'proj_123456789abc',
    displayName: 'untitle-8yru',
    publicHandle: 'untitle-8yru',
    type: 'landing',
    title: 'Demo project',
    prompt: 'Build a simple landing page.',
    sourceRoot: join(root, 'workspace', 'proj_123456789abc'),
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

test('task completion event stores llm summary and raw output when summary generation succeeds', async () => {
  const { root, manager, store, project, task } = createTaskHarness();
  let capturedPrompt = '';

  try {
    await store.appendTaskLogAsync(task.id, 'Building project with pnpm build.');
    await store.appendTaskLogAsync(task.id, 'Build finished successfully.');

    (manager as unknown as { executePublish: () => Promise<void> }).executePublish = async () => {};
    (manager as unknown as {
      runRunnerText: (runnerName: string, prompt: string, cwd: string, timeoutMs: number) => Promise<string>;
    }).runRunnerText = async (
      _runnerName: string,
      prompt: string
    ) => {
      capturedPrompt = prompt;
      return '  首页按钮已调整并完成预览构建。\n原始输出保留。  ';
    };

    await (manager as unknown as { executeTask: (task: unknown) => Promise<void> }).executeTask(task);

    const events = store.listEvents(project.project_id);
    const completed = events.find((event) => event.type === 'task_completed');

    assert.equal(completed?.detail, '首页按钮已调整并完成预览构建。 原始输出保留。');
    assert.equal((completed?.data as Record<string, unknown> | undefined)?.summarySource, 'llm');
    assert.equal(
      (completed?.data as Record<string, unknown> | undefined)?.summaryRawOutput,
      '  首页按钮已调整并完成预览构建。\n原始输出保留。  '
    );
    assert.match(capturedPrompt, /【任务日志尾段】/);
    assert.match(capturedPrompt, /Building project with pnpm build\./);
    assert.match(capturedPrompt, /Build finished successfully\./);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
