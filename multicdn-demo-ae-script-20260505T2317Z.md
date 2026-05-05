# Multi-CDN Demo — AE Briefing & Narrative Script

**Version:** 20260505T2317Z
**Audience:** Account Executive partnering with the SE on this demo
**Purpose:** Help you understand what we're showing, why it matters to this customer, and how to set up and close the conversation around it
**Companion docs:** architecture, build manual, and run-of-show (SE has these)

## Who we're talking to and what they care about

The prospect is an IT director at a hospital system. They're parallel to an existing customer in a larger org, which means they've heard about Cloudflare from someone they trust, and they have a specific problem in mind: **consolidating storage to serve as a single origin for multiple CDNs.**

That's their words. What they actually mean, almost always, is one or more of these:

- **Their cloud egress bills are out of control.** Every CDN cache miss pulls from S3 or Azure and meters charges. Multi-CDN setups multiply this pain.
- **They feel locked in to their current CDN provider** and want negotiation leverage or a path to dual-vendor.
- **Something broke recently** — a CDN outage, a cost spike, a security incident — and they're shopping for resilience.
- **Compliance is breathing down their neck** about how patient-adjacent content is served and audited.

The IT director may not say any of this directly in the first meeting. Your job and the SE's job is to demonstrate that we understand the problem better than they do, and that the demo we show maps to all four of those underlying concerns even though they only asked about one.

## The structural advantage we're selling (in one sentence)

**Cloudflare R2 is the only major object storage with zero egress fees, which means a hospital can put us behind any CDN — or any combination of CDNs — without the costs that make multi-CDN architectures painful everywhere else.**

That's the whole pitch. Everything else in the demo is in service of making that one fact feel real and consequential.

## The cost story (this is your section)

The egress meter on screen during the demo isn't decoration — it's the close. You need to be able to talk about it without the SE present, in the recap email, in internal pipeline conversations, and when the IT director asks "okay but how much would we actually save."

### What the customer is paying today

When a hospital serves images, PDFs, and video from S3 (or Azure Blob, or GCS) through CloudFront (or any other CDN), here's what happens on every cache miss:

1. User requests a file
2. CloudFront doesn't have it cached yet → CloudFront pulls from S3
3. **AWS bills S3 egress fees on that pull** — typically around $0.05/GB at enterprise-discount rates, $0.09/GB at list price
4. CloudFront caches it and serves the user
5. CloudFront also charges its own delivery fee — separate line item

The S3 egress is the hidden multiplier. It happens on every cache miss, every cache eviction, every new asset, every new region warming up. Multi-CDN setups make it worse because each CDN has its own cache that needs to be warmed independently — every CDN you add multiplies your S3 egress bill.

### What changes with R2 underneath

R2 charges zero for egress, to anyone, including third-party CDNs pulling from it. CloudFront pulling from R2 is free on the R2 side. Step 3 above goes away entirely.

The customer keeps whatever CDN they have. We don't replace anything in their delivery layer if they don't want us to. We just zero out the storage egress line on their cloud bill.

### The math the AE should know cold

Worked example for a large multi-facility hospital system at **100 TB/month of CDN-served traffic** (realistic for a system with patient portal, marketing site, internal apps, video content):

Assume 30% cache miss rate on average across CDN tiers (this is conservative; multi-CDN tends to be higher because caches are independent). That's 30 TB/month pulled from origin storage.

- **At AWS S3 with $0.05/GB blended enterprise-discount egress:** 30,000 GB × $0.05 = **$1,500/month, or $18,000/year, in egress alone**
- **At R2:** $0
- **Annual savings on egress alone:** ~$18,000

That number doesn't include the other things R2 fixes:

- Cost predictability — the customer's egress bill stops scaling with traffic spikes (DDoS, viral moment, conference-driven traffic)
- Multi-CDN tax — adding a second CDN doesn't double the egress line
- Cache strategy freedom — they can cache more aggressively or less aggressively without watching the cost meter

### How to talk about this without overcommitting

Use these phrases:

- *"Based on what we typically see at hospital systems your size, the egress savings alone are usually in the $15–25K/year range. The bigger story is what happens to your cost predictability."*
- *"We can run an actual analysis against your real traffic data once we know more — happy to scope that as part of the pilot conversation."*
- *"The number isn't the whole story. Most of our healthcare customers tell us the bigger value is no longer flinching when traffic spikes."*

Don't quote precise savings numbers without the SE's input. Use ranges. The IT director will ask "can you put that in writing" and the answer is "we can after a 30-minute call with our team to look at your actual traffic patterns" — that's a meeting you want.

### Honest caveat

R2's per-GB storage cost is *higher* than S3's cheapest tier ($0.015/GB-month vs S3 Standard at $0.023/GB-month — wait, R2 is actually cheaper there too). R2 is cheaper or comparable on storage, and dramatically cheaper on egress. The only scenarios where S3 wins on cost are pure cold-archive workloads (S3 Glacier) where egress almost never happens. Hospital-served web content is the opposite of that — high egress, frequently accessed. R2 wins decisively.

If the customer asks "what's the catch on storage cost," the answer is "there isn't one — we're competitive or cheaper on storage too. The structural difference is egress."

## How the demo is structured

The SE will run five beats over about 15 minutes. Here's what each beat is showing and *why we picked that thing to show*.

### Beat 1: The setup (2 min) — establishing the frame

**What you'll see:** A simple architecture diagram, then the SE pivots to a live "egress meter" page on screen. The page shows `$0.00` in big numbers, with a comparison table underneath: what the same traffic would cost on AWS S3, Azure Blob, and GCS at list and discounted rates.

**Why we open with it:** Most CDN demos start with a feature tour. We're starting with a number that's going to sit unchanged for the entire meeting. That number is the entire pitch in visual form. If the IT director remembers nothing else, they'll remember that number — and the comparison row showing what they'd be paying elsewhere.

**Your role:** When the SE points at the meter, that's a good moment for you to softly underline it: *"That's the line item we're going to make disappear from your cloud bill."* Said quietly, said once. Don't oversell. Then let the SE move on.

### Beat 2: Multi-CDN steering live (4 min) — proving the core capability

**What you'll see:** The SE runs a script that hits the same URL ten times. Each request shows which CDN served it — alternating between Cloudflare and CloudFront. Then the SE simulates a CloudFront outage by clicking a button in a dashboard. Within seconds, all traffic shifts to Cloudflare. Then they bring CloudFront back.

**Why we show this:** This directly answers the customer's stated request — "consolidate storage as a single origin for multiple CDNs." We're proving it works, that it's not theoretical, that failover is operational rather than architectural. The IT director's first instinct will be skepticism: "this sounds like marketing, what's the catch." Watching it happen live in 30 seconds dissolves that skepticism.

**The deeper story:** What we're really telling them is *"you don't have to trust us — you can dual-vendor with our biggest competitor and we still win, because R2 underneath is the structural advantage."* That's a confidence move. Most vendors don't show their product working alongside competitors.

**Your role:** Watch the IT director's face. If they lean in or take notes during the failover moment, that's your buying signal — they have a story in their head about a recent outage they're trying not to repeat. Make a mental note to ask about it after the demo.

**Likely question:** *"What about our existing CDN contract / what if we don't want to switch?"* — the right answer is "you don't have to switch anything to start. R2 sits behind your existing CDN. The multi-CDN piece is optional and additive. Start by lowering your egress bill on what you already have."

### Beat 3: Surgical control with the Worker (3 min) — the "look how powerful this is" beat

**What you'll see:** The SE opens a code editor, changes one line of code, redeploys. Suddenly all requests for video files are routed exclusively through Cloudflare while other content stays balanced 50/50. Optionally, they'll demo a "10% canary" rollout where 10% of requests go one way and 90% the other.

**Why we show this:** Beat 2 showed multi-CDN working. Beat 3 shows multi-CDN being *programmable* in ways no other vendor can match. The IT director may not have a use case for this on day one, but it plants a flag — "Cloudflare is the platform that grows with you, the others are just CDNs."

**The deeper story:** This is the beat that separates "another CDN vendor" from "the platform our smart engineering team will love working with." If the IT director has a strong technical team, this beat lands hard. If they're more business-focused, this beat is less critical — the SE can compress it.

**Your role:** Read the room. If the IT director seems engaged, let it run. If they look glazed, catch the SE's eye — they know to compress. After this beat, this is a good moment for you to interject with a business framing: *"This kind of control is what our larger healthcare customers use to manage cost and performance dynamically — for example, [reference customer if you have one]."*

**Likely question:** *"Who maintains this code? Do we need a team of engineers?"* — the answer is no, you don't, the Load Balancer (beat 2) is enough for most use cases. The Worker layer is opt-in. Frame it as optional power, not required complexity.

### Beat 4: Protected content (4 min) — the healthcare-specific beat

**What you'll see:** A demo "patient portal" page. The SE clicks a button that generates a 60-second link to a sample after-visit summary PDF. The link works. They wait a minute. The link is dead — 403 error. Throughout, an audit log shows every access attempt with timestamp, user, asset, and decision (allow/deny).

**Why we show this:** This is where we differentiate from "generic CDN" and become "the platform that solves your healthcare-specific problems." Every IT director in healthcare is thinking about how to handle PHI-adjacent content — patient portal documents, lab results, provider-only training materials, internal wiki content. We're showing that the same infrastructure that handles their public marketing site can also handle this gated content with auditing built in.

**The deeper story:** This beat is what gets the IT director to bring their security or compliance officer to the next meeting. That's the goal. We're not closing the deal in this meeting; we're earning a second meeting with more stakeholders.

**Your role:** Watch for the IT director to mention compliance, audit, HIPAA, or PHI. The moment they do, that's your cue to ask: *"Who else on your team should see this? Would it make sense to bring your CISO or compliance lead into the next conversation?"* That's how you expand the deal.

**Important honest moment:** If they ask about HIPAA / BAA, the SE will tell them this requires Cloudflare Enterprise tier. **Don't apologize for this.** Frame it as: *"For PHI in production, you'd want to be on Enterprise anyway — that's the tier with the dedicated support, the SLAs, and the BAA. The demo shows the architecture; the Enterprise contract wraps the compliance around it."* Many vendors cheap out on BAAs. Ours is real, and it comes with real support.

### Beat 5: The close (2 min) — bringing it home

**What you'll see:** The SE flips back to the egress meter. Still `$0.00` after 13 minutes of demo traffic. The comparison table now shows what the same traffic *would* have cost — even at demo-scale volumes, the contrast is visible. The SE walks through three takeaways:

1. One origin, any CDN, no replication — no lock-in, including from us
2. Operational changes happen at config-push speed, not migration-project speed
3. PHI-adjacent content has a clear governance path: time-limited, scoped, audited

Then they ask: *"What would you want to put behind this first?"*

**Why this question:** It moves the conversation from "is this interesting" to "where does this fit." That's a fundamentally different conversation. If they answer with a specific use case ("our patient portal images" or "our marketing video library"), you have a pilot opportunity. If they say "I'd need to think about it," that's still progress — you've planted a frame they'll think in.

**Your role:** This is your moment, and the egress meter is your tool. Once the IT director answers the SE's question, you can connect the savings story directly:

- *"Based on what we typically see at hospital systems your size, the egress savings on that workload alone are usually in the $15–25K/year range, before we even get into the multi-CDN flexibility. We can put a real number against your actual traffic if you'd like."*

Then transition to next steps:

- **If they have a specific use case:** "That's a great starting point. We typically run a 30-day pilot for something like that — would it make sense to scope that out together?"
- **If they're vague:** "Totally understand. Let me suggest we put together a short proposal for a couple of pilot scenarios — would Tuesday work for a 30-minute follow-up?"
- **If they bring up budget / procurement:** "Happy to walk through pricing whenever you're ready. The pilot is structured to prove value before any commitment."

## The four objections you should expect, with answers

### "We're already invested in [Akamai / CloudFront / Fastly]. Switching is a huge project."

**Answer:** "You don't have to switch. R2 is designed to sit behind whatever CDN you already have. The first conversation is usually about lowering your egress bill on the storage layer — your CDN doesn't change. Multi-CDN comes later if and when you want it."

The structural truth here is that R2 with zero egress fees benefits the customer *even if they keep their existing CDN forever*. The multi-CDN piece is the upsell, not the entry point.

### "How is this different from S3 with CloudFront?"

**Answer:** "Two big things. First, our egress is free — to anyone, including CloudFront. So if you keep CloudFront and just swap S3 for R2, you stop paying egress on every cache miss. Second, you stop being locked in to one CDN. Today it's CloudFront; tomorrow if you want to add or swap, it's a config change, not a re-platform."

### "What's the catch on zero egress? It can't really be free."

**Answer:** "It's not free — it's priced into the storage and the operations. We charge for storing the data and for API operations against it. We just don't double-charge you on the way out. AWS, Azure, and GCP all built their cloud businesses on egress lock-in; we built ours on the bet that customers want portability. The zero-egress promise has held since 2021 with no asterisks."

### "We're a hospital. We need a BAA. What's the deal?"

**Answer:** "We sign BAAs at our Enterprise tier. That's the right tier for any healthcare workload anyway — it's where you get the support, SLAs, and contract terms that match what you need. The demo shows the technology; the Enterprise engagement wraps the compliance around it. Happy to introduce you to our healthcare team for that conversation when you're ready."

## What to do before the meeting

- **Confirm the meeting time and attendees** with the IT director's office. If they're bringing additional people (security, networking, applications), the SE will adjust the demo emphasis.
- **Brief yourself on the parallel customer in the larger org.** What products do they use? What's their relationship status? You may be able to drop a "as you've probably seen with [related team]" reference.
- **Pull recent hospital-system breach news.** If there's a recent regional incident, you can subtly reference it without being morbid: "you've probably seen the news about [region/event] — that's exactly the kind of scenario this architecture protects against."
- **Have the pilot one-pager ready.** Don't lead with it, but have it for the close.

## What to do after the meeting

Within 24 hours, send a recap email with:

1. **The egress meter screenshot as the lead visual** — the SE will share it. This is the single most memorable thing from the meeting; lead with it.
2. **The savings range tied to their business** — *"Based on the conversation, we'd estimate $15–25K/year in egress savings alone for a workload at your scale. We can sharpen that number with a quick look at your real traffic."*
3. A short recap of the three things demonstrated
4. The specific use case the IT director mentioned (if any)
5. A proposed next step with two date options
6. An offer to bring in additional stakeholders (security, compliance, applications)

Don't send the architecture diagram unless they ask. The architecture is the SE's territory; your follow-up should focus on business outcomes and next steps. The egress meter screenshot, by contrast, is a business artifact — it belongs in your email.

## Key terminology cheat sheet (so you sound fluent)

- **R2** — our object storage product, S3-compatible, zero egress fees. Think of it as "S3 without the bandwidth bill."
- **Origin** — where the original copy of a file lives. The CDN pulls from the origin, caches the file, and serves cached copies to users. R2 is being shown as the origin.
- **Egress** — data leaving a cloud provider. Egress fees are what AWS / Azure / GCP charge per gigabyte going out. Cloudflare charges zero for this. **This is the line item we're zeroing out.**
- **Egress fee** — typically $0.05/GB at enterprise-discount rates on AWS, $0.09/GB at list. Per gigabyte, every gigabyte that leaves their cloud, every time.
- **CDN cache miss** — when a user requests a file that the CDN doesn't have cached yet, so the CDN pulls a fresh copy from origin. Each cache miss = one egress event = one charge on traditional clouds. With R2 underneath, cache misses are free.
- **Cache miss rate** — the percentage of requests that result in a pull from origin. Typical is 20–40% across multi-CDN setups; higher on first deploys, lower on stable workloads. Higher cache miss rate = more egress pain on traditional clouds.
- **Worker** — Cloudflare's serverless code platform. Code that runs at the edge, on every request. Optional layer in this demo.
- **Load Balancer** — Cloudflare's traffic-steering product. Decides which "pool" (group of origins / CDNs) handles each request based on health, geography, or weights.
- **BAA (Business Associate Agreement)** — the contract HIPAA requires between a covered entity (hospital) and any vendor handling PHI. Cloudflare signs BAAs at the Enterprise tier.
- **PHI (Protected Health Information)** — patient-identifying medical information. The category of data that triggers HIPAA requirements.

## One last thing

The IT director called the SE because someone they trust at the parallel org said good things about us. That trust is the most valuable thing in the room and it's not yours to spend — it's yours to honor. The fastest way to break it is to oversell. The fastest way to deepen it is to be honest about what we're good at, honest about what's out of scope, and clear about how we'd partner with them. The demo does the selling. Your job is to keep the relationship in good shape so the next meeting happens.
