import { execFile, spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

export interface RunCommandOptions {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  onSpawn?: (pid: number) => void | Promise<void>;
  onStdout?: (chunk: string) => void | Promise<void>;
  onStderr?: (chunk: string) => void | Promise<void>;
}

export interface RunCommandResult {
  code: number;
  signal: NodeJS.Signals | null;
}

const execFileAsync = promisify(execFile);

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function listDescendants(pid: number): Promise<number[]> {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,ppid=']);
  const childrenByParent = new Map<number, number[]>();

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const [pidText, ppidText] = trimmed.split(/\s+/, 2);
    const childPid = Number(pidText);
    const parentPid = Number(ppidText);
    if (!Number.isFinite(childPid) || !Number.isFinite(parentPid)) {
      continue;
    }
    const siblings = childrenByParent.get(parentPid) ?? [];
    siblings.push(childPid);
    childrenByParent.set(parentPid, siblings);
  }

  const descendants: number[] = [];
  const stack = [pid];
  const visited = new Set<number>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const children = childrenByParent.get(current) ?? [];
    for (const childPid of children) {
      descendants.push(childPid);
      stack.push(childPid);
    }
  }

  return descendants.filter((childPid) => childPid !== pid).reverse();
}

async function signalProcessTree(pid: number, signal: NodeJS.Signals): Promise<void> {
  const descendants = await listDescendants(pid);
  for (const descendant of descendants) {
    try {
      process.kill(descendant, signal);
    } catch {
      // Ignore processes that already exited.
    }
  }

  try {
    process.kill(pid, signal);
  } catch {
    // Ignore processes that already exited.
  }
}

export async function killProcessTree(pid: number, graceMs = 5_000): Promise<void> {
  await signalProcessTree(pid, 'SIGTERM');
  await sleep(graceMs);
  await signalProcessTree(pid, 'SIGKILL');
}

async function ensureParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function runCommand(options: RunCommandOptions): Promise<RunCommandResult> {
  await ensureParent(options.cwd);
  return await new Promise<RunCommandResult>((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const pid = child.pid;
    if (!pid) {
      reject(new Error(`Failed to spawn command: ${options.command}`));
      return;
    }

    void options.onSpawn?.(pid);

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      void killProcessTree(pid);
    }, options.timeoutMs);

    let settled = false;

    const finish = (handler: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      handler();
    };

    child.stdout?.on('data', (chunk) => {
      void options.onStdout?.(chunk.toString());
    });

    child.stderr?.on('data', (chunk) => {
      void options.onStderr?.(chunk.toString());
    });

    child.on('error', (error) => {
      finish(() => reject(error));
    });

    child.on('close', (code, signal) => {
      if (timedOut) {
        finish(() => reject(new Error(`Command timed out after ${options.timeoutMs}ms: ${options.command}`)));
        return;
      }
      finish(() => resolve({ code: code ?? 1, signal }));
    });
  });
}

export async function writeCommandOutput(path: string, content: string): Promise<void> {
  await ensureParent(path);
  await writeFile(path, content, 'utf8');
}
