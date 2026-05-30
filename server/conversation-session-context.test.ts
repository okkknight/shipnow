import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeText } from './taskCompletionSummary.js';

test('summaries used for session context stay short', () => {
  const text = summarizeText('第一句很长很长很长。\n第二句也很长很长很长。', 18);
  assert.equal(text, '第一句很长很长很长。 第二句也很长…');
});
