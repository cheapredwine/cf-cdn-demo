# Multi-CDN Demo — STATE

**Generated:** 2026-05-05T23:51Z
**Domain:** jsherron.com
**Cloudflare Account ID:** 1ddebf6f9507d3fc9052158be9d42dee
**Cloudflare Zone ID:** 6bcf8859da225392d8fae3351eb5de3e
**AWS Account ID:** 512629184821

---

## R2 resources

| Resource | Name/ID | Notes |
|---|---|---|
| Bucket | `multicdn-demo-20260505-2351` | 12 objects uploaded (Phase 1) |
| Custom domain | `cf-pool.demo.jsherron.com` | Active, SSL active (Phase 2) |

## Worker resources

| Worker | Route | Notes |
|---|---|---|
| Public steering | `cf-pool.demo.jsherron.com/*` | Phase 4 |
| Secure content | `secure.demo.jsherron.com/*` | Phase 6 |
| Egress meter | `meter.demo.jsherron.com/*` | Phase 7 |

## KV namespaces

| Namespace | ID | Notes |
|---|---|---|
| `multicdn-demo-audit-20260505-2351` | `fdbdbb94864b4fb5bbdc19a011584f0a` | Phase 6 — created but not used (KV write perms issue, migrated to R2) |

## Load Balancer resources

| Resource | ID | Notes |
|---|---|---|
| Pool `pool-cf-20260505-2351` | Created via dashboard | Phase 5 |
| Pool `pool-cloudfront-20260505-2351` | Created via dashboard | Phase 5 |
| Load Balancer `assets.demo.jsherron.com` | Created via dashboard | Phase 5 — steering 50/50 |

## AWS resources

| Resource | ARN/ID | Notes |
|---|---|---|
| IAM user `cf-multicdn-demo-20260505-2351` | `arn:aws:iam::512629184821:user/cf-multicdn-demo-20260505-2351` | Phase 3 — account hygiene |
| CloudFront distribution | `E362FEEO2DM9NE` | Active, custom domain + ACM cert |
| ACM certificate | `arn:aws:acm:us-east-1:512629184821:certificate/61445144-6bc4-4f98-96ac-950013484a1d` | Phase 3 — ISSUED |
| R2 read-only API token | TBD | Phase 3 |

## DNS records created

| Hostname | Type | Target | Proxy |
|---|---|---|---|
| `cf-pool.demo.jsherron.com` | CNAME | R2 custom domain | Orange |
| `cloudfront-pool.demo.jsherron.com` | CNAME | CloudFront domain | Gray |
| `assets.demo.jsherron.com` | CNAME | LB hostname | Orange |
| `secure.demo.jsherron.com` | CNAME | Worker | Orange |
| `portal.demo.jsherron.com` | CNAME | Pages | Orange |
| `audit.demo.jsherron.com` | CNAME | Pages | Orange |
| `meter.demo.jsherron.com` | CNAME | Worker | Orange |

## Secrets generated

| Secret | Location | Notes |
|---|---|---|
| `JWT_SECRET` | Wrangler secret (secure Worker) | Phase 6 |
| `X-Multicdn-Demo-Secret` | CloudFront custom header | Phase 3 — `XhYsEaHw/CDBfVWrDzEpM6r/Yg/cnfzqBc7HSntZd74=` |
| R2 API token (read-only) | Cloudflare API tokens | Phase 3 |

---

## Teardown checklist

1. Delete CloudFront distribution
2. Delete ACM certificate
3. Delete IAM user
4. Delete R2 read-only API token
5. Delete Load Balancer pools and LB
6. Delete Workers (public, secure, meter)
7. Delete KV namespace
8. Delete R2 bucket and all objects
9. Delete DNS records
10. Delete Pages projects (portal, audit)

## Estimated monthly cost if left running

- R2 storage: ~$0.015/GB (negligible for demo data)
- Workers: Free tier covers demo traffic
- Load Balancer: ~$5/mo
- CloudFront: ~$0.01/GB for North America/Europe
- Total: ~$5-10/month
