# Rentmap — Product Brief v0.1

**One line:** A truth-first rental map for Bangalore renters, built to evolve into the first tenant-side rental agent in India.

**Author's note:** This document was written after thirteen turns of ideation. The conclusions in it are not the first ones reached; they are the ones that survived the argument. Treat every section as provisional — this brief is a *starting position*, not a plan of record. Revisit in 30 days.

---

## 1. Why this, why now

### 1.1 The real pain, not the pitched one

Rental hunting in urban India is broken, but not in the way most people describe. The common framing is "listings are spread across too many sites." That's wrong. That's a surface problem. If you solve only that, you build another aggregator and die.

The actual pain, walked through honestly, is this:

1. **Listings lie.** Photos are wide-angle and staged. Rents are bait. Availability is stale. Owners are often brokers pretending to be owners. The same flat is posted five times at three prices.
2. **Every visit costs three hours of your life.** You drive 14km across Bangalore traffic to discover the water pressure is bad or the 4th floor has no lift.
3. **You cannot tell good flats from bad before visiting.** There is no reliable review layer for buildings or areas.
4. **Brokers are rent-seeking middlemen.** They charge one month's rent (₹30–50K) for labor that could and should be automated.
5. **Nobody tells you the truth about what you're signing up for** — lease terms, deposit math, maintenance reality, landlord temperament, building management quality, area livability.

A renter spends 4–8 weekends, 40+ hours, and ₹30–50K in brokerage to end up in a flat they picked under duress and often regret within three months. The cost of this process — in time, money, and stress — is on the order of ₹50,000+ per rental event. It is one of the most expensive workflows in urban Indian life.

**The market does not have a truth problem. It has a trust problem. And every existing platform is structurally incentivized to preserve it**, because owners pay the listing fees and brokers pay for leads.

### 1.2 Why no existing player fixes this

| Player | Why they won't fix it |
|---|---|
| 99acres, MagicBricks, Housing | Revenue model is listing fees from owners and leads sold to brokers. They cannot act against the interests of their paying customers. |
| NoBroker | Started promising, now derives significant revenue from owner-side services, home loans, moving, and interiors — tenant is the product, not the customer. |
| Nestaway, Zolo, Stanza | Coliving operators, not marketplaces. Limited scope, supply-side constrained, don't solve the general rental problem. |
| Facebook Groups, WhatsApp Broker Channels | Where real listings often sit, but zero verification, zero structure, zero trust. |
| Sulekha, OLX, Quikr | Declining quality, no serious investment, commodity listings. |

**The opening:** no one in the market is structurally on the tenant's side. That is the gap. That is the product.

### 1.3 Why this specific moment

Three tailwinds converge right now:

- **AI makes verification cheap.** Calling owners at scale, parsing lease agreements, detecting duplicates, scoring listings — all of these were manual labor five years ago. Today an LLM + a scrape pipeline + a phone API can do the work of a 20-person operations team.
- **Post-COVID flat hunting normalized digital-first.** Renters expect the visit to be the last step, not the first.
- **UPI + Aadhaar + digital rental agreements mean the whole transaction can be online.** The broker's one remaining job — being the trusted intermediary for payment and paperwork — is being unbundled by infrastructure.

Three years from now, someone will own the tenant-side rental experience in India. The question is whether it's you, or someone who notices six months later.

---

## 2. What we are building

### 2.1 The product, one paragraph

A mobile-first web app that maps every rental listing in Bangalore from every public source (99acres, MagicBricks, NoBroker, Housing, Facebook groups, Telegram channels), deduplicates them with AI, and overlays a **truth score and full truth sheet** on every listing — owner vs broker, fair rent analysis, duplicate detection, fake photo detection, building reputation, area livability, commute math, lease red flags. The map and truth layer are free. For renters who don't want to DIY, a paid service (₹1,999) takes the full hunt off their hands — AI does the filtering and calling, humans do the judgment, the user sees only the 3–5 flats worth visiting with a ready-made Saturday route.

### 2.2 The three surfaces

The product is three layers, built in sequence, that compound into each other:

**Surface 1 — The Map.** Free. Every listing, every source, one interface. This is the acquisition layer. Viral, shareable, SEO-ready, top-of-funnel.

**Surface 2 — The Truth Sheet.** Free. For every listing: a verification verdict, price history, fake-listing detection, building reputation, neighborhood truth, commute math. This is the *differentiator*. This is what makes us not-another-aggregator.

**Surface 3 — Find Me a Flat.** ₹1,999 per hunt. A tenant-side agent service powered by the data and pipelines behind Surfaces 1 and 2. This is the monetization engine and the long-term moat.

Each surface feeds the next:
- The Map generates the dataset that makes the Truth Sheet work.
- The Truth Sheet generates the credibility that makes users trust us with ₹1,999.
- The Find-Me-a-Flat service generates proprietary data (visit notes, call transcripts, tenant reviews, price verifications) that makes the Truth Sheet uncopyable.

This is the structural advantage. A competitor can clone the map in a month. The truth data takes a year. The service flywheel takes three.

### 2.3 First principles we are committing to

1. **We are on the tenant's side. Always.** We do not take money from owners, brokers, or builders, ever. This is the constraint that keeps the product honest. It is also the marketing.
2. **Truth is the product. Listings are the packaging.** Anyone can aggregate listings. We aggregate truth about listings.
3. **If it lies, we flag it. If we lied, we refund.** Reputation is the moat. Any erosion of it is existential.
4. **AI is the operations team, not the UX gimmick.** The user does not need to know there's an LLM. They need to know a flat is real.
5. **Narrow is faster than broad.** Bangalore only, rentals only, tenant side only, for at least 12 months.
6. **Ship weekly. Learn faster than incumbents can react.**

---

## 3. Who this is for

### 3.1 The primary user

A specific human, not a persona:

- **Age:** 24–34
- **Situation:** Moving to or within Bangalore. Salaried (tech, startup, corporate) or self-employed. Monthly budget ₹25K–80K for rent.
- **State of mind:** Has been on 99acres for two weeks. Has called fifteen numbers. Has visited four flats. Is tired and slightly bitter. Has started complaining about brokers in WhatsApp groups.
- **Digital behavior:** English-comfortable, uses WhatsApp for everything, on Instagram daily, on LinkedIn weekly, pays with UPI, books Ubers, orders Swiggy.
- **Trust level:** Burned once or twice by brokers. Cautiously optimistic about AI. Will try a new app if a friend shares it or it's trending on Reddit.

This is a real person. We are building for this person by name, even if we haven't met them yet. When in doubt about any product decision, ask: *would this make that person's Saturday easier or harder?*

### 3.2 The secondary users (later)

- Same person, six months later, telling a friend.
- The friend, who hears "don't go on 99acres, use Rentmap" and installs.
- Renters in Mumbai, Delhi-NCR, Pune, Hyderabad — after Bangalore is proven.
- Eventually, buyers (direction C, "building intelligence") as a byproduct.

### 3.3 Who this is NOT for

- Luxury renters (₹1L+). Different market, different incentives, largely broker-driven for social reasons.
- PG/hostel/coliving seekers. Different product, well-served by existing operators.
- Non-Bangalore renters (for year one). Every city has different scam patterns, different broker dynamics, different regulatory quirks.
- Owners listing flats. We will not build an owner-side product. Ever.

Saying no to these users is as important as saying yes to our primary user. Every feature request from a non-target user is a distraction that dilutes the product.

---

## 4. Why anyone will use this

The honest answer to the question "why would anyone use this app" is threefold:

**Reason one: it is the first time the listings stop lying.** Every other rental platform shows you raw listings and leaves verification to you. We ship with truth as a default. The first time a user sees "this listing is fake — posted 4 times at 3 different prices, photos are stock" they cannot go back to an unverified feed. This is a one-way door for the user.

**Reason two: it saves a Saturday.** A renter who uses our Map + Truth Sheet visits 3 flats instead of 8, and each of the 3 is verified real. Time saved per renter: conservatively 15 hours. That is not marketing copy — it is the actual unit of value.

**Reason three: it is ours, not theirs.** The social-emotional reason, which matters more than people admit: we are the only player who isn't trying to sell the user anything except truth. Every other interaction in the rental process is adversarial (broker, owner, platform). We are the one who is on their side. Users will pay for that, talk about it, and stay loyal to it.

The killer demo: open the app, see every flat in Bangalore on a map, tap any one, see a full truth verdict in three seconds. Watch the user's face. That's the product.

---

## 5. The wedge, the ladder, and the endgame

### 5.1 The wedge (Month 1–3)

**Bangalore rental map with truth scoring, mobile web, free.** Nothing else. No signup, no app, no payments, no service tier. Get 5,000 monthly active users. Learn what they actually do.

### 5.2 The ladder (Month 3–9)

Add, in order:

- Saved searches and alerts (email + WhatsApp).
- Building pages (aggregated reviews, tenant testimonials, photos).
- The "Find Me a Flat" service, priced ₹1,999. Manual fulfillment at first — us + ChatGPT + a phone — not a scaled AI agent.
- Lease review (free feature, high virality — "upload your lease, we'll flag bad clauses").
- Native Android app once web traction is proven.

### 5.3 The endgame (Year 2+)

- Delhi-NCR, Mumbai, Hyderabad, Pune — city-by-city, not all at once.
- Building Intelligence as a first-class product: the Zomato for Indian apartments.
- Corporate tenant-placement deals: we relocate employees for companies, tenant-side, no brokerage.
- Owner-side products only once we have enough tenant power to dictate terms to owners — never from weakness.

### 5.4 What we are deliberately not doing

- No home loans, insurance, or financial products. These require licenses we do not have and would compromise our "on the tenant's side" positioning.
- No movers, interiors, or post-move services in year one. Affiliate revenue is tempting but dilutes focus.
- No B2B listing SaaS for property managers. Adjacent but different product, different company.
- No short-stay or vacation rentals. Airbnb/Makemytrip own that market; different user, different economics.

---

## 6. The moat, honestly examined

### 6.1 What is and isn't defensible

| Capability | Defensibility |
|---|---|
| The map | Low. Copyable in a month. |
| The scraping pipeline | Low. Any competent team can replicate. |
| The dedup algorithm | Low-medium. Our corpus of ground-truth pairs is valuable. |
| The truth score | Medium. Requires proprietary signals (call outcomes, price history, user-reported outcomes) that compound with usage. |
| The "Find Me a Flat" service fulfillment | Medium-high. Requires operational excellence, tenant NPS, and data flywheel. |
| The brand as "the one that is on the tenant's side" | High. Positioning is easy to claim and hard to steal if we stay disciplined about it. |
| The proprietary data (tenant reviews, call outcomes, lease clauses, post-move satisfaction) | High. Takes years to build. Core long-term moat. |

### 6.2 What will keep us defensible

Three things:

1. **The structural conflict of interest incumbents have.** 99acres cannot become tenant-side without destroying its revenue. We know this; we plan our moves knowing they cannot effectively respond.
2. **Our willingness to lose money on features incumbents can't lose money on.** Free truth sheets cost us cents per listing but would eliminate lead-generation revenue for 99acres — they can't match it.
3. **Speed.** We ship weekly. Incumbents ship quarterly. By the time they react, we've moved.

### 6.3 What will kill us

Enumerating the actual risks, not the comforting ones:

- **Cease-and-desist from aggregators.** 99acres/MagicBricks can and will try to block scraping. Legal grey area. Plan: architect for resilience (rotating IPs, cached copies, multiple sources), engage lawyers early, lean on "publicly accessible data" precedents.
- **No viral loop.** A map app is not inherently shareable. If we don't manufacture shareable moments (the truth verdict, the saved-a-Saturday story), we stall at 10K users.
- **Service layer doesn't convert.** The whole thesis depends on the ₹1,999 service being a real business. If it flops, we are a free aggregator with no monetization.
- **We become the thing we are fighting.** Slippery slope to taking owner money, to featured listings, to affiliate fees. Every compromise erodes the positioning. Requires founder-level discipline to refuse.
- **Team burnout.** 18 months is long. Rental users are cyclical. Team must stay motivated through flat months.

---

## 7. The plan of record (first 90 days)

### 7.1 Month 1 — ship the map

**Week 1:** Scrape four sources for Bangalore. Postgres. Dirty but working.
**Week 2:** Dedupe with embeddings. Map UI with Leaflet, mobile web only. Basic filters.
**Week 3:** Natural language search. Truth score v1 (owner/broker detection, fake photo detection, price anomaly).
**Week 4:** Soft launch to 500 users via Reddit + WhatsApp + one good tweet. Watch sessions. Do not build.

**Success metric:** 500 sessions, 50 return visits in week 2, qualitative signal that people are saying "holy shit" within 30 seconds of opening.

**Failure metric:** Nobody returns. Engagement <2 minutes/session. Users can't explain what we do.

### 7.2 Month 2 — sharpen the truth layer, learn the user

**Week 5–6:** Add the ten most-requested improvements from Month 1 user feedback. Add building pages (aggregated from Google Maps, Reddit, MouthShut, our own call data).
**Week 7–8:** Launch lease review as a free feature. Measure share rate. This is the virality test.

**Success metric:** 5,000 MAU, 20% week-over-week growth, organic sharing visible in logs.

### 7.3 Month 3 — test monetization

**Week 9:** Launch "Find Me a Flat" as a paid service. Manual fulfillment — a team of 3 does it by hand with AI assistance. Cap at 10 users. Price ₹1,999.
**Week 10:** Iterate on service playbook. Measure NPS, refund rate, cost-to-serve.
**Week 11–12:** If metrics look good, open to 50 users. Start building automation for the bottleneck steps.

**Success metric:** 10 paying customers, average NPS >50, cost-to-serve <₹800, zero refunds.

**Failure metric:** Users bounce at the payment step. Fulfillment is too expensive to be profitable. NPS low.

### 7.4 What success at Day 90 looks like

- 10,000 monthly active users on the free product.
- 50 paying customers at ₹1,999.
- Net revenue ~₹1L/month — not a business yet, but a pulse.
- Zero brand damage, high word-of-mouth, organic growth from sharing.
- A clear view of whether Surface 3 is the right monetization or whether we need to rethink.

### 7.5 What failure at Day 90 looks like

- <1,000 MAU, no virality, stagnant growth.
- Zero or single-digit paid conversions.
- Incumbent response (99acres blocks scrape or launches feature).
- Team demoralized.

At Day 90, reassess honestly. This plan is not a commitment to march through failure — it is a commitment to try this and evaluate.

---

## 8. The team, the stack, the burn

### 8.1 Team of three

This is a deliberate constraint. Three people means one person cannot own more than one of: product, engineering, growth. Suggested split:

- **One person on the data and backend pipeline** — scraping, dedup, truth scoring, infrastructure.
- **One person on the product and frontend** — map, UX, mobile web, features.
- **One person on growth, content, and ops** — user research, Reddit/WhatsApp presence, building the manual "Find Me a Flat" service in Month 3, building the brand voice as the tenant's advocate.

The third role is often underestimated and is often the difference between a product that ships and a product that gets used.

### 8.2 Stack

Kept deliberately boring because speed matters more than novelty:

- **Scraping:** Python, Requests, BeautifulSoup, Selenium where needed, Playwright for JS-heavy sites.
- **Storage:** Postgres with pgvector for embeddings. S3 for images.
- **Backend:** FastAPI. REST. No GraphQL unless forced.
- **Frontend:** Next.js, Leaflet for maps, Tailwind. Mobile web first. PWA before native.
- **AI:** OpenAI / Anthropic APIs for dedup + NL search + truth scoring. On-device models later.
- **Infra:** Railway or Fly.io at MVP scale. AWS when traffic forces it.
- **Comms:** WhatsApp Business API for alerts (cheaper and more open-rate-friendly than email in India).

### 8.3 Burn

Target monthly burn for first 90 days: ₹1.5L (three people at modest salaries) + ₹25K (infra + API + tooling) = ~₹1.8L/month, ~₹5.5L for 90 days.

This assumes founders are underpaid. Which founders always are.

---

## 9. Go-to-market, the honest version

### 9.1 The first 100 users

Not through ads. Not through PR. Through three channels:

1. **Reddit — r/bangalore, r/IndianRealEstate, r/developersIndia, r/unitedstatesofindia.** Post the product with a specific story ("we mapped every listing in Bangalore and ~30% are fake, here's what we found"). Data-driven posts outperform pitch posts 10:1.
2. **WhatsApp groups in tech companies, apartment communities, and relocation groups.** Personal sharing. Requires the team to actually be in these groups and be useful.
3. **One founder-written piece on LinkedIn or a Substack.** The story: "Why finding a flat in Bangalore is broken, and what we built to fix it." Makes the positioning explicit.

No Google Ads, no Instagram ads, no influencers in month 1. Paid acquisition before product-market-fit burns cash and teaches nothing.

### 9.2 The first 10,000 users

From user 100 to user 10,000, the engine is:

- **Content marketing**: monthly "state of Bangalore rentals" reports. Use our proprietary data. Get picked up by Moneycontrol, Inc42, YourStory.
- **SEO**: long-tail pages for every locality ("2BHK in Whitefield: real prices, which buildings to avoid"). Rank for localized queries.
- **Referral**: a small incentive (e.g., ₹500 off on the service) for users who invite a flat-hunting friend.
- **Community**: active presence in the WhatsApp broker-and-tenant groups, sharing truth data weekly.

### 9.3 The first paying customer

Will be someone you know, or one degree removed. Don't be proud. First paying customer is a data point, not a market signal. The tenth is the signal.

---

## 10. The things we are choosing to not know yet

A deliberately-incomplete brief is honest. These are the questions we do not yet have answers to. We will not pretend otherwise.

- Is ₹1,999 the right price for the service, or should it be ₹499 + ₹1,500 on signing, or a flat ₹2,999? We'll learn this from the first 50 paid users.
- Does the WhatsApp / Telegram broker-channel data matter enough to invest in scraping? Probably yes, but the legal ambiguity is real. Decide by Month 3.
- Is natural-language search a wow feature or a gimmick? We think wow. We'll know by Month 2.
- Do we need an Android app to cross 50K users, or can PWA carry us to 200K? Unknown. Decision driven by observed conversion rates.
- What's the right trigger for expanding beyond Bangalore? Probably "we've served 500 paid users in Bangalore and our NPS is above 60." Revisit at Month 9.

---

## 11. The one sentence the team should repeat

If everything else in this document is forgotten, remember this:

**We are building the first rental product in India that is structurally, ruthlessly, visibly on the tenant's side — and truth is the feature.**

Every decision, every feature, every hire, every line of copy — if it is consistent with that sentence, ship it. If it is not, reject it, no matter how tempting.

---

## 12. Appendix — what changed, and what comes next

### 12.1 What we argued through to get here

- **Finance app** → **Scam shield** → **BS detector** → **Cleo for India** → **"You" (personal AI)** → **Rental Map** → **this.** Fourteen turns of ideation. Every earlier direction was either too broad, too ambitious for three people, too wrapper-shaped, or disconnected from a user the founder actually knew.
- The tipping point was a single honest sentence from the founder: *"the person I'm really building for is myself."* That reframed the whole problem space from "what idea wins" to "what pain is in my body right now." The answer was rental hunting, and the product followed from it.

### 12.2 What to do in the next 48 hours

1. Show this document to the two other people on the team. Argue. Edit. Reject anything that doesn't feel true.
2. Pick a name. "Rentmap" is a working title. A better name exists.
3. Register the domain. Set up a bare landing page with an email waitlist. It costs one evening.
4. Write the first scraper. Run it against 99acres-Bangalore for 2BHK. See how many listings you can pull in an hour. This is the smallest real test of whether any of this is buildable by this team in this timeframe.
5. Talk to five people actively hunting flats in Bangalore this week. Not to validate the idea — to understand their pain deeper. Show them the document, or don't. Just listen.

Then ship Week 1.

---

*End of brief v0.1. Revisit in 30 days.*
