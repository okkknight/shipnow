import type { TaskRunnerName, TaskType } from './types.js';

export type TaskProgressPhase = 'queued' | 'starting' | 'running' | 'building' | 'completed' | 'failed';

export interface TaskProgressTimelineEvent {
  id: string;
  kind: 'task_progress';
  projectId: string;
  taskId: string;
  taskType: TaskType;
  runnerName: TaskRunnerName | null;
  phase: TaskProgressPhase;
  title: string;
  detail: string;
  createdAt: string;
}

type TaskProgressListener = (event: TaskProgressTimelineEvent) => void;

function nowIso(): string {
  return new Date().toISOString();
}

function taskTypeLabel(taskType: TaskType): string {
  switch (taskType) {
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
      return taskType;
  }
}

function runnerLabel(runnerName: TaskRunnerName | null): string | null {
  if (runnerName === 'codex') {
    return 'Codex';
  }
  if (runnerName === 'claude-code') {
    return 'Claude Code';
  }
  return null;
}

function phaseTitle(phase: TaskProgressPhase): string {
  switch (phase) {
    case 'queued':
      return '任务已排队';
    case 'starting':
      return '任务开始执行';
    case 'running':
      return '任务正在运行';
    case 'building':
      return '任务正在构建';
    case 'completed':
      return '任务已完成';
    case 'failed':
      return '任务执行失败';
    default:
      return phase;
  }
}

function phaseDetail(
  taskType: TaskType,
  phase: TaskProgressPhase,
  runnerName: TaskRunnerName | null,
  errorMessage?: string | null
): string {
  const label = taskTypeLabel(taskType);
  const runner = runnerLabel(runnerName);

  switch (phase) {
    case 'queued':
      return runner ? `${label} · ${runner}` : label;
    case 'starting':
      return runner ? `${label} · 准备开始 · ${runner}` : `${label} · 准备开始`;
    case 'running':
      return runner ? `${label} · 正在运行 · ${runner}` : `${label} · 正在运行`;
    case 'building':
      return runner ? `${label} · pnpm build · ${runner}` : `${label} · pnpm build`;
    case 'completed':
      return runner ? `${label} · 已完成 · ${runner}` : `${label} · 已完成`;
    case 'failed':
      return errorMessage ? `${label} · ${errorMessage}` : `${label} · 失败`;
    default:
      return label;
  }
}

export function createTaskProgressEvent(input: {
  projectId: string;
  taskId: string;
  taskType: TaskType;
  phase: TaskProgressPhase;
  runnerName?: TaskRunnerName | null;
  createdAt?: string;
  errorMessage?: string | null;
}): TaskProgressTimelineEvent {
  const createdAt = input.createdAt ?? nowIso();
  return {
    id: `task_progress:${input.taskId}:${input.phase}:${createdAt}`,
    kind: 'task_progress',
    projectId: input.projectId,
    taskId: input.taskId,
    taskType: input.taskType,
    runnerName: input.runnerName ?? null,
    phase: input.phase,
    title: phaseTitle(input.phase),
    detail: phaseDetail(input.taskType, input.phase, input.runnerName ?? null, input.errorMessage ?? null),
    createdAt,
  };
}

export function serializeTimelineEvent(event: TaskProgressTimelineEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

class ProjectTimelineBus {
  private readonly listeners = new Map<string, Set<TaskProgressListener>>();

  private readonly history = new Map<string, TaskProgressTimelineEvent[]>();

  constructor(private readonly historyLimit = 50) {}

  publish(event: TaskProgressTimelineEvent): void {
    const nextHistory = [...(this.history.get(event.projectId) ?? []), event].slice(-this.historyLimit);
    this.history.set(event.projectId, nextHistory);

    const listeners = this.listeners.get(event.projectId);
    if (!listeners || listeners.size === 0) {
      return;
    }

    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch {
        // Listener failures should not break other subscribers.
      }
    }
  }

  subscribe(projectId: string, listener: TaskProgressListener, replayHistory = true): () => void {
    const key = projectId.trim();
    if (!key) {
      return () => undefined;
    }

    const listeners = this.listeners.get(key) ?? new Set<TaskProgressListener>();
    listeners.add(listener);
    this.listeners.set(key, listeners);

    if (replayHistory) {
      const replay = this.history.get(key) ?? [];
      for (const event of replay) {
        listener(event);
      }
    }

    return () => {
      const currentListeners = this.listeners.get(key);
      if (!currentListeners) {
        return;
      }
      currentListeners.delete(listener);
      if (currentListeners.size === 0) {
        this.listeners.delete(key);
      }
    };
  }
}

export function createProjectTimelineBus(historyLimit = 50): ProjectTimelineBus {
  return new ProjectTimelineBus(historyLimit);
}

export const projectTimelineBus = createProjectTimelineBus();
