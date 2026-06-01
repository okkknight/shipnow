import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert/strict';
import { createShipNowApp } from './app.js';
import { ShipNowStore } from './db.js';
import { ShipNowManager } from './shipnowManager.js';
import type { ShipNowEnv } from './env.js';

function createTestEnv(root: string, previewBaseUrl: string): ShipNowEnv {
  const dbPath = join(root, 'shipnow.sqlite');
  const workspaceRoot = join(root, 'workspace', 'project');
  const publicStaticRoot = join(root, 'workspace', 'public');
  const templateRoot = join(root, 'templates');
  return {
    port: 3000,
    publicBaseUrl: 'http://localhost:3000',
    previewBaseUrl,
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

describe('ShipNow app routing', () => {
  it('keeps the backend api-only when the ui shell is disabled', async () => {
    const app = await createShipNowApp({
      serveUiShell: false,
      publicBaseUrl: 'https://boringmax.com',
      apiBaseUrl: 'https://api.boringmax.com/shipnow/api',
      previewBaseUrl: 'https://api.boringmax.com/shipnow/preview',
    });

    try {
      const res = await app.inject({ method: 'GET', url: '/' });
      assert.equal(res.statusCode, 404);
    } finally {
      await app.close();
    }
  });

  it('injects the preview base href from the active preview base url', async () => {
    const root = mkdtempSync(join(tmpdir(), 'shipnow-preview-route-'));
    try {
      const env = createTestEnv(root, 'https://api.boringmax.com/shipnow/preview');
      const store = new ShipNowStore(env.dbPath, env.workspaceRoot);
      const manager = new ShipNowManager(store, env);
      const app = await createShipNowApp(manager, env);

      const project = store.createProject({
        projectId: 'proj_123456ab12cd',
        displayName: 'untitle-r837',
        publicHandle: 'untitle-r837',
        type: 'landing',
        title: 'Demo project',
        prompt: 'Build a simple landing page.',
        sourceRoot: join(env.workspaceRoot, 'proj_123456ab12cd', 'source'),
        status: 'preview_ready',
      });

      const previewDir = join(env.workspaceRoot, project.project_id, 'preview');
      mkdirSync(previewDir, { recursive: true });
      writeFileSync(
        join(previewDir, 'index.html'),
        '<html><head></head><body><div id="root"></div></body></html>'
      );

      try {
        const res = await app.inject({ method: 'GET', url: '/preview/untitle-r837' });
        assert.equal(res.statusCode, 200);
        assert.match(res.body, /<base href="\/shipnow\/preview\/untitle-r837\/">/);
      } finally {
        await app.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('serves the published site from the public handle directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'shipnow-public-handle-route-'));
    try {
      const env = createTestEnv(root, 'https://api.boringmax.com/shipnow/preview');
      const store = new ShipNowStore(env.dbPath, env.workspaceRoot);
      const manager = new ShipNowManager(store, env);
      const app = await createShipNowApp(manager, env);

      const project = store.createProject({
        projectId: 'proj_123456ab56cd',
        displayName: 'untitle-r837',
        publicHandle: 'untitle-r837',
        type: 'landing',
        title: 'Demo project',
        prompt: 'Build a simple landing page.',
        sourceRoot: join(env.workspaceRoot, 'proj_123456ab56cd', 'source'),
        status: 'published',
      });

      const publicDir = join(env.publicStaticRoot, 'untitle-r837');
      mkdirSync(publicDir, { recursive: true });
      writeFileSync(
        join(publicDir, 'index.html'),
        '<html><head></head><body><div id="root">published</div></body></html>'
      );

      try {
        const res = await app.inject({ method: 'GET', url: '/untitle-r837' });
        assert.equal(res.statusCode, 200);
        assert.match(res.body, /published/);
      } finally {
        await app.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
