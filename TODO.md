# Agent TODO — Next Session

**Status:** Demo infrastructure deployed. One verification issue remains.

---

## 🔴 Priority 1: Verify Load Balancer Steering

**Problem:** Local Cloudflare WARP on the Mac intercepts HTTPS traffic, causing `SSL_ERROR_SYSCALL` when curl/Python hit `assets.demo.jsherron.com`. This prevents automated verification.

**Solution:** Verify from a non-WARP context:
- [ ] Ask user to open `https://assets.demo.jsherron.com/public/images/logo.png` in Chrome/Safari
- [ ] Have them check DevTools → Network → Response Headers for `served-by`
- [ ] Refresh 10x, confirm mix of `cf-edge` and `cloudfront`
- [ ] Or run `warp-cli disconnect`, run `./scripts/verify-all.sh`, then `warp-cli connect`

**Expected result:** Roughly 50/50 mix of `served-by: cf-edge` and `served-by: cloudfront`

---

## 🟡 Priority 2: Add Pages Custom Domains

**Status:** Pages projects deployed but may not have custom domains attached.

- [ ] Check if `portal.demo.jsherron.com` resolves
- [ ] Check if `audit.demo.jsherron.com` resolves
- [ ] If not, add via Cloudflare dashboard:
  - Pages → `multicdn-demo-portal` → Custom domains → `portal.demo.jsherron.com`
  - Pages → `multicdn-demo-audit` → Custom domains → `audit.demo.jsherron.com`

---

## 🟡 Priority 3: Final Verification

Once LB is confirmed working:
- [ ] Run `./scripts/verify-all.sh` from non-WARP context
- [ ] Test token expiry manually (issue token, wait 65s, verify 403)
- [ ] Test scope mismatch (issue token for one path, access another)
- [ ] Verify meter shows non-zero after generating traffic

---

## 🟢 Priority 4: Demo Prep (If Time)

- [ ] Generate `scripts/verify-all.sh` dry-run output for user
- [ ] Prepare curl commands from `multicdn-demo-run-of-show-20260505T2317Z.md`
- [ ] Verify all 5 demo tabs load correctly:
  1. `https://meter.demo.jsherron.com/`
  2. `https://multicdn-demo-portal.pages.dev/` (or `portal.demo.jsherron.com`)
  3. `https://multicdn-demo-audit.pages.dev/` (or `audit.demo.jsherron.com`)
  4. Cloudflare LB dashboard
  5. Terminal with curl loops ready

---

## 🟢 Priority 5: Documentation

- [ ] Update `README.md` with actual project description
- [ ] Remove template boilerplate
- [ ] Verify `STATE.md` has all resource IDs accurate
- [ ] Commit all changes

---

## Known Gotchas

1. **WARP:** Always test from non-WARP context or use browser
2. **Wrangler auth:** OAuth token expires; may need `wrangler login` on restart
3. **R2 uploads:** Must use `--remote` flag or uploads go to local dev
4. **DNS propagation:** Custom domains take 30-60s after deploy
5. **CloudFront deploys:** 10-15 minutes for distribution updates

## Resource Inventory

See `STATE.md` for full list. Key IDs:
- Zone: `6bcf8859da225392d8fae3351eb5de3e`
- Account: `1ddebf6f9507d3fc9052158be9d42dee`
- AWS Account: `512629184821`
- R2 Bucket: `multicdn-demo-20260505-2351`
- CloudFront: `E362FEEO2DM9NE`
- ACM Cert: `arn:aws:acm:us-east-1:512629184821:certificate/61445144-6bc4-4f98-96ac-950013484a1d`
