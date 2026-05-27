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

export interface ProjectView {
  projectId: string;
  displayName: string;
  publicHandle: string;
  type: ProjectType;
  title: string;
  prompt: string;
  status: ProjectStatus;
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
}

export interface ProjectMessageView {
  id: string;
  projectId: string;
  taskId: string | null;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: string;
}

export interface ProjectEventView {
  id: string;
  projectId: string;
  taskId: string | null;
  type: string;
  title: string;
  detail: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface ReleaseView {
  id: string;
  kind: 'preview' | 'public';
  source: string;
  releasePath: string;
  createdAt: string;
  publishedAt: string | null;
  buildTaskId: string | null;
  isCurrentPreview: boolean;
  isCurrentPublic: boolean;
}

export interface ProjectDetailResponse {
  project: ProjectView;
  tasks: TaskView[];
  messages: ProjectMessageView[];
  events: ProjectEventView[];
  releases: ReleaseView[];
}

export interface ProjectListResponse {
  projects: ProjectView[];
}

export interface ProjectActionResponse {
  project: ProjectView;
  taskId: string;
}
