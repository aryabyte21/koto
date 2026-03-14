import pc from "picocolors";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = process.env.KOTO_DEBUG ? "debug" : "info";
  }

  debug(msg: string): void {
    if (LEVEL_PRIORITY[this.level] > LEVEL_PRIORITY.debug) return;
    console.log(pc.gray(`[debug] ${msg}`));
  }

  info(msg: string): void {
    if (LEVEL_PRIORITY[this.level] > LEVEL_PRIORITY.info) return;
    console.log(pc.blue(`[info] ${msg}`));
  }

  warn(msg: string): void {
    if (LEVEL_PRIORITY[this.level] > LEVEL_PRIORITY.warn) return;
    console.warn(pc.yellow(`[warn] ${msg}`));
  }

  error(msg: string): void {
    console.error(pc.red(`[error] ${msg}`));
  }
}

export const logger = new Logger();
