import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildConversationChatPrompt,
  buildConversationRouterPrompt,
  buildConversationTaskPrompt,
  parseConversationIntent,
} from './conversationPrompts.js';

const project = {
  displayName: 'Demo',
  projectId: 'abc123',
  publicHandle: 'demo',
};

describe('parseConversationIntent', () => {
  it('accepts strict JSON chat/task decisions', () => {
    assert.equal(parseConversationIntent('{"intent":"chat"}'), 'chat');
    assert.equal(parseConversationIntent('{"intent":"task"}'), 'task');
  });

  it('rejects freeform text and malformed payloads', () => {
    assert.throws(() => parseConversationIntent('chat'), /intent/);
    assert.throws(() => parseConversationIntent('{"type":"chat"}'), /intent/);
    assert.throws(() => parseConversationIntent('{"intent":"chat","extra":true}'), /intent/);
  });
});

describe('conversation prompts', () => {
  it('keeps the router prompt strict and machine-readable', () => {
    const prompt = buildConversationRouterPrompt(project, '帮我讨论一下这个按钮文案');

    assert.match(prompt, /{"intent":"chat"}/);
    assert.match(prompt, /{"intent":"task"}/);
    assert.match(prompt, /只输出严格 JSON/);
  });

  it('builds a chat prompt that forbids file edits and builds', () => {
    const prompt = buildConversationChatPrompt(project, '这个方案可行吗');

    assert.match(prompt, /只做自然语言回复/);
    assert.match(prompt, /不要修改文件/);
    assert.match(prompt, /不要运行构建/);
    assert.match(prompt, /回复要尽量短/);
    assert.match(prompt, /Markdown/);
  });

  it('includes current session state when provided', () => {
    const prompt = buildConversationChatPrompt(
      project,
      '刚才的任务为什么失败了',
      {
        projectStatus: 'build_failed',
        latestTaskSummary: '重新构建 · 失败 · pnpm build failed with exit code 1.',
        recentEventSummaries: ['任务执行失败：pnpm build failed with exit code 1.'],
        recentConversationTrail: ['用户：刚才的任务为什么失败了', '助手：我在处理这个请求'],
      }
    );

    assert.match(prompt, /【当前会话状态】/);
    assert.match(prompt, /项目状态：build_failed/);
    assert.match(prompt, /最近任务：重新构建 · 失败 · pnpm build failed with exit code 1\./);
    assert.match(prompt, /最近对话：用户：刚才的任务为什么失败了 \/ 助手：我在处理这个请求/);
  });

  it('builds a task prompt with the shared context and execution rules', () => {
    const prompt = buildConversationTaskPrompt(
      project,
      '帮我把这个页面改一下',
      {
        projectStatus: 'preview_ready',
        latestTaskSummary: '修改项目 · 成功',
        recentEventSummaries: ['预览已更新：最新构建已发布到预览目录。'],
        recentConversationTrail: ['用户：帮我把这个页面改一下'],
      }
    );

    assert.match(prompt, /【用户原始需求开始】/);
    assert.match(prompt, /【用户原始需求结束】/);
    assert.match(prompt, /【工作台角色】/);
    assert.match(prompt, /【共同工作法】/);
    assert.match(prompt, /【task 模式规则】/);
    assert.match(prompt, /理解上下文 -> 计划 -> 修改 -> 验证/);
    assert.match(prompt, /不要启动、占用或停留在任何长时间运行的开发服务器/);
    assert.match(prompt, /只使用现有的 ShipNow 后端或一次性短命令/);
    assert.match(prompt, /以文件修改和一次性的 pnpm build 验证为止/);
    assert.match(prompt, /最近对话：用户：帮我把这个页面改一下/);
    assert.doesNotMatch(prompt, /先判断用户本轮输入是否真的要求修改站点/);
  });
});
