import { mkdir, readFile, readdir, rm, stat, symlink, rename, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import type { FastifyReply } from 'fastify';

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function ensureParent(path: string): Promise<void> {
  await ensureDir(dirname(path));
}

export async function removePath(path: string): Promise<void> {
  if (existsSync(path)) {
    await rm(path, { recursive: true, force: true });
  }
}

export async function copyDirectory(source: string, destination: string): Promise<void> {
  await ensureParent(destination);
  await rm(destination, { recursive: true, force: true });
  await import('node:fs/promises').then(({ cp }) =>
    cp(source, destination, { recursive: true, force: true, preserveTimestamps: true })
  );
}

export function timestampId(prefix = 'rel'): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}_${stamp}_${randomUUID().slice(0, 8)}`;
}

export async function atomicSymlink(target: string, linkPath: string): Promise<void> {
  const tempLink = `${linkPath}.tmp-${randomUUID()}`;
  await ensureParent(linkPath);
  await removePath(tempLink);
  await symlink(target, tempLink, 'dir');
  await rename(tempLink, linkPath);
}

export function isPathInside(base: string, candidate: string): boolean {
  const normalizedBase = resolve(base);
  const normalizedCandidate = resolve(candidate);
  return normalizedCandidate === normalizedBase || normalizedCandidate.startsWith(`${normalizedBase}/`);
}

export async function writeText(path: string, content: string): Promise<void> {
  await ensureParent(path);
  await writeFile(path, content, 'utf8');
}

export async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

export function contentTypeFor(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return map[ext] || 'application/octet-stream';
}

export async function sendFile(reply: FastifyReply, filePath: string): Promise<void> {
  reply.header('Content-Type', contentTypeFor(filePath));
  reply.header('Cache-Control', 'no-store');
  await reply.send(createReadStream(filePath));
}

export async function findStaticFile(root: string, requestPath: string): Promise<string | null> {
  const clean = requestPath.replace(/^\/+/, '');
  const safeSegments = clean.split('/').filter(Boolean);
  const candidate = resolve(root, ...safeSegments);
  if (!isPathInside(root, candidate)) {
    return null;
  }
  try {
    const fileStat = await stat(candidate);
    if (fileStat.isFile()) {
      return candidate;
    }
  } catch {
    return null;
  }
  return null;
}

export async function findIndexFile(root: string): Promise<string | null> {
  const candidate = join(root, 'index.html');
  try {
    const fileStat = await stat(candidate);
    if (fileStat.isFile()) {
      return candidate;
    }
  } catch {
    return null;
  }
  return null;
}

