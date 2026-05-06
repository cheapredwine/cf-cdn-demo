# Multi-CDN Demo — Restart Documentation

**Created:** 2026-05-06
**Status:** Infrastructure deployed, needs final LB verification from non-WARP network

---

## Quick Status

| Component | URL | Status | Notes |
|---|---|---|---|
| R2 Bucket | `multicdn-demo-20260505-2351` | ✅ 12 objects | Public + private prefixes |
| CF Pool Worker | `cf-pool.demo.jsherron.com` | ✅ Active | Returns `served-by: cf-edge` |
| CloudFront Pool | `cloudfront-pool.demo.jsherron.com` | ✅ Active | Returns `served-by: cloudfront` |
| Load Balancer | `assets.demo.jsherron.com` | ⚠️ Deployed, pools healthy | Verification blocked by local WARP |
| Secure Worker | `secure.demo.jsherron.com` | ✅ Active | JWT + protected content |
| Egress Meter | `meter.demo.jsherron.com` | ✅ Active | Shows `$0.00` + comparisons |
| Portal Pages | `multicdn-demo-portal.pages.dev` | ✅ Deployed | Patient portal UI |
| Audit Pages | `multicdn-demo-audit.pages.dev` | ✅ Deployed | Live audit table |

---

## What's Working

### Phase 1-4: R2 + Workers ✅
- All Workers deployed and responding
- R2 bucket accessible
- CloudFront distribution serving correctly

### Phase 5: Load Balancer ⚠️
- **Both pools show healthy** (`1 of 1`)
- DNS record exists for `assets.demo.jsherron.com`
- **Local testing fails due to Cloudflare WARP intercepting TLS**
- **Needs verification from non-WARP network** (browser without WARP, or `warp-cli disconnect`)

### Phase 6-7: Protected Content + Meter ✅
- Token issuance works
- Protected PDF serves correctly
- Audit log records access
- Meter page renders with correct numbers

---

## Known Issues

### 1. Local WARP Interference
**Symptom:** `curl` and Python fail with `SSL_ERROR_SYSCALL` when hitting `assets.demo.jsherron.com`
**Root Cause:** Cloudflare WARP on this Mac intercepts HTTPS traffic with its own CA
**Fix:** Test from browser or `warp-cli disconnect` before running verification

### 2. No KV Write Permissions
**Symptom:** Workers with KV bindings fail to deploy with `code: 10023`
**Workaround:** Migrated audit logging and egress meter from KV to R2
**Impact:** Minimal — R2 works fine for demo-scale data

### 3. ACM Certificate Slow Validation
**Symptom:** First cert stuck in PENDING_VALIDATION for 10+ minutes
**Resolution:** Created second cert which validated immediately
**Note:** First cert (`dde7836f...`) deleted, using second cert (`61445144...`)

---

## To Verify Load Balancer

From a non-WARP machine or after disconnecting WARP:

```bash
# Test steering
for i in {1..10}; do
  curl -sI https://assets.demo.jsherron.com/public/images/providers/rahman.jpg | grep -i served-by
done

# Should show mix of:
# served-by: cf-edge
# served-by: cloudfront
```

Or in browser DevTools:
```javascript
fetch('https://assets.demo.jsherron.com/public/images/logo.png')
  .then(r => console.log(r.headers.get('served-by')))
```

---

## Resources Created

### Cloudflare
- **Zone:** jsherron.com (Zone ID: `6bcf8859da225392d8fae3351eb5de3e`)
- **Account:** JSherron Test Account (`1ddebf6f9507d3fc9052158be9d42dee`)
- **R2 Bucket:** `multicdn-demo-20260505-2351`
- **Workers:**
  - `multicdn-demo-public-steering` → `cf-pool.demo.jsherron.com`
  - `multicdn-demo-secure` → `secure.demo.jsherron.com`
  - `multicdn-demo-meter` → `meter.demo.jsherron.com`
- **KV Namespace:** `multicdn-demo-audit-20260505-2351` (id: `fdbdbb94864b4fb5bbdc19a011584f0a`) — unused
- **Pages Projects:**
  - `multicdn-demo-portal`
  - `multicdn-demo-audit`
- **Load Balancer:** `assets.demo.jsherron.com` (created via dashboard)
  - Pool: `pool-cf-20260505-2351`
  - Pool: `pool-cloudfront-20260505-2351`

### AWS
- **Account:** 512629184821
- **IAM User:** `cf-multicdn-demo-20260505-2351`
- **CloudFront Distribution:** `E362FEEO2DM9NE`
- **ACM Certificate:** `arn:aws:acm:us-east-1:512629184821:certificate/61445144-6bc4-4f98-96ac-950013484a1d`
- **Response Headers Policy:** `c9fc8768-3860-4ec0-b623-10848f3061f0`

### DNS Records
All created in Cloudflare dashboard:
- `cf-pool.demo` → Worker (orange)
- `cloudfront-pool.demo` → CloudFront (gray)
- `assets.demo` → Load Balancer (orange)
- `secure.demo` → Worker (orange)
- `portal.demo` → Pages (orange)
- `audit.demo` → Pages (orange)
- `meter.demo` → Worker (orange)
- `_851748144...cloudfront-pool.demo` → ACM validation (gray)

---

## Files in This Repo

```
cf-cdn-demo/
├── src/
│   ├── workers/
│   │   ├── public-steering/index.ts   # LB pool Worker
│   │   ├── secure/index.ts            # JWT + protected content
│   │   └── meter/index.ts             # Egress meter page
│   ├── pages/
│   │   ├── portal/index.html          # Patient portal UI
│   │   └── audit/index.html           # Audit log UI
│   └── types.ts                       # Shared types
├── scripts/
│   ├── generate-seed.py               # Generates demo images/PDFs
│   └── verify-all.sh                  # End-to-end verification
├── seed/                              # Generated demo assets
├── wrangler.public.toml               # Public Worker config
├── wrangler.secure.toml               # Secure Worker config
├── wrangler.meter.toml                # Meter Worker config
├── STATE.md                           # Resource inventory
├── RESTART.md                         # This file
└── README.md
```

---

## To Pick Up Where We Left Off

1. **Verify LB steering** from non-WARP machine
2. **Add Pages custom domains** if not already done:
   - `portal.demo.jsherron.com` → `multicdn-demo-portal`
   - `audit.demo.jsherron.com` → `multicdn-demo-audit`
3. **Run full verification:** `./scripts/verify-all.sh`
4. **Test token expiry** (wait 65s)
5. **Demo is ready**

---

## Teardown Order (When Done)

1. Delete Load Balancer + pools
2. Delete CloudFront distribution
3. Delete ACM certificate
4. Delete Workers (public, secure, meter)
5. Delete Pages projects
6. Delete R2 bucket + objects
7. Delete DNS records
8. Delete IAM user
9. Delete KV namespace
