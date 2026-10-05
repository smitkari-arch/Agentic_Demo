---
description: "Use when a custom agent or prompt finishes a subagent run and needs to log token/tool-call/duration usage to audit/agent-actions/, or when regenerating reports/agent-execution-report.csv after a run."
---

# Agent Usage Logging

Shared mechanism used by the per-agent prompts (`designer-agent`, `healer-agent`, `planner-agent`, and `scripter-agent`) to capture real token/tool-call/duration figures into `audit/agent-actions/`, alongside — never replacing — each skill's own completion event. Each prompt references this file for the "how" instead of repeating it.

## Why this is a separate step, not part of the skill's own logging
A skill logging its own run (its `SKILL.md`'s own "Log this run" step, via [.github/scripts/log-agent-action.js](../scripts/log-agent-action.js)) executes inline, inside its own turn — at that point it has no visibility into its own token usage. Only the context that spawned a custom agent as a subagent (via the `agent` tool) is positioned to see that run's real usage figures once it returns — assuming the invoking environment surfaces them at all (unconfirmed for this platform's custom-agent invocation; see the note below). So only the spawning prompt/agent can log them — as a second, additional event, not an edit to the first.

## The command
Once a run's completion arrives, if real `tokens`/`tool_uses`/`duration_ms` figures are actually available from the invoking environment, take them — never estimate or invent these — and run:

```
node .github/scripts/log-agent-action.js --skill <skill> --status <success|failure|blocked> --event-type agent_usage_reported --summary "Usage for this <Agent Name> run: <N> tokens, <M> tool calls, <D>ms" [--jira-story-key <key>] --tokens <N> --tool-uses <M> --duration-ms <D>
```

Optional artifact-link flags for stronger scoring extraction:

```
--story-spec-path <playwrightTests/specs/...md>
--playwright-spec-path <playwrightTests/tests/...spec.ts>
--failure-report-path <playwrightTests/playwright-report/results.json>
```

- `--status` should mirror whatever that run's own completion log already used — don't recompute it independently.
- `--jira-story-key` — include only if the run was tied to a single Jira story; omit otherwise. Never invent one.
- This event shares that run's `correlation_id` automatically (same `--skill`/`--jira-story-key`/day → same auto-derived correlation ID) — no extra flag needed to link it.
- **If usage figures aren't available for any reason** (including if this platform's subagent-invocation mechanism doesn't surface them the way Claude Code's did — unconfirmed, flag as an open gap rather than guessing), skip this step for that run entirely rather than guessing a number.

Immediately after, regenerate the agent-execution report so it reflects this run:

```
node .github/scripts/generate-agent-execution-report.js --standalone
```

Then regenerate quality-scoring artifacts so score-linked reports stay current:

```
node .github/scripts/generate-agent-quality-evidence.js
node .github/scripts/generate-agent-quality-report.js
```

Or run the same flow with one wrapper command:

```
node .github/scripts/refresh-agent-scoring.js --standalone
```

This rewrites `reports/agent-execution-report.csv` from the full current `audit/agent-actions/` log — see [.github/scripts/generate-agent-execution-report.js](../scripts/generate-agent-execution-report.js). The quality commands generate per-run evidence under `audit/agent-quality/`, validate schema, and produce dashboard CSVs under `reports/` via [.github/scripts/generate-agent-quality-evidence.js](../scripts/generate-agent-quality-evidence.js), [.github/scripts/validate-agent-quality-evidence.js](../scripts/validate-agent-quality-evidence.js), and [.github/scripts/generate-agent-quality-report.js](../scripts/generate-agent-quality-report.js). Keep all reports current after every run, deterministically, without depending on a separate review stage. Run them even if the usage-logging step above was skipped (e.g. missing figures).

## Per-agent `--skill` mapping

| Prompt | `--skill` value(s) | `--jira-story-key`? |
|---|---|---|
| `planner-agent` | `jira-story-readiness` | yes, if a key was given |
| `designer-agent` | `generate-test-scenarios` | yes, if a key was given |
| `scripter-agent` | `generate-playwright-ui-script` — the UI scripting skill; log one usage event with `--skill generate-playwright-ui-script` (include `--jira-story-key` if the story-scoped case was tied to a story) | yes, if the story-scoped case was tied to a story |
| `healer-agent` | `analyze-playwright-failure` | yes, if the failing feature traces to a story |

