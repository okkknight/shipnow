import type { ProjectDetailResponse, ProjectEventView, ProjectMessageView } from './types';

export interface ConversationTimelineMessageItem {
  kind: 'message';
  id: string;
  createdAt: string;
  role: ProjectMessageView['role'];
  content: string;
}

export interface ConversationTimelineEventItem {
  kind: 'event';
  id: string;
  createdAt: string;
  taskId: string | null;
  title: string;
  detail: string | null;
  type: string;
  data: Record<string, unknown> | null;
}

export type ConversationTimelineItem = ConversationTimelineMessageItem | ConversationTimelineEventItem;

type ConversationTimelineSource = Pick<ProjectDetailResponse, 'messages' | 'events'> | null;

const SYSTEM_MESSAGE_PREFIXES = [
  '已为你生成项目',
  '收到，我会直接修改当前项目并重新构建预览。',
  '我会直接修改当前项目并重新构建预览。',
  '这次操作失败了：',
  '预览已经准备好了，你可以继续修改或直接发布。',
  '修改完成，新的预览已经更新。',
  '重新构建完成，预览保持最新。',
  '我会直接重新构建当前项目，保持现有方向不变。',
  '已经发布完成，公开地址是',
  '项目已经删除，相关工作区也已清理。',
  '项目名称已更新为',
  '正在发布',
  '正在重新构建',
  '正在删除',
] as const;

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isSystemGeneratedMessage(content: string): boolean {
  return SYSTEM_MESSAGE_PREFIXES.some((prefix) => content.startsWith(prefix));
}

export function buildConversationTimeline(detail: ConversationTimelineSource): ConversationTimelineItem[] {
  if (!detail) {
    return [];
  }

  const messageItems: Array<ConversationTimelineMessageItem & { order: number }> = detail.messages
    .filter((message) => !(message.role === 'assistant' && (message.taskId !== null || isSystemGeneratedMessage(message.content))))
    .map((message, order): ConversationTimelineMessageItem & { order: number } => ({
      kind: 'message',
      id: message.id,
      createdAt: message.createdAt,
      role: message.role,
      content: message.content,
      order,
    }));

  const eventItems: Array<ConversationTimelineEventItem & { order: number }> = detail.events.map((event, order) => ({
    kind: 'event',
    id: event.id,
    createdAt: event.createdAt,
    taskId: event.taskId,
    title: event.title,
    detail: event.detail,
    type: event.type,
    data: event.data,
    order,
  }) as ConversationTimelineEventItem & { order: number }).filter(
    (event) => event.type !== 'chat_replied' && event.type !== 'task_queued'
  );

  return [...messageItems, ...eventItems]
    .sort((left, right) => {
      const timeDelta = toTimestamp(left.createdAt) - toTimestamp(right.createdAt);
      if (timeDelta !== 0) {
        return timeDelta;
      }

      if (left.kind !== right.kind) {
        return left.kind === 'message' ? -1 : 1;
      }

      return left.order - right.order;
    })
    .map(({ order: _order, ...item }) => item);
}
