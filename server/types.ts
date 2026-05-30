import type { RunnerBackendName, TaskRunnerName } from './runners.js';

export type { RunnerBackendName, TaskRunnerName } from './runners.js';

export type ProjectType = 'landing' | 'tool' | 'showcase' | 'game';

export type ProjectStatus =
  | 'draft'
  | 'generating'
  | 'build_failed'
  | 'preview_ready'
  | 'published'
  | 'publishing'
  | 'publish_failed'
  | 'deleted';

export type TaskType = 'create_project' | 'apply_change' | 'rebuild' | 'publish' | 'delete_project';

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export type RunnerSource = 'global' | 'project';

export type ReleaseKind = 'preview' | 'public';

export interface ProjectRecord {
  project_id: string;
  display_name: string;
  public_handle: string;
  pending_public_handle: string | null;
  pending_public_handle_set_at: string | null;
  type: ProjectType;
  title: string;
  prompt: string;
  status: ProjectStatus;
  source_root: string;
  preferred_runner: TaskRunnerName | null;
  preview_release_path: string | null;
  public_release_path: string | null;
  created_at: string;
  updated_at: string;
  last_built_at: string | null;
  last_published_at: string | null;
  deleted_at: string | null;
  latest_task_id: string | null;
}

export interface TaskRecord {
  id: string;
  project_id: string;
  type: TaskType;
  status: TaskStatus;
  prompt: string;
  started_at: string | null;
  finished_at: string | null;
  log_path: string;
  runner_name: TaskRunnerName | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReleaseRecord {
  id: string;
  project_id: string;
  kind: ReleaseKind;
  source: string;
  release_path: string;
  created_at: string;
  published_at: string | null;
  build_task_id: string | null;
  is_current_preview: number;
  is_current_public: number;
}

export interface ProjectView {
  projectId: string;
  displayName: string;
  publicHandle: string;
  pendingPublicHandle: string | null;
  pendingPublicHandleSetAt: string | null;
  type: ProjectType;
  title: string;
  prompt: string;
  status: ProjectStatus;
  preferredRunner: TaskRunnerName | null;
  effectiveRunner: TaskRunnerName;
  effectiveRunnerBackend: RunnerBackendName;
  runnerSource: RunnerSource;
  previewUrl: string;
  publicUrl: string;
  previewRoute: string;
  publicRoute: string;
  createdAt: string;
  updatedAt: string;
  lastBuiltAt: string | null;
  lastPublishedAt: string | null;
  deletedAt: string | null;
  latestTaskId: string | null;
  sourceRoot: string;
  previewReleasePath: string | null;
  publicReleasePath: string | null;
}

export interface TaskView {
  id: string;
  projectId: string;
  type: TaskType;
  status: TaskStatus;
  prompt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  logPath: string;
  runnerName: TaskRunnerName | null;
}

export interface ProjectMessageRecord {
  id: string;
  project_id: string;
  task_id: string | null;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  created_at: string;
}

export interface ProjectEventRecord {
  id: string;
  project_id: string;
  task_id: string | null;
  type: string;
  title: string;
  detail: string | null;
  data_json: string | null;
  created_at: string;
}

export interface ProjectMessageView {
  id: string;
  projectId: string;
  taskId: string | null;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: string;
}

export interface ProjectTaskActionResponse {
  kind: 'task';
  project: ProjectView;
  taskId: string;
}

export interface ProjectChatActionResponse {
  kind: 'chat';
  project: ProjectView;
  assistantMessage: ProjectMessageView;
}

export type ProjectActionResponse = ProjectTaskActionResponse | ProjectChatActionResponse;

export interface AppSettingsView {
  defaultRunner: TaskRunnerName;
  defaultRunnerBackend: RunnerBackendName;
}

export interface ProjectSettingsView {
  projectId: string;
  preferredRunner: TaskRunnerName | null;
  effectiveRunner: TaskRunnerName;
  effectiveRunnerBackend: RunnerBackendName;
  runnerSource: RunnerSource;
}

export interface ProjectAliasRecord {
  alias_handle: string;
  project_id: string;
  created_at: string;
}
