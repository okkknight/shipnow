import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  CircleAlert,
  Copy,
  Edit2,
  Eye,
  Globe,
  Folder,
  LayoutGrid,
  Info,
  Menu,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Settings2,
  Upload,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';
import {
  getAppSettings,
  applyChange,
  createProject,
  deleteProject,
  getApiBase,
  getProject,
  publishProject,
  rebuildProject,
  renameProject,
  listProjects,
  updateAppSettings,
  updateProjectSettings,
} from './api';
import { buildConversationTimeline, type ConversationTimelineItem } from './conversationTimeline';
import { RichTextMessage } from './messageFormatting';
import { subscribeProjectTimeline } from './projectTimelineStream';
import type {
  ProjectDetailResponse,
  ProjectMessageView,
  ProjectView,
  TaskView,
  TaskRunnerName,
  AppSettingsView,
} from './types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChatBubble,
  Composer,
  ConfirmationSheet as SnConfirmationSheet,
  DrawerMock,
  EmptyState,
  ProjectCard,
  QuickActionChip,
  SnButton,
  StatusChip,
  TopBar,
} from './shipnow-ui';
import {
  MobileActionButton,
  MobileCompactHeader,
  MobileIconButton,
  MobilePageSurface,
  MobileStatusPill,
} from './shipnow-real-ui';
import { ShipNowDesignSystemPage, ShipNowVisualReferencePage, SnActionButton } from './shipnow-reference-pages';
import { MobilePreviewPage, MobilePublishResultPage } from './shipnow-pages';

type RouteState =
  | { kind: 'home' }
  | { kind: 'project'; projectId: string }
  | { kind: 'project-preview'; projectId: string }
  | { kind: 'publish-success'; projectId: string }
  | { kind: 'publish-failure'; projectId: string }
  | { kind: 'settings' }
  | { kind: 'templates' }
  | { kind: 'projects' }
  | { kind: 'design-system' }
  | { kind: 'visual-reference' };

interface PendingConversationState {
  id: string;
  startedAt: string;
  prompt: string;
}

const RESERVED_HANDLES = new Set([
  'shipnow',
  'api',
  'admin',
  'assets',
  'static',
  'preview',
  'health',
  'login',
  'logout',
  'auth',
  'dashboard',
  'settings',
  'projects',
  'new',
  'system',
  'public',
  'private',
]);

const TEMPLATE_PROMPTS = [
  '做一个干净、现代的产品官网，首屏突出价值主张和行动按钮。',
  '做一个个人主页，包含简介、作品、联系入口和轻量的作品展示。',
  '做一个小游戏，风格轻松、有反馈、有明确的得分或胜负逻辑。',
  '做一个工具站，强调输入、结果、状态反馈和易用性。',
  '做一个活动页，带强视觉冲击和明确的报名 / 购买转化。',
  '做一个空白项目，先搭好结构，再让我继续细化。',
];

const TASK_RUNNER_META: Record<TaskRunnerName, { label: string; backend: string; description: string }> = {
  codex: {
    label: 'Codex',
    backend: 'GPT',
    description: '继续沿用现有 GPT 执行链路，默认优先使用。',
  },
  'claude-code': {
    label: 'Claude Code',
    backend: 'DeepSeek',
    description: '通过 Claude Code CLI 执行，后端接 DeepSeek。',
  },
};

function normalizeAppBase(base: string): string {
  const trimmed = base.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

const APP_BASE = normalizeAppBase(import.meta.env.BASE_URL || '/shipnow/');

function toAppPath(pathname: string): string {
  const next = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (!APP_BASE) {
    return next;
  }
  return next === '/' ? `${APP_BASE}/` : `${APP_BASE}${next}`;
}

function stripAppBase(pathname: string): string {
  if (!APP_BASE) {
    return pathname || '/';
  }
  if (pathname === APP_BASE || pathname === `${APP_BASE}/`) {
    return '/';
  }
  if (pathname.startsWith(`${APP_BASE}/`)) {
    return pathname.slice(APP_BASE.length);
  }
  return pathname || '/';
}

function parseRoute(pathname: string): RouteState {
  const path = stripAppBase(pathname).replace(/\/+$/, '') || '/';
  const segments = path.split('/').filter(Boolean);
  if (segments[0] === 'design-system') {
    return { kind: 'design-system' };
  }
  if (segments[0] === 'visual-reference') {
    return { kind: 'visual-reference' };
  }
  if (segments[0] === 'project' && segments[1]) {
    if (segments[2] === 'preview') {
      return { kind: 'project-preview', projectId: decodeURIComponent(segments[1]) };
    }
    if (segments[2] === 'publish-success') {
      return { kind: 'publish-success', projectId: decodeURIComponent(segments[1]) };
    }
    if (segments[2] === 'publish-failure') {
      return { kind: 'publish-failure', projectId: decodeURIComponent(segments[1]) };
    }
    return { kind: 'project', projectId: decodeURIComponent(segments[1]) };
  }
  if (segments[0] === 'templates') {
    return { kind: 'templates' };
  }
  if (segments[0] === 'projects') {
    return { kind: 'projects' };
  }
  if (segments[0] === 'settings') {
    return { kind: 'settings' };
  }
  return { kind: 'home' };
}

function useWorkspaceRoute() {
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string): void => {
    const nextPath = toAppPath(path);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
      setRoute(parseRoute(window.location.pathname));
    }
  };

  return { route, navigate };
}

function useMediaQuery(query: string): boolean {
  const getMatches = () => window.matchMedia(query).matches;
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQueryList.matches);
    handleChange();

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleChange);
      return () => mediaQueryList.removeEventListener('change', handleChange);
    }

    mediaQueryList.addListener(handleChange);
    return () => mediaQueryList.removeListener(handleChange);
  }, [query]);

  return matches;
}

function useDrawerTransition(open: boolean, durationMs = 320): { shouldRender: boolean; isOpen: boolean } {
  const [shouldRender, setShouldRender] = useState(open);
  const [isOpen, setIsOpen] = useState(open);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      let secondFrame = 0;
      const firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          setIsOpen(true);
        });
      });
      return () => {
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
      };
    }

    setIsOpen(false);
    const timeout = window.setTimeout(() => {
      setShouldRender(false);
    }, durationMs);
    return () => window.clearTimeout(timeout);
  }, [durationMs, open]);

  return { shouldRender, isOpen };
}

function slugifyHandle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .replace(/-{2,}/g, '-');
}

function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.toLowerCase());
}

function validateHandle(value: string): string | null {
  if (value.length < 3) {
    return '名称至少 3 个字符。';
  }
  if (value.length > 48) {
    return '名称最多 48 个字符。';
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return '只能使用小写字母、数字和短横线。';
  }
  if (isReservedHandle(value)) {
    return '这个名称被系统保留了。';
  }
  return null;
}

function formatTime(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatElapsedTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}小时${String(minutes).padStart(2, '0')}分`;
  }
  if (minutes > 0) {
    return `${minutes}分${String(seconds).padStart(2, '0')}秒`;
  }
  return `${seconds}秒`;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'generating':
      return '生成中';
    case 'build_failed':
      return '生成失败';
    case 'preview_ready':
      return '预览已就绪';
    case 'published':
      return '已上线';
    case 'publishing':
      return '正在发布';
    case 'publish_failed':
      return '发布失败';
    case 'deleted':
      return '已删除';
    case 'pending':
      return '等待中';
    case 'running':
      return '执行中';
    case 'success':
      return '成功';
    case 'failed':
      return '失败';
    case 'cancelled':
      return '已取消';
    default:
      return status.replace(/_/g, ' ');
  }
}

function statusTone(status: string): string {
  switch (status) {
    case 'published':
    case 'preview_ready':
    case 'success':
      return 'tone-success';
    case 'generating':
    case 'running':
    case 'publishing':
    case 'pending':
      return 'tone-warm';
    case 'build_failed':
    case 'publish_failed':
    case 'failed':
      return 'tone-danger';
    case 'deleted':
      return 'tone-muted';
    default:
      return 'tone-neutral';
  }
}

function statusDescription(status: string): string {
  switch (status) {
    case 'preview_ready':
      return '预览已就绪，随时可以发布到线上。';
    case 'published':
      return '当前版本已经发布到正式站点。';
    case 'generating':
    case 'publishing':
      return '项目正在处理，请稍等片刻再查看。';
    case 'build_failed':
    case 'publish_failed':
    case 'failed':
      return '当前版本需要修复后再继续。';
    case 'draft':
      return '还在起步阶段，可以先从一句话开始。';
    case 'deleted':
      return '该项目已删除。';
    default:
      return '状态信息会随着当前项目实时更新。';
  }
}

function taskRunnerLabel(runner: TaskRunnerName): string {
  return TASK_RUNNER_META[runner].label;
}

function taskRunnerBackendLabel(runner: TaskRunnerName): string {
  return TASK_RUNNER_META[runner].backend;
}

function taskRunnerDescription(runner: TaskRunnerName): string {
  return TASK_RUNNER_META[runner].description;
}

function taskStatusLabel(status: string): string {
  return statusLabel(status);
}

function taskTypeLabel(type: string): string {
  switch (type) {
    case 'create_project':
      return '创建项目';
    case 'apply_change':
      return '应用修改';
    case 'rebuild':
      return '重新构建';
    case 'publish':
      return '发布上线';
    case 'delete_project':
      return '删除项目';
    default:
      return type;
  }
}

function eventTitle(type: string): string {
  switch (type) {
    case 'project_created':
      return '项目已创建';
    case 'task_queued':
      return '任务已排队';
    case 'task_started':
      return '任务开始';
    case 'task_completed':
      return '任务完成';
    case 'task_failed':
      return '任务失败';
    case 'preview_ready':
    case 'preview_refreshed':
      return '预览已更新';
    case 'publish_requested':
      return '请求发布';
    case 'published':
      return '发布成功';
    case 'delete_requested':
      return '请求删除';
    case 'deleted':
      return '项目已删除';
    case 'project_renamed':
      return '项目已重命名';
    default:
      return type;
  }
}

function buildAutoFixPrompt(detail: ProjectDetailResponse | null): string {
  const latestFailureEvent = detail?.events.slice().reverse().find((event) => event.type === 'task_failed');
  const latestTask = detail?.tasks[0] ?? null;
  const errorMessage = latestTask?.errorMessage || latestFailureEvent?.detail || '没有额外错误信息。';
  return [
    '请根据最近一次失败信息自动修复当前项目，并保持原有产品意图不变。',
    `失败信息：${errorMessage}`,
    '修复完成后请重新构建预览。',
  ].join('\n');
}

function App() {
  const { route, navigate } = useWorkspaceRoute();
  const isEnhancedRoute = route.kind === 'design-system' || route.kind === 'visual-reference';
  const isMobileLayout = useMediaQuery('(max-width: 767px)');
  const previewConfirmDebug = new URLSearchParams(window.location.search).get('confirmPublish') === '1';
  const settingsProjectId = new URLSearchParams(window.location.search).get('projectId');
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerPrompt, setComposerPrompt] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [pendingConversation, setPendingConversation] = useState<PendingConversationState | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const routeProjectId =
    route.kind === 'project' || route.kind === 'project-preview' || route.kind === 'publish-success' || route.kind === 'publish-failure'
      ? route.projectId
      : null;
  const currentProject = useMemo(
    () =>
      routeProjectId
        ? detail?.project?.projectId === routeProjectId
          ? detail.project
          : projects.find((project) => project.projectId === routeProjectId) ?? null
        : null,
    [detail, projects, routeProjectId]
  );

  const timelineItems = useMemo(() => buildConversationTimeline(detail), [detail]);

  const activeTasks = projects.filter((project) => ['generating', 'publishing'].includes(project.status)).length;
  const publishedProjects = projects.filter((project) => project.status === 'published').length;
  const failedProjects = projects.filter((project) => ['build_failed', 'publish_failed'].includes(project.status)).length;

  async function refreshProjects(): Promise<void> {
    if (isEnhancedRoute) {
      return;
    }
    try {
      const response = await listProjects();
      setProjects(response.projects);
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setProjectsLoading(false);
    }
  }

  async function refreshDetail(projectId: string): Promise<void> {
    if (isEnhancedRoute) {
      return;
    }
    setDetailLoading(true);
    try {
      const response = await getProject(projectId);
      setDetail(response);
      setRenameDraft(response.project.displayName);
      setRenameError(null);
      setError(null);
    } catch (refreshError) {
      setDetail(null);
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (isEnhancedRoute) {
      return;
    }
    void refreshProjects();
  }, [isEnhancedRoute]);

  useEffect(() => {
    if (isEnhancedRoute) {
      return;
    }
    if (routeProjectId) {
      setDetail(null);
      void refreshDetail(routeProjectId);
    } else {
      setDetail(null);
    }
  }, [isEnhancedRoute, route.kind, routeProjectId]);

  useEffect(() => {
    if (isEnhancedRoute) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshProjects();
      if (routeProjectId) {
        void refreshDetail(routeProjectId);
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isEnhancedRoute, route.kind, routeProjectId]);

  useEffect(() => {
    if (isEnhancedRoute || !routeProjectId) {
      return;
    }

    const source = subscribeProjectTimeline(routeProjectId, () => {
      void refreshDetail(routeProjectId);
    });

    return () => {
      source.close();
    };
  }, [isEnhancedRoute, refreshDetail, routeProjectId]);

  useEffect(() => {
    if (isEnhancedRoute) {
      return;
    }
    if (!conversationRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const container = conversationRef.current;
      if (!container) {
        return;
      }
      container.scrollTop = container.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isEnhancedRoute, timelineItems.length, pendingConversation?.id, route.kind, routeProjectId]);

  const createFromComposer = route.kind === 'home';
  const canSubmitComposer = composerPrompt.trim().length > 0 && activeAction === null;
  const canPublish = Boolean(currentProject && ['preview_ready', 'published', 'publish_failed'].includes(currentProject.status));
  const canAutoFix = Boolean(currentProject && detail && ['build_failed', 'publish_failed', 'failed'].includes(currentProject.status));
  const renameNormalized = slugifyHandle(renameDraft);
  const renameValidation = renameDraft.trim().length > 0 ? validateHandle(renameNormalized) : '名称不能为空。';
  const renameDirty = Boolean(currentProject && renameNormalized !== currentProject.publicHandle);
  const publishSheetOpen = publishConfirmOpen || previewConfirmDebug;

  useEffect(() => {
    if (!publishSheetOpen) {
      return;
    }

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlOverscroll = documentElement.style.overscrollBehavior;

    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [publishSheetOpen]);

  async function handleComposerSubmit(): Promise<void> {
    const prompt = composerPrompt.trim();
    if (!prompt) {
      setError('请输入一句话描述。');
      return;
    }
    const pendingId = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const submittedAt = new Date().toISOString();
    const optimisticUserMessage: ProjectMessageView = {
      id: pendingId,
      projectId: currentProject?.projectId ?? 'pending',
      taskId: null,
      role: 'user',
      content: prompt,
      createdAt: submittedAt,
    };
    const previousDetail = detail;
    setComposerPrompt('');
    setPendingConversation({ id: pendingId, startedAt: submittedAt, prompt });

    if (createFromComposer) {
      setActiveAction('create');
      try {
        const result = await createProject({ prompt });
        await refreshProjects();
        navigate(`/project/${result.project.projectId}`);
        setSidebarOpen(false);
        setError(null);
      } catch (createError) {
        setComposerPrompt(prompt);
        setError(createError instanceof Error ? createError.message : String(createError));
      } finally {
        setPendingConversation(null);
        setActiveAction(null);
      }
      return;
    }

    if (!currentProject) {
      return;
    }

    setActiveAction('change');
    try {
      setDetail((current) => {
        if (!current || current.project.projectId !== currentProject.projectId) {
          return current;
        }
        return {
          ...current,
          messages: [...current.messages, optimisticUserMessage],
        };
      });
      const result = await applyChange(currentProject.projectId, prompt);
      await refreshProjects();
      if ('kind' in result && result.kind === 'chat') {
        setDetail((current) => {
          if (!current || current.project.projectId !== currentProject.projectId) {
            return current;
          }
          return {
            ...current,
            project: result.project,
            messages: [...current.messages, result.assistantMessage],
          };
        });
      } else {
        await refreshDetail(result.project.projectId);
      }
      setError(null);
    } catch (changeError) {
      setDetail(previousDetail);
      setComposerPrompt(prompt);
      setError(changeError instanceof Error ? changeError.message : String(changeError));
    } finally {
      setPendingConversation(null);
      setActiveAction(null);
    }
  }

  async function handleRebuild(): Promise<void> {
    if (!currentProject) {
      return;
    }
    setActiveAction('rebuild');
    try {
      const result = await rebuildProject(currentProject.projectId);
      await refreshProjects();
      await refreshDetail(result.project.projectId);
    } catch (rebuildError) {
      setError(rebuildError instanceof Error ? rebuildError.message : String(rebuildError));
    } finally {
      setActiveAction(null);
    }
  }

  async function handlePublish(): Promise<void> {
    if (!currentProject) {
      return;
    }
    setActiveAction('publish');
    try {
      const result = await publishProject(currentProject.projectId);
      setPublishConfirmOpen(false);
      await refreshProjects();
      await refreshDetail(result.project.projectId);
      navigate(`/project/${result.project.projectId}/publish-success`);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : String(publishError));
      if (currentProject) {
        navigate(`/project/${currentProject.projectId}/publish-failure`);
      }
    } finally {
      setActiveAction(null);
    }
  }

  async function handleAutoFix(): Promise<void> {
    if (!currentProject) {
      return;
    }
    setActiveAction('auto-fix');
    try {
      const result = await applyChange(currentProject.projectId, buildAutoFixPrompt(detail));
      await refreshProjects();
      await refreshDetail(result.project.projectId);
      setComposerPrompt('');
    } catch (autoFixError) {
      setError(autoFixError instanceof Error ? autoFixError.message : String(autoFixError));
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRename(): Promise<void> {
    if (!currentProject) {
      return;
    }
    if (!renameDirty) {
      return;
    }
    if (renameValidation) {
      setRenameError(renameValidation);
      return;
    }
    setActiveAction('rename');
    try {
      await renameProject(currentProject.projectId, renameNormalized);
      await refreshProjects();
      await refreshDetail(currentProject.projectId);
      setRenameError(null);
    } catch (renameActionError) {
      setRenameError(renameActionError instanceof Error ? renameActionError.message : String(renameActionError));
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!currentProject) {
      return;
    }
    setActiveAction('delete');
    try {
      await deleteProject(currentProject.projectId);
      setDeleteConfirmOpen(false);
      navigate('/');
      await refreshProjects();
      setDetail(null);
      setComposerPrompt('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setActiveAction(null);
    }
  }

  const homeRecentProjects = projects.slice(0, 4);
  const currentTasks = detail?.tasks ?? [];
  const latestTask = currentTasks[0] ?? null;

  if (route.kind === 'design-system') {
    return <ShipNowDesignSystemPage />;
  }

  if (route.kind === 'visual-reference') {
    return <ShipNowVisualReferencePage />;
  }

  let page: ReactElement;

  if (route.kind === 'project-preview' && currentProject) {
    page = isMobileLayout ? (
      <MobilePreviewPage
        projectName={currentProject.displayName}
        previewUrl={currentProject.previewUrl}
        onBackEdit={() => navigate(`/project/${currentProject.projectId}`)}
        onPublish={() => setPublishConfirmOpen(true)}
      />
    ) : (
      <ProjectPreviewWorkspace
        project={currentProject}
        onBackEdit={() => navigate(`/project/${currentProject.projectId}`)}
        onPublish={() => setPublishConfirmOpen(true)}
      />
    );
  } else if ((route.kind === 'publish-success' || route.kind === 'publish-failure') && currentProject) {
    page = isMobileLayout ? (
      <MobilePublishResultPage
        success={route.kind === 'publish-success'}
        publicUrl={currentProject.publicUrl}
        onOpenWebsite={() => window.open(currentProject.publicUrl, '_blank', 'noopener,noreferrer')}
        onCopyLink={() => navigator.clipboard.writeText(currentProject.publicUrl).catch(() => undefined)}
        onContinueEditing={() => navigate(`/project/${currentProject.projectId}`)}
        onAutoFix={handleAutoFix}
        onViewLogs={() => setStatusOpen(true)}
      />
    ) : (
      <PublishResultWorkspace
        project={currentProject}
        success={route.kind === 'publish-success'}
        onOpenWebsite={() => window.open(currentProject.publicUrl, '_blank', 'noopener,noreferrer')}
        onCopyLink={() => navigator.clipboard.writeText(currentProject.publicUrl).catch(() => undefined)}
        onContinueEditing={() => navigate(`/project/${currentProject.projectId}`)}
        onAutoFix={handleAutoFix}
        onViewLogs={() => setStatusOpen(true)}
      />
    );
  } else if (route.kind === 'templates') {
    page = (
      <TemplatesWorkspace
        onBackHome={() => navigate('/')}
        onSelectTemplate={(prompt) => setComposerPrompt(prompt)}
        projectsLoading={projectsLoading}
        recentProjects={homeRecentProjects}
        navigate={navigate}
      />
    );
  } else if (route.kind === 'projects') {
    page = (
      <ProjectsWorkspace
        projects={projects}
        projectsLoading={projectsLoading}
        onOpenProject={(projectId) => navigate(`/project/${projectId}`)}
        onBackHome={() => navigate('/')}
        recentProjects={homeRecentProjects}
        navigate={navigate}
      />
    );
  } else if (route.kind === 'settings') {
    page = (
      <SettingsWorkspace
        onOpenMenu={() => setSidebarOpen(true)}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        projectsLoading={projectsLoading}
        projects={projects}
        recentProjects={homeRecentProjects}
        selectedProjectId={settingsProjectId}
        refreshProjects={refreshProjects}
        navigate={navigate}
      />
    );
  } else if (route.kind === 'home') {
    page = (
      <HomeWorkspace
        composerPrompt={composerPrompt}
        setComposerPrompt={setComposerPrompt}
        onSubmit={handleComposerSubmit}
        canSubmit={canSubmitComposer}
        activeAction={activeAction}
        recentProjects={homeRecentProjects}
        apiBase={getApiBase()}
        projectsLoading={projectsLoading}
        homeRecentProjects={homeRecentProjects}
        route={route}
        navigate={navigate}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
    );
  } else if (detailLoading && !detail) {
    page = (
      <div className="sn-page">
        <div className="sn-page-backdrop" />
        <div className="sn-page-shell">
          <EmptyState title="正在读取项目详情…" description="稍等一下，ShipNow 正在把当前项目和最近任务加载出来。" icon={<Sparkles className="size-6" />} />
        </div>
      </div>
    );
  } else if (currentProject) {
    page = (
      <ProjectWorkspace
        project={currentProject}
        detail={detail}
        timelineItems={timelineItems}
        composerPrompt={composerPrompt}
        setComposerPrompt={setComposerPrompt}
        onSubmit={handleComposerSubmit}
        canSubmit={canSubmitComposer}
        canPublish={canPublish}
        canAutoFix={canAutoFix}
        activeAction={activeAction}
        pendingConversation={pendingConversation}
        onRebuild={handleRebuild}
        onPublish={() => setPublishConfirmOpen(true)}
        onAutoFix={handleAutoFix}
        latestTask={latestTask}
        onViewLogs={() => document.querySelector('.status-logs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        conversationRef={conversationRef}
        onOpenStatus={() => setStatusOpen(true)}
        onOpenPreview={() => navigate(`/project/${currentProject.projectId}/preview`)}
        sidebarOpen={sidebarOpen}
        statusOpen={statusOpen}
        setSidebarOpen={setSidebarOpen}
        setStatusOpen={setStatusOpen}
        recentProjects={homeRecentProjects}
        navigate={navigate}
      />
    );
  } else {
    page = (
      <div className="sn-page">
        <div className="sn-page-backdrop" />
        <div className="sn-page-shell">
          <EmptyState title="选择一个项目" description="或者先在左侧创建一个新的。所有项目都会以卡片形式展示。" icon={<Folder className="size-6" />} />
        </div>
      </div>
    );
  }

  return (
    <div className="shipnow-app">
      <div className="sn-app-backdrop" />

      {error ? <div className="error-banner shell-panel">{error}</div> : null}

      {!isMobileLayout ? (
        <>
          {route.kind === 'home' ? (
            <HomeWorkspaceDrawer
              open={sidebarOpen}
              projectsLoading={projectsLoading}
              recentProjects={homeRecentProjects}
              navigate={navigate}
              onClose={() => setSidebarOpen(false)}
              onOpenTemplates={() => {
                navigate('/templates');
                setSidebarOpen(false);
              }}
              onOpenProjects={() => {
                navigate('/projects');
                setSidebarOpen(false);
              }}
              onOpenSettings={() => {
                navigate('/settings');
                setSidebarOpen(false);
              }}
            />
          ) : route.kind === 'settings' ? (
            <HomeWorkspaceDrawer
              open={sidebarOpen}
              projectsLoading={projectsLoading}
              recentProjects={homeRecentProjects}
              navigate={navigate}
              onClose={() => setSidebarOpen(false)}
              onOpenTemplates={() => {
                navigate('/templates');
                setSidebarOpen(false);
              }}
              onOpenProjects={() => {
                navigate('/projects');
                setSidebarOpen(false);
              }}
              onOpenSettings={() => {
                navigate('/settings');
                setSidebarOpen(false);
              }}
            />
          ) : currentProject ? (
            <ProjectWorkspaceDrawer
              open={sidebarOpen}
              currentProject={currentProject}
              recentProjects={homeRecentProjects}
              navigate={navigate}
              onClose={() => setSidebarOpen(false)}
              onCreateProject={() => {
                navigate('/');
                setSidebarOpen(false);
                setStatusOpen(false);
              }}
              onOpenTemplates={() => {
                navigate('/templates');
                setSidebarOpen(false);
              }}
              onOpenProjects={() => {
                navigate('/projects');
                setSidebarOpen(false);
              }}
              onOpenReleases={() => {
                setStatusOpen(true);
              }}
              onOpenSettings={() => {
                navigate(`/settings?projectId=${currentProject.projectId}`);
                setSidebarOpen(false);
                setStatusOpen(false);
              }}
              onSelectTemplate={(prompt) => {
                navigate('/');
                setSidebarOpen(false);
                setStatusOpen(false);
                setComposerPrompt(prompt);
              }}
            />
          ) : null}

          {currentProject ? (
            <WorkspaceStatusDrawer
              open={statusOpen}
              project={currentProject}
              detail={detail}
              canPublish={canPublish}
              activeAction={activeAction}
              onClose={() => setStatusOpen(false)}
              onOpenPreview={() => navigate(`/project/${currentProject.projectId}/preview`)}
              onPublish={() => setPublishConfirmOpen(true)}
              onContinueEditing={() => document.querySelector('.sn-home-composer-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              onAutoFix={handleAutoFix}
              onViewLogs={() => document.querySelector('.status-logs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            />
          ) : null}
        </>
      ) : null}

      <div className="shipnow-app-content">{page}</div>

      {currentProject ? (
        <ProjectPublishConfirmSurface
          open={publishConfirmOpen || previewConfirmDebug}
          project={currentProject}
          canPublish={canPublish && activeAction === null}
          isMobileLayout={isMobileLayout}
          onCancel={() => setPublishConfirmOpen(false)}
          onConfirm={handlePublish}
        />
      ) : null}

      {currentProject ? (
        <ProjectConfirmModal
          open={deleteConfirmOpen}
          destructive
          title="删除这个项目吗？"
          description="删除后会清理工作区、发布目录和任务入口。这个操作不可恢复。"
          details={[
            { label: '项目', value: currentProject.displayName },
            { label: '公开句柄', value: currentProject.publicHandle },
            { label: '状态', value: statusLabel(currentProject.status) },
          ]}
          cancelLabel="取消"
          confirmLabel="确认删除"
          confirmDisabled={activeAction !== null}
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={handleDelete}
        />
      ) : null}
    </div>
  );
}

function HomeWorkspace({
  composerPrompt,
  setComposerPrompt,
  onSubmit,
  canSubmit,
  activeAction,
  recentProjects,
  apiBase,
  projectsLoading,
  homeRecentProjects,
  route,
  navigate,
  sidebarOpen,
  setSidebarOpen,
}: {
  composerPrompt: string;
  setComposerPrompt: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  activeAction: string | null;
  recentProjects: ProjectView[];
  apiBase: string;
  projectsLoading: boolean;
  homeRecentProjects: ProjectView[];
  route: RouteState;
  navigate: (path: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
}) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (isMobile) {
    return (
      <MobilePageSurface className="sn-mobile-home-page">
        <div className="sn-mobile-page-body sn-mobile-entry-welcome">
          <div className="sn-mobile-home-brand-row">
            <MobileIconButton type="button" aria-label="菜单" onClick={() => setSidebarOpen(true)}>
              <Menu className="size-4" />
            </MobileIconButton>
            <div className="sn-mobile-brand">ShipNow</div>
          </div>

          <div className="sn-mobile-home-hero">
            <div className="sn-mobile-home-title">你好！👋</div>
            <div className="sn-mobile-home-copy">
              <span>告诉我你想做什么，</span>
              <span>我来帮你快速实现。</span>
            </div>

            <div className="sn-mobile-home-entry-list">
              <button
                type="button"
                className="sn-mobile-home-entry-card"
                onClick={() => setComposerPrompt('做一个干净、现代的产品官网，首屏突出价值主张和行动按钮。')}
              >
                <div className="sn-mobile-home-entry-icon">✦</div>
                <div>
                  <div className="sn-mobile-home-entry-title">创建产品官网</div>
                  <div className="sn-mobile-home-entry-desc">展示产品与核心卖点</div>
                </div>
              </button>
              <button
                type="button"
                className="sn-mobile-home-entry-card"
                onClick={() => setComposerPrompt('做一个轻量有趣的小游戏，风格轻松、有反馈、有明确的得分或胜负逻辑。')}
              >
                <div className="sn-mobile-home-entry-icon">◌</div>
                <div>
                  <div className="sn-mobile-home-entry-title">做一个小游戏</div>
                  <div className="sn-mobile-home-entry-desc">轻松有趣的互动体验</div>
                </div>
              </button>
              <button
                type="button"
                className="sn-mobile-home-entry-card"
                onClick={() => setComposerPrompt('做一个个人主页，包含简介、作品、联系入口和轻量的作品展示。')}
              >
                <div className="sn-mobile-home-entry-icon">☺</div>
                <div>
                  <div className="sn-mobile-home-entry-title">创建个人主页</div>
                  <div className="sn-mobile-home-entry-desc">展示自己与作品集</div>
                </div>
              </button>
            </div>
          </div>

          <div className="sn-mobile-home-composer-card is-bottom">
            <textarea
              className="sn-mobile-home-composer-input"
              placeholder="你想做什么？"
              value={composerPrompt}
              onChange={(event) => setComposerPrompt(event.target.value)}
            />
            <div className="sn-mobile-home-composer-actions">
              <button className="icon-button h-10 w-10" type="button" aria-label="附件">
                <Paperclip className="size-4" />
              </button>
              <button
                className="sn-mobile-home-send-button"
                type="button"
                aria-label="发送"
                onClick={onSubmit}
                disabled={!canSubmit || activeAction !== null}
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>

        </div>

        <HomeWorkspaceDrawer
          open={sidebarOpen}
          projectsLoading={projectsLoading}
          recentProjects={homeRecentProjects}
          navigate={navigate}
          onClose={() => setSidebarOpen(false)}
          onOpenTemplates={() => {
            navigate('/templates');
            setSidebarOpen(false);
          }}
          onOpenProjects={() => {
            navigate('/projects');
            setSidebarOpen(false);
          }}
          onOpenSettings={() => {
            navigate('/settings');
            setSidebarOpen(false);
          }}
        />
      </MobilePageSurface>
    );
  }

  return (
    <div className="sn-page">
      <div className="sn-page-backdrop" />
      <div className="sn-page-shell">
        <header className="sn-ds-header">
          <div className="sn-ds-brand">
            <div className="sn-ds-logo">
              <Zap className="size-5" />
            </div>
            <div className="sn-ds-title-wrap">
              <div className="sn-ds-brand-name">ShipNow</div>
              <div className="sn-ds-brand-sub">
                <span>AI 创作工作台</span>
                <span className="sn-ds-pill">chat-first</span>
              </div>
            </div>
          </div>
          <p className="sn-ds-description">
            用一句话创建、修改、预览并发布一个小网站。
            <br />
            Tell ShipNow what you want to build.
          </p>
        </header>

        <div className="sn-home-workspace-grid">
          <section className="sn-panel sn-home-entry-welcome">
            <div className="sn-home-welcome-title">你好！👋</div>
            <div className="sn-home-welcome-copy">告诉我你想做什么，我来帮你快速实现。</div>

            <div className="sn-home-entry-list">
              <button type="button" className="sn-home-entry-card" onClick={() => setComposerPrompt('做一个干净、现代的产品官网，首屏突出价值主张和行动按钮。')}>
                <div className="sn-home-entry-icon">✦</div>
                <div>
                  <div className="sn-home-entry-title">创建产品官网</div>
                  <div className="sn-home-entry-desc">展示产品与核心卖点</div>
                </div>
              </button>
              <button type="button" className="sn-home-entry-card" onClick={() => setComposerPrompt('做一个轻量有趣的小游戏，风格轻松、有反馈、有明确的得分或胜负逻辑。')}>
                <div className="sn-home-entry-icon">◌</div>
                <div>
                  <div className="sn-home-entry-title">做一个小游戏</div>
                  <div className="sn-home-entry-desc">轻松有趣的互动体验</div>
                </div>
              </button>
              <button type="button" className="sn-home-entry-card" onClick={() => setComposerPrompt('做一个个人主页，包含简介、作品、联系入口和轻量的作品展示。')}>
                <div className="sn-home-entry-icon">☺</div>
                <div>
                  <div className="sn-home-entry-title">创建个人主页</div>
                  <div className="sn-home-entry-desc">展示自己与作品集</div>
                </div>
              </button>
            </div>

            <div className="sn-home-composer-card is-bottom">
              <div className="sn-home-composer-rail">
              <button className="icon-button h-10 w-10" type="button" aria-label="附件">
                <Paperclip className="size-4" />
              </button>
                <textarea
                  className="sn-home-composer-input"
                  placeholder="告诉 ShipNow 你想做什么..."
                  value={composerPrompt}
                  onChange={(event) => setComposerPrompt(event.target.value)}
                />
                <button className="sn-home-send-button" type="button" aria-label="发送" onClick={onSubmit} disabled={!canSubmit || activeAction !== null}>
                  <Send className="size-4" />
                </button>
              </div>
              <div className="sn-home-footer-actions">
              <MobileActionButton variant="secondary" onClick={() => navigate('/templates')}>
                <Sparkles className="size-4" /> 模板中心
              </MobileActionButton>
              <MobileActionButton variant="primary" onClick={onSubmit} disabled={!canSubmit || activeAction !== null}>
                <Upload className="size-4" /> 开始创建
              </MobileActionButton>
            </div>
          </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SettingsWorkspace({
  onOpenMenu,
  sidebarOpen,
  setSidebarOpen,
  projectsLoading,
  projects,
  recentProjects,
  selectedProjectId,
  refreshProjects,
  navigate,
}: {
  onOpenMenu: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  projectsLoading: boolean;
  projects: ProjectView[];
  recentProjects: ProjectView[];
  selectedProjectId: string | null;
  refreshProjects: () => Promise<void>;
  navigate: (path: string) => void;
}) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [appSettings, setAppSettings] = useState<AppSettingsView | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingDefaultRunner, setSavingDefaultRunner] = useState<TaskRunnerName | null>(null);
  const [savingProjectRunner, setSavingProjectRunner] = useState<TaskRunnerName | 'inherit' | null>(null);

  const selectedProject = selectedProjectId ? projects.find((project) => project.projectId === selectedProjectId) ?? null : null;

  useEffect(() => {
    let cancelled = false;

    async function loadSettings(): Promise<void> {
      setSettingsLoading(true);
      try {
        const response = await getAppSettings();
        if (!cancelled) {
          setAppSettings(response.settings);
          setSettingsError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSettingsError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUpdateGlobalRunner(runner: TaskRunnerName): Promise<void> {
    setSavingDefaultRunner(runner);
    try {
      const response = await updateAppSettings(runner);
      setAppSettings(response.settings);
      setSettingsError(null);
      await refreshProjects();
    } catch (updateError) {
      setSettingsError(updateError instanceof Error ? updateError.message : String(updateError));
    } finally {
      setSavingDefaultRunner(null);
    }
  }

  async function handleUpdateProjectRunner(runner: TaskRunnerName | null): Promise<void> {
    if (!selectedProject) {
      return;
    }
    setSavingProjectRunner(runner ?? 'inherit');
    try {
      await updateProjectSettings(selectedProject.projectId, runner);
      setSettingsError(null);
      await refreshProjects();
    } catch (updateError) {
      setSettingsError(updateError instanceof Error ? updateError.message : String(updateError));
    } finally {
      setSavingProjectRunner(null);
    }
  }

  function renderRunnerCard(
    runner: TaskRunnerName,
    active: boolean,
    action: () => Promise<void>,
    busy: boolean,
    caption: string,
    extraLabel?: string
  ): ReactElement {
    return (
      <button
        key={runner}
        type="button"
        className={`sn-settings-runner-card ${active ? 'is-active' : ''}`.trim()}
        onClick={() => void action()}
        disabled={busy}
      >
        <div className="sn-settings-runner-card-head">
          <div>
            <div className="sn-settings-runner-name">{taskRunnerLabel(runner)}</div>
            <div className="sn-settings-runner-backend">{taskRunnerBackendLabel(runner)}</div>
          </div>
          {active ? <StatusChip tone="preview-ready">{extraLabel ?? '当前选择'}</StatusChip> : null}
        </div>
        <div className="sn-settings-runner-copy">{caption}</div>
      </button>
    );
  }

  const effectiveGlobalRunner = appSettings?.defaultRunner ?? 'codex';
  const currentProjectRunner = selectedProject?.preferredRunner ?? null;
  const currentProjectEffectiveRunner = selectedProject?.effectiveRunner ?? effectiveGlobalRunner;

  if (isMobile) {
    return (
      <MobilePageSurface className="sn-mobile-settings-page">
        <div className="sn-mobile-page-body sn-mobile-settings-body">
          <MobileCompactHeader title="设置与偏好" onMenu={onOpenMenu} />

          {settingsError ? <div className="sn-settings-inline-error">{settingsError}</div> : null}

          <section className="sn-panel sn-settings-section">
            <header className="sn-section-head">
              <div>
                <p className="sn-section-kicker">Global Default</p>
                <h2 className="sn-section-title">全局默认执行器</h2>
              </div>
              {settingsLoading ? <StatusChip tone="building">加载中</StatusChip> : <StatusChip tone="preview-ready">{taskRunnerLabel(effectiveGlobalRunner)}</StatusChip>}
            </header>
            <div className="sn-settings-runner-grid">
              {(['codex', 'claude-code'] as const).map((runner) =>
                renderRunnerCard(
                  runner,
                  effectiveGlobalRunner === runner,
                  () => handleUpdateGlobalRunner(runner),
                  savingDefaultRunner !== null,
                  taskRunnerDescription(runner)
                )
              )}
            </div>
          </section>

          {selectedProject ? (
            <section className="sn-panel sn-settings-section">
              <header className="sn-section-head">
                <div>
                  <p className="sn-section-kicker">Project Preference</p>
                  <h2 className="sn-section-title">{selectedProject.displayName}</h2>
                </div>
                <StatusChip tone={statusTone(selectedProject.status) as 'preview-ready' | 'published' | 'building' | 'needs-fix'}>
                  {taskRunnerLabel(currentProjectEffectiveRunner)}
                </StatusChip>
              </header>
              <div className="sn-settings-project-meta">
                <div className="sn-settings-project-line">
                  <span>当前生效</span>
                  <strong>{taskRunnerLabel(currentProjectEffectiveRunner)} · {taskRunnerBackendLabel(currentProjectEffectiveRunner)}</strong>
                </div>
                <div className="sn-settings-project-line">
                  <span>当前偏好</span>
                  <strong>{currentProjectRunner ? taskRunnerLabel(currentProjectRunner) : '继承全局默认'}</strong>
                </div>
              </div>
              <div className="sn-settings-runner-grid">
                {renderRunnerCard(
                  'codex',
                  currentProjectRunner === 'codex',
                  () => handleUpdateProjectRunner('codex'),
                  savingProjectRunner !== null,
                  taskRunnerDescription('codex')
                )}
                {renderRunnerCard(
                  'claude-code',
                  currentProjectRunner === 'claude-code',
                  () => handleUpdateProjectRunner('claude-code'),
                  savingProjectRunner !== null,
                  taskRunnerDescription('claude-code')
                )}
                <button
                  type="button"
                  className={`sn-settings-runner-card ${currentProjectRunner === null ? 'is-active' : ''}`.trim()}
                  onClick={() => void handleUpdateProjectRunner(null)}
                  disabled={savingProjectRunner !== null}
                >
                  <div className="sn-settings-runner-card-head">
                    <div>
                      <div className="sn-settings-runner-name">继承全局默认</div>
                      <div className="sn-settings-runner-backend">跟随系统默认</div>
                    </div>
                    {currentProjectRunner === null ? <StatusChip tone="preview-ready">当前选择</StatusChip> : null}
                  </div>
                  <div className="sn-settings-runner-copy">
                    这个项目会自动使用全局默认执行器，适合统一管理。
                  </div>
                </button>
              </div>
            </section>
          ) : null}
        </div>
        <HomeWorkspaceDrawer
          open={sidebarOpen}
          projectsLoading={projectsLoading}
          recentProjects={recentProjects}
          navigate={navigate}
          onClose={() => setSidebarOpen(false)}
          onOpenTemplates={() => {
            navigate('/templates');
            setSidebarOpen(false);
          }}
          onOpenProjects={() => {
            navigate('/projects');
            setSidebarOpen(false);
          }}
          onOpenSettings={() => {
            navigate('/settings');
            setSidebarOpen(false);
          }}
        />
      </MobilePageSurface>
    );
  }

  return (
    <div className="sn-page sn-settings-page">
      <div className="sn-page-backdrop" />
      <div className="sn-page-shell sn-settings-shell">
        <div className="sn-settings-hero">
          <div>
            <p className="sn-hero-kicker">Settings & Preferences</p>
            <h1 className="sn-hero-title">设置与偏好</h1>
            <p className="sn-hero-description">
              在这里切换 ShipNow 的默认执行器，并按项目覆盖为 Codex 或 Claude Code。
            </p>
          </div>
          <SnButton variant="icon" icon={<Settings2 className="size-4" />} title="设置" />
        </div>

        {settingsError ? <div className="sn-settings-inline-error">{settingsError}</div> : null}

        <div className="sn-settings-layout">
          <section className="sn-panel sn-settings-section">
            <header className="sn-section-head">
              <div>
                <p className="sn-section-kicker">Global Default</p>
                <h2 className="sn-section-title">全局默认执行器</h2>
              </div>
              {settingsLoading ? <StatusChip tone="building">加载中</StatusChip> : <StatusChip tone="preview-ready">{taskRunnerLabel(effectiveGlobalRunner)}</StatusChip>}
            </header>
            <div className="sn-settings-runner-grid">
              {(['codex', 'claude-code'] as const).map((runner) =>
                renderRunnerCard(
                  runner,
                  effectiveGlobalRunner === runner,
                  () => handleUpdateGlobalRunner(runner),
                  savingDefaultRunner !== null,
                  taskRunnerDescription(runner)
                )
              )}
            </div>
          </section>

          <section className="sn-panel sn-settings-section">
            <header className="sn-section-head">
              <div>
                <p className="sn-section-kicker">Project Preference</p>
                <h2 className="sn-section-title">{selectedProject ? selectedProject.displayName : '选择一个项目'}</h2>
              </div>
              {selectedProject ? (
                <StatusChip tone={statusTone(selectedProject.status) as 'preview-ready' | 'published' | 'building' | 'needs-fix'}>
                  {taskRunnerLabel(currentProjectEffectiveRunner)}
                </StatusChip>
              ) : (
                <StatusChip tone="building">无项目上下文</StatusChip>
              )}
            </header>
            {selectedProject ? (
              <>
                <div className="sn-settings-project-meta">
                  <div className="sn-settings-project-line">
                    <span>当前生效</span>
                    <strong>{taskRunnerLabel(currentProjectEffectiveRunner)} · {taskRunnerBackendLabel(currentProjectEffectiveRunner)}</strong>
                  </div>
                  <div className="sn-settings-project-line">
                    <span>当前偏好</span>
                    <strong>{currentProjectRunner ? taskRunnerLabel(currentProjectRunner) : '继承全局默认'}</strong>
                  </div>
                </div>
                <div className="sn-settings-runner-grid">
                  {renderRunnerCard(
                    'codex',
                    currentProjectRunner === 'codex',
                    () => handleUpdateProjectRunner('codex'),
                    savingProjectRunner !== null,
                    taskRunnerDescription('codex')
                  )}
                  {renderRunnerCard(
                    'claude-code',
                    currentProjectRunner === 'claude-code',
                    () => handleUpdateProjectRunner('claude-code'),
                    savingProjectRunner !== null,
                    taskRunnerDescription('claude-code')
                  )}
                  <button
                    type="button"
                    className={`sn-settings-runner-card ${currentProjectRunner === null ? 'is-active' : ''}`.trim()}
                    onClick={() => void handleUpdateProjectRunner(null)}
                    disabled={savingProjectRunner !== null}
                  >
                    <div className="sn-settings-runner-card-head">
                      <div>
                        <div className="sn-settings-runner-name">继承全局默认</div>
                        <div className="sn-settings-runner-backend">跟随系统默认</div>
                      </div>
                      {currentProjectRunner === null ? <StatusChip tone="preview-ready">当前选择</StatusChip> : null}
                    </div>
                    <div className="sn-settings-runner-copy">这个项目会自动使用全局默认执行器，适合统一管理。</div>
                  </button>
                </div>
              </>
            ) : (
              <EmptyState
                title="选择一个项目"
                description="从项目页的“设置与偏好”菜单进入后，会显示该项目的覆盖设置。"
                icon={<Folder className="size-6" />}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TemplatesWorkspace({
  onBackHome,
  onSelectTemplate,
  projectsLoading,
  recentProjects,
  navigate,
}: {
  onBackHome: () => void;
  onSelectTemplate: (prompt: string) => void;
  projectsLoading: boolean;
  recentProjects: ProjectView[];
  navigate: (path: string) => void;
}) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const templates = [
    {
      title: '空白项目',
      desc: '从空白开始，自由发挥',
      prompt: TEMPLATE_PROMPTS[5],
      icon: '+',
    },
    {
      title: '产品官网',
      desc: '展示产品与功能亮点',
      prompt: TEMPLATE_PROMPTS[0],
      icon: '✦',
    },
    {
      title: 'Landing Page',
      desc: '快速验证活动与转化',
      prompt: '做一个活动页，带强视觉冲击和明确的报名 / 购买转化。',
      icon: '◐',
    },
    {
      title: '个人主页',
      desc: '展示自己与作品集',
      prompt: TEMPLATE_PROMPTS[1],
      icon: '☺',
    },
  ];

  if (isMobile) {
      return (
      <MobilePageSurface className="sn-mobile-templates-page">
        <div className="sn-mobile-page-body">
          <MobileCompactHeader
            onMenu={() => setSidebarOpen(true)}
            title="模板中心"
          />
          <div className="sn-mobile-section-copy">选择一个模板开始</div>
          <div className="sn-mobile-template-grid">
            {templates.map((template) => (
              <button
                key={template.title}
                type="button"
                className={`sn-mobile-template-card ${template.title === '产品官网' ? 'is-active' : ''}`}
                onClick={() => {
                  onSelectTemplate(template.prompt);
                  onBackHome();
                }}
              >
                <div className="sn-mobile-template-thumb">
                  <div className="sn-mobile-template-thumb-shape" />
                </div>
                <div className="sn-mobile-template-title">{template.title}</div>
                <div className="sn-mobile-template-desc">{template.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <HomeWorkspaceDrawer
          open={sidebarOpen}
          projectsLoading={projectsLoading}
          recentProjects={recentProjects}
          navigate={navigate}
          onClose={() => setSidebarOpen(false)}
          onOpenTemplates={() => {
            navigate('/templates');
            setSidebarOpen(false);
          }}
          onOpenProjects={() => {
            navigate('/projects');
            setSidebarOpen(false);
          }}
          onOpenSettings={() => {
            navigate('/settings');
            setSidebarOpen(false);
          }}
        />
      </MobilePageSurface>
    );
  }

  return (
    <div className="sn-page">
      <div className="sn-page-backdrop" />
      <div className="sn-page-shell">
        <header className="sn-ds-header">
          <div className="sn-ds-brand">
            <div className="sn-ds-logo">
              <Zap className="size-5" />
            </div>
            <div className="sn-ds-title-wrap">
              <div className="sn-ds-brand-name">ShipNow</div>
              <div className="sn-ds-brand-sub">
                <span>模板中心</span>
                <span className="sn-ds-pill">starter kits</span>
              </div>
            </div>
          </div>
          <p className="sn-ds-description">
            先用合适的起点，再继续对话修改。
            <br />
            No tables, only cards.
          </p>
        </header>

        <div className="sn-template-workspace-grid">
          <section className="sn-panel sn-template-entry-welcome">
            <div className="sn-template-welcome-title">选择一个模板开始。</div>
            <div className="sn-template-welcome-copy">先用合适的起点，再继续对话修改。这里用卡片承载模板，不用表格。</div>
            <div className="sn-template-grid">
              {projectsLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-40 rounded-[24px]" />
                  ))
                : templates.map((template) => (
                    <button
                      key={template.title}
                      type="button"
                      className={`sn-template-card ${template.title === '产品官网' ? 'is-active' : ''}`}
                      onClick={() => {
                        onSelectTemplate(template.prompt);
                        onBackHome();
                      }}
                    >
                      <div className="sn-template-thumb">
                        {template.icon === '+' ? (
                          <Plus className="size-7 sn-template-empty-plus" />
                        ) : (
                          <div className="sn-template-thumb-shape" />
                        )}
                      </div>
                      <div className="sn-template-title">{template.title}</div>
                      <div className="sn-template-desc">{template.desc}</div>
                    </button>
                  ))}
            </div>
          </section>

          <section className="sn-panel sn-template-projects">
            <div className="sn-template-projects-head">
              <div>
                <div className="sn-template-section-copy">导入现有项目</div>
                <div className="sn-template-note">如果已有站点，直接导入继续改。</div>
              </div>
            </div>
            <div className="sn-template-project-list">
              <div className="sn-template-empty">从现有项目导入后，可以继续沿用当前风格与结构。</div>
              <SnActionButton variant="secondary" onClick={onBackHome}>
                <Upload className="size-4" /> 导入现有项目
              </SnActionButton>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ProjectsWorkspace({
  projects,
  projectsLoading,
  onOpenProject,
  onBackHome,
  recentProjects,
  navigate,
}: {
  projects: ProjectView[];
  projectsLoading: boolean;
  onOpenProject: (projectId: string) => void;
  onBackHome: () => void;
  recentProjects: ProjectView[];
  navigate: (path: string) => void;
}) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allProjectsOpen, setAllProjectsOpen] = useState(true);

  if (isMobile) {
    return (
      <MobilePageSurface className="sn-mobile-projects-page">
        <div className="sn-mobile-page-body">
          <MobileCompactHeader
            onMenu={() => setSidebarOpen(true)}
            title="我的项目"
          />
          <details
            className="sn-mobile-project-filter-group"
            open={allProjectsOpen}
            onToggle={(event) => setAllProjectsOpen(event.currentTarget.open)}
          >
            <summary className="sn-mobile-project-filter">
              <span>全部项目</span>
              <ChevronDown className={`size-4 sn-mobile-project-filter-chevron ${allProjectsOpen ? 'is-open' : ''}`.trim()} />
            </summary>

            {projectsLoading ? (
              <div className="grid gap-3">
                <Skeleton className="h-36 rounded-[24px]" />
                <Skeleton className="h-36 rounded-[24px]" />
                <Skeleton className="h-36 rounded-[24px]" />
              </div>
            ) : projects.length === 0 ? (
              <div className="sn-mobile-empty">还没有项目。先创建一个再回来这里看列表。</div>
            ) : (
              <div className="sn-mobile-project-list">
                {projects.map((project) => (
                  <button
                    key={project.projectId}
                    type="button"
                    className={`sn-mobile-project-card ${project.status === 'preview_ready' ? 'is-active' : ''}`}
                    onClick={() => onOpenProject(project.projectId)}
                  >
                    <div className="sn-mobile-project-thumb" />
                    <div className="sn-mobile-project-copy">
                      <div className="sn-mobile-project-head">
                        <div>
                          <div className="sn-mobile-project-name">{project.displayName}</div>
                          <div className="sn-mobile-project-desc">{project.title}</div>
                        </div>
                        <StatusChip tone={statusTone(project.status) as 'preview-ready' | 'published' | 'building' | 'needs-fix'}>
                          {statusLabel(project.status)}
                        </StatusChip>
                      </div>
                      <div className="sn-mobile-project-meta">
                        <span>{formatTime(project.updatedAt)}</span>
                        <span>{project.type}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </details>
        </div>
        <HomeWorkspaceDrawer
          open={sidebarOpen}
          projectsLoading={projectsLoading}
          recentProjects={recentProjects}
          navigate={navigate}
          onClose={() => setSidebarOpen(false)}
          onOpenTemplates={() => {
            navigate('/templates');
            setSidebarOpen(false);
          }}
          onOpenProjects={() => {
            navigate('/projects');
            setSidebarOpen(false);
          }}
          onOpenSettings={() => {
            navigate('/settings');
            setSidebarOpen(false);
          }}
        />
      </MobilePageSurface>
    );
  }

  return (
    <div className="sn-page">
      <div className="sn-page-backdrop" />
      <div className="sn-page-shell">
        <header className="sn-ds-header">
          <div className="sn-ds-brand">
            <div className="sn-ds-logo">
              <Zap className="size-5" />
            </div>
            <div className="sn-ds-title-wrap">
              <div className="sn-ds-brand-name">ShipNow</div>
              <div className="sn-ds-brand-sub">
                <span>项目管理</span>
                <span className="sn-ds-pill">all projects</span>
              </div>
            </div>
          </div>
          <p className="sn-ds-description">
            用卡片列表查看每个项目的状态、更新时间和协作信息。
            <br />
            No tables, only cards.
          </p>
        </header>

        <section className="sn-panel sn-projects-panel">
          <div className="sn-projects-head">
            <div>
              <div className="sn-projects-section-copy">所有项目</div>
              <div className="sn-projects-note">卡片列表，而不是表格。</div>
            </div>
            <div className="sn-projects-toolbar">
              <SnActionButton variant="secondary" onClick={onBackHome}>
                <Plus className="size-4" /> 新建项目
              </SnActionButton>
            </div>
          </div>

          {projectsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-40 rounded-[24px]" />
              <Skeleton className="h-40 rounded-[24px]" />
              <Skeleton className="h-40 rounded-[24px]" />
            </div>
          ) : projects.length === 0 ? (
            <EmptyState title="No projects yet" description="Start a conversation to build your first site." icon={<Plus className="size-6" />} />
          ) : (
            <div className="sn-projects-list">
              {projects.map((project) => (
                <ProjectCard
                  key={project.projectId}
                  name={project.displayName}
                  description={project.title}
                  status={project.status === 'preview_ready' ? 'preview-ready' : project.status === 'published' ? 'published' : project.status === 'build_failed' || project.status === 'publish_failed' ? 'needs-fix' : 'building'}
                  updatedAt={formatTime(project.updatedAt)}
                  onClick={() => onOpenProject(project.projectId)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ProjectPreviewWorkspace({
  project,
  onBackEdit,
  onPublish,
}: {
  project: ProjectView;
  onBackEdit: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="sn-page">
      <div className="sn-page-backdrop" />
      <div className="sn-page-shell">
        <TopBar mode="preview" />

        <div className="sn-project-preview-grid">
          <section className="sn-panel sn-visual-main">
            <div className="sn-visual-main-head">
              <div className="sn-visual-project-head">
                <div className="sn-visual-project-mark" />
                <div>
                  <div className="sn-visual-project-name">{project.displayName}</div>
                  <div className="sn-visual-project-subtitle">{project.publicHandle}</div>
                </div>
              </div>
              <StatusChip tone="published">Preview ready</StatusChip>
            </div>

            <div className="sn-visual-preview-canvas sn-visual-preview-canvas-live">
              <div className="sn-visual-preview-top">
                <span>实时预览</span>
                <div className="sn-visual-preview-icons">
                  <span className="sn-visual-preview-url">{project.previewUrl}</span>
                </div>
              </div>
              <iframe
                className="sn-visual-preview-frame"
                src={project.previewUrl}
                title={`${project.displayName} 预览`}
                loading="eager"
              />
            </div>
          </section>

          <aside className="sn-panel sn-visual-status">
            <div className="sn-visual-status-block">
              <div className="sn-visual-status-title">当前预览已准备好</div>
              <p>你可以继续修改，或者直接发布到正式地址。</p>
            </div>
            <div className="sn-visual-status-block">
              <div className="sn-visual-status-title">地址</div>
              <DetailRow label="预览地址" value={project.previewUrl} />
              <DetailRow label="正式地址" value={project.publicUrl} />
            </div>
            <div className="sn-visual-status-block">
              <div className="sn-visual-status-title">操作</div>
              <div className="grid gap-2">
                <SnButton variant="secondary" onClick={onBackEdit}>继续编辑</SnButton>
                <SnButton variant="primary" onClick={onPublish}>发布</SnButton>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MobilePublishConfirmSheet({
  open,
  project,
  canPublish,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  project: ProjectView;
  canPublish: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { shouldRender, isOpen } = useDrawerTransition(open);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={`sn-mobile-confirm-shell ${isOpen ? 'is-open' : ''}`.trim()} role="presentation">
      <button className="sn-mobile-drawer-backdrop" type="button" aria-label="关闭确认发布" onClick={onCancel} />
      <div className="sn-mobile-confirm-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sn-mobile-confirm-head">
          <div className="sn-mobile-confirm-head-left">
            <div className="sn-mobile-confirm-icon" aria-hidden="true">
              <Globe className="size-4" />
            </div>
            <div className="sn-mobile-confirm-head-title">确认发布</div>
          </div>
          <button className="sn-reference-sheet-close sn-mobile-confirm-close" type="button" onClick={onCancel} aria-label="关闭确认发布">
            ×
          </button>
        </div>
        <div className="sn-mobile-confirm-body">
          <div className="sn-mobile-confirm-label">目标线上地址</div>
          <div className="sn-mobile-confirm-address">
            <span>{project.publicUrl}</span>
            <Copy className="size-4" />
          </div>
          <div className="sn-mobile-confirm-list">
            <div className="sn-mobile-confirm-list-item">
              <CheckCircle2 className="size-4" />
              <span>将覆盖当前版本：{project.displayName}</span>
            </div>
            <div className="sn-mobile-confirm-list-item">
              <CheckCircle2 className="size-4" />
              <span>构建并发布到线上环境</span>
            </div>
            <div className="sn-mobile-confirm-list-item">
              <CheckCircle2 className="size-4" />
              <span>发布后立即可通过该地址访问</span>
            </div>
          </div>
        </div>
        <div className="sn-mobile-confirm-footer">
          <div className="sn-mobile-confirm-actions">
            <button className="sn-mobile-confirm-button is-primary" type="button" onClick={onConfirm} disabled={!canPublish}>
              确认发布
            </button>
            <button className="sn-mobile-confirm-button is-secondary" type="button" onClick={onCancel}>
              取消
            </button>
          </div>
          <div className="sn-mobile-confirm-footnote">发布即表示你同意 ShipNow 服务条款</div>
        </div>
      </div>
    </div>
  );
}

function ProjectConfirmModal({
  open,
  destructive = false,
  title,
  description,
  details,
  confirmLabel,
  cancelLabel,
  confirmDisabled,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  destructive?: boolean;
  title: string;
  description: string;
  details: Array<{ label: string; value: string }>;
  confirmLabel: string;
  cancelLabel: string;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="sn-project-confirm-modal">
      <div className="sn-project-confirm-backdrop" onClick={onCancel} role="presentation" />
      <div className="sn-project-confirm-panel">
        <div className="sn-confirmation-sheet sn-project-confirm-sheet">
          <button className="sn-reference-sheet-close sn-project-confirm-close" type="button" onClick={onCancel} aria-label="关闭确认发布">
            ×
          </button>
          <div className="sn-confirmation-head">
            <div className={`sn-confirmation-badge ${destructive ? 'is-destructive' : ''}`.trim()}>
              {destructive ? 'Delete confirmation' : 'Publish confirmation'}
            </div>
            <div className="sn-confirmation-title">{title}</div>
            <p className="sn-confirmation-description">{description}</p>
          </div>
          <div className="sn-project-confirm-details">
            {details.map((detail) => (
              <DetailRow key={detail.label} label={detail.label} value={detail.value} />
            ))}
          </div>
          <div className="sn-confirmation-footer sn-project-confirm-footer">
            <SnButton variant="secondary" onClick={onCancel} className="rounded-full border-border bg-background shadow-none">
              {cancelLabel}
            </SnButton>
            <SnButton variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm} disabled={confirmDisabled} className="rounded-full">
              {confirmLabel}
            </SnButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectPublishConfirmSurface({
  open,
  project,
  canPublish,
  isMobileLayout,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  project: ProjectView;
  canPublish: boolean;
  isMobileLayout: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (isMobileLayout) {
    return (
      <MobilePublishConfirmSheet
        open={open}
        project={project}
        canPublish={canPublish}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
  }

  if (!open) {
    return null;
  }

  return (
    <ProjectConfirmModal
      open={open}
      title="确认发布到正式站点"
      description={`ShipNow 会把当前预览复制到正式站点，并使用 ${project.publicUrl} 作为访问地址。`}
      details={[
        { label: '项目', value: project.displayName },
        { label: '公开句柄', value: project.publicHandle },
        { label: '预览地址', value: project.previewUrl },
        { label: '正式地址', value: project.publicUrl },
      ]}
      confirmLabel="确认发布"
      cancelLabel="先不发布"
      confirmDisabled={!canPublish}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function PublishResultWorkspace({
  project,
  success,
  onOpenWebsite,
  onCopyLink,
  onContinueEditing,
  onAutoFix,
  onViewLogs,
}: {
  project: ProjectView;
  success: boolean;
  onOpenWebsite: () => void;
  onCopyLink: () => void;
  onContinueEditing: () => void;
  onAutoFix: () => void;
  onViewLogs: () => void;
}) {
  return (
    <div className="sn-page">
      <div className="sn-page-backdrop" />
      <div className="sn-page-shell">
        <TopBar mode="preview" />

        <div className="sn-project-workspace-grid">
          <section className="sn-panel sn-visual-main">
            <div className="sn-visual-main-head">
              <div className="sn-visual-project-head">
                <div className="sn-visual-project-mark" />
                <div>
                  <div className="sn-visual-project-name">{project.displayName}</div>
                  <div className="sn-visual-project-subtitle">{project.publicHandle}</div>
                </div>
              </div>
              <StatusChip tone={success ? 'published' : 'needs-fix'}>{statusLabel(success ? 'published' : 'publish_failed')}</StatusChip>
            </div>

            <div className="sn-visual-preview-canvas">
              <div className={`sn-visual-preview-content ${success ? '' : ''}`.trim()}>
                <div className="sn-visual-preview-brand">{success ? '发布成功' : '发布失败'}</div>
                <h3 className="!text-[clamp(2.1rem,3vw,3.4rem)]">
                  {success ? 'Your site is live.' : 'Something needs fixing.'}
                </h3>
                <p>
                  {success
                    ? '你的网站已上线，全球都可以访问了。'
                    : '部署过程中遇到了一些问题，但我们可以继续修复。'}
                </p>
                <div className="sn-visual-preview-features">
                  {success ? (
                    <span className="sn-visual-preview-feature">线上地址可访问</span>
                  ) : (
                    <>
                      <span className="sn-visual-preview-feature">构建错误</span>
                      <span className="sn-visual-preview-feature">依赖安装失败</span>
                      <span className="sn-visual-preview-feature">配置文件问题</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="sn-panel sn-visual-status">
            <div className="sn-visual-status-block">
              <div className="sn-visual-status-title">下一步</div>
              <div className="grid gap-2">
                {success ? (
                  <>
                    <SnButton variant="primary" onClick={onOpenWebsite}>
                      <ArrowUpRight className="size-4" />
                      打开网站
                    </SnButton>
                    <SnButton variant="secondary" onClick={onCopyLink}>
                      <Copy className="size-4" />
                      复制链接
                    </SnButton>
                    <SnButton variant="secondary" onClick={onContinueEditing}>
                      <Edit2 className="size-4" />
                      继续编辑
                    </SnButton>
                  </>
                ) : (
                  <>
                    <SnButton variant="primary" onClick={onAutoFix}>
                      <WandSparkles className="size-4" />
                      ShipNow 自动修复
                    </SnButton>
                    <SnButton variant="secondary" onClick={onViewLogs}>
                      <Info className="size-4" />
                      查看日志
                    </SnButton>
                    <SnButton variant="secondary" onClick={onContinueEditing}>
                      稍后再试
                    </SnButton>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ProjectWorkspace({
  project,
  detail,
  timelineItems,
  composerPrompt,
  setComposerPrompt,
  onSubmit,
  canSubmit,
  canPublish,
  canAutoFix,
  activeAction,
  pendingConversation,
  onRebuild,
  onPublish,
  onAutoFix,
  latestTask,
  onViewLogs,
  conversationRef,
  onOpenStatus,
  onOpenPreview,
  sidebarOpen,
  statusOpen,
  setSidebarOpen,
  setStatusOpen,
  recentProjects,
  navigate,
}: {
  project: ProjectView;
  detail: ProjectDetailResponse | null;
  timelineItems: ConversationTimelineItem[];
  composerPrompt: string;
  setComposerPrompt: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  canPublish: boolean;
  canAutoFix: boolean;
  activeAction: string | null;
  pendingConversation: PendingConversationState | null;
  onRebuild: () => void;
  onPublish: () => void;
  onAutoFix: () => void;
  latestTask: TaskView | null;
  onViewLogs: () => void;
  conversationRef: RefObject<HTMLDivElement | null>;
  onOpenStatus: () => void;
  onOpenPreview: () => void;
  sidebarOpen: boolean;
  statusOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  setStatusOpen: (value: boolean) => void;
  recentProjects: ProjectView[];
  navigate: (path: string) => void;
}) {
  const isMobileLayout = useMediaQuery('(max-width: 767px)');
  const renderedTimelineItems = isMobileLayout ? timelineItems.slice(-4) : timelineItems;

  if (isMobileLayout) {
    return (
      <ProjectWorkspaceMobile
        project={project}
        detail={detail}
        timelineItems={timelineItems}
        composerPrompt={composerPrompt}
        setComposerPrompt={setComposerPrompt}
        onSubmit={onSubmit}
        canSubmit={canSubmit}
        canPublish={canPublish}
        canAutoFix={canAutoFix}
        activeAction={activeAction}
        pendingConversation={pendingConversation}
        onRebuild={onRebuild}
        onPublish={onPublish}
        onAutoFix={onAutoFix}
        latestTask={latestTask}
        onViewLogs={onViewLogs}
        conversationRef={conversationRef}
        onOpenStatus={onOpenStatus}
        onOpenPreview={onOpenPreview}
        sidebarOpen={sidebarOpen}
        statusOpen={statusOpen}
        setSidebarOpen={setSidebarOpen}
        setStatusOpen={setStatusOpen}
        recentProjects={recentProjects}
        navigate={navigate}
      />
    );
  }

  return (
    <div className="sn-page">
      <div className="sn-page-backdrop" />
      <div className="sn-page-shell">
        <header className="sn-ds-header">
          <div className="sn-ds-brand">
            <div className="sn-ds-logo">
              <Zap className="size-5" />
            </div>
            <div className="sn-ds-title-wrap">
              <div className="sn-ds-brand-name">{project.displayName}</div>
              <div className="sn-ds-brand-sub">
                <span>{project.publicHandle}</span>
                <span className="sn-ds-pill">{statusLabel(project.status)}</span>
              </div>
            </div>
          </div>
          <p className="sn-ds-description">
            {project.title}
            <br />
            Conversation first, publish when ready.
          </p>
        </header>

        <div className="sn-project-workspace-grid">
          <section className="sn-panel sn-project-workspace-entry">
            <div className="sn-project-workspace-title">{project.displayName}</div>
            <div className="sn-project-workspace-copy">{project.title}</div>
            <div className="flex flex-wrap gap-2">
              <Chip tone={statusTone(project.status)}>{statusLabel(project.status)}</Chip>
              <Chip tone="neutral">{project.publicHandle}</Chip>
              <Chip tone="neutral">{project.type}</Chip>
            </div>

            <div className="sn-project-workspace-chat" ref={conversationRef}>
              {detail ? (
                renderedTimelineItems.length === 0 ? (
                  <div className="sn-project-workspace-empty">刚打开这个项目。先说一句你要改什么。</div>
                ) : (
                  renderedTimelineItems.map((item) => <TimelineEntry key={item.id} item={item} latestTask={latestTask} />)
                )
              ) : (
                <div className="sn-project-workspace-empty">正在加载项目…</div>
              )}
            </div>

            <PendingConversationBubble pendingConversation={pendingConversation} />

            <div className="sn-project-workspace-chips">
              <QuickActionChip icon={<WandSparkles className="size-4" />} onClick={() => setComposerPrompt('把文案再简洁一点，突出价值和行动按钮。')}>
                优化文案
              </QuickActionChip>
              <QuickActionChip icon={<Sparkles className="size-4" />} onClick={() => setComposerPrompt('把配色再轻一点，偏薄荷绿和更柔和的留白。')}>
                调整配色
              </QuickActionChip>
              <QuickActionChip icon={<Plus className="size-4" />} onClick={() => setComposerPrompt('增加一个独立页面，保留当前风格和层次。')}>
                增加页面
              </QuickActionChip>
              <QuickActionChip icon={<Upload className="size-4" />} onClick={() => setComposerPrompt('帮我替换一张更合适的图片 / 视觉素材。')}>
                上传图片
              </QuickActionChip>
              <QuickActionChip icon={<CircleAlert className="size-4" />} onClick={onAutoFix} className={activeAction !== null || !canAutoFix ? 'opacity-50 pointer-events-none' : ''}>
                修复问题
              </QuickActionChip>
              <button
                className="icon-button h-10 w-10"
                type="button"
                aria-label="刷新"
                onClick={onRebuild}
                disabled={activeAction !== null}
              >
                <RefreshCcw className="size-4" />
              </button>
            </div>

            <div className="sn-project-workspace-composer is-bottom">
              <div className="sn-project-workspace-composer-rail">
                <button className="icon-button h-10 w-10" type="button" aria-label="附件">
                  <Paperclip className="size-4" />
                </button>
                <textarea
                  className="sn-project-workspace-composer-input"
                  placeholder="例如：把首屏的大标题再收一点，按钮更明确，配色更薄荷绿。"
                  value={composerPrompt}
                  onChange={(event) => setComposerPrompt(event.target.value)}
                />
                <button
                  className="sn-project-workspace-send-button"
                  type="button"
                  aria-label="发送修改"
                  onClick={onSubmit}
                  disabled={!canSubmit || activeAction !== null}
                >
                  <Send className="size-4" />
                </button>
              </div>
              <div className="sn-project-workspace-actions">
                <SnActionButton variant="secondary" onClick={onOpenPreview}>
                  <Eye className="size-4" /> Preview
                </SnActionButton>
                <SnActionButton variant="primary" onClick={onPublish} disabled={!canPublish || activeAction !== null}>
                  <Upload className="size-4" /> Publish
                </SnActionButton>
              </div>
            </div>
          </section>

          <section className="sn-reference-sheet sn-project-workspace-status">
            <div className="sn-project-workspace-status-head">
              <div>
                <div className="sn-project-workspace-section-copy">项目状态</div>
                <div className="sn-project-workspace-note">状态、发布和日志都收纳到更清晰的层次里。</div>
              </div>
              <div className="sn-project-workspace-toolbar">
              <SnActionButton variant="secondary" onClick={onOpenStatus}>
                <MoreHorizontal className="size-4" /> 更多
              </SnActionButton>
              </div>
            </div>
            <ProjectStatusContent project={project} detail={detail} latestTask={latestTask} showTaskInfo onViewLogs={onViewLogs} />
          </section>
        </div>
      </div>
    </div>
  );
}

function ProjectWorkspaceMobile({
  project,
  detail,
  timelineItems,
  composerPrompt,
  setComposerPrompt,
  onSubmit,
  canSubmit,
  canPublish,
  canAutoFix,
  activeAction,
  pendingConversation,
  onRebuild,
  onPublish,
  onAutoFix,
  latestTask,
  onViewLogs,
  conversationRef,
  onOpenStatus,
  onOpenPreview,
  sidebarOpen,
  statusOpen,
  setSidebarOpen,
  setStatusOpen,
  recentProjects,
  navigate,
}: {
  project: ProjectView;
  detail: ProjectDetailResponse | null;
  timelineItems: ConversationTimelineItem[];
  composerPrompt: string;
  setComposerPrompt: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  canPublish: boolean;
  canAutoFix: boolean;
  activeAction: string | null;
  pendingConversation: PendingConversationState | null;
  onRebuild: () => void;
  onPublish: () => void;
  onAutoFix: () => void;
  latestTask: TaskView | null;
  onViewLogs: () => void;
  conversationRef: RefObject<HTMLDivElement | null>;
  onOpenStatus: () => void;
  onOpenPreview: () => void;
  sidebarOpen: boolean;
  statusOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  setStatusOpen: (value: boolean) => void;
  recentProjects: ProjectView[];
  navigate: (path: string) => void;
}) {
  const MOBILE_HISTORY_COLLAPSE_COUNT = 8;
  const [isHistoryCollapsed, setHistoryCollapsed] = useState(false);
  const canCollapseHistory = timelineItems.length > MOBILE_HISTORY_COLLAPSE_COUNT;
  const visibleTimelineItems = isHistoryCollapsed
    ? timelineItems.slice(-MOBILE_HISTORY_COLLAPSE_COUNT)
    : timelineItems;
  const hiddenTimelineCount = Math.max(0, timelineItems.length - visibleTimelineItems.length);

  useEffect(() => {
    const container = conversationRef.current;
    if (!container) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const node = conversationRef.current;
      if (!node) {
        return;
      }
      node.scrollTop = node.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [conversationRef, isHistoryCollapsed, pendingConversation?.id, visibleTimelineItems.length]);

  return (
    <MobilePageSurface className="sn-mobile-project-page">
      <div className="sn-mobile-project-content sn-mobile-chat-page" ref={conversationRef}>
        <div className="sn-mobile-project-header">
          <div className="sn-mobile-project-header-left">
            <MobileIconButton
              type="button"
              aria-label="菜单"
              onClick={() => {
                setSidebarOpen(true);
                setStatusOpen(false);
              }}
            >
              <Menu className="size-4" />
            </MobileIconButton>
            <div className="sn-mobile-project-header-title">
              <div className="sn-mobile-project-name-row">
                <div className="sn-mobile-brand">{project.displayName}</div>
                <button className="sn-mobile-project-edit-button" type="button" aria-label="编辑项目名称">
                  <Edit2 className="size-3" />
                </button>
              </div>
            </div>
          </div>
          <div className="sn-mobile-project-header-right">
            <StatusChip tone={statusTone(project.status) as 'preview-ready' | 'published' | 'building' | 'needs-fix'}>
              {statusLabel(project.status)}
            </StatusChip>
            <MobileIconButton className="is-soft" type="button" aria-label="项目详情" onClick={onOpenStatus}>
              <Info className="size-4" />
            </MobileIconButton>
          </div>
        </div>

        <div className="sn-mobile-chat-history-bar">
          <div className="sn-mobile-chat-history-copy">
            <div className="sn-mobile-chat-history-title">对话记录</div>
            <div className="sn-mobile-chat-history-meta">
              共 {timelineItems.length} 条
              {canCollapseHistory ? ' · 默认展开全部' : ''}
            </div>
          </div>
          {canCollapseHistory ? (
            <button
              className="sn-mobile-chat-history-toggle"
              type="button"
              onClick={() => setHistoryCollapsed((current) => !current)}
              aria-pressed={isHistoryCollapsed}
            >
              {isHistoryCollapsed ? '展开早期记录' : '收起早期记录'}
            </button>
          ) : null}
        </div>

        {isHistoryCollapsed && canCollapseHistory ? (
          <button
            className="sn-mobile-chat-history-summary"
            type="button"
            onClick={() => setHistoryCollapsed(false)}
          >
            已收起 {hiddenTimelineCount} 条早期记录，点击展开全部
          </button>
        ) : null}

        <div className="sn-mobile-chat-stack">
          {visibleTimelineItems.length === 0 ? (
            <div className="sn-mobile-chat-empty">刚打开这个项目。先说一句你要改什么。</div>
          ) : (
            visibleTimelineItems.map((item) => <TimelineEntry key={item.id} item={item} latestTask={latestTask} />)
          )}
        </div>

        <PendingConversationBubble pendingConversation={pendingConversation} />

      </div>

        <div className="sn-mobile-project-composer-fixed">
          <div className="sn-mobile-project-composer-actions">
          <MobileActionButton variant="secondary" className="sn-mobile-project-preview-button" onClick={onOpenPreview}>
            <Eye className="size-4" /> Preview
          </MobileActionButton>
        </div>
        <div className="sn-mobile-home-composer-card is-bottom">
          <textarea
            className="sn-mobile-home-composer-input"
            placeholder="你想做什么？"
            value={composerPrompt}
            onChange={(event) => setComposerPrompt(event.target.value)}
          />
          <div className="sn-mobile-home-composer-actions">
            <MobileIconButton className="is-soft" type="button" aria-label="附件">
              <Paperclip className="size-4" />
            </MobileIconButton>
            <button
              className="sn-mobile-send-button"
              type="button"
              aria-label="发送"
              onClick={onSubmit}
              disabled={!canSubmit || activeAction !== null}
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <HomeWorkspaceDrawer
        open={sidebarOpen}
        projectsLoading={false}
        recentProjects={recentProjects}
        navigate={navigate}
        onClose={() => setSidebarOpen(false)}
        onOpenTemplates={() => {
          navigate('/templates');
          setSidebarOpen(false);
        }}
        onOpenProjects={() => {
          navigate('/projects');
          setSidebarOpen(false);
        }}
        onOpenSettings={() => {
          navigate('/settings');
          setSidebarOpen(false);
          setStatusOpen(false);
        }}
      />

      <WorkspaceStatusDrawer
        open={statusOpen}
        project={project}
        detail={detail}
        canPublish={canPublish}
        activeAction={activeAction}
        onClose={() => setStatusOpen(false)}
        onOpenPreview={onOpenPreview}
        onPublish={onPublish}
              onContinueEditing={() => document.querySelector('.sn-mobile-project-composer-fixed')?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
        onAutoFix={onAutoFix}
        onViewLogs={() => document.querySelector('.status-logs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />
    </MobilePageSurface>
  );
}

function HomeWorkspaceDrawer({
  open,
  projectsLoading,
  recentProjects,
  navigate,
  onClose,
  onOpenTemplates,
  onOpenProjects,
  onOpenSettings,
}: {
  open: boolean;
  projectsLoading: boolean;
  recentProjects: ProjectView[];
  navigate: (path: string) => void;
  onClose: () => void;
  onOpenTemplates: () => void;
  onOpenProjects: () => void;
  onOpenSettings: () => void;
}) {
  const { shouldRender, isOpen } = useDrawerTransition(open);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [recentProjectsOpen, setRecentProjectsOpen] = useState(true);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`sn-mobile-drawer-shell ${isOpen ? 'is-open' : ''}`.trim()}
      role="presentation"
    >
      <button className="sn-mobile-drawer-backdrop" type="button" aria-label="关闭抽屉" onClick={onClose} />
      <div ref={sheetRef} className="sn-mobile-drawer-sheet" onClick={(event) => event.stopPropagation()}>
        <button className="sn-mobile-drawer-close" type="button" onClick={onClose} aria-label="关闭项目抽屉">
          ×
        </button>
        <div className="sn-mobile-drawer-brand">
          <div className="sn-mobile-drawer-brand-main">
            <div className="sn-mobile-drawer-mark">
              <Zap className="size-4" />
            </div>
            <div className="sn-mobile-drawer-brand-name">ShipNow</div>
          </div>
        </div>
        <div className="sn-mobile-drawer-group">
          <button className="sn-mobile-drawer-item" type="button" onClick={onOpenTemplates}>
            <LayoutGrid className="size-4" />
            <span>模板中心</span>
            <ChevronRight className="size-4" />
          </button>
          <button className="sn-mobile-drawer-item" type="button" onClick={onOpenProjects}>
            <Folder className="size-4" />
            <span>项目管理</span>
            <ChevronRight className="size-4" />
          </button>
          <button className="sn-mobile-drawer-item" type="button" onClick={onOpenSettings}>
            <Settings2 className="size-4" />
            <span>设置与偏好</span>
            <ChevronRight className="size-4" />
          </button>
        </div>
        <details
          className="sn-mobile-drawer-group sn-mobile-drawer-collapsible"
          open={recentProjectsOpen}
          onToggle={(event) => setRecentProjectsOpen(event.currentTarget.open)}
        >
          <summary className="sn-mobile-drawer-section-head sn-mobile-drawer-section-toggle">
            <span className="sn-mobile-drawer-section-title">最近项目</span>
            <div className="flex items-center gap-2">
              <span className="sn-mobile-drawer-section-count">{projectsLoading ? '加载中' : `${recentProjects.length} 个`}</span>
              <ChevronDown className={`size-4 sn-mobile-drawer-section-chevron ${recentProjectsOpen ? 'is-open' : ''}`.trim()} />
            </div>
          </summary>
          <div className="sn-mobile-drawer-section-body">
            {recentProjects.length === 0 ? (
              <div className="sn-mobile-drawer-empty">还没有项目，先从一句话开始。</div>
            ) : (
              recentProjects.map((project) => (
                <button
                  key={project.projectId}
                  className="sn-mobile-drawer-item is-project"
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/project/${project.projectId}`);
                  }}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="min-w-0 flex-1 truncate font-medium">{project.displayName}</div>
                    <span className={`sn-mobile-drawer-status-text ${statusTone(project.status)}`.trim()}>
                      {statusLabel(project.status)}
                    </span>
                  </div>
                  <ChevronRight className="size-4" />
                </button>
              ))
            )}
          </div>
        </details>
        <div className="sn-mobile-drawer-footer">
          <SnActionButton
            variant="primary"
            className="sn-mobile-drawer-create-btn"
            onClick={() => {
              navigate('/');
              onClose();
            }}
          >
            <Plus className="size-4" />
            新建项目
          </SnActionButton>
          <div className="sn-mobile-drawer-user">
            <div className="sn-chat-avatar">K</div>
            <div>
              <div className="sn-mobile-drawer-user-name">Knight</div>
              <div className="sn-mobile-drawer-user-mail">knight@shipnow.com</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectWorkspaceDrawer({
  open,
  currentProject,
  recentProjects,
  navigate,
  onClose,
  onCreateProject,
  onOpenTemplates,
  onOpenProjects,
  onOpenReleases,
  onOpenSettings,
  onSelectTemplate,
}: {
  open: boolean;
  currentProject: ProjectView;
  recentProjects: ProjectView[];
  navigate: (path: string) => void;
  onClose: () => void;
  onCreateProject: () => void;
  onOpenTemplates: () => void;
  onOpenProjects: () => void;
  onOpenReleases: () => void;
  onOpenSettings: () => void;
  onSelectTemplate: (prompt: string) => void;
}) {
  const { shouldRender, isOpen } = useDrawerTransition(open);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [recentTasksOpen, setRecentTasksOpen] = useState(true);
  const [releaseHistoryOpen, setReleaseHistoryOpen] = useState(true);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`sn-mobile-drawer-shell ${isOpen ? 'is-open' : ''}`.trim()}
      role="presentation"
    >
      <button
        className="sn-mobile-drawer-backdrop"
        type="button"
        aria-label="关闭抽屉"
        onClick={onClose}
      />
      <div ref={sheetRef} className="sn-mobile-drawer-sheet" onClick={(event) => event.stopPropagation()}>
        <button className="sn-mobile-drawer-close" type="button" onClick={onClose} aria-label="关闭项目抽屉">
          ×
        </button>
        <div className="sn-mobile-drawer-brand">
          <div className="sn-mobile-drawer-brand-main">
            <div className="sn-mobile-drawer-mark">
              <Zap className="size-4" />
            </div>
            <div className="sn-mobile-drawer-brand-name">ShipNow</div>
          </div>
        </div>
        <button className="sn-mobile-drawer-item is-highlight" type="button" onClick={onCreateProject}>
          <Plus className="size-4" />
          <span>新建项目</span>
        </button>
        <div className="sn-mobile-drawer-group">
          <button className="sn-mobile-drawer-item" type="button" onClick={onOpenTemplates}>
            <LayoutGrid className="size-4" />
            <span>模板中心</span>
            <ChevronRight className="size-4" />
          </button>
          <button className="sn-mobile-drawer-item" type="button" onClick={onOpenProjects}>
            <Folder className="size-4" />
            <span>项目管理</span>
            <ChevronRight className="size-4" />
          </button>
          <button className="sn-mobile-drawer-item" type="button" onClick={onOpenReleases}>
            <CalendarDays className="size-4" />
            <span>最近发布</span>
            <ChevronRight className="size-4" />
          </button>
          <button className="sn-mobile-drawer-item" type="button" onClick={onOpenSettings}>
            <Settings2 className="size-4" />
            <span>设置与偏好</span>
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="sn-mobile-drawer-footer">
          <div className="sn-mobile-drawer-user">
            <div className="sn-chat-avatar">K</div>
            <div>
              <div className="sn-mobile-drawer-user-name">Knight</div>
              <div className="sn-mobile-drawer-user-mail">knight@shipnow.com</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectStatusContent({
  project,
  detail,
  latestTask,
  showTaskInfo = false,
  onViewLogs,
}: {
  project: ProjectView;
  detail: ProjectDetailResponse | null;
  latestTask?: TaskView | null;
  showTaskInfo?: boolean;
  onViewLogs?: () => void;
}) {
  const [releaseHistoryOpen, setReleaseHistoryOpen] = useState(true);
  const releases = detail?.releases ?? [];

  const copyToClipboard = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Ignore clipboard failures; the address remains visible.
    }
  };

  return (
    <>
      <div className="sn-reference-status-block">
        <div className="sn-reference-project-head">
          <div className="sn-reference-label">当前状态</div>
          <StatusChip tone={statusTone(project.status) as 'preview-ready' | 'published' | 'building' | 'needs-fix'}>
            {statusLabel(project.status)}
          </StatusChip>
        </div>
        <div className="sn-reference-note">预览已就绪，随时可以发布到线上。</div>
      </div>

      <div className="sn-reference-status-block">
        <div className="sn-reference-label">预览地址</div>
        <button
          type="button"
          className="sn-reference-address"
          onClick={() => copyToClipboard(project.previewUrl)}
          aria-label="复制预览地址"
        >
          <span className="sn-reference-address-text">{project.previewUrl}</span>
          <Copy className="size-4" />
        </button>
      </div>

      <div className="sn-reference-status-block">
        <div className="sn-reference-label">线上地址</div>
        {project.status === 'published' ? (
          <button
            type="button"
            className="sn-reference-address"
            onClick={() => copyToClipboard(project.publicUrl)}
            aria-label="复制线上地址"
          >
            <span className="sn-reference-address-text">{project.publicUrl}</span>
            <Copy className="size-4" />
          </button>
        ) : (
          <div className="sn-reference-note">尚未发布到正式版本</div>
        )}
      </div>

      <div className="sn-reference-status-block">
        <div className="sn-reference-block-head">
          <div className="sn-reference-label">发布历史</div>
          <button
            className="sn-reference-collapse-btn"
            type="button"
            onClick={() => setReleaseHistoryOpen((value) => !value)}
            aria-expanded={releaseHistoryOpen}
            aria-label={releaseHistoryOpen ? '收起发布历史' : '展开发布历史'}
          >
            <ChevronDown className={`size-4 ${releaseHistoryOpen ? 'is-rotated' : ''}`} />
          </button>
        </div>
        {releaseHistoryOpen ? (
          releases.length > 0 ? (
            <div className="sn-reference-history-list">
              {releases.slice(0, 3).map((release, index) => (
                <div key={release.id} className="sn-reference-history-item">
                  <div className="sn-reference-history-icon">
                    {release.kind === 'preview' ? <ArrowUpRight className="size-4" /> : <Upload className="size-4" />}
                  </div>
                  <div className="sn-reference-history-copy">
                    <span className="sn-reference-history-title">{release.kind === 'preview' ? '预览版本' : '正式版本'}</span>
                    <small>{formatTime(release.createdAt)}</small>
                  </div>
                  {index === 0 ? <StatusChip tone="preview-ready">最新</StatusChip> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="sn-reference-drawer-empty">还没有发布记录。</div>
          )
        ) : null}
      </div>

      {showTaskInfo ? (
        <>
          <div className="sn-reference-status-block">
            <div className="sn-reference-block-head">
              <div className="sn-reference-label">最近任务</div>
            </div>
            {latestTask ? (
              <div className="sn-reference-task-item">
                <div className="sn-reference-history-icon">
                  <RefreshCcw className="size-4" />
                </div>
                <div className="sn-reference-history-copy">
                  <span className="sn-reference-history-title">{taskTypeLabel(latestTask.type)}</span>
                  <small>{latestTask.finishedAt ? formatTime(latestTask.finishedAt) : formatTime(latestTask.createdAt)}</small>
                </div>
                <StatusChip
                  tone={latestTask.status === 'failed' ? 'needs-fix' : latestTask.status === 'success' ? 'published' : 'building'}
                >
                  {taskStatusLabel(latestTask.status)}
                </StatusChip>
              </div>
            ) : (
              <div className="sn-reference-drawer-empty">还没有最近任务。</div>
            )}
          </div>

          <div className="sn-reference-status-block status-logs">
            <div className="sn-reference-block-head">
              <div className="sn-reference-label">技术日志入口</div>
            </div>
            {latestTask ? (
              <>
                <div className="sn-reference-note">日志路径：{latestTask.logPath}</div>
                {onViewLogs ? (
                  <SnActionButton variant="secondary" onClick={onViewLogs}>
                    查看日志
                  </SnActionButton>
                ) : null}
              </>
            ) : (
              <div className="sn-reference-note">当前没有可用的任务日志。</div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}

function WorkspaceStatusDrawer({
  open,
  project,
  detail,
  canPublish,
  activeAction,
  onClose,
  onOpenPreview,
  onPublish,
  onContinueEditing,
  onAutoFix,
  onViewLogs,
}: {
  open: boolean;
  project: ProjectView;
  detail: ProjectDetailResponse | null;
  canPublish: boolean;
  activeAction: string | null;
  onClose: () => void;
  onOpenPreview: () => void;
  onPublish: () => void;
  onContinueEditing: () => void;
  onAutoFix: () => void;
  onViewLogs: () => void;
}) {
  const { shouldRender, isOpen } = useDrawerTransition(open);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={`sn-mobile-status-shell ${isOpen ? 'is-open' : ''}`.trim()} role="presentation">
      <button className="sn-mobile-drawer-backdrop" type="button" aria-label="关闭抽屉" onClick={onClose} />
      <div ref={sheetRef} className="sn-mobile-status-sheet sn-reference-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sn-reference-sheet-head">
          <div className="sn-reference-sheet-title">项目详情</div>
          <button className="sn-reference-sheet-close" type="button" onClick={onClose} aria-label="关闭状态抽屉">
            ×
          </button>
        </div>
        <ProjectStatusContent project={project} detail={detail} />

      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="sn-project-info-row">
      <span>{label}</span>
      <span className="break-all text-right font-medium text-[rgb(var(--ink))]">{value}</span>
    </div>
  );
}

function Chip({ tone, children }: { tone: string; children: ReactNode }): ReactElement {
  const variant = tone === 'danger' ? 'destructive' : tone === 'success' ? 'secondary' : tone === 'warm' ? 'outline' : 'outline';
  return (
    <Badge variant={variant as 'outline' | 'secondary' | 'destructive' | 'default'} className={tone === 'warm' ? 'border-amber-200 bg-amber-50 text-amber-800' : tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : tone === 'danger' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-border bg-background text-muted-foreground'}>
      {children}
    </Badge>
  );
}

function TimelineEntry({ item, latestTask }: { item: ConversationTimelineItem; latestTask: TaskView | null }): ReactElement {
  if (item.kind === 'message') {
    const bubbleRole = item.role === 'user' ? 'user' : 'assistant';
    return <ChatBubble role={bubbleRole} className={item.id.startsWith('local-') ? 'is-entering' : undefined}>{item.content}</ChatBubble>;
  }

  return <TimelineSystemBubble item={item} latestTask={latestTask} />;
}

function PendingConversationBubble({
  pendingConversation,
}: {
  pendingConversation: PendingConversationState | null;
}): ReactElement | null {
  const [elapsedMs, setElapsedMs] = useState(() => Date.now());

  useEffect(() => {
    if (!pendingConversation) {
      return;
    }

    const tick = window.setInterval(() => {
      setElapsedMs(Date.now());
    }, 1000);

    return () => window.clearInterval(tick);
  }, [pendingConversation?.id]);

  if (!pendingConversation) {
    return null;
  }

  const elapsed = formatElapsedTime(elapsedMs - Date.parse(pendingConversation.startedAt));

  return (
    <ChatBubble role="system" className="is-pending">
      <div className="sn-pending-bubble">
        <div className="sn-pending-bubble-text">
          <span className="sn-pending-bubble-label">我在处理这个请求</span>
          <span className="sn-pending-bubble-time">· {elapsed}</span>
        </div>
        <div className="sn-pending-bubble-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </ChatBubble>
  );
}

function TimelineSystemBubble({
  item,
  latestTask,
}: {
  item: Extract<ConversationTimelineItem, { kind: 'event' }>;
  latestTask: TaskView | null;
}): ReactElement {
  const typeLabel = item.type.replace(/_/g, ' ');
  const isLiveTask = Boolean(
    latestTask && ['pending', 'running'].includes(latestTask.status) && item.taskId && item.taskId === latestTask.id
  );
  const [elapsedMs, setElapsedMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isLiveTask) {
      return;
    }

    const tick = window.setInterval(() => {
      setElapsedMs(Date.now());
    }, 1000);

    return () => window.clearInterval(tick);
  }, [isLiveTask, item.createdAt, item.id]);

  const liveElapsed = isLiveTask ? formatElapsedTime(elapsedMs - Date.parse(item.createdAt)) : null;

  return (
    <ChatBubble role="system">
      <div className={`sn-system-event ${item.type === 'task_progress' ? 'is-progress' : ''} ${isLiveTask ? 'is-live' : ''}`.trim()}>
        <div className="sn-system-event-head">
          <div className="sn-system-event-copy">
            <div className="sn-system-event-kicker">{typeLabel}</div>
            <div className="sn-system-event-title">{item.title}</div>
            {liveElapsed ? (
              <div className="sn-system-event-live">
                <span className="sn-system-event-live-dot" aria-hidden="true" />
                <span>仍在处理 · {liveElapsed}</span>
              </div>
            ) : null}
          </div>
          <div className="sn-system-event-time">{formatTime(item.createdAt)}</div>
        </div>
        {item.detail ? (
          <div className="sn-system-event-detail">
            <RichTextMessage content={item.detail} />
          </div>
        ) : null}
        {item.data ? <pre className="sn-system-event-data">{JSON.stringify(item.data, null, 2)}</pre> : null}
      </div>
    </ChatBubble>
  );
}

export default App;
