---
description: "Use when planning or explaining the individual AI agent workflow (Planner, Designer, Scripter, Healer), or determining which custom agent/skill should be invoked for a given task."
---

# AI Agent Execution Model | AI-Assist Mode | Phase 1

Adapted to this repo's actual Playwright-first skill and agent names for direct, one-off agent execution.

## Execution narrative

1. **Planner (Human)** identifies user stories/test tasks in Jira and reviews for completeness, consistency, and acceptance criteria.
2. **Planner Agent** (`jira-story-readiness`) can score story readiness before any design work begins.
3. **Designer Agent** (`generate-test-scenarios`) can create a review-ready markdown test-case spec under `playwrightTests/specs/` from a ready story or a directly supplied story draft.
4. **Scripter Agent** (`generate-playwright-ui-script`) can turn the saved test-case spec into working Playwright specs and run `npx playwright test` for real.
5. **Healer Agent** (`analyze-playwright-failure`) can reproduce failures and classify them as flaky, deterministic script bug, stale data, selector drift, or likely regression.
6. **Human review / approval** remains a manual checkpoint for repo actions, defect decisions, and any external-system write when needed.
7. Approved artifacts are pushed by the human, not autonomously, through the repo review or external-system gate.
8. Automated Playwright runs continue in CI/CD as the repo's supported execution path.

## Supporting layers (run throughout, not as discrete steps)
- **Memory Bank (Knowledge Base)** — approved static contexts, app context, and workflow decisions. See [.github/memory/](../memory/).
- **Human supervision** — keeps sprint context and decisions throughout the flow, without a separate orchestration layer file.
- **Logs & Reports** — execution history and tool-call trace. See [reports/](../../reports/) and [audit/](../../audit/).
- **Policy & Guardrails** — validates all agent input/output and execution boundaries. See [guardrails-policy.instructions.md](guardrails-policy.instructions.md).

## Legend
- **HITL (Human):** Planner and manual review/approval steps.
- **Automated/Agents:** Designer, Scripter, Healer Agent steps, and the Playwright execution itself.
