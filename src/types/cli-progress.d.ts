declare module 'cli-progress' {
  interface Options {
    format?: string;
    barCompleteChar?: string;
    barIncompleteChar?: string;
    hideCursor?: boolean;
  }

  class SingleBar {
    constructor(options?: Options);
    start(total: number, startValue: number, payload?: Record<string, unknown>): void;
    update(value: number, payload?: Record<string, unknown>): void;
    stop(): void;
    isActive: boolean;
  }
}
