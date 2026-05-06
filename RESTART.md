# Multi-CDN Demo — Restart Documentation

**Created:** 2026-05-06
**Last updated:** 2026-05-06T00:35Z
**Status:** Code green; configs reconciled; Layer 2 (LB SSL + redeploy + verify) still open.

---

## Quick Status

| Component | URL | Status | Notes |
|---|---|---|---|
| R2 Bucket | `multicdn-demo-20260505-2351` | ✅ 12 objects | Public + private prefixes; now also `audit/` and `meter/` keys |
| CF Pool Worker | `cf-pool.demo.jsherron.com` | ⚠️ Deployed (old code) | Code updated 2026-05-06; needs redeploy for meter wiring + steering vars |
| CloudFront Pool | `cloudfront-pool.demo.jsherron.com` | ✅ Active | Returns `served-by: cloudfront` |
| Load Balancer | `assets.demo.jsherron.com` | ⚠️ Deployed, **no SSL cert** | Pools healthy; SSL blocked on wildcard cert order |
| Secure Worker | `secure.demo.jsherron.com` | ⚠️ Deployed (old code) | Code updated 2026-05-06; needs redeploy for meter wiring |
| Egress Meter | `meter.demo.jsherron.com` | ⚠️ Deployed (old code) | Code updated 2026-05-06; previously always read $0.00 because no writer existed |
| Portal Pages | `multicdn-demo-portal.pages.dev` | ✅ Deployed | Patient portal UI |
| Audit Pages | `multicdn-demo-audit.pages.dev` | ✅ Deployed | Live audit table |

---

## What Changed 2026-05-06 (Layer 1 cleanup)

### Code-gate green
- All three of `npm run typecheck`, `npm run lint`, `npm test` pass.
- Was 14 errors before (3 typecheck, 11 lint).

### Toolchain bumped
- `wrangler` ^3.0.0 → ^4.0.0
- `vitest` ^2.0.0 → ^4.1.0
- `@cloudflare/vitest-pool-workers` ^0.5.0 → ^0.16.0
- `@cloudflare/workers-types` ^4.0.0 → ^4.20260506.1
- Compat-date warning (`2025-04-01` not supported) is gone.

### Config API migration
- `vitest.config.ts` → `vitest.config.mts` (ESM-only package)
- Now uses `cloudflareTest()` plugin from `@cloudflare/vitest-pool-workers` (the old `defineWorkersConfig` was removed in 0.16).

### Type model change
- `Env` in `src/types.ts` now augments the global `Cloudflare.Env` namespace.
- `cloudflare:test`'s `env` is typed as `Cloudflare.Env`, so test code accepts it without per-test `ProvidedEnv` augmentation.

### Functional fixes from build manual review
1. **Meter incrementer wired.** Manual specifies both Workers update the bytes counter on each R2 fetch; neither did. Now both do, via `src/lib/meter.ts` and `ctx.waitUntil(incrementBytesServed(env, object.size))`. Non-atomic R/M/W per the manual's note.
2. **`wrangler.public.toml` was missing `STEERING_MODE`/`ROLLOUT_PCT`.** Added; live mode-toggling will work.
3. **`wrangler.toml` had a stale KV binding** (audit migrated to R2 long ago). Removed; commented why.
4. **Build manual** got a top-of-file note explaining the KV→R2 migration so future agents don't follow the manual blindly.

### Layout
- Deleted empty `src/handlers/` and original empty `src/lib/`.
- Re-created `src/lib/` with `meter.ts` (shared bytes counter helper).
- `meter/index.ts` now imports `currentHourKey` from the shared lib instead of duplicating it.
- `CLAUDE.md` File structure section updated to reality.

### Not deployed
None of the above is live until you run:
```bash
npx wrangler deploy --config wrangler.public.toml
npx wrangler deploy --config wrangler.secure.toml
npx wrangler deploy --config wrangler.meter.toml
```

---

## What's Working

### Phase 1-4: R2 + Workers ✅ (deployed, partial code drift)
- Workers deployed and responding
- R2 bucket accessible
- CloudFront distribution serving correctly
- Public + secure Worker code in repo is ahead of deployed; redeploy needed for meter to populate

### Phase 5: Load Balancer ⚠️
- **Both pools show healthy** (`1 of 1`)
- DNS record exists for `assets.demo.jsherron.com`
- **No SSL cert** — wildcard cert order pending
- **Local testing fails due to Cloudflare WARP intercepting TLS**

### Phase 6-7: Protected Content + Meter ⚠️
- Token issuance works
- Protected PDF serves correctly
- Audit log records access (R2-backed)
- **Meter previously always showed $0.00** because no writer existed — fixed in code, not yet deployed

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
**As of 2026-05-06:** stale KV binding removed from `wrangler.toml`; build manual annotated

### 3. ACM Certificate Slow Validation
**Symptom:** First cert stuck in PENDING_VALIDATION for 10+ minutes
**Resolution:** Created second cert which validated immediately
**Note:** First cert (`dde7836f...`) deleted, using second cert (`61445144...`)

### 4. `verify-all.sh` disables TLS globally
**Symptom:** Script uses `ssl.CERT_NONE` to work around WARP
**Impact:** Can't catch a bad/missing cert — passes vacuously even when SSL is broken
**Fix (deferred):** drop the `ctx` lines around line 26–28 if you want an honest TLS check

---

## To Verify Load Balancer (after wildcard cert + redeploy)

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
- **KV Namespace:** `multicdn-demo-audit-20260505-2351` (id: `fdbdbb94864b4fb5bbdc19a011584f0a`) — **unused** (binding removed from wrangler.toml 2026-05-06)
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
│   ├── index.ts                       # Default-config Worker (template stub, vitest target)
│   ├── types.ts                       # Augments Cloudflare.Env; re-exports as Env
│   ├── lib/
│   │   └── meter.ts                   # Shared bytes-counter helper (NEW 2026-05-06)
│   ├── workers/
│   │   ├── public-steering/index.ts   # LB pool Worker (now meter-instrumented)
│   │   ├── secure/index.ts            # JWT + protected content (now meter-instrumented)
│   │   └── meter/index.ts             # Egress meter UI (uses shared lib)
│   └── pages/
│       ├── portal/index.html          # Patient portal UI
│       └── audit/index.html           # Audit log UI
├── scripts/
│   ├── generate-seed.py               # Generates demo images/PDFs
│   └── verify-all.sh                  # End-to-end verification (note: ssl.CERT_NONE)
├── seed/                              # Generated demo assets
├── wrangler.toml                      # Default dev/test config (vitest reads this)
├── wrangler.public.toml               # Deploy: public-steering (now has STEERING_MODE/ROLLOUT_PCT)
├── wrangler.secure.toml               # Deploy: secure
├── wrangler.meter.toml                # Deploy: meter
├── vitest.config.mts                  # New cloudflareTest() plugin API
├── STATE.md                           # Resource inventory + R2 key map + code state
├── HANDOFF.md                         # Where we left off
├── TODO.md                            # Prioritized next steps
├── RESTART.md                         # This file
├── CLAUDE.md                          # Agent behavioral rules
├── AGENTS.md                          # Agent inventory (template, mostly empty)
├── README.md                          # Still has template content
└── multicdn-demo-*-20260505T2317Z.md  # Architecture, build manual, run-of-show, AE script
```

---

## To Pick Up Where We Left Off

1. **Order wildcard cert** for `*.demo.jsherron.com` (see TODO.md Priority 2)
2. **Redeploy three workers** to land 2026-05-06 code changes (see TODO.md Priority 1)
3. **Verify LB steering** from non-WARP machine
4. **Add Pages custom domains** if not already done
5. **Run `./scripts/verify-all.sh`**
6. **Generate real traffic** and confirm meter shows non-zero (this is the new behavior unlocked by the meter wiring)
7. **Test token expiry** (wait 65s)
8. **Demo dry run**

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
9. Delete KV namespace (`fdbdbb94864b4fb5bbdc19a011584f0a`) — was unused but provisioned
10. Delete the wildcard Advanced Certificate (after step 1)
