import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  applyChange,
  createProject,
  deleteProject,
  getProject,
  getTaskLogs,
  getApiBase,
  listProjects,
  publishProject,
  rebuildProject,
} from './api';
import type { ProjectDetailResponse, ProjectType, ProjectView, TaskView } from './types';

type DetailTab = 'overview' | 'tasks' | 'releases' | 'logs';

const projectTypeOptions: Array<{ value: ProjectType; label: string; hint: string }> = [
  { value: 'landing', label: 'Landing', hint: '营销页 / 着陆页' },
  { value: 'tool', label: 'Tool', hint: '工具页 / 小应用' },
  { value: 'showcase', label: 'Showcase', hint: '作品集 / 展示页' },
  { value: 'game', label: 'Game', hint: '小游戏 / Phaser' },
];

const reservedProjectNames = new Set([
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

function validateProjectName(name: string): string | null {
  const normalized = name.trim();
  if (normalized.length < 3) {
    return 'Project name must be at least 3 characters long.';
  }
  if (normalized.length > 48) {
    return 'Project name must be at most 48 characters long.';
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    return 'Project name must use lowercase letters, numbers, and hyphens.';
  }
  if (reservedProjectNames.has(normalized)) {
    return 'That project name is reserved.';
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

function statusTone(status: string): string {
  switch (status) {
    case 'published':
    case 'preview_ready':
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'generating':
    case 'running':
    case 'publishing':
    case 'pending':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'build_failed':
    case 'publish_failed':
    case 'failed':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'deleted':
      return 'border-slate-200 bg-slate-100 text-slate-500';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

function taskBadge(task: TaskView): string {
  return statusTone(task.status);
}

function readWorkspaceHint(): string {
  return import.meta.env.VITE_SHIPNOW_WORKSPACE_ROOT || './workspace';
}

function App() {
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [taskLogs, setTaskLogs] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [createForm, setCreateForm] = useState({
    name: '',
    title: '',
    prompt: '',
    type: 'landing' as ProjectType,
  });
  const [changePrompt, setChangePrompt] = useState('');

  const currentProject = useMemo(
    () => detail?.project ?? projects.find((project) => project.name === selectedProject) ?? null,
    [detail, projects, selectedProject]
  );

  async function refreshProjects(nextSelected?: string | null): Promise<void> {
    try {
      const response = await listProjects();
      setProjects(response.projects);
      const next = nextSelected !== undefined ? nextSelected : selectedProject ?? response.projects[0]?.name ?? null;
      setSelectedProject(next);
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setLoading(false);
    }
  }

  async function refreshDetail(projectName: string): Promise<void> {
    try {
      const response = await getProject(projectName);
      setDetail(response);
      const latestTask = response.tasks[0];
      if (latestTask) {
        try {
          setTaskLogs(await getTaskLogs(latestTask.id));
        } catch {
          setTaskLogs('');
        }
      } else {
        setTaskLogs('');
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
      setDetail(null);
      setTaskLogs('');
    }
  }

  useEffect(() => {
    void refreshProjects();
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setDetail(null);
      setTaskLogs('');
      return;
    }
    void refreshDetail(selectedProject);
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshProjects(selectedProject);
      void refreshDetail(selectedProject);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [selectedProject]);

  async function handleCreateProject(): Promise<void> {
    const nameError = validateProjectName(createForm.name);
    const title = createForm.title.trim();
    const prompt = createForm.prompt.trim();
    if (nameError || !title || !prompt) {
      setCreateError(nameError ?? 'Project title and prompt are required.');
      return;
    }

    setActionBusy('create');
    setCreateError(null);
    try {
      const response = await createProject({
        ...createForm,
        name: createForm.name.trim(),
        title,
        prompt,
      });
      setCreateOpen(false);
      setCreateError(null);
      setCreateForm({ name: '', title: '', prompt: '', type: 'landing' });
      await refreshProjects(response.project.name);
      await refreshDetail(response.project.name);
      setDetailTab('overview');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setActionBusy(null);
    }
  }

  async function handleProjectAction(action: 'rebuild' | 'publish' | 'change'): Promise<void> {
    if (!currentProject) {
      return;
    }
    setActionBusy(action);
    try {
      let result;
      if (action === 'rebuild') {
        result = await rebuildProject(currentProject.name);
      } else if (action === 'publish') {
        result = await publishProject(currentProject.name);
      } else {
        if (!changePrompt.trim()) {
          throw new Error('Enter a change request first.');
        }
        result = await applyChange(currentProject.name, changePrompt.trim());
        setChangePrompt('');
      }
      await refreshProjects(result.project.name);
      await refreshDetail(result.project.name);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDeleteProject(): Promise<void> {
    if (!currentProject) {
      return;
    }
    if (deleteConfirmName.trim() !== currentProject.name) {
      setError('Type the project name to confirm deletion.');
      return;
    }
    setActionBusy('delete');
    try {
      await deleteProject(currentProject.name);
      setDeleteOpen(false);
      setDeleteConfirmName('');
      await refreshProjects(null);
      setDetailTab('overview');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setActionBusy(null);
    }
  }

  const activeTasks = projects.filter((project) =>
    ['generating', 'publishing'].includes(project.status)
  ).length;
  const publishedProjects = projects.filter((project) => project.status === 'published').length;
  const failedProjects = projects.filter((project) =>
    ['build_failed', 'publish_failed'].includes(project.status)
  ).length;

  const currentTask = detail?.tasks[0] ?? null;
  const createNameError = validateProjectName(createForm.name);
  const createCanSubmit = !createNameError && createForm.title.trim().length > 0 && createForm.prompt.trim().length > 0;
  const deleteNameMatches = currentProject !== null && deleteConfirmName.trim() === currentProject.name;

  return (
    <div className="min-h-screen px-4 py-6 text-[rgb(var(--ink))] md:px-6 xl:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
        <header className="shell-panel flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--ink))] text-base font-bold text-white shadow-lg shadow-black/10">
              SN
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">ShipNow</h1>
                <span className="chip border-[rgba(21,128,110,0.22)] bg-[rgb(var(--teal-soft))] text-[rgb(var(--teal))]">
                  Local-first workbench
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-[rgb(var(--muted))]">
                Build, preview, modify, and publish small static sites from a single host-native workflow.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-[rgb(var(--line))] bg-white text-[rgb(var(--muted))]">
              Workspace: {readWorkspaceHint()}
            </span>
            <span className="chip border-[rgba(21,128,110,0.22)] bg-[rgb(var(--teal-soft))] text-[rgb(var(--teal))]">
              API: {getApiBase()}
            </span>
            <button
              className="primary-button"
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
            >
              New Project
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Projects" value={projects.length.toString()} hint="Total managed projects" />
          <StatCard label="Active" value={activeTasks.toString()} hint="Generating or publishing now" />
          <StatCard label="Published" value={publishedProjects.toString()} hint="Live public releases" />
          <StatCard label="Failed" value={failedProjects.toString()} hint="Build or publish failures" />
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <main className="shell-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-[rgb(var(--line))] px-5 py-4">
              <div>
                <p className="label">Projects</p>
                <h2 className="mt-1 text-lg font-semibold">Managed Sites</h2>
              </div>
              <button className="soft-button" onClick={() => void refreshProjects()}>
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-[rgb(var(--muted))]">Loading projects...</div>
            ) : error ? (
              <div className="p-6 text-sm text-rose-700">{error}</div>
            ) : projects.length === 0 ? (
              <div className="p-6">
                <EmptyState onCreate={() => setCreateOpen(true)} />
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-[rgba(255,252,248,0.96)] text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Name</th>
                      <th className="px-5 py-3 font-semibold">Type</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Preview</th>
                      <th className="px-5 py-3 font-semibold">Public</th>
                      <th className="px-5 py-3 font-semibold">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr
                        key={project.name}
                        className={`cursor-pointer border-t border-[rgb(var(--line))] transition hover:bg-[rgba(21,128,110,0.04)] ${
                          selectedProject === project.name ? 'bg-[rgba(21,128,110,0.06)]' : ''
                        }`}
                        onClick={() => {
                          setSelectedProject(project.name);
                          setDetailTab('overview');
                        }}
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium">{project.name}</div>
                          <div className="mt-1 text-xs text-[rgb(var(--muted))]">{project.title}</div>
                        </td>
                        <td className="px-5 py-4 text-sm text-[rgb(var(--muted))]">{project.type}</td>
                        <td className="px-5 py-4">
                          <span className={`chip ${statusTone(project.status)}`}>{statusLabel(project.status)}</span>
                        </td>
                        <td className="px-5 py-4">
                          <a
                            href={project.previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-[rgb(var(--teal))] hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Open preview
                          </a>
                        </td>
                        <td className="px-5 py-4">
                          <a
                            href={project.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-[rgb(var(--ink))] hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Open public
                          </a>
                        </td>
                        <td className="px-5 py-4 text-sm text-[rgb(var(--muted))]">
                          {formatTime(project.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>

          <aside className="shell-panel flex min-h-[640px] flex-col overflow-hidden">
            <div className="border-b border-[rgb(var(--line))] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="label">Selected project</p>
                  <h2 className="mt-1 text-lg font-semibold">{currentProject?.name ?? 'No project selected'}</h2>
                  <p className="mt-1 text-sm text-[rgb(var(--muted))]">{currentProject?.title ?? 'Create a project to begin.'}</p>
                </div>
                {currentProject ? (
                  <span className={`chip ${statusTone(currentProject.status)}`}>{statusLabel(currentProject.status)}</span>
                ) : null}
              </div>

              {currentProject ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button className="soft-button" onClick={() => void handleProjectAction('rebuild')} disabled={actionBusy !== null}>
                    Rebuild
                  </button>
                  <button className="soft-button" onClick={() => void handleProjectAction('publish')} disabled={actionBusy !== null}>
                    Publish
                  </button>
                  <button
                    className="soft-button"
                    onClick={() => {
                      setCreateError(null);
                      setCreateOpen(true);
                    }}
                    disabled={actionBusy !== null}
                  >
                    New
                  </button>
                  <button
                    className="soft-button text-rose-700 hover:border-rose-300 hover:text-rose-700"
                    onClick={() => {
                      setDeleteConfirmName('');
                      setDeleteOpen(true);
                    }}
                    disabled={actionBusy !== null}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>

            {currentProject ? (
              <>
                <div className="flex gap-2 border-b border-[rgb(var(--line))] px-5 py-3 text-sm">
                  {(['overview', 'tasks', 'releases', 'logs'] as DetailTab[]).map((tab) => (
                    <button
                      key={tab}
                      className={`rounded-full px-3 py-1.5 transition ${
                        detailTab === tab
                          ? 'bg-[rgb(var(--ink))] text-white'
                          : 'bg-transparent text-[rgb(var(--muted))] hover:bg-[rgba(21,128,110,0.08)] hover:text-[rgb(var(--ink))]'
                      }`}
                      onClick={() => setDetailTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-auto p-5">
                  {detailTab === 'overview' ? (
                    <OverviewPanel project={currentProject} detail={detail} changePrompt={changePrompt} setChangePrompt={setChangePrompt} onApplyChange={() => void handleProjectAction('change')} actionBusy={actionBusy} />
                  ) : null}
                  {detailTab === 'tasks' ? <TasksPanel tasks={detail?.tasks ?? []} currentTask={currentTask} /> : null}
                  {detailTab === 'releases' ? <ReleasesPanel project={currentProject} releases={detail?.releases ?? []} /> : null}
                  {detailTab === 'logs' ? <LogsPanel currentTask={currentTask} logs={taskLogs} /> : null}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-[rgb(var(--muted))]">
                Choose a project on the left or create a new one to inspect its tasks, releases, and logs.
              </div>
            )}
          </aside>
        </div>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(17,20,26,0.44)] px-4 backdrop-blur-sm">
          <div className="shell-panel w-full max-w-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="label">Create project</p>
                <h3 className="mt-1 text-xl font-semibold">New static site</h3>
              </div>
              <button className="soft-button" onClick={() => setCreateOpen(false)}>
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Project name">
                <input
                  className="w-full rounded-2xl border border-[rgb(var(--line))] bg-white px-4 py-3 outline-none transition focus:border-[rgb(var(--teal))]"
                  placeholder="gongde-basketball"
                  value={createForm.name}
                  onChange={(event) => {
                    setCreateError(null);
                    setCreateForm((prev) => ({ ...prev, name: event.target.value }));
                  }}
                />
                <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                  Lowercase letters, numbers, and hyphens only. Reserved names such as `shipnow`, `api`, and `preview` are blocked.
                </p>
                {createNameError ? <p className="mt-2 text-xs text-rose-700">{createNameError}</p> : null}
              </Field>
              <Field label="Project title">
                <input
                  className="w-full rounded-2xl border border-[rgb(var(--line))] bg-white px-4 py-3 outline-none transition focus:border-[rgb(var(--teal))]"
                  placeholder="功德篮球"
                  value={createForm.title}
                  onChange={(event) => {
                    setCreateError(null);
                    setCreateForm((prev) => ({ ...prev, title: event.target.value }));
                  }}
                />
              </Field>
              <Field label="Project type">
                <select
                  className="w-full rounded-2xl border border-[rgb(var(--line))] bg-white px-4 py-3 outline-none transition focus:border-[rgb(var(--teal))]"
                  value={createForm.type}
                  onChange={(event) => {
                    setCreateError(null);
                    setCreateForm((prev) => ({ ...prev, type: event.target.value as ProjectType }));
                  }}
                >
                  {projectTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} · {option.hint}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Prompt" className="md:col-span-2">
                <textarea
                  className="min-h-36 w-full rounded-2xl border border-[rgb(var(--line))] bg-white px-4 py-3 outline-none transition focus:border-[rgb(var(--teal))]"
                  placeholder="做一个反直觉功德篮球小游戏，玩家通过蓄力投篮获取功德值。"
                  value={createForm.prompt}
                  onChange={(event) => {
                    setCreateError(null);
                    setCreateForm((prev) => ({ ...prev, prompt: event.target.value }));
                  }}
                />
              </Field>
            </div>

            {createError ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{createError}</div> : null}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button className="soft-button" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button className="primary-button" onClick={() => void handleCreateProject()} disabled={actionBusy === 'create' || !createCanSubmit}>
                {actionBusy === 'create' ? 'Creating...' : 'Create project'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen && currentProject ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(17,20,26,0.44)] px-4 backdrop-blur-sm">
          <div className="shell-panel w-full max-w-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="label">Delete project</p>
                <h3 className="mt-1 text-xl font-semibold text-rose-700">This cannot be undone</h3>
              </div>
              <button
                className="soft-button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirmName('');
                }}
              >
                Close
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-[rgb(var(--muted))]">
              Type <span className="font-semibold text-[rgb(var(--ink))]">{currentProject.name}</span> to confirm deletion. The source, preview mapping, public mapping, and release directories for this project will be removed, while logs and database records stay available.
            </p>

            <div className="mt-5">
              <Field label="Confirm project name">
                <input
                  className="w-full rounded-2xl border border-[rgb(var(--line))] bg-white px-4 py-3 outline-none transition focus:border-[rgb(var(--teal))]"
                  value={deleteConfirmName}
                  onChange={(event) => setDeleteConfirmName(event.target.value)}
                  placeholder={currentProject.name}
                />
              </Field>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                className="soft-button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirmName('');
                }}
              >
                Cancel
              </button>
              <button
                className="primary-button bg-rose-600 hover:bg-rose-700"
                onClick={() => void handleDeleteProject()}
                disabled={actionBusy === 'delete' || !deleteNameMatches}
              >
                {actionBusy === 'delete' ? 'Deleting...' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="shell-panel px-5 py-4">
      <p className="label">{label}</p>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      <p className="mt-1 text-sm text-[rgb(var(--muted))]">{hint}</p>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[rgb(var(--line))] bg-[rgba(255,255,255,0.6)] p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--ink))] text-lg font-bold text-white">
        +
      </div>
      <h3 className="mt-4 text-lg font-semibold">No projects yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[rgb(var(--muted))]">
        Create the first ShipNow project to generate a template, run Codex, and start a preview release.
      </p>
      <button className="primary-button mt-5" onClick={onCreate}>
        Create project
      </button>
    </div>
  );
}

function OverviewPanel({
  project,
  detail,
  changePrompt,
  setChangePrompt,
  onApplyChange,
  actionBusy,
}: {
  project: ProjectView;
  detail: ProjectDetailResponse | null;
  changePrompt: string;
  setChangePrompt: (value: string) => void;
  onApplyChange: () => void;
  actionBusy: string | null;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-[rgb(var(--line))] bg-white/80 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label">Project summary</p>
            <h3 className="mt-1 text-xl font-semibold">{project.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[rgb(var(--muted))]">{project.prompt}</p>
          </div>
          <div className="text-right text-xs text-[rgb(var(--muted))]">
            <div>Source</div>
            <div className="mt-1 font-mono text-[11px] text-[rgb(var(--ink))]">{project.sourceRoot}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Metric label="Preview" value={project.previewUrl} />
        <Metric label="Public" value={project.publicUrl} />
        <Metric label="Last built" value={formatTime(project.lastBuiltAt)} />
        <Metric label="Last published" value={formatTime(project.lastPublishedAt)} />
      </div>

      <div className="rounded-[24px] border border-[rgb(var(--line))] bg-white/80 p-4">
        <p className="label">Apply change</p>
        <textarea
          className="mt-3 min-h-32 w-full rounded-2xl border border-[rgb(var(--line))] bg-white px-4 py-3 outline-none transition focus:border-[rgb(var(--teal))]"
          placeholder="把整体风格改得更高级一点，按钮不要太粉嫩。"
          value={changePrompt}
          onChange={(event) => setChangePrompt(event.target.value)}
        />
        <div className="mt-3 flex items-center justify-end gap-3">
          <button className="soft-button" onClick={() => setChangePrompt('')}>
            Clear
          </button>
          <button className="primary-button" onClick={onApplyChange} disabled={actionBusy === 'change'}>
            {actionBusy === 'change' ? 'Applying...' : 'Apply change'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Metric label="Latest task" value={detail?.tasks[0]?.type ?? '—'} />
        <Metric label="Task status" value={detail?.tasks[0] ? statusLabel(detail.tasks[0].status) : '—'} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[rgb(var(--line))] bg-white/80 p-4">
      <div className="label">{label}</div>
      <div className="mt-2 break-all text-sm font-medium text-[rgb(var(--ink))]">{value}</div>
    </div>
  );
}

function TasksPanel({ tasks, currentTask }: { tasks: TaskView[]; currentTask: TaskView | null }) {
  return (
    <div className="space-y-3">
      {tasks.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[rgb(var(--line))] bg-white/70 p-6 text-sm text-[rgb(var(--muted))]">
          No tasks yet.
        </div>
      ) : null}
      {tasks.map((task) => (
        <div key={task.id} className="rounded-[24px] border border-[rgb(var(--line))] bg-white/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{task.type}</div>
              <div className="mt-1 text-xs text-[rgb(var(--muted))]">Task {task.id}</div>
            </div>
            <span className={`chip ${taskBadge(task)}`}>{statusLabel(task.status)}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[rgb(var(--muted))]">{task.prompt}</p>
          <div className="mt-3 grid gap-2 text-xs text-[rgb(var(--muted))] md:grid-cols-2">
            <div>Started: {formatTime(task.startedAt)}</div>
            <div>Finished: {formatTime(task.finishedAt)}</div>
          </div>
          {currentTask?.id === task.id ? <div className="mt-3 text-xs text-[rgb(var(--teal))]">Selected task</div> : null}
        </div>
      ))}
    </div>
  );
}

function ReleasesPanel({
  project,
  releases,
}: {
  project: ProjectView;
  releases: Array<{
    id: string;
    kind: 'preview' | 'public';
    source: string;
    releasePath: string;
    createdAt: string;
    publishedAt: string | null;
    buildTaskId: string | null;
    isCurrentPreview: boolean;
    isCurrentPublic: boolean;
  }>;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-[24px] border border-[rgb(var(--line))] bg-white/80 p-4">
        <div className="label">Current URLs</div>
        <div className="mt-3 space-y-2 text-sm">
          <div>
            <span className="font-medium">Preview:</span> {project.previewUrl}
          </div>
          <div>
            <span className="font-medium">Public:</span> {project.publicUrl}
          </div>
        </div>
      </div>
      {releases.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[rgb(var(--line))] bg-white/70 p-6 text-sm text-[rgb(var(--muted))]">
          No releases yet.
        </div>
      ) : null}
      {releases.map((release) => (
        <div key={release.id} className="rounded-[24px] border border-[rgb(var(--line))] bg-white/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium capitalize">{release.kind}</div>
            <div className="text-xs text-[rgb(var(--muted))]">{release.isCurrentPreview || release.isCurrentPublic ? 'Current' : 'Archived'}</div>
          </div>
          <div className="mt-2 text-xs text-[rgb(var(--muted))] break-all">{release.releasePath}</div>
          <div className="mt-3 grid gap-2 text-xs text-[rgb(var(--muted))] md:grid-cols-2">
            <div>Created: {formatTime(release.createdAt)}</div>
            <div>Published: {formatTime(release.publishedAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LogsPanel({ currentTask, logs }: { currentTask: TaskView | null; logs: string }) {
  return (
    <div className="space-y-3">
      <div className="rounded-[24px] border border-[rgb(var(--line))] bg-[rgb(18,23,31)] p-4 text-[rgb(220,225,233)] shadow-inner">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 text-xs text-white/60">
          <span>{currentTask ? `${currentTask.type} · ${currentTask.status}` : 'No active task'}</span>
          <span>{currentTask ? currentTask.id : '—'}</span>
        </div>
        <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap text-xs leading-6 text-[rgb(220,225,233)]">
          {logs || 'Logs will appear here once a task starts.'}
        </pre>
      </div>
    </div>
  );
}

export default App;
