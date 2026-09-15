# Decision log

Human-approved decisions and exceptions affecting this repo's agent-assisted QA workflow, with dates.

| Date | Decision | Approved by |
|---|---|---|
| 2026-07-14 | Implemented real `PreToolUse`/`PostToolUse` PII-scan-and-redact hooks (`pii-ocr/pii-scanner.js` + `sanitize.js`, wired via hook registration) for Atlassian/Jira tool calls, moving that specific pair from "scaffold only" to functional — as a practical demo of the agents→skills→hooks+scripts→tools→hooks+scripts→output flow. Mode: log + redact only, never blocks. RBAC/tool-access enforcement (`pre-tool-policy-check`) and `UserPromptSubmit` scanning remain scaffold-only/deferred. | Repo owner, via chat |
| 2026-08-12 | Ported this repo's Claude Code governance layer to a self-contained GitHub Copilot-native implementation under `COPILOT_AUTOMATION/`, staged for eventual split into its own standalone repo. Additive only — the original `.claude/` implementation stays untouched and continues to work unmodified. | Repo owner, via chat |

