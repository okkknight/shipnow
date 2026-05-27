import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { removePath } from './utils.js';
import type {
  ProjectAliasRecord,
  ProjectEventRecord,
  ProjectMessageRecord,
  ProjectRecord,
  ProjectStatus,
  ProjectType,
  ReleaseKind,
  ReleaseRecord,
  TaskRecord,
  TaskStatus,
  TaskType,
} from './types.js';

type SqlDatabase = Database.Database;

function nowIso(): string {
  return new Date().toISOString();
}

function newProjectId(): string {
  return `proj_${randomUUID().slice(0, 12)}`;
}

function newTaskId(): string {
  return `task_${randomUUID().slice(0, 12)}`;
}

function newReleaseId(): string {
  return `release_${randomUUID().slice(0, 12)}`;
}

function newMessageId(): string {
  return `msg_${randomUUID().slice(0, 12)}`;
}

function newEventId(): string {
  return `event_${randomUUID().slice(0, 12)}`;
}

function toMaybeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseJsonRecord(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export class ShipNowStore {
  private readonly db: SqlDatabase;

  private readonly publicStaticRoot: string;

  constructor(dbPath: string, publicStaticRoot: string) {
    this.publicStaticRoot = publicStaticRoot;
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    const version = Number(this.db.pragma('user_version', { simple: true }) ?? 0);
    if (version >= 2) {
      return;
    }

    this.db.exec(`
      DROP TABLE IF EXISTS project_events;
      DROP TABLE IF EXISTS project_messages;
      DROP TABLE IF EXISTS project_aliases;
      DROP TABLE IF EXISTS releases;
      DROP TABLE IF EXISTS tasks;
      DROP TABLE IF EXISTS projects;

      CREATE TABLE projects (
        project_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        public_handle TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL,
        source_root TEXT NOT NULL,
        preview_release_path TEXT,
        public_release_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_built_at TEXT,
        last_published_at TEXT,
        deleted_at TEXT,
        latest_task_id TEXT
      );

      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        prompt TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        log_path TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE releases (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        source TEXT NOT NULL,
        release_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        published_at TEXT,
        build_task_id TEXT,
        is_current_preview INTEGER NOT NULL DEFAULT 0,
        is_current_public INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE project_aliases (
        alias_handle TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE project_messages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE project_events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT,
        data_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX idx_tasks_status ON tasks(status);
      CREATE INDEX idx_releases_project_kind ON releases(project_id, kind);
      CREATE INDEX idx_project_aliases_project_id ON project_aliases(project_id);
      CREATE INDEX idx_project_messages_project_id ON project_messages(project_id);
      CREATE INDEX idx_project_events_project_id ON project_events(project_id);
    `);

    this.db.pragma('user_version = 2');
  }

  close(): void {
    this.db.close();
  }

  listProjects(includeDeleted = false): ProjectRecord[] {
    const rows = includeDeleted
      ? this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all()
      : this.db.prepare('SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC').all();
    return rows as ProjectRecord[];
  }

  getProjectById(projectId: string): ProjectRecord | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE project_id = ?').get(projectId);
    return (row as ProjectRecord | undefined) ?? null;
  }

  getProjectByHandle(handle: string): ProjectRecord | null {
    const direct = this.db.prepare('SELECT * FROM projects WHERE public_handle = ?').get(handle);
    if (direct) {
      return direct as ProjectRecord;
    }

    const alias = this.db
      .prepare(
        `
        SELECT p.*
        FROM project_aliases a
        INNER JOIN projects p ON p.project_id = a.project_id
        WHERE a.alias_handle = ?
        LIMIT 1
      `
      )
      .get(handle);
    return (alias as ProjectRecord | undefined) ?? null;
  }

  resolveProjectHandle(handle: string): { project: ProjectRecord; redirected: boolean } | null {
    const direct = this.db.prepare('SELECT * FROM projects WHERE public_handle = ?').get(handle);
    if (direct) {
      return { project: direct as ProjectRecord, redirected: false };
    }

    const alias = this.db
      .prepare(
        `
        SELECT p.*
        FROM project_aliases a
        INNER JOIN projects p ON p.project_id = a.project_id
        WHERE a.alias_handle = ?
        LIMIT 1
      `
      )
      .get(handle);
    if (!alias) {
      return null;
    }
    return { project: alias as ProjectRecord, redirected: true };
  }

  handleExists(handle: string): boolean {
    return this.getProjectByHandle(handle) !== null;
  }

  createProject(input: {
    projectId: string;
    displayName: string;
    publicHandle: string;
    type: ProjectType;
    title: string;
    prompt: string;
    sourceRoot: string;
    status?: ProjectStatus;
  }): ProjectRecord {
    const createdAt = nowIso();
    const record: ProjectRecord = {
      project_id: input.projectId,
      display_name: input.displayName,
      public_handle: input.publicHandle,
      type: input.type,
      title: input.title,
      prompt: input.prompt,
      status: input.status ?? 'draft',
      source_root: input.sourceRoot,
      preview_release_path: null,
      public_release_path: null,
      created_at: createdAt,
      updated_at: createdAt,
      last_built_at: null,
      last_published_at: null,
      deleted_at: null,
      latest_task_id: null,
    };
    this.db
      .prepare(
        `
        INSERT INTO projects (
          project_id, display_name, public_handle, type, title, prompt, status, source_root,
          preview_release_path, public_release_path, created_at, updated_at,
          last_built_at, last_published_at, deleted_at, latest_task_id
        ) VALUES (
          @project_id, @display_name, @public_handle, @type, @title, @prompt, @status, @source_root,
          @preview_release_path, @public_release_path, @created_at, @updated_at,
          @last_built_at, @last_published_at, @deleted_at, @latest_task_id
        )
      `
      )
      .run(record);
    return record;
  }

  updateProject(projectId: string, patch: Partial<ProjectRecord>): ProjectRecord | null {
    const current = this.getProjectById(projectId);
    if (!current) {
      return null;
    }
    const next: ProjectRecord = { ...current, ...patch, updated_at: nowIso() };
    this.db
      .prepare(
        `
        UPDATE projects SET
          display_name = @display_name,
          public_handle = @public_handle,
          type = @type,
          title = @title,
          prompt = @prompt,
          status = @status,
          source_root = @source_root,
          preview_release_path = @preview_release_path,
          public_release_path = @public_release_path,
          updated_at = @updated_at,
          last_built_at = @last_built_at,
          last_published_at = @last_published_at,
          deleted_at = @deleted_at,
          latest_task_id = @latest_task_id
        WHERE project_id = @project_id
      `
      )
      .run(next);
    return next;
  }

  renameProject(projectId: string, displayName: string, publicHandle: string): ProjectRecord | null {
    const current = this.getProjectById(projectId);
    if (!current) {
      return null;
    }

    const changedHandle = current.public_handle !== publicHandle;
    const now = nowIso();
    const transaction = this.db.transaction(() => {
      if (changedHandle) {
        this.db
          .prepare(
            `
            INSERT OR REPLACE INTO project_aliases (alias_handle, project_id, created_at)
            VALUES (?, ?, ?)
          `
          )
          .run(current.public_handle, projectId, now);
      }

      this.db
        .prepare(
          `
          UPDATE projects SET
            display_name = ?,
            public_handle = ?,
            updated_at = ?
          WHERE project_id = ?
        `
        )
        .run(displayName, publicHandle, now, projectId);
    });
    transaction();
    return this.getProjectById(projectId);
  }

  updateProjectStatus(projectId: string, status: ProjectStatus): ProjectRecord | null {
    return this.updateProject(projectId, { status });
  }

  markProjectDeleted(projectId: string): ProjectRecord | null {
    return this.updateProject(projectId, { status: 'deleted', deleted_at: nowIso() });
  }

  listTasksForProject(projectId: string): TaskRecord[] {
    return this.db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as TaskRecord[];
  }

  getTask(id: string): TaskRecord | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    return (row as TaskRecord | undefined) ?? null;
  }

  createTask(input: {
    projectId: string;
    type: TaskType;
    prompt: string;
    logPath: string;
  }): TaskRecord {
    const now = nowIso();
    const task: TaskRecord = {
      id: newTaskId(),
      project_id: input.projectId,
      type: input.type,
      status: 'pending',
      prompt: input.prompt,
      started_at: null,
      finished_at: null,
      log_path: input.logPath,
      error_message: null,
      created_at: now,
      updated_at: now,
    };
    this.db
      .prepare(
        `
        INSERT INTO tasks (
          id, project_id, type, status, prompt,
          started_at, finished_at, log_path, error_message,
          created_at, updated_at
        ) VALUES (
          @id, @project_id, @type, @status, @prompt,
          @started_at, @finished_at, @log_path, @error_message,
          @created_at, @updated_at
        )
      `
      )
      .run(task);
    return task;
  }

  updateTask(id: string, patch: Partial<TaskRecord>): TaskRecord | null {
    const current = this.getTask(id);
    if (!current) {
      return null;
    }
    const next: TaskRecord = { ...current, ...patch, updated_at: nowIso() };
    this.db
      .prepare(
        `
        UPDATE tasks SET
          project_id = @project_id,
          type = @type,
          status = @status,
          prompt = @prompt,
          started_at = @started_at,
          finished_at = @finished_at,
          log_path = @log_path,
          error_message = @error_message,
          updated_at = @updated_at
        WHERE id = @id
      `
      )
      .run(next);
    return next;
  }

  async appendTaskLogAsync(id: string, line: string): Promise<void> {
    const task = this.getTask(id);
    if (!task) {
      return;
    }
    const entry = `[${nowIso()}] ${line}\n`;
    await appendFile(task.log_path, entry, 'utf8');
    this.db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(nowIso(), id);
  }

  getTaskLogPath(id: string): string | null {
    return toMaybeString(this.getTask(id)?.log_path);
  }

  listReleases(projectId: string): ReleaseRecord[] {
    return this.db
      .prepare('SELECT * FROM releases WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId) as ReleaseRecord[];
  }

  getCurrentRelease(projectId: string, kind: ReleaseKind): ReleaseRecord | null {
    const column = kind === 'preview' ? 'is_current_preview' : 'is_current_public';
    const row = this.db
      .prepare(`SELECT * FROM releases WHERE project_id = ? AND kind = ? AND ${column} = 1 LIMIT 1`)
      .get(projectId, kind);
    return (row as ReleaseRecord | undefined) ?? null;
  }

  getLatestRelease(projectId: string, kind: ReleaseKind): ReleaseRecord | null {
    const row = this.db
      .prepare('SELECT * FROM releases WHERE project_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 1')
      .get(projectId, kind);
    return (row as ReleaseRecord | undefined) ?? null;
  }

  createRelease(input: {
    projectId: string;
    kind: ReleaseKind;
    source: string;
    releasePath: string;
    buildTaskId?: string | null;
    publishedAt?: string | null;
    current?: boolean;
  }): ReleaseRecord {
    const release: ReleaseRecord = {
      id: newReleaseId(),
      project_id: input.projectId,
      kind: input.kind,
      source: input.source,
      release_path: input.releasePath,
      created_at: nowIso(),
      published_at: input.publishedAt ?? null,
      build_task_id: input.buildTaskId ?? null,
      is_current_preview: input.kind === 'preview' && input.current ? 1 : 0,
      is_current_public: input.kind === 'public' && input.current ? 1 : 0,
    };

    const transaction = this.db.transaction((releaseRow: ReleaseRecord) => {
      const column = releaseRow.kind === 'preview' ? 'is_current_preview' : 'is_current_public';
      this.db.prepare(`UPDATE releases SET ${column} = 0 WHERE project_id = ? AND kind = ?`).run(releaseRow.project_id, releaseRow.kind);
      this.db
        .prepare(
          `
          INSERT INTO releases (
            id, project_id, kind, source, release_path,
            created_at, published_at, build_task_id,
            is_current_preview, is_current_public
          ) VALUES (
            @id, @project_id, @kind, @source, @release_path,
            @created_at, @published_at, @build_task_id,
            @is_current_preview, @is_current_public
          )
        `
        )
        .run(releaseRow);
    });
    transaction(release);
    return release;
  }

  setCurrentRelease(projectId: string, kind: ReleaseKind, releaseId: string): ReleaseRecord | null {
    const current = this.getRelease(releaseId);
    if (!current) {
      return null;
    }
    const column = kind === 'preview' ? 'is_current_preview' : 'is_current_public';
    this.db.transaction(() => {
      this.db.prepare(`UPDATE releases SET ${column} = 0 WHERE project_id = ? AND kind = ?`).run(projectId, kind);
      this.db.prepare(`UPDATE releases SET ${column} = 1 WHERE id = ?`).run(releaseId);
    })();
    return this.getRelease(releaseId);
  }

  getRelease(id: string): ReleaseRecord | null {
    const row = this.db.prepare('SELECT * FROM releases WHERE id = ?').get(id);
    return (row as ReleaseRecord | undefined) ?? null;
  }

  updateProjectReleasePaths(projectId: string, patch: { preview?: string | null; public?: string | null }): ProjectRecord | null {
    const current = this.getProjectById(projectId);
    if (!current) {
      return null;
    }
    return this.updateProject(projectId, {
      preview_release_path: patch.preview ?? current.preview_release_path,
      public_release_path: patch.public ?? current.public_release_path,
    });
  }

  setTaskStatus(id: string, status: TaskStatus, patch: Partial<TaskRecord> = {}): TaskRecord | null {
    return this.updateTask(id, {
      ...patch,
      status,
    });
  }

  activeTaskCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE status = 'running'").get() as { count: number };
    return row.count;
  }

  activeTaskForProject(projectId: string): boolean {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM tasks WHERE project_id = ? AND status IN ('pending', 'running')")
      .get(projectId) as { count: number };
    return row.count > 0;
  }

  listPendingTasks(): TaskRecord[] {
    return this.db.prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC").all() as TaskRecord[];
  }

  listRunningTasks(): TaskRecord[] {
    return this.db.prepare("SELECT * FROM tasks WHERE status = 'running' ORDER BY created_at ASC").all() as TaskRecord[];
  }

  updateProjectTaskLink(projectId: string, taskId: string): void {
    this.db.prepare('UPDATE projects SET latest_task_id = ?, updated_at = ? WHERE project_id = ?').run(taskId, nowIso(), projectId);
  }

  updateProjectBuildState(projectId: string, previewReleasePath: string | null, status: ProjectStatus, lastBuiltAt = nowIso()): ProjectRecord | null {
    return this.updateProject(projectId, {
      status,
      preview_release_path: previewReleasePath,
      last_built_at: lastBuiltAt,
    });
  }

  updateProjectPublishState(projectId: string, publicReleasePath: string | null, status: ProjectStatus, publishedAt = nowIso()): ProjectRecord | null {
    return this.updateProject(projectId, {
      status,
      public_release_path: publicReleasePath,
      last_published_at: publishedAt,
    });
  }

  getTaskLogText(id: string): string {
    const task = this.getTask(id);
    if (!task) {
      return '';
    }
    try {
      return readFileSync(task.log_path, 'utf8');
    } catch {
      return '';
    }
  }

  listMessages(projectId: string): ProjectMessageRecord[] {
    return this.db.prepare('SELECT * FROM project_messages WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as ProjectMessageRecord[];
  }

  createMessage(input: {
    projectId: string;
    taskId?: string | null;
    role: ProjectMessageRecord['role'];
    content: string;
  }): ProjectMessageRecord {
    const record: ProjectMessageRecord = {
      id: newMessageId(),
      project_id: input.projectId,
      task_id: input.taskId ?? null,
      role: input.role,
      content: input.content,
      created_at: nowIso(),
    };
    this.db
      .prepare(
        `
        INSERT INTO project_messages (
          id, project_id, task_id, role, content, created_at
        ) VALUES (
          @id, @project_id, @task_id, @role, @content, @created_at
        )
      `
      )
      .run(record);
    return record;
  }

  listEvents(projectId: string): Array<ProjectEventRecord & { data: Record<string, unknown> | null }> {
    const rows = this.db
      .prepare('SELECT * FROM project_events WHERE project_id = ? ORDER BY created_at ASC')
      .all(projectId) as ProjectEventRecord[];
    return rows.map((row) => ({
      ...row,
      data: parseJsonRecord(row.data_json),
    }));
  }

  createEvent(input: {
    projectId: string;
    taskId?: string | null;
    type: string;
    title: string;
    detail?: string | null;
    data?: Record<string, unknown> | null;
  }): ProjectEventRecord {
    const record: ProjectEventRecord = {
      id: newEventId(),
      project_id: input.projectId,
      task_id: input.taskId ?? null,
      type: input.type,
      title: input.title,
      detail: input.detail ?? null,
      data_json: input.data ? JSON.stringify(input.data) : null,
      created_at: nowIso(),
    };
    this.db
      .prepare(
        `
        INSERT INTO project_events (
          id, project_id, task_id, type, title, detail, data_json, created_at
        ) VALUES (
          @id, @project_id, @task_id, @type, @title, @detail, @data_json, @created_at
        )
      `
      )
      .run(record);
    return record;
  }

  touchProjectDeletedArtifacts(projectId: string): void {
    const project = this.getProjectById(projectId);
    if (!project) {
      return;
    }
    void removePath(project.source_root);
    void removePath(resolve(this.publicStaticRoot, projectId));
  }
}
