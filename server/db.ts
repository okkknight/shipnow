import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { removePath } from './utils.js';
import type { ProjectRecord, ProjectStatus, ProjectType, ReleaseKind, ReleaseRecord, TaskRecord, TaskStatus, TaskType } from './types.js';

type SqlDatabase = Database.Database;

function nowIso(): string {
  return new Date().toISOString();
}

function toMaybeString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
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
    this.migrateLegacySiteLayout();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        name TEXT PRIMARY KEY,
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

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
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

      CREATE TABLE IF NOT EXISTS releases (
        id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        kind TEXT NOT NULL,
        source TEXT NOT NULL,
        release_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        published_at TEXT,
        build_task_id TEXT,
        is_current_preview INTEGER NOT NULL DEFAULT 0,
        is_current_public INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_project_name ON tasks(project_name);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_releases_project_kind ON releases(project_name, kind);
    `);
  }

  private migrateLegacySiteLayout(): void {
    const projects = this.db.prepare('SELECT * FROM projects ORDER BY created_at ASC').all() as ProjectRecord[];
    const updateTaskPath = this.db.prepare('UPDATE tasks SET log_path = ?, updated_at = ? WHERE id = ?');
    const updateReleasePath = this.db.prepare('UPDATE releases SET source = ?, release_path = ? WHERE id = ?');
    const updateProjectPaths = this.db.prepare(`
      UPDATE projects SET
        source_root = ?,
        preview_release_path = ?,
        public_release_path = ?,
        updated_at = ?
      WHERE name = ?
    `);

    const transaction = this.db.transaction(() => {
      for (const project of projects) {
        const projectRoot = resolve(this.publicStaticRoot, project.name);
        const sourceRoot = resolve(projectRoot, 'source');
        const migratedAt = nowIso();
        const previewReleaseRows = this.db
          .prepare('SELECT * FROM releases WHERE project_name = ? AND kind = ? ORDER BY created_at ASC')
          .all(project.name, 'preview') as ReleaseRecord[];
        const publicReleaseRows = this.db
          .prepare('SELECT * FROM releases WHERE project_name = ? AND kind = ? ORDER BY created_at ASC')
          .all(project.name, 'public') as ReleaseRecord[];

        const migrateReleasePath = (kind: ReleaseKind, currentPath: string): string => {
          const leaf = basename(currentPath);
          return resolve(projectRoot, 'releases', kind, leaf);
        };

        const migratedPreviewReleases = previewReleaseRows.map((release) => {
          const releasePath = migrateReleasePath('preview', release.release_path);
          return {
            id: release.id,
            source: sourceRoot,
            releasePath,
          };
        });

        const migratedPublicReleases = publicReleaseRows.map((release) => {
          const releasePath = migrateReleasePath('public', release.release_path);
          const sourcePath = release.source ? migrateReleasePath('preview', release.source) : sourceRoot;
          return {
            id: release.id,
            source: sourcePath,
            releasePath,
          };
        });

        for (const task of this.db.prepare('SELECT * FROM tasks WHERE project_name = ? ORDER BY created_at ASC').all(project.name) as TaskRecord[]) {
          updateTaskPath.run(resolve(projectRoot, 'logs', `${project.name}.log`), migratedAt, task.id);
        }

        for (const release of migratedPreviewReleases) {
          updateReleasePath.run(release.source, release.releasePath, release.id);
        }

        for (const release of migratedPublicReleases) {
          updateReleasePath.run(release.source, release.releasePath, release.id);
        }

        const currentPreview = this.getCurrentRelease(project.name, 'preview') ?? this.getLatestRelease(project.name, 'preview');
        const currentPublic = this.getCurrentRelease(project.name, 'public') ?? this.getLatestRelease(project.name, 'public');
        updateProjectPaths.run(
          sourceRoot,
          currentPreview?.release_path ?? null,
          currentPublic?.release_path ?? null,
          migratedAt,
          project.name
        );
      }
    });

    transaction();
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

  getProject(name: string): ProjectRecord | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE name = ?').get(name);
    return (row as ProjectRecord | undefined) ?? null;
  }

  createProject(input: {
    name: string;
    type: ProjectType;
    title: string;
    prompt: string;
    sourceRoot: string;
    status?: ProjectStatus;
  }): ProjectRecord {
    const createdAt = nowIso();
    const record: ProjectRecord = {
      name: input.name,
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
    this.db.prepare(`
      INSERT INTO projects (
        name, type, title, prompt, status, source_root,
        preview_release_path, public_release_path, created_at, updated_at,
        last_built_at, last_published_at, deleted_at, latest_task_id
      ) VALUES (
        @name, @type, @title, @prompt, @status, @source_root,
        @preview_release_path, @public_release_path, @created_at, @updated_at,
        @last_built_at, @last_published_at, @deleted_at, @latest_task_id
      )
    `).run(record);
    return record;
  }

  updateProject(name: string, patch: Partial<ProjectRecord>): ProjectRecord | null {
    const current = this.getProject(name);
    if (!current) {
      return null;
    }
    const next: ProjectRecord = { ...current, ...patch, updated_at: nowIso() };
    this.db.prepare(`
      UPDATE projects SET
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
      WHERE name = @name
    `).run(next);
    return next;
  }

  updateProjectStatus(name: string, status: ProjectStatus): ProjectRecord | null {
    return this.updateProject(name, { status });
  }

  markProjectDeleted(name: string): ProjectRecord | null {
    return this.updateProject(name, { status: 'deleted', deleted_at: nowIso() });
  }

  listTasksForProject(projectName: string): TaskRecord[] {
    return this.db.prepare('SELECT * FROM tasks WHERE project_name = ? ORDER BY created_at DESC').all(projectName) as TaskRecord[];
  }

  getTask(id: string): TaskRecord | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    return (row as TaskRecord | undefined) ?? null;
  }

  createTask(input: {
    projectName: string;
    type: TaskType;
    prompt: string;
    logPath: string;
  }): TaskRecord {
    const now = nowIso();
    const task: TaskRecord = {
      id: `task_${randomUUID().slice(0, 12)}`,
      project_name: input.projectName,
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
    this.db.prepare(`
      INSERT INTO tasks (
        id, project_name, type, status, prompt,
        started_at, finished_at, log_path, error_message,
        created_at, updated_at
      ) VALUES (
        @id, @project_name, @type, @status, @prompt,
        @started_at, @finished_at, @log_path, @error_message,
        @created_at, @updated_at
      )
    `).run(task);
    return task;
  }

  updateTask(id: string, patch: Partial<TaskRecord>): TaskRecord | null {
    const current = this.getTask(id);
    if (!current) {
      return null;
    }
    const next: TaskRecord = { ...current, ...patch, updated_at: nowIso() };
    this.db.prepare(`
      UPDATE tasks SET
        project_name = @project_name,
        type = @type,
        status = @status,
        prompt = @prompt,
        started_at = @started_at,
        finished_at = @finished_at,
        log_path = @log_path,
        error_message = @error_message,
        updated_at = @updated_at
      WHERE id = @id
    `).run(next);
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

  listReleases(projectName: string): ReleaseRecord[] {
    return this.db
      .prepare('SELECT * FROM releases WHERE project_name = ? ORDER BY created_at DESC')
      .all(projectName) as ReleaseRecord[];
  }

  getCurrentRelease(projectName: string, kind: ReleaseKind): ReleaseRecord | null {
    const column = kind === 'preview' ? 'is_current_preview' : 'is_current_public';
    const row = this.db
      .prepare(`SELECT * FROM releases WHERE project_name = ? AND kind = ? AND ${column} = 1 LIMIT 1`)
      .get(projectName, kind);
    return (row as ReleaseRecord | undefined) ?? null;
  }

  getLatestRelease(projectName: string, kind: ReleaseKind): ReleaseRecord | null {
    const row = this.db
      .prepare('SELECT * FROM releases WHERE project_name = ? AND kind = ? ORDER BY created_at DESC LIMIT 1')
      .get(projectName, kind);
    return (row as ReleaseRecord | undefined) ?? null;
  }

  createRelease(input: {
    projectName: string;
    kind: ReleaseKind;
    source: string;
    releasePath: string;
    buildTaskId?: string | null;
    publishedAt?: string | null;
    current?: boolean;
  }): ReleaseRecord {
    const id = `release_${randomUUID().slice(0, 12)}`;
    const now = nowIso();
    const release: ReleaseRecord = {
      id,
      project_name: input.projectName,
      kind: input.kind,
      source: input.source,
      release_path: input.releasePath,
      created_at: now,
      published_at: input.publishedAt ?? null,
      build_task_id: input.buildTaskId ?? null,
      is_current_preview: input.kind === 'preview' && input.current ? 1 : 0,
      is_current_public: input.kind === 'public' && input.current ? 1 : 0,
    };

    const transaction = this.db.transaction((releaseRow: ReleaseRecord) => {
      const column = releaseRow.kind === 'preview' ? 'is_current_preview' : 'is_current_public';
      this.db.prepare(`UPDATE releases SET ${column} = 0 WHERE project_name = ? AND kind = ?`).run(releaseRow.project_name, releaseRow.kind);
      this.db.prepare(`
        INSERT INTO releases (
          id, project_name, kind, source, release_path,
          created_at, published_at, build_task_id,
          is_current_preview, is_current_public
        ) VALUES (
          @id, @project_name, @kind, @source, @release_path,
          @created_at, @published_at, @build_task_id,
          @is_current_preview, @is_current_public
        )
      `).run(releaseRow);
    });
    transaction(release);
    return release;
  }

  setCurrentRelease(projectName: string, kind: ReleaseKind, releaseId: string): ReleaseRecord | null {
    const current = this.getRelease(releaseId);
    if (!current) {
      return null;
    }
    const column = kind === 'preview' ? 'is_current_preview' : 'is_current_public';
    this.db.transaction(() => {
      this.db.prepare(`UPDATE releases SET ${column} = 0 WHERE project_name = ? AND kind = ?`).run(projectName, kind);
      this.db.prepare(`UPDATE releases SET ${column} = 1 WHERE id = ?`).run(releaseId);
    })();
    return this.getRelease(releaseId);
  }

  getRelease(id: string): ReleaseRecord | null {
    const row = this.db.prepare('SELECT * FROM releases WHERE id = ?').get(id);
    return (row as ReleaseRecord | undefined) ?? null;
  }

  updateProjectReleasePaths(projectName: string, patch: { preview?: string | null; public?: string | null }): ProjectRecord | null {
    const current = this.getProject(projectName);
    if (!current) {
      return null;
    }
    return this.updateProject(projectName, {
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

  activeTaskForProject(projectName: string): boolean {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM tasks WHERE project_name = ? AND status IN ('pending', 'running')")
      .get(projectName) as { count: number };
    return row.count > 0;
  }

  listPendingTasks(): TaskRecord[] {
    return this.db.prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC").all() as TaskRecord[];
  }

  listRunningTasks(): TaskRecord[] {
    return this.db.prepare("SELECT * FROM tasks WHERE status = 'running' ORDER BY created_at ASC").all() as TaskRecord[];
  }

  updateProjectTaskLink(projectName: string, taskId: string): void {
    this.db.prepare('UPDATE projects SET latest_task_id = ?, updated_at = ? WHERE name = ?').run(taskId, nowIso(), projectName);
  }

  updateProjectBuildState(projectName: string, previewReleasePath: string | null, status: ProjectStatus, lastBuiltAt = nowIso()): ProjectRecord | null {
    return this.updateProject(projectName, {
      status,
      preview_release_path: previewReleasePath,
      last_built_at: lastBuiltAt,
    });
  }

  updateProjectPublishState(projectName: string, publicReleasePath: string | null, status: ProjectStatus, publishedAt = nowIso()): ProjectRecord | null {
    return this.updateProject(projectName, {
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

  touchProjectDeletedArtifacts(projectName: string): void {
    const releaseRows = this.listReleases(projectName);
    for (const release of releaseRows) {
      void removePath(release.release_path);
    }
  }
}
