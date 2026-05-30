import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TaskRunnerName } from './runners.js';

export interface ShipNowEnv {
  port: number;
  publicBaseUrl: string;
  previewBaseUrl: string;
  shipnowApiBaseUrl: string;
  workspaceRoot: string;
  templateRoot: string;
  publicStaticRoot: string;
  dbPath: string;
  codexBin: string;
  claudeCodeBin: string;
  claudeCodeAnthropicBaseUrl: string;
  claudeCodeAnthropicApiKey: string;
  claudeCodeModel: string;
  defaultRunner: TaskRunnerName;
  taskTimeoutSeconds: number;
  shipnowAppPrefix: string;
}

function envPath(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    return resolve(process.cwd(), fallback);
  }
  return value;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || !raw.trim()) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function envPrefix(name: string, fallback: string): string {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  return raw.trim();
}

function envRunner(name: string, fallback: TaskRunnerName): TaskRunnerName {
  const raw = process.env[name]?.trim();
  return raw === 'claude-code' ? 'claude-code' : fallback;
}

function envValue(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) {
    return null;
  }

  const key = match[1];
  let value = match[2].trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
  return [key, value];
}

function loadEnvFile(filePath: string, lockedKeys: Set<string>): void {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }
    const [key, value] = parsed;
    if (lockedKeys.has(key)) {
      continue;
    }
    process.env[key] = value;
  }
}

const lockedEnvKeys = new Set(Object.keys(process.env));
loadEnvFile(resolve(process.cwd(), '.env'), lockedEnvKeys);
loadEnvFile(resolve(process.cwd(), '.env.local'), lockedEnvKeys);

export function loadEnv(): ShipNowEnv {
  const workspaceRoot = envPath('SHIPNOW_WORKSPACE_ROOT', 'workspace');
  const publicStaticRoot = envPath('SHIPNOW_PUBLIC_STATIC_ROOT', 'workspace/public');
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    port: envInt('SHIPNOW_PORT', 3000),
    publicBaseUrl: envValue('SHIPNOW_PUBLIC_BASE_URL') || 'http://localhost:3000',
    previewBaseUrl:
      envValue('SHIPNOW_PREVIEW_BASE_URL') ||
      (isProduction ? 'https://api.boringmax.com/shipnow/preview' : 'http://localhost:3000/preview'),
    shipnowApiBaseUrl: envValue('SHIPNOW_API_BASE_URL') || 'https://api.boringmax.com/shipnow/api',
    workspaceRoot,
    templateRoot: envPath('SHIPNOW_TEMPLATE_ROOT', 'templates'),
    publicStaticRoot,
    dbPath: envPath('SHIPNOW_DB_PATH', 'workspace/shipnow.sqlite'),
    codexBin: envValue('SHIPNOW_CODEX_BIN') || 'codex',
    claudeCodeBin: envValue('SHIPNOW_CLAUDE_CODE_BIN', 'CLAUDE_CODE_BIN') || 'claude',
    claudeCodeAnthropicBaseUrl: envValue('SHIPNOW_CLAUDE_ANTHROPIC_BASE_URL', 'ANTHROPIC_BASE_URL') || 'https://api.deepseek.com/anthropic',
    claudeCodeAnthropicApiKey: envValue('SHIPNOW_CLAUDE_ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY') || '',
    claudeCodeModel: envValue('SHIPNOW_CLAUDE_MODEL', 'ANTHROPIC_MODEL') || 'deepseek-v4-flash',
    defaultRunner: envRunner('SHIPNOW_DEFAULT_RUNNER', 'codex'),
    taskTimeoutSeconds: envInt('SHIPNOW_TASK_TIMEOUT_SECONDS', 1800),
    shipnowAppPrefix: envPrefix('SHIPNOW_APP_PREFIX', '/shipnow'),
  };
}
