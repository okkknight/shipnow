import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTaskCompletionSummaryPrompt,
  normalizeTaskCompletionSummary,
} from './taskCompletionSummary.js';

test('buildTaskCompletionSummaryPrompt asks for a short natural-language summary', () => {
  const prompt = buildTaskCompletionSummaryPrompt({
    runnerName: 'codex',
    taskId: 'task_123456789abc',
    taskType: 'apply_change',
    projectDisplayName: 'untitle-8yru',
    taskPrompt: '帮我把首页按钮做得更明显',
    taskLogTail: 'Building project with pnpm build.\nDone.',
    finalOutcome: 'success',
  });

  assert.match(prompt, /只输出一段自然语言总结/);
  assert.match(prompt, /不要输出项目符号/);
  assert.match(prompt, /task_123/);
  assert.match(prompt, /帮我把首页按钮做得更明显/);
});

test('normalizeTaskCompletionSummary collapses whitespace and preserves short content', () => {
  assert.equal(
    normalizeTaskCompletionSummary('  首页更新完成。\n\n响应式已同步。  '),
    '首页更新完成。 响应式已同步。'
  );
  assert.equal(normalizeTaskCompletionSummary('   '), '');
});
