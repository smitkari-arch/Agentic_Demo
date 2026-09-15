---
description: "Use when determining what's in/out of scope for Phase 1 of this workflow - Playwright UI/API automation, TestRail gating, deferred RBAC enforcement, and model/context/tooling assumptions."
---
phase1-scope.instructions.md

# Scope & Assumptions — Phase 1

Annotated with what's already true in this folder vs. still deferred.

## In Scope — Phase 1 Coverage
- UI test automation agents for the Playwright framework. *(UI: implemented via `generate-playwright-ui-script`.)*
- Designer, Scripter, Healer custom agents via the IDE extension/plugin with defined roles, skills and tools. *(Implemented — see [.github/agents/](../agents/) and [.github/skills/](../skills/).)*
- Browser, Jira and TestRail access with logging. *(Browser: Playwright MCP tools. Jira: MCP or REST, read-only for skills. TestRail: read-only by default — see "Operating Assumptions" below.)*
- Playwright dry-run execution in local/test environment. *(Implemented — `npx playwright test`, gated against production URLs by `copilot-instructions.md`.)*
- Excel/CSV based KPI measurements via defined template. *(Implemented as [.github/scripts/generate-kpi-report.js](../scripts/generate-kpi-report.js), which appends one CSV row per real test suite run from Playwright JSON output or repo reports to `reports/kpi-report.csv`; story-key correlation is optional.)*
- Outputs generated as artifacts for human review and PR workflow. *(Implemented as generated markdown/test artifacts and direct human review of the working tree until this folder becomes its own repo.)*

## How Agents Will Operate
- Agents are invoked individually, with shared context reused when helpful within a run.
- Phase 1 agent permissions: **read + execute + recommend**.
- **No direct write/update to Jira, TestRail, repo[^1], or memory[^2] without an explicit human trigger.**
- Inline validation is part of agent behavior; human validation remains mandatory.
- Human reviewer / QA owner owns approval for repository check-in and defects.
- No persistent chat history is sent beyond what the platform itself retains; current prompt + tool returns + approved context only.

[^1]: "Repo" here means external systems of record and this project's committed governance memory ([.github/memory/](../memory/)) — local Playwright spec and helper writes are a confirmed, scoped exception; see [guardrails-policy.instructions.md](guardrails-policy.instructions.md#how-this-repo-scopes-no-direct-write).
[^2]: Not to be confused with any personal cross-session auto-memory a given AI coding assistant may have, which is a separate mechanism outside this folder entirely.

## Deferred / Explicitly Excluded
- Direct repository commits or autonomous PR merge by agents.
- Autonomous defect creation/update without human gate approval.
- Autonomous memory updates or full chat-history replay.
- Self-healing beyond minor UI locator-level recommendations. *(Matches `analyze-playwright-failure`'s existing bounded auto-fix model.)*
- Full STLC transformation beyond the automation workflow.
- Billing-grade token precision or cost guarantees in pilot estimates.
- Functional RBAC/tool-restriction enforcement beyond each agent's/skill's own `tools:` declaration — no separate policy-check hook is implemented yet.
- PII-scanning of the user prompt itself (`UserPromptSubmit`) — implemented, see [.github/hooks/](../hooks/) and [.github/pii-ocr/](../pii-ocr/). This event can only **block** the prompt on a match, not rewrite it.
- Token optimization tooling ("RTK") — implemented as [rtk/](../../rtk/), a `PostToolUse` hook on terminal tool output; see [rtk/README.md](../../rtk/README.md).

## Model, Context & Tooling Assumptions
- **Model Class:** Enterprise-grade large model; estimates remain model-neutral and rounded.
- **Input Context:** Jira story, Playwright failure report, screenshot summaries, failed script, framework/test details, required context files.
- **Tool Output Handling:** Screenshots, DOM, Jira comments, repo files, and logs are extracted/summarized/trimmed before model use — full raw dumps are not assumed.
- **Browser Usage:** Controlled Playwright-style login/navigation, focused DOM inspection, summarized extraction — not exploratory full-DOM browsing.

## Phase 1 Exit Criteria
- **Functional:** Agent-ready Jira template, generated scenarios/test cases, Playwright UI/API specs, dry-run evidence, human-reviewed artifacts for selected flows.
- **Governance:** Human review, PR review, traceability, and key audit metadata/reports are demonstrable.
- **Quality:** Dry-run pass rate, review feedback, and healing recommendations show measurable improvement.
- **Operational:** Approved knowledge base, sprint context, and decision log are maintained without raw-history overload.
