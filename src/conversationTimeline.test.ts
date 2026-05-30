import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildConversationTimeline } from './conversationTimeline.js';
import type { ProjectDetailResponse } from './types';

describe('buildConversationTimeline', () => {
  it('merges messages and events into a single ordered timeline', () => {
    const detail: ProjectDetailResponse = {
      project: {} as ProjectDetailResponse['project'],
      tasks: [],
      messages: [
        {
          id: 'message-1',
          projectId: 'project-1',
          taskId: null,
          role: 'user',
          content: '我想要一个更轻一点的首页。',
          createdAt: '2026-05-29T10:00:00.000Z',
        },
        {
          id: 'message-2',
          projectId: 'project-1',
          taskId: 'task-1',
          role: 'assistant',
          content: '收到，我来调整首屏层次。',
          createdAt: '2026-05-29T10:00:03.000Z',
        },
      ],
      events: [
        {
          id: 'event-1',
          projectId: 'project-1',
          taskId: 'task-1',
          type: 'task_progress',
          title: 'Codex 正在执行',
          detail: '正在调整布局和间距。',
          data: { step: 'layout', percent: 42 },
          createdAt: '2026-05-29T10:00:02.000Z',
        },
      ],
      releases: [],
    };

    const items = buildConversationTimeline(detail);

    assert.deepEqual(items.map((item) => item.kind), ['message', 'event']);
    assert.equal(items[1].kind, 'event');
    if (items[1].kind === 'event') {
      assert.equal(items[1].type, 'task_progress');
      assert.equal(items[1].title, 'Codex 正在执行');
      assert.equal(items[1].detail, '正在调整布局和间距。');
      assert.deepEqual(items[1].data, { step: 'layout', percent: 42 });
    }
  });

  it('filters out system-generated assistant messages and keeps chat replies', () => {
    const detail: ProjectDetailResponse = {
      project: {} as ProjectDetailResponse['project'],
      tasks: [],
      messages: [
        {
          id: 'message-1',
          projectId: 'project-1',
          taskId: 'task-1',
          role: 'assistant',
          content: '我会直接重新构建当前项目，保持现有方向不变。',
          createdAt: '2026-05-29T10:00:00.000Z',
        },
        {
          id: 'message-2',
          projectId: 'project-1',
          taskId: null,
          role: 'assistant',
          content: '这个方案可以，先把导航栏收紧，再统一按钮层级。',
          createdAt: '2026-05-29T10:00:01.000Z',
        },
      ],
      events: [],
      releases: [],
    };

    const items = buildConversationTimeline(detail);

    assert.equal(items.length, 1);
    assert.equal(items[0].kind, 'message');
    if (items[0].kind === 'message') {
      assert.equal(items[0].content, '这个方案可以，先把导航栏收紧，再统一按钮层级。');
    }
  });

  it('filters out legacy assistant task replies even when taskId is missing', () => {
    const detail: ProjectDetailResponse = {
      project: {} as ProjectDetailResponse['project'],
      tasks: [],
      messages: [
        {
          id: 'message-1',
          projectId: 'project-1',
          taskId: null,
          role: 'assistant',
          content: '我会直接重新构建当前项目，保持现有方向不变。',
          createdAt: '2026-05-29T10:00:00.000Z',
        },
      ],
      events: [],
      releases: [],
    };

    const items = buildConversationTimeline(detail);

    assert.deepEqual(items, []);
  });

  it('filters out chat reply events from the timeline', () => {
    const detail: ProjectDetailResponse = {
      project: {} as ProjectDetailResponse['project'],
      tasks: [],
      messages: [
        {
          id: 'message-1',
          projectId: 'project-1',
          taskId: null,
          role: 'assistant',
          content: '这个方案可以，先把导航栏收紧，再统一按钮层级。',
          createdAt: '2026-05-29T10:00:01.000Z',
        },
      ],
      events: [
        {
          id: 'event-1',
          projectId: 'project-1',
          taskId: null,
          type: 'chat_replied',
          title: '聊天回复已生成',
          detail: '这个方案可以，先把导航栏收紧，再统一按钮层级。',
          data: null,
          createdAt: '2026-05-29T10:00:02.000Z',
        },
      ],
      releases: [],
    };

    const items = buildConversationTimeline(detail);

    assert.equal(items.length, 1);
    assert.equal(items[0].kind, 'message');
  });

  it('filters out queued task events from the timeline', () => {
    const detail: ProjectDetailResponse = {
      project: {} as ProjectDetailResponse['project'],
      tasks: [],
      messages: [
        {
          id: 'message-1',
          projectId: 'project-1',
          taskId: null,
          role: 'assistant',
          content: '这个方案可以，先把导航栏收紧，再统一按钮层级。',
          createdAt: '2026-05-29T10:00:01.000Z',
        },
      ],
      events: [
        {
          id: 'event-1',
          projectId: 'project-1',
          taskId: 'task-1',
          type: 'task_queued',
          title: '创建任务已排队',
          detail: '我会先准备工作区，再继续执行这次操作。',
          data: null,
          createdAt: '2026-05-29T10:00:00.000Z',
        },
      ],
      releases: [],
    };

    const items = buildConversationTimeline(detail);

    assert.equal(items.length, 1);
    assert.equal(items[0].kind, 'message');
  });

  it('returns an empty timeline when no detail is available', () => {
    assert.deepEqual(buildConversationTimeline(null), []);
  });
});
