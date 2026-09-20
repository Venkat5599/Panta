# PREMIUM — production stack + build plan

## Context

PREMIUM sells **parametric protection on onchain risk**: weekly, two-sided, mechanically-resolved
markets on Panta. A Kamino borrower buys YES to hedge a liquidation cascade. A yield-seeker sells
into NO to underwrite a calm week and collect the premium. At epoch end the market settles against a
deterministic onchain metric that anyone can recompute.

Nothing is built. The four spec docs (`IDEA.md`, `PRD.md`, `ARCHITECTURE.md`, `PREMIUM.md`) are
frozen and complete; this plan turns them into a stack and a build order.

**Two facts changed the design since the docs were frozen:**

1. **PREMIUM ships standalone**, not as a layer on RIPCORD. Consequence: there is no shared
   TxStream/Yellowstone pipeline to borrow. That is a *simplification* — the resolution metric is a
   historical count over a finalized slot range, which is plain RPC. **No gRPC, no Aperture
   dependency, no external blocker.** This repo can be built start to finish today.
2. **Panta's official docs say "quote YES/NO fills on the bonding curve."** That settles the
   ⚠️ UNRESOLVED block in `PREMIUM.md` §3b in our favour: payout is known at purchase, not
   parimutuel. Confirm in `#dev-chat`, but design for a bonding curve.

**Intended outcome:** a factory that has been opening and resolving real weekly markets unattended
since week one, with attributed USDC volume provable through Panta's own endpoint.

---

## Stack

| Layer | Choice | Why this one |
|---|---|---|
| Runtime | **Bun 1.2**, TypeScript strict | Mandated. No gRPC in this repo, so the one Bun compat risk is gone |
| Repo | Single Bun-workspace monorepo, standalone from RIPCORD | Per your call. Shares nothing with RIPCORD |
| Chain | `@solana/web3.js` v1.98, `@solana/spl-token`, `@coral-xyz/anchor` 0.31 | v1 not v2/kit — wallet-adapter and Anchor are still v1-centric; v2 costs days |
| Kamino decode | `@kamino-finance/klend-sdk` | Reserve/obligation decoding and liquidation instruction shapes, already solved |
| RPC | **Helius**, behind a single `RPC_URL` | Historical `getSignaturesForAddress`/`getTransaction` over bounded windows is the whole resolution engine. No provider-specific calls, so swapping to RPC Fast Focus (free for Colosseum entrants) is an env change — but RPC Fast's edge is gRPC, which PREMIUM does not use |
| DB | **Turso (libSQL)** + Drizzle ORM | Embedded replica on the VPS for local-speed writes, remote reads from Vercel |
| Factory host | **Own VPS** (Hetzner/DO) + systemd `Restart=always` | Crash-only supervision, per `ARCHITECTURE.md` §5 |
| Web | **Next.js 15** App Router, React 19, Tailwind v4, Motion, on Vercel | API routes give the embeddable risk-price endpoint edge caching |
| Wallet | `@solana/wallet-adapter-react` + Phantom/Solflare/Backpack | |
| Watchdog | **Cloudflare Worker + Cron Trigger** → Telegram Bot API | Deliberately a *different provider*. A VPS-wide outage must not silence the alarm |
| Validation | Zod v4 on every Panta boundary | |
| Tests | `bun:test` | |
| CI | GitHub Actions: typecheck, test, deploy | Doubles as a free third watchdog layer |

### Repo shape

```
premium/
  apps/
    factory/          # long-running: scheduler + indexer + resolution engine
    web/              # Next.js 15
    watchdog/         # Cloudflare Worker (separate deploy)
  packages/
    panta/            # typed Panta client, branded amounts, zod schemas
    indexer/          # Kamino liquidation decoder + USD valuation
    db/               # drizzle schema + migrations
    core/             # epoch math, config, logger
  ops/
    systemd/premium-factory.service
    deploy.sh
  tasks/
    todo.md           # living checklist
    lessons.md        # correction log
```

---

## The four decisions that carry the build

### 1. Branded amount types — kill the named bug at compile time

`ARCHITECTURE.md` §7 calls the base-units/decimal-string mix "the most likely silent bug in the
integration." Do not solve it with care. Solve it with the type system.

```ts
// packages/panta/src/amounts.ts
declare const brand: unique symbol;
export type BaseUnits    = string & { readonly [brand]: 'BaseUnits' };    // "50000000"
export type DecimalAmount = string & { readonly [brand]: 'DecimalAmount' }; // "20.00"

export const toBaseUnits = (usdc: number): BaseUnits => ...
export const toDecimal   = (usdc: number): DecimalAmount => ...
```

Creation-fee fields accept only `BaseUnits`; primary-buy fields accept only `DecimalAmount`. Mixing
them stops compiling. No runtime discipline required.

### 2. Deterministic USD — pin the price once per epoch

The metric is liquidated collateral in USD, but a USD figure needs a price, and a price fetched
per-liquidation is neither deterministic nor recomputable by a stranger.

**Decision: pin one price snapshot per epoch, published at market open.**

```
liquidated_usd = Σ(collateral_token_units) × pinned_price(token, epoch_start_slot)
```

Pinned from Pyth at the epoch's start slot and written into the methodology before the epoch opens.
Deterministic, legible to a user, and a third party with an RPC endpoint recomputes it exactly —
which is the `ARCHITECTURE.md` §3 invariant, intact. Token-unit-only metrics are more deterministic
still but read badly to a judge; per-liquidation spot pricing is unrecomputable. This is the middle
that keeps both properties.

### 3. Crash-only, state-free, catch-up on boot

No local state file is authoritative. On boot the factory reconciles: read the epoch schedule, read
`GET /markets/`, diff, backfill anything missed, then tick. Market slug is deterministic per
`(protocol, epoch)` so creating twice is a no-op. systemd restarts on death; the process needs no
graceful-shutdown path to get wrong.

### 4. The watchdog is not on the VPS

A Cloudflare Worker on a cron trigger checks two things: is the VPS heartbeat fresh, and does the
current epoch's market exist in `GET /markets/`. Either fails → Telegram push to your phone. Built
in the same session as the factory, not after.

---

## Build order

Day numbers are from today (20 Sep), against the 12 Oct deadline.

| Day | Work | Gate |
|---|---|---|
| **0** | **API spike.** Register, mint `pk_test_` key, dump real request/response schemas for quote/build/register. Confirm the `oracle` field accepts our methodology URL as resolution source. Ask `#dev-chat` the two TODO.md questions. Fund the hot wallet for **all** epochs | Real schemas committed to `packages/panta/schemas/` |
| **1** | Scaffold monorepo, `packages/core` epoch math, `packages/db` schema + migrations, Turso provisioned | `bun test` green |
| **2** | `packages/panta` client: auth, quote, build, register, trade, positions, claims, creator fees. Zod on every boundary, branded amounts | Client unit tests against recorded fixtures |
| **3** | `packages/indexer`: Kamino liquidation decoder, pinned-price valuation, backfill a past week to sanity-check the metric | A real number for a real past week |
| **4** | `apps/factory`: scheduler, idempotent creation, seed liquidity, catch-up-on-boot. **`apps/watchdog` same day.** Deploy to VPS, systemd | B1, B2, B10, B11 |
| **5** | Publish methodology page + first epoch opens. **Then leave it running** | First market live on mainnet |
| 6–11 | Resolution engine: epoch-end metric at `finalized`, evidence bundle, set resolution | First epoch resolves |
| 12–15 | `apps/web`: one-click **underwrite (NO)** — the yield side, where volume comes from. Attribution wired from the **first** trade | B5, B9 |
| 16–18 | Positions + claims view. Public risk price + embeddable endpoint. Creator-fee claim | B7, B8, B12 |
| 19–21 | Status page, evidence bundles, attribution report, Superteam Earn submission, demo rehearsal | B3, B4 |

**Day 4 is the hinge.** The factory's value compounds with wall-clock time — every day it runs is
another resolved epoch on the submission page. Ship it before any polish.

---

## Non-negotiables encoded in code, not in discipline

- **"Powered by Panta"** displayed wherever Panta functionality appears. Mandatory per their
  Terms of Use and the playground CONTRIBUTING. Not optional, and not in the spec docs — I found it
  in their repo. A submission that omits it is a rules violation.
- **X2 — a published slot range is never adjusted after the fact.** Enforced by writing the range to
  the DB at market open and having the resolver read it, never recompute it.
- **X3 — seeded liquidity is always labelled as ours** in the UI and in any reported figure.
- **X1 / hard rule** — a question a stranger with an RPC endpoint cannot resolve does not ship.
- Signing key lives only on the VPS in a `600` EnvironmentFile. Never in the browser, never in git.
  Hot wallet funded with epoch budget only, to cap blast radius.

---

## Verification

**Per-gate, mapped to `PRD.md` §3 acceptance criteria:**

| Check | How |
|---|---|
| B1 market created programmatically | Market URL + creation signature on Solscan |
| B2 idempotency | Run factory twice on same `(protocol, epoch)`; assert one market, second call a no-op |
| B4 third-party recomputation | Hand the published methodology to a fresh script with only a Helius key; totals must match the evidence bundle byte for byte |
| B5 underwrite end-to-end | Real USDC on mainnet, transaction signature |
| B10 watchdog fires | Induced failure: stop the factory, confirm Telegram push within the grace window |
| B11 cold restart | `systemctl kill` mid-epoch; on restart assert the missed epoch is backfilled |
| Amount formats | Type-level: assert mixing `BaseUnits` and `DecimalAmount` fails `tsc` |

**End-to-end rehearsal before submission:** open an epoch, trade both sides from a second wallet,
let it resolve, claim, claim creator fees, and pull the attributed volume back out of
`GET /trades/{signature}/`. Every number in the submission must come from that endpoint.

---

## Honest risks

- **Day-0 spike may contradict the design.** If `oracle` cannot carry our methodology, resolution
  falls back to Panta's AI agent reading our published page. The invariant still holds — an agent
  doing arithmetic against a published threshold — but the copy changes. Nothing downstream moves.
- **Bonding curve is inferred from one doc line.** Confirm in `#dev-chat` before the pitch claims it.
- **Solo effort split.** `TODO.md` cuts PREMIUM to the factory alone and gates the UI on RIPCORD
  demoing. This plan builds the UI on days 12–18. If RIPCORD is also live, that window is contended
  and the UI is what gets cut — the factory plus a status page is still a real submission.
