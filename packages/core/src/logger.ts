/**
 * Structured JSON to stdout. systemd captures it into journald, so the factory
 * needs no log transport of its own and nothing to flush on crash.
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const serialise = (v: unknown): unknown =>
  v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v;

function emit(level: Level, scope: string, msg: string, fields?: Fields): void {
  const line: Record<string, unknown> = {
    t: new Date().toISOString(),
    level,
    scope,
    msg,
  };
  for (const [k, v] of Object.entries(fields ?? {})) line[k] = serialise(v);
  // Single write, single line: safe to interleave across concurrent tasks.
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  child(scope: string): Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, f) => emit("debug", scope, m, f),
    info: (m, f) => emit("info", scope, m, f),
    warn: (m, f) => emit("warn", scope, m, f),
    error: (m, f) => emit("error", scope, m, f),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}
