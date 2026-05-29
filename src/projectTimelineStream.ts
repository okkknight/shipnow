import { getApiBase } from './api';

export interface ProjectTimelineStreamEvent {
  type: string;
  projectId: string;
  taskId: string | null;
  createdAt: string;
  title?: string;
  detail?: string | null;
  data?: Record<string, unknown> | null;
}

export function subscribeProjectTimeline(projectId: string, onEvent: (event: ProjectTimelineStreamEvent) => void): EventSource {
  const source = new EventSource(`${getApiBase()}/projects/${encodeURIComponent(projectId)}/timeline/stream`);
  source.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data) as ProjectTimelineStreamEvent);
    } catch {
      // Ignore malformed SSE frames until the backend stream contract lands.
    }
  };
  return source;
}
