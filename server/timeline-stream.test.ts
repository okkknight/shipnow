import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createProjectTimelineBus,
  createTaskProgressEvent,
  serializeTimelineEvent,
} from './timelineBus.js';

describe('task progress timeline events', () => {
  it('creates compact human-readable task progress events', () => {
    const event = createTaskProgressEvent({
      projectId: 'proj_1',
      taskId: 'task_1',
      taskType: 'apply_change',
      phase: 'building',
      runnerName: 'codex',
      createdAt: '2026-05-29T10:00:00.000Z',
    });

    assert.deepEqual(event, {
      id: 'task_progress:task_1:building:2026-05-29T10:00:00.000Z',
      kind: 'task_progress',
      projectId: 'proj_1',
      taskId: 'task_1',
      taskType: 'apply_change',
      runnerName: 'codex',
      phase: 'building',
      title: '任务正在构建',
      detail: '修改项目 正在构建',
      createdAt: '2026-05-29T10:00:00.000Z',
    });
  });

  it('fans out to multiple project subscribers and replays buffered events', () => {
    const bus = createProjectTimelineBus();
    const seenA: Array<string> = [];
    const seenB: Array<string> = [];

    const first = createTaskProgressEvent({
      projectId: 'proj_1',
      taskId: 'task_1',
      taskType: 'create_project',
      phase: 'queued',
      runnerName: 'claude-code',
      createdAt: '2026-05-29T10:00:00.000Z',
    });

    bus.publish(first);

    const unsubscribeA = bus.subscribe('proj_1', (event) => {
      seenA.push(event.id);
    });
    const unsubscribeB = bus.subscribe('proj_1', (event) => {
      seenB.push(event.id);
    });

    const second = createTaskProgressEvent({
      projectId: 'proj_1',
      taskId: 'task_1',
      taskType: 'create_project',
      phase: 'running',
      runnerName: 'claude-code',
      createdAt: '2026-05-29T10:00:01.000Z',
    });

    bus.publish(second);

    assert.deepEqual(seenA, [first.id, second.id]);
    assert.deepEqual(seenB, [first.id, second.id]);

    unsubscribeA();
    unsubscribeB();

    assert.equal(serializeTimelineEvent(second), `data: ${JSON.stringify(second)}\n\n`);
  });
});
