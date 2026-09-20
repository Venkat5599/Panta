# PREMIUM — Architecture

> How it is built, and how each of the three residual risks is engineered out.
> Companions: [IDEA.md](./IDEA.md), [PREMIUM.md](./PREMIUM.md), [PRD.md](./PRD.md). Parent: [../ARCHITECTURE.md](../ARCHITECTURE.md).

---

## 1. System

```
                    RIPCORD pipeline (already running)
                    TxStream + Yellowstone gRPC
                              |
                              v
                    Liquidation counter  <- ONE counter, no new data stack
                              |
          +-------------------+--------------------+
          v                                        v
   Market Factory (cron)                    Resolution Engine
   - quote creation fee                     - epoch-end metric
   - build unsigned tx                      - publish evidence bundle
   - sign, broadcast, register              - trigger claim eligibility
   - seed curve with own USDC
          |
          v
     Panta API  https://live-api.panta.market/api/v1
          |
   +------+---------------------------+
   v                                  v
 Borrower: "cover this week 0.8%"   Underwriter: "calm week, 41% APR"
   one click -> YES                   one click -> NO
                    |
                    v
          Positions / Claims / Creator fees / Attribution
```

**No second data stack.** The resolution metric is a counter over the same stream RIPCORD already consumes. That is the whole reason this is additive rather than a fork of the team.

## 2. Panta surface used

Verified against the public API overview and the [official playground](https://github.com/Kaito-HQ/panta-api-playground).

| Flow | Calls |
|---|---|
| Auth | `POST /auth/register/`, `POST /auth/token/` (Bearer JWT); `X-Api-Key` + `X-User-Id` headers |
| Create | image upload → quote fee → build unsigned tx → sign → `POST /register` |
| Trade | quote fill on bonding curve → build instructions → sign → submit/verify |
| Positions | `GET /positions/?wallet=` |
| Claims | `POST /claim/build/` |
| Revenue | `POST /claim/creator-fees/build/` |
| Attribution | `POST /trades/`, `GET /trades/{signature}/` |

Base URL `https://live-api.panta.market/api/v1`. Collateral **USDC**, 6 decimals. Creation amounts are integer strings in base units (`"50000000"` = 50 USDC); primary buys are human-readable decimal strings (`"20.00"`). **Do not mix those two formats** — it is the most likely silent bug in the integration.

## 3. RISK 1 — resolution mechanics are undocumented

**Finding, stated honestly: there is no resolve endpoint in Panta's public API surface.** The playground exercises create, trade, positions, claims and creator fees. Nothing settles an outcome. So we cannot know from documentation whether the creator resolves, Panta resolves, or an expiry settles automatically.

**This is not closable by reading. Two actions:**

- **Day zero:** ask in Panta's `#dev-chat` Discord, verbatim: *"Who resolves a market and how — creator, Panta, or automatic at expiry? Is there a resolution-source or criteria field set at creation? Is there a dispute window?"* Their developer support channel exists precisely for this.
- **Meanwhile, design so the answer does not matter.**

### The resolution-agnostic invariant

> **Every market question must be answerable by any third party, from public on-chain data, with no privileged information.**

Concretely: *"Will Kamino Lend liquidate more than $2,000,000 of collateral between slot A and slot B?"* — a number, a program ID, and two slots. We publish the methodology and the query before the epoch opens.

This makes all three branches work without redesign:

| If resolution is… | What happens |
|---|---|
| **Creator-controlled** | We resolve, and publish the evidence bundle — the query, the slot range, the transaction list, the total. Anyone can recompute it and check us |
| **Panta-controlled** | Panta's resolver settles it from the same public data. Our published methodology is a convenience, not a dependency |
| **Automatic at expiry** | Works unchanged |

**The invariant is the fix.** A market that only *we* can settle is a trust product. A market anyone can settle is infrastructure — and it happens to be immune to whichever branch turns out to be true.

**Hard rule:** if a question cannot be resolved by a stranger with an RPC endpoint, it does not ship.

## 4. RISK 2 — moral hazard

The concern: someone buys YES, then causes the event.

The weekly-cascade design already blunts this badly, and it is worth understanding why. The metric is **aggregate liquidated collateral across an entire protocol**. To move it you must move the price of SOL or induce a protocol-wide cascade — Kamino's October cascade needed a **14% SOL drawdown in under an hour** driven by tariff news. That is not purchasable with a four-figure market position.

Four hardening measures on top:

1. **Position caps per market per wallet.** The payoff ceiling stays far below the cost of manufacturing the event.
2. **Eligibility delay.** A position opened inside the final N slots of an epoch does not pay out for that epoch. Removes the buy-then-trigger race entirely.
3. **Public positions.** Panta positions are on-chain and readable via `GET /positions/`. We surface unusual concentration *before* settlement, not after — an attacker has to telegraph.
4. **Aggregate thresholds only.** Never a question about a single wallet, a single position, or a single transaction. Those are individually manipulable; protocol-wide totals are not.

**What remains:** a party who was going to cause a cascade anyway can profit from it. That is true of every insurance market ever built and is bounded by the caps. Say it plainly if asked rather than claiming immunity.

## 5. RISK 3 — the factory must survive three weeks

This is now the largest risk, because the entire traction story is *"it has been live since week one."* If the cron dies on day 9 and nobody notices, the best part of the pitch evaporates and we find out at judging.

**Design for unattended operation, not for a demo.**

| Property | Implementation |
|---|---|
| **Stateless and restartable** | All state lives on-chain and in Panta. A cold restart reconstructs from `GET /markets/` and the epoch schedule. No local state file is authoritative |
| **Idempotent creation** | Deterministic market slug per `(protocol, epoch)`. Creating twice is a no-op, so retries and double-fires are safe |
| **Crash-only** | No graceful-shutdown path to get wrong. Process dies → supervisor restarts → it re-derives what it should have done |
| **Catch-up on boot** | On start, compare expected epochs against existing markets and backfill any that were missed |
| **External watchdog** | A **separate** heartbeat, not in the same process. If no market has been created within an epoch window + grace, it alerts loudly. A watchdog inside the thing it is watching is decoration |
| **Alert to a phone** | Not a log line. Not an email. If the factory misses an epoch, somebody's phone buzzes the same hour |
| **Funded well ahead** | Creation fees plus seed liquidity for **all** planned epochs funded on day one. The dumbest possible failure is running out of USDC in week three |
| **Daily proof of life** | A public status page showing last market created, next scheduled, current epoch metric. Doubles as submission evidence |

**Build the watchdog in the same session as the factory.** Not after. A factory without a watchdog is a factory you will discover has been dead for six days.

## 6. Failure handling

| Failure | Handling |
|---|---|
| Panta API down at epoch boundary | Retry with backoff; catch-up on boot covers a missed window; watchdog alerts if the gap exceeds grace |
| Creation transaction fails to land | Idempotent retry with fresh blockhash; the slug guarantees no duplicate |
| Metric ambiguous at the boundary | Slot range is fixed **in advance** and published at market open. Never adjusted after the fact — that would make us the adjudicator we designed away |
| Chain reorg near epoch boundary | Metric computed at `finalized`, not `processed`. Latency is irrelevant here; correctness is not |
| Nobody trades a market | Seeded liquidity means the market is never empty; the epoch still resolves and still produces a published price |
| We are wrong about the metric | Publish the query and the raw transaction list. Being auditable beats being right |

## 7. Amount-format and integration gotchas

- Creation fee: **integer string, base units, 6 decimals**. Primary buy: **human-readable decimal string**. Mixing them is the likeliest silent bug.
- JWT in `localStorage` in the playground is a demo pattern. Server-side only for the factory's signing key.
- Attribution must be wired from the **first** trade. Retrofitting it later loses the volume history that is our primary metric.
- Playground defaults to `http://localhost:8000/api/v1`; production base is `https://live-api.panta.market/api/v1`.

## 8. Build order

| Day | Work | Why here |
|---|---|---|
| 0 | Discord question on resolution; API key; wallet funded for all epochs | Unblocks everything, costs nothing |
| 4 | **Market factory + resolution engine + watchdog, live** | Earliest possible. Value compounds with wall-clock time — every day it runs is another resolved epoch on the submission page |
| 5–10 | (RIPCORD core continues) | Factory runs unattended meanwhile |
| 11–13 | One-click underwrite (NO/yield) — the volume side | Easier sell, drives attributed volume |
| 14–15 | One-click hedge (YES) from a RIPCORD position | The story side |
| 16–17 | Public risk price + embeddable endpoint; creator-fee claim | |
| 18–21 | Attribution report, status page, demo rehearsal | |

**If RIPCORD's core slips, keep the factory running regardless.** Once live it costs nothing and it is generating the traction evidence either way.
