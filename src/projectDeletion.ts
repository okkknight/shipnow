import type { ProjectView } from './types';

export const DEFERRED_DELETE_WINDOW_MS = 5_000;

export type DeferredDeletePhase = 'queued' | 'committing';

export interface DeferredDeleteState {
  projectId: string;
  displayName: string;
  publicHandle: string;
  requestedAt: number;
  executeAt: number;
  phase: DeferredDeletePhase;
}

export function createDeferredDelete(
  project: Pick<ProjectView, 'projectId' | 'displayName' | 'publicHandle'>,
  requestedAt = Date.now(),
  windowMs = DEFERRED_DELETE_WINDOW_MS
): DeferredDeleteState {
  return {
    projectId: project.projectId,
    displayName: project.displayName,
    publicHandle: project.publicHandle,
    requestedAt,
    executeAt: requestedAt + windowMs,
    phase: 'queued',
  };
}

export function markDeferredDeleteCommitting(pending: DeferredDeleteState): DeferredDeleteState {
  return {
    ...pending,
    phase: 'committing',
  };
}

export function getDeferredDeleteRemainingMs(pending: DeferredDeleteState, now = Date.now()): number {
  return Math.max(0, pending.executeAt - now);
}

export function isDeferredDeleteUndoable(pending: DeferredDeleteState, now = Date.now()): boolean {
  return pending.phase === 'queued' && getDeferredDeleteRemainingMs(pending, now) > 0;
}

export function getDeferredDeleteLabel(pending: DeferredDeleteState, now = Date.now()): string {
  const quotedName = `“${pending.displayName}”`;
  if (pending.phase === 'committing' || getDeferredDeleteRemainingMs(pending, now) <= 0) {
    return `${quotedName} 正在删除，无法撤销`;
  }

  const secondsLeft = Math.max(1, Math.ceil(getDeferredDeleteRemainingMs(pending, now) / 1000));
  return `${quotedName} 将在 ${secondsLeft} 秒后删除，可撤销`;
}
