type LogLevel = "info" | "warn" | "error";

class Logger {
  private formatMessage(level: LogLevel, message: string, meta?: unknown) {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
  }

  info(message: string, meta?: unknown) {
    console.log(this.formatMessage("info", message, meta));
  }

  warn(message: string, meta?: unknown) {
    console.warn(this.formatMessage("warn", message, meta));
  }

  error(message: string, meta?: unknown) {
    console.error(this.formatMessage("error", message, meta));
  }
}

export const logger = new Logger();
