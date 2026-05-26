import { join, resolve } from 'node:path';
import { copyDirectory, ensureDir, atomicSymlink, readText, removePath, writeText } from './utils.js';
import type { ShipNowEnv } from './env.js';
import type { ProjectType } from './types.js';

export interface ProjectPaths {
  projectRoot: string;
  sourceRoot: string;
  previewCurrentRoot: string;
  publicCurrentRoot: string;
  previewReleasesRoot: string;
  publicReleasesRoot: string;
  logPath: string;
}

export function projectPaths(env: ShipNowEnv, projectName: string): ProjectPaths {
  const projectRoot = resolve(env.workspaceRoot, 'projects', projectName);
  return {
    projectRoot,
    sourceRoot: join(projectRoot, 'source'),
    previewCurrentRoot: resolve(env.previewStaticRoot, projectName),
    publicCurrentRoot: resolve(env.publicStaticRoot, projectName),
    previewReleasesRoot: resolve(env.workspaceRoot, 'releases', 'preview', projectName),
    publicReleasesRoot: resolve(env.workspaceRoot, 'releases', 'public', projectName),
    logPath: resolve(env.logRoot, `${projectName}.log`),
  };
}

export async function ensureWorkspaceRoots(env: ShipNowEnv): Promise<void> {
  await Promise.all([
    ensureDir(env.workspaceRoot),
    ensureDir(env.templateRoot),
    ensureDir(env.previewStaticRoot),
    ensureDir(env.publicStaticRoot),
    ensureDir(env.logRoot),
    ensureDir(resolve(env.workspaceRoot, 'projects')),
    ensureDir(resolve(env.workspaceRoot, 'releases', 'preview')),
    ensureDir(resolve(env.workspaceRoot, 'releases', 'public')),
  ]);
}

export async function prepareProjectWorkspace(env: ShipNowEnv, projectName: string): Promise<ProjectPaths> {
  const paths = projectPaths(env, projectName);
  await Promise.all([
    ensureDir(paths.projectRoot),
    ensureDir(paths.previewReleasesRoot),
    ensureDir(paths.publicReleasesRoot),
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
    name: string;
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
  await Promise.all([
    removePath(paths.projectRoot),
    removePath(paths.previewCurrentRoot),
    removePath(paths.publicCurrentRoot),
    removePath(paths.previewReleasesRoot),
    removePath(paths.publicReleasesRoot),
  ]);
}
