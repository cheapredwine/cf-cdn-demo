# Fix: `assets.demo.jsherron.com` returns no/bad SSL

**Status:** Open as of 2026-05-06T01:08Z.
**Symptom:** `curl -sI https://assets.demo.jsherron.com/public/images/logo.png` (with WARP off) returns a TLS error or `525 SSL handshake failed`. Browsers show `ERR_SSL_PROTOCOL_ERROR` or "your connection is not private."
**Impact:** Beat 2 of the run-of-show (the multi-CDN steering demo) cannot work. This is the single remaining blocker for the demo.

---

## Why

Cloudflare's **Universal SSL** scans the zone's DNS records and provisions edge certificates for what it finds. **Load Balancer virtual hostnames are not in the DNS zone** — they're managed by the LB service itself — so Universal SSL never discovers `assets.demo.jsherron.com` and never issues a cert for it.

A few related certs exist on the zone (`*.cf-pool.demo`, `*.meter.demo`, `*.secure.demo`) from earlier dashboard work, but none of them cover `assets.demo`. The build manual itself flagged this in Phase 5:

> Load Balancer hostnames **do not** automatically get SSL certificates. Unlike Workers or R2 custom domains (which auto-provision), LB virtual hostnames aren't visible to Universal SSL's DNS scanner.

So the fix is one-time: order an Advanced Certificate that covers the hostname.

---

## Fix (recommended): one wildcard for all demo subdomains

This replaces the three subdomain-specific certs and prevents the same gap from happening if you add new `*.demo` hostnames later.

### Option A — Dashboard (5 min)

1. Cloudflare → **jsherron.com** zone → **SSL/TLS → Edge Certificates**
2. (Optional, cleaner) Delete the existing demo-scoped certs:
   - `*.cf-pool.demo.jsherron.com`
   - `*.meter.demo.jsherron.com`
   - `*.secure.demo.jsherron.com`
   Do **not** delete Universal SSL or any apex certificate. The wildcard you're about to create will supersede the three.
3. Click **Order Advanced Certificate**.
4. Hostnames: `*.demo.jsherron.com`, `demo.jsherron.com`
5. Validation method: **TXT** (works for wildcards; HTTP doesn't).
6. Validity: 90 days. Certificate Authority: Google or Let's Encrypt — either works.
7. Submit. Status moves `pending_validation` → `active` in 1–2 minutes.

This single cert then covers:

| Hostname | Currently covered by | After wildcard |
|---|---|---|
| `assets.demo.jsherron.com` (LB) | **nothing** ← the bug | wildcard ✓ |
| `cf-pool.demo.jsherron.com` | `*.cf-pool.demo` (overlap) | wildcard ✓ |
| `cloudfront-pool.demo.jsherron.com` | ACM cert on CloudFront | wildcard ✓ (Cloudflare-edge side) |
| `secure.demo.jsherron.com` | `*.secure.demo` (overlap) | wildcard ✓ |
| `meter.demo.jsherron.com` | `*.meter.demo` (overlap) | wildcard ✓ |
| `portal.demo.jsherron.com` | per-domain Pages cert | wildcard ✓ (Pages cert kept too) |
| `audit.demo.jsherron.com` | per-domain Pages cert | wildcard ✓ |

### Option B — API (preferred if scripted)

Requires a token with `Zone › SSL and Certificates › Edit` for `jsherron.com`. The OAuth token wrangler uses today does **not** have this scope effectively (the listed scope returns 9109 unauthorized at zone level — see prior PR description).

Create a zone-scoped API token at https://dash.cloudflare.com/profile/api-tokens:

- Permissions: `Zone › SSL and Certificates › Edit`, `Zone › Zone › Read`
- Zone resources: include `jsherron.com`

Then:

```bash
export CLOUDFLARE_API_TOKEN=<the new token>
export ZONE=6bcf8859da225392d8fae3351eb5de3e

curl -sX POST "https://api.cloudflare.com/client/v4/zones/$ZONE/ssl/certificate_packs/order" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "advanced",
    "hosts": ["*.demo.jsherron.com", "demo.jsherron.com"],
    "validation_method": "txt",
    "validity_days": 90,
    "certificate_authority": "google",
    "cloudflare_branding": false
  }' | python3 -m json.tool
```

Successful response shows `"status": "pending_validation"` and a TXT validation record that's auto-installed in Cloudflare DNS (since the zone is on Cloudflare). Validation typically completes in 1–2 minutes.

Poll status:

```bash
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE/ssl/certificate_packs?status=all" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  python3 -c "import json, sys; [print(f\"{p['hosts']}  {p['status']}\") for p in json.load(sys.stdin)['result']]"
```

Wait until the line containing `*.demo.jsherron.com` shows `active`.

---

## Verification

WARP intercepts TLS to `*.jsherron.com` from this Mac, so verify either from a non-WARP context (browser, phone, colleague's machine) or by disconnecting first:

```bash
warp-cli disconnect

# Should return HTTP 200, no TLS warning, served-by header present
curl -sI https://assets.demo.jsherron.com/public/images/logo.png | head -10

# 10 requests should mix cf-edge / cloudfront roughly 50/50
for i in {1..10}; do
  curl -sI https://assets.demo.jsherron.com/public/images/logo.png | grep -i served-by
done

warp-cli connect
```

Expected output of the loop, with both pools healthy:

```
served-by: cf-edge
served-by: cloudfront
served-by: cloudfront
served-by: cf-edge
...
```

If you see only `cf-edge`, the CloudFront pool is unhealthy — check its monitor path is `/healthcheck.txt` (no `/public/` prefix; CloudFront's origin path adds it). If you see only `cloudfront`, the Cloudflare pool's monitor is failing — confirm the public-steering Worker is deployed (`wrangler deployments list --env public`) and serving `/public/healthcheck.txt`.

If TLS still fails after the cert is `active`:
- Wait another minute; edge propagation can lag the API status by ~60 seconds.
- Check there isn't a stuck SSL/TLS mode mismatch: Zone → SSL/TLS → Overview should show **Full (strict)** for the LB origins to negotiate cleanly.

---

## Fallbacks if the cert can't be ordered before the demo

Both fallbacks bypass `assets.demo` entirely. The customer doesn't see them, but the SE knows the demo isn't running through the LB.

1. **Run Beat 2 against pool hostnames directly.** `cf-pool.demo.jsherron.com` and `cloudfront-pool.demo.jsherron.com` already have working SSL. Show two terminal panes, one curl loop each, narrate the multi-CDN story manually. The narrative loses the "LB makes failover operational" punch but keeps the "single origin, two CDNs" point.

2. **Run against the public-steering worker's `workers.dev` URL.** `multicdn-demo-public-steering.jsherron-test-account.workers.dev` is reachable today and has a Cloudflare-managed cert independent of the zone. Same caveat: this is the CF pool only, not the LB.

The portal and audit Pages also have working `*.pages.dev` URLs as fallbacks.

---

## Definition of done

- [ ] `curl -sI https://assets.demo.jsherron.com/public/images/logo.png` returns HTTP 200 with no TLS warning
- [ ] 10x curl loop shows both `served-by: cf-edge` and `served-by: cloudfront`
- [ ] Browser navigation to `https://assets.demo.jsherron.com/public/images/logo.png` shows the image with no security warning
- [ ] `STATE.md` and `HANDOFF.md` updated to mark this issue closed
- [ ] (Optional) The three superseded subdomain certs deleted

After this is done, the demo is fully ready. There are no other open infrastructure blockers as of 2026-05-06T01:08Z.
