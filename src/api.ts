import type {
  AppSettingsResponse,
  ProjectActionResponse,
  ProjectDetailResponse,
  ProjectListResponse,
  ProjectSettingsResponse,
  ProjectView,
  TaskView,
} from './types';
import { getShipNowRuntimeConfig } from './runtimeConfig';

const API_BASE = getShipNowRuntimeConfig().apiBaseUrl;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init?.body !== null;
  const headers: Record<string, string> = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function listProjects(): Promise<ProjectListResponse> {
  return request('/projects');
}

export function getAppSettings(): Promise<AppSettingsResponse> {
  return request('/settings');
}

export function updateAppSettings(defaultRunner: 'codex' | 'claude-code'): Promise<AppSettingsResponse> {
  return request('/settings', {
    method: 'PUT',
    body: JSON.stringify({ defaultRunner }),
  });
}

export function createProject(payload: {
  prompt: string;
}): Promise<ProjectActionResponse> {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getProject(projectId: string): Promise<ProjectDetailResponse> {
  return request(`/projects/${encodeURIComponent(projectId)}`);
}

export function applyChange(projectId: string, prompt: string): Promise<ProjectActionResponse> {
  return request(`/projects/${encodeURIComponent(projectId)}/changes`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export function rebuildProject(projectId: string): Promise<ProjectActionResponse> {
  return request(`/projects/${encodeURIComponent(projectId)}/rebuild`, {
    method: 'POST',
  });
}

export function publishProject(projectId: string): Promise<ProjectActionResponse> {
  return request(`/projects/${encodeURIComponent(projectId)}/publish`, {
    method: 'POST',
  });
}

export function renameProject(projectId: string, displayName: string): Promise<ProjectView> {
  return request(`/projects/${encodeURIComponent(projectId)}/rename`, {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

export function getProjectSettings(projectId: string): Promise<ProjectSettingsResponse> {
  return request(`/projects/${encodeURIComponent(projectId)}/settings`);
}

export function updateProjectSettings(projectId: string, preferredRunner: 'codex' | 'claude-code' | null): Promise<ProjectSettingsResponse> {
  return request(`/projects/${encodeURIComponent(projectId)}/settings`, {
    method: 'PUT',
    body: JSON.stringify({ preferredRunner }),
  });
}

export function deleteProject(projectId: string): Promise<ProjectActionResponse> {
  return request(`/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
}

export function getTask(taskId: string): Promise<{ task: TaskView }> {
  return request(`/tasks/${encodeURIComponent(taskId)}`);
}

export async function getTaskLogs(taskId: string): Promise<string> {
  const response = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/logs`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return await response.text();
}

export function getApiBase(): string {
  return API_BASE;
}
