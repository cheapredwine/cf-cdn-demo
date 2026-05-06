# Multi-CDN Demo — Run of Show

**Version:** 20260505T2317Z
**Audience:** SE running the demo
**Target length:** ~15 minutes
**Companion docs:** `multicdn-demo-architecture-20260505T2317Z.md`, `multicdn-demo-build-manual-20260505T2317Z.md`

## Setup before the meeting

**Disconnect WARP** before the demo: `warp-cli disconnect`. WARP intercepts TLS to the demo subdomains and breaks all curl/fetch from your Mac. If you forget, every Beat 2/3 curl will hang. Reconnect after the meeting.

Open browser tabs in this order:

1. The demo portal page (`portal.demo.<your-domain>`) with the "generate link" button
2. Cloudflare LB dashboard showing both pools healthy
3. The egress meter (`meter.demo.<your-domain>?demo_seed=10` — the `demo_seed` query parameter primes the displayed numbers so the comparison table shows realistic-looking values during Beat 5; without it the live values are pennies)
4. Audit view (`audit.demo.<your-domain>`)
5. A scratch tab for clicking generated URLs (open dev tools, Network panel visible)

Have a terminal open with the curl loops ready to paste. Have the public Worker code open in a second editor window for the surgical-control beat. Confirm `STATE.md` is accessible in case you need a hostname or resource ID mid-demo.

Do a dry run 30 minutes before the meeting. The most fragile pieces are the LB health-check toggle and the Worker redeploy; rehearse both.

**Fallback hostnames:** if any `*.demo.jsherron.com` cert is broken at meeting time, every Worker is also reachable at its `workers.dev` URL (`multicdn-demo-{public-steering,secure,meter}.<account>.workers.dev`). The portal and audit Pages sites are also at `multicdn-demo-{portal,audit}.pages.dev`. Have these in a saved tab group as backup.

## Beat 1: The setup (2 minutes)

Open with one slide: the architecture diagram from the architecture doc. Spend 30 seconds, no more.

Say something like: *"Single R2 bucket as origin. Cloudflare's CDN and a CloudFront distribution both pull from it. A Cloudflare Load Balancer steers traffic between the two. There's also a separate path for protected content — patient-portal-style assets — that we'll see at the end."*

Pivot to the egress meter tab. Point at the `$0.00` number.

*"This number is going to sit at zero for the entire demo, no matter which CDN ends up serving the bytes. Hold that thought — we'll come back to it."*

Don't dwell on the architecture. The slide is reference. The show is what the IT director sees on screen.

## Beat 2: Multi-CDN steering live (4 minutes)

Switch to terminal. Run the curl loop:

```bash
for i in {1..10}; do
  curl -sI https://assets.demo.<your-domain>/images/providers/rahman.jpg | grep -i served-by
done
```

Watch responses alternate between `cf-edge` and `cloudfront`. Read the output out loud.

*"Same URL. Same image. Same origin bucket. Different CDN per request. The browser, the user, the application — none of them know or care which CDN served any given byte. That's the multi-CDN promise."*

Switch to the LB dashboard. Mark `pool-cloudfront` as disabled (toggle the pool, or change its health-check path to break it intentionally).

Wait ~30–45 seconds (probe interval is 15s with 2 retries; worst case ~45s) while the health monitor flips it to unhealthy. Use the wait time to take a Q on session affinity / cache warming / cost differences (see below). Re-run the curl loop when the dashboard shows `unhealthy`.

*"All ten now `cf-edge`. If CloudFront has an outage tomorrow, this is what your day looks like — about 30 seconds of degraded mix while the health checks notice, then clean failover. No DNS TTL waiting, no engineering ticket. The bucket never moved. The customer never knew."*

Re-enable the pool. Wait for it to flip back to healthy. Run the loop once more, back to 50/50.

Pause for questions here. The IT director's first instinct is usually "what about session affinity / what about cache warming / what about cost differences between providers." Have answers ready:

- **Session affinity:** the LB supports it, off by default for this demo
- **Cache warming:** each CDN warms its own cache on first miss; R2's zero egress means warming is free
- **Cost differences:** that's the egress meter point — both CDNs pull from R2 for free, so the only delta is the CDN's own delivery pricing

## Beat 3: Surgical control with the Worker (3 minutes)

Frame as optional layer.

*"What I just showed you is production-grade and probably 80% of what you'd ever need. The Load Balancer is a stable piece of infrastructure your ops team operates. For the other 20% — when you want surgical control — here's what becomes possible."*

Switch to the Worker code editor. Show the file structure briefly — point at the `STEERING_MODE` variable in `wrangler.toml` under `[env.public.vars]`.

Three options for the live deploy (pick one before the meeting):

**Option A — edit-and-deploy:** Change `STEERING_MODE` in `[env.public.vars]` from `"passthrough"` to `"path_routing"`, then run:
```bash
wrangler deploy --env public
```

**Option B — var override:** Faster, no file edit:
```bash
wrangler deploy --env public --var STEERING_MODE:path_routing
```

**Option C — pre-rehearsed:** Have all three deploy commands aliased in your shell before the meeting (`steer-passthrough`, `steer-path`, `steer-rollout`).

The deploy takes ~5–10 seconds (initial deploy of the session may take 12–15). Narrate it.

*"That's the deploy. Globally. To 330+ data centers. Ten seconds."*

Run a curl loop targeting `/video/welcome.mp4`:

```bash
for i in {1..10}; do
  curl -sI https://cf-pool.demo.<your-domain>/video/welcome.mp4 | grep -iE 'served-by|routing-decision|location'
done
```

All ten responses should show `served-by: cf-edge` and `routing-decision: video-locked-to-cf`.

Then a loop on a non-video path:

```bash
for i in {1..10}; do
  curl -sI https://cf-pool.demo.<your-domain>/images/providers/rahman.jpg | grep -iE 'served-by|location'
done
```

Now you'll see all ten responses are **`HTTP 302`** with `Location: https://cloudfront-pool.demo.<your-domain>/...`. The Worker is actually routing — non-video traffic gets handed off to CloudFront. Demonstrate the round-trip by following one redirect with `curl -L`:

```bash
curl -sIL https://cf-pool.demo.<your-domain>/images/providers/rahman.jpg | grep -iE 'served-by|HTTP'
```

Final response shows `served-by: cloudfront`.

*"Path-based routing. Live. The Worker decides per-request: this path stays on Cloudflare, this path goes to CloudFront. No re-architecture, no provider negotiation, no procurement cycle. One config, one deploy."*

If you have time and the room is engaged, do the percent-rollout flex:

```bash
wrangler deploy --env public --var STEERING_MODE:percent_rollout --var ROLLOUT_PCT:10
```

Then a 50-request loop:

```bash
for i in {1..50}; do
  curl -sI https://cf-pool.demo.<your-domain>/images/logo.png 2>/dev/null | grep -iE 'served-by|location'
done | sort | uniq -c
```

Show roughly 10% with `served-by: cf-edge` and 90% as `Location:` redirects to CloudFront.

*"This is how you'd canary a new CDN provider before committing. 1%, 5%, 10%, ramp it up, watch error rates, roll back instantly if anything looks wrong."*

Reset `STEERING_MODE` to `passthrough` before moving on:
```bash
wrangler deploy --env public
```

## Beat 4: Protected content (4 minutes)

This is the beat that makes it stick for healthcare. Slow down here.

Switch to the demo portal tab. Point at the page.

*"Pretend this is your patient portal — or any internal app where users need access to documents that aren't fully public. Marketing imagery is one thing; an after-visit summary is another. Same R2 bucket, completely different security posture."*

Click "Generate 60-second link to After-Visit Summary." A URL appears with a countdown timer.

Click the URL. PDF opens in the scratch tab.

*"After-visit summary. Just like the real patient portal would serve. The token in that URL is signed, scoped to this specific document, and expires in 60 seconds."*

Switch to the audit view tab. Point at the new row that just appeared: timestamp, subject, path, **allow**.

*"Every access logged at the edge. Subject, asset, IP, decision. This is what your security team and your compliance officer want to see."*

Switch back to the scratch tab. Wait until the countdown on the portal page hits zero plus a few seconds. Click the same URL again.

403.

Switch to the audit view. Point at the new **deny** entry, reason `expired`.

*"Same patient, same asset, expired token. Logged with the reason. If audit asks 'who accessed what, when, and was it authorized,' that's the answer."*

Mention but don't demo (out of scope for a 15-minute meeting):

*"In production, that token issuance endpoint sits behind your SSO via Cloudflare Access — same identity provider you use for everything else. Same MFA. Same access policies. The Worker becomes a policy enforcement point, not just a token validator."*

If the IT director asks about HIPAA / BAA, this is the right moment to be direct:

*"For PHI in production, this stack runs on Cloudflare Enterprise with a BAA in place. The demo you're seeing is the architecture and the user experience — the production version has the same shape with the BAA paperwork wrapped around it."*

## Beat 5: The close (2 minutes)

Switch back to the egress meter (the `?demo_seed=10` tab — see Setup). Still `$0.00` for actual origin egress. Point at the hospital-volume projection table — that's the persuasive part.

*"Through this entire demo, every byte that moved out of R2 — to my CDN cache, to CloudFront's cache, to your browser — was free. If this same traffic had been on S3-backed origins at hospital-system scale, that's `$1,800` per year for a small site, `$18,000` per year for a multi-facility system, `$90,000` per year for a regional health network. Whatever your current S3 or Azure egress line item is, R2 makes it zero."*

Three takeaways. Say them out loud, slowly:

1. *"One origin, any CDN, no replication. You're not locked in to anyone, including us."*
2. *"Operational changes happen at the speed of a config push, not a migration project."*
3. *"PHI-adjacent content has a clear governance path: time-limited, scoped, audited at the edge."*

Stop. Don't oversell. Ask:

*"What would you want to put behind this first?"*

That question is doing real work. It moves the conversation from "is this interesting" to "where does this fit in our environment," which is the only conversation worth having from here.

## Things to have ready for likely questions

- **"What's the BAA story?"** Enterprise tier, BAA covers the in-scope services (CDN, WAF, Workers, R2 in-scope as of 2025; verify current scope before the meeting). Cloudflare doesn't sign BAAs at lower tiers.
- **"How does this compare to our current setup with Akamai/CloudFront/etc.?"** Honest answer: depends on workload. The R2 zero-egress structural advantage is real; the CDN performance comparison is workload-specific. Offer to run a comparison after the meeting.
- **"What about regional / data residency?"** R2 supports location hints and jurisdictional buckets (EU, FedRAMP). Hospital systems sometimes have state-level data residency requirements; address those individually.
- **"What's the failure mode if Cloudflare itself has an outage?"** The LB and CF pool both go down, but the CloudFront pool keeps serving from its cache (and from R2, which runs on Cloudflare infrastructure but has high availability separate from edge POPs). For full geographic-failure resilience, customers can replicate R2 to S3 or another origin — but that's a different conversation.
- **"How do we get from here to a pilot?"** This is the question you want. Have a 30-day pilot offer ready: bucket setup, one CDN integration, optional Worker layer, with a defined success metric.

## Failure recovery during the demo

If a step fails live:

- **LB pool flip doesn't work:** fall back to a curl against `cf-pool` and `cloudfront-pool` hostnames directly to show both are functional, narrate that the LB is the steering layer
- **Worker redeploy fails:** have a pre-deployed second Worker on a backup hostname with `STEERING_MODE=path_routing` already set. Switch to that hostname.
- **Token endpoint timeouts:** have a pre-issued long-TTL token (5 minutes) ready in a text file. Paste and demo from there.
- **PDF doesn't render:** the file is generic — open the source URL in a different tool to confirm it's served, then narrate "in production this is what your users see."

The single biggest risk to the demo is internet connectivity at the meeting site. If you're presenting in person at the customer's office, have your phone hotspot ready as a backup.
