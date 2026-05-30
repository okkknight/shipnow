import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ShipNowStore } from './db.js';
import { ShipNowManager } from './shipnowManager.js';
import type { ShipNowEnv } from './env.js';

function createTestEnv(root: string): ShipNowEnv {
  const dbPath = join(root, 'shipnow.sqlite');
  const publicStaticRoot = join(root, 'public');
  const workspaceRoot = join(root, 'workspace');
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
    shipnowAppPrefix: '/shipnow',
  };
}

test('publishing finalizes a pending handle rename and clears the staging state', async () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-pending-handle-publish-'));
  try {
    const store = new ShipNowStore(join(root, 'shipnow.sqlite'), join(root, 'public'));
    const manager = new ShipNowManager(store, createTestEnv(root));
    const project = store.createProject({
      projectId: 'proj_123456ab12cd',
      displayName: 'untitle-r837',
      publicHandle: 'untitle-r837',
      type: 'landing',
      title: 'Demo project',
      prompt: 'Build a simple landing page.',
      sourceRoot: join(root, 'workspace', 'proj_123456ab12cd'),
      status: 'preview_ready',
    });

    mkdirSync(join(root, 'public', project.project_id, 'logs'), { recursive: true });
    mkdirSync(join(root, 'public', project.project_id, 'releases', 'public'), { recursive: true });
    const previewReleasePath = join(root, 'public', project.project_id, 'releases', 'preview', 'release-preview');
    mkdirSync(previewReleasePath, { recursive: true });
    writeFileSync(join(previewReleasePath, 'index.html'), '<html><head></head><body>preview</body></html>');
    store.createRelease({
      projectId: project.project_id,
      kind: 'preview',
      source: project.source_root,
      releasePath: previewReleasePath,
      buildTaskId: 'task_preview_1',
      current: true,
    });

    await manager.renameProject({
      projectId: project.project_id,
      displayName: 'moon-diary',
    });

    const task = {
      id: 'task_publish_1',
      project_id: project.project_id,
      type: 'publish' as const,
      status: 'pending' as const,
      prompt: 'Publish the latest successful preview release to the public release.',
      started_at: null,
      finished_at: null,
      log_path: join(root, 'public', project.project_id, 'logs', 'task.log'),
      runner_name: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await (manager as unknown as { executePublish: (project: any, task: any) => Promise<void> }).executePublish(
      store.getProjectById(project.project_id),
      task
    );

    const refreshed = store.getProjectById(project.project_id);
    assert.equal(refreshed?.display_name, 'moon-diary');
    assert.equal(refreshed?.public_handle, 'moon-diary');
    assert.equal(refreshed?.pending_public_handle, null);
    assert.equal(refreshed?.status, 'published');
    assert.equal(store.getProjectByHandle('untitle-r837'), null);
    assert.equal(store.resolveProjectHandle('untitle-r837'), null);

    const publicRelease = store.getCurrentRelease(project.project_id, 'public');
    assert.ok(publicRelease);
    assert.match(readFileSync(join(publicRelease!.release_path, 'index.html'), 'utf8'), /<base href="\/moon-diary\/">/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
