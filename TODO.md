# Agent TODO — Next Session

**Status:** Code gates green, meter wired, configs reconciled. Two infra tasks block the demo.

---

## 🔴 Priority 1: Redeploy Workers with 2026-05-06 code changes

The meter incrementer and `STEERING_MODE`/`ROLLOUT_PCT` vars exist in the repo but aren't live yet.

```bash
npx wrangler login   # if token expired
npx wrangler deploy --config wrangler.public.toml   # meter wiring + steering vars
npx wrangler deploy --config wrangler.secure.toml   # meter wiring
npx wrangler deploy --config wrangler.meter.toml    # parity (no behavior change)
```

Verify after deploy:
- `curl -sI https://cf-pool.demo.jsherron.com/public/images/logo.png` → 200, `served-by: cf-edge`
- Visit `https://meter.demo.jsherron.com/` → still `$0.00` until traffic generates real bytes
- Run a few requests, refresh meter — "Bytes served from R2" should show non-zero

---

## 🔴 Priority 2: Order wildcard SSL cert

**Problem:** `assets.demo.jsherron.com` has no SSL certificate. LB virtual hostnames don't auto-provision like Workers/R2 do.

**Solution (recommended — wildcard):**
- [ ] Go to **SSL/TLS → Edge Certificates**
- [ ] (Optional) Delete demo-specific certs (`*.cf-pool.demo`, `*.meter.demo`, `*.secure.demo`) — cleaner with wildcard
- [ ] Click **Order Advanced Certificate**
- [ ] Add hostnames: `*.demo.jsherron.com`, `demo.jsherron.com`
- [ ] Validation: TXT, validity 90d
- [ ] Wait 1–2 minutes for provisioning
- [ ] Test with browser: `https://assets.demo.jsherron.com/public/images/logo.png`

**Why wildcard:** One cert covers ALL demo subdomains (assets, meter, secure, cf-pool, cloudfront-pool, portal, audit). Prevents gaps like this in the future.

---

## 🔴 Priority 3: Verify Load Balancer Steering

Once SSL is active and workers are redeployed:
- [ ] Open `https://assets.demo.jsherron.com/public/images/logo.png` in Chrome/Safari
- [ ] Check DevTools → Network → Response Headers for `served-by`
- [ ] Refresh 10x, confirm mix of `cf-edge` and `cloudfront`

**Expected result:** Roughly 50/50 mix of `served-by: cf-edge` and `served-by: cloudfront`

---

## 🟡 Priority 4: Add Pages Custom Domains

**Status:** Pages projects deployed; DNS exists; custom domains may not be attached on the project side.

- [ ] `curl -sI https://portal.demo.jsherron.com/` — if 522/525 or wrong content, attach domain
- [ ] `curl -sI https://audit.demo.jsherron.com/` — same check
- [ ] If needed:
  - Pages → `multicdn-demo-portal` → Custom domains → `portal.demo.jsherron.com`
  - Pages → `multicdn-demo-audit` → Custom domains → `audit.demo.jsherron.com`

---

## 🟡 Priority 5: Final Verification

Once SSL is active and Workers are redeployed:
- [ ] `warp-cli disconnect && ./scripts/verify-all.sh && warp-cli connect`
- [ ] Test token expiry manually (issue token, wait 65s, verify 403)
- [ ] Test scope mismatch (issue token for one path, access another)
- [ ] **Generate real traffic and verify meter shows non-zero** — this is the new behavior the meter wiring unlocks

> Note: `verify-all.sh` disables TLS verification globally (`ssl.CERT_NONE`). Useful with WARP, but it cannot catch a bad cert. If you want an honest TLS check before the demo, drop those lines temporarily.

---

## 🟢 Priority 6: Demo Prep (If Time)

- [ ] Verify all 5 demo tabs load:
  1. `https://meter.demo.jsherron.com/`
  2. `https://multicdn-demo-portal.pages.dev/` (or `portal.demo.jsherron.com`)
  3. `https://multicdn-demo-audit.pages.dev/` (or `audit.demo.jsherron.com`)
  4. Cloudflare LB dashboard
  5. Terminal with curl loops ready
- [ ] Take a fresh meter screenshot **after running real traffic** (now possible with Gap 1 fix). Send to AE for follow-up emails.
- [ ] Prepare curl commands from `multicdn-demo-run-of-show-20260505T2317Z.md`

---

## 🟢 Priority 7: Documentation

- [x] `STATE.md` updated 2026-05-06 with R2 key map + code state
- [x] `HANDOFF.md` updated with deploy step + meter status
- [x] `RESTART.md` updated with current code state
- [x] Build manual got KV→R2 migration note at top
- [ ] Update `README.md` with actual project description (still has template content)
- [ ] Commit the 2026-05-06 changes

---

## Known Gotchas

1. **WARP:** Always test from non-WARP context or use browser. Local `curl`/`python` will get TLS errors hitting CF-proxied hostnames.
2. **LB SSL Certificate:** LB hostnames do NOT auto-provision SSL. Must create Advanced Certificate explicitly.
3. **CloudFront Health Check:** Monitor path must be `/healthcheck.txt` (not `/public/healthcheck.txt`) because CloudFront origin path strips `/public/`.
4. **Wrangler auth:** OAuth token expires; may need `wrangler login` on restart.
5. **R2 uploads:** Must use `--remote` flag or uploads go to local dev.
6. **DNS propagation:** Custom domains take 30-60s after deploy.
7. **CloudFront deploys:** 10-15 minutes for distribution updates.
8. **Meter counter:** Non-atomic R2 read-modify-write. Concurrent writes may lose a few bytes per hour. Acceptable per build manual.
9. **`verify-all.sh` TLS:** Script disables verification globally — won't catch bad certs.

## Resource Inventory

See `STATE.md` for full list. Key IDs:
- Zone: `6bcf8859da225392d8fae3351eb5de3e`
- Account: `1ddebf6f9507d3fc9052158be9d42dee`
- AWS Account: `512629184821`
- R2 Bucket: `multicdn-demo-20260505-2351`
- CloudFront: `E362FEEO2DM9NE`
- ACM Cert: `arn:aws:acm:us-east-1:512629184821:certificate/61445144-6bc4-4f98-96ac-950013484a1d`
- KV Namespace (unused): `fdbdbb94864b4fb5bbdc19a011584f0a`
