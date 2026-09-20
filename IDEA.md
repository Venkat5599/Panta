# PREMIUM — the idea

> Panta API Sidetrack, Colosseum Crypto World's Fair. $5,000 USDG pool (1st 2000, 2nd–4th 1000 each).
> Companions: [PREMIUM.md](./PREMIUM.md) (frozen spec), [PRD.md](./PRD.md), [ARCHITECTURE.md](./ARCHITECTURE.md).
> Parent project: [../IDEA.md](../IDEA.md) — RIPCORD.

---

## Read this before anything else

**Panta is not a second hackathon. It is a sidetrack of the same Colosseum Crypto World's Fair, judged on the same submission.**

Colosseum's rules are **one product submission per team or individual**. So a second, unrelated project is not a second entry — it is a fork in your team's effort three weeks before a deadline, and it costs you the main pool ($30k grand, 20 × $15k, Solana track $100k) to chase $2,000.

The sidetracks are **additive on one submission**. Prior editions produced builders who won five sidetracks simultaneously with a single project. So the question is not *"what second thing do we build"* — it is **"what single thing wins RPC Fast and Panta at once, without weakening either?"**

This document answers that. A standalone fallback is in §9, for the only case where it makes sense: you field a genuinely separate second team.

## Where this sits

**PREMIUM is a consequence of RIPCORD's primitive, not a co-equal half.**

The invention is [intent-triggered defence](../IDEA.md) — a trigger that fires on a pending transaction's simulated effect rather than on price. Once you can detect risk events **deterministically and before they complete**, two things follow:

1. You can act on them → RIPCORD.
2. You can **price** them → PREMIUM.

The second only exists because the first does. A market on "will this protocol suffer a cascade" needs a settlement source nobody can argue with, and a deterministic detector is exactly that. **Pitch the trigger first, always. PREMIUM is what the trigger makes possible, and it is how the business earns.**

## The one line

# Insurance you can buy in one click, priced by a market instead of an actuary.

RIPCORD is the airbag. **PREMIUM is the price of the airbag** — and the two words mean the same thing on purpose.

## The structural constraint

**Nobody can price DeFi protocol risk.**

Today the risk that a Solana protocol loses your money is priced by three things, none of which is a price: an audit firm's reputation, how long the code has been live, and vibes. That is why:

- DeFi insurance barely exists, and where it does, premiums are set by committee rather than by market.
- Lending LTVs and treasury allocation limits are set by governance argument, not by a number anyone is willing to trade against.
- A depositor who is *worried* about a protocol has exactly one expression available: withdraw entirely. There is no way to stay in and hedge.

Compare TradFi: credit default swaps made credit risk continuously priced and publicly visible, and that price became an input to everything downstream. DeFi has no equivalent. **Protocol risk is the largest unpriced exposure in crypto.**

That is a structural constraint, not a cosmetic one. Remove it and a category of products becomes possible: underwritable insurance, risk-adjusted lending parameters, mandate-compliant allocation, and a public risk signal any protocol can consume.

## Why prediction-market infrastructure makes this possible in the first place

This is the question the sidetrack explicitly asks, so answer it precisely.

| Panta property | Why PREMIUM needs it |
|---|---|
| **Permissionless creation** | We programmatically open one market per protocol per epoch. No listing committee, no approval loop — otherwise this is a centralised insurance product wearing a market costume |
| **Bonding-curve pricing** | **The one that matters.** No counterparty needed to take a position. A tail-risk market ("will protocol X suffer a loss event") has no natural seller on day one — an order book would sit empty forever. A bonding curve means the first buyer can transact against the curve immediately |
| **Creator fee share** | Our revenue line, claimable on-chain via the API. We are not extracting a spread; we earn on activity we originate |
| **Trade attribution** | Turns "did anyone use this" into a verifiable number — which is both a judging criterion and our own primary metric |
| **USDC collateral** | Premiums and payouts are in the asset depositors already hold |

Remove Panta and there is no market, no price, and no payout rail — just another risk dashboard with an opinion on it.

## The insight

Prediction markets get pitched as gambling. **Attach one to an exposure the buyer actually holds and it stops being a bet and becomes a hedge.**

A depositor with $50,000 in a lending market buys YES on "this protocol suffers a loss event this quarter." If nothing happens, they lose a small premium — the cost of sleeping. If something happens, the position pays while their deposit burns. That is insurance, assembled out of a prediction market, with no underwriter, no claims adjuster and no KYC.

The same instrument read from the other side is a **public risk price** — the market-implied probability that a given protocol fails, updating continuously, that anything downstream can consume.

One instrument, two products, and the second one is infrastructure.

## The flywheel with RIPCORD

This is why the combined submission is stronger than either half, and it is the part to say out loud to judges.

```
RIPCORD fires on a real risk event
        |
        v
Proof-of-Exit receipt: on-chain, timestamped, deterministic evidence
        |
        v
PREMIUM market RESOLVES against that receipt   <- solves Panta's undocumented
        |                                          resolution problem
        v
Continuous market-implied risk price per protocol
        |
        v
Prices RIPCORD premiums + tunes policy thresholds
        |
        v
More RIPCORD users -> more real triggers -> better resolution data
```

**Panta's documentation does not specify who resolves a market or how.** That is the single biggest hole in the API surface — and it is exactly the hole RIPCORD's receipts fill. A market that resolves against a deterministic on-chain artifact rather than a human adjudicator is a materially better market, and we are one of very few teams in this sidetrack who arrive holding that artifact.

**Verify this before building.** If Panta resolution turns out to be creator-controlled or oracle-gated in a way that blocks external evidence, the architecture changes. See [ARCHITECTURE.md §7](./ARCHITECTURE.md).

## Why this is not the crowded idea

Prediction markets are the most saturated category at Colosseum. From the corpus: **Capitola** (meta-aggregator, 1st Consumer, Cypherpunk, accelerator C4), **Senthos** (structured products on prediction markets, Frontier winner), **Bench**, **Fora**, **Memetic Machines** (geopolitical event markets), **Mentioned** (betting on word choice in media), **prediction.live** (live esports). Plus the live competitive field: **World** launched inside Phantom wallet in July 2026, plus Polymarket and Kalshi.

Every one of those is a **destination** — a place you go to trade opinions. The winners among them won by being structurally novel on top of the category (Capitola aggregated it; Senthos built derivatives on it), not by being a nicer venue.

PREMIUM is not a destination. **The end user never browses markets.** They see a single price next to their own deposit — *"protect this position: 1.9% for 90 days"* — and click once. The prediction market is plumbing they never see, which is precisely the brief Panta wrote: *"what prediction markets can become when they are built into products beyond a traditional prediction market platform."*

## Honest objections, answered before a judge raises them

**"This is gambling on disaster."** Only if the buyer has no exposure. Ours are hedging a position they already hold — the same logic that makes a CDS a risk-management tool rather than a wager. Product surface reinforces this: we sell *protection for your position*, never *bets on a hack*.

**"Moral hazard — someone buys YES then causes the exploit."** Real, and bounded: market size caps the payoff, and an attacker capable of draining $285M is not motivated by a four-figure market position. Mitigations in [ARCHITECTURE.md §8](./ARCHITECTURE.md): per-market position caps, a delay between opening a position and eligibility, and public positions so an unusual buyer is visible before the event rather than after.

**"Protocols will hate having a public 'will you fail' price."** Some will. The framing that defuses it: a low price is a **public vote of confidence**, and protocols with strong security posture benefit from a visible cheap premium. This is the same objection CDS markets faced, and the answer is the same — the price exists whether or not it is visible, and visibility is better.

**"Tail markets are illiquid."** True, and the bonding curve is the specific reason this is viable at all. Still the second-biggest risk after resolution. Mitigation is narrow scope: a small number of high-TVL protocols, quarterly epochs, rather than a long tail of thin markets.

## Where it goes

A continuously-priced, public risk curve for every major DeFi protocol — the credit-spread equivalent for on-chain risk. Consumed by lending protocols to set LTVs, by treasuries to set allocation caps, by RIPCORD to price protection, and by any user who wants to know what the market thinks of the thing holding their money.

## §9 — The standalone fallback

Only if you field a genuinely separate second team.

**ATTESTED** — a creator-side tool where any account with an audience programmatically opens a market on their own public claim ("I will ship X by date D"), and settles it from a verifiable artifact. Panta's creator fee share means the creator earns from their own accountability; permissionless creation means no listing gate; attribution proves the volume.

It fits the brief and it is cheap to build. It is also thinner: it has no structural constraint behind it, competes directly with the creator-markets bucket Panta explicitly named (so expect company), and does not compound with anything else you are building. Scored on the seven winner patterns it lands around a 6, against PREMIUM's 8.

**Recommendation: do not split the team. Build PREMIUM as one submission with RIPCORD.**
