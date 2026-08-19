export class SerialRateLimiter {
  private nextAllowedAt = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly requestsPerMinute: number) {}

  async wait(): Promise<void> {
    const interval = Math.ceil(60_000 / this.requestsPerMinute);
    const task = this.queue.then(async () => {
      const now = Date.now();
      const waitMs = Math.max(0, this.nextAllowedAt - now);
      if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
      this.nextAllowedAt = Date.now() + interval;
    });
    this.queue = task.catch(() => undefined);
    await task;
  }
}
