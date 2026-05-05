# Multi-CDN Demo Architecture

**Version:** 20260505T2317Z
**Audience:** Hospital IT director, ~15-minute first meeting
**Author:** Cloudflare SE

## Purpose

A demo environment that proves four things in under 15 minutes:

1. A single origin can serve multiple CDNs without re-replication or vendor lock-in.
2. Switching or rebalancing CDNs is operational, not architectural — measured in seconds, not migration projects.
3. Semi-private content (after-visit summaries, provider-only assets) can be gated, time-limited, and audited at the edge.
4. None of the above generates origin egress fees, regardless of which CDN is doing the pulling.

## Architectural layers

### Origin plane: Cloudflare R2

One bucket, two prefixes. `public/` holds marketing-grade assets that both CDNs can cache freely. `private/` holds protected content that only the Cloudflare-side Worker can serve, after JWT validation. R2 is S3-compatible, so CloudFront talks to it as if it were S3. Egress from R2 is free in all directions, including to CloudFront.

### Steering plane: Cloudflare Load Balancer

Sits in front of `assets.demo.<your-domain>` (the public hostname). Two pools: `pool-cf` (Cloudflare's own CDN, R2 behind it) and `pool-cloudfront` (CloudFront distribution, R2 as origin). Health monitors probe each pool every 15 seconds. Steering policy is weighted — 50/50 by default, adjustable in dashboard. Both pools return a `served-by` response header so dev tools and curl can see which path served each request.

### Edge logic plane: Cloudflare Workers

**Optional on the public side, required on the protected side.**

- **Public Worker (optional):** bound to the Cloudflare pool's hostname, enables per-request control: path-based routing (`/video/*` always to CF), percent rollouts, header-based steering. Off by default; the demo flips it on as the "surgical control" beat.
- **Secure Worker (always in path):** bound to `secure.demo.<your-domain>`, validates JWTs, enforces path scoping and expiry, fetches from R2's `private/` prefix, and writes an access log entry per request.

### Token issuance plane

A small Worker endpoint at `secure.demo.<your-domain>/issue` mints short-lived JWTs (60-second TTL, path-scoped). In production this would live behind SSO via Cloudflare Access; in the demo it's open for simplicity, with a note that production-mode adds Access on top.

### Audit plane: Workers KV

Each protected-content access writes a record (timestamp, token subject, asset path, IP, decision) to a KV namespace. The demo reads from this in real time to show "watch the audit trail populate" while the IT director clicks links.

## Diagram

```
┌──────────────────────┐         ┌──────────────────────┐
│ assets.demo.example  │         │ secure.demo.example  │
│   (public assets)    │         │ (protected assets)   │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
   ┌───────▼────────┐               ┌───────▼─────────┐
   │ Cloudflare LB  │               │ Worker (always) │
   │  weighted CF   │               │  - validate JWT │
   │  + CloudFront  │               │  - check expiry │
   └───────┬────────┘               │  - log access   │
           │                        │  - serve from R2│
   ┌───────┴────────┐               └───────┬─────────┘
   │                │                       │
┌──▼──┐      ┌──────▼─────┐                 │
│ CF  │      │ CloudFront │                 │
│ +   │      │            │                 │
│ opt │      │            │                 │
│ Wkr │      │            │                 │
└──┬──┘      └──────┬─────┘                 │
   │                │                       │
   └────────┬───────┴───────────────────────┘
            │
   ┌────────▼─────────┐
   │   Cloudflare R2  │
   │  public/  prefix │
   │  private/ prefix │
   │  zero egress     │
   └──────────────────┘
```

## How the three demo beats map to the architecture

The **multi-CDN steering** beat exercises the steering plane: change the LB pool weights, mark a pool unhealthy, watch traffic shift. The optional Worker beat layers per-request logic on top — change one line of code, deploy, see `/video/*` lock to a single CDN.

The **protected content** beat exercises a different request path entirely. Different hostname, different Worker, no LB involvement, no CloudFront. The point is to show that "single origin" doesn't mean "single security posture" — the same R2 bucket serves both freely-cached marketing video and tightly-gated PHI-adjacent PDFs.

The **zero-egress** beat is implicit and continuous. Throughout the demo, an R2 metrics view shows the origin egress charge counter sitting at $0.00 while traffic flows through both CDNs. The contrast slide compares this to the same workload on S3-backed origins, where each CloudFront cache miss would meter S3 egress.

## What's deliberately not in scope

- A real BAA-eligible production deployment. This is shape-of-solution, not turnkey HIPAA. Cloudflare requires Enterprise-tier engagement for a BAA.
- A real IdP integration. The token endpoint is open in the demo; mention Cloudflare Access as the production path.
- Durable audit logging. KV is sufficient for the demo; production would route to a SIEM.
- Lambda@Edge or CloudFront Functions on the AWS side. The CloudFront pool is intentionally "vanilla" so the comparison is apples-to-apples.

## Honest caveats to surface in the meeting

- For PHI in production, the entire stack moves to Enterprise tier under a BAA. The demo is illustrative.
- The token-issuance endpoint in the demo is open. In production it sits behind Cloudflare Access tied to the customer's IdP.
- Audit logging in the demo is KV-backed and ephemeral. Production routes to durable storage / SIEM.
- The Worker layer is optional. Many customers run multi-CDN purely on the LB layer; the Worker is shown to demonstrate what becomes available, not what's required.
