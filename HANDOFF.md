# Here's Where We Left Off

**Date:** 2026-05-06 (updated 20:30Z)
**Status:** ✅ **Demo fully operational.** All blockers resolved.

---

## What's working

| Component | URL | Verified |
|---|---|---|
| R2 Bucket | `multicdn-demo-20260505-2351` | ✓ |
| CF Pool Worker | `cf-pool.demo.jsherron.com` | ✓ 200, `served-by: cf-edge` |
| CloudFront Pool | `cloudfront-pool.demo.jsherron.com` | ✓ 200, `/healthcheck.txt` returns `ok` |
| Load Balancer | `assets.demo.jsherron.com` | ✓ 200, both pools healthy, Host overrides set |
| Secure Worker | `secure.demo.jsherron.com` | ✓ JWT issue + protected content + audit; CORS verified |
| Egress Meter | `meter.demo.jsherron.com` | ✓ HTML renders; bytes counter wired |
| Portal Pages | `portal.demo.jsherron.com` and `multicdn-demo-portal.pages.dev` | ✓ Custom domain attached |
| Audit Pages | `audit.demo.jsherron.com` and `multicdn-demo-audit.pages.dev` | ✓ Custom domain attached |
| workers.dev fallbacks | `multicdn-demo-{public-steering,secure,meter}.jsherron-test-account.workers.dev` | ✓ Enabled and serving |

## What got resolved 2026-05-06

### Code (PR #1, merged into branch `feat/run-of-show-reconciliation`)
- Code gates were 14 errors — now green with 41 tests
- Toolchain bumped to current majors; vitest config migrated to `cloudflareTest()` plugin
- `wrangler.toml` collapsed to single config with `[env.public|secure|meter]`
- Real `path_routing` (302 to CloudFront for non-video paths)
- CORS on secure Worker
- Egress-meter byte counter wired into both write-side workers
- Pages custom domains attached for portal and audit
- All three workers redeployed

### Infrastructure (dashboard, today)
- **Wildcard SSL cert** `*.demo.jsherron.com` ordered and active
- **CloudFront pool monitor** path corrected to `/healthcheck.txt` (was probing `/public/healthcheck.txt`, which CloudFront's origin-path-prepend turned into a non-existent key)
- **Host header overrides** added to both LB pools so each pool origin receives requests with SNI/Host matching its own hostname (CloudFront's ACM cert only covers `cloudfront-pool.demo.jsherron.com`, not the inbound LB hostname)

## What's left

Nothing infra-blocking. Optional polish:

1. **Demo dry run** with WARP off, walking the full 15-minute run-of-show
2. **Generate real meter traffic** so the screenshot for AE follow-up shows a non-trivial bytes-served number
3. **Merge PR #1** if you've reviewed it: https://github.com/cheapredwine/this-repo/pull/1
4. **Update README.md** — still has template content (not blocking)

## Files you should know about

- `STATE.md` — full inventory; updated to reflect operational state
- `RESTART.md` — technical context for next agent session
- `TODO.md` — now empty of P1/P2 items; only polish remains
- `docs/fix-assets-demo-ssl.md` — runbook for the LB SSL/health/host-override fix sequence (kept as reference)
- `multicdn-demo-run-of-show-*.md` — updated 2026-05-06 with env-based deploys, WARP note, demo_seed, longer LB-flip wait, real path_routing
- `wrangler.toml` — single source of truth, env-based
- `src/lib/meter.ts` — shared bytes-counter helper

## Verify from your end

```bash
warp-cli disconnect
for i in {1..10}; do
  curl -sI https://assets.demo.jsherron.com/images/providers/rahman.jpg | grep -i served-by
done
warp-cli connect
```

Expected: roughly 50/50 mix of `served-by: cf-edge` and `served-by: cloudfront`.

## Monthly cost if left running

~$5–10/month (LB ~$5 + CloudFront ~$0–5 depending on traffic + R2 storage). workers.dev URLs are free.

## Teardown when done

See `STATE.md` for the full checklist. Don't forget the wildcard cert (delete from SSL/TLS → Edge Certificates) and the workers.dev subdomains (disable per worker).

---

**Bottom line:** demo is ready. Take a screenshot of the meter after generating some traffic, do a dry run, and you're set.
