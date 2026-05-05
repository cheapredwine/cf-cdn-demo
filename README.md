# your-worker-name

<!-- TODO: Replace with a description of what this Worker does -->

## First steps after creating from template

1. **`CLAUDE.md`** — update the Project context section at the top, and trim the Stack table to only the bindings this project actually uses
2. **`wrangler.toml`** — uncomment the bindings you need, fill in `name`, run `wrangler d1 create` / `wrangler kv:namespace create` etc. to get real IDs
3. **`src/types.ts`** — add your bindings to the `Env` type to match `wrangler.toml`
4. **`README.md`** — fill in this file (including deleting this section)

---

## Setup

```bash
bun install
cp .dev.vars.example .dev.vars
# Fill in .dev.vars with local secret values
```

## Dev

```bash
bun run dev        # local Worker at http://localhost:8787
bun test           # run tests
bun run lint       # lint and format check
bun run typecheck  # TypeScript check
bun run check      # all three at once
```

## Deploy

```bash
wrangler deploy
```

## Bindings

<!-- TODO: Document the bindings this Worker uses -->

| Binding | Type | Purpose |
|---|---|---|
| — | — | — |

## Secrets

<!-- TODO: Document secrets this Worker needs -->

Set via `wrangler secret put SECRET_NAME`. See `.dev.vars.example` for local dev.

| Secret | Purpose |
|---|---|
| — | — |
