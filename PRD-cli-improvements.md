# Ralphy CLI Improvements

## Overview

Improvements to the Ralphy CLI fork to add visibility into AI agent file operations,
context window monitoring with auto-restart, and support for markdown training/context
files injected into the agent prompt.

---

## 1. File Operation Logging

Ralphy runs the AI agent as a subprocess and only sees what the agent prints to stdout.
Claude Code's `--format stream-json` output includes `tool_use` events (Read, Write, Edit)
with file paths. Parse these events in the streaming handler and emit colored log lines
so the user can see what the agent is doing in real time.

Log format:
```
[file] 📖  Read    src/components/Button.tsx
[file] ✏️   Write   src/components/Button.tsx
[file] ✂️   Edit    src/utils/helpers.ts
```

Files to modify:
- `cli/src/engines/claude.ts` — parse tool_use events from stream-json in executeStreaming()
- `cli/src/engines/cursor.ts` — regex match Cursor stdout for file operation mentions
- `cli/src/ui/logger.ts` — add logFileOp() helper for consistent colored formatting

---

## 2. Context Window Monitoring and Auto-Restart

Each task is a fresh agent invocation but within a single task the context window can fill
up on complex work. Track cumulative input_tokens during Claude streaming. When usage
exceeds a configurable threshold, save a checkpoint and trigger a graceful restart so a
fresh agent session picks up where the last one left off.

Config options to add:
- `contextWindowThreshold`: fraction of max tokens before restart (default: 0.8)
- `maxContextTokens`: model context limit in tokens (default: 200000 for Claude Sonnet)

Restart flow:
1. Streaming handler detects token count approaching threshold
2. Write `.ralphy/context-checkpoint.md` summarizing completed work so far
3. Emit a warning log line
4. Signal the sequential executor to restart the current task
5. On restart, prompt builder detects checkpoint file and injects it as additional context
6. Fresh agent session reads checkpoint and continues

Files to modify:
- `cli/src/config/types.ts` — add contextWindowThreshold and maxContextTokens fields
- `cli/src/engines/claude.ts` — track cumulative tokens in streaming, emit threshold event
- `cli/src/execution/sequential.ts` — handle threshold event, trigger restart
- `cli/src/execution/prompt.ts` — inject .ralphy/context-checkpoint.md when file exists

---

## 3. Markdown Training Files (Skills Directory)

Support a `.ralphy/skills/` directory. All `.md` files inside are read and injected into
the agent prompt under a `## Knowledge Base` section. This lets teams include coding
guidelines, architecture docs, API references, or any domain context the agent should
know before starting work.

Config option to add:
- `skills_dir`: path to skills directory (default: `.ralphy/skills`)

CLI flag to add:
- `--skills-dir PATH`: override skills directory at runtime

On `ralphy --init`, create `.ralphy/skills/` with a placeholder `README.md` explaining
the convention.

Files to modify:
- `cli/src/config/types.ts` — add skills_dir field to RalphyConfig schema
- `cli/src/execution/prompt.ts` — read all .md files from skills_dir, inject under Knowledge Base section
- `cli/src/cli/args.ts` — add --skills-dir flag
- `cli/src/config/writer.ts` — create .ralphy/skills/ directory on --init

---

## Tasks

- [ ] Add logFileOp() helper to cli/src/ui/logger.ts with colored output for read, write, and edit file operations
- [ ] Parse tool_use events from Claude stream-json in executeStreaming() and call logFileOp() for Read, Write, Edit, and Bash tool uses
- [ ] Add regex-based file operation detection to Cursor engine stdout parser and call logFileOp()
- [ ] Add contextWindowThreshold (default 0.8) and maxContextTokens (default 200000) to RalphyConfig schema in cli/src/config/types.ts
- [ ] Track cumulative input_tokens in Claude streaming handler and emit a named event when threshold is crossed
- [ ] Handle threshold event in cli/src/execution/sequential.ts — write context-checkpoint.md and trigger task restart
- [ ] Update prompt builder in cli/src/execution/prompt.ts to detect and inject .ralphy/context-checkpoint.md when present
- [ ] Add skills_dir field to RalphyConfig schema with default value of .ralphy/skills
- [ ] Update prompt builder to read all .md files from skills_dir and inject their content under a Knowledge Base section
- [ ] Add --skills-dir CLI flag to cli/src/cli/args.ts
- [ ] Update --init command in cli/src/config/writer.ts to create .ralphy/skills/ directory with a placeholder README.md
