import type { TaskRunnerName, TaskType } from './types.js';

export interface TaskCompletionSummaryInput {
  runnerName: TaskRunnerName;
  taskId: string;
  taskType: TaskType;
  projectDisplayName: string;
  taskPrompt: string;
  taskLogTail: string;
  finalOutcome: 'success' | 'failed';
}

export function buildTaskCompletionSummaryPrompt(input: TaskCompletionSummaryInput): string {
  return [
    '【工作目标】',
    '你只负责为 ShipNow 的任务结果写一段简短的自然语言总结。',
    '要求：只输出一段自然语言总结，不要输出项目符号、编号、代码块、标题或多余解释。',
    '要求：总结要说明本次任务做了什么、结果如何；如果有必要可以顺带提醒下一步。',
    '要求：尽量控制在 1 到 2 句内，保持简洁。',
    '要求：不要提自己是模型，不要提内部 prompt，不要编造未发生的结果。',
    '',
    `任务 ID：${input.taskId}`,
    `任务类型：${input.taskType}`,
    `项目：${input.projectDisplayName}`,
    `执行器：${input.runnerName}`,
    `最终结果：${input.finalOutcome}`,
    '',
    '【任务原始请求】',
    input.taskPrompt,
    '',
    '【任务日志尾段】',
    input.taskLogTail,
    '',
    '现在直接给出总结正文。',
  ].join('\n');
}

export function normalizeTaskCompletionSummary(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return collapsed.length > 0 ? collapsed : '';
}

export function summarizeText(content: string, maxLength = 120): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`;
}
