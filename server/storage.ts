import { join, resolve } from 'node:path';
import { copyDirectory, ensureDir, atomicSymlink, readText, removePath, writeText } from './utils.js';
import type { ShipNowEnv } from './env.js';
import type { ProjectType } from './types.js';

export interface ProjectPaths {
  projectRoot: string;
  sourceRoot: string;
  publicIndexPath: string;
  publicAssetsPath: string;
  previewCurrentRoot: string;
  publicCurrentRoot: string;
  previewIndexPath: string;
  previewAssetsPath: string;
  previewReleasesRoot: string;
  publicReleasesRoot: string;
  logPath: string;
}

export function projectPaths(env: ShipNowEnv, projectId: string): ProjectPaths {
  const projectRoot = resolve(env.publicStaticRoot, projectId);
  return {
    projectRoot,
    sourceRoot: join(projectRoot, 'source'),
    publicIndexPath: resolve(projectRoot, 'index.html'),
    publicAssetsPath: resolve(projectRoot, 'assets'),
    previewCurrentRoot: resolve(projectRoot, 'current-preview'),
    publicCurrentRoot: resolve(projectRoot, 'current-public'),
    previewIndexPath: resolve(projectRoot, 'preview', 'index.html'),
    previewAssetsPath: resolve(projectRoot, 'preview', 'assets'),
    previewReleasesRoot: resolve(projectRoot, 'releases', 'preview'),
    publicReleasesRoot: resolve(projectRoot, 'releases', 'public'),
    logPath: resolve(projectRoot, 'logs', `${projectId}.log`),
  };
}

export async function ensureWorkspaceRoots(env: ShipNowEnv): Promise<void> {
  await Promise.all([
    ensureDir(env.workspaceRoot),
    ensureDir(env.templateRoot),
    ensureDir(env.publicStaticRoot),
  ]);
}

export async function prepareProjectWorkspace(env: ShipNowEnv, projectName: string): Promise<ProjectPaths> {
  const paths = projectPaths(env, projectName);
  await Promise.all([
    ensureDir(paths.projectRoot),
    ensureDir(resolve(paths.projectRoot, 'preview')),
    ensureDir(resolve(paths.projectRoot, 'logs')),
    ensureDir(resolve(paths.projectRoot, 'releases', 'preview')),
    ensureDir(resolve(paths.projectRoot, 'releases', 'public')),
    ensureDir(paths.previewReleasesRoot),
    ensureDir(paths.publicReleasesRoot),
    ensureDir(resolve(paths.projectRoot, 'current-preview')),
    ensureDir(resolve(paths.projectRoot, 'current-public')),
  ]);
  await Promise.all([
    updateCurrentReleaseLink(resolve(paths.publicCurrentRoot, 'index.html'), paths.publicIndexPath),
    updateCurrentReleaseLink(resolve(paths.publicCurrentRoot, 'assets'), paths.publicAssetsPath),
    updateCurrentReleaseLink(resolve(paths.previewCurrentRoot, 'index.html'), paths.previewIndexPath),
    updateCurrentReleaseLink(resolve(paths.previewCurrentRoot, 'assets'), paths.previewAssetsPath),
  ]);
  return paths;
}

export async function copyDefaultTemplate(env: ShipNowEnv, paths: ProjectPaths): Promise<void> {
  const templateRoot = resolve(env.templateRoot, 'default-static-site');
  await copyDirectory(templateRoot, paths.sourceRoot);
}

export async function writeProjectConfig(
  paths: ProjectPaths,
  input: {
    projectId: string;
    displayName: string;
    publicHandle: string;
    type: ProjectType;
    title: string;
    prompt: string;
  }
): Promise<void> {
  await writeText(
    join(paths.sourceRoot, 'src/project.config.ts'),
    `export const projectConfig = ${JSON.stringify(input, null, 2)} as const;

export type ProjectConfig = typeof projectConfig;
`
  );
}

export async function updateCurrentReleaseLink(targetRoot: string, linkPath: string): Promise<void> {
  await removePath(linkPath);
  await atomicSymlink(targetRoot, linkPath);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function injectHeadContent(html: string, headContent: string): string {
  const headMatch = html.match(/<head[^>]*>/i);
  if (!headMatch) {
    return `${headContent}\n${html}`;
  }
  return html.replace(headMatch[0], `${headMatch[0]}\n  ${headContent}`);
}

export async function injectBaseHref(indexPath: string, baseHref: string): Promise<void> {
  const html = await readText(indexPath);
  if (!html) {
    return;
  }
  const injectedBase = `<base href="${escapeHtml(baseHref)}">`;
  const normalizedHtml = html.replace(/<base\s+href="[^"]*"\s*>/i, '');
  const rendered = injectHeadContent(normalizedHtml, injectedBase);
  await writeText(indexPath, rendered);
}

export async function removeProjectWorkspace(paths: ProjectPaths): Promise<void> {
  await removePath(paths.projectRoot);
}
