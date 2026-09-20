# Lessons

Patterns worth not repeating. Appended when something bites.

---

## `bun test` does not typecheck

**2026-09-20.** `formatUsdc` passed a branded `BaseUnits` string into a function
expecting `bigint`. `tsc` rejects it outright. Bun ran it anyway and the failure only
surfaced because a unit test happened to call that path.

Bun strips types; it never checks them. A module with no test coverage can carry a type
error indefinitely and look fine locally.

**Rule:** `bunx tsc --noEmit` runs alongside `bun test`, both locally and in CI. Green
tests alone are not evidence the code compiles.

## `tsc --build` leaves orphaned output that Bun then runs as tests

**2026-09-20.** An early `composite`/`outDir` config emitted `packages/*/dist/*.test.js`.
After switching to `noEmit`, those stale files stayed on disk and `bun test` picked them
up as real test files, failing on imports that no longer resolved.

**Rule:** this repo never emits. `tsc` is a checker only (`noEmit: true`). Bun is the
runtime. If `dist/` ever appears, something reintroduced emit — delete it and find out why.

## Branded types break `expect(...).toBe(literal)`

**2026-09-20.** `expect(toBaseUnits(50)).toBe("50000000")` does not compile: `toBe` infers
its expected type from the actual, so it demands a `BaseUnits`, not a string.

That strictness is the whole point of the brand, so the fix is to widen at the assertion
(`const s = (v: string): string => v`) rather than loosen the type.
