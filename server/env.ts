import { resolve } from 'node:path';

export interface ShipNowEnv {
  port: number;
  publicBaseUrl: string;
  previewBaseUrl: string;
  shipnowApiBaseUrl: string;
  workspaceRoot: string;
  templateRoot: string;
  previewStaticRoot: string;
  publicStaticRoot: string;
  dbPath: string;
  codexBin: string;
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

export function loadEnv(): ShipNowEnv {
  const workspaceRoot = envPath('SHIPNOW_WORKSPACE_ROOT', 'workspace');
  const previewStaticRoot = envPath('SHIPNOW_PREVIEW_STATIC_ROOT', 'workspace/preview');
  const publicStaticRoot = envPath('SHIPNOW_PUBLIC_STATIC_ROOT', 'workspace/public');
  return {
    port: envInt('SHIPNOW_PORT', 3000),
    publicBaseUrl: process.env.SHIPNOW_PUBLIC_BASE_URL?.trim() || 'http://localhost:3000',
    previewBaseUrl: process.env.SHIPNOW_PREVIEW_BASE_URL?.trim() || 'http://localhost:3000/preview',
    shipnowApiBaseUrl: process.env.SHIPNOW_API_BASE_URL?.trim() || '/api',
    workspaceRoot,
    templateRoot: envPath('SHIPNOW_TEMPLATE_ROOT', 'templates'),
    previewStaticRoot,
    publicStaticRoot,
    dbPath: envPath('SHIPNOW_DB_PATH', 'workspace/shipnow.sqlite'),
    codexBin: process.env.SHIPNOW_CODEX_BIN?.trim() || 'codex',
    taskTimeoutSeconds: envInt('SHIPNOW_TASK_TIMEOUT_SECONDS', 1800),
    shipnowAppPrefix: envPrefix('SHIPNOW_APP_PREFIX', '/shipnow'),
  };
}
