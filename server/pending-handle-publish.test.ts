import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ShipNowStore } from './db.js';
import { ShipNowManager } from './shipnowManager.js';
import type { ShipNowEnv } from './env.js';
import type { ProjectRecord } from './types.js';

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

test('publish request describes the handle cutover when a rename is pending', async () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-pending-handle-request-'));
  try {
    const store = new ShipNowStore(join(root, 'shipnow.sqlite'), join(root, 'public'));
    const manager = new ShipNowManager(store, createTestEnv(root));
    const project = store.createProject({
      projectId: 'proj_123456ab34cd',
      displayName: 'untitle-r837',
      publicHandle: 'untitle-r837',
      type: 'landing',
      title: 'Demo project',
      prompt: 'Build a simple landing page.',
      sourceRoot: join(root, 'workspace', 'proj_123456ab34cd'),
      status: 'preview_ready',
    });

    await manager.renameProject({
      projectId: project.project_id,
      displayName: 'moon-diary',
    });

    const previewReleasePath = join(root, 'public', project.project_id, 'releases', 'preview', 'release-preview');
    mkdirSync(join(root, 'public', project.project_id, 'logs'), { recursive: true });
    mkdirSync(join(root, 'public', project.project_id, 'releases', 'preview'), { recursive: true });
    mkdirSync(join(root, 'public', project.project_id, 'releases', 'public'), { recursive: true });
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

    (manager as unknown as { enqueueTask: () => Promise<{ id: string }> }).enqueueTask = async () => ({ id: 'task_publish_1' });

    await manager.publish(project.project_id);

    const events = store.listEvents(project.project_id);
    const requested = events.find((event) => event.type === 'publish_requested');

    assert.ok(requested);
    assert.equal(requested?.title, '开始发布');
    assert.equal(requested?.detail, '公开地址将从 untitle-r837 切换到 moon-diary。');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('preview release base href follows the preview base url pathname', async () => {
  const scenarios = [
    {
      previewBaseUrl: 'http://localhost:3000/preview',
      expectedBaseHref: '/preview/untitle-r837/',
    },
    {
      previewBaseUrl: 'https://api.boringmax.com/shipnow/preview',
      expectedBaseHref: '/shipnow/preview/untitle-r837/',
    },
  ];

  for (const scenario of scenarios) {
    const root = mkdtempSync(join(tmpdir(), 'shipnow-preview-base-href-'));
    try {
      const store = new ShipNowStore(join(root, 'shipnow.sqlite'), join(root, 'public'));
      const manager = new ShipNowManager(
        store,
        {
          port: 3000,
          publicBaseUrl: 'http://localhost:3000',
          previewBaseUrl: scenario.previewBaseUrl,
          shipnowApiBaseUrl: '/api',
          workspaceRoot: join(root, 'workspace'),
          templateRoot: join(root, 'templates'),
          publicStaticRoot: join(root, 'public'),
          dbPath: join(root, 'shipnow.sqlite'),
          codexBin: 'codex',
          claudeCodeBin: 'claude',
          claudeCodeAnthropicBaseUrl: 'https://api.deepseek.com/anthropic',
          claudeCodeAnthropicApiKey: '',
          claudeCodeModel: 'deepseek-v4-flash',
          defaultRunner: 'codex',
          taskTimeoutSeconds: 1800,
          shipnowAppPrefix: '/shipnow',
        }
      );
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

      const sourceDist = join(project.source_root, 'dist');
      mkdirSync(sourceDist, { recursive: true });
      writeFileSync(join(sourceDist, 'index.html'), '<html><head></head><body>preview</body></html>');

      const previewRelease = await (manager as unknown as {
        publishPreviewRelease: (
          projectRecord: ProjectRecord,
          taskId: string,
          sourceRoot: string
        ) => Promise<{ release_path: string }>;
      }).publishPreviewRelease(project, 'task_preview_1', project.source_root);

      const rendered = readFileSync(join(previewRelease.release_path, 'index.html'), 'utf8');
      assert.match(rendered, new RegExp(`<base href="${scenario.expectedBaseHref.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}">`));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});
