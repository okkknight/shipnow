export interface TaskQueuePoolOptions<TTask> {
  concurrency: number;
  claimNextTask: () => Promise<TTask | null>;
  runTask: (task: TTask) => Promise<void>;
}

export class TaskQueuePool<TTask> {
  private started = false;

  private stopped = false;

  private wakeVersion = 0;

  private readonly workers: Promise<void>[] = [];

  private readonly wakeResolvers = new Set<() => void>();

  constructor(private readonly options: TaskQueuePoolOptions<TTask>) {}

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    for (let index = 0; index < this.options.concurrency; index += 1) {
      this.workers.push(this.workerLoop(index + 1));
    }
  }

  notify(): void {
    this.wakeVersion += 1;
    for (const resolve of this.wakeResolvers) {
      resolve();
    }
    this.wakeResolvers.clear();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.notify();
    await Promise.allSettled(this.workers);
  }

  private async waitForWork(): Promise<void> {
    if (this.stopped) {
      return;
    }

    const observedWakeVersion = this.wakeVersion;
    await new Promise<void>((resolve) => {
      if (this.stopped || this.wakeVersion !== observedWakeVersion) {
        resolve();
        return;
      }
      this.wakeResolvers.add(resolve);
    });
  }

  private async workerLoop(_workerId: number): Promise<void> {
    while (!this.stopped) {
      const task = await this.options.claimNextTask();
      if (!task) {
        await this.waitForWork();
        continue;
      }

      try {
        await this.options.runTask(task);
      } catch (error) {
        console.error('ShipNow task worker failed', error);
      }
    }
  }
}
