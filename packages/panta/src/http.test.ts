import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { PantaError, PantaHttp, PantaSchemaError } from "./http.ts";

/** A fetch stand-in that replays a queued script and records every call. */
function mockFetch(responses: Array<Response | Error>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  let i = 0;
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses[Math.min(i++, responses.length - 1)];
    if (next instanceof Error) throw next;
    return next!.clone();
  }) as unknown as typeof fetch;
  return { impl, calls, count: () => i };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const client = (impl: typeof fetch, maxRetries = 2) =>
  new PantaHttp({
    baseUrl: "https://api.test/v1",
    auth: { apiKey: "pk_test_abc", userId: "user-1" },
    fetchImpl: impl,
    maxRetries,
    timeoutMs: 1000,
  });

describe("auth headers", () => {
  test("sends the api key and user id", async () => {
    const m = mockFetch([json({ ok: true })]);
    await client(m.impl).get("/markets/");
    const headers = new Headers(m.calls[0]!.init!.headers);
    expect(headers.get("X-Api-Key")).toBe("pk_test_abc");
    expect(headers.get("X-User-Id")).toBe("user-1");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  test("sends a bearer token when one is supplied per call", async () => {
    const m = mockFetch([json({ ok: true })]);
    await client(m.impl).post("/account/keys/", { name: "x" }, undefined, {
      auth: { bearerToken: "jwt-123" },
    });
    expect(new Headers(m.calls[0]!.init!.headers).get("Authorization")).toBe("Bearer jwt-123");
  });

  test("lets FormData set its own content type and boundary", async () => {
    const m = mockFetch([json({ ok: true })]);
    const form = new FormData();
    form.set("image", "x");
    await client(m.impl).post("/upload/", form);
    expect(new Headers(m.calls[0]!.init!.headers).get("Content-Type")).toBeNull();
  });
});

describe("url building", () => {
  test("joins the base url and encodes query parameters", async () => {
    const m = mockFetch([json([])]);
    await client(m.impl).get("/positions/", undefined, { wallet: "abc", page: 2 });
    expect(m.calls[0]!.url).toBe("https://api.test/v1/positions/?wallet=abc&page=2");
  });

  test("omits undefined query parameters instead of sending 'undefined'", async () => {
    const m = mockFetch([json([])]);
    await client(m.impl).get("/positions/", undefined, { wallet: "abc", cursor: undefined });
    expect(m.calls[0]!.url).toBe("https://api.test/v1/positions/?wallet=abc");
  });
});

describe("retry policy", () => {
  test("retries a 500 and returns the eventual success", async () => {
    const m = mockFetch([json({ e: 1 }, 500), json({ e: 1 }, 500), json({ ok: true })]);
    const res = await client(m.impl).get("/markets/");
    expect(res).toEqual({ ok: true });
    expect(m.count()).toBe(3);
  });

  test("retries a 429", async () => {
    const m = mockFetch([json({}, 429), json({ ok: true })]);
    await client(m.impl).get("/markets/");
    expect(m.count()).toBe(2);
  });

  test("retries a transport failure", async () => {
    const m = mockFetch([new TypeError("network down"), json({ ok: true })]);
    await client(m.impl).get("/markets/");
    expect(m.count()).toBe(2);
  });

  test("does not retry a 400 — a bad request stays bad", async () => {
    const m = mockFetch([json({ detail: "bad" }, 400)]);
    await expect(client(m.impl).get("/markets/")).rejects.toThrow(PantaError);
    expect(m.count()).toBe(1);
  });

  test("does not retry a 401", async () => {
    const m = mockFetch([json({ detail: "unauthorized" }, 401)]);
    await expect(client(m.impl).get("/markets/")).rejects.toThrow(PantaError);
    expect(m.count()).toBe(1);
  });

  test("gives up after maxRetries and surfaces the last error", async () => {
    const m = mockFetch([json({}, 503)]);
    await expect(client(m.impl, 2).get("/markets/")).rejects.toThrow(PantaError);
    expect(m.count()).toBe(3); // initial + 2 retries
  });
});

describe("write safety", () => {
  test("a POST is not retried by default", async () => {
    // This is the property that protects real USDC: a blind replay of a trade
    // could spend twice, so writes opt in to retries rather than out.
    const m = mockFetch([json({}, 500)]);
    await expect(client(m.impl).post("/orders/submit/", { signature: "s" })).rejects.toThrow(
      PantaError,
    );
    expect(m.count()).toBe(1);
  });

  test("a POST retries only when explicitly marked safe", async () => {
    const m = mockFetch([json({}, 500), json({ ok: true })]);
    await client(m.impl).post("/trades/", { signature: "s" }, undefined, { retryable: true });
    expect(m.count()).toBe(2);
  });
});

describe("schema validation", () => {
  const Schema = z.object({ id: z.string() });

  test("returns parsed data on a match", async () => {
    const m = mockFetch([json({ id: "abc" })]);
    expect(await client(m.impl).get("/markets/1/", Schema)).toEqual({ id: "abc" });
  });

  test("throws PantaSchemaError on a mismatch", async () => {
    const m = mockFetch([json({ id: 42 })]);
    await expect(client(m.impl).get("/markets/1/", Schema)).rejects.toThrow(PantaSchemaError);
  });

  test("never retries a schema mismatch", async () => {
    // Retrying a shape bug just burns the rate limit; our schemas are wrong,
    // not the server.
    const m = mockFetch([json({ id: 42 })]);
    await expect(client(m.impl).get("/markets/1/", Schema)).rejects.toThrow(PantaSchemaError);
    expect(m.count()).toBe(1);
  });

  test("carries the offending body for debugging", async () => {
    const m = mockFetch([json({ id: 42 })]);
    try {
      await client(m.impl).get("/markets/1/", Schema);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PantaSchemaError);
      expect((e as PantaSchemaError).body).toEqual({ id: 42 });
      expect((e as PantaSchemaError).issues.length).toBeGreaterThan(0);
    }
  });
});

describe("error classification", () => {
  test("marks 5xx, 429 and transport faults retryable, 4xx not", () => {
    expect(new PantaError("x", 500, "/p").retryable).toBe(true);
    expect(new PantaError("x", 503, "/p").retryable).toBe(true);
    expect(new PantaError("x", 429, "/p").retryable).toBe(true);
    expect(new PantaError("x", undefined, "/p").retryable).toBe(true);
    expect(new PantaError("x", 400, "/p").retryable).toBe(false);
    expect(new PantaError("x", 404, "/p").retryable).toBe(false);
  });
});

describe("non-json responses", () => {
  test("surfaces an HTML error page without crashing the parser", async () => {
    const m = mockFetch([
      new Response("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
    ]);
    try {
      await client(m.impl, 0).get("/markets/");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PantaError);
      expect((e as PantaError).body).toContain("502");
    }
  });

  test("handles an empty body", async () => {
    const m = mockFetch([new Response(null, { status: 204 })]);
    expect(await client(m.impl).get("/markets/")).toBeNull();
  });
});
