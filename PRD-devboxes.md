# Devboxes

## Overview

A self-hosted Next.js app for managing Ralphy AI coding runs executed inside ephemeral
Docker containers. Simple enough for a non-technical team member to run locally after
installing Docker. All credentials are optional via `.env.local` — they can be configured
through the UI settings page instead.

---

## Goals

- Spin up isolated Docker containers that run Ralphy autonomously on a given repo + PRD
- Track run history, stream live logs, and surface PR links when done
- Notify via Slack webhook on run completion or failure
- Git clones are cached and reused across runs via git worktrees — no redundant cloning
- Credentials configurable in UI, not required in env

---

## Architecture

```
devboxes/
├── app/                              # Next.js app (frontend + API routes)
│   ├── app/
│   │   ├── api/
│   │   │   ├── runs/
│   │   │   │   ├── route.ts          # GET (list) + POST (create + launch container)
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts      # GET (detail, merges DB + docker inspect)
│   │   │   │       ├── cancel/
│   │   │   │       │   └── route.ts  # POST — docker stop
│   │   │   │       └── logs/
│   │   │   │           └── route.ts  # GET — SSE stream of progress.log
│   │   │   └── settings/
│   │   │       └── route.ts          # GET + PUT
│   │   └── (pages)/                  # UI pages (separate PRD)
│   ├── lib/
│   │   ├── db.ts                     # SQLite + Drizzle client (better-sqlite3)
│   │   ├── docker.ts                 # docker run, docker stop, docker inspect wrappers
│   │   └── settings.ts               # Settings service with ENV fallback
│   └── package.json
│
├── docker/
│   ├── Dockerfile                    # Execution container definition
│   └── entrypoint.sh                 # Clone/fetch → worktree → ralphy → cleanup
│
├── ralphy                            # Pre-built Ralphy binary (copied into Docker image)
│
├── workspace/                        # Persisted on host, mounted into containers
│   ├── repos/
│   │   └── {sanitized-repo-id}/      # Cached git clones, one per unique repo URL
│   └── runs/
│       └── run-{YYYYMMDD}-{HHMMSS}-{shortId}/
│           ├── prd.md                # Written by server before container starts
│           ├── progress.log          # tee'd from container stdout + stderr
│           └── {repo-name}/          # Git worktree linked to cached clone
│
├── .env.local.example
├── docker-compose.yml                # Runs the Next.js app with correct mounts
└── README.md
```

---

## Git Worktree Strategy

Instead of cloning the repo fresh for every run, a single clone is cached under
`workspace/repos/` and reused. Each run gets a git worktree — an isolated working
directory linked to the same git objects, on its own branch.

The container mounts the **entire** `workspace/` directory (not just the run subdirectory)
so that worktree `.git` files resolve correctly — they store absolute paths and both
the cached clone and the worktree must be visible at the same paths inside and outside
the container.

Entrypoint flow:
```bash
REPO_ID=$(echo $REPO_URL | sed 's|https://||;s|[/:]|_|g')
MAIN_CLONE=/workspace/repos/$REPO_ID
WORKTREE=/workspace/runs/$RUN_ID/$REPO_NAME

# Clone on first run, fetch on subsequent runs
if [ ! -d "$MAIN_CLONE" ]; then
  git clone $REPO_URL $MAIN_CLONE 2>&1 | tee -a /workspace/runs/$RUN_ID/progress.log
else
  git -C $MAIN_CLONE fetch 2>&1 | tee -a /workspace/runs/$RUN_ID/progress.log
fi

# Create isolated worktree for this run
git -C $MAIN_CLONE worktree add $WORKTREE -b ralphy/$RUN_ID \
  2>&1 | tee -a /workspace/runs/$RUN_ID/progress.log

cd $WORKTREE
cp /workspace/runs/$RUN_ID/prd.md ./prd.md

# Run Ralphy — all output captured to progress.log
ralphy --prd prd.md --create-pr --branch-per-task [engine flags] \
  2>&1 | tee -a /workspace/runs/$RUN_ID/progress.log

EXIT_CODE=$?

# Cleanup worktree, leave cached clone in place
git -C $MAIN_CLONE worktree remove $WORKTREE --force \
  2>&1 | tee -a /workspace/runs/$RUN_ID/progress.log

exit $EXIT_CODE
```

Note: concurrent runs against the same repo may fetch simultaneously. This is safe —
git fetch is non-destructive. For an internal tool at this scale, no locking is needed.

---

## Data Models (SQLite via Drizzle + better-sqlite3)

### runs
```
id              TEXT PRIMARY KEY   -- run-20250224-142321-abc123
status          TEXT               -- pending | running | success | failed | cancelled
container_id    TEXT               -- Docker container ID for inspect/stop
repo_url        TEXT
repo_name       TEXT               -- last path segment of repo URL (no .git)
branch          TEXT               -- ralphy/run-id
prd_content     TEXT
engine          TEXT               -- cursor | claude | codex | gemini
created_at      INTEGER
finished_at     INTEGER
pr_url          TEXT
run_dir         TEXT               -- absolute path to workspace/runs/run-id/
```

### settings (single row, id = 1)
```
github_token    TEXT
cursor_api_key  TEXT
slack_webhook   TEXT
workspace_root  TEXT               -- absolute path, default: ./workspace
```

---

## Settings: ENV Fallback Pattern

Priority: **DB value > .env.local > undefined**

On first request to any settings-dependent route, the settings service checks whether
the DB row is seeded. If a field is null in DB and a corresponding env var exists, it
seeds from env. Once a user saves values in the UI, the DB value takes permanent priority.

This means:
- First-time users: open the app, go to Settings, fill in tokens — no `.env.local` needed
- Automated setups: set `.env.local`, values appear pre-filled in the UI

---

## API

### POST /api/runs
- Validates `repo_url`, `prd_content`, `engine`
- Generates `run_id` (format: `run-YYYYMMDD-HHMMSS-{6 char hex}`)
- Creates `workspace/runs/run-id/` directory on host
- Writes `prd.md` into that directory
- Launches container in detached mode (`docker run -d`) with:
  - Full workspace mounted at `/workspace`
  - Env vars: `GH_TOKEN`, engine API key, `REPO_URL`, `REPO_NAME`, `REPO_ID`, `RUN_ID`, `SLACK_WEBHOOK`
- Stores container_id + run record in DB
- Returns run record immediately (container runs async)

### GET /api/runs
- List all runs, newest first

### GET /api/runs/:id
- Fetch run from DB
- Call `docker inspect {container_id}` for live status
- If container has exited: update DB status and finished_at, extract PR URL from progress.log
- Return merged record

### GET /api/runs/:id/logs (SSE)
- Open a `ReadableStream` that reads `progress.log` from disk
- Poll file for new bytes every 500ms while run status = running
- Close stream when run is no longer running
- Frontend uses `EventSource` API — no extra libraries needed

### POST /api/runs/:id/cancel
- `docker stop {container_id}`
- Update DB status to `cancelled`, set `finished_at`

### GET /api/settings
- Return settings row (token values masked: show only last 4 chars)

### PUT /api/settings
- Update settings row
- Partial updates supported — only provided fields are changed

---

## Docker Execution Container

### Dockerfile
```dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    git curl ca-certificates

# Install gh CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
    https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && apt-get install -y gh

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Copy pre-built Ralphy binary
COPY ./ralphy /usr/local/bin/ralphy
RUN chmod +x /usr/local/bin/ralphy

# --- CURSOR CLI INSTALLATION ---
# Add your Cursor CLI installation script here
# Example:
# RUN curl -fsSL https://... | bash
# ---

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

### Environment Variables Passed to Container
```
GH_TOKEN          # picked up automatically by gh CLI and used for git auth
CURSOR_API_KEY    # or ANTHROPIC_API_KEY depending on engine
REPO_URL          # full https clone URL
REPO_NAME         # last path segment without .git
REPO_ID           # sanitized URL used as folder name under workspace/repos/
RUN_ID            # run identifier
SLACK_WEBHOOK     # optional, passed to ralphy config
ENGINE            # cursor | claude | codex | gemini
```

### Volume Mount
`./workspace → /workspace` (entire workspace directory)

---

## docker-compose.yml

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./workspace:/app/workspace
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/app/data          # SQLite database file
    env_file:
      - .env.local
```

Note: The app service mounts the Docker socket so Next.js API routes can spawn
execution containers. The execution containers are siblings (not children) of the
app container.

---

## Tasks

- [ ] Initialize Next.js app, install better-sqlite3 and drizzle-orm, configure Drizzle with SQLite
- [ ] Define Drizzle schema for runs and settings tables, run initial migration
- [ ] Write lib/settings.ts — on first access seed DB fields from process.env where DB value is null, DB always takes priority
- [ ] Write lib/docker.ts — wrappers for docker run (detached, full workspace mount, env vars), docker stop, docker inspect
- [ ] Implement POST /api/runs — validate input, generate run ID, create workspace/runs/run-id/ dir, write prd.md, launch container, insert DB row, return run record
- [ ] Implement GET /api/runs — return all runs ordered by created_at desc
- [ ] Implement GET /api/runs/:id — merge DB row with docker inspect output, update DB if container has exited, return merged record
- [ ] Implement GET /api/runs/:id/logs as SSE — tail progress.log with 500ms polling, close stream when run is no longer running
- [ ] Implement POST /api/runs/:id/cancel — docker stop container, update DB status and finished_at
- [ ] Implement GET /api/settings — return settings row with token values masked to last 4 chars
- [ ] Implement PUT /api/settings — partial update of settings row
- [ ] Write docker/Dockerfile — Ubuntu base, git, gh CLI, bun, copy ralphy binary, clearly marked Cursor installation block
- [ ] Write docker/entrypoint.sh — sanitize REPO_URL to REPO_ID, clone if not cached else fetch, git worktree add, copy prd.md, run ralphy with tee to progress.log, worktree remove on exit
- [ ] Write docker-compose.yml — app service with docker socket mount, workspace volume, and data volume for SQLite
- [ ] Write .env.local.example — document GH_TOKEN, CURSOR_API_KEY, SLACK_WEBHOOK, WORKSPACE_ROOT with descriptions and example values
- [ ] Write README.md — prerequisites (Docker Desktop), 4-step setup (clone, cp .env.local.example .env.local, docker-compose up, open browser), first-run guide (open Settings, add tokens)
