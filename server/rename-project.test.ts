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
    shipnowAppPrefix: '/shipnow',
  };
}

test('renaming a project stages the new handle without changing the live handle', async () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-rename-project-'));
  try {
    const store = new ShipNowStore(join(root, 'shipnow.sqlite'), join(root, 'workspace', 'project'));
    const manager = new ShipNowManager(store, createTestEnv(root));

    const project = store.createProject({
      projectId: 'proj_123456ab12cd',
      displayName: 'untitle-r837',
      publicHandle: 'untitle-r837',
      type: 'landing',
      title: 'Demo project',
      prompt: 'Build a simple landing page.',
      sourceRoot: join(root, 'workspace', 'project', 'proj_123456ab12cd', 'source'),
    });

    const renamed = await manager.renameProject({
      projectId: project.project_id,
      displayName: 'moon-diary',
    });

    assert.equal(renamed.displayName, 'moon-diary');
    assert.equal(renamed.publicHandle, 'untitle-r837');
    assert.equal(renamed.pendingPublicHandle, 'moon-diary');
    assert.equal(store.getProjectByHandle('untitle-r837')?.project_id, project.project_id);
    assert.equal(store.getProjectByHandle('moon-diary'), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
