# PREMIUM — build checklist

Plan: [`Plans/nested-pondering-giraffe.md`](../Plans/nested-pondering-giraffe.md)
Deadline: **12 Oct 2026**. Gates map to `PRD.md` §3 acceptance criteria.

---

## Day 0 — blocked on you, zero code

Nothing below Day 1 can be verified against the real API until these land.

- [ ] Register on Panta, mint a `pk_test_…` key, then a `pk_live_…`
- [ ] **Spike the real schemas.** Dump request/response for create quote → build → register.
      Confirm whether the `oracle` field accepts our methodology URL as the resolution source
- [ ] Ask `#dev-chat`:
  - [ ] *"Is the primary market parimutuel, a bonding curve, or dynamically priced with a
        secondary CLOB? Is my payout determined at purchase or at settlement?"*
        (docs say bonding curve — confirm before the pitch claims it)
  - [ ] *"Can the resolution source be a published methodology + on-chain metric I define at creation?"*
- [ ] Helius API key
- [ ] Turso database provisioned
- [ ] VPS provisioned (Hetzner/DO)
- [ ] Telegram bot token + chat id
- [ ] **Fund the factory hot wallet for every planned epoch.** Running out of USDC in week
      three is the dumbest available failure

## Day 1 — foundation ✅

- [x] Monorepo scaffold, Bun workspaces, git init
- [x] `tsconfig` strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- [x] `@premium/core` — `Result`, structured JSON logger
- [x] `@premium/core` — epoch math: genesis, indices, catch-up, slot ranges, deterministic slug (22 tests)
- [x] `@premium/panta` — branded `BaseUnits` / `DecimalAmount`, bigint-exact conversion (19 tests)
- [ ] `@premium/db` — drizzle schema + migrations
- [ ] CI: typecheck + test on push

## Day 2 — Panta client

- [ ] Auth: `POST /auth/register/`, `POST /auth/token/`, API-key headers
- [ ] Zod schemas on every boundary, **generated from the Day-0 spike, not from docs**
- [ ] Create: image upload → quote fee → build unsigned tx → sign → `POST /register`
- [ ] Trade: quote fill → build instructions → sign → submit/verify
- [ ] `GET /positions/`, `POST /claim/build/`, `POST /claim/creator-fees/build/`
- [ ] Attribution: `POST /trades/`, `GET /trades/{signature}/`
- [ ] Retry with backoff + idempotency on every write path

## Day 3 — indexer

- [ ] Kamino liquidation instruction decoder via `@kamino-finance/klend-sdk`
- [ ] Pinned-price valuation (one Pyth snapshot per epoch, published at open)
- [ ] Backfill a past week and sanity-check the total against a public source

## Day 4 — factory + watchdog, same session

- [ ] Scheduler, idempotent creation, catch-up on boot — **B1, B2, B11**
- [ ] Seed liquidity at open, labelled as ours — **X3**
- [ ] Watchdog on Cloudflare + Telegram push — **B10**
- [ ] systemd unit, `Restart=always`, deploy to VPS
- [ ] Induced-failure test: kill the factory, confirm the phone buzzes

## Day 5 — go live

- [ ] Publish the methodology page **before** the first epoch opens
- [ ] First market live on mainnet, **then leave it running**

## Days 6–11 — resolution

- [ ] Epoch-end metric at `finalized` (never `processed` — reorg safety)
- [ ] Evidence bundle: query, slot range, transaction list, total
- [ ] Third-party recomputation check — **B4**
- [ ] First epoch resolves — **B3**

## Days 12–18 — surface

- [ ] One-click **underwrite (NO)** — the yield side, where volume comes from — **B5**
- [ ] Attribution wired from the **first** trade, never retrofitted — **B9**
- [ ] Positions + claims — **B7**
- [ ] Public risk price, embeddable — **B12**
- [ ] Creator-fee claim — **B8**
- [ ] **"Powered by Panta"** wherever Panta functionality appears — mandatory, not optional

## Days 19–21 — submit

- [ ] Status page / proof of life
- [ ] Two resolved epochs with published evidence bundles — **B3**
- [ ] Attribution figures pulled from Panta's own endpoint — **X4**
- [ ] Submit on **Superteam Earn** (separate from any Colosseum entry)
- [ ] Demo rehearsal

---

## Invariants — never violated, enforced in code

- **X1** No market ships whose outcome needs private information. If a stranger with an RPC
  endpoint cannot resolve it, it does not ship
- **X2** A published slot range is never adjusted after the fact
- **X3** Seeded liquidity is always labelled as ours
- **X4** No metric reported as traction unless verifiable through Panta's attribution endpoint
