# Agent TODO — Next Session

**Status:** ✅ Demo fully operational. All P1/P2 items resolved 2026-05-06. Only polish remains.

---

## 🟢 Optional polish

- [ ] **Demo dry run** with WARP off, full 15-minute run-of-show
- [ ] **Generate real meter traffic** (50–100 requests through `assets.demo`) before taking the AE screenshot — meter UI now populates from real bytes after Gap 1 fix landed
- [ ] **Merge PR #1**: https://github.com/cheapredwine/cf-cdn-demo/pull/1
- [ ] **Update `README.md`** — still has template content from the bootstrap

## 🟢 Future / nice-to-have

- [ ] **Tighten CORS** on the secure Worker before any non-demo use. Current config is `Access-Control-Allow-Origin: *`. Production behind Cloudflare Access would restrict to known origins.
- [ ] **`verify-all.sh` honest TLS** — drop the `ssl.CERT_NONE` lines. Was kept for WARP compatibility but it can no longer catch a bad cert. Either drop it or add an explicit `--insecure` opt-in.
- [ ] **Meter UI display fixes** (cosmetic):
  - `toFixed(2)` rounds Azure's `0.087/GB` to display `0.09/GB` — same as AWS. Use `toFixed(3)` or render as `$0.087` literal.
  - `$1800.00` should render as `$1,800` — add comma-grouping to `formatDollars`.
- [ ] **Build manual + run-of-show in sync** — manual still describes the original three-`wrangler.<role>.toml` layout; the implementation note at the top covers the KV→R2 migration but not the env-config refactor.

## Known Gotchas (still relevant)

1. **WARP:** Always test from non-WARP context or use browser. Local `curl`/`python` will get TLS errors hitting CF-proxied hostnames.
2. **CloudFront monitor path:** must be `/healthcheck.txt` (no `/public/`) because CloudFront's origin path strips `/public/`. This was the cause of the "AWS endpoint degraded" issue today.
3. **LB pool Host header overrides:** CloudFront's ACM cert only covers `cloudfront-pool.demo.jsherron.com`, so the LB must rewrite Host/SNI to that hostname. Without the override, Cloudflare returns 525 on every request routed to the CloudFront pool.
4. **Wrangler auth:** OAuth token expires; may need `wrangler login` on restart.
5. **Wrangler account selection:** multi-account contexts need `CLOUDFLARE_ACCOUNT_ID=1ddebf6f9507d3fc9052158be9d42dee` set in env.
6. **R2 uploads:** Must use `--remote` flag or uploads go to local dev.
7. **DNS propagation:** Custom domains take 30–60s after deploy.
8. **CloudFront deploys:** 10–15 minutes for distribution updates.
9. **Meter counter:** Non-atomic R2 read-modify-write. Concurrent writes may lose a few bytes per hour. Acceptable per build manual.
10. **`verify-all.sh` TLS:** Script disables verification globally — won't catch bad certs. Useful with WARP, but flag it before non-WARP use.

## Resource Inventory

See `STATE.md` for full list. Key IDs:
- Zone: `6bcf8859da225392d8fae3351eb5de3e`
- Account: `1ddebf6f9507d3fc9052158be9d42dee`
- AWS Account: `512629184821`
- R2 Bucket: `multicdn-demo-20260505-2351`
- CloudFront: `E362FEEO2DM9NE`
- ACM Cert: `arn:aws:acm:us-east-1:512629184821:certificate/61445144-6bc4-4f98-96ac-950013484a1d`
- KV Namespace (unused): `fdbdbb94864b4fb5bbdc19a011584f0a`
- workers.dev subdomain: `jsherron-test-account.workers.dev`
