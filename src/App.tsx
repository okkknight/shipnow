import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
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
  Share2,
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
  getProject,
  publishProject,
  rebuildProject,
  renameProject,
  listProjects,
  updateAppSettings,
  updateProjectSettings,
} from './api';
import { getShipNowRuntimeConfig } from './runtimeConfig';
import { buildConversationTimeline, type ConversationTimelineItem } from './conversationTimeline';
import { copyText } from './clipboard';
import {
  createDeferredDelete,
  DEFERRED_DELETE_WINDOW_MS,
  getDeferredDeleteRemainingMs,
  isDeferredDeleteUndoable,
  markDeferredDeleteCommitting,
  type DeferredDeleteState,
} from './projectDeletion';
import { RichTextMessage } from './messageFormatting';
import { subscribeProjectTimeline } from './projectTimelineStream';
import {
  buildProjectLivePath,
  buildProjectPreviewPath,
  hasEverBuiltPreviewProject,
  hasEverPublishedProject,
  parseWorkspaceRoute,
  type WorkspaceRouteState,
} from './workspaceRoutes';
import type {
  ProjectDetailResponse,
  ProjectEventView,
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
const FORCE_MOBILE_LAYOUT = true;
const RUNTIME_CONFIG = getShipNowRuntimeConfig();

function toAppPath(pathname: string): string {
  const next = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (!APP_BASE) {
    return next;
  }
  return next === '/' ? `${APP_BASE}/` : `${APP_BASE}${next}`;
}

function useWorkspaceRoute() {
  const [route, setRoute] = useState<WorkspaceRouteState>(() => parseWorkspaceRoute(window.location.pathname, APP_BASE));

  useEffect(() => {
    const handlePopState = () => setRoute(parseWorkspaceRoute(window.location.pathname, APP_BASE));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string): void => {
    const nextPath = toAppPath(path);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
      setRoute(parseWorkspaceRoute(window.location.pathname, APP_BASE));
    }
  };

  return { route, navigate };
}

function useMediaQuery(query: string): boolean {
  if (FORCE_MOBILE_LAYOUT) {
    return true;
  }

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

function useAutoSizingTextarea(value: string) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return textareaRef;
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

function RouteEnterTransition({ children }: { children: ReactNode }): ReactElement {
  const [isEntered, setIsEntered] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <div className={`sn-route-enter ${isEntered ? 'is-entered' : ''}`.trim()}>{children}</div>;
}

function RouteFadeTransition({ children }: { children: ReactNode }): ReactElement {
  const [isEntered, setIsEntered] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <div className={`sn-route-fade ${isEntered ? 'is-entered' : ''}`.trim()}>{children}</div>;
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

function replaceUrlHandle(url: string, handle: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${handle}`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
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
    case 'project_rename_pending':
      return '重命名待生效';
    case 'project_rename_applied':
      return '重命名已生效';
    case 'project_rename_cleared':
      return '重命名已恢复';
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

function buildOptimisticAutoFixEvent(projectId: string, createdAt: string): ProjectEventView {
  return {
    id: `local-auto-fix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    taskId: null,
    type: 'task_progress',
    title: '正在自动修复',
    detail: 'ShipNow 正在根据最近一次失败信息尝试修复并重新构建预览。',
    data: {
      phase: 'auto-fix',
      status: 'running',
    },
    createdAt,
  };
}

function App() {
  const { route, navigate } = useWorkspaceRoute();
  const isEnhancedRoute = route.kind === 'design-system' || route.kind === 'visual-reference';
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
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetProject, setDeleteTargetProject] = useState<ProjectView | null>(null);
  const [deferredDelete, setDeferredDelete] = useState<DeferredDeleteState | null>(null);
  const [renameSheetOpen, setRenameSheetOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [pendingConversation, setPendingConversation] = useState<PendingConversationState | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const renameSheetOpenRef = useRef(false);
  const createTransitionProjectIdRef = useRef<string | null>(null);
  const deferredDeleteTimerRef = useRef<number | null>(null);
  const deferredDeleteRef = useRef<DeferredDeleteState | null>(null);
  const [, setDeferredDeleteTick] = useState(0);
  const routeProjectId =
    route.kind === 'project' ||
    route.kind === 'project-preview' ||
    route.kind === 'project-live' ||
    route.kind === 'publish-success' ||
    route.kind === 'publish-failure'
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
  const pendingDeleteProjectId = deferredDelete?.projectId ?? null;
  const pendingDeletePhase = deferredDelete?.phase ?? null;
  const currentProjectPendingDelete = Boolean(currentProject && pendingDeleteProjectId === currentProject.projectId);

  useEffect(() => {
    deferredDeleteRef.current = deferredDelete;
  }, [deferredDelete]);

  const timelineItems = useMemo(() => buildConversationTimeline(detail), [detail]);
  const latestTimelineItemId = timelineItems.length > 0 ? timelineItems[timelineItems.length - 1]!.id : null;

  const activeTasks = projects.filter((project) => ['generating', 'publishing'].includes(project.status)).length;
  const publishedProjects = projects.filter((project) => project.status === 'published').length;
  const failedProjects = projects.filter((project) => ['build_failed', 'publish_failed'].includes(project.status)).length;

  useEffect(() => {
    if (!copyHint) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopyHint(null);
    }, 1600);

    return () => window.clearTimeout(timeout);
  }, [copyHint]);

  useEffect(() => () => clearDeferredDeleteTimer(), []);

  useEffect(() => {
    if (currentProject) {
      return;
    }
    setRenameSheetOpen(false);
    setRenameError(null);
  }, [currentProject]);

  useEffect(() => {
    if (route.kind !== 'project-live') {
      setShareSheetOpen(false);
    }
  }, [route.kind]);

  async function handleCopy(value: string, successMessage = '已复制'): Promise<boolean> {
    const ok = await copyText(value);
    setCopyHint(ok ? successMessage : '复制失败');
    return ok;
  }

  async function handleShareTarget(target: 'friend' | 'moments'): Promise<void> {
    if (!currentProject) {
      return;
    }

    const title = currentProject.displayName;
    const text =
      target === 'moments'
        ? `我刚发布了「${currentProject.displayName}」`
        : `分享你看一下「${currentProject.displayName}」`;
    const url = currentProject.publicUrl;
    const navigatorLike = typeof window !== 'undefined' ? (window.navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> }) : null;

    if (typeof navigatorLike?.share === 'function') {
      try {
        await navigatorLike.share({ title, text, url });
        setCopyHint(target === 'moments' ? '已唤起朋友圈分享' : '已唤起微信分享');
        setShareSheetOpen(false);
        return;
      } catch {
        // If the browser share sheet is dismissed, keep the panel open so the user can choose another path.
      }
    }

    const copied = await handleCopy(url, '链接已复制，可在微信中粘贴分享');
    if (copied) {
      setShareSheetOpen(false);
    }
  }

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
      if (!renameSheetOpenRef.current) {
        setRenameDraft(response.project.displayName);
      }
      setRenameError(null);
      setError(null);
    } catch (refreshError) {
      setDetail(null);
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setDetailLoading(false);
    }
  }

  function clearDeferredDeleteTimer(): void {
    if (deferredDeleteTimerRef.current !== null) {
      window.clearTimeout(deferredDeleteTimerRef.current);
      deferredDeleteTimerRef.current = null;
    }
  }

  function closeDeleteConfirm(): void {
    setDeleteConfirmOpen(false);
    setDeleteTargetProject(null);
  }

  function requestDeleteProject(project: ProjectView): void {
    if (deferredDeleteRef.current) {
      setError('当前有项目处于待删除状态，请先撤销或等待完成。');
      return;
    }

    setDeleteTargetProject(project);
    setDeleteConfirmOpen(true);
  }

  function undoDeferredDelete(): void {
    const pending = deferredDeleteRef.current;
    if (!pending || !isDeferredDeleteUndoable(pending)) {
      return;
    }

    clearDeferredDeleteTimer();
    deferredDeleteRef.current = null;
    setDeferredDelete(null);
    setCopyHint('删除已撤销');
  }

  async function commitDeferredDelete(projectId: string): Promise<void> {
    const pending = deferredDeleteRef.current;
    if (!pending || pending.projectId !== projectId) {
      return;
    }
    if (pending.phase !== 'queued') {
      return;
    }

    clearDeferredDeleteTimer();
    const committing = markDeferredDeleteCommitting(pending);
    deferredDeleteRef.current = committing;
    setDeferredDelete(committing);
    setActiveAction('delete');

    try {
      await deleteProject(projectId);
      setProjects((current) => current.filter((project) => project.projectId !== projectId));
      void refreshProjects();
      if (routeProjectId === projectId) {
        navigate('/');
      }
      if (detail?.project?.projectId === projectId) {
        setDetail(null);
      }
      setComposerPrompt('');
      setCopyHint('项目已删除');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
      deferredDeleteRef.current = null;
      setDeferredDelete(null);
    } finally {
      setActiveAction(null);
      if (deferredDeleteRef.current?.projectId === projectId) {
        deferredDeleteRef.current = null;
        setDeferredDelete(null);
      }
    }
  }

  async function scheduleDeferredDelete(project: ProjectView): Promise<void> {
    clearDeferredDeleteTimer();
    const pending = createDeferredDelete(project);
    deferredDeleteRef.current = pending;
    setDeferredDelete(pending);

    const remainingMs = Math.max(0, pending.executeAt - Date.now());
    deferredDeleteTimerRef.current = window.setTimeout(() => {
      void commitDeferredDelete(project.projectId);
    }, remainingMs);
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
      if (createTransitionProjectIdRef.current === routeProjectId) {
        if (detail?.project?.projectId === routeProjectId) {
          setDetailLoading(false);
          return;
        }
        return;
      }
      if (detail?.project?.projectId === routeProjectId) {
        setDetailLoading(false);
        return;
      }
      setDetail(null);
      void refreshDetail(routeProjectId);
    } else {
      setDetail(null);
    }
  }, [isEnhancedRoute, route.kind, routeProjectId]);

  useEffect(() => {
    if (!createTransitionProjectIdRef.current) {
      return;
    }
    if (routeProjectId !== createTransitionProjectIdRef.current) {
      return;
    }
    if (detail?.project?.projectId !== createTransitionProjectIdRef.current) {
      return;
    }

    createTransitionProjectIdRef.current = null;
  }, [detail?.project?.projectId, routeProjectId]);

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

  useLayoutEffect(() => {
    if (isEnhancedRoute) {
      return;
    }

    conversationEndRef.current?.scrollIntoView({ block: 'end' });
  }, [isEnhancedRoute, latestTimelineItemId, pendingConversation?.id, route.kind, routeProjectId]);

  useLayoutEffect(() => {
    if (isEnhancedRoute) {
      return;
    }
    if (!conversationRef.current) {
      return;
    }

    const container = conversationRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [isEnhancedRoute, latestTimelineItemId, pendingConversation?.id, route.kind, routeProjectId]);

  const createFromComposer = route.kind === 'home';
  const canSubmitComposer = composerPrompt.trim().length > 0 && activeAction === null && !currentProjectPendingDelete;
  const canPublish = Boolean(
    currentProject &&
      !currentProjectPendingDelete &&
      ['preview_ready', 'published', 'publish_failed'].includes(currentProject.status)
  );
  const canAutoFix = Boolean(
    currentProject &&
      detail &&
      !currentProjectPendingDelete &&
      ['build_failed', 'publish_failed', 'failed'].includes(currentProject.status)
  );
  const renameNormalized = slugifyHandle(renameDraft);
  const renameValidation = renameDraft.trim().length > 0 ? validateHandle(renameNormalized) : '名称不能为空。';
  const renameBaseline = currentProject?.pendingPublicHandle ?? currentProject?.publicHandle ?? '';
  const renameDirty = Boolean(currentProject && renameNormalized !== renameBaseline);
  const publishSheetOpen = publishConfirmOpen || previewConfirmDebug;
  const actionSheetOpen = publishSheetOpen || renameSheetOpen;

  useEffect(() => {
    if (!deferredDelete || deferredDelete.phase !== 'queued') {
      return;
    }

    const timer = window.setInterval(() => {
      setDeferredDeleteTick((value) => value + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [deferredDelete?.executeAt, deferredDelete?.phase]);

  useEffect(() => {
    if (!actionSheetOpen) {
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
  }, [actionSheetOpen]);

  useEffect(() => {
    renameSheetOpenRef.current = renameSheetOpen;
  }, [renameSheetOpen]);

  function openRenameSheet(): void {
    if (!currentProject || activeAction !== null) {
      return;
    }

    setRenameDraft(currentProject.displayName);
    setRenameError(null);
    setRenameSheetOpen(true);
  }

  function closeRenameSheet(): void {
    setRenameSheetOpen(false);
    setRenameError(null);
    if (currentProject) {
      setRenameDraft(currentProject.displayName);
    }
  }

  async function handleComposerSubmit(): Promise<void> {
    const prompt = composerPrompt.trim();
    if (!prompt) {
      setError('请输入一句话描述。');
      return;
    }
    if (currentProjectPendingDelete) {
      setError('当前项目正在删除中，不能继续编辑。');
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
        createTransitionProjectIdRef.current = result.project.projectId;
        await refreshProjects();
        await refreshDetail(result.project.projectId);
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
    if (currentProjectPendingDelete) {
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
    if (currentProjectPendingDelete) {
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
    if (currentProjectPendingDelete) {
      return;
    }
    const previousDetail = detail;
    const startedAt = new Date().toISOString();
    const optimisticAutoFixEvent = buildOptimisticAutoFixEvent(currentProject.projectId, startedAt);
    setPendingConversation({
      id: optimisticAutoFixEvent.id,
      startedAt,
      prompt: 'ShipNow 正在根据最近一次失败信息自动修复并重新构建预览。',
    });
    setDetail((current) => {
      if (!current || current.project.projectId !== currentProject.projectId) {
        return current;
      }
      return {
        ...current,
        events: [...current.events, optimisticAutoFixEvent],
      };
    });
    navigate(`/project/${currentProject.projectId}`);
    setActiveAction('auto-fix');
    try {
      const result = await applyChange(currentProject.projectId, buildAutoFixPrompt(detail));
      await refreshProjects();
      await refreshDetail(result.project.projectId);
      setComposerPrompt('');
    } catch (autoFixError) {
      setDetail(previousDetail);
      setError(autoFixError instanceof Error ? autoFixError.message : String(autoFixError));
    } finally {
      setActiveAction(null);
      setPendingConversation(null);
    }
  }

  async function handleRename(): Promise<void> {
    if (!currentProject) {
      return;
    }
    if (currentProjectPendingDelete) {
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
      setRenameSheetOpen(false);
    } catch (renameActionError) {
      setRenameError(renameActionError instanceof Error ? renameActionError.message : String(renameActionError));
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleteTargetProject) {
      return;
    }
    if (deferredDeleteRef.current) {
      setError('当前有项目处于待删除状态，请先撤销或等待完成。');
      closeDeleteConfirm();
      return;
    }
    closeDeleteConfirm();
    await scheduleDeferredDelete(deleteTargetProject);
  }

  const homeRecentProjects = projects.slice(0, 4);
  const currentTasks = detail?.tasks ?? [];
  const latestTask = currentTasks[0] ?? null;
  const shouldAnimateRoute =
    route.kind === 'project-preview' ||
    route.kind === 'project-live' ||
    route.kind === 'publish-success' ||
    route.kind === 'publish-failure';
  const shouldFadeProjectRoute = route.kind === 'project';
  const routeAnimationKey = shouldAnimateRoute
    ? `${route.kind}:${'projectId' in route ? route.projectId : ''}`
    : null;
  const projectRouteAnimationKey = shouldFadeProjectRoute ? `project:${routeProjectId ?? ''}` : null;

  if (route.kind === 'design-system') {
    return <ShipNowDesignSystemPage />;
  }

  if (route.kind === 'visual-reference') {
    return <ShipNowVisualReferencePage />;
  }

  let page: ReactElement;

  if ((route.kind === 'project-preview' || route.kind === 'project-live') && currentProject) {
    const isLiveRoute = route.kind === 'project-live';
    page = (
      <MobilePreviewPage
        projectName={currentProject.displayName}
        frameUrl={isLiveRoute ? currentProject.publicUrl : currentProject.previewUrl}
        onBackEdit={() => navigate(`/project/${currentProject.projectId}`)}
        onShare={isLiveRoute ? () => setShareSheetOpen(true) : undefined}
        onPublish={isLiveRoute ? undefined : () => setPublishConfirmOpen(true)}
        mode={isLiveRoute ? 'live' : 'preview'}
      />
    );
  } else if ((route.kind === 'publish-success' || route.kind === 'publish-failure') && currentProject) {
    page = (
      <MobilePublishResultPage
        success={route.kind === 'publish-success'}
        publicUrl={currentProject.publicUrl}
        onOpenWebsite={() => navigate(buildProjectLivePath(currentProject.projectId))}
        onCopyLink={() => void handleCopy(currentProject.publicUrl, '线上地址已复制')}
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
        onRequestDelete={requestDeleteProject}
        onUndoDelete={undoDeferredDelete}
        onBackHome={() => navigate('/')}
        recentProjects={homeRecentProjects}
        navigate={navigate}
        pendingDeleteProjectId={pendingDeleteProjectId}
        pendingDeletePhase={pendingDeletePhase}
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
        apiBase={RUNTIME_CONFIG.apiBaseUrl}
        projectsLoading={projectsLoading}
        homeRecentProjects={homeRecentProjects}
        route={route}
        navigate={navigate}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
    );
  } else if (detailLoading && !detail) {
    page = <ProjectWorkspaceLoadingScreen />;
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
        onOpenPreview={() => navigate(buildProjectPreviewPath(currentProject.projectId))}
        onOpenLive={() => navigate(buildProjectLivePath(currentProject.projectId))}
        onEditProjectName={openRenameSheet}
        onCopyPreviewUrl={() => void handleCopy(currentProject.previewUrl, '预览地址已复制')}
        onCopyPublicUrl={() => void handleCopy(currentProject.publicUrl, '线上地址已复制')}
        conversationEndRef={conversationEndRef}
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

  const renderedPage = shouldAnimateRoute && routeAnimationKey ? (
    <RouteEnterTransition key={routeAnimationKey}>{page}</RouteEnterTransition>
  ) : shouldFadeProjectRoute && projectRouteAnimationKey ? (
    <RouteFadeTransition key={projectRouteAnimationKey}>{page}</RouteFadeTransition>
  ) : (
    page
  );

  return (
    <div className="shipnow-app">
      <div className="sn-app-backdrop" />

      {error ? <div className="error-banner shell-panel">{error}</div> : null}

      <div className="shipnow-app-content">{renderedPage}</div>

      {copyHint ? (
        <div className="sn-copy-toast sn-mobile-result-toast" role="status" aria-live="polite">
          {copyHint}
        </div>
      ) : null}

      {deferredDelete ? (
        <div className={`sn-delete-toast ${deferredDelete.phase === 'committing' ? 'is-committing' : ''}`.trim()} role="status" aria-live="polite">
          <span className="sn-delete-toast-copy">
            {deferredDelete.phase === 'committing'
              ? '删除中'
              : `${Math.max(1, Math.ceil(getDeferredDeleteRemainingMs(deferredDelete) / 1000))}s`}
          </span>
          {isDeferredDeleteUndoable(deferredDelete) ? (
            <button type="button" className="sn-delete-toast-action" onClick={undoDeferredDelete}>
              撤销删除
            </button>
          ) : (
            <button type="button" className="sn-delete-toast-action is-disabled" disabled>
              删除中
            </button>
          )}
        </div>
      ) : null}

      {currentProject ? (
        <ProjectPublishConfirmSurface
          open={publishConfirmOpen || previewConfirmDebug}
          project={currentProject}
          canPublish={canPublish && activeAction === null}
          onCancel={() => setPublishConfirmOpen(false)}
          onConfirm={handlePublish}
          onCopyLink={() =>
            void handleCopy(
              currentProject.pendingPublicHandle
                ? replaceUrlHandle(currentProject.publicUrl, currentProject.pendingPublicHandle)
                : currentProject.publicUrl,
              '线上地址已复制'
            )
          }
        />
      ) : null}

      {currentProject ? (
        <ProjectShareSheet
          open={shareSheetOpen}
          project={currentProject}
          onCancel={() => setShareSheetOpen(false)}
          onShareTarget={(target) => void handleShareTarget(target)}
          onCopyLink={() => handleCopy(currentProject.publicUrl, '正式站点链接已复制')}
        />
      ) : null}

      {currentProject ? (
        <ProjectRenameSheet
          open={renameSheetOpen}
          project={currentProject}
          draft={renameDraft}
          validation={renameValidation}
          error={renameError}
          saving={activeAction === 'rename'}
          onCancel={closeRenameSheet}
          onDraftChange={(value) => {
            setRenameDraft(value);
            setRenameError(null);
          }}
          onConfirm={() => void handleRename()}
        />
      ) : null}

      {deleteTargetProject ? (
        <ProjectConfirmModal
          open={deleteConfirmOpen}
          destructive
          title="删除这个项目吗？"
          description={`${DEFERRED_DELETE_WINDOW_MS / 1000} 秒内可撤销，超时后开始清理。`}
          details={[
            { label: '项目', value: deleteTargetProject.displayName },
          ]}
          cancelLabel="取消"
          confirmLabel="确认删除"
          confirmDisabled={activeAction !== null}
          onCancel={() => closeDeleteConfirm()}
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
  route: WorkspaceRouteState;
  navigate: (path: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
}) {
  const composerTextareaRef = useAutoSizingTextarea(composerPrompt);

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
                onClick={() => setComposerPrompt('做一个 Landing Page，结构清晰、节奏轻快，突出首屏价值主张和转化动作。')}
              >
                <div className="sn-mobile-home-entry-icon">◌</div>
                <div>
                  <div className="sn-mobile-home-entry-title">Landing Page</div>
                  <div className="sn-mobile-home-entry-desc">快速验证活动与转化</div>
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
              ref={composerTextareaRef}
              className="sn-mobile-home-composer-input"
              rows={1}
              placeholder="你想做什么？"
              value={composerPrompt}
              onChange={(event) => setComposerPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
                  return;
                }
                event.preventDefault();
                void onSubmit();
              }}
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const templates = [
    {
      title: '空白项目',
      desc: '从空白开始，自由发挥',
      prompt: TEMPLATE_PROMPTS[5],
      art: 'blank' as const,
    },
    {
      title: '产品官网',
      desc: '展示产品与功能亮点',
      prompt: TEMPLATE_PROMPTS[0],
      art: 'product' as const,
    },
    {
      title: 'Landing Page',
      desc: '快速验证活动与转化',
      prompt: '做一个活动页，带强视觉冲击和明确的报名 / 购买转化。',
      art: 'landing' as const,
    },
    {
      title: '个人主页',
      desc: '展示自己与作品集',
      prompt: TEMPLATE_PROMPTS[1],
      art: 'profile' as const,
    },
  ];

  function TemplateThumbIllustration({ kind }: { kind: 'blank' | 'product' | 'landing' | 'profile' }): ReactElement {
    const uid = useId().replace(/:/g, '');
    const gradientId = `${uid}-${kind}-gradient`;
    const glowId = `${uid}-${kind}-glow`;

    const palette =
      kind === 'blank'
        ? {
            accent: '#0d6b50',
            accent2: '#7ecdb1',
            accentSoft: 'rgba(183,241,223,0.58)',
            bg0: '#fbfdff',
            bg1: '#dceeff',
            bg2: '#def6ef',
            glow1: '#bfe0ff',
            glow2: '#c7f3e1',
            card: 'rgba(255,255,255,0.78)',
            cardStrong: 'rgba(255,255,255,0.9)',
            line: 'rgba(15,17,21,0.08)',
            lineSoft: 'rgba(15,17,21,0.05)',
          }
        : kind === 'product'
          ? {
              accent: '#0d6b50',
              accent2: '#8ea9bf',
              accentSoft: 'rgba(183,241,223,0.58)',
              bg0: '#f4fbff',
              bg1: '#dfeeff',
              bg2: '#e0f7ef',
              glow1: '#c6ddff',
              glow2: '#cef1e2',
              card: 'rgba(255,255,255,0.76)',
              cardStrong: 'rgba(255,255,255,0.88)',
              line: 'rgba(15,17,21,0.07)',
              lineSoft: 'rgba(15,17,21,0.045)',
            }
          : kind === 'landing'
            ? {
                accent: '#0d6b50',
                accent2: '#ebb883',
                accentSoft: 'rgba(183,241,223,0.54)',
                bg0: '#fff9f1',
                bg1: '#eef6ff',
                bg2: '#e4f7ea',
                glow1: '#ffd8b5',
                glow2: '#c7f2df',
                card: 'rgba(255,255,255,0.76)',
                cardStrong: 'rgba(255,255,255,0.88)',
                line: 'rgba(15,17,21,0.07)',
                lineSoft: 'rgba(15,17,21,0.045)',
              }
            : {
                accent: '#5e6dff',
                accent2: '#84b5ee',
                accentSoft: 'rgba(198,208,255,0.56)',
                bg0: '#faf7ff',
                bg1: '#eef2ff',
                bg2: '#ecfaf4',
                glow1: '#d9ceff',
                glow2: '#c8e3ff',
                card: 'rgba(255,255,255,0.78)',
                cardStrong: 'rgba(255,255,255,0.9)',
                line: 'rgba(15,17,21,0.07)',
                lineSoft: 'rgba(15,17,21,0.045)',
              };

    return (
      <svg className="sn-template-thumb-art" viewBox="0 0 483 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.bg0} stopOpacity="0.98" />
            <stop offset="50%" stopColor={palette.bg1} stopOpacity="0.98" />
            <stop offset="100%" stopColor={palette.bg2} stopOpacity="0.92" />
          </linearGradient>
          <radialGradient id={glowId} cx="0.18" cy="0.2" r="0.92">
            <stop offset="0%" stopColor={palette.glow1} stopOpacity="0.95" />
            <stop offset="58%" stopColor={palette.glow2} stopOpacity="0.32" />
            <stop offset="100%" stopColor={palette.glow2} stopOpacity="0" />
          </radialGradient>
        </defs>

        <g>
          <rect x="0" y="0" width="483" height="100" rx="18" fill={`url(#${gradientId})`} />
          <rect x="0" y="0" width="483" height="100" rx="18" fill={`url(#${glowId})`} opacity="0.72" />

          {kind === 'blank' ? (
            <>
              <rect x="18" y="14" width="447" height="72" rx="18" fill="rgba(255,255,255,0.36)" stroke="rgba(255,255,255,0.22)" />
              <rect x="32" y="28" width="118" height="10" rx="5" fill="rgba(255,255,255,0.82)" />
              <rect x="32" y="44" width="82" height="7" rx="3.5" fill="rgba(15,17,21,0.08)" />
              <rect x="32" y="56" width="100" height="7" rx="3.5" fill="rgba(15,17,21,0.06)" />
              <rect x="156" y="24" width="192" height="44" rx="18" fill="rgba(255,255,255,0.62)" />
              <rect x="176" y="38" width="96" height="8" rx="4" fill="rgba(255,255,255,0.8)" />
              <rect x="176" y="51" width="74" height="7" rx="3.5" fill="rgba(15,17,21,0.1)" />
              <rect x="276" y="35" width="42" height="22" rx="11" fill="rgba(255,255,255,0.86)" />
              <path d="M297 40v12M291 46h12" stroke={palette.accent} strokeWidth="2.4" strokeLinecap="round" />
              <rect x="360" y="24" width="82" height="44" rx="18" fill="rgba(255,255,255,0.38)" />
              <rect x="378" y="38" width="46" height="6" rx="3" fill={palette.accentSoft} />
              <rect x="378" y="48" width="28" height="6" rx="3" fill="rgba(15,17,21,0.08)" />
              <rect x="30" y="74" width="420" height="6" rx="3" fill="rgba(15,17,21,0.04)" />
            </>
          ) : null}

          {kind === 'product' ? (
            <>
              <rect x="18" y="14" width="96" height="72" rx="18" fill="rgba(255,255,255,0.66)" />
              <rect x="32" y="28" width="54" height="10" rx="5" fill={palette.cardStrong} />
              <rect x="32" y="46" width="36" height="7" rx="3.5" fill={palette.line} />
              <rect x="32" y="58" width="48" height="7" rx="3.5" fill={palette.lineSoft} />
              <rect x="32" y="70" width="60" height="8" rx="4" fill="rgba(255,255,255,0.92)" />
              <rect x="126" y="14" width="258" height="24" rx="12" fill="rgba(255,255,255,0.56)" />
              <rect x="144" y="22" width="74" height="8" rx="4" fill="rgba(15,17,21,0.1)" />
              <rect x="224" y="22" width="38" height="8" rx="4" fill="rgba(15,17,21,0.07)" />
              <rect x="270" y="20" width="42" height="12" rx="6" fill={palette.accentSoft} />
              <rect x="126" y="42" width="168" height="40" rx="16" fill="rgba(255,255,255,0.64)" />
              <rect x="140" y="54" width="84" height="8" rx="4" fill="rgba(15,17,21,0.09)" />
              <rect x="140" y="66" width="56" height="8" rx="4" fill="rgba(15,17,21,0.06)" />
              <rect x="320" y="42" width="64" height="40" rx="16" fill="rgba(255,255,255,0.52)" />
              <circle cx="352" cy="56" r="14" fill={palette.accentSoft} />
              <rect x="306" y="20" width="126" height="74" rx="18" fill="rgba(255,255,255,0.42)" />
              <rect x="320" y="52" width="82" height="8" rx="4" fill="rgba(15,17,21,0.08)" />
              <rect x="320" y="66" width="60" height="6" rx="3" fill="rgba(15,17,21,0.05)" />
              <rect x="126" y="84" width="304" height="6" rx="3" fill="rgba(15,17,21,0.035)" />
              <rect x="138" y="82" width="106" height="12" rx="6" fill={palette.accent} />
              <rect x="256" y="82" width="72" height="12" rx="6" fill="rgba(255,255,255,0.9)" />
              <rect x="340" y="82" width="58" height="12" rx="6" fill={palette.accent2} />
            </>
          ) : null}

          {kind === 'landing' ? (
            <>
              <path d="M-14 86L132 14h94L88 92H-14Z" fill="rgba(255,255,255,0.34)" />
              <path d="M126 14h170L196 88H68L126 14Z" fill="rgba(157,177,197,0.12)" />
              <rect x="26" y="18" width="108" height="9" rx="4.5" fill="rgba(255,255,255,0.82)" />
              <rect x="26" y="34" width="76" height="6" rx="3" fill={palette.line} />
              <rect x="26" y="44" width="92" height="6" rx="3" fill={palette.lineSoft} />
              <rect x="26" y="60" width="52" height="16" rx="8" fill={palette.accent} />
              <rect x="84" y="60" width="48" height="16" rx="8" fill="rgba(255,255,255,0.86)" />
              <circle cx="356" cy="36" r="28" fill="rgba(255,255,255,0.42)" />
              <circle cx="356" cy="36" r="16" fill={palette.accentSoft} />
              <path d="M348 36h16M356 28v16" stroke={palette.accent} strokeWidth="3" strokeLinecap="round" />
              <rect x="260" y="18" width="184" height="30" rx="15" fill="rgba(255,255,255,0.56)" />
              <rect x="274" y="29" width="76" height="8" rx="4" fill="rgba(255,255,255,0.84)" />
              <rect x="274" y="42" width="102" height="6" rx="3" fill={palette.line} />
              <rect x="252" y="56" width="192" height="18" rx="9" fill="rgba(255,255,255,0.34)" />
              <rect x="266" y="62" width="84" height="6" rx="3" fill={palette.line} />
              <rect x="358" y="62" width="70" height="6" rx="3" fill={palette.accentSoft} />
              <rect x="24" y="80" width="412" height="8" rx="4" fill={palette.lineSoft} />
            </>
          ) : null}

          {kind === 'profile' ? (
            <>
              <rect x="18" y="16" width="118" height="68" rx="18" fill="rgba(255,255,255,0.62)" />
              <circle cx="48" cy="42" r="20" fill="rgba(255,255,255,0.88)" />
              <circle cx="48" cy="36" r="8" fill="rgba(157,177,197,0.46)" />
              <rect x="28" y="64" width="40" height="8" rx="4" fill={palette.line} />
              <rect x="78" y="26" width="44" height="8" rx="4" fill="rgba(255,255,255,0.82)" />
              <rect x="78" y="38" width="32" height="6" rx="3" fill={palette.line} />
              <rect x="78" y="49" width="26" height="6" rx="3" fill={palette.lineSoft} />
              <rect x="146" y="16" width="92" height="68" rx="18" fill="rgba(255,255,255,0.58)" />
              <rect x="158" y="28" width="68" height="8" rx="4" fill="rgba(255,255,255,0.84)" />
              <rect x="158" y="40" width="54" height="6" rx="3" fill={palette.line} />
              <rect x="158" y="52" width="42" height="6" rx="3" fill={palette.lineSoft} />
              <rect x="246" y="16" width="92" height="68" rx="18" fill="rgba(255,255,255,0.4)" />
              <circle cx="292" cy="42" r="16" fill={palette.accentSoft} />
              <rect x="270" y="60" width="44" height="8" rx="4" fill={palette.line} />
              <rect x="350" y="16" width="115" height="68" rx="18" fill="rgba(255,255,255,0.58)" />
              <rect x="364" y="28" width="40" height="8" rx="4" fill="rgba(255,255,255,0.84)" />
              <rect x="364" y="40" width="34" height="6" rx="3" fill={palette.line} />
              <rect x="364" y="52" width="48" height="16" rx="8" fill={palette.accent} />
              <rect x="18" y="84" width="448" height="6" rx="3" fill={palette.lineSoft} />
              <rect x="30" y="82" width="82" height="12" rx="6" fill={palette.accent} />
              <rect x="124" y="82" width="74" height="12" rx="6" fill="rgba(255,255,255,0.88)" />
              <rect x="210" y="82" width="112" height="12" rx="6" fill={palette.accentSoft} />
            </>
          ) : null}
        </g>
      </svg>
    );
  }

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
                className={`sn-mobile-template-card ${template.title === '产品官网' ? 'is-active' : ''}`.trim()}
                onClick={() => {
                  onSelectTemplate(template.prompt);
                  onBackHome();
                }}
              >
                <div className="sn-mobile-template-thumb">
                  <TemplateThumbIllustration kind={template.art} />
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

function ProjectsWorkspace({
  projects,
  projectsLoading,
  onOpenProject,
  onRequestDelete,
  onUndoDelete,
  onBackHome,
  recentProjects,
  navigate,
  pendingDeleteProjectId,
  pendingDeletePhase,
}: {
  projects: ProjectView[];
  projectsLoading: boolean;
  onOpenProject: (projectId: string) => void;
  onRequestDelete: (project: ProjectView) => void;
  onUndoDelete: (projectId: string) => void;
  onBackHome: () => void;
  recentProjects: ProjectView[];
  navigate: (path: string) => void;
  pendingDeleteProjectId: string | null;
  pendingDeletePhase: DeferredDeleteState['phase'] | null;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allProjectsOpen, setAllProjectsOpen] = useState(true);
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);

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
                  <article
                    key={project.projectId}
                    className={`sn-mobile-project-card ${project.status === 'preview_ready' ? 'is-active' : ''} ${pendingDeleteProjectId === project.projectId ? 'is-pending-delete' : ''}`.trim()}
                    role={pendingDeleteProjectId === project.projectId ? undefined : 'button'}
                    tabIndex={pendingDeleteProjectId === project.projectId ? undefined : 0}
                    aria-disabled={pendingDeleteProjectId === project.projectId ? 'true' : undefined}
                    onClick={() => {
                      if (pendingDeleteProjectId === project.projectId) {
                        return;
                      }
                      onOpenProject(project.projectId);
                    }}
                    onKeyDown={(event) => {
                      if (pendingDeleteProjectId === project.projectId) {
                        return;
                      }
                      if (event.key !== 'Enter' && event.key !== ' ') {
                        return;
                      }
                      event.preventDefault();
                      onOpenProject(project.projectId);
                    }}
                  >
                    <div className="sn-mobile-project-thumb" />
                    <div className="sn-mobile-project-copy">
                      <div className="sn-mobile-project-head">
                        <div>
                          <div className="sn-mobile-project-name">{project.displayName}</div>
                          <div className="sn-mobile-project-desc">{project.title}</div>
                        </div>
                        <div className="sn-mobile-project-card-actions">
                          <StatusChip
                            tone={
                              (pendingDeleteProjectId === project.projectId
                                ? 'building'
                                : statusTone(project.status)) as 'preview-ready' | 'published' | 'building' | 'needs-fix'
                            }
                          >
                            {pendingDeleteProjectId === project.projectId
                              ? pendingDeletePhase === 'committing'
                                ? '删除中'
                                : '待删除'
                              : statusLabel(project.status)}
                          </StatusChip>
                          <button
                            className="sn-mobile-project-menu-button"
                            type="button"
                            aria-label={`更多操作：${project.displayName}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenMenuProjectId((current) => (current === project.projectId ? null : project.projectId));
                            }}
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </div>
                      </div>
                      <div className="sn-mobile-project-meta">
                        <span>{formatTime(project.updatedAt)}</span>
                      </div>
                    </div>
                    {openMenuProjectId === project.projectId ? (
                      <div className="sn-mobile-project-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                        {pendingDeleteProjectId === project.projectId ? (
                          <button
                            type="button"
                            className="sn-mobile-project-menu-item"
                            onClick={() => {
                              setOpenMenuProjectId(null);
                              onUndoDelete(project.projectId);
                            }}
                          >
                            撤销删除
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="sn-mobile-project-menu-item is-danger"
                            disabled={Boolean(pendingDeleteProjectId)}
                            onClick={() => {
                              setOpenMenuProjectId(null);
                              onRequestDelete(project);
                            }}
                          >
                            删除项目
                          </button>
                        )}
                      </div>
                    ) : null}
                  </article>
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

function MobilePublishConfirmSheet({
  open,
  project,
  canPublish,
  onCancel,
  onConfirm,
  onCopyLink,
}: {
  open: boolean;
  project: ProjectView;
  canPublish: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onCopyLink: () => void;
}) {
  const { shouldRender, isOpen } = useDrawerTransition(open);

  if (!shouldRender) {
    return null;
  }

  const targetHandle = project.pendingPublicHandle ?? project.publicHandle;
  const targetUrl = project.pendingPublicHandle ? replaceUrlHandle(project.publicUrl, targetHandle) : project.publicUrl;

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
          <button
            className="sn-mobile-confirm-address"
            type="button"
            onClick={onCopyLink}
            aria-label="复制目标线上地址"
          >
            <span>{targetUrl}</span>
            <Copy className="size-4" />
          </button>
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
  onCancel,
  onConfirm,
  onCopyLink,
}: {
  open: boolean;
  project: ProjectView;
  canPublish: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onCopyLink: () => void;
}) {
  return (
    <MobilePublishConfirmSheet
      open={open}
      project={project}
      canPublish={canPublish}
      onCancel={onCancel}
      onConfirm={onConfirm}
      onCopyLink={onCopyLink}
    />
  );
}

function ProjectShareSheet({
  open,
  project,
  onCancel,
  onShareTarget,
  onCopyLink,
}: {
  open: boolean;
  project: ProjectView;
  onCancel: () => void;
  onShareTarget: (target: 'friend' | 'moments') => void;
  onCopyLink: () => boolean | Promise<boolean>;
}) {
  const { shouldRender, isOpen } = useDrawerTransition(open);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={`sn-mobile-confirm-shell ${isOpen ? 'is-open' : ''}`.trim()} role="presentation">
      <button className="sn-mobile-drawer-backdrop" type="button" aria-label="关闭分享面板" onClick={onCancel} />
      <div className="sn-mobile-confirm-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sn-mobile-confirm-head">
          <div className="sn-mobile-confirm-head-left">
            <div className="sn-mobile-confirm-icon" aria-hidden="true">
              <Share2 className="size-4" />
            </div>
            <div className="sn-mobile-confirm-head-title">分享站点</div>
          </div>
          <button className="sn-reference-sheet-close sn-mobile-confirm-close" type="button" onClick={onCancel} aria-label="关闭分享面板">
            ×
          </button>
        </div>
        <div className="sn-mobile-confirm-body">
          <div className="sn-mobile-confirm-badge">微信分享</div>
          <div className="sn-mobile-confirm-title">{project.displayName}</div>
          <div className="sn-mobile-note">
            默认分享文案先沿用项目名和正式站点链接，后续接入微信 JS-SDK 后会在这里直接走好友和朋友圈分享。
          </div>
          <div className="sn-mobile-confirm-list">
            <div className="sn-mobile-confirm-list-item">
              <CheckCircle2 className="size-4" />
              <span>分享到微信朋友</span>
            </div>
            <div className="sn-mobile-confirm-list-item">
              <CheckCircle2 className="size-4" />
              <span>分享到朋友圈</span>
            </div>
            <div className="sn-mobile-confirm-list-item">
              <CheckCircle2 className="size-4" />
              <span>非微信浏览器可先复制链接再粘贴分享</span>
            </div>
          </div>
          <div className="sn-mobile-confirm-label">正式站点链接</div>
          <button
            className="sn-mobile-confirm-address"
            type="button"
            onClick={() => {
              void Promise.resolve(onCopyLink()).then((copied) => {
                if (copied !== false) {
                  onCancel();
                }
              });
            }}
            aria-label="复制正式站点链接"
          >
            <span>{project.publicUrl}</span>
            <Copy className="size-4" />
          </button>
          <div className="sn-mobile-note">
            当前先保留前端结构，后续接入微信签名后可以直接用原生分享能力。
          </div>
        </div>
        <div className="sn-mobile-confirm-footer">
          <div className="sn-mobile-confirm-actions">
            <button className="sn-mobile-confirm-button is-primary" type="button" onClick={() => onShareTarget('friend')}>
              分享给朋友
            </button>
            <button className="sn-mobile-confirm-button is-secondary" type="button" onClick={() => onShareTarget('moments')}>
              分享到朋友圈
            </button>
          </div>
          <div className="sn-mobile-confirm-footnote">微信外浏览器会优先走系统分享或复制链接兜底</div>
        </div>
      </div>
    </div>
  );
}

function ProjectRenameSheet({
  open,
  project,
  draft,
  validation,
  error,
  saving,
  onCancel,
  onDraftChange,
  onConfirm,
}: {
  open: boolean;
  project: ProjectView;
  draft: string;
  validation: string | null;
  error: string | null;
  saving: boolean;
  onCancel: () => void;
  onDraftChange: (value: string) => void;
  onConfirm: () => void;
}) {
  const { shouldRender, isOpen } = useDrawerTransition(open);

  if (!shouldRender) {
    return null;
  }

  const canConfirm = Boolean(draft.trim()) && !validation && !saving;

  return (
    <div className={`sn-mobile-confirm-shell ${isOpen ? 'is-open' : ''}`.trim()} role="presentation">
      <button className="sn-mobile-drawer-backdrop" type="button" aria-label="关闭重命名" onClick={onCancel} />
      <div className="sn-mobile-confirm-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sn-mobile-confirm-head">
          <div className="sn-mobile-confirm-head-left">
            <div className="sn-mobile-confirm-icon" aria-hidden="true">
              <Edit2 className="size-4" />
            </div>
            <div className="sn-mobile-confirm-head-title">编辑项目名称</div>
          </div>
          <button className="sn-reference-sheet-close sn-mobile-confirm-close" type="button" onClick={onCancel} aria-label="关闭重命名">
            ×
          </button>
        </div>
        <form
          id="sn-mobile-rename-form"
          className="sn-mobile-confirm-body"
          onSubmit={(event) => {
            event.preventDefault();
            if (canConfirm) {
              onConfirm();
            }
          }}
        >
          <div className="sn-mobile-confirm-label">项目名称</div>
          <div className="sn-mobile-confirm-address sn-mobile-rename-field">
            <input
              className="sn-mobile-rename-input"
              type="text"
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={project.displayName}
            />
          </div>
          <div className="sn-mobile-note">
            {error ?? validation ?? '新名称会在下次发布成功时生效'}
          </div>
          {project.pendingPublicHandle ? (
            <div className="sn-mobile-note">
              待生效地址：{project.pendingPublicHandle}
            </div>
          ) : null}
        </form>
        <div className="sn-mobile-confirm-footer">
          <div className="sn-mobile-confirm-actions">
            <button className="sn-mobile-confirm-button is-primary" type="submit" form="sn-mobile-rename-form" disabled={!canConfirm}>
              {saving ? '保存中…' : '保存'}
            </button>
            <button className="sn-mobile-confirm-button is-secondary" type="button" onClick={onCancel}>
              取消
            </button>
          </div>
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
  onOpenLive,
  onEditProjectName,
  onCopyPreviewUrl,
  onCopyPublicUrl,
  conversationEndRef,
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
  onOpenLive: () => void;
  onEditProjectName: () => void;
  onCopyPreviewUrl: () => void;
  onCopyPublicUrl: () => void;
  conversationEndRef: RefObject<HTMLDivElement | null>;
  sidebarOpen: boolean;
  statusOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  setStatusOpen: (value: boolean) => void;
  recentProjects: ProjectView[];
  navigate: (path: string) => void;
}) {
  const liveTimelineEventId = useMemo(
    () => findLiveTimelineEventId(timelineItems, latestTask),
    [latestTask, timelineItems]
  );

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
      liveTimelineEventId={liveTimelineEventId}
      onRebuild={onRebuild}
      onPublish={onPublish}
      onAutoFix={onAutoFix}
      latestTask={latestTask}
      onViewLogs={onViewLogs}
      conversationRef={conversationRef}
      onOpenStatus={onOpenStatus}
      onOpenPreview={onOpenPreview}
      onOpenLive={onOpenLive}
      onEditProjectName={onEditProjectName}
      onCopyPreviewUrl={onCopyPreviewUrl}
      onCopyPublicUrl={onCopyPublicUrl}
      conversationEndRef={conversationEndRef}
      sidebarOpen={sidebarOpen}
      statusOpen={statusOpen}
      setSidebarOpen={setSidebarOpen}
      setStatusOpen={setStatusOpen}
      recentProjects={recentProjects}
      navigate={navigate}
    />
  );
}

function ProjectWorkspaceLoadingScreen() {
  return (
    <MobilePageSurface className="sn-mobile-project-page">
      <div className="sn-mobile-project-content sn-mobile-chat-page">
        <div className="sn-mobile-project-header">
          <div className="sn-mobile-project-header-left">
            <Skeleton className="size-8 rounded-full" />
            <div className="grid gap-2">
              <Skeleton className="h-5 w-40 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
          </div>
          <div className="sn-mobile-project-header-right">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>

        <div className="sn-mobile-project-body">
          <div className="grid gap-3">
            <Skeleton className="h-20 w-full rounded-[24px]" />
            <Skeleton className="h-20 w-[88%] rounded-[24px]" />
            <Skeleton className="h-16 w-[74%] rounded-[24px]" />
            <Skeleton className="h-16 w-[62%] rounded-[24px]" />
          </div>

          <div className="grid gap-3">
            <Skeleton className="h-24 w-full rounded-[24px]" />
            <Skeleton className="h-20 w-[92%] rounded-[24px]" />
          </div>
        </div>
      </div>

      <div className="sn-mobile-project-composer-fixed">
        <div className="sn-mobile-project-composer-actions has-single-action">
          <Skeleton className="h-11 w-full rounded-[16px]" />
        </div>
        <div className="sn-mobile-home-composer-card is-bottom">
          <Skeleton className="h-10 w-full rounded-[18px]" />
          <div className="sn-mobile-home-composer-actions">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="size-10 rounded-full" />
          </div>
        </div>
      </div>
    </MobilePageSurface>
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
  liveTimelineEventId,
  onRebuild,
  onPublish,
  onAutoFix,
  latestTask,
  onViewLogs,
  conversationRef,
  onOpenStatus,
  onOpenPreview,
  onOpenLive,
  onEditProjectName,
  onCopyPreviewUrl,
  onCopyPublicUrl,
  conversationEndRef,
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
  liveTimelineEventId: string | null;
  onRebuild: () => void;
  onPublish: () => void;
  onAutoFix: () => void;
  latestTask: TaskView | null;
  onViewLogs: () => void;
  conversationRef: RefObject<HTMLDivElement | null>;
  onOpenStatus: () => void;
  onOpenPreview: () => void;
  onOpenLive: () => void;
  onEditProjectName: () => void;
  onCopyPreviewUrl: () => void;
  onCopyPublicUrl: () => void;
  conversationEndRef: RefObject<HTMLDivElement | null>;
  sidebarOpen: boolean;
  statusOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  setStatusOpen: (value: boolean) => void;
  recentProjects: ProjectView[];
  navigate: (path: string) => void;
}) {
  const MOBILE_HISTORY_COLLAPSE_COUNT = 8;
  const composerTextareaRef = useAutoSizingTextarea(composerPrompt);
  const [isHistoryCollapsed, setHistoryCollapsed] = useState(true);
  const canCollapseHistory = timelineItems.length > MOBILE_HISTORY_COLLAPSE_COUNT;
  const visibleTimelineItems = isHistoryCollapsed
    ? timelineItems.slice(-MOBILE_HISTORY_COLLAPSE_COUNT)
    : timelineItems;
  const latestVisibleTimelineItemId = visibleTimelineItems.length > 0 ? visibleTimelineItems[visibleTimelineItems.length - 1]!.id : null;
  const hiddenTimelineCount = Math.max(0, timelineItems.length - visibleTimelineItems.length);
  const canOpenPreview = hasEverBuiltPreviewProject(project) || Boolean(detail?.releases.some((release) => release.kind === 'preview'));
  const canOpenLive = hasEverPublishedProject(project);
  const visibleComposerActionCount = Number(canOpenPreview) + Number(canOpenLive) + Number(canPublish);
  const composerActionClassName =
    visibleComposerActionCount >= 3
      ? 'has-triple-actions'
      : visibleComposerActionCount === 2
        ? 'has-dual-actions'
        : 'has-single-action';

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
  }, [conversationRef, isHistoryCollapsed, latestVisibleTimelineItemId, pendingConversation?.id]);

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
                <button
                  className="sn-mobile-project-edit-button"
                  type="button"
                  aria-label="编辑项目名称"
                  onClick={onEditProjectName}
                  disabled={activeAction !== null}
                >
                  <Edit2 className="size-3" />
                </button>
              </div>
            </div>
          </div>
          <div className="sn-mobile-project-header-right">
            {project.pendingPublicHandle ? <StatusChip tone="building">发布后生效</StatusChip> : null}
            <StatusChip tone={statusTone(project.status) as 'preview-ready' | 'published' | 'building' | 'needs-fix'}>
              {statusLabel(project.status)}
            </StatusChip>
            <MobileIconButton className="is-soft" type="button" aria-label="项目详情" onClick={onOpenStatus}>
              <Info className="size-4" />
            </MobileIconButton>
          </div>
        </div>

        <div className="sn-mobile-project-body">
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
              visibleTimelineItems.map((item) => (
                <TimelineEntry key={item.id} item={item} liveTimelineEventId={liveTimelineEventId} />
              ))
            )}
          </div>

          <PendingConversationBubble pendingConversation={pendingConversation} />
          <div ref={conversationEndRef} className="sn-conversation-end-anchor" aria-hidden="true" />
        </div>
      </div>

      <div className="sn-mobile-project-composer-fixed">
        <div className={`sn-mobile-project-composer-actions ${composerActionClassName}`.trim()}>
          {canOpenPreview ? (
            <MobileActionButton variant="secondary" className="sn-mobile-project-preview-button" onClick={onOpenPreview}>
              <Eye className="size-4" /> 预览站点
            </MobileActionButton>
          ) : null}
          {canOpenLive ? (
            <MobileActionButton variant="secondary" className="sn-mobile-project-live-button" onClick={onOpenLive}>
              <ArrowUpRight className="size-4" /> 正式站点
            </MobileActionButton>
          ) : null}
          {canPublish ? (
            <MobileActionButton variant="primary" className="sn-mobile-project-publish-button" onClick={onPublish}>
              <Upload className="size-4" /> 发布
            </MobileActionButton>
          ) : null}
        </div>
        <div className="sn-mobile-home-composer-card is-bottom">
          <textarea
            ref={composerTextareaRef}
            className="sn-mobile-home-composer-input"
            rows={1}
            placeholder="你想做什么？"
            value={composerPrompt}
            onChange={(event) => setComposerPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
                return;
              }
              event.preventDefault();
              void onSubmit();
            }}
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
        onCopyPreviewUrl={onCopyPreviewUrl}
        onCopyPublicUrl={onCopyPublicUrl}
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
            <span>我的项目</span>
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
            <span>我的项目</span>
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
  onCopyPreviewUrl,
  onCopyPublicUrl,
}: {
  project: ProjectView;
  detail: ProjectDetailResponse | null;
  latestTask?: TaskView | null;
  showTaskInfo?: boolean;
  onViewLogs?: () => void;
  onCopyPreviewUrl: () => void;
  onCopyPublicUrl: () => void;
}) {
  const [releaseHistoryOpen, setReleaseHistoryOpen] = useState(true);
  const releases = detail?.releases ?? [];

  return (
    <>
      <div className="sn-reference-status-block">
        <div className="sn-reference-project-head">
          <div className="sn-reference-label">当前状态</div>
          <StatusChip tone={statusTone(project.status) as 'preview-ready' | 'published' | 'building' | 'needs-fix'}>
            {statusLabel(project.status)}
          </StatusChip>
        </div>
        <div className="sn-reference-note">{statusDescription(project.status)}</div>
      </div>

      <div className="sn-reference-status-block">
        <div className="sn-reference-label">预览地址</div>
        <button
          type="button"
          className="sn-reference-address"
          onClick={onCopyPreviewUrl}
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
            onClick={onCopyPublicUrl}
            aria-label="复制线上地址"
          >
            <span className="sn-reference-address-text">{project.publicUrl}</span>
            <Copy className="size-4" />
          </button>
        ) : (
          <div className="sn-reference-note">尚未发布到正式版本</div>
        )}
      </div>

      {project.pendingPublicHandle ? (
        <div className="sn-reference-status-block">
          <div className="sn-reference-label">待生效公开地址</div>
          <div className="sn-reference-note">
            {project.pendingPublicHandle} 将在下次发布后成为正式公开地址。
          </div>
        </div>
      ) : null}

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
  onCopyPreviewUrl,
  onCopyPublicUrl,
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
  onCopyPreviewUrl: () => void;
  onCopyPublicUrl: () => void;
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
        <ProjectStatusContent
          project={project}
          detail={detail}
          onViewLogs={onViewLogs}
          onCopyPreviewUrl={onCopyPreviewUrl}
          onCopyPublicUrl={onCopyPublicUrl}
        />

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

function TimelineEntry({
  item,
  liveTimelineEventId,
}: {
  item: ConversationTimelineItem;
  liveTimelineEventId: string | null;
}): ReactElement {
  if (item.kind === 'message') {
    const bubbleRole = item.role === 'user' ? 'user' : 'assistant';
    return <ChatBubble role={bubbleRole} className={item.id.startsWith('local-') ? 'is-entering' : undefined}>{item.content}</ChatBubble>;
  }

  return <TimelineSystemBubble item={item} liveTimelineEventId={liveTimelineEventId} />;
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
    <ChatBubble role="system" className="is-pending thinking">
      <div className="sn-pending-inline-copy" role="status" aria-live="polite">
        <span className="sn-pending-inline-label">思考中</span>
        <span className="sn-pending-inline-time">· {elapsed}</span>
        <span className="sn-pending-inline-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
    </ChatBubble>
  );
}

function TimelineSystemBubble({
  item,
  liveTimelineEventId,
}: {
  item: Extract<ConversationTimelineItem, { kind: 'event' }>;
  liveTimelineEventId: string | null;
}): ReactElement {
  const isLiveTask = item.id === liveTimelineEventId;
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
            <div className="sn-system-event-title">{item.title}</div>
            {liveElapsed ? (
              <div className="sn-system-event-live">
                <span className="sn-system-event-live-dot" aria-hidden="true" />
                <span>处理中 · {liveElapsed}</span>
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
      </div>
    </ChatBubble>
  );
}

function findLiveTimelineEventId(
  timelineItems: ConversationTimelineItem[],
  latestTask: TaskView | null
): string | null {
  if (!latestTask || !['pending', 'running'].includes(latestTask.status)) {
    return null;
  }

  const liveTypes = new Set(['task_started', 'task_progress']);
  for (let index = timelineItems.length - 1; index >= 0; index -= 1) {
    const item = timelineItems[index];
    if (item.kind !== 'event') {
      continue;
    }
    if (item.taskId !== latestTask.id) {
      continue;
    }
    if (!liveTypes.has(item.type)) {
      continue;
    }
    return item.id;
  }

  return null;
}

export default App;
