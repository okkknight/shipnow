import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { TaskQueuePool } from './taskQueue.js';

test('worker pool never exceeds its configured concurrency', async () => {
  let active = 0;
  let peak = 0;
  let completed = 0;
  const tasks = [
    { id: 'task_1' },
    { id: 'task_2' },
    { id: 'task_3' },
    { id: 'task_4' },
  ];

  const pool = new TaskQueuePool({
    concurrency: 2,
    claimNextTask: async () => tasks.shift() ?? null,
    runTask: async () => {
      active += 1;
      peak = Math.max(peak, active);
      await sleep(20);
      completed += 1;
      active -= 1;
    },
  });

  pool.start();
  pool.notify();
  await sleep(150);
  await pool.stop();

  assert.equal(completed, 4);
  assert.equal(peak <= 2, true);
});

test('worker pool wakes idle workers when new tasks arrive', async () => {
  const claimed: string[] = [];
  let pendingTask: { id: string } | null = null;

  const pool = new TaskQueuePool({
    concurrency: 1,
    claimNextTask: async () => {
      const next = pendingTask;
      pendingTask = null;
      return next;
    },
    runTask: async (task: { id: string }) => {
      claimed.push(task.id);
    },
  });

  pool.start();
  pool.notify();
  await sleep(20);
  pendingTask = { id: 'task_late' };
  pool.notify();
  await sleep(20);
  await pool.stop();

  assert.deepEqual(claimed, ['task_late']);
});
