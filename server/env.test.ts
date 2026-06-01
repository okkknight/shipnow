import assert from 'node:assert/strict';
import test from 'node:test';
import { loadEnv } from './env.js';

test('loadEnv defaults task concurrency to 10', () => {
  const previous = process.env.SHIPNOW_TASK_CONCURRENCY;
  delete process.env.SHIPNOW_TASK_CONCURRENCY;

  try {
    const env = loadEnv();
    assert.equal(env.taskConcurrency, 10);
  } finally {
    if (previous === undefined) {
      delete process.env.SHIPNOW_TASK_CONCURRENCY;
    } else {
      process.env.SHIPNOW_TASK_CONCURRENCY = previous;
    }
  }
});

test('loadEnv reads task concurrency from SHIPNOW_TASK_CONCURRENCY', () => {
  const previous = process.env.SHIPNOW_TASK_CONCURRENCY;
  process.env.SHIPNOW_TASK_CONCURRENCY = '7';

  try {
    const env = loadEnv();
    assert.equal(env.taskConcurrency, 7);
  } finally {
    if (previous === undefined) {
      delete process.env.SHIPNOW_TASK_CONCURRENCY;
    } else {
      process.env.SHIPNOW_TASK_CONCURRENCY = previous;
    }
  }
});
