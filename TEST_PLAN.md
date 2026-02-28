# Test Plan / Smoke Checks

Before committing, run these from the repo root or from `cli/`:

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `bun run check` | Lint and format (Biome) |
| 2 | `bun test` | Unit tests |

From repo root, both apply to the CLI workspace:

```bash
bun run check   # runs in cli
bun test        # runs in cli
```

For a full smoke check before release, also run:

```bash
bun run build   # compile CLI binary
```
