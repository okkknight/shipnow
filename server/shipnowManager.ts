import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { ShipNowEnv } from './env.js';
import { ShipNowStore } from './db.js';
import type {
  ProjectEventRecord,
  ProjectMessageRecord,
  ProjectRecord,
  ProjectStatus,
  ProjectView,
  ProjectActionResponse,
  ReleaseKind,
  ReleaseRecord,
  TaskRecord,
  TaskType,
  TaskView,
} from './types.js';
import {
  buildConversationChatPrompt,
  buildConversationRouterPrompt,
  buildConversationTaskPrompt,
  parseConversationIntent,
  toConversationProjectContext,
  type ConversationSessionContext,
} from './conversationPrompts.js';
import {
  projectIdSchema,
  slugifyProjectName,
  validateProjectHandle,
} from './security.js';
import { taskRunnerBackend, taskRunnerSummary } from './runners.js';
import {
  copyDefaultTemplate,
  ensureWorkspaceRoots,
  prepareProjectWorkspace,
  projectPaths,
  publicSitePath,
  removeProjectWorkspace,
  injectBaseHref,
  updateCurrentReleaseLink,
  writeProjectConfig,
} from './storage.js';
import { runCommand } from './process.js';
import type { AppSettingsView, ProjectSettingsView, TaskRunnerName } from './types.js';
import { createTaskProgressEvent, projectTimelineBus } from './timelineBus.js';
import {
  buildTaskCompletionSummaryPrompt,
  normalizeTaskCompletionSummary,
  summarizeText,
} from './taskCompletionSummary.js';

interface EnqueueInput {
  projectId: string;
  type: TaskType;
  prompt: string;
  autoDrain?: boolean;
}

interface CreateProjectInput {
  prompt: string;
}

interface RenameProjectInput {
  projectId: string;
  displayName: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function displayUrl(baseUrl: string, pathPart: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${pathPart.replace(/^\/+/, '')}`;
}

function basePathFromUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('/')) {
    return trimmed.replace(/\/+$/, '');
  }

  try {
    return new URL(trimmed).pathname.replace(/\/+$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function previewReleaseBaseHref(previewBaseUrl: string, publicHandle: string): string {
  const basePath = basePathFromUrl(previewBaseUrl);
  return `${basePath}/${publicHandle}/`;
}

function statusText(status: string): string {
  return status.replace(/_/g, ' ');
}

function taskTypeText(type: TaskType): string {
  switch (type) {
    case 'create_project':
      return '创建项目';
    case 'apply_change':
      return '修改项目';
    case 'rebuild':
      return '重新构建';
    case 'publish':
      return '发布项目';
    case 'delete_project':
      return '删除项目';
    default:
      return statusText(type);
  }
}

interface ConversationDetailSnapshot {
  project: { status: string };
  tasks: Array<Pick<TaskView, 'type' | 'status' | 'errorMessage'>>;
  events: Array<Pick<ProjectEventRecord, 'title' | 'detail'>>;
  messages: Array<{
    role: ProjectMessageRecord['role'];
    taskId: string | null;
    content: string;
  }>;
}

function buildConversationSessionContext(detail: ConversationDetailSnapshot): ConversationSessionContext {
  const latestTask = detail.tasks[0] ?? null;
  const recentEvents = detail.events.slice(-3).map((event) => {
    const description = event.detail?.trim();
    return description ? `${event.title}：${summarizeText(description)}` : event.title;
  });
  const recentConversationTrail = detail.messages
    .filter((message) => message.role === 'user' || (message.role === 'assistant' && message.taskId === null))
    .slice(-4)
    .map((message) => `${message.role === 'user' ? '用户' : '助手'}：${summarizeText(message.content, 80)}`);

  return {
    projectStatus: statusText(detail.project.status),
    latestTaskSummary: latestTask
      ? [
          `${taskTypeText(latestTask.type)} · ${statusText(latestTask.status)}`,
          latestTask.errorMessage ? latestTask.errorMessage : null,
        ]
          .filter((value): value is string => Boolean(value))
          .join(' · ')
      : null,
    recentEventSummaries: recentEvents,
    recentConversationTrail,
  };
}

function randomHandleSuffix(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(4);
  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join('');
}

function isCodeTask(type: TaskType): boolean {
  return type === 'create_project' || type === 'apply_change';
}

function buildTaskQueueDetail(): string {
  return '我会先准备工作区，再继续执行这次操作。';
}

export class ShipNowManager {
  private readonly store: ShipNowStore;

  private readonly env: ShipNowEnv;

  private runningTaskId: string | null = null;

  private drainScheduled = false;

  constructor(store: ShipNowStore, env: ShipNowEnv) {
    this.store = store;
    this.env = env;
  }

  async initialize(): Promise<void> {
    await ensureWorkspaceRoots(this.env);
    await this.recoverInterruptedDeleteTasks();
    await this.resumePendingTasks();
  }

  async shutdown(): Promise<void> {
    // no-op for now
  }

  listProjects(): ProjectView[] {
    return this.store.listProjects().map((project) => this.toProjectView(project));
  }

  getProject(projectId: string): ProjectView | null {
    const project = this.store.getProjectById(projectIdSchema.parse(projectId));
    return project ? this.toProjectView(project) : null;
  }

  resolveProjectHandle(handle: string): { project: ProjectView; redirected: boolean } | null {
    const resolution = this.store.resolveProjectHandle(handle);
    if (!resolution || resolution.project.status === 'deleted') {
      return null;
    }
    return {
      project: this.toProjectView(resolution.project),
      redirected: resolution.redirected,
    };
  }

  listTasks(projectId: string): TaskView[] {
    return this.store.listTasksForProject(projectIdSchema.parse(projectId)).map((task) => this.toTaskView(task));
  }

  getTask(taskId: string): TaskView | null {
    const task = this.store.getTask(taskId);
    return task ? this.toTaskView(task) : null;
  }

  getAppSettings(): AppSettingsView {
    return this.store.getAppSettings();
  }

  updateAppSettings(defaultRunner: TaskRunnerName): AppSettingsView {
    return this.store.setDefaultRunnerPreference(defaultRunner);
  }

  getProjectSettings(projectId: string): ProjectSettingsView | null {
    return this.store.getProjectRunnerSettings(projectId);
  }

  updateProjectSettings(projectId: string, preferredRunner: TaskRunnerName | null): ProjectSettingsView | null {
    const next = this.store.setProjectRunnerPreference(projectId, preferredRunner);
    return next ? this.store.getProjectRunnerSettings(projectId) : null;
  }

  getProjectDetail(projectId: string): {
    project: ProjectView;
    tasks: TaskView[];
    messages: Array<{
      id: string;
      projectId: string;
      taskId: string | null;
      role: ProjectMessageRecord['role'];
      content: string;
      createdAt: string;
    }>;
    events: Array<{
      id: string;
      projectId: string;
      taskId: string | null;
      type: string;
      title: string;
      detail: string | null;
      data: Record<string, unknown> | null;
      createdAt: string;
    }>;
    releases: Array<{
      id: string;
      kind: ReleaseKind;
      source: string;
      releasePath: string;
      createdAt: string;
      publishedAt: string | null;
      buildTaskId: string | null;
      isCurrentPreview: boolean;
      isCurrentPublic: boolean;
    }>;
  } {
    const project = this.requireProject(projectId);
    return {
      project: this.toProjectView(project),
      tasks: this.listTasks(project.project_id),
      messages: this.store.listMessages(project.project_id).map((message) => this.toMessageView(message)),
      events: this.store.listEvents(project.project_id).map((event) => this.toEventView(event)),
      releases: this.store.listReleases(project.project_id).map((release) => ({
        id: release.id,
        kind: release.kind,
        source: release.source,
        releasePath: release.release_path,
        createdAt: release.created_at,
        publishedAt: release.published_at,
        buildTaskId: release.build_task_id,
        isCurrentPreview: release.is_current_preview === 1,
        isCurrentPublic: release.is_current_public === 1,
      })),
    };
  }

  getTaskLog(taskId: string): string {
    return this.store.getTaskLogText(taskId);
  }

  private resolveEffectiveRunner(project: ProjectRecord): TaskRunnerName {
    return project.preferred_runner ?? this.store.getAppSettings().defaultRunner;
  }

  async createProject(input: CreateProjectInput): Promise<{ project: ProjectView; taskId: string }> {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new Error('Project prompt is required.');
    }

    const projectId = this.generateProjectId();
    const publicHandle = await this.generateProjectHandle();
    const displayName = publicHandle;
    const title = prompt;
    const type = 'landing';
    const paths = await prepareProjectWorkspace(this.env, projectId);

    const project = this.store.createProject({
      projectId,
      displayName,
      publicHandle,
      type,
      title,
      prompt,
      sourceRoot: paths.sourceRoot,
      status: 'generating',
    });
    const runnerName = this.resolveEffectiveRunner(project);

    this.store.createMessage({
      projectId,
      role: 'user',
      content: prompt,
    });
    this.store.createEvent({
      projectId,
      type: 'project_created',
      title: '项目已创建',
      detail: `已生成公开站点ID ${displayName}。`,
      data: { projectId, displayName, publicHandle, type },
    });
    const creationDetail = this.getProjectDetail(projectId);

    const task = await this.enqueueTask({
      projectId,
      type: 'create_project',
      prompt: buildConversationTaskPrompt(
        toConversationProjectContext(project),
        prompt,
        buildConversationSessionContext(creationDetail)
      ),
      runnerName,
      autoDrain: false,
    });
    this.store.updateProjectStatus(projectId, 'generating');
    this.store.updateProjectTaskLink(projectId, task.id);
    this.store.createEvent({
      projectId,
      taskId: task.id,
      type: 'task_queued',
      title: '创建任务已排队',
      detail: buildTaskQueueDetail(),
      data: { taskId: task.id, taskType: task.type },
    });
    this.scheduleDrain();
    return { project: this.toProjectView(this.store.getProjectById(projectId) ?? project), taskId: task.id };
  }

  async applyChange(projectId: string, prompt: string): Promise<ProjectActionResponse> {
    const project = this.requireActiveProject(projectId);
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      throw new Error('Enter a change request first.');
    }
    this.store.createMessage({
      projectId: project.project_id,
      role: 'user',
      content: normalizedPrompt,
    });
    const runnerName = this.resolveEffectiveRunner(project);
    const conversationContext = toConversationProjectContext(project);
    const conversationDetail = this.getProjectDetail(project.project_id);
    const conversationSession = buildConversationSessionContext(conversationDetail);
    const intent = parseConversationIntent(
      await this.runRunnerText(
        runnerName,
        buildConversationRouterPrompt(conversationContext, normalizedPrompt),
        project.source_root,
        this.env.taskTimeoutSeconds * 1000
      )
    );
    if (intent === 'chat') {
      const assistantReply = this.normalizeAssistantReply(
        await this.runRunnerText(
          runnerName,
          buildConversationChatPrompt(conversationContext, normalizedPrompt, conversationSession),
          project.source_root,
          this.env.taskTimeoutSeconds * 1000
        )
      );
      const assistantMessage = this.store.createMessage({
        projectId: project.project_id,
        role: 'assistant',
        content: assistantReply,
      });
      return {
        kind: 'chat',
        project: this.toProjectView(this.requireProject(project.project_id)),
        assistantMessage: this.toMessageView(assistantMessage),
      };
    }
    this.store.createEvent({
      projectId: project.project_id,
      type: 'change_requested',
      title: '收到修改请求',
      detail: normalizedPrompt,
    });
    const task = await this.enqueueTask({
      projectId: project.project_id,
      type: 'apply_change',
      prompt: buildConversationTaskPrompt(conversationContext, normalizedPrompt, conversationSession),
      runnerName,
      autoDrain: false,
    });
    this.store.updateProjectStatus(project.project_id, 'generating');
    this.store.createEvent({
      projectId: project.project_id,
      taskId: task.id,
      type: 'task_queued',
      title: '修改任务已排队',
      detail: '我会在当前工作区整理好环境，再继续执行这次修改。',
      data: { taskId: task.id, taskType: task.type },
    });
    this.scheduleDrain();
    return { kind: 'task', project: this.toProjectView(this.requireProject(project.project_id)), taskId: task.id };
  }

  async rebuild(projectId: string): Promise<{ project: ProjectView; taskId: string }> {
    const project = this.requireActiveProject(projectId);
    this.store.createEvent({
      projectId: project.project_id,
      type: 'rebuild_requested',
      title: '开始重新构建',
      detail: '我不会修改内容，只会重新执行构建链路。',
    });
    const task = await this.enqueueTask({
      projectId: project.project_id,
      type: 'rebuild',
      prompt: 'Rebuild the current project without changing the intended product direction.',
      autoDrain: false,
    });
    this.store.updateProjectStatus(project.project_id, 'generating');
    this.scheduleDrain();
    return { project: this.toProjectView(this.requireProject(project.project_id)), taskId: task.id };
  }

  async publish(projectId: string): Promise<{ project: ProjectView; taskId: string }> {
    const project = this.requireActiveProject(projectId);
    const targetHandle = project.pending_public_handle ?? project.public_handle;
    const sourceHandle = project.pending_public_handle && project.pending_public_handle !== project.public_handle
      ? project.public_handle
      : null;
    this.store.createMessage({
      projectId: project.project_id,
      role: 'user',
      content: '请帮我发布到正式站点。',
    });
    this.store.createEvent({
      projectId: project.project_id,
      type: 'publish_requested',
      title: '开始发布',
      detail: sourceHandle
        ? `公开地址将从 ${sourceHandle} 切换到 ${targetHandle}。`
        : `公开地址将切换到 ${targetHandle}。`,
      data: { publicHandle: project.public_handle, targetPublicHandle: targetHandle },
    });
    const task = await this.enqueueTask({
      projectId: project.project_id,
      type: 'publish',
      prompt: 'Publish the latest successful preview release to the public release.',
      autoDrain: false,
    });
    this.store.updateProjectStatus(project.project_id, 'publishing');
    this.scheduleDrain();
    return { project: this.toProjectView(this.requireProject(project.project_id)), taskId: task.id };
  }

  async renameProject(input: RenameProjectInput): Promise<ProjectView> {
    const projectId = projectIdSchema.parse(input.projectId);
    const project = this.requireProject(projectId);
    const normalized = validateProjectHandle(slugifyProjectName(input.displayName));
    const currentCanonical = project.pending_public_handle ?? project.public_handle;
    if (normalized === currentCanonical && normalized === project.display_name) {
      return this.toProjectView(project);
    }
    if (normalized !== project.public_handle && this.store.handleExists(normalized, projectId)) {
      throw new Error(`Project handle ${normalized} already exists.`);
    }
    const next = this.store.renameProject(projectId, normalized, normalized);
    if (!next) {
      throw new Error(`Project ${projectId} not found.`);
    }
    if (next.pending_public_handle) {
      this.store.createEvent({
        projectId,
        type: 'project_rename_pending',
        title: '项目名称已更新',
        detail: `新公开地址 ${next.pending_public_handle} 将在发布后生效。`,
        data: {
          displayName: next.display_name,
          publicHandle: next.public_handle,
          pendingPublicHandle: next.pending_public_handle,
        },
      });
    } else {
      this.store.createEvent({
        projectId,
        type: 'project_rename_cleared',
        title: '项目名称已恢复',
        detail: `已恢复为当前线上地址 ${next.public_handle}。`,
        data: {
          displayName: next.display_name,
          publicHandle: next.public_handle,
          pendingPublicHandle: null,
        },
      });
    }
    return this.toProjectView(next);
  }

  async deleteProject(projectId: string): Promise<{ project: ProjectView; taskId: string }> {
    const project = this.requireProject(projectId);
    const task = await this.enqueueTask({
      projectId: project.project_id,
      type: 'delete_project',
      prompt: 'Delete the project and remove its workspace artifacts.',
      autoDrain: false,
    });
    this.store.createEvent({
      projectId: project.project_id,
      type: 'delete_requested',
      title: '请求删除项目',
      detail: '我会在任务执行后移除工作区。',
    });
    this.scheduleDrain();
    return { project: this.toProjectView(project), taskId: task.id };
  }

  private generateProjectId(): string {
    return `proj_${randomBytes(6).toString('hex')}`;
  }

  private async generateProjectHandle(): Promise<string> {
    for (let i = 0; i < 256; i += 1) {
      const candidate = `untitled-${randomHandleSuffix()}`;
      if (!this.store.handleExists(candidate)) {
        return candidate;
      }
    }
    throw new Error('Unable to generate a unique project handle.');
  }

  private requireProject(projectId: string): ProjectRecord {
    const project = this.store.getProjectById(projectIdSchema.parse(projectId));
    if (!project) {
      throw new Error(`Project ${projectId} not found.`);
    }
    return project;
  }

  private requireActiveProject(projectId: string): ProjectRecord {
    const project = this.requireProject(projectId);
    if (project.status === 'deleted') {
      throw new Error(`Project ${projectId} has been deleted.`);
    }
    return project;
  }

  private toProjectView(project: ProjectRecord): ProjectView {
    const effectiveRunner = this.resolveEffectiveRunner(project);
    return {
      projectId: project.project_id,
      displayName: project.display_name,
      publicHandle: project.public_handle,
      pendingPublicHandle: project.pending_public_handle,
      pendingPublicHandleSetAt: project.pending_public_handle_set_at,
      type: project.type,
      title: project.title,
      prompt: project.prompt,
      status: project.status,
      preferredRunner: project.preferred_runner,
      effectiveRunner,
      effectiveRunnerBackend: taskRunnerBackend(effectiveRunner),
      runnerSource: project.preferred_runner ? 'project' : 'global',
      previewUrl: displayUrl(this.env.previewBaseUrl, project.public_handle),
      publicUrl: displayUrl(this.env.publicBaseUrl, project.public_handle),
      previewRoute: displayUrl(this.env.previewBaseUrl, project.public_handle),
      publicRoute: displayUrl(this.env.publicBaseUrl, project.public_handle),
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      lastBuiltAt: project.last_built_at,
      lastPublishedAt: project.last_published_at,
      deletedAt: project.deleted_at,
      latestTaskId: project.latest_task_id,
      sourceRoot: project.source_root,
      previewReleasePath: project.preview_release_path,
      publicReleasePath: project.public_release_path,
    };
  }

  private toTaskView(task: TaskRecord): TaskView {
    return {
      id: task.id,
      projectId: task.project_id,
      type: task.type,
      status: task.status,
      prompt: task.prompt,
      startedAt: task.started_at,
      finishedAt: task.finished_at,
      errorMessage: task.error_message,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      logPath: task.log_path,
      runnerName: task.runner_name,
    };
  }

  private toMessageView(message: ProjectMessageRecord): {
    id: string;
    projectId: string;
    taskId: string | null;
    role: ProjectMessageRecord['role'];
    content: string;
    createdAt: string;
  } {
    return {
      id: message.id,
      projectId: message.project_id,
      taskId: message.task_id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
    };
  }

  private toEventView(event: ProjectEventRecord & { data: Record<string, unknown> | null }): {
    id: string;
    projectId: string;
    taskId: string | null;
    type: string;
    title: string;
    detail: string | null;
    data: Record<string, unknown> | null;
    createdAt: string;
  } {
    return {
      id: event.id,
      projectId: event.project_id,
      taskId: event.task_id,
      type: event.type,
      title: event.title,
      detail: event.detail,
      data: event.data,
      createdAt: event.created_at,
    };
  }

  private async enqueueTask(input: EnqueueInput & { runnerName?: TaskRunnerName | null }): Promise<TaskRecord> {
    const project = this.requireProject(input.projectId);
    if (this.store.activeTaskForProject(project.project_id)) {
      throw new Error(`Project ${project.display_name} already has a running or pending task.`);
    }
    const task = this.store.createTask({
      projectId: project.project_id,
      type: input.type,
      prompt: input.prompt,
      runnerName: input.runnerName ?? null,
      logPath: projectPaths(this.env, project.project_id).logPath,
    });
    this.store.updateProjectTaskLink(project.project_id, task.id);
    const runnerSummary = input.runnerName ? ` using ${taskRunnerSummary(input.runnerName)}` : '';
    await this.store.appendTaskLogAsync(task.id, `Queued task ${task.type} for project ${project.display_name}${runnerSummary}.`);
    projectTimelineBus.publish(
      createTaskProgressEvent({
        projectId: project.project_id,
        taskId: task.id,
        taskType: task.type,
        phase: 'queued',
        runnerName: input.runnerName ?? this.resolveEffectiveRunner(project),
      })
    );
    if (input.autoDrain !== false) {
      this.scheduleDrain();
    }
    return task;
  }

  private scheduleDrain(): void {
    if (this.drainScheduled) {
      return;
    }
    this.drainScheduled = true;
    queueMicrotask(() => {
      this.drainScheduled = false;
      void this.drain();
    });
  }

  private async resumePendingTasks(): Promise<void> {
    if (this.runningTaskId) {
      return;
    }
    this.scheduleDrain();
  }

  private async recoverInterruptedDeleteTasks(): Promise<void> {
    const interruptedDeletes = this.store
      .listRunningTasks()
      .filter((task) => task.type === 'delete_project');

    for (const task of interruptedDeletes) {
      this.store.setTaskStatus(task.id, 'pending', {
        started_at: null,
        finished_at: null,
        error_message: null,
      });
      await this.store.appendTaskLogAsync(task.id, 'Recovered interrupted delete task after restart.');
    }
  }

  private async drain(): Promise<void> {
    if (this.runningTaskId) {
      return;
    }

    const next = this.store.listPendingTasks()[0];
    if (!next) {
      return;
    }

    this.runningTaskId = next.id;
    try {
      await this.executeTask(next);
    } finally {
      this.runningTaskId = null;
      const pending = this.store.listPendingTasks();
      if (pending.length > 0) {
        this.scheduleDrain();
      }
    }
  }

  private async executeTask(task: TaskRecord): Promise<void> {
    const project = this.requireProject(task.project_id);
    const startedAt = nowIso();
    this.store.setTaskStatus(task.id, 'running', { started_at: startedAt });
    this.publishTaskProgress(project, task, 'starting', { createdAt: startedAt });
    this.store.createEvent({
      projectId: project.project_id,
      taskId: task.id,
      type: 'task_started',
      title: '任务开始执行',
      detail: `${taskTypeText(task.type)}正在执行。`,
      data: { taskId: task.id, taskType: task.type },
    });
    await this.store.appendTaskLogAsync(task.id, `Starting ${task.type} for ${project.display_name}.`);
    this.publishTaskProgress(project, task, 'running');

    const timeoutMs = this.env.taskTimeoutSeconds * 1000;

    try {
      switch (task.type) {
        case 'create_project':
          await this.executeCreateProject(project, task, timeoutMs);
          break;
        case 'apply_change':
          await this.executeApplyChange(project, task, timeoutMs);
          break;
        case 'rebuild':
          await this.executeRebuild(project, task, timeoutMs);
          break;
        case 'publish':
          await this.executePublish(project, task);
          break;
        case 'delete_project':
          await this.executeDelete(project, task);
          break;
        default:
          throw new Error(`Unsupported task type ${task.type}`);
      }
      this.store.setTaskStatus(task.id, 'success', { finished_at: nowIso() });
      this.publishTaskProgress(project, task, 'completed');
      const summary = await this.generateTaskCompletionSummary(project, task);
      this.store.createEvent({
        projectId: project.project_id,
        taskId: task.id,
        type: 'task_completed',
        title: '任务执行完成',
        detail: summary.summaryText,
        data: {
          taskId: task.id,
          taskType: task.type,
          runnerName: task.runner_name ?? this.resolveEffectiveRunner(project),
          summary: summary.summaryText,
          summaryRawOutput: summary.rawOutput,
          summarySource: summary.summarySource,
        },
      });
      await this.store.appendTaskLogAsync(task.id, `Task ${task.id} completed successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store.appendTaskLogAsync(task.id, `Task ${task.id} failed: ${message}`);
      this.store.setTaskStatus(task.id, 'failed', { finished_at: nowIso(), error_message: message });
      this.publishTaskProgress(project, task, 'failed', { errorMessage: message });
      this.store.createEvent({
        projectId: project.project_id,
        taskId: task.id,
        type: 'task_failed',
        title: '任务执行失败',
        detail: message,
        data: { taskId: task.id, taskType: task.type, error: message },
      });
      if (task.type === 'publish') {
        this.store.updateProjectStatus(project.project_id, 'publish_failed');
      } else if (task.type !== 'delete_project') {
        this.store.updateProjectStatus(project.project_id, 'build_failed');
      }
    }
  }

  private async generateTaskCompletionSummary(
    project: ProjectRecord,
    task: TaskRecord
  ): Promise<{
    summaryText: string;
    rawOutput: string | null;
    summarySource: 'llm' | 'fallback';
  }> {
    const runnerName = task.runner_name ?? this.resolveEffectiveRunner(project);
    const summaryTimeoutMs = Math.min(this.env.taskTimeoutSeconds * 1000, 45_000);
    const fallbackSummary = `任务 ${task.id} 已成功完成。`;
    const logTail = this.store.getTaskLogText(task.id).slice(-12_000);

    try {
      const rawOutput = await this.runRunnerText(
        runnerName,
        buildTaskCompletionSummaryPrompt({
          runnerName,
          taskId: task.id,
          taskType: task.type,
          projectDisplayName: project.display_name,
          taskPrompt: task.prompt,
          taskLogTail: logTail,
          finalOutcome: 'success',
        }),
        project.source_root,
        summaryTimeoutMs
      );
      const summaryText = normalizeTaskCompletionSummary(rawOutput);
      if (summaryText) {
        return {
          summaryText,
          rawOutput,
          summarySource: 'llm',
        };
      }

      return {
        summaryText: fallbackSummary,
        rawOutput,
        summarySource: 'fallback',
      };
    } catch (error) {
      await this.store.appendTaskLogAsync(task.id, `Summary generation failed: ${String(error)}`);
      return {
        summaryText: fallbackSummary,
        rawOutput: null,
        summarySource: 'fallback',
      };
    }
  }

  private async executeCreateProject(project: ProjectRecord, task: TaskRecord, timeoutMs: number): Promise<void> {
    const paths = await prepareProjectWorkspace(this.env, project.project_id);
    await copyDefaultTemplate(this.env, paths);
    await writeProjectConfig(paths, {
      projectId: project.project_id,
      displayName: project.display_name,
      publicHandle: project.public_handle,
      title: project.title,
      prompt: project.prompt,
    });
    await this.ensureGitRepository(paths.sourceRoot, task.id);
    await this.store.appendTaskLogAsync(task.id, `Copied template into ${paths.sourceRoot}.`);
    const lockfilePath = resolve(paths.sourceRoot, 'pnpm-lock.yaml');
    const installArgs = existsSync(lockfilePath)
      ? ['install', '--frozen-lockfile']
      : ['install', '--no-frozen-lockfile'];
    await this.store.appendTaskLogAsync(task.id, `Installing project dependencies with pnpm ${installArgs.join(' ')}.`);
    const install = await runCommand({
      command: 'pnpm',
      args: installArgs,
      cwd: paths.sourceRoot,
      timeoutMs,
      onStdout: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
      onStderr: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
    });
    if (install.code !== 0) {
      throw new Error(`pnpm install failed with exit code ${install.code}.`);
    }

    const runnerName = task.runner_name ?? this.resolveEffectiveRunner(project);
    await this.store.appendTaskLogAsync(task.id, `Running ${taskRunnerSummary(runnerName)} in ${paths.sourceRoot}.`);
    await this.runTaskWithRunner(runnerName, task, project.prompt, paths.sourceRoot, timeoutMs);

    this.publishTaskProgress(project, task, 'building', { runnerName });
    await this.store.appendTaskLogAsync(task.id, 'Building project with pnpm build.');
    await this.runBuild(task, paths.sourceRoot, timeoutMs);
    const release = await this.publishPreviewRelease(project, task.id, paths.sourceRoot);
    this.store.updateProjectBuildState(project.project_id, release.release_path, 'preview_ready');
    this.store.updateProjectTaskLink(project.project_id, task.id);
    this.store.createEvent({
      projectId: project.project_id,
      taskId: task.id,
      type: 'preview_ready',
      title: '预览已就绪',
      detail: '最新构建已发布到预览目录。',
      data: { previewReleasePath: release.release_path },
    });
  }

  private async executeApplyChange(project: ProjectRecord, task: TaskRecord, timeoutMs: number): Promise<void> {
    const paths = projectPaths(this.env, project.project_id);
    if (!existsSync(paths.sourceRoot)) {
      throw new Error(`Project source directory missing: ${paths.sourceRoot}`);
    }
    this.store.updateProjectStatus(project.project_id, 'generating');
    await this.ensureGitRepository(paths.sourceRoot, task.id);
    const runnerName = task.runner_name ?? this.resolveEffectiveRunner(project);
    await this.store.appendTaskLogAsync(task.id, `Applying ${taskRunnerSummary(runnerName)} changes in ${paths.sourceRoot}.`);
    await this.runTaskWithRunner(runnerName, task, task.prompt, paths.sourceRoot, timeoutMs);
    this.publishTaskProgress(project, task, 'building', { runnerName });
    await this.store.appendTaskLogAsync(task.id, 'Building project with pnpm build.');
    await this.runBuild(task, paths.sourceRoot, timeoutMs);
    const release = await this.publishPreviewRelease(project, task.id, paths.sourceRoot);
    this.store.updateProjectBuildState(project.project_id, release.release_path, 'preview_ready');
    this.store.createEvent({
      projectId: project.project_id,
      taskId: task.id,
      type: 'preview_refreshed',
      title: '预览已更新',
      detail: '修改结果已经发布到预览目录。',
      data: { previewReleasePath: release.release_path },
    });
  }

  private async executeRebuild(project: ProjectRecord, task: TaskRecord, timeoutMs: number): Promise<void> {
    const paths = projectPaths(this.env, project.project_id);
    if (!existsSync(paths.sourceRoot)) {
      throw new Error(`Project source directory missing: ${paths.sourceRoot}`);
    }
    this.store.updateProjectStatus(project.project_id, 'generating');
    await this.ensureGitRepository(paths.sourceRoot, task.id);
    await this.store.appendTaskLogAsync(task.id, `Rebuilding project in ${paths.sourceRoot}.`);
    this.publishTaskProgress(project, task, 'building');
    await this.runBuild(task, paths.sourceRoot, timeoutMs);
    const release = await this.publishPreviewRelease(project, task.id, paths.sourceRoot);
    this.store.updateProjectBuildState(project.project_id, release.release_path, 'preview_ready');
    this.store.createEvent({
      projectId: project.project_id,
      taskId: task.id,
      type: 'preview_refreshed',
      title: '重新构建完成',
      detail: '最新构建已发布到预览目录。',
      data: { previewReleasePath: release.release_path },
    });
  }

  private async executePublish(project: ProjectRecord, task: TaskRecord): Promise<void> {
    const previewRelease = this.store.getCurrentRelease(project.project_id, 'preview') ?? this.store.getLatestRelease(project.project_id, 'preview');
    if (!previewRelease) {
      throw new Error(`No successful preview release found for ${project.display_name}.`);
    }
    const paths = projectPaths(this.env, project.project_id);
    const finalHandle = project.pending_public_handle ?? project.public_handle;
    const handleCutover = project.pending_public_handle !== null && project.pending_public_handle !== project.public_handle;
    const publicRoot = publicSitePath(this.env, finalHandle);
    const previousPublicRoot = handleCutover ? publicSitePath(this.env, project.public_handle) : null;
    await mkdir(paths.publicReleasesRoot, { recursive: true });
    const releasePath = resolve(paths.publicReleasesRoot, `${previewRelease.id}-${randomBytes(4).toString('hex')}`);
    await this.copyDirectory(previewRelease.release_path, releasePath);
    await injectBaseHref(resolve(releasePath, 'index.html'), `/${finalHandle}/`);
    await rm(resolve(paths.projectRoot, 'index.html'), { recursive: true, force: true });
    await rm(resolve(paths.projectRoot, 'assets'), { recursive: true, force: true });
    await rm(resolve(paths.projectRoot, 'current-public'), { recursive: true, force: true });
    await rm(publicRoot, { recursive: true, force: true });
    await this.copyDirectory(releasePath, publicRoot);
    const publicRelease = this.store.createRelease({
      projectId: project.project_id,
      kind: 'public',
      source: previewRelease.release_path,
      releasePath,
      buildTaskId: previewRelease.build_task_id,
      publishedAt: nowIso(),
      current: true,
    });
    this.store.updateProjectPublishState(
      project.project_id,
      publicRoot,
      'published',
      nowIso(),
      handleCutover
        ? {
            publicHandle: finalHandle,
            pendingPublicHandle: null,
            pendingPublicHandleSetAt: null,
          }
        : {}
    );
    if (handleCutover) {
      await rm(previousPublicRoot!, { recursive: true, force: true });
      this.store.createEvent({
        projectId: project.project_id,
        taskId: task.id,
        type: 'project_rename_applied',
        title: '重命名已生效',
        detail: `公开地址已切换到 ${finalHandle}。`,
        data: {
          displayName: project.display_name,
          publicHandle: finalHandle,
        },
      });
    }
    this.store.setTaskStatus(task.id, 'success', { finished_at: nowIso() });
    this.store.createEvent({
      projectId: project.project_id,
      taskId: task.id,
      type: 'published',
      title: '发布成功',
      detail: `公开地址已切换到 ${finalHandle}。`,
      data: { publicHandle: finalHandle, publicReleasePath: publicRoot },
    });
    await this.store.appendTaskLogAsync(task.id, `Published ${project.display_name} to ${publicRoot}.`);
  }

  private async executeDelete(project: ProjectRecord, task: TaskRecord): Promise<void> {
    const paths = projectPaths(this.env, project.project_id);
    await removeProjectWorkspace(this.env, paths, project.public_handle);
    this.store.markProjectDeleted(project.project_id);
    this.store.createEvent({
      projectId: project.project_id,
      taskId: task.id,
      type: 'deleted',
      title: '项目已删除',
      detail: '工作区和发布目录已清理。',
    });
    await this.store.appendTaskLogAsync(task.id, `Deleted workspace for ${project.display_name}.`);
  }

  private async publishPreviewRelease(project: ProjectRecord, taskId: string, sourceRoot: string): Promise<{ id: string; release_path: string }> {
    const paths = projectPaths(this.env, project.project_id);
    const distPath = resolve(sourceRoot, 'dist');
    if (!existsSync(distPath)) {
      throw new Error(`Missing dist directory after build: ${distPath}`);
    }
    const releasePath = resolve(paths.previewReleasesRoot, `${taskId}-${randomBytes(4).toString('hex')}`);
    await this.copyDirectory(distPath, releasePath);
    await injectBaseHref(resolve(releasePath, 'index.html'), previewReleaseBaseHref(this.env.previewBaseUrl, project.public_handle));
    await updateCurrentReleaseLink(releasePath, paths.previewCurrentRoot);
    const release = this.store.createRelease({
      projectId: project.project_id,
      kind: 'preview',
      source: sourceRoot,
      releasePath,
      buildTaskId: taskId,
      current: true,
    });
    return { id: release.id, release_path: release.release_path };
  }

  private async runBuild(task: TaskRecord, cwd: string, timeoutMs: number): Promise<void> {
    const buildResult = await runCommand({
      command: 'pnpm',
      args: ['build'],
      cwd,
      timeoutMs,
      onStdout: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
      onStderr: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
    });
    if (buildResult.code !== 0) {
      throw new Error(`pnpm build failed with exit code ${buildResult.code}.`);
    }
  }

  private publishTaskProgress(
    project: ProjectRecord,
    task: Pick<TaskRecord, 'id' | 'type' | 'runner_name'>,
    phase: 'queued' | 'starting' | 'running' | 'building' | 'completed' | 'failed',
    options: { createdAt?: string; runnerName?: TaskRunnerName | null; errorMessage?: string | null } = {}
  ): void {
    projectTimelineBus.publish(
      createTaskProgressEvent({
        projectId: project.project_id,
        taskId: task.id,
        taskType: task.type,
        phase,
        runnerName: options.runnerName ?? task.runner_name ?? this.resolveEffectiveRunner(project),
        createdAt: options.createdAt,
        errorMessage: options.errorMessage,
      })
    );
  }

  private async ensureGitRepository(cwd: string, taskId: string): Promise<void> {
    if (existsSync(resolve(cwd, '.git'))) {
      return;
    }

    await this.store.appendTaskLogAsync(taskId, `Initializing git repository in ${cwd}.`);
    const result = await runCommand({
      command: 'git',
      args: ['init'],
      cwd,
      timeoutMs: 30_000,
      onStdout: async (chunk) => this.store.appendTaskLogAsync(taskId, chunk.trimEnd()),
      onStderr: async (chunk) => this.store.appendTaskLogAsync(taskId, chunk.trimEnd()),
    });

    if (result.code !== 0) {
      throw new Error(`git init failed with exit code ${result.code}.`);
    }
  }

  private async runTaskWithRunner(
    runnerName: TaskRunnerName,
    task: TaskRecord,
    prompt: string,
    cwd: string,
    timeoutMs: number
  ): Promise<void> {
    switch (runnerName) {
      case 'codex':
        await this.runCodex(task, prompt, cwd, timeoutMs);
        return;
      case 'claude-code':
        await this.runClaudeCode(task, prompt, cwd, timeoutMs);
        return;
      default:
        throw new Error(`Unsupported task runner ${runnerName}.`);
    }
  }

  private normalizeAssistantReply(reply: string): string {
    const trimmed = reply.trim();
    if (!trimmed) {
      return '我已经看过这个请求了，但这次没有生成有效回复。';
    }
    return trimmed;
  }

  private async runRunnerText(
    runnerName: TaskRunnerName,
    prompt: string,
    cwd: string,
    timeoutMs: number
  ): Promise<string> {
    let stdout = '';
    let stderr = '';

    switch (runnerName) {
      case 'codex': {
        const result = await runCommand({
          command: this.env.codexBin,
          args: ['exec', '--full-auto', '--skip-git-repo-check', '--cd', cwd, prompt],
          cwd,
          timeoutMs,
          onStdout: async (chunk) => {
            stdout += chunk;
          },
          onStderr: async (chunk) => {
            stderr += chunk;
          },
        });
        if (result.code !== 0) {
          throw new Error(`Codex failed with exit code ${result.code}.`);
        }
        break;
      }
      case 'claude-code': {
        if (!this.env.claudeCodeAnthropicApiKey) {
          throw new Error('Claude Code DeepSeek API key is not configured.');
        }

        const result = await runCommand({
          command: this.env.claudeCodeBin,
          args: [
            '-p',
            '--output-format',
            'text',
            '--model',
            this.env.claudeCodeModel,
          '--max-turns',
          'max',
            '--dangerously-skip-permissions',
            prompt,
          ],
          cwd,
          timeoutMs,
          env: {
            ANTHROPIC_BASE_URL: this.env.claudeCodeAnthropicBaseUrl,
            ANTHROPIC_API_KEY: this.env.claudeCodeAnthropicApiKey,
            ANTHROPIC_MODEL: this.env.claudeCodeModel,
          },
          onStdout: async (chunk) => {
            stdout += chunk;
          },
          onStderr: async (chunk) => {
            stderr += chunk;
          },
        });
        if (result.code !== 0) {
          throw new Error(`Claude Code failed with exit code ${result.code}.`);
        }
        break;
      }
      default:
        throw new Error(`Unsupported task runner ${runnerName}.`);
    }

    return stdout.trim() || stderr.trim();
  }

  private async runCodex(task: TaskRecord, prompt: string, cwd: string, timeoutMs: number): Promise<void> {
    const result = await runCommand({
      command: this.env.codexBin,
      args: ['exec', '--full-auto', '--skip-git-repo-check', '--cd', cwd, prompt],
      cwd,
      timeoutMs,
      onStdout: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
      onStderr: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
    });

    if (result.code !== 0) {
      throw new Error(`Codex failed with exit code ${result.code}.`);
    }
  }

  private async runClaudeCode(task: TaskRecord, prompt: string, cwd: string, timeoutMs: number): Promise<void> {
    if (!this.env.claudeCodeAnthropicApiKey) {
      throw new Error('Claude Code DeepSeek API key is not configured.');
    }

    const result = await runCommand({
      command: this.env.claudeCodeBin,
      args: [
        '-p',
        '--output-format',
        'text',
        '--model',
        this.env.claudeCodeModel,
        '--max-turns',
        'max',
        '--dangerously-skip-permissions',
        prompt,
      ],
      cwd,
      timeoutMs,
      env: {
        ANTHROPIC_BASE_URL: this.env.claudeCodeAnthropicBaseUrl,
        ANTHROPIC_API_KEY: this.env.claudeCodeAnthropicApiKey,
        ANTHROPIC_MODEL: this.env.claudeCodeModel,
      },
      onStdout: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
      onStderr: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
    });

    if (result.code !== 0) {
      throw new Error(`Claude Code failed with exit code ${result.code}.`);
    }
  }

  private async copyDirectory(source: string, destination: string): Promise<void> {
    await rm(destination, { recursive: true, force: true });
    await mkdir(resolve(destination, '..'), { recursive: true });
    await import('node:fs/promises').then(({ cp }) => cp(source, destination, { recursive: true, force: true, preserveTimestamps: true }));
  }
}
