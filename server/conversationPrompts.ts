import type { ProjectRecord } from './types.js';

export type ConversationIntent = 'chat' | 'task';

export interface ConversationProjectContext {
  displayName: string;
  projectId: string;
  publicHandle: string;
}

export interface ConversationSessionContext {
  projectStatus: string;
  latestTaskSummary: string | null;
  recentEventSummaries: string[];
  recentConversationTrail: string[];
}

const CONVERSATION_INTENT_ERROR = 'Conversation router must return {"intent":"chat"} or {"intent":"task"}';

function buildProjectContextLine(project: ConversationProjectContext): string {
  return `当前项目为 ${project.displayName}（projectId: ${project.projectId}, handle: ${project.publicHandle}）。`;
}

function buildSessionContextLines(session: ConversationSessionContext | null | undefined): string[] {
  if (!session) {
    return [];
  }

  const lines = [
    '【当前会话状态】',
    `- 项目状态：${session.projectStatus}`,
    session.latestTaskSummary ? `- 最近任务：${session.latestTaskSummary}` : null,
    session.recentEventSummaries.length > 0 ? `- 最近事件：${session.recentEventSummaries.join(' / ')}` : null,
    session.recentConversationTrail.length > 0 ? `- 最近对话：${session.recentConversationTrail.join(' / ')}` : null,
  ];

  return lines.filter((line): line is string => Boolean(line));
}

function buildSharedWorkingMethodLines(): string[] {
  return [
    '你需要先结合项目上下文、当前会话状态和最近记录，再判断该回答还是该执行。',
    '如果用户提到“刚才 / 之前 / 那个任务 / 前面聊过的事情”，先顺着最近任务、最近事件、最近对话和当前项目状态去定位，不要把它当成全新的孤立问题。',
    '如果一层信息不够，就继续向下查看工作区文件、日志、实现和项目文档，再决定是否需要追问。',
    '始终优先最小正确结果：能直接回答就直接回答，能小改就小改，能验证就验证。',
  ];
}

function buildModeSpecificLines(mode: 'chat' | 'task'): string[] {
  if (mode === 'chat') {
    return [
      '【chat 模式规则】',
      '你是工作台里的对话助手，只做自然语言回复，不要修改文件，不要运行构建，不要创建任务，不要声称已经执行。',
      '用户如果在问之前的任务、失败原因、进度、比较方案或历史对话，你要优先根据当前会话状态和项目证据自己追溯，再给出简洁结论。',
      '如果当前信息仍不足以可靠回答，先说明你缺少哪一块证据，再向用户补问；不要编造。',
      '回复要尽量短，优先 3 条以内的要点，整体尽量控制在 120 到 220 字；如果适合，优先使用 Markdown，但只允许一个小标题 + 最多 3 条一级要点。',
      '如果回答需要引用状态、原因或结果，优先给结论，再给要点或下一步。',
      '如果你需要从仓库里追查线索，优先查看相关文件、任务日志、事件记录和最近对话，再回答。',
    ];
  }

  return [
    '【task 模式规则】',
    '你是执行型代理，目标是把用户明确要求的修改真正落地并验证。',
    '在动手前先根据当前会话状态、最近任务、最近事件、相关日志、相关文件和项目文档确认现状，不要只看用户这一句。',
    '如果这次任务是在处理前一个失败、上一次讨论过的方案或某个历史上下文，先顺着最近记录和代码实现把它定位清楚，再开始修改。',
    '采用“理解上下文 -> 计划 -> 修改 -> 验证”的工作方式；修改时优先复用现有组件、样式、逻辑和约束，尽量保持最小可行变更。',
    '如果需要查阅实现或日志，先看当前项目状态、最近任务摘要、最近事件摘要、相关源码和构建结果，再决定改动。',
    '不要启动、占用或停留在任何长时间运行的开发服务器，例如 vite dev、vite preview 或 npm run dev；ShipNow 会在你完成文件修改后自行执行 build 和发布验证。',
    '如果确实需要依赖后端接口，只使用现有的 ShipNow 后端或一次性短命令，并且完成后必须退出，不要把常驻前端服务器留在进程里。',
    '这类任务应以文件修改和一次性的 pnpm build 验证为止，不要把运行本地站点当成任务完成的一部分。',
    '完成后必须验证结果是否满足需求，并给出简短总结；如果失败，说明真正失败点，不要泛泛而谈。',
  ];
}

function buildPromptEnvelope(
  project: ConversationProjectContext,
  session: ConversationSessionContext | null | undefined,
  mode: 'chat' | 'task',
  requestPrompt: string
): string {
  return [
    '【工作台角色】',
    buildProjectContextLine(project),
    `你是 ShipNow 的${mode === 'chat' ? '工作台对话助手' : '任务执行代理'}。`,
    '【共同工作法】',
    ...buildSharedWorkingMethodLines(),
    ...buildSessionContextLines(session),
    ...buildModeSpecificLines(mode),
    '',
    '【用户原始需求开始】',
    requestPrompt,
    '【用户原始需求结束】',
  ].join('\n\n');
}

function validateIntentPayload(value: unknown): value is { intent: ConversationIntent } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value);
  if (entries.length !== 1 || !Object.prototype.hasOwnProperty.call(value, 'intent')) {
    return false;
  }

  return (value as { intent?: unknown }).intent === 'chat' || (value as { intent?: unknown }).intent === 'task';
}

export function parseConversationIntent(raw: string): ConversationIntent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(CONVERSATION_INTENT_ERROR);
  }

  if (!validateIntentPayload(parsed)) {
    throw new Error(CONVERSATION_INTENT_ERROR);
  }

  return parsed.intent;
}

export function buildConversationRouterPrompt(project: ConversationProjectContext, requestPrompt: string): string {
  return [
    buildProjectContextLine(project),
    '你是 ShipNow 的意图路由器，只需要判断当前输入是 chat 还是 task。',
    'chat = 纯聊天、讨论方案、解释原因、表达感受、给建议，不要求改代码。',
    'task = 明确要求创建、修改、修复、优化、实现当前站点。',
    '如果不确定，默认输出 {"intent":"chat"}。',
    '只输出严格 JSON，不要输出多余文字。',
    '输出只能是下面两种之一：',
    '{"intent":"chat"}',
    '{"intent":"task"}',
    '',
    '【用户原始需求开始】',
    requestPrompt,
    '【用户原始需求结束】',
  ].join('\n\n');
}

export function buildConversationChatPrompt(
  project: ConversationProjectContext,
  requestPrompt: string,
  session?: ConversationSessionContext | null
): string {
  return buildPromptEnvelope(project, session, 'chat', requestPrompt);
}

export function buildConversationTaskPrompt(
  project: ConversationProjectContext,
  requestPrompt: string,
  session?: ConversationSessionContext | null
): string {
  return buildPromptEnvelope(project, session, 'task', requestPrompt);
}

export function toConversationProjectContext(project: ProjectRecord): ConversationProjectContext {
  return {
    displayName: project.display_name,
    projectId: project.project_id,
    publicHandle: project.public_handle,
  };
}
