export type TaskRunnerName = 'codex' | 'claude-code';

export type RunnerBackendName = 'openai' | 'deepseek';

const TASK_RUNNER_LABELS: Record<TaskRunnerName, string> = {
  codex: 'Codex',
  'claude-code': 'Claude Code',
};

const TASK_RUNNER_BACKENDS: Record<TaskRunnerName, RunnerBackendName> = {
  codex: 'openai',
  'claude-code': 'deepseek',
};

export function isTaskRunnerName(value: unknown): value is TaskRunnerName {
  return value === 'codex' || value === 'claude-code';
}

export function parseTaskRunnerName(value: unknown, fallback: TaskRunnerName = 'codex'): TaskRunnerName {
  return isTaskRunnerName(value) ? value : fallback;
}

export function taskRunnerLabel(runner: TaskRunnerName): string {
  return TASK_RUNNER_LABELS[runner];
}

export function taskRunnerBackend(runner: TaskRunnerName): RunnerBackendName {
  return TASK_RUNNER_BACKENDS[runner];
}

export function taskRunnerBackendLabel(backend: RunnerBackendName): string {
  return backend === 'openai' ? 'GPT' : 'DeepSeek';
}

export function taskRunnerSummary(runner: TaskRunnerName): string {
  return `${taskRunnerLabel(runner)} · ${taskRunnerBackendLabel(taskRunnerBackend(runner))}`;
}
