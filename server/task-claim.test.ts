import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ShipNowStore } from './db.js';

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

test('claimNextPendingTask leaves an empty queue empty', () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-task-claim-empty-'));
  try {
    const store = new ShipNowStore(join(root, 'shipnow.sqlite'), join(root, 'workspace', 'project'));
    assert.equal(store.claimNextPendingTask(18_000), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
