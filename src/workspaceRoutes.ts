export type WorkspaceRouteState =
  | { kind: 'home' }
  | { kind: 'project'; projectId: string }
  | { kind: 'project-preview'; projectId: string }
  | { kind: 'project-live'; projectId: string }
  | { kind: 'publish-success'; projectId: string }
  | { kind: 'publish-failure'; projectId: string }
  | { kind: 'settings' }
  | { kind: 'templates' }
  | { kind: 'projects' }
  | { kind: 'design-system' }
  | { kind: 'visual-reference' };

export function parseWorkspaceRoute(pathname: string, appBase = ''): WorkspaceRouteState {
  const normalizedBase = normalizeAppBase(appBase);
  const stripped = stripAppBase(pathname, normalizedBase).replace(/\/+$/, '') || '/';
  const segments = stripped.split('/').filter(Boolean);

  if (segments[0] === 'design-system') {
    return { kind: 'design-system' };
  }
  if (segments[0] === 'visual-reference') {
    return { kind: 'visual-reference' };
  }
  if (segments[0] === 'project' && segments[1]) {
    const projectId = decodeURIComponent(segments[1]);
    if (segments[2] === 'preview') {
      return { kind: 'project-preview', projectId };
    }
    if (segments[2] === 'live') {
      return { kind: 'project-live', projectId };
    }
    if (segments[2] === 'publish-success') {
      return { kind: 'publish-success', projectId };
    }
    if (segments[2] === 'publish-failure') {
      return { kind: 'publish-failure', projectId };
    }
    return { kind: 'project', projectId };
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

export function buildProjectPreviewPath(projectId: string): string {
  return `/project/${encodeURIComponent(projectId)}/preview`;
}

export function buildProjectLivePath(projectId: string): string {
  return `/project/${encodeURIComponent(projectId)}/live`;
}

export function hasEverPublishedProject(project: { lastPublishedAt: string | null; publicReleasePath: string | null; status: string }): boolean {
  return Boolean(project.lastPublishedAt || project.publicReleasePath || project.status === 'published');
}

function normalizeAppBase(base: string): string {
  const trimmed = base.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function stripAppBase(pathname: string, appBase: string): string {
  if (!appBase) {
    return pathname || '/';
  }
  if (pathname === appBase || pathname === `${appBase}/`) {
    return '/';
  }
  if (pathname.startsWith(`${appBase}/`)) {
    return pathname.slice(appBase.length);
  }
  return pathname || '/';
}
