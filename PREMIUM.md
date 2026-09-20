# PREMIUM

# Market-priced protection for onchain risk.

> **Not** "decentralized insurance" — that claim is legally loaded and factually wrong here. **Not** "AI insurance" — generic. **Not** "prediction markets for DeFi" — undersells it.
> What this actually is: **parametric protection**. The payout is triggered by a measured protocol metric, not by your individual loss. See §4a on basis risk — stating it plainly is what makes the product credible.

> Frozen spec — Panta API Sidetrack, Colosseum Crypto World's Fair.
> Prize pool $5,000 USDG: 1st 2,000 · 2nd–4th 1,000 each.
> **Ships as part of the RIPCORD submission, not as a separate entry.** See [IDEA.md](./IDEA.md).

---

## 1. One line

**PREMIUM is the price of the airbag.** RIPCORD gets your money out; PREMIUM tells you what that protection is worth and pays you if it fails.

Mechanically: **weekly, two-sided, mechanically-resolved risk markets** on Panta. Borrowers buy YES to hedge. Yield-seekers sell into NO to underwrite. Every market resolves at epoch end against a deterministic on-chain metric computed by the pipeline RIPCORD already runs.

**The user never sees a prediction market.** A borrower sees one line next to their own position — *"cover this week: 0.8%"* — and one button. A yield-seeker sees *"underwrite a calm week: 41% APR"* and one button.

### The three design decisions that make this work

**1. Weekly epochs, not quarterly.** A quarterly "will this protocol be exploited" market resolves in months, never during judging, and asks a depositor to insure against something they consider unlikely. A **weekly liquidation-cascade market** resolves every seven days, gives us **two to three real resolution cycles inside the hackathon window**, and asks about something borrowers actively fear right now. Kamino alone had **9,372 liquidation events across 1,895 wallets in a single month**. That is not a tail. It is a recurring event with a large, currently-frightened audience.

**2. Mechanical resolution, no adjudicator.** The market question is a number, not a judgement: *"will Kamino liquidate more than $X of collateral in the next 7 days?"* Resolution is a deterministic on-chain count. No oracle committee, no dispute window, no human. This removes the dependency on Panta's undocumented resolution mechanics — we publish the metric and the methodology up front, and anyone can recompute it.

**3. Two-sided, and the volume comes from the NO side.** Selling insurance to strangers in three weeks is hard. Selling **yield** is not. *"Earn premium for underwriting a calm week"* is a product crypto already understands and wants, and every NO buyer is the counterparty that makes a YES hedge cheap. The hedge side is the story; **the yield side is the volume.**

## 2. The problem

**Nobody can price DeFi protocol risk.** It is priced today by audit-firm reputation, code age, and vibes — none of which is a number anyone will trade against.

Consequences: DeFi insurance barely exists and is priced by committee; lending LTVs and treasury caps are set by governance argument; and a worried depositor has exactly one available action — withdraw everything. There is no way to stay in and hedge.

Credit default swaps made credit risk continuously priced and publicly visible, and that price became an input to everything downstream. On-chain risk has no equivalent. It is the largest unpriced exposure in crypto.

## 3. Why Panta specifically

| Panta capability | Load-bearing because |
|---|---|
| **Permissionless market creation** | We open markets programmatically, one per protocol per epoch. A listing committee would make this a centralised insurance product wearing a market costume |
| **Bonding-curve pricing** | **The decisive one.** No counterparty needed. A tail-risk market has no natural seller on day one; an order book would sit empty forever. The first buyer transacts against the curve immediately |
| **Creator fee share** (`claimCreatorFees`) | Revenue, claimed on-chain. We earn on activity we originate rather than skimming a spread |
| **Trade attribution** | Verifiable proof of volume driven — a judging criterion *and* our primary metric |
| **USDC collateral** | Premiums and payouts in the asset depositors already hold |

**Remove Panta and there is no market, no price and no payout rail** — only a risk dashboard with an opinion on it.

## 3b. Panta's actual mechanics — VERIFIED, and it changes the design

**FACT (verified 19 Sep 2026):** Panta resolves markets with an **AI Resolution Agent**. It takes the market question plus **the resolution source chosen at market creation**, searches it and relevant public information, and determines YES or NO. Then a **two-hour dispute window**: any trader in that market may challenge by posting a bond worth **1% of the market's total liquidity**. Correct dispute → bond returned. AI's decision stands → bond lost. Disputes are reviewed manually by the Panta Trading Team against publicly verifiable sources. Unchallenged, the AI's decision becomes final and **Solana smart contracts automatically distribute payouts**.

**This is better for us than no resolution system, and it directly supports the invariant.**

Our design principle — *every market question must be answerable by any stranger from public on-chain data* — is not a workaround for a missing feature. It is **how you make the AI agent reliable**. We set the resolution source at creation to our published metric and methodology:

```
Metric:     Kamino liquidation volume (USD)
Program:    KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD
Window:     slot A -> slot B  (published before the epoch opens)
Threshold:  $2,000,000
YES if metric >= threshold, NO otherwise
```

An agent resolving *that* is doing arithmetic, not judgement. And if it errs, the dispute path is cheap for us and expensive for a bad actor.

### ⚠️ UNRESOLVED — do not build until confirmed

**Sources disagree on Panta's market structure**, and the three possibilities have materially different hedging math:

| Claim | Source | Implication for protection |
|---|---|---|
| Bonding curve | earlier reading of the API overview ("quote fills on bonding curve") | First buyer transacts immediately; payout known at purchase |
| Dynamic primary starting 50/50 + secondary CLOB | third-party critique | Payout known at purchase; secondary liquidity available |
| **Parimutuel** pooled markets | third-party technical writeup | **You cannot know your payout when you buy** — it depends on the pool ratio at settlement |

**Parimutuel would add a second layer of basis risk on top of the parametric kind.** The product still works, but "buy $100 of protection, receive $X" becomes "receive a pro-rata share of the losing pool," which changes the UX copy and the honesty of the pitch.

**Day-zero question for `#dev-chat`, alongside the resolution question:** *"Is the primary market parimutuel, a bonding curve, or dynamically priced with a secondary CLOB? Is my payout determined at purchase or at settlement?"*

**Do not claim a market structure in the pitch until this is answered.** The defensible phrasing meanwhile: *"Panta gives PREMIUM an immediately tradable primary market and a complete lifecycle from creation through trading, resolution and claims."*

## 4. The insight

## 4a. Basis risk — say it out loud

**Buying YES is not insurance and we will not call it that.** The payout is triggered by a protocol-wide metric crossing a threshold, not by the buyer's individual loss. Three consequences, all stated in the product:

- A user can be liquidated while the protocol-wide metric stays under threshold → **protection pays nothing**.
- The metric can cross while a particular user is unharmed → **protection pays anyway**.
- Payout size is set by the market, not by the user's loss.

That is the definition of **parametric** cover, and it is how real catastrophe products work — CAT bonds, parametric crop and earthquake insurance. Naming it correctly makes the product *more* credible with a technical judge, not less, and it is the difference between a defensible claim and a regulatory one.

**Product copy rule:** "protection", "cover", "hedge". Never "insurance", never "guaranteed", never "you will be made whole".

Prediction markets read as gambling. **Attach one to an exposure the buyer actually holds and it becomes a hedge.**

$50,000 in a lending market, buy YES on "this protocol suffers a loss event this quarter." Nothing happens → you lose a small premium, the cost of sleeping. Something happens → the position pays while the deposit burns. Insurance, assembled from a prediction market, with no underwriter, no claims adjuster and no KYC.

Read from the other side, the same instrument is a **public risk price**. One instrument, two products, and the second one is infrastructure.

## 5. The flywheel — say this out loud to judges

```
RIPCORD fires on a real risk event
   -> Proof-of-Exit receipt (on-chain, timestamped, deterministic)
   -> PREMIUM market resolves against that receipt
   -> continuous market-implied risk price per protocol
   -> prices RIPCORD protection + tunes policy thresholds
   -> more RIPCORD users -> more real triggers -> better resolution data
```

**Panta's docs do not specify who resolves a market or how.** That is the largest hole in the API surface, and RIPCORD's receipts are exactly the artifact that fills it. A market resolving against a deterministic on-chain event rather than a human adjudicator is a materially better market — and almost nobody else in this sidetrack arrives holding that artifact.

⚠️ **Verify resolution mechanics before hour 24.** If resolution is creator-controlled or oracle-gated in a way that blocks external evidence, the architecture changes. See [ARCHITECTURE.md §7](./ARCHITECTURE.md).

## 6. MVP — nothing else

1. **Market factory** — programmatically create one Panta market per protocol per **weekly** epoch (quote fee → build unsigned tx → broadcast → register). Runs on a cron; by submission day it has opened and closed several generations unattended.
2. **Risk Market Factory, not one market type.** The engine reads protocol telemetry and generates markets per measurable risk class. MVP ships **two protocols × two risk classes**; the factory admits more without new code:

   | Risk class | Question form | Source metric |
   |---|---|---|
   | **Liquidation** | *Will Kamino liquidate > $2M collateral in 7 days?* | liquidation instruction volume |
   | **Utilization** | *Will USDC utilization on Kamino exceed 90% before Friday?* | reserve utilization ratio |
   | Oracle deviation *(stretch)* | *Will the SOL feed deviate > 2% for > 10 min?* | oracle account vs reference |
   | Bad debt *(stretch)* | *Will protocol bad debt exceed $500K this epoch?* | protocol accounting |

   **This is the reversal that makes the product work.** A normal prediction market asks *"what should people bet on?"* PREMIUM asks *"what risks already exist in this user's portfolio?"* and generates markets around them. Markets are derived from exposure, never invented for engagement.
3. **Resolution engine** — deterministic on-chain metric (liquidated collateral in USD over the epoch), computed from the **same TxStream/Yellowstone pipeline RIPCORD already runs**. Zero new infrastructure. Methodology published so anyone can recompute it.
4. **One-click hedge** (YES) from a RIPCORD position, and **one-click underwrite** (NO) for yield. Both: live price as a percentage, build transaction, one signature.
5. **Position + claim view** — wallet positions, claim eligibility, claim instructions for resolved markets.
6. **The risk price** — a single public number per protocol from the live curve, with an embeddable endpoint.
7. **Creator-fee claim** working on-chain.
8. **Attribution wired in** from the first trade, so every transaction we drive is provably ours.
9. **Seeded liquidity** — we place our own USDC on the curve at market open, labelled publicly as ours. Legitimate skin in the game, non-degenerate pricing from minute one, and attributed volume from the first block.

**Explicitly not building:** a prediction-market browsing UI, a market discovery feed, a leaderboard, a social layer, sports or election markets, or anything resembling a destination. The category is a graveyard — Capitola, Senthos, Bench, Fora, Memetic Machines, Mentioned, prediction.live — and World is live inside Phantom.

## 7. Demo — 60 seconds, bolted onto the RIPCORD demo

| Time | Beat |
|---|---|
| 0:00–0:10 | "Everything you just saw gets your money out. This part tells you what that's worth." |
| 0:10–0:20 | A real RIPCORD position. One line underneath: *protect this position — 1.9% for 90 days.* One button. |
| 0:20–0:32 | Click. Sign. **Real USDC, real Panta market, mainnet.** Position appears. Judge can verify the signature. |
| 0:32–0:45 | Flip to the risk price: a live, public, market-implied probability for each protocol. "Nobody has ever been able to see this number." |
| 0:45–0:60 | **Scroll back through the epochs that already resolved during the hackathon.** Real markets, real weeks, real liquidation counts, real payouts — not a staged trigger. "This has been running unattended since week one." |

## 8. Metrics

**Primary:** attributed USDC volume through Panta, and number of distinct wallets holding a hedge. Both verifiable through Panta's own attribution endpoint — we cannot fake them and judges can check them.

**Secondary:** creator fees earned on-chain; number of live risk prices published; spread between our published price and realised events.

**Not reporting:** market count (trivially inflatable), page views, waitlist.

## 9. Judging-criteria map

| Panta criterion | Our answer |
|---|---|
| Panta API integration | Creation, fee quotes, trading, positions, claims, creator fees, attribution — **seven surfaces**, and the product does not exist without any of them |
| Technical execution | Programmatic market factory, resolution bound to on-chain evidence, one-click hedge from an existing position |
| Product & UX | The user never sees a prediction market. One line, one button, one signature |
| Originality | Prediction markets as an insurance and risk-pricing primitive, not a venue. The resolution-from-on-chain-evidence mechanism is the novel part |
| Impact potential | A public risk curve for DeFi — consumable by lending protocols, treasuries and allocators |
| Traction | Attributed volume from day one, drawn from RIPCORD's existing cold-start cohort |

## 10. Risks

| Risk | Mitigation |
|---|---|
| **Resolution mechanics unknown** | **Largely designed out.** We resolve against a published deterministic on-chain metric, not an adjudicated judgement, so the worst case is creator-resolution with a public, recomputable justification. Still verify Panta's mechanics in the first 24 hours |
| **No resolution during judging** | **Designed out.** Weekly epochs mean two to three generations resolve inside the hackathon window, on real data, unattended |
| **Low attributed volume** | **Designed out.** The NO side is a yield product, which is a far easier sell than insurance; plus seeded liquidity from market open. Volume comes from underwriters, not from insurance buyers |
| **Moral hazard** — buy YES, cause the event | Much weaker now: the metric is aggregate liquidation volume across a whole protocol, which an individual cannot move cheaply. Plus per-market position caps, a delay before payout eligibility, and public positions |
| **Thin markets** | Bonding curve is why this is viable at all. Narrow scope: two protocols, weekly epochs, no long tail |
| **Protocols dislike a public failure price** | A low price is a public vote of confidence. Same objection CDS faced; the price exists whether or not it is visible |
| **Reads as gambling** | Never sell "bets on a hack". Always "protect this position", always attached to a real exposure |

## 11. Scope discipline

The weekly-epoch design **shrank this rather than grew it.** The resolution engine is a counter over the TxStream/Yellowstone pipeline RIPCORD already runs — no oracle, no adjudicator, no second data stack. What remains is the market factory, two buy flows and a claim flow, all thin API wrappers.

**Start the market factory early — day 4, not day 11.** It is the cheapest thing in the build and the only component whose value grows with wall-clock time: every day it runs unattended is another epoch of real resolved history on the submission page. Ship it before the polish, not after.

Ship order: RIPCORD core → **market factory + resolution engine (day 4, then leave it running)** → one-click underwrite (NO/yield) → one-click hedge (YES) → risk price → attribution.

If RIPCORD's core is shaky by day 14, still keep the factory running — it costs nothing once live and it is generating the traction evidence either way.
