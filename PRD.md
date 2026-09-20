# PREMIUM — Product Requirements

> Companions: [IDEA.md](./IDEA.md), [PREMIUM.md](./PREMIUM.md), [ARCHITECTURE.md](./ARCHITECTURE.md). Parent: [../PRD.md](../PRD.md).

| | |
|---|---|
| **Track** | Panta API Sidetrack, Colosseum Crypto World's Fair |
| **Prize** | $5,000 USDG — 1st 2,000 · 2nd–4th 1,000 each |
| **Ships as** | A layer on the RIPCORD submission. **Not a separate entry** — Colosseum allows one product per team |
| **Deadline** | 12 Oct 2026 |

---

## 1. Users

**The borrower.** Has leverage on Kamino or Drift. Already afraid of liquidation cascades — 1,895 wallets were liquidated on Kamino in a single month. Wants to stay in the position and reduce the downside. Buys **YES**.

**The underwriter.** Yield-seeker. Thinks the coming week is calm. Sells into **NO** and earns the premium. **This is the volume side** — yield is a far easier sell than insurance, and every underwriter is the counterparty that makes a hedge cheap.

**The consumer of the price.** Lending protocols, treasuries, allocators, and RIPCORD itself. Reads the public risk number; never trades.

## 2. Scope

### In — MVP

| ID | Requirement |
|---|---|
| P1 | Market factory: one Panta market per protocol per **weekly** epoch, created programmatically, idempotent per `(protocol, epoch)` |
| P2 | Two protocols only: Kamino, Drift |
| P3 | Resolution engine: deterministic on-chain metric (liquidated collateral USD over a **pre-published** slot range), computed on the RIPCORD pipeline, at `finalized` |
| P4 | Published methodology + evidence bundle per epoch — query, slot range, transaction list, total |
| P5 | One-click **underwrite** (NO) — live APR, build tx, one signature |
| P6 | One-click **hedge** (YES) from a RIPCORD position — live premium %, build tx, one signature |
| P7 | Positions + claim eligibility + claim instruction building |
| P8 | Public risk price per protocol, embeddable endpoint |
| P9 | Creator-fee claim working on-chain |
| P10 | Trade attribution wired from the **first** trade |
| P11 | Seeded liquidity at market open, publicly labelled as ours |
| P12 | **External watchdog** + phone alert + public status page |

### Out

Market browsing UI, discovery feed, leaderboards, social layer, sports/elections/entertainment markets, long-tail protocols, anything resembling a destination.

### Never

A question that a stranger with an RPC endpoint cannot resolve independently. That is the invariant the whole design rests on — see [ARCHITECTURE.md §3](./ARCHITECTURE.md).

## 3. Acceptance criteria

| ID | Criterion | Probe |
|---|---|---|
| B1 | Market created programmatically on mainnet | market URL + creation signature |
| B2 | Creating the same `(protocol, epoch)` twice is a no-op | replay test |
| B3 | **At least two epochs opened and resolved during the hackathon** | two evidence bundles, two settlement records |
| B4 | A third party can recompute an epoch's metric from the published methodology | independent recomputation matches |
| B5 | Underwrite (NO) flow completes end-to-end with real USDC | transaction signature |
| B6 | Hedge (YES) flow completes from a RIPCORD position | transaction signature |
| B7 | Claim builds and succeeds on a resolved market | claim signature |
| B8 | Creator fees claimed on-chain | signature + amount |
| B9 | Attributed volume reported via Panta's own endpoint | `GET /trades/{signature}/` responses |
| B10 | Watchdog fires when the factory misses an epoch | induced-failure test |
| B11 | Factory survives a cold restart and backfills a missed epoch | kill-and-restart test |
| B12 | Public risk price live and embeddable | URL |

**Anti-criteria:**

- **X1** No market may ship whose outcome depends on private or privileged information.
- **X2** A slot range, once published, is never adjusted after the fact. Adjusting it makes us the adjudicator the design removes.
- **X3** Seeded liquidity is always publicly labelled. Never presented as organic volume.
- **X4** No metric is reported as traction unless it is verifiable through Panta's attribution endpoint.

## 4. Metrics

**Primary:** attributed USDC volume through Panta; distinct wallets holding a position. Both verifiable by judges through Panta's own endpoint — we cannot inflate them.

**Secondary:** epochs resolved unattended; creator fees earned on-chain; live risk prices published; spread between published price and realised outcome.

**Not reported:** market count, page views, Discord members, waitlist.

## 5. Risks

| Risk | Status |
|---|---|
| Resolution mechanics undocumented | **Designed out** via the resolution-agnostic invariant. Day-zero Discord question confirms which branch is live |
| No resolution during judging | **Designed out.** Weekly epochs → 2–3 real settlements in-window |
| Low attributed volume | **Designed out.** NO-side yield is the volume driver; seeded liquidity from open |
| Moral hazard | **Heavily blunted.** Aggregate protocol-wide metric, position caps, eligibility delay, public positions. Residual bounded by caps |
| **Factory dies mid-hackathon** | **Now the top risk.** External watchdog, phone alert, crash-only restart, catch-up on boot, funded for all epochs on day one |
| Scope eats RIPCORD | Factory is day 4 and then unattended; UI work sits after RIPCORD's core |

## 6. Milestones

| Day | Deliverable | Gates |
|---|---|---|
| 0 | Discord resolution question; API key; wallet funded for **all** epochs | — |
| 4 | Factory + resolution engine + watchdog live | B1, B2, B10, B11 |
| 11–13 | Underwrite (NO) flow | B5 |
| 14–15 | Hedge (YES) flow from a RIPCORD position | B6 |
| 16–17 | Risk price, creator-fee claim | B8, B12 |
| 18–21 | Attribution report, status page, evidence bundles, rehearsal | B3, B4, B7, B9 |

## 7. Submission checklist

- [ ] Registered for Colosseum Crypto World's Fair
- [ ] Submitted through the official Colosseum platform (the RIPCORD submission)
- [ ] Submitted to the Panta Sidetrack on **Superteam Earn** — this does not replace the Colosseum entry
- [ ] Panta integration explained explicitly in the submission text
- [ ] Working demo, in English
- [ ] Attributed volume figures included, sourced from Panta's endpoint
- [ ] At least two resolved epochs with published evidence bundles
