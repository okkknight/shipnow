import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ShipNowStore } from './db.js';

test('renaming a project keeps the old handle as an alias', () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-rename-project-'));
  try {
    const dbPath = join(root, 'shipnow.sqlite');
    const publicStaticRoot = join(root, 'public');
    const store = new ShipNowStore(dbPath, publicStaticRoot);

    const project = store.createProject({
      projectId: 'proj_123',
      displayName: 'untitle-r837',
      publicHandle: 'untitle-r837',
      type: 'landing',
      title: 'Demo project',
      prompt: 'Build a simple landing page.',
      sourceRoot: join(root, 'workspace'),
    });

    const renamed = store.renameProject(project.project_id, 'knight-space', 'knight-space');

    assert.equal(renamed?.display_name, 'knight-space');
    assert.equal(renamed?.public_handle, 'knight-space');
    assert.equal(store.getProjectByHandle('knight-space')?.project_id, project.project_id);
    assert.equal(store.getProjectByHandle('untitle-r837')?.project_id, project.project_id);
    assert.equal(store.resolveProjectHandle('untitle-r837')?.redirected, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
