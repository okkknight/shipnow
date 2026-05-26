import Fastify from 'fastify';
import cors from '@fastify/cors';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { ZodError, z } from 'zod';
import { findIndexFile, findStaticFile, sendFile } from './utils.js';
import type { ShipNowEnv } from './env.js';
import { ShipNowManager } from './shipnowManager.js';
import { projectNameSchema } from './security.js';
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

export async function createShipNowApp(manager: ShipNowManager, env: ShipNowEnv) {
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
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
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
      if (message.includes('Codex failed') || message.includes('pnpm build failed') || message.includes('pnpm install failed')) {
        reply.status(500).send({ error: message });
        return;
      }
    }

    reply.status(500).send({ error: 'Internal Server Error' });
  });

  app.get('/health', async () => ({ ok: true }));

  app.get(apiRoute('projects'), async () => ({ projects: manager.listProjects() }));

  app.post(apiRoute('projects'), async (request, reply) => {
    const body = z
      .object({
        name: projectNameSchema,
        title: z.string().min(1).max(120),
        prompt: z.string().min(1).max(10_000),
      })
      .parse(request.body);
    const result = await manager.createProject(body);
    reply.code(201);
    return result;
  });

  app.get(apiRoute('projects/:projectName'), async (request) => {
    const projectName = projectNameSchema.parse((request.params as { projectName: string }).projectName);
    const detail = manager.getProjectDetail(projectName);
    return detail;
  });

  app.post(apiRoute('projects/:projectName/changes'), async (request) => {
    const projectName = projectNameSchema.parse((request.params as { projectName: string }).projectName);
    const body = z.object({ prompt: z.string().min(1).max(10_000) }).parse(request.body);
    return await manager.applyChange(projectName, body.prompt);
  });

  app.post(apiRoute('projects/:projectName/rebuild'), async (request) => {
    const projectName = projectNameSchema.parse((request.params as { projectName: string }).projectName);
    return await manager.rebuild(projectName);
  });

  app.post(apiRoute('projects/:projectName/publish'), async (request) => {
    const projectName = projectNameSchema.parse((request.params as { projectName: string }).projectName);
    return await manager.publish(projectName);
  });

  app.delete(apiRoute('projects/:projectName'), async (request) => {
    const projectName = projectNameSchema.parse((request.params as { projectName: string }).projectName);
    return await manager.deleteProject(projectName);
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

  const publicRoot = env.publicStaticRoot;
  const previewRoot = env.publicStaticRoot;
  const clientDistRoot = resolve(process.cwd(), 'dist/client');
  const shipnowIndexApiBase = env.shipnowApiBaseUrl;

  async function serveRelease(prefix: string, rootDir: string, requestPath: string, reply: any, baseHref?: string): Promise<boolean> {
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
        await sendIndex(reply as any, indexFile, shipnowIndexApiBase, baseHref);
      } else {
        await sendFile(reply, indexFile);
      }
      return true;
    }
    return false;
  }

  async function serveShipNowApp(requestPath: string, reply: any): Promise<boolean> {
    if (!existsSync(clientDistRoot)) {
      return false;
    }

    if (!isAppPrefixRoot && (requestPath === `${appRootRoute}/api` || requestPath.startsWith(`${appRootRoute}/api/`))) {
      return false;
    }

    const prefixMatch = isAppPrefixRoot
      ? !requestPath.startsWith('/preview/') && !requestPath.startsWith('/site/') && !requestPath.startsWith(apiRoutePrefix)
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
      await sendIndex(reply as any, indexFile, shipnowIndexApiBase);
      return true;
    }
    return false;
  }

  async function servePreviewOrPublic(requestPath: string, reply: any): Promise<boolean> {
    const previewPrefix = '/preview/';
    const sitePrefix = '/site/';
    if (requestPath.startsWith(previewPrefix)) {
      const projectName = requestPath.slice(previewPrefix.length).split('/')[0];
      const projectRoot = resolve(previewRoot, projectName, 'preview');
      const rest = requestPath.slice((previewPrefix + projectName).length);
      return await serveRelease(`/preview/${projectName}`, projectRoot, rest, reply, `/preview/${projectName}/`);
    }
    if (requestPath.startsWith(sitePrefix)) {
      const projectName = requestPath.slice(sitePrefix.length).split('/')[0];
      const projectRoot = resolve(publicRoot, projectName);
      const rest = requestPath.slice((sitePrefix + projectName).length);
      return await serveRelease(`/site/${projectName}`, projectRoot, rest, reply, `/site/${projectName}/`);
    }

    const rootSegments = requestPath.replace(/^\/+/, '').split('/').filter(Boolean);
    if (rootSegments.length > 0) {
      const projectName = rootSegments[0];
      const parsed = projectNameSchema.safeParse(projectName);
      if (parsed.success) {
        const projectRoot = resolve(publicRoot, parsed.data);
        const baseHref = `/${parsed.data}/`;
        if (await serveRelease(`/${parsed.data}`, projectRoot, requestPath, reply, baseHref)) {
          return true;
        }
      }
    }
    return false;
  }

  app.get('/preview/:projectName/*', async (request, reply) => {
    const { projectName } = request.params as { projectName: string };
    const safeName = projectNameSchema.parse(projectName);
    const projectRoot = resolve(previewRoot, safeName, 'preview');
    const rest = request.url.slice(`/preview/${safeName}`.length);
    if (!(await serveRelease(`/preview/${safeName}`, projectRoot, rest, reply, `/preview/${safeName}/`))) {
      reply.code(404).send('Preview not found.');
    }
  });

  app.get('/preview/:projectName', async (request, reply) => {
    const { projectName } = request.params as { projectName: string };
    const safeName = projectNameSchema.parse(projectName);
    const projectRoot = resolve(previewRoot, safeName, 'preview');
    if (!(await serveRelease(`/preview/${safeName}`, projectRoot, '', reply, `/preview/${safeName}/`))) {
      reply.code(404).send('Preview not found.');
    }
  });

  app.get('/site/:projectName/*', async (request, reply) => {
    const { projectName } = request.params as { projectName: string };
    const safeName = projectNameSchema.parse(projectName);
    const projectRoot = resolve(publicRoot, safeName);
    const rest = request.url.slice(`/site/${safeName}`.length);
    if (!(await serveRelease(`/site/${safeName}`, projectRoot, rest, reply, `/site/${safeName}/`))) {
      reply.code(404).send('Site not found.');
    }
  });

  app.get('/site/:projectName', async (request, reply) => {
    const { projectName } = request.params as { projectName: string };
    const safeName = projectNameSchema.parse(projectName);
    const projectRoot = resolve(publicRoot, safeName);
    if (!(await serveRelease(`/site/${safeName}`, projectRoot, '', reply, `/site/${safeName}/`))) {
      reply.code(404).send('Site not found.');
    }
  });

  app.get(appRootRoute, async (_request, reply) => {
    const indexFile = await findIndexFile(clientDistRoot);
    if (indexFile) {
      await sendIndex(reply as any, indexFile, shipnowIndexApiBase);
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

  app.setNotFoundHandler(async (request, reply) => {
    const requestPath = request.url.split('?')[0];
    if (await servePreviewOrPublic(requestPath, reply)) {
      return;
    }
    if (requestPath.startsWith(apiRoutePrefix)) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }
    if (await serveShipNowApp(requestPath, reply)) {
      return;
    }
    reply.code(404).send({ error: 'Not found' });
  });

  return app;
}
