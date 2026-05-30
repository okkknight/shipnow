import Fastify from 'fastify';
import cors from '@fastify/cors';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { ZodError, z } from 'zod';
import { findIndexFile, findStaticFile, sendFile } from './utils.js';
import type { ShipNowEnv } from './env.js';
import { ShipNowManager } from './shipnowManager.js';
import { projectTimelineBus, serializeTimelineEvent } from './timelineBus.js';
import { publicHandleSchema, projectIdSchema } from './security.js';
import type { FastifyReply } from 'fastify';

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }
  return `/${trimmed.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

function joinRoute(prefix: string, suffix = ''): string {
  const normalizedPrefix = normalizePrefix(prefix);
  const normalizedSuffix = suffix.replace(/^\/+/, '');
  if (!normalizedPrefix) {
    return normalizedSuffix ? `/${normalizedSuffix}` : '/';
  }
  return normalizedSuffix ? `${normalizedPrefix}/${normalizedSuffix}` : normalizedPrefix;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function normalizeAssetPath(pathname: string, prefix: string): string {
  const stripped = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  return stripped.replace(/^\/+/, '');
}

function basePathFromUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('/')) {
    return trimmed.replace(/\/+$/, '');
  }

  try {
    return new URL(trimmed).pathname.replace(/\/+$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function previewRouteBaseHref(previewBaseUrl: string, publicHandle: string): string {
  const basePath = basePathFromUrl(previewBaseUrl);
  return `${basePath}/${publicHandle}/`;
}

function injectHeadContent(html: string, headContent: string): string {
  const headMatch = html.match(/<head[^>]*>/i);
  if (!headMatch) {
    return `${headContent}\n${html}`;
  }
  return html.replace(headMatch[0], `${headMatch[0]}\n  ${headContent}`);
}

async function sendIndex(reply: FastifyReply, filePath: string, apiBase: string, baseHref?: string): Promise<void> {
  reply.header('Content-Type', 'text/html; charset=utf-8');
  reply.header('Cache-Control', 'no-store');
  const html = await readFile(filePath, 'utf8');
  const normalizedHtml = baseHref ? html.replace(/<base\s+href="[^"]*"\s*>/i, '') : html;
  const tags = [
    baseHref ? `<base href="${escapeHtml(baseHref)}">` : null,
    `<meta name="shipnow-api-base" content="${escapeHtml(apiBase)}">`,
  ].filter(Boolean);
  const rendered = injectHeadContent(normalizedHtml, tags.join('\n  '));
  await reply.send(rendered);
}

async function maybeRedirect(reply: FastifyReply, to: string): Promise<void> {
  reply.header('Cache-Control', 'no-store');
  reply.redirect(to, 301);
}

export interface ShipNowAppOptions {
  serveUiShell: boolean;
  publicBaseUrl: string;
  apiBaseUrl: string;
  previewBaseUrl: string;
}

function isShipNowAppOptions(value: ShipNowManager | ShipNowAppOptions): value is ShipNowAppOptions {
  return typeof value === 'object' && value !== null && 'serveUiShell' in value;
}

export async function createShipNowApp(
  managerOrOptions: ShipNowManager | ShipNowAppOptions,
  env?: ShipNowEnv,
  runtimeOptions?: Partial<ShipNowAppOptions>
) {
  if (isShipNowAppOptions(managerOrOptions)) {
    const app = Fastify({
      logger: {
        level: 'info',
      },
    });

    await app.register(cors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });

    app.get('/health', async () => ({ ok: true }));

    if (managerOrOptions.serveUiShell) {
      app.get('/', async (_request, reply) => {
        reply.redirect('/shipnow');
      });
    }

    return app;
  }

  if (!env) {
    throw new Error('ShipNow env is required when creating the managed app.');
  }

  const manager = managerOrOptions;
  const shellOptions: ShipNowAppOptions = {
    serveUiShell: runtimeOptions?.serveUiShell ?? true,
    publicBaseUrl: runtimeOptions?.publicBaseUrl ?? env.publicBaseUrl,
    apiBaseUrl: runtimeOptions?.apiBaseUrl ?? env.shipnowApiBaseUrl,
    previewBaseUrl: runtimeOptions?.previewBaseUrl ?? env.previewBaseUrl,
  };

  const appPrefix = normalizePrefix(env.shipnowAppPrefix);
  const apiRoutePrefix = '/api';
  const appRootRoute = joinRoute(appPrefix);
  const appAssetRoute = joinRoute(appPrefix, 'assets/*');
  const apiRoute = (suffix = ''): string => joinRoute(apiRoutePrefix, suffix);
  const isAppPrefixRoot = appPrefix.length === 0;

  const app = Fastify({
    logger: {
      level: 'info',
    },
  });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error({ err: error }, 'ShipNow request failed');

    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : null;
    if (statusCode && statusCode >= 400 && statusCode < 600) {
      const message = error instanceof Error ? error.message : 'Request failed';
      reply.status(statusCode).send({ error: message });
      return;
    }

    if (error instanceof ZodError) {
      reply.status(400).send({
        error: 'Validation failed',
        message: error.issues.map((issue) => issue.message).join('; '),
      });
      return;
    }

    if (error instanceof Error) {
      const message = error.message;
      if (message.includes('already exists')) {
        reply.status(409).send({ error: message });
        return;
      }
      if (message.includes('already has a running or pending task')) {
        reply.status(409).send({ error: message });
        return;
      }
      if (message.includes('not found')) {
        reply.status(404).send({ error: message });
        return;
      }
      if (message.includes('has been deleted')) {
        reply.status(409).send({ error: message });
        return;
      }
      if (message.includes('No successful preview release found')) {
        reply.status(409).send({ error: message });
        return;
      }
      if (message.includes('Project source directory missing')) {
        reply.status(409).send({ error: message });
        return;
      }
      if (message.includes('Missing dist directory after build')) {
        reply.status(500).send({ error: message });
        return;
      }
      if (
        message.includes('Codex failed') ||
        message.includes('Claude Code failed') ||
        message.includes('pnpm build failed') ||
        message.includes('pnpm install failed')
      ) {
        reply.status(500).send({ error: message });
        return;
      }
    }

    reply.status(500).send({ error: 'Internal Server Error' });
  });

  app.get('/health', async () => ({ ok: true }));

  const runnerSchema = z.enum(['codex', 'claude-code']);

  app.get(apiRoute('settings'), async () => ({ settings: manager.getAppSettings() }));

  app.put(apiRoute('settings'), async (request) => {
    const body = z
      .object({
        defaultRunner: runnerSchema,
      })
      .parse(request.body);
    return { settings: manager.updateAppSettings(body.defaultRunner) };
  });

  app.get(apiRoute('projects'), async () => ({ projects: manager.listProjects() }));

  app.post(apiRoute('projects'), async (request, reply) => {
    const body = z
      .object({
        prompt: z.string().min(1).max(10_000),
      })
      .parse(request.body);
    const result = await manager.createProject(body);
    reply.code(201);
    return result;
  });

  app.get(apiRoute('projects/:projectId'), async (request) => {
    const projectId = projectIdSchema.parse((request.params as { projectId: string }).projectId);
    const detail = manager.getProjectDetail(projectId);
    return detail;
  });

  app.post(apiRoute('projects/:projectId/changes'), async (request) => {
    const projectId = projectIdSchema.parse((request.params as { projectId: string }).projectId);
    const body = z.object({ prompt: z.string().min(1).max(10_000) }).parse(request.body);
    return await manager.applyChange(projectId, body.prompt);
  });

  app.post(apiRoute('projects/:projectId/rebuild'), async (request) => {
    const projectId = projectIdSchema.parse((request.params as { projectId: string }).projectId);
    return await manager.rebuild(projectId);
  });

  app.post(apiRoute('projects/:projectId/publish'), async (request) => {
    const projectId = projectIdSchema.parse((request.params as { projectId: string }).projectId);
    return await manager.publish(projectId);
  });

  app.post(apiRoute('projects/:projectId/rename'), async (request) => {
    const projectId = projectIdSchema.parse((request.params as { projectId: string }).projectId);
    const body = z
      .object({
        displayName: publicHandleSchema,
      })
      .parse(request.body);
    return await manager.renameProject({ projectId, displayName: body.displayName });
  });

  app.get(apiRoute('projects/:projectId/settings'), async (request, reply) => {
    const projectId = projectIdSchema.parse((request.params as { projectId: string }).projectId);
    const settings = manager.getProjectSettings(projectId);
    if (!settings) {
      return reply.code(404).send({ error: `Project ${projectId} not found.` });
    }
    return { settings };
  });

  app.put(apiRoute('projects/:projectId/settings'), async (request, reply) => {
    const projectId = projectIdSchema.parse((request.params as { projectId: string }).projectId);
    const body = z
      .object({
        preferredRunner: runnerSchema.nullable(),
      })
      .parse(request.body);
    const settings = manager.updateProjectSettings(projectId, body.preferredRunner);
    if (!settings) {
      return reply.code(404).send({ error: `Project ${projectId} not found.` });
    }
    return { settings };
  });

  app.delete(apiRoute('projects/:projectId'), async (request) => {
    const projectId = projectIdSchema.parse((request.params as { projectId: string }).projectId);
    return await manager.deleteProject(projectId);
  });

  app.get(apiRoute('tasks/:taskId'), async (request, reply) => {
    const taskId = z.string().min(1).parse((request.params as { taskId: string }).taskId);
    const task = manager.getTask(taskId);
    if (!task) {
      return reply.code(404).send({ error: `Task ${taskId} not found.` });
    }
    return { task };
  });

  app.get(apiRoute('tasks/:taskId/logs'), async (request, reply) => {
    const taskId = z.string().min(1).parse((request.params as { taskId: string }).taskId);
    const task = manager.getTask(taskId);
    if (!task) {
      return reply.code(404).send('Task not found.');
    }
    reply.header('Content-Type', 'text/plain; charset=utf-8');
    reply.header('Cache-Control', 'no-store');
    return manager.getTaskLog(taskId);
  });

  app.get(apiRoute('projects/:projectId/timeline/stream'), async (request, reply) => {
    const projectId = projectIdSchema.parse((request.params as { projectId: string }).projectId);
    const project = manager.getProject(projectId);
    if (!project) {
      return reply.code(404).send({ error: `Project ${projectId} not found.` });
    }

    reply.hijack();
    const stream = reply.raw;
    stream.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    stream.write('\n');

    const unsubscribe = projectTimelineBus.subscribe(projectId, (event) => {
      stream.write(serializeTimelineEvent(event));
    }, false);

    request.raw.on('close', () => {
      unsubscribe();
      if (!stream.writableEnded) {
        stream.end();
      }
    });
  });

  const publicRoot = env.publicStaticRoot;
  const clientDistRoot = resolve(process.cwd(), 'dist/client');
  const shipnowIndexApiBase = env.shipnowApiBaseUrl;

  async function serveRelease(prefix: string, rootDir: string, requestPath: string, reply: FastifyReply, baseHref?: string): Promise<boolean> {
    if (!existsSync(rootDir)) {
      return false;
    }
    const relative = normalizeAssetPath(requestPath, prefix);
    const candidate = relative.length > 0 ? await findStaticFile(rootDir, relative) : null;
    const indexFile = await findIndexFile(rootDir);
    if (candidate) {
      await sendFile(reply, candidate);
      return true;
    }
    if (indexFile) {
      if (baseHref) {
        await sendIndex(reply, indexFile, shipnowIndexApiBase, baseHref);
      } else {
        await sendFile(reply, indexFile);
      }
      return true;
    }
    return false;
  }

  async function servePreviewRoute(requestPath: string, reply: FastifyReply): Promise<boolean> {
    const previewPrefix = '/preview/';
    if (!requestPath.startsWith(previewPrefix)) {
      return false;
    }
    const remainder = requestPath.slice(previewPrefix.length);
    const [handle] = remainder.split('/');
    const resolution = manager.resolveProjectHandle(handle);
    if (!resolution) {
      reply.code(404).send('Preview not found.');
      return true;
    }
    if (resolution.redirected) {
      const redirectedPath = requestPath.replace(`/preview/${handle}`, `/preview/${resolution.project.publicHandle}`);
      await maybeRedirect(reply, redirectedPath);
      return true;
    }
    const projectRoot = resolve(publicRoot, resolution.project.projectId, 'preview');
    const rest = requestPath.slice((previewPrefix + handle).length);
    if (!(await serveRelease(`/preview/${handle}`, projectRoot, rest, reply, previewRouteBaseHref(shellOptions.previewBaseUrl, resolution.project.publicHandle)))) {
      reply.code(404).send('Preview not found.');
    }
    return true;
  }

  async function servePublicRoute(requestPath: string, reply: FastifyReply): Promise<boolean> {
    const rootSegments = requestPath.replace(/^\/+/, '').split('/').filter(Boolean);
    if (rootSegments.length === 0) {
      return false;
    }
    const handle = rootSegments[0];
    if (handle === 'shipnow' || handle === 'api' || handle === 'preview') {
      return false;
    }
    const resolution = manager.resolveProjectHandle(handle);
    if (!resolution) {
      return false;
    }
    if (resolution.redirected) {
      const redirectedPath = requestPath.replace(`/${handle}`, `/${resolution.project.publicHandle}`);
      await maybeRedirect(reply, redirectedPath);
      return true;
    }
    const projectRoot = resolve(publicRoot, resolution.project.publicHandle);
    const rest = requestPath.slice(1 + handle.length);
    if (!(await serveRelease(`/${handle}`, projectRoot, rest, reply, `/${resolution.project.publicHandle}/`))) {
      reply.code(404).send('Site not found.');
    }
    return true;
  }

  async function serveShipNowApp(requestPath: string, reply: FastifyReply): Promise<boolean> {
    if (!shellOptions.serveUiShell) {
      return false;
    }

    if (!existsSync(clientDistRoot)) {
      return false;
    }

    if (!isAppPrefixRoot && (requestPath === `${appRootRoute}/api` || requestPath.startsWith(`${appRootRoute}/api/`))) {
      return false;
    }

    const prefixMatch = isAppPrefixRoot
      ? !requestPath.startsWith('/preview/') && !requestPath.startsWith('/api/')
      : requestPath === appRootRoute || requestPath.startsWith(`${appRootRoute}/`);

    if (!prefixMatch) {
      return false;
    }

    const relative = isAppPrefixRoot
      ? requestPath.replace(/^\/+/, '')
      : requestPath.slice(appRootRoute.length).replace(/^\/+/, '');
    const candidate = relative.length > 0 ? await findStaticFile(clientDistRoot, relative) : null;
    const indexFile = await findIndexFile(clientDistRoot);
    if (candidate) {
      await sendFile(reply, candidate);
      return true;
    }
    if (indexFile) {
      await sendIndex(reply, indexFile, shipnowIndexApiBase);
      return true;
    }
    return false;
  }

  app.get('/preview/:projectHandle', async (request, reply) => {
    const { projectHandle } = request.params as { projectHandle: string };
    await servePreviewRoute(`/preview/${projectHandle}`, reply);
  });

  app.get('/preview/:projectHandle/*', async (request, reply) => {
    const { projectHandle } = request.params as { projectHandle: string };
    const requestPath = request.url.split('?')[0];
    await servePreviewRoute(requestPath, reply);
  });

  if (shellOptions.serveUiShell) {
    app.get(appRootRoute, async (_request, reply) => {
      const indexFile = await findIndexFile(clientDistRoot);
      if (indexFile) {
        await sendIndex(reply, indexFile, shipnowIndexApiBase);
        return;
      }
      reply.type('text/html').send(`<!doctype html>
        <html lang="en">
          <head><meta charset="utf-8"><title>ShipNow</title></head>
          <body style="font-family: system-ui; padding: 24px;">
            <h1>ShipNow is not built yet.</h1>
            <p>Run the Vite dev server for local frontend work, or run a production build before serving ShipNow.</p>
          </body>
        </html>`);
    });

    app.get(appAssetRoute, async (request, reply) => {
      const requestPath = request.url.split('?')[0];
      const relative = isAppPrefixRoot
        ? requestPath.replace(/^\/+/, '')
        : requestPath.slice(appRootRoute.length).replace(/^\/+/, '');
      const candidate = relative.length > 0 ? await findStaticFile(clientDistRoot, relative) : null;
      if (candidate) {
        await sendFile(reply, candidate);
        return;
      }
      reply.code(404).send('ShipNow asset not found.');
    });

    if (!isAppPrefixRoot) {
      app.get('/', async (_request, reply) => {
        reply.redirect(appRootRoute);
      });
    }
  }

  app.setNotFoundHandler(async (request, reply) => {
    const requestPath = request.url.split('?')[0];
    if (await servePreviewRoute(requestPath, reply)) {
      return;
    }
    if (requestPath.startsWith(apiRoutePrefix)) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }
    if (await serveShipNowApp(requestPath, reply)) {
      return;
    }
    if (await servePublicRoute(requestPath, reply)) {
      return;
    }
    reply.code(404).send({ error: 'Not found' });
  });

  return app;
}
