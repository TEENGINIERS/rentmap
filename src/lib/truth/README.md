# Truth signals — v1 → v2 evolution

The two functions in this directory compute the badges that make Rentmap not-an-aggregator:

| File | v1 behavior | v2 behavior |
|---|---|---|
| `price-anomaly.ts` | Compare rent to nightly-refreshed locality median; ±15% is `fair`, else `over`/`under`/`unknown` (<5 samples) | Replace constant threshold with per-locality p25/p75 from `locality_price_stats`. Same inputs, same output shape. |
| `source-label.ts` | Pass `source_label` column through a 3-way switch. Column is hand-labeled in seed JSON. | `source_label` is written by a detector (phone-frequency + posting-pattern classifier). `source_confidence` is consulted: below 0.7 coerces to `unknown`. **UI, API, and callers change zero lines.** |

Key property: both functions are **pure**. The input DTO (rent, median, sample size, label, confidence) comes from the DB query layer. If we change the rule, we change it once, here, and redeploy — no migrations, no API version bump, no client release.

## Threshold calibration (v2 homework)

v1 picks 15% as "noticeably off" based on priors. v2 should learn it per-locality. Sketch:

```
// Pseudocode for v2
if (rent > p75) → over
if (rent < p25) → under
else → fair
```

p25/p75 are already in `locality_price_stats`. A PR that swaps the body is ~20 lines. Do not add config flags for this transition — ship one way, measure, iterate.

## Owner-vs-broker detector (v2 homework)

Signals that will feed the detector:
1. Phone frequency: hash of normalized phone appears on N listings across M platforms in the last 30 days. Strongest signal.
2. Posting cadence: accounts posting >2/week are almost never owners.
3. Title boilerplate: "No brokerage, owner direct" is high-precision for `owner` on 99acres.
4. Reverse-image search: listing photos appearing on 3+ sources → probably broker.

Precision floor before shipping: 90% on `broker` label (business plan §6.2 assumption #3). Until then, hand-labels beat detector output.
