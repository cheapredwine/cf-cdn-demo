# Multi-CDN Demo — Build Manual

**Version:** 20260505T2317Z
**Audience:** An agentic coding assistant (Claude Code or equivalent) operating on the SE's Mac
**Companion docs:** `multicdn-demo-architecture-20260505T2317Z.md`, `multicdn-demo-run-of-show-20260505T2317Z.md`

> **Implementation note (post-build, 2026-05-06):**
> Phases 6 and 7 prescribe a Workers KV namespace for audit logging and the
> egress-meter bytes counter. During the actual build the demo account did not
> have KV write permissions (`code: 10023`), so both were migrated to R2:
>
> - Audit log → R2 keys under `audit/` prefix (reverse-timestamp + `jti`)
> - Bytes counter → R2 key `meter/bytes-hour-{YYYY-MM-DD-HH}.json`
>
> The KV namespace `multicdn-demo-audit-20260505-2351` exists but is unused.
> See `STATE.md` and `RESTART.md`. If you re-run this manual on a different
> account, KV is still the preferred design — the R2 path is a workaround.

## How to use this manual

Work through phases 0 → 8 in order. After each phase, post a summary to the SE listing what was created, IDs/ARNs/hostnames worth remembering, and any issues encountered. Wait for confirmation before proceeding to the next phase. Maintain a `STATE.md` file in the working directory recording every resource created — this is the source of truth for teardown later.

If a step fails, do not silently retry with a workaround. Report the failure, the exact command run, and the exact error. Let the SE decide.

When generating timestamps for filenames or resource names, use `date -u +%Y%m%dT%H%MZ`. Never guess or hardcode. The first timestamp generated at the start of phase 0 is the `<TIMESTAMP>` referenced throughout this manual — capture it once and reuse.

## Preconditions and assumptions

- The agent operates on the SE's Mac.
- The SE owns a domain that is already on Cloudflare with an active zone (referred to throughout as `<your-domain>`). The SE will provide this when prompted in phase 0.
- The SE has a Cloudflare account with R2, Workers, and Load Balancing entitlements.
- The SE has an AWS account where the agent will create CloudFront and IAM resources.
- The SE has shell access and appropriate permissions for Homebrew installs.

## Phase 0: Environment prep

Verify required tools are installed:

- `wrangler --version` (≥3.x)
- `aws --version` (v2)
- `ffmpeg -version`
- `jq --version`
- `node --version` (≥20)
- `python3 --version` (≥3.10, for `reportlab` PDF generation)

For anything missing, install via Homebrew. Run `wrangler login` and `aws configure` if not already authenticated.

Ask the SE for `<your-domain>`. Confirm the Cloudflare zone exists by querying the Cloudflare API for zones; capture the zone ID.

Generate the run timestamp: `TIMESTAMP=$(date -u +%Y%m%dT%H%MZ)`.

Create the working directory at `~/src/cf-multicdn-demo-${TIMESTAMP}`. All generated files go here. Initialize `STATE.md` with the following sections (to be populated as phases complete):

- Run metadata (timestamp, domain, AWS account ID, Cloudflare account ID, zone ID)
- R2 resources
- Worker resources
- KV namespaces
- Load Balancer resources
- AWS resources (IAM user, CloudFront distribution, ACM cert)
- DNS records created
- Secrets generated (record secret names, NOT values)

Report back to the SE with the working directory path and confirmed prerequisites.

## Phase 1: R2 bucket and seed data

Create a bucket named `multicdn-demo-${TIMESTAMP}`. Create two prefixes by uploading placeholder objects (`public/.keep` and `private/.keep`). Also upload `public/healthcheck.txt` containing the literal text `ok` — this is used by the Load Balancer health monitor in phase 5.

### Generate seed data

Create a `seed/` directory with this structure:

```
seed/
  public/
    images/
      providers/
      logo.png
    video/
      welcome.mp4
    css/
      site.css
  private/
    docs/
```

**Provider headshots (5 images):**

Use `ffmpeg` or ImageMagick to generate solid-color JPEGs (1024x1024) with text overlay. Names to use:

- Dr. Aisha Rahman — Cardiology
- Dr. Marcus Chen — Pediatrics
- Dr. Sofia Alvarez — Emergency Medicine
- Dr. James Okafor — Orthopedics
- Dr. Priya Subramaniam — Internal Medicine

Each headshot is a different solid background color with the doctor's name and specialty centered in white text. Output to `seed/public/images/providers/<lastname-lowercase>.jpg`.

Example ffmpeg command for one image:

```bash
ffmpeg -f lavfi -i color=c=0x2c5f8d:s=1024x1024:d=1 \
  -vf "drawtext=text='Dr. Aisha Rahman\nCardiology':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=20" \
  -frames:v 1 seed/public/images/providers/rahman.jpg
```

**Patient portal PDFs (3 files):**

Generate via a small Python script using `reportlab`. Install with `pip3 install reportlab` if needed. Each PDF should be 1–2 pages, generic content, with a watermark "DEMO ONLY — NOT REAL PHI" diagonally across each page in light gray.

Files:

- `seed/private/docs/after-visit-summary-sample.pdf` — fake visit summary
- `seed/private/docs/pre-procedure-instructions-sample.pdf` — fake pre-op instructions
- `seed/private/docs/discharge-care-plan-sample.pdf` — fake discharge plan

Content can be lorem-ipsum medical-flavored. The PDFs exist to be served, not read.

**Marketing video (1 file):**

Generate a 15-second 720p MP4 test pattern with a title card:

```bash
ffmpeg -f lavfi -i testsrc=duration=15:size=1280x720:rate=30 \
  -vf "drawtext=text='Demo Hospital — Welcome':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.5:boxborderw=20" \
  -c:v libx264 -pix_fmt yuv420p -t 15 \
  seed/public/video/welcome.mp4
```

**Generic web assets:**

- `seed/public/css/site.css` — minimal CSS, body and headings styling, ~30 lines
- `seed/public/images/logo.png` — 256x256 PNG with text "DEMO HOSPITAL" generated via ffmpeg or ImageMagick

### Upload to R2

Use `wrangler r2 object put` (or the S3 API) to upload everything to the bucket, preserving the `public/` and `private/` prefix structure. Verify with `wrangler r2 object list` — confirm all files present, prefixes correct, healthcheck file at the bucket root under `public/`.

Update `STATE.md` with bucket name, account ID, and total object count. Report to SE.

## Phase 2: Public hostname, Cloudflare CDN side

Create a custom domain on the R2 bucket: `cf-pool.demo.<your-domain>`. This gives the Cloudflare CDN pool a hostname that pulls directly from R2.

Configure cache rules so all object types are cached. Enable Smart Tiered Cache for the zone if not already enabled.

Verify by curling `https://cf-pool.demo.<your-domain>/public/images/logo.png` and `https://cf-pool.demo.<your-domain>/public/healthcheck.txt`. Both should return 200 with a Cloudflare cache header (`cf-cache-status`).

Update `STATE.md` with the custom domain configuration. Report to SE.

## Phase 3: AWS side — R2 read credentials, IAM, CloudFront

### R2 read-only API token

Create an R2 API token scoped to `multicdn-demo-${TIMESTAMP}` with **read-only** permissions. This token's Access Key ID and Secret Access Key are what CloudFront will use to pull from R2.

Save credentials to `STATE.md` under "R2 read-only credentials for CloudFront." Mark them clearly as secrets.

### IAM user (account hygiene)

In AWS, create an IAM user `cf-multicdn-demo-${TIMESTAMP}` with no permissions attached. This is purely for account-isolation hygiene; the actual R2 access is via the R2 token, not IAM. The CloudFront distribution will be created using the SE's existing AWS credentials, but tagged with this user's name for accountability.

### ACM certificate

Request an ACM certificate in `us-east-1` for `cloudfront-pool.demo.<your-domain>`. Use DNS validation. The agent automatically creates the validation CNAME in Cloudflare DNS using the Cloudflare API. Wait for validation to succeed (typically 1–5 minutes).

### CloudFront distribution

Create a CloudFront distribution with these settings:

- **Origin domain:** `<R2-account-id>.r2.cloudflarestorage.com`
- **Origin path:** `/multicdn-demo-${TIMESTAMP}/public`
- **Origin protocol:** HTTPS only
- **Custom origin headers:** add `X-Multicdn-Demo-Secret: <generate-32-byte-random-base64>`. Save the secret to `STATE.md`. (This header isn't strictly required for the demo to work, but it's the production pattern for verifying CloudFront-originated requests at the Cloudflare side. Document it.)
- **Cache behavior:**
  - Viewer protocol policy: redirect HTTP to HTTPS
  - Allowed methods: GET, HEAD
  - Cache based on selected request headers: none
  - Forward cookies: none
  - Forward query strings: none
  - TTL: default 86400, max 31536000
- **Response headers policy:** create a custom policy that adds `served-by: cloudfront` to every response. Attach to the cache behavior.
- **Alternate domain name (CNAME):** `cloudfront-pool.demo.<your-domain>`
- **Custom SSL certificate:** the ACM cert from above
- **Price class:** Use only North America and Europe (sufficient for demo; reduces deploy time)

Submit. Distribution deployment takes ~10–15 minutes. **Proceed to phase 4 during the wait.**

After deployment, in Cloudflare DNS, create a CNAME from `cloudfront-pool.demo.<your-domain>` to the CloudFront distribution domain (e.g. `d123abc.cloudfront.net`). Set proxy status to **DNS only (gray cloud)** since CloudFront is the CDN here, not Cloudflare.

Verify by curling `https://cloudfront-pool.demo.<your-domain>/images/logo.png` (note: no `public/` prefix in the URL because CloudFront's origin path adds it). Confirm 200, `served-by: cloudfront` header, and a CloudFront cache header (`x-cache`).

Update `STATE.md` with distribution ID, distribution domain, ACM cert ARN, custom header secret. Report to SE.

## Phase 4: Public Worker (optional steering layer)

Generate a Worker project at `worker-public-steering/` using `wrangler init` (TypeScript, Hono framework optional but encouraged for clarity).

### Worker behavior

The Worker is bound to `cf-pool.demo.<your-domain>/*`. Its behavior depends on a `STEERING_MODE` environment variable, set in `wrangler.toml` `[vars]`:

**Mode `passthrough` (default):**

- Inject `served-by: cf-edge` header on every response
- Fetch from R2 binding (the `multicdn-demo-${TIMESTAMP}` bucket)
- Strip `public/` from the path if present, then prepend it (idempotent normalization)
- Return the R2 object with appropriate `content-type` from the object's HTTP metadata

**Mode `path_routing`:**

- For paths matching `/video/*`: behave as `passthrough`
- For all other paths: behave as `passthrough` as well (the path-routing logic in the demo is illustrated by the LB ALSO routing video to CF only — but the Worker can short-circuit to make this clean)
- Inject a `routing-decision` response header indicating the rule that matched

Note: in the demo, "video always to CF" is enforced by changing the Worker's logic. The LB still has both pools at 50/50; the Worker on the CF side just makes its half exclusive for video. To make the demo show 100% CF for video, the Worker also rewrites `set-cookie` to set a session affinity cookie that the LB respects, OR the demo uses a path that's only CF-served by virtue of the curl always returning `cf-edge`. Simpler approach: rely on the LB's session affinity feature instead — see phase 5.

**Mode `percent_rollout`:**

- Read `ROLLOUT_PCT` env var (integer 0–100)
- Generate a random number 0–99 per request
- If random < ROLLOUT_PCT: serve from R2 via the Worker (`served-by: cf-edge`)
- Else: 302 redirect to `https://cloudfront-pool.demo.<your-domain>/<path>` (which causes the client's next request to hit CloudFront directly)

Bind the Worker to:

- R2 binding `BUCKET` → `multicdn-demo-${TIMESTAMP}`
- Vars: `STEERING_MODE`, `ROLLOUT_PCT`

Deploy with `wrangler deploy`. Set the route to `cf-pool.demo.<your-domain>/*`.

### Verify

Test all three modes by editing `wrangler.toml`, redeploying, and curling. Confirm:

- `passthrough`: every request returns `served-by: cf-edge`
- `path_routing`: `/video/*` requests behave as expected
- `percent_rollout` at 50: roughly half of 20 requests redirect to CloudFront

Reset to `passthrough` when done verifying. The demo will toggle modes live.

Update `STATE.md` with Worker name, route, secrets/vars. Report to SE.

## Phase 5: Load Balancer

Use the Cloudflare API or dashboard. Create:

### Pool `pool-cf-${TIMESTAMP}`

- Origin: `cf-pool.demo.<your-domain>`
- Weight: 1
- Enabled: true
- Monitor: HTTPS GET `/public/healthcheck.txt`, expected response code 200, expected body contains `ok`, every 15 seconds, 2 retries

### Pool `pool-cloudfront-${TIMESTAMP}`

- Origin: `cloudfront-pool.demo.<your-domain>`
- Weight: 1
- Enabled: true
- Monitor: same as above (note the path differs — CloudFront origin path strips `/public`, so the healthcheck URL on CloudFront side is `/healthcheck.txt`). Configure two separate monitors if needed.

### Load Balancer

- Hostname: `assets.demo.<your-domain>`
- Default pools (in order): `pool-cf-${TIMESTAMP}`, `pool-cloudfront-${TIMESTAMP}`
- Fallback pool: `pool-cf-${TIMESTAMP}`
- Steering policy: **Random** with weights (50/50)
- Session affinity: none (we want round-robin behavior for the demo)
- Proxied: yes (orange cloud)

### SSL Certificate (Critical — Do This First)

Load Balancer hostnames **do not** automatically get SSL certificates. Unlike Workers or R2 custom domains (which auto-provision), LB virtual hostnames aren't visible to Universal SSL's DNS scanner.

**Recommended approach: one wildcard certificate for all demo subdomains**

Before creating any Load Balancer, go to **SSL/TLS → Edge Certificates → Order Advanced Certificate** and add:
- `*.demo.<your-domain>`
- `demo.<your-domain>`

This single certificate covers:
- `assets.demo.<your-domain>` (the LB hostname)
- `meter.demo.<your-domain>`
- `secure.demo.<your-domain>`
- `cf-pool.demo.<your-domain>`
- `cloudfront-pool.demo.<your-domain>`
- `portal.demo.<your-domain>`
- `audit.demo.<your-domain>`

Wait for provisioning (1–2 minutes), then proceed with LB creation.

**Why wildcard instead of individual certs:**
- Cleaner — one certificate for all demo infrastructure
- Prevents the exact failure mode where `assets.demo` has no cert while `*.meter.demo` does
- Easier teardown — delete one cert instead of many
- Works for any future demo subdomains without re-provisioning

**What not to do:**
- Don't rely on Universal SSL for LB hostnames — it won't find them
- Don't create separate Advanced Certificates per subdomain (e.g., `*.cf-pool.demo`, `*.meter.demo`) — you'll end up with the same gap for `assets.demo`

### Verify

```bash
for i in {1..20}; do
  curl -sI https://assets.demo.<your-domain>/images/logo.png | grep -i served-by
done
```

Should show roughly 50/50 mix of `cf-edge` and `cloudfront`. (Note: paths to LB-fronted hostname need to work for both pools. CloudFront origin path adds `/public`; CF pool's R2 custom domain serves from bucket root. Verify path normalization is consistent between the two.)

**Path normalization gotcha:** the Worker on the CF side normalizes incoming paths to `public/<path>` before fetching from R2. CloudFront's origin path is configured to `/multicdn-demo-${TIMESTAMP}/public`. Both should accept `/images/logo.png` from the LB and resolve to the same R2 object. Test this explicitly with a few different paths.

Update `STATE.md` with pool IDs, monitor IDs, LB ID. Report to SE.

## Phase 6: Protected content — Worker, KV, token endpoint

### KV namespace

Create a Workers KV namespace `multicdn-demo-audit-${TIMESTAMP}`. Save namespace ID to `STATE.md`.

### Secure Worker

Generate a Worker project at `worker-secure/`. The Worker handles three routes:

**`POST /issue`**

- Accept JSON body: `{ "subject": "patient-12345", "path_prefix": "private/patient-12345/" }`
- For demo simplicity, also accept a default test payload with no body (issues a token for `private/docs/after-visit-summary-sample.pdf`)
- Mint a JWT signed with HS256 using `JWT_SECRET` (Wrangler secret)
- Claims: `sub`, `path_prefix`, `iat`, `exp` (now + 60 seconds), `jti` (random UUID)
- Return JSON: `{ "token": "<jwt>", "url": "https://secure.demo.<your-domain>/<path>?token=<jwt>", "expires_at": "<ISO>" }`
- Add a `// TODO: gate with Cloudflare Access in production` comment at the top of the handler

**`GET /private/*`**

- Extract `?token=` from query string
- Validate JWT signature with `JWT_SECRET`
- Validate `exp` is in the future
- Validate the requested path starts with `path_prefix` claim
- On success:
  - Fetch from R2 binding (path is `private/<rest-of-path>`)
  - Write audit record to KV: key `audit:<reverse-timestamp>:<jti>`, value `{ ts, sub, path, ip, decision: "allow" }`
  - Return the file with appropriate content-type
- On failure (any reason):
  - Write audit record: `decision: "deny"`, `reason: "expired" | "invalid_signature" | "scope_mismatch" | "missing_token"`
  - Return 403 with a JSON body `{ "error": "<reason>" }`

**`GET /audit/recent`**

- Read up to 50 most recent audit entries from KV (use the reverse-timestamp prefix to sort newest-first)
- Return as JSON array

Bind:

- R2 binding `BUCKET` → `multicdn-demo-${TIMESTAMP}`
- KV binding `AUDIT` → `multicdn-demo-audit-${TIMESTAMP}`
- Secret `JWT_SECRET` → generated 32-byte random base64

Deploy. Routes: `secure.demo.<your-domain>/*`. Create the DNS record (proxied, orange cloud).

### Demo portal page

Generate `demo-portal/index.html` — a single-page app, Tailwind via CDN for quick styling, with:

- Header: "Demo Hospital — Patient Portal"
- One button: "Generate 60-second link to After-Visit Summary"
- On click: `POST` to `https://secure.demo.<your-domain>/issue`, display the returned URL as both a clickable link AND a copy-paste box
- A visible countdown timer below the link (60 → 0 seconds)
- After expiry: countdown reads "EXPIRED" in red

Deploy via Cloudflare Pages with project name `multicdn-demo-portal-${TIMESTAMP}` and a custom domain `portal.demo.<your-domain>`.

### Audit view page

Generate `audit-view/index.html` — also Pages-deployed at `audit.demo.<your-domain>`:

- Header: "Audit Log — Live"
- A table that polls `https://secure.demo.<your-domain>/audit/recent` every 2 seconds
- Columns: Timestamp, Subject, Path, IP, Decision (with color: green for allow, red for deny), Reason (only for denies)
- Newest entries at top, auto-prepended
- Visual flash on new row (subtle highlight that fades over 1 second)

### End-to-end verification

1. Open `https://portal.demo.<your-domain>`
2. Click "Generate" → URL appears with 60s countdown
3. Click URL → PDF renders (200)
4. Open `https://audit.demo.<your-domain>` → see allow entry within 2 seconds
5. Wait 70 seconds, refresh the PDF URL → 403
6. Refresh audit view → see deny entry with reason "expired"
7. Test scope_mismatch: manually craft a URL with a token issued for `private/patient-12345/` but pointing to `private/docs/after-visit-summary-sample.pdf` → 403, audit shows `scope_mismatch`

Update `STATE.md` with Worker names, KV namespace ID, Pages projects, custom domains, secret names. Report to SE.

## Phase 7: Egress meter

This page is the close of the demo. The SE will return to it during the final beat, and the AE will reference it in follow-up emails. It needs to do real work, not just decorate.

### What the page must show

A single HTML page response from a Worker at `meter.demo.<your-domain>/`. Three panels stacked vertically.

**Panel 1: Live origin egress this hour**

- Big centered `$0.00` (font size ~96pt)
- Subtext: "Origin egress charges, this hour, real traffic"
- Smaller caption: "Bytes served from R2: `<X.X GB>`" — populated from KV-backed running total updated by the public Worker and secure Worker on each successful fetch
- Auto-refresh every 10 seconds

**Panel 2: What this same traffic would have cost on traditional clouds**

A comparison table with two rate columns — list price and blended enterprise discount — because the AE will reference both depending on customer maturity.

```
Your traffic this hour: <X.X GB>

Provider                 List price    Enterprise blended
─────────────────────────────────────────────────────────
AWS S3 egress           $0.09/GB       $0.05/GB
  This hour:            $<calc>        $<calc>

Azure Blob egress       $0.087/GB      $0.05/GB
  This hour:            $<calc>        $<calc>

GCS multi-region        $0.12/GB       $0.08/GB
  This hour:            $<calc>        $<calc>

Cloudflare R2:          $0.00/GB       $0.00/GB
  This hour:            $0.00          $0.00
```

The `<calc>` values are computed in the Worker from the KV bytes-served counter.

**Panel 3: Scale this to a hospital system's real volume**

This is the panel the AE will screenshot for follow-up emails. It projects the demo's traffic to realistic hospital-system volumes.

```
If your system serves...     Annual egress savings vs S3 (blended $0.05/GB)
─────────────────────────────────────────────────────────────────────────
10 TB/month                  $6,000/year     (small hospital web presence)
50 TB/month                  $30,000/year    (mid-size system)
100 TB/month                 $60,000/year    (large multi-facility)
500 TB/month                 $300,000/year   (regional health network)
```

Math basis: assume 30% cache miss rate (the bytes that actually pull from origin). So 100 TB/month served × 30% miss = 30 TB/month from origin = 30,000 GB × $0.05/GB = $1,500/month = $18,000/year on egress alone.

**Wait — the AE script says $18,000/year for 100 TB/month, but this table says $60,000/year. Reconcile this before building.**

The discrepancy is that the AE script uses 30% cache miss rate (egress only on origin pulls), while a "naive" calculation would charge egress on 100% of CDN-served bytes (which is wrong — CDN cached responses don't trigger origin egress). The accurate number is the lower one.

**Use the cache-miss-aware math.** Update the table to match what the AE will quote:

```
If your system serves...     Annual egress savings (30% miss rate, $0.05/GB blended)
──────────────────────────────────────────────────────────────────────────────────
10 TB/month                  $1,800/year     (small hospital web presence)
50 TB/month                  $9,000/year     (mid-size system)
100 TB/month                 $18,000/year    (large multi-facility)
500 TB/month                 $90,000/year    (regional health network)
```

Add a footnote to this panel:

> Assumes 30% origin cache miss rate, which is typical for multi-CDN setups where each CDN warms its cache independently. Higher miss rates (common during cache evictions, new content rollouts, or DDoS events) increase savings proportionally. List-price savings are roughly 1.8x higher than the blended-rate numbers above.

### What the AE script will quote

Make sure the meter's projection panel matches these numbers exactly, because the AE script tells the AE to anchor on the $15–25K/year range for a hospital-system-scale customer:

- 10 TB/month → ~$1,800/year savings on egress
- 50 TB/month → ~$9,000/year
- 100 TB/month → ~$18,000/year ← AE quotes "$15-25K range" off this
- 500 TB/month → ~$90,000/year

If these change, the AE script needs to be updated in lockstep.

### Implementation notes

- The KV-backed bytes counter is updated by both the `worker-public-steering` Worker (Phase 4) and the `worker-secure` Worker (Phase 6) on every successful R2 fetch. Increment a single key like `bytes-served:hour:<YYYY-MM-DD-HH>` using KV's `get` + add + `put` pattern. Be aware this isn't atomic; for a demo it's fine.
- For an honest meter, only count bytes that *actually came from R2 origin*, not bytes served from CDN cache. The Workers can detect this via the `cf-cache-status` header on the upstream fetch response — only increment when status is `MISS`, `EXPIRED`, or `BYPASS`. (For the CloudFront pool, this isn't observable from the Cloudflare side, so the meter slightly understates traffic. Document this honestly in a small "methodology" note on the page.)
- For load-testing purposes during demo prep, the SE may want to artificially inflate the counter to show realistic-looking numbers. Build in a `?demo_seed=<gigabytes>` query parameter that, when present, adds that many GB to the displayed total. This is a cheat, but it's a documented cheat — comment in code, leave on for demo, off for honest internal review.
- Auto-refresh page every 10 seconds.
- The page must look good in a screenshot (the AE will use it in follow-up emails). Use clean typography, generous whitespace, and a single-color scheme that screenshots cleanly. Avoid dark mode unless the SE requests it. Cloudflare orange (`#F38020`) for the `$0.00` accent is fine.

### What to NOT do

- Don't compare to *CDN delivery costs* (CloudFront's own per-GB delivery fee). That's a separate cost the customer pays regardless of origin choice. Mixing it into the savings number makes us look like we're inflating. Stay honest: this meter is about **origin egress only**.
- Don't quote sub-cent numbers. Round to the nearest dollar at minimum.
- Don't show the comparison numbers if traffic counter is exactly zero — render "Run some traffic to see comparisons" instead.

### Verification

After building, verify:

1. Page loads at `https://meter.demo.<your-domain>/` and returns 200
2. With zero traffic, shows `$0.00` and the prompt to generate traffic
3. After running 100 requests against the demo, the bytes counter shows non-zero, comparison values populate, all rate columns calculate correctly
4. The projection panel renders the four hospital-size scenarios with the numbers above (matching the AE script)
5. Page screenshots cleanly at 1920×1080 — open it, screenshot, send to SE for visual approval before considering this phase complete

Update `STATE.md` with Worker name, route, KV namespace used. Report to SE.

## Phase 8: Final verification

Generate a script `scripts/verify-all.sh` that runs through:

1. `curl` 20 times against `https://assets.demo.<your-domain>/images/logo.png`, count `served-by` headers, expect roughly 50/50
2. `curl` once against each of the three pool hostnames directly (`cf-pool`, `cloudfront-pool`, LB)
3. Issue a token via `POST /issue`, immediately fetch the URL, expect 200
4. Issue a token, wait 65 seconds, fetch, expect 403
5. Hit `/audit/recent`, confirm at least 2 entries (one allow, one deny)
6. Hit the egress meter, confirm 200 and `$0.00` is in the response body

Run the script. Confirm all checks pass.

Generate a final summary in `STATE.md` with:

- All hostnames
- All resource IDs
- All secret names (NOT values; secrets are stored in Cloudflare/AWS)
- A teardown checklist (resources to delete, in dependency order)
- Estimated monthly cost if left running (R2 storage + Workers + LB + CloudFront idle)

Post `STATE.md` summary to the SE. Demo environment is ready.

## Common failure modes and how to handle them

- **ACM cert validation hangs:** check the validation CNAME exists in Cloudflare DNS and is set to "DNS only" (not proxied). Most common cause is the CNAME being proxied.
- **CloudFront 403 on R2 fetch:** verify the R2 API token has read permission on the bucket, and that the origin custom headers in CloudFront are configured exactly as expected. If using R2's S3-compatible endpoint, the origin must be HTTPS and the bucket name must be in the path, not the host.
- **LB hostname returns SSL/connection errors:** Load Balancer hostnames do NOT automatically get SSL certificates. Universal SSL scans DNS records, and LB virtual hostnames don't appear there. You must explicitly create an Advanced Certificate. **Recommended:** Order a single wildcard `*.demo.<your-domain>` before building anything else — covers all demo subdomains and prevents this gap entirely.
- **LB health check failing on CloudFront pool:** the healthcheck URL on the CloudFront pool is `/healthcheck.txt` (origin path strips `/public`). Don't include `/public/` in the monitor path for that pool.
- **Worker not invoked on `cf-pool` requests:** confirm the route in `wrangler.toml` matches the hostname exactly and that the zone is correct.
- **Token validation fails immediately on issuance:** clock skew between the Worker minting and the Worker validating is rare but possible. Use Workers' `Date.now()` consistently and don't rely on system time.
- **Audit view shows nothing:** KV writes can lag up to 60 seconds for global propagation. For demo reliability, the audit-view Worker should query the same edge POP that wrote, OR the demo portal and audit view should be opened from the same network/POP.
