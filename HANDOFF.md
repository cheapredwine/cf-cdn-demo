# Here's Where We Left Off

**Date:** 2026-05-06  
**Status:** Demo infrastructure is built and mostly verified. One issue remains.

---

## ✅ What's Done

You have a working multi-CDN demo on `jsherron.com`:

- **R2 bucket** with demo images, video, PDFs
- **Cloudflare Worker** serving the CF pool (`cf-pool.demo.jsherron.com`)
- **CloudFront distribution** serving the AWS pool (`cloudfront-pool.demo.jsherron.com`)
- **Load Balancer** (`assets.demo.jsherron.com`) with two healthy pools
- **Secure Worker** (`secure.demo.jsherron.com`) — issues JWT tokens, serves protected PDFs
- **Egress meter** (`meter.demo.jsherron.com`) — shows `$0.00` and cost comparisons
- **Patient portal** (`multicdn-demo-portal.pages.dev`) — generates 60-second links
- **Audit view** (`multicdn-demo-audit.pages.dev`) — live table of access attempts

## ⚠️ The One Remaining Issue

**Load Balancer verification is blocked on your Mac by Cloudflare WARP.**

- `curl` and Python scripts fail with SSL errors when hitting `assets.demo.jsherron.com`
- This is because WARP intercepts HTTPS traffic and the command-line tools don't trust its CA
- **The LB is working** — both pools show healthy in the dashboard
- **You just can't test it from this terminal**

### How to verify it works:

**Option A: Browser (easiest)**
1. Open Chrome/Safari
2. Go to `https://assets.demo.jsherron.com/public/images/logo.png`
3. Open DevTools → Network → click the request
4. Look at response headers — should show `served-by: cf-edge` or `served-by: cloudfront`
5. Refresh 5-10 times — should see both

**Option B: Disable WARP temporarily**
```bash
warp-cli disconnect
# test
curl -sI https://assets.demo.jsherron.com/public/images/logo.png | grep served-by
warp-cli connect
```

**Option C: Another device**
- Test from your phone (not on WARP)
- Or from a colleague's machine

## 🔧 What Still Needs Doing

1. **Verify LB steering** — confirm 50/50 mix from a browser
2. **Add Pages custom domains** (if not done):
   - `portal.demo.jsherron.com` → portal Pages project
   - `audit.demo.jsherron.com` → audit Pages project
3. **Run the full verification script** from a non-WARP machine
4. **Do a dry run** of the 15-minute demo before your meeting

## 📁 Files You Should Know About

- `STATE.md` — full inventory of every resource created (for teardown)
- `RESTART.md` — technical details for the next agent session
- `scripts/verify-all.sh` — automated verification script
- `src/workers/` — the three Worker scripts
- `src/pages/` — the two HTML pages (portal + audit)

## 💰 Monthly Cost If Left Running

~$5-10/month (Load Balancer + CloudFront + R2 storage)

## 🗑️ Teardown When Done

See `STATE.md` for the full teardown checklist.

---

**Bottom line:** The demo is built. The only thing left is confirming the Load Balancer serves from both CDNs, which requires testing from outside this WARP-enabled terminal.
