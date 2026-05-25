import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ShipNowEnv } from './env.js';
import { ShipNowStore } from './db.js';
import type { ProjectRecord, ProjectStatus, ProjectType, ProjectView, ReleaseKind, TaskRecord, TaskType, TaskView } from './types.js';
import { validateProjectName } from './security.js';
import {
  copyDefaultTemplate,
  ensureWorkspaceRoots,
  prepareProjectWorkspace,
  projectPaths,
  removeProjectWorkspace,
  updateCurrentReleaseLink,
  writeProjectConfig,
} from './storage.js';
import { runCommand } from './process.js';

interface EnqueueInput {
  projectName: string;
  type: TaskType;
  prompt: string;
}

interface CreateProjectInput {
  name: string;
  title: string;
  prompt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function displayUrl(baseUrl: string, pathPart: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${pathPart.replace(/^\/+/, '')}`;
}

function statusText(status: string): string {
  return status.replace(/_/g, ' ');
}

function inferProjectType(title: string, prompt: string): ProjectType {
  const haystack = `${title} ${prompt}`.toLowerCase();
  return /(\bgame\b|\bphaser\b|小游戏|游戏|功德篮球|投篮|arcade|puzzle|platformer|runner|shoot|basketball|pong|snake|flappy)/i.test(haystack)
    ? 'game'
    : 'landing';
}

function buildCodexPrompt(project: ProjectRecord, changePrompt: string): string {
  const lines = [
    `Current project name: ${project.name}`,
    `Template mode: ${project.type}`,
    `User request: ${changePrompt}`,
    'This is a ShipNow-managed pure front-end static project.',
    'Use the default-static-site template structure already present in the repository.',
    'Do not add dependencies.',
    'Do not introduce a backend service.',
    'Do not change the build command.',
    'Do not assume deployment at the root path /.',
    'Do not start dev servers, preview servers, browser sessions, or other long-running processes.',
    'Only edit files in the current working directory and finish by running pnpm build.',
    'You must keep pnpm build passing.',
    project.type === 'game' ? 'If you need a game experience, use the Phaser assets and game shell already provided by the template.' : '',
    'Prefer the template components, hooks, and utility files that already exist.',
    '',
    'Required outputs:',
    '- Update src/project.config.ts if the content or metadata changes.',
    '- Update title, description, and visual hierarchy to fit the request.',
    '- Keep the app fully responsive.',
    '- Keep the existing architecture stable.',
  ].filter(Boolean);
  return lines.join('\n');
}

function projectRouteName(projectName: string): string {
  return encodeURIComponent(projectName);
}

async function readMaybeJson(path: string): Promise<unknown | null> {
  try {
    const text = await readFile(path, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
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
    await this.resumePendingTasks();
  }

  async shutdown(): Promise<void> {
    // no-op for now
  }

  listProjects(): ProjectView[] {
    return this.store.listProjects().map((project) => this.toProjectView(project));
  }

  getProject(projectName: string): ProjectView | null {
    const project = this.store.getProject(projectName);
    return project ? this.toProjectView(project) : null;
  }

  listTasks(projectName: string): TaskView[] {
    return this.store.listTasksForProject(projectName).map((task) => this.toTaskView(task));
  }

  getTask(taskId: string): TaskView | null {
    const task = this.store.getTask(taskId);
    return task ? this.toTaskView(task) : null;
  }

  getProjectDetail(projectName: string): {
    project: ProjectView;
    tasks: TaskView[];
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
    const project = this.requireProject(projectName);
    const releases = this.store.listReleases(project.name).map((release) => ({
      id: release.id,
      kind: release.kind,
      source: release.source,
      releasePath: release.release_path,
      createdAt: release.created_at,
      publishedAt: release.published_at,
      buildTaskId: release.build_task_id,
      isCurrentPreview: release.is_current_preview === 1,
      isCurrentPublic: release.is_current_public === 1,
    }));
    return {
      project: this.toProjectView(project),
      tasks: this.listTasks(project.name),
      releases,
    };
  }

  getTaskLog(taskId: string): string {
    return this.store.getTaskLogText(taskId);
  }

  async createProject(input: CreateProjectInput): Promise<{ project: ProjectView; taskId: string }> {
    const name = validateProjectName(input.name);
    if (this.store.getProject(name)) {
      throw new Error(`Project ${name} already exists.`);
    }

    const paths = await prepareProjectWorkspace(this.env, name);
    const type = inferProjectType(input.title, input.prompt);
    const project = this.store.createProject({
      name,
      type,
      title: input.title,
      prompt: input.prompt,
      sourceRoot: paths.sourceRoot,
      status: 'generating',
    });
    const task = await this.enqueueTask({ projectName: name, type: 'create_project', prompt: input.prompt });
    this.store.updateProjectStatus(name, 'generating');
    this.store.updateProjectTaskLink(name, task.id);
    return { project: this.toProjectView(this.store.getProject(name) ?? project), taskId: task.id };
  }

  async applyChange(projectName: string, prompt: string): Promise<{ project: ProjectView; taskId: string }> {
    const project = this.requireActiveProject(projectName);
    const task = await this.enqueueTask({ projectName: project.name, type: 'apply_change', prompt });
    this.store.updateProjectStatus(project.name, 'generating');
    return { project: this.toProjectView(this.requireProject(project.name)), taskId: task.id };
  }

  async rebuild(projectName: string): Promise<{ project: ProjectView; taskId: string }> {
    const project = this.requireActiveProject(projectName);
    const task = await this.enqueueTask({ projectName: project.name, type: 'rebuild', prompt: 'Rebuild the current project without changing the intended product direction.' });
    this.store.updateProjectStatus(project.name, 'generating');
    return { project: this.toProjectView(this.requireProject(project.name)), taskId: task.id };
  }

  async publish(projectName: string): Promise<{ project: ProjectView; taskId: string }> {
    const project = this.requireActiveProject(projectName);
    const task = await this.enqueueTask({ projectName: project.name, type: 'publish', prompt: 'Publish the latest successful preview release to the public release.' });
    this.store.updateProjectStatus(project.name, 'publishing');
    return { project: this.toProjectView(this.requireProject(project.name)), taskId: task.id };
  }

  async deleteProject(projectName: string): Promise<{ project: ProjectView; taskId: string }> {
    const project = this.requireProject(projectName);
    const task = await this.enqueueTask({ projectName: project.name, type: 'delete_project', prompt: 'Delete the project and remove its workspace artifacts.' });
    return { project: this.toProjectView(project), taskId: task.id };
  }

  private requireProject(projectName: string): ProjectRecord {
    const project = this.store.getProject(validateProjectName(projectName));
    if (!project) {
      throw new Error(`Project ${projectName} not found.`);
    }
    return project;
  }

  private requireActiveProject(projectName: string): ProjectRecord {
    const project = this.requireProject(projectName);
    if (project.status === 'deleted') {
      throw new Error(`Project ${projectName} has been deleted.`);
    }
    return project;
  }

  private toProjectView(project: ProjectRecord): ProjectView {
    return {
      name: project.name,
      type: project.type,
      title: project.title,
      prompt: project.prompt,
      status: project.status,
      previewUrl: displayUrl(this.env.previewBaseUrl, projectRouteName(project.name)),
      publicUrl: displayUrl(this.env.publicBaseUrl, projectRouteName(project.name)),
      previewRoute: displayUrl(this.env.previewBaseUrl, projectRouteName(project.name)),
      publicRoute: displayUrl(this.env.publicBaseUrl, projectRouteName(project.name)),
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
      projectName: task.project_name,
      type: task.type,
      status: task.status,
      prompt: task.prompt,
      startedAt: task.started_at,
      finishedAt: task.finished_at,
      errorMessage: task.error_message,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      logPath: task.log_path,
    };
  }

  private async enqueueTask(input: EnqueueInput): Promise<TaskRecord> {
    const project = this.requireProject(input.projectName);
    if (this.store.activeTaskForProject(project.name)) {
      throw new Error(`Project ${project.name} already has a running or pending task.`);
    }
    const task = this.store.createTask({
      projectName: project.name,
      type: input.type,
      prompt: input.prompt,
      logPath: projectPaths(this.env, project.name).logPath,
    });
    this.store.updateProjectTaskLink(project.name, task.id);
    await this.store.appendTaskLogAsync(task.id, `Queued task ${task.type} for project ${project.name}.`);
    this.scheduleDrain();
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
    const project = this.requireProject(task.project_name);
    const startedAt = nowIso();
    this.store.setTaskStatus(task.id, 'running', { started_at: startedAt });
    await this.store.appendTaskLogAsync(task.id, `Starting ${task.type} for ${project.name}.`);

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
      await this.store.appendTaskLogAsync(task.id, `Task ${task.id} completed successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store.appendTaskLogAsync(task.id, `Task ${task.id} failed: ${message}`);
      this.store.setTaskStatus(task.id, 'failed', { finished_at: nowIso(), error_message: message });
      if (task.type === 'publish') {
        this.store.updateProjectStatus(project.name, 'publish_failed');
      } else if (task.type === 'delete_project') {
        this.store.updateProjectStatus(project.name, 'published');
      } else {
        this.store.updateProjectStatus(project.name, 'build_failed');
      }
    }
  }

  private async executeCreateProject(project: ProjectRecord, task: TaskRecord, timeoutMs: number): Promise<void> {
    const paths = await prepareProjectWorkspace(this.env, project.name);
    await copyDefaultTemplate(this.env, paths);
    await writeProjectConfig(paths, {
      name: project.name,
      type: project.type,
      title: project.title,
      prompt: project.prompt,
    });
    await this.ensureGitRepository(paths.sourceRoot, task.id);
    await this.store.appendTaskLogAsync(task.id, `Copied template into ${paths.sourceRoot}.`);
    await this.store.appendTaskLogAsync(task.id, 'Installing project dependencies with pnpm install --frozen-lockfile.');
    const install = await runCommand({
      command: 'pnpm',
      args: ['install', '--frozen-lockfile'],
      cwd: paths.sourceRoot,
      timeoutMs,
      onStdout: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
      onStderr: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
    });
    if (install.code !== 0) {
      throw new Error(`pnpm install failed with exit code ${install.code}.`);
    }

    await this.store.appendTaskLogAsync(task.id, `Running Codex in ${paths.sourceRoot}.`);
    await this.runCodex(project, task, project.prompt, paths.sourceRoot, timeoutMs);

    await this.store.appendTaskLogAsync(task.id, 'Building project with pnpm build.');
    await this.runBuild(task, paths.sourceRoot, timeoutMs);
    const release = await this.publishPreviewRelease(project.name, task.id, paths.sourceRoot);
    this.store.updateProjectBuildState(project.name, release.release_path, 'preview_ready');
    this.store.updateProjectTaskLink(project.name, task.id);
  }

  private async executeApplyChange(project: ProjectRecord, task: TaskRecord, timeoutMs: number): Promise<void> {
    const paths = projectPaths(this.env, project.name);
    if (!existsSync(paths.sourceRoot)) {
      throw new Error(`Project source directory missing: ${paths.sourceRoot}`);
    }
    this.store.updateProjectStatus(project.name, 'generating');
    await this.ensureGitRepository(paths.sourceRoot, task.id);
    await this.store.appendTaskLogAsync(task.id, `Applying Codex changes in ${paths.sourceRoot}.`);
    await this.runCodex(project, task, buildCodexPrompt(project, task.prompt), paths.sourceRoot, timeoutMs);
    await this.store.appendTaskLogAsync(task.id, 'Building project with pnpm build.');
    await this.runBuild(task, paths.sourceRoot, timeoutMs);
    const release = await this.publishPreviewRelease(project.name, task.id, paths.sourceRoot);
    this.store.updateProjectBuildState(project.name, release.release_path, 'preview_ready');
  }

  private async executeRebuild(project: ProjectRecord, task: TaskRecord, timeoutMs: number): Promise<void> {
    const paths = projectPaths(this.env, project.name);
    if (!existsSync(paths.sourceRoot)) {
      throw new Error(`Project source directory missing: ${paths.sourceRoot}`);
    }
    this.store.updateProjectStatus(project.name, 'generating');
    await this.ensureGitRepository(paths.sourceRoot, task.id);
    await this.store.appendTaskLogAsync(task.id, `Rebuilding project in ${paths.sourceRoot}.`);
    await this.runBuild(task, paths.sourceRoot, timeoutMs);
    const release = await this.publishPreviewRelease(project.name, task.id, paths.sourceRoot);
    this.store.updateProjectBuildState(project.name, release.release_path, 'preview_ready');
  }

  private async executePublish(project: ProjectRecord, task: TaskRecord): Promise<void> {
    const previewRelease = this.store.getCurrentRelease(project.name, 'preview') ?? this.store.getLatestRelease(project.name, 'preview');
    if (!previewRelease) {
      throw new Error(`No successful preview release found for ${project.name}.`);
    }
    const paths = projectPaths(this.env, project.name);
    await mkdir(paths.publicReleasesRoot, { recursive: true });
    const releasePath = resolve(paths.publicReleasesRoot, `${previewRelease.id}-${randomUUID().slice(0, 8)}`);
    await this.copyDirectory(previewRelease.release_path, releasePath);
    await updateCurrentReleaseLink(releasePath, paths.publicCurrentRoot);
    const publicRelease = this.store.createRelease({
      projectName: project.name,
      kind: 'public',
      source: previewRelease.release_path,
      releasePath,
      buildTaskId: previewRelease.build_task_id,
      publishedAt: nowIso(),
      current: true,
    });
    this.store.updateProjectPublishState(project.name, publicRelease.release_path, 'published');
    this.store.setTaskStatus(task.id, 'success', { finished_at: nowIso() });
    await this.store.appendTaskLogAsync(task.id, `Published ${project.name} to ${releasePath}.`);
  }

  private async executeDelete(project: ProjectRecord, task: TaskRecord): Promise<void> {
    const paths = projectPaths(this.env, project.name);
    await removeProjectWorkspace(paths);
    this.store.markProjectDeleted(project.name);
    await this.store.appendTaskLogAsync(task.id, `Deleted workspace for ${project.name}.`);
  }

  private async publishPreviewRelease(projectName: string, taskId: string, sourceRoot: string): Promise<{ id: string; release_path: string }> {
    const paths = projectPaths(this.env, projectName);
    const distPath = resolve(sourceRoot, 'dist');
    if (!existsSync(distPath)) {
      throw new Error(`Missing dist directory after build: ${distPath}`);
    }
    const releasePath = resolve(paths.previewReleasesRoot, `${taskId}-${randomUUID().slice(0, 8)}`);
    await this.copyDirectory(distPath, releasePath);
    await updateCurrentReleaseLink(releasePath, paths.previewCurrentRoot);
    const release = this.store.createRelease({
      projectName,
      kind: 'preview',
      source: sourceRoot,
      releasePath,
      buildTaskId: taskId,
      current: true,
    });
    return { id: release.id, release_path: release.release_path };
  }

  private async runBuild(task: TaskRecord, cwd: string, timeoutMs: number): Promise<void> {
    const installResult = await runCommand({
      command: 'pnpm',
      args: ['build'],
      cwd,
      timeoutMs,
      onStdout: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
      onStderr: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
    });
    if (installResult.code !== 0) {
      throw new Error(`pnpm build failed with exit code ${installResult.code}.`);
    }
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

  private async runCodex(project: ProjectRecord, task: TaskRecord, prompt: string, cwd: string, timeoutMs: number): Promise<void> {
    const structuredPrompt = [
      `Project name: ${project.name}`,
      `Template mode: ${project.type}`,
      'This is a ShipNow-managed static site project.',
      'Use only the files in the current working directory.',
      'Keep the existing template conventions and maintain pnpm build success.',
      'Do not start dev servers, preview servers, browser sessions, or other long-running processes.',
      'Only edit files in the current working directory and finish by running pnpm build.',
      project.type === 'game'
        ? 'Treat this as a game project and use Phaser from the template or add Phaser-based gameplay as needed.'
        : '',
      '',
      prompt,
      '',
      'Rules:',
      '- Do not add dependencies.',
      '- Do not create a backend service.',
      '- Do not modify ShipNow workspace files.',
      '- Keep the app responsive and production-ready.',
    ].join('\n');

    const result = await runCommand({
      command: this.env.codexBin,
      args: ['exec', '--full-auto', '--skip-git-repo-check', '--cd', cwd, structuredPrompt],
      cwd,
      timeoutMs,
      onStdout: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
      onStderr: async (chunk) => this.store.appendTaskLogAsync(task.id, chunk.trimEnd()),
    });

    if (result.code !== 0) {
      throw new Error(`Codex failed with exit code ${result.code}.`);
    }
  }

  private async copyDirectory(source: string, destination: string): Promise<void> {
    await rm(destination, { recursive: true, force: true });
    await mkdir(resolve(destination, '..'), { recursive: true });
    await import('node:fs/promises').then(({ cp }) => cp(source, destination, { recursive: true, force: true, preserveTimestamps: true }));
  }
}
