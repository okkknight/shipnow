import type { ProjectActionResponse, ProjectDetailResponse, ProjectListResponse, ProjectView, TaskView } from './types';

function readRuntimeApiBase(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const meta = document.head.querySelector('meta[name="shipnow-api-base"]') as HTMLMetaElement | null;
  const value = meta?.content?.trim();
  return value ? value : null;
}

const API_BASE = readRuntimeApiBase() || import.meta.env.VITE_SHIPNOW_API_BASE_URL || '/api';

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

export function createProject(payload: {
  name: string;
  title: string;
  prompt: string;
}): Promise<ProjectActionResponse> {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getProject(projectName: string): Promise<ProjectDetailResponse> {
  return request(`/projects/${encodeURIComponent(projectName)}`);
}

export function applyChange(projectName: string, prompt: string): Promise<ProjectActionResponse> {
  return request(`/projects/${encodeURIComponent(projectName)}/changes`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export function rebuildProject(projectName: string): Promise<ProjectActionResponse> {
  return request(`/projects/${encodeURIComponent(projectName)}/rebuild`, {
    method: 'POST',
  });
}

export function publishProject(projectName: string): Promise<ProjectActionResponse> {
  return request(`/projects/${encodeURIComponent(projectName)}/publish`, {
    method: 'POST',
  });
}

export function deleteProject(projectName: string): Promise<ProjectActionResponse> {
  return request(`/projects/${encodeURIComponent(projectName)}`, {
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
