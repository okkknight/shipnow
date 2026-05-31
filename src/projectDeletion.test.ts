import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createDeferredDelete,
  getDeferredDeleteLabel,
  getDeferredDeleteRemainingMs,
  isDeferredDeleteUndoable,
  markDeferredDeleteCommitting,
} from './projectDeletion';

describe('deferred project deletion', () => {
  it('counts down until the undo window closes and then becomes committing', () => {
    const pending = createDeferredDelete(
      {
        projectId: 'proj_123456abcdef',
        displayName: 'Moon Diary',
        publicHandle: 'moon-diary',
      },
      1_000,
      5_000
    );

    assert.equal(getDeferredDeleteRemainingMs(pending, 1_000), 5_000);
    assert.equal(getDeferredDeleteLabel(pending, 1_000), '“Moon Diary” 将在 5 秒后删除，可撤销');
    assert.equal(isDeferredDeleteUndoable(pending, 5_999), true);
    assert.equal(isDeferredDeleteUndoable(pending, 6_000), false);
    assert.equal(getDeferredDeleteLabel(markDeferredDeleteCommitting(pending), 6_000), '“Moon Diary” 正在删除，无法撤销');
  });
});
