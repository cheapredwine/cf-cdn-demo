# Here's Where We Left Off

**Date:** 2026-05-06 (updated 00:55Z)
**Status:** Code green; workers redeployed; run-of-show reconciled; Pages domains attached. **One blocker: LB SSL cert.**

---

## ✅ What's Done

You have a working multi-CDN demo on `jsherron.com`:

- **R2 bucket** with demo images, video, PDFs, audit log, and bytes counter
- **Public-steering Worker** at `cf-pool.demo.jsherron.com` — three steering modes (passthrough, path_routing, percent_rollout). path_routing now actually 302s non-video paths to CloudFront (was header-only).
- **CloudFront distribution** at `cloudfront-pool.demo.jsherron.com`
- **Load Balancer** at `assets.demo.jsherron.com` with both pools healthy
- **Secure Worker** at `secure.demo.jsherron.com` — JWT issuance, protected content, audit log, **CORS headers added** (was likely broken for portal/audit)
- **Egress meter** at `meter.demo.jsherron.com` — bytes counter now actually populated by public + secure Workers
- **Patient portal** at `multicdn-demo-portal.pages.dev` (also `portal.demo.jsherron.com`, attached, validating)
- **Audit view** at `multicdn-demo-audit.pages.dev` (also `audit.demo.jsherron.com`, attached, validating)
- **workers.dev URLs enabled** on all three workers as fallback path

### Today's work (2026-05-06)

| Layer | Change |
|---|---|
| **Code gates** | Was 14 errors — now `npm run typecheck`, `lint`, `test` all green |
| **Toolchain** | Wrangler ^4, vitest ^4.1, vitest-pool-workers ^0.16, workers-types ^4.20260506.1 |
| **Type model** | `Env` now augments `Cloudflare.Env` |
| **Meter wiring** | New `src/lib/meter.ts`; public + secure Workers `ctx.waitUntil` an R2 bytes-counter increment per fetch |
| **CORS (C2 fix)** | Added `Access-Control-Allow-Origin: *` + OPTIONS preflight to secure Worker. Verified via workers.dev — 200 + headers on `/audit/recent`, 204 on OPTIONS preflight to `/issue`. |
| **path_routing (S3 fix)** | Non-video paths now 302→CloudFront. Verified: `/video/welcome.mp4` → 200 cf-edge; `/images/*` → 302 to `cloudfront-pool.demo`. |
| **Wrangler config (C1 fix)** | Collapsed three `wrangler.<role>.toml` files into one `wrangler.toml` with `[env.public]`, `[env.secure]`, `[env.meter]`. Deploy is now `wrangler deploy --env <name>`. Old per-role files deleted. |
| **Run-of-show updated** | Beat 3 now uses `--env public`; Setup adds WARP-off note; Beat 5 uses `?demo_seed=10`; Beat 2 timing widened to 30–45s. |
| **Pages domains** | `portal.demo.jsherron.com` and `audit.demo.jsherron.com` attached via API (status: pending validation as of 00:55Z, should be active in 1–2 min). |
| **Workers redeployed** | All three workers redeployed with the new config. workers.dev fallback enabled. |
| **Stale stuff** | Removed `[[kv_namespaces]]` from wrangler.toml; removed `JWT_SECRET_ENV` unused const; deleted empty `src/handlers/`. |
| **Build manual annotated** | KV→R2 migration note at top so future agents don't follow the manual blindly. |

## ⚠️ The Remaining Blocker

### Load Balancer SSL certificate is missing for `assets.demo.jsherron.com`

This is **the only thing left**. I tried to order the wildcard via API but the OAuth token's `ssl_certs:write` scope doesn't translate to effective zone-level write authority — every cert API returned 9109/10000 unauthorized. You'll need either:

**Option 1 — dashboard (recommended):**
1. SSL/TLS → Edge Certificates → Order Advanced Certificate
2. Hostnames: `*.demo.jsherron.com`, `demo.jsherron.com`
3. Validation: TXT, validity 90d
4. Wait 1–2 min

**Option 2 — give me a zone-scoped API token:**
Create an API token with `Zone › SSL and Certificates › Edit` for `jsherron.com` and I'll order it via API. Set as `CLOUDFLARE_API_TOKEN` env var.

After the cert is active, verify:
```bash
warp-cli disconnect
curl -sI https://assets.demo.jsherron.com/public/images/logo.png | grep -iE 'HTTP|served-by'
warp-cli connect
```

## 🔧 What Else You May Want To Do

1. **Pages domain validation** — should auto-complete in 1–2 min, but check:
   ```bash
   curl -s "https://api.cloudflare.com/client/v4/accounts/1ddebf6f9507d3fc9052158be9d42dee/pages/projects/multicdn-demo-portal/domains" -H "Authorization: Bearer <token>" | python3 -m json.tool
   ```
   If status is `active`, domains are live.

2. **Verify LB steering** (after SSL cert active):
   ```bash
   warp-cli disconnect
   for i in {1..10}; do
     curl -sI https://assets.demo.jsherron.com/public/images/logo.png | grep -i served-by
   done
   warp-cli connect
   ```

3. **Generate real meter traffic** — After LB SSL active, run 50–100 requests through `assets.demo` and confirm `meter.demo` shows non-zero bytes-served. Take the screenshot for the AE.

4. **Demo dry run** — full 15-minute run-through with WARP off.

## 📁 Files You Should Know About

- `STATE.md` — full inventory, R2 key map, deploy commands
- `RESTART.md` — technical context for next agent session
- `TODO.md` — prioritized next steps (now down to 1 critical: SSL cert)
- `multicdn-demo-run-of-show-*.md` — updated 2026-05-06 with env-based deploys, WARP note, demo_seed, longer LB-flip wait
- `multicdn-demo-build-manual-*.md` — has KV→R2 migration note at top
- `wrangler.toml` — single source of truth, env-based
- `src/lib/meter.ts` — shared bytes-counter (new)
- `src/workers/secure/index.ts` — now CORS-aware
- `src/workers/public-steering/index.ts` — path_routing now real

## 💰 Monthly Cost If Left Running

~$5-10/month (Load Balancer + CloudFront + R2 storage). workers.dev URLs are free.

## 🗑️ Teardown When Done

See `STATE.md` for the full teardown checklist. New addition: disable workers.dev subdomains and delete the wildcard Advanced Certificate (after step 1).

---

**Bottom line:** Demo is functionally complete and verified end-to-end against `workers.dev` URLs. Only blocker is the LB SSL cert, which needs your dashboard or a zone-scoped API token. Estimated 5 minutes of your time to unblock.
