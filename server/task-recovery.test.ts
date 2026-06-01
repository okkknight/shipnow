import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ShipNowStore } from './db.js';
import { ShipNowManager } from './shipnowManager.js';
import type { ShipNowEnv } from './env.js';

function createTestEnv(root: string): ShipNowEnv {
  const dbPath = join(root, 'shipnow.sqlite');
  const publicStaticRoot = join(root, 'workspace', 'public');
  const workspaceRoot = join(root, 'workspace', 'project');
  const templateRoot = join(root, 'templates');
  return {
    port: 3000,
    publicBaseUrl: 'http://localhost:3000',
    previewBaseUrl: 'http://localhost:3000/preview',
    shipnowApiBaseUrl: '/api',
    workspaceRoot,
    templateRoot,
    publicStaticRoot,
    dbPath,
    codexBin: 'codex',
    claudeCodeBin: 'claude',
    claudeCodeAnthropicBaseUrl: 'https://api.deepseek.com/anthropic',
    claudeCodeAnthropicApiKey: '',
    claudeCodeModel: 'deepseek-v4-flash',
    defaultRunner: 'codex',
    taskTimeoutSeconds: 1800,
    taskConcurrency: 10,
    shipnowAppPrefix: '/shipnow',
  };
}

test('restarts recover stale running tasks instead of leaving them running forever', async () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-task-recovery-'));
  try {
    const env = createTestEnv(root);
    const store = new ShipNowStore(env.dbPath, env.workspaceRoot);
    const projectId = 'proj_ab12cd34ef56';
    const project = store.createProject({
      projectId,
      displayName: 'untitled-recover',
      publicHandle: 'untitled-recover',
      type: 'landing',
      title: 'Recover test',
      prompt: 'Build a tiny landing page.',
      sourceRoot: join(root, 'workspace', 'project', projectId, 'source'),
      status: 'generating',
    });
    const task = store.createTask({
      projectId: project.project_id,
      type: 'create_project',
      prompt: project.prompt,
      logPath: join(root, 'workspace', 'project', project.project_id, 'logs', 'task.log'),
    });

    store.setTaskStatus(task.id, 'running', {
      started_at: new Date(Date.now() - 10_000).toISOString(),
      timeout_ms: 1_000,
      active_pid: null,
    });

    const manager = new ShipNowManager(store, env);
    await manager.initialize();

    const refreshedTask = store.getTask(task.id);
    const refreshedProject = store.getProjectById(project.project_id);
    assert.equal(refreshedTask?.status, 'failed');
    assert.equal(refreshedTask?.finished_at !== null, true);
    assert.equal(refreshedTask?.error_message, '任务在后端重启后丢失了活跃进程，已自动结束。');
    assert.equal(refreshedProject?.status, 'build_failed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
