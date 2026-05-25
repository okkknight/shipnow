import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface RunCommandOptions {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  onStdout?: (chunk: string) => void | Promise<void>;
  onStderr?: (chunk: string) => void | Promise<void>;
}

export interface RunCommandResult {
  code: number;
  signal: NodeJS.Signals | null;
}

async function ensureParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function runCommand(options: RunCommandOptions): Promise<RunCommandResult> {
  await ensureParent(options.cwd);
  return await new Promise<RunCommandResult>((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5_000);
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
