import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadEnv } from './env.js';
import { ShipNowStore } from './db.js';

test('loadEnv defaults to codex and exposes claude/deepseek runner settings', () => {
  const env = loadEnv();

  assert.equal(env.codexBin, 'codex');
  assert.equal(env.defaultRunner, 'codex');
  assert.equal(env.claudeCodeBin, 'claude');
  assert.equal(env.claudeCodeAnthropicBaseUrl, 'https://api.deepseek.com/anthropic');
  assert.equal(env.claudeCodeModel, 'deepseek-v4-flash');
});

test('store exposes a global runner preference that defaults to codex', () => {
  const root = mkdtempSync(join(tmpdir(), 'shipnow-runner-settings-'));
  try {
    const dbPath = join(root, 'shipnow.sqlite');
    const publicStaticRoot = join(root, 'public');
    const store = new ShipNowStore(dbPath, publicStaticRoot);

    const settings = (store as unknown as { getAppSettings?: () => { defaultRunner: string; defaultRunnerBackend: string } }).getAppSettings?.();
    assert.equal(settings?.defaultRunner, 'codex');
    assert.equal(settings?.defaultRunnerBackend, 'openai');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
