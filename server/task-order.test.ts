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

test('queues project tasks before allowing the task runner to drain', async () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-task-order-'));
  try {
    const store = new ShipNowStore(join(root, 'shipnow.sqlite'), join(root, 'workspace', 'project'));
    const manager = new ShipNowManager(store, createTestEnv(root));
    const order: string[] = [];

    const originalCreateEvent = store.createEvent.bind(store);
    store.createEvent = ((input) => {
      order.push(input.type);
      return originalCreateEvent(input);
    }) as typeof store.createEvent;

    (manager as unknown as { enqueueTask: (input: unknown) => Promise<{ id: string }> }).enqueueTask = async () => ({
      id: 'task_queued_1',
    });
    (manager as unknown as { scheduleDrain: () => void }).scheduleDrain = () => {
      order.push('scheduleDrain');
    };

    await manager.createProject({ prompt: 'Build a simple landing page.' });

    assert.deepEqual(order, ['project_created', 'task_queued', 'scheduleDrain']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('new projects use the Untitled prefix for display names and untitled handles', async () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-task-order-handle-'));
  try {
    const store = new ShipNowStore(join(root, 'shipnow.sqlite'), join(root, 'workspace', 'project'));
    const manager = new ShipNowManager(store, createTestEnv(root));

    (manager as unknown as { enqueueTask: (input: unknown) => Promise<{ id: string }> }).enqueueTask = async () => ({
      id: 'task_queued_1',
    });
    (manager as unknown as { scheduleDrain: () => void }).scheduleDrain = () => undefined;

    const result = await manager.createProject({ prompt: 'Build a simple landing page.' });

    assert.match(result.project.displayName, /^untitled-[a-z0-9]{4}$/);
    assert.match(result.project.publicHandle, /^untitled-[a-z0-9]{4}$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('defers delete task execution until the delete request event is recorded', async () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-delete-order-'));
  try {
    const store = new ShipNowStore(join(root, 'shipnow.sqlite'), join(root, 'workspace', 'project'));
    const manager = new ShipNowManager(store, createTestEnv(root));
    const order: string[] = [];

    const project = store.createProject({
      projectId: 'proj_123456abcdef',
      displayName: 'untitle-r837',
      publicHandle: 'untitle-r837',
      type: 'landing',
      title: 'Demo project',
      prompt: 'Build a simple landing page.',
      sourceRoot: join(root, 'workspace', 'project', 'proj_123456abcdef', 'source'),
      status: 'preview_ready',
    });

    const originalCreateEvent = store.createEvent.bind(store);
    store.createEvent = ((input) => {
      order.push(input.type);
      return originalCreateEvent(input);
    }) as typeof store.createEvent;

    (manager as unknown as { enqueueTask: (input: unknown) => Promise<{ id: string }> }).enqueueTask = async () => ({
      id: 'task_delete_1',
    });
    (manager as unknown as { scheduleDrain: () => void }).scheduleDrain = () => {
      order.push('scheduleDrain');
    };

    await manager.deleteProject(project.project_id);

    assert.deepEqual(order, ['delete_requested', 'scheduleDrain']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
