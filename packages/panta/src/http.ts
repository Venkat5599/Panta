import type { Logger } from "@premium/core";
import type { z } from "zod";

/**
 * Transport for the Panta API.
 *
 * The factory runs unattended for three weeks, so every failure mode here has
 * to be a value the caller can act on rather than an exception that kills a
 * cron tick. Retries are opt-in per call, never blanket: replaying a trade
 * would spend real USDC twice.
 */

export class PantaError extends Error {
  constructor(
    message: string,
    readonly status: number | undefined,
    readonly path: string,
    readonly body?: unknown,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PantaError";
  }

  /** 5xx, 429 and transport faults are worth another attempt. 4xx are not. */
  get retryable(): boolean {
    if (this.status === undefined) return true; // network / timeout
    if (this.status === 429) return true;
    return this.status >= 500;
  }
}

/** A response that did not match its schema. Never retried — retrying a shape bug just wastes time. */
export class PantaSchemaError extends PantaError {
  constructor(path: string, readonly issues: z.ZodIssue[], body: unknown) {
    super(
      `Panta response did not match the expected schema at ${path}. ` +
        `This usually means the provisional schemas are out of date — re-run the spike.`,
      undefined,
      path,
      body,
    );
    this.name = "PantaSchemaError";
  }

  override get retryable(): boolean {
    return false;
  }
}

export interface PantaAuth {
  /** `pk_live_…` / `pk_test_…`, sent as X-Api-Key. */
  apiKey?: string;
  /** Bearer JWT, for endpoints that take user auth rather than an API key. */
  bearerToken?: string;
  /** X-User-Id, forwarded alongside the API key by the playground proxy. */
  userId?: string;
}

export interface PantaHttpOptions {
  baseUrl?: string;
  auth?: PantaAuth;
  logger?: Logger;
  /** Per-attempt timeout. The whole call may take longer across retries. */
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

interface RequestOptions<T> {
  method: "GET" | "POST" | "PATCH";
  path: string;
  /** JSON body, or FormData for image upload. */
  body?: unknown;
  schema?: z.ZodType<T>;
  query?: Record<string, string | number | undefined>;
  /**
   * Opt in to retries. Safe for reads and for writes made idempotent upstream
   * (market creation is keyed by a derived slug). Never set it on a trade.
   */
  retryable?: boolean;
  /** Override auth for this call — used by the auth endpoints themselves. */
  auth?: PantaAuth;
}

const DEFAULT_BASE_URL = "https://live-api.panta.market/api/v1";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Full jitter backoff. Without jitter, a factory and a watchdog that both
 * retry on the same schedule stay synchronised and hammer a recovering API
 * in lockstep.
 */
function backoffMs(attempt: number, retryAfter?: number): number {
  if (retryAfter !== undefined) return Math.min(retryAfter * 1000, 60_000);
  const ceiling = Math.min(1000 * 2 ** attempt, 30_000);
  return Math.random() * ceiling;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds;
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, (date - Date.now()) / 1000);
}

export class PantaHttp {
  private readonly baseUrl: string;
  private readonly auth: PantaAuth;
  private readonly logger: Logger | undefined;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PantaHttpOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.PANTA_API_BASE_URL ?? DEFAULT_BASE_URL)
      .replace(/\/+$/, "");
    this.auth = options.auth ?? {
      ...(process.env.PANTA_API_KEY ? { apiKey: process.env.PANTA_API_KEY } : {}),
      ...(process.env.PANTA_USER_ID ? { userId: process.env.PANTA_USER_ID } : {}),
    };
    this.logger = options.logger;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.maxRetries = options.maxRetries ?? 4;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(auth: PantaAuth, isFormData: boolean): Headers {
    const h = new Headers({ Accept: "application/json" });
    // FormData must set its own Content-Type, boundary included.
    if (!isFormData) h.set("Content-Type", "application/json");
    if (auth.apiKey) h.set("X-Api-Key", auth.apiKey);
    if (auth.userId) h.set("X-User-Id", auth.userId);
    if (auth.bearerToken) h.set("Authorization", `Bearer ${auth.bearerToken}`);
    return h;
  }

  private url(path: string, query?: RequestOptions<unknown>["query"]): string {
    const url = new URL(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    return url.toString();
  }

  async request<T>(options: RequestOptions<T>): Promise<T> {
    const { method, path, body, schema, query, retryable = false } = options;
    const auth = { ...this.auth, ...options.auth };
    const isFormData = body instanceof FormData;
    const url = this.url(path, query);
    const attempts = retryable ? this.maxRetries : 0;

    let lastError: PantaError | undefined;

    for (let attempt = 0; attempt <= attempts; attempt++) {
      if (attempt > 0) {
        const wait = backoffMs(attempt - 1);
        this.logger?.warn("retrying panta request", {
          path,
          attempt,
          waitMs: Math.round(wait),
          reason: lastError?.message,
        });
        await sleep(wait);
      }

      try {
        // AbortSignal.timeout gives a per-attempt deadline; a hung socket must
        // not stall a cron tick indefinitely.
        const response = await this.fetchImpl(url, {
          method,
          headers: this.headers(auth, isFormData),
          signal: AbortSignal.timeout(this.timeoutMs),
          ...(body !== undefined
            ? { body: isFormData ? body : JSON.stringify(body) }
            : {}),
        });

        const text = await response.text();
        let parsed: unknown;
        try {
          parsed = text.length > 0 ? JSON.parse(text) : null;
        } catch {
          parsed = text; // an HTML error page, say
        }

        if (!response.ok) {
          lastError = new PantaError(
            `Panta ${method} ${path} failed: ${response.status} ${response.statusText}`,
            response.status,
            path,
            parsed,
          );
          if (!lastError.retryable || attempt === attempts) throw lastError;
          const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
          if (retryAfter !== undefined) await sleep(backoffMs(attempt, retryAfter));
          continue;
        }

        if (!schema) return parsed as T;

        const result = schema.safeParse(parsed);
        if (!result.success) {
          // Loud and non-retryable: a shape mismatch means our schemas drifted
          // from the live API, and quietly coercing it would corrupt money.
          this.logger?.error("panta response failed validation", {
            path,
            issues: result.error.issues,
          });
          throw new PantaSchemaError(path, result.error.issues, parsed);
        }
        return result.data;
      } catch (cause) {
        if (cause instanceof PantaError) {
          lastError = cause;
          if (!cause.retryable || attempt === attempts) throw cause;
          continue;
        }
        // Network fault, DNS failure, abort. Retryable by nature.
        lastError = new PantaError(
          `Panta ${method} ${path} transport error: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
          undefined,
          path,
          undefined,
          { cause },
        );
        if (attempt === attempts) throw lastError;
      }
    }

    throw lastError ?? new PantaError(`Panta ${method} ${path} failed`, undefined, path);
  }

  get<T>(path: string, schema?: z.ZodType<T>, query?: RequestOptions<T>["query"]): Promise<T> {
    return this.request<T>({
      method: "GET",
      path,
      ...(schema ? { schema } : {}),
      ...(query ? { query } : {}),
      retryable: true,
    });
  }

  /** Writes default to no retry. Pass `retryable` only where a replay is safe. */
  post<T>(
    path: string,
    body?: unknown,
    schema?: z.ZodType<T>,
    opts: { retryable?: boolean; auth?: PantaAuth } = {},
  ): Promise<T> {
    return this.request<T>({
      method: "POST",
      path,
      ...(body !== undefined ? { body } : {}),
      ...(schema ? { schema } : {}),
      ...(opts.retryable !== undefined ? { retryable: opts.retryable } : {}),
      ...(opts.auth ? { auth: opts.auth } : {}),
    });
  }
}
