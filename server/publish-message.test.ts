import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ShipNowStore } from './db.js';
import { ShipNowManager } from './shipnowManager.js';
import type { ShipNowEnv } from './env.js';

test('publishing records a user message in the conversation flow', async () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-publish-message-'));
  try {
    const dbPath = join(root, 'shipnow.sqlite');
    const publicStaticRoot = join(root, 'public');
    const workspaceRoot = join(root, 'workspace');
    const templateRoot = join(root, 'templates');
    const store = new ShipNowStore(dbPath, publicStaticRoot);
    const env: ShipNowEnv = {
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
      shipnowAppPrefix: '/shipnow',
    };
    const manager = new ShipNowManager(store, env);

    const project = store.createProject({
      projectId: 'proj_123456ab12cd',
      displayName: 'untitle-r837',
      publicHandle: 'untitle-r837',
      type: 'landing',
      title: 'Demo project',
      prompt: 'Build a simple landing page.',
      sourceRoot: join(workspaceRoot, 'proj_123456ab12cd'),
      status: 'preview_ready',
    });

    (manager as unknown as { enqueueTask: () => Promise<{ id: string }> }).enqueueTask = async () => ({ id: 'task_publish_1' });

    const result = await manager.publish(project.project_id);
    const messages = store.listMessages(project.project_id);
    const events = store.listEvents(project.project_id);
    const updatedProject = store.getProjectById(project.project_id);

    assert.equal(result.taskId, 'task_publish_1');
    assert.equal(messages.at(-1)?.role, 'user');
    assert.equal(messages.at(-1)?.content, '请帮我发布到正式站点。');
    assert.equal(events.at(-1)?.type, 'publish_requested');
    assert.equal(updatedProject?.status, 'publishing');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
