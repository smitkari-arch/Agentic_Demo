# Copilot Instructions

This folder is a self-contained Playwright automation project with no application source code. The supported execution path is the Playwright project under `playwrightTests/` and the repo governance, prompts, and skills that support that workflow.

## Project structure

- `playwrightTests/` — self-contained Playwright/npm project (own `package.json`, `playwright.config.ts`, page objects, helpers, and tests)
- `.github/agents/` — role/persona docs for the active agent workflow: `planner-agent`, `designer-agent`, `scripter-agent`, and `healer-agent`.
- `.github/prompts/` — direct one-off agent entry points for the supported workflow, without the old orchestration wrapper.
- `.github/skills/` — active task-specific skills: `jira-story-readiness`, `generate-test-scenarios`, `generate-playwright-ui-script`, and `analyze-playwright-failure`. Use the relevant `SKILL.md` for scope before improvising an ad hoc workflow.
- `.github/instructions/` — policy/reference docs (ownership summary, guardrails & policy layer, execution model, Jira access, agent usage logging).
- `.github/hooks/`, `.github/pii-ocr/`, `.github/memory/` — governance layer for policy, sanitization, and audit records.
- Root `playwrightTests/specs/` — business-level design artifacts generated from Jira stories before Playwright automation is written (Designer Agent writes here by default).
- Root `audit/`, `reports/` — execution/audit outputs and aggregated summaries that support the active Playwright workflow.
- `rtk/` — self-contained Rust project implementing RTK (Rust Token Killer), used for local output reduction during CLI-heavy sessions.
- `.vscode/mcp.json` holds the repo MCP configuration for the supported tooling.

## Governing rules (non-negotiable)

- **Never point automated tests at a real production or transactional environment without explicit human confirmation first.** A test that books an appointment or places an order against a live system creates a real event, not a simulated one. Always confirm the target URL is a test/staging/demo environment before running.
- **Never hardcode real credentials or secrets** in Playwright spec files, helpers, or any config. Use environment variables instead. Public demo cre                  dentials are acceptable only when they are intentionally shared and already public.
- The `analyze-playwright-failure` skill may only auto-fix deterministic scripting bugs or clearly safe stale-data issues. Selector drift and possible app regressions must be reported for human review, never silently patched.
- Each skill's `SKILL.md` and each agent's `.agent.md` declares a `tools:` list and described role. Treat both as operational guidance, not a system-enforced login. The execution model and guardrails remain the binding docs.
- Local spec file writes under `playwrightTests/` remain a direct agent action, and business-level design specs under `playwrightTests/specs/` are also a direct agent action for the design workflow, while Jira and memory writes remain explicit human-triggered actions. This is the repo's supported scoping of the "no direct write" principle.
- **Never create a new Jira issue/story directly** through an MCP shortcut. Story authoring remains a human-only activity: a person creates or edits the issue in Jira, then provides the issue key or pasted story text. This is enforced by the repo's guardrails and hooks.

## Testing conventions

- Verify, don't assume: any new or modified test must be executed with real output from `npx playwright test` before being reported as done.
- Avoid hardcoded dates/timestamps in test data; prefer dynamic generation or known test fixtures.
- Before writing a new locator, verify it against the live DOM rather than guessing selectors.
- Use the Playwright failure-analysis workflow for ambiguous selectors or regressions instead of silently weakening assertions.

## Jira access

See [.github/instructions/jira-access.instructions.md](instructions/jira-access.instructions.md) — no Jira MCP tool for text fetches; use the repository's direct read-only access pattern only.

### Node TLS trust (corporate CA/proxy environments)

If `node .github/scripts/jira-read.js ...` fails with `SELF_SIGNED_CERT_IN_CHAIN` while PowerShell/curl can still reach Jira, the repo now auto-applies the Windows system CA fix for the current Node process before the request runs.

For a persistent user-level fix, run:

```powershell
. .\.github\scripts\enable-node-system-ca.ps1
```

This sets `NODE_OPTIONS=--use-system-ca` for the current user and current process, so Planner/Jira fetches keep working in corporate proxy environments without a manual shell tweak.

Never use `NODE_TLS_REJECT_UNAUTHORIZED=0` as a permanent fix; it disables TLS certificate validation.

## Agent scoring and memory (quick reference)

- **Scoring docs:** See `REPOSITORY_GUIDE.md` and the agent overview at `.github/AGENTS.md` for full details about the scoring pipeline, evidence format, and reports.
- **Primary scorer scripts:** `.github/scripts/refresh-agent-scoring.js` (wrapper), `.github/scripts/generate-agent-quality-evidence.js` (evidence), and `.github/scripts/generate-agent-quality-report.js` (CSV reports).
- **Canonical test-summary file:** The scoring pipeline expects the repo-root `test-results/.last-run.json` as the canonical Playwright summary. Playwright writes its local output under `playwrightTests/test-results/.last-run.json` — we recommend copying it to the repo root after a run so the scoring scripts find the expected file. Example workflow:

```powershell
npx playwright test
Copy-Item -Path playwrightTests/test-results/.last-run.json -Destination test-results/.last-run.json -Force
node .github/scripts/refresh-agent-scoring.js --standalone
```

- **Memory rules:** Files under `.github/memory/` are committed governance memory (approved static context, decision log, etc.). Agents must not write or modify files there autonomously — all changes must go through human review (PRs).
- **Quick troubleshooting:** If scoring produces no rows, run the refresh script and verify `reports/agent-quality-report.csv` or `audit/agent-quality/*.score.json` exist and that `audit/agent-actions/` contains agent completion events.
