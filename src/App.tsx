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
  applyChange,
  createProject,
  deleteProject,
  getApiBase,
  getProject,
  publishProject,
  rebuildProject,
  renameProject,
  listProjects,
} from './api';
import type {
  ProjectDetailResponse,
  ProjectView,
  TaskView,
} from './types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChatBubble,
  Composer,
  ConfirmationSheet as SnConfirmationSheet,
  DrawerMock,
  EmptyState,
  MobilePreviewPage,
  MobilePublishResultPage,
  MobilePageSurface,
  MobileCompactHeader,
  MobileIconButton,
  MobileStatusPill,
  MobileActionButton,
  ProjectCard,
  QuickActionChip,
  SnActionButton,
  ShipNowDesignSystemPage,
  ShipNowVisualReferencePage,
  SnButton,
  StatusChip,
  TopBar,
} from './shipnow-enhanced';

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

type TimelineItem =
  | {
      kind: 'message';
      id: string;
      createdAt: string;
      role: 'user' | 'assistant' | 'system' | 'tool';
      content: string;
    }
  | {
      kind: 'event';
      id: string;
      createdAt: string;
      title: string;
      detail: string | null;
      type: string;
      data: Record<string, unknown> | null;
    };

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

function useDrawerTransition(open: boolean, durationMs = 240): { shouldRender: boolean; isOpen: boolean } {
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

function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'generating':
      return '正在修改';
    case 'build_failed':
      return '修改失败';
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

function buildConversationItems(detail: ProjectDetailResponse | null): TimelineItem[] {
  if (!detail) {
    return [];
  }
  const items: TimelineItem[] = [
    ...detail.messages.map((message) => ({
      kind: 'message' as const,
      id: message.id,
      createdAt: message.createdAt,
      role: message.role,
      content: message.content,
    })),
    ...detail.events.map((event) => ({
      kind: 'event' as const,
      id: event.id,
      createdAt: event.createdAt,
      title: event.title || eventTitle(event.type),
      detail: event.detail,
      type: event.type,
      data: event.data,
    })),
  ];
  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function App() {
  const { route, navigate } = useWorkspaceRoute();
  const isEnhancedRoute = route.kind === 'design-system' || route.kind === 'visual-reference';
  const isMobileLayout = useMediaQuery('(max-width: 767px)');
  const previewConfirmDebug = new URLSearchParams(window.location.search).get('confirmPublish') === '1';
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
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const routeProjectId =
    route.kind === 'project' || route.kind === 'project-preview' || route.kind === 'publish-success' || route.kind === 'publish-failure'
      ? route.projectId
      : null;
  const currentProject = useMemo(
    () => (routeProjectId ? detail?.project ?? projects.find((project) => project.projectId === routeProjectId) ?? null : null),
    [detail, projects, routeProjectId]
  );

  const timelineItems = useMemo(() => buildConversationItems(detail), [detail]);

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
    if (isEnhancedRoute) {
      return;
    }
    if (window.matchMedia('(max-width: 767px)').matches) {
      return;
    }
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [isEnhancedRoute, timelineItems.length, route.kind, routeProjectId]);

  const createFromComposer = route.kind === 'home';
  const canSubmitComposer = composerPrompt.trim().length > 0 && activeAction === null;
  const canPublish = Boolean(currentProject && ['preview_ready', 'published', 'publish_failed'].includes(currentProject.status));
  const canAutoFix = Boolean(currentProject && detail && ['build_failed', 'publish_failed', 'failed'].includes(currentProject.status));
  const renameNormalized = slugifyHandle(renameDraft);
  const renameValidation = renameDraft.trim().length > 0 ? validateHandle(renameNormalized) : '名称不能为空。';
  const renameDirty = Boolean(currentProject && renameNormalized !== currentProject.publicHandle);

  async function handleComposerSubmit(): Promise<void> {
    const prompt = composerPrompt.trim();
    if (!prompt) {
      setError('请输入一句话描述。');
      return;
    }

    if (createFromComposer) {
      setActiveAction('create');
      try {
        const result = await createProject({ prompt });
        await refreshProjects();
        navigate(`/project/${result.project.projectId}`);
        setComposerPrompt('');
        setSidebarOpen(false);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : String(createError));
      } finally {
        setActiveAction(null);
      }
      return;
    }

    if (!currentProject) {
      return;
    }

    setActiveAction('change');
    try {
      const result = await applyChange(currentProject.projectId, prompt);
      await refreshProjects();
      await refreshDetail(result.project.projectId);
      setComposerPrompt('');
      setError(null);
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : String(changeError));
    } finally {
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
        recentProjects={homeRecentProjects}
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
        onRebuild={handleRebuild}
        onPublish={() => setPublishConfirmOpen(true)}
        onAutoFix={handleAutoFix}
        latestTask={latestTask}
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
            <WorkspaceDrawer
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
                navigate('/settings');
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
              latestTask={latestTask}
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
  recentProjects,
  navigate,
}: {
  onOpenMenu: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  projectsLoading: boolean;
  recentProjects: ProjectView[];
  navigate: (path: string) => void;
}) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (isMobile) {
    return (
      <MobilePageSurface className="sn-mobile-settings-page">
        <div className="sn-mobile-page-body sn-mobile-settings-body">
          <div className="sn-mobile-home-brand-row">
            <MobileIconButton type="button" aria-label="菜单" onClick={onOpenMenu}>
              <Menu className="size-4" />
            </MobileIconButton>
            <div className="sn-mobile-brand">设置与偏好</div>
          </div>
          <div className="sn-mobile-settings-spacer" />
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
        <EmptyState title="设置与偏好" description="这里暂时留空。" icon={<Settings2 className="size-6" />} />
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
    {
      title: '空白项目',
      desc: '从空白开始，自由发挥',
      prompt: TEMPLATE_PROMPTS[5],
      icon: '+',
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
          <MobileActionButton variant="secondary" className="sn-mobile-import-btn">
            <Upload className="size-4" /> 导入现有项目
          </MobileActionButton>
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

  if (isMobile) {
    return (
      <MobilePageSurface className="sn-mobile-projects-page">
        <div className="sn-mobile-page-body">
          <MobileCompactHeader
            onMenu={() => setSidebarOpen(true)}
            title="我的项目"
          />
          <div className="sn-mobile-project-filter">
            全部项目 <ChevronDown className="size-4" />
          </div>

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

            <div className="sn-visual-preview-canvas">
              <div className="sn-visual-preview-top">
                <span>v1 · Home</span>
                <div className="sn-visual-preview-icons">
                  <span>◌</span>
                  <span>◌</span>
                </div>
              </div>
              <div className="sn-visual-preview-content">
                <div className="sn-visual-preview-brand">ShipNow</div>
                <h3>
                  Ship faster.
                  <br />
                  Ship now.
                </h3>
                <p>{project.title || 'ShipNow 帮助你以对话的方式创建和部署静态网站。输入想法，快速上线。'}</p>
                <div className="sn-visual-preview-actions">
                  <SnButton variant="primary">Get started</SnButton>
                  <SnButton variant="secondary">Learn more</SnButton>
                </div>
                <div className="sn-visual-preview-features">
                  <span className="sn-visual-preview-feature">Hero 区域</span>
                  <span className="sn-visual-preview-feature">核心优势</span>
                  <span className="sn-visual-preview-feature">操作指引</span>
                </div>
              </div>
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
  project,
  canPublish,
  onCancel,
  onConfirm,
}: {
  project: ProjectView;
  canPublish: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="sn-mobile-confirm-overlay">
      <div className="sn-mobile-confirm-sheet">
        <div className="sn-mobile-confirm-handle" />
        <div className="sn-mobile-confirm-badge">确认发布</div>
        <div className="sn-mobile-confirm-title">确认要把当前版本发布到正式站点吗？</div>
        <div className="sn-mobile-confirm-address">
          <span>{project.publicUrl}</span>
          <Copy className="size-4" />
        </div>
        <div className="sn-mobile-confirm-list">
          <div>将覆盖当前版本：{project.displayName}</div>
          <div>构建并发布到线上环境</div>
          <div>发布后立即可通过该地址访问</div>
        </div>
        <div className="sn-mobile-confirm-actions">
          <button className="sn-mobile-confirm-button is-primary" type="button" onClick={onConfirm} disabled={!canPublish}>
            确认发布
          </button>
          <button className="sn-mobile-confirm-button is-secondary" type="button" onClick={onCancel}>
            取消
          </button>
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
  if (!open) {
    return null;
  }

  if (isMobileLayout) {
    return (
      <MobilePublishConfirmSheet
        project={project}
        canPublish={canPublish}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
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
  onRebuild,
  onPublish,
  onAutoFix,
  latestTask,
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
  timelineItems: TimelineItem[];
  composerPrompt: string;
  setComposerPrompt: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  canPublish: boolean;
  canAutoFix: boolean;
  activeAction: string | null;
  onRebuild: () => void;
  onPublish: () => void;
  onAutoFix: () => void;
  latestTask: TaskView | null;
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
  const visibleTimelineItems = timelineItems.filter((item) => item.kind === 'message');
  const renderedTimelineItems = isMobileLayout ? visibleTimelineItems.slice(-2) : visibleTimelineItems;

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
        onRebuild={onRebuild}
        onPublish={onPublish}
        onAutoFix={onAutoFix}
        latestTask={latestTask}
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
                  renderedTimelineItems.map((item) => (
                    <div key={item.id}>
                      {item.role === 'user' ? (
                        <ChatBubble role="user">{item.content}</ChatBubble>
                      ) : (
                        <ChatBubble role="assistant">{item.content}</ChatBubble>
                      )}
                    </div>
                  ))
                )
              ) : (
                <div className="sn-project-workspace-empty">正在加载项目…</div>
              )}
            </div>

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

          <section className="sn-panel sn-project-workspace-status">
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

            <div className="sn-project-workspace-list">
              <div className="sn-project-workspace-card is-active">
                <div className="sn-project-workspace-thumb is-mini" />
                <div className="sn-project-workspace-copy">
                  <div className="sn-project-workspace-head">
                    <div>
                      <div className="sn-project-workspace-name">{project.displayName}</div>
                      <div className="sn-project-workspace-desc">{project.publicHandle}</div>
                    </div>
                    <StatusChip tone={statusTone(project.status) as 'preview-ready' | 'published' | 'building' | 'needs-fix'}>
                      {statusLabel(project.status)}
                    </StatusChip>
                  </div>
                  <div className="sn-project-workspace-meta">
                    <span>{project.title}</span>
                    <span>{project.type}</span>
                  </div>
                </div>
              </div>

              <div className="sn-project-workspace-row">
                <div>
                  <div className="sn-project-workspace-label">预览地址</div>
                  <div className="sn-project-workspace-address">
                    <span>{project.previewUrl}</span>
                    <Copy className="size-4" />
                  </div>
                </div>
              </div>

              <div className="sn-project-workspace-row">
                <div>
                  <div className="sn-project-workspace-label">上线地址</div>
                  <div className="sn-project-workspace-address">
                    <span>{project.publicUrl}</span>
                    <Copy className="size-4" />
                  </div>
                </div>
              </div>

              <div className="sn-project-workspace-block">
                <div className="sn-project-workspace-label">最近任务</div>
                {latestTask ? (
                  <div className="sn-project-workspace-task">
                    <span>{taskTypeLabel(latestTask.type)}</span>
                    <StatusChip tone={latestTask.status === 'failed' ? 'needs-fix' : latestTask.status === 'success' ? 'published' : 'building'}>
                      {taskStatusLabel(latestTask.status)}
                    </StatusChip>
                  </div>
                ) : (
                  <div className="sn-project-workspace-empty">还没有最近任务。</div>
                )}
              </div>

              <div className="sn-project-workspace-block">
                <div className="sn-project-workspace-label">最近发布</div>
                <div className="sn-project-workspace-history">
                  {(detail?.releases ?? []).slice(0, 3).map((release) => (
                    <div key={release.id} className="sn-project-workspace-history-item">
                      <span>{release.kind === 'preview' ? '预览版本' : '正式版本'}</span>
                      <small>{formatTime(release.createdAt)}</small>
                    </div>
                  ))}
                  {(detail?.releases ?? []).length === 0 ? <div className="sn-project-workspace-empty">还没有发布记录。</div> : null}
                </div>
              </div>

              <div className="sn-project-workspace-block status-logs">
                <div className="sn-project-workspace-label">技术日志入口</div>
                <div className="sn-project-workspace-empty">{latestTask ? `日志路径：${latestTask.logPath}` : '当前没有可用的任务日志。'}</div>
              </div>
            </div>
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
  onRebuild,
  onPublish,
  onAutoFix,
  latestTask,
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
  timelineItems: TimelineItem[];
  composerPrompt: string;
  setComposerPrompt: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  canPublish: boolean;
  canAutoFix: boolean;
  activeAction: string | null;
  onRebuild: () => void;
  onPublish: () => void;
  onAutoFix: () => void;
  latestTask: TaskView | null;
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
  const visibleTimelineItems = timelineItems.filter(
    (item): item is Extract<TimelineItem, { kind: 'message' }> => item.kind === 'message' && (item.role === 'user' || item.role === 'assistant')
  );

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

        <div className="sn-mobile-chat-stack">
          {visibleTimelineItems.length === 0 ? (
            <div className="sn-mobile-chat-empty">刚打开这个项目。先说一句你要改什么。</div>
          ) : (
            visibleTimelineItems.map((message) => (
              <ChatBubble key={message.id} role={message.role}>
                {message.content}
              </ChatBubble>
            ))
          )}
        </div>

      </div>

      <div className="sn-mobile-project-composer-fixed">
        <div className="sn-mobile-project-composer-actions">
          <MobileActionButton variant="secondary" onClick={onOpenPreview}>
            <Eye className="size-4" /> Preview
          </MobileActionButton>
          <MobileActionButton variant="primary" onClick={onPublish} disabled={!canPublish || activeAction !== null}>
            <Upload className="size-4" /> Publish
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
        latestTask={latestTask}
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
          <div className="sn-mobile-mini-brand">
            <Zap className="size-4" />
            <span>ShipNow</span>
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
        <div className="sn-mobile-drawer-group">
          <div className="sn-mobile-drawer-item is-static">
            <span>最近项目</span>
            <span className="text-xs text-[rgb(var(--muted))]">{projectsLoading ? '加载中' : `${recentProjects.length} 个`}</span>
          </div>
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
                  <StatusChip tone={statusTone(project.status) as 'preview-ready' | 'published' | 'building' | 'needs-fix'}>
                    {statusLabel(project.status)}
                  </StatusChip>
                </div>
                <ChevronRight className="size-4" />
              </button>
            ))
          )}
        </div>
        <div className="sn-mobile-drawer-user">
          <div className="sn-chat-avatar">艾</div>
          <div>
            <div className="sn-mobile-drawer-user-name">艾米</div>
            <div className="sn-mobile-drawer-user-mail">hello@shipnow.com</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceStatusDrawer({
  open,
  project,
  detail,
  latestTask,
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
  latestTask: TaskView | null;
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

  const releases = detail?.releases ?? [];

  return (
    <div className={`sn-mobile-status-shell ${isOpen ? 'is-open' : ''}`.trim()} role="presentation">
      <button className="sn-mobile-drawer-backdrop" type="button" aria-label="关闭抽屉" onClick={onClose} />
      <div ref={sheetRef} className="sn-mobile-status-sheet sn-reference-sheet" onClick={(event) => event.stopPropagation()}>
        <button className="sn-reference-sheet-close" type="button" onClick={onClose} aria-label="关闭状态抽屉">
          ×
        </button>
        <div className="sn-reference-sheet-title">项目状态</div>

        <div className="sn-reference-status-block">
          <div className="sn-reference-project-head">
            <div className="sn-reference-project-name">{project.displayName}</div>
            <StatusChip tone={statusTone(project.status) as 'preview-ready' | 'published' | 'building' | 'needs-fix'}>
              {statusLabel(project.status)}
            </StatusChip>
          </div>
          <div className="sn-reference-note">{project.publicHandle}</div>
        </div>

        <div className="sn-reference-status-block">
          <div className="sn-reference-label">预览地址</div>
          <div className="sn-reference-address">
            <span>{project.previewUrl}</span>
            <Copy className="size-4" />
          </div>
        </div>

        <div className="sn-reference-status-block">
          <div className="sn-reference-label">线上地址</div>
          {project.status === 'published' ? (
            <div className="sn-reference-address">
              <span>{project.publicUrl}</span>
              <Copy className="size-4" />
            </div>
          ) : (
            <div className="sn-reference-note">尚未发布到正式版本</div>
          )}
        </div>

        <div className="sn-reference-status-block">
          <div className="sn-reference-block-head">
            <div className="sn-reference-label">最近任务</div>
            <button
              className="sn-reference-collapse-btn"
              type="button"
              onClick={() => setRecentTasksOpen((value) => !value)}
              aria-expanded={recentTasksOpen}
              aria-label={recentTasksOpen ? '收起最近任务' : '展开最近任务'}
            >
              <ChevronDown className={`size-4 ${recentTasksOpen ? 'is-rotated' : ''}`} />
            </button>
          </div>
          {recentTasksOpen ? (
            detail?.tasks?.length ? (
              <div className="sn-reference-task-list">
                {detail.tasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="sn-reference-task-item">
                    <span>{taskTypeLabel(task.type)}</span>
                    <StatusChip tone={task.status === 'failed' ? 'needs-fix' : task.status === 'success' ? 'published' : 'building'}>
                      {taskStatusLabel(task.status)}
                    </StatusChip>
                    <time>{formatTime(task.startedAt ?? task.createdAt)}</time>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sn-reference-drawer-empty">还没有最近任务。</div>
            )
          ) : null}
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
                {releases.slice(0, 3).map((release) => (
                  <div key={release.id} className="sn-reference-history-item">
                    <span>{release.kind === 'preview' ? '预览版本' : '正式版本'}</span>
                    <small>{formatTime(release.createdAt)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sn-reference-drawer-empty">还没有发布记录。</div>
            )
          ) : null}
        </div>

        <div className="sn-reference-status-actions">
          <MobileActionButton variant="secondary" onClick={onClose}>
            收起
          </MobileActionButton>
        </div>
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

export default App;
