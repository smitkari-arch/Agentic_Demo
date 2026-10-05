# Agents and Skills Overview

This file summarizes the active agents, their backed skills, allowed actions, and useful links so AI coding agents and contributors can get productive quickly.

## Agents

- Planner Agent — readiness gate
  - Role: evaluate a Jira story's readiness for test design
  - Backing skill: [jira-story-readiness](.github/skills/jira-story-readiness/SKILL.md)
  - Invoke via: [planner-agent.prompt.md](.github/prompts/planner-agent.prompt.md)
  - Allowed: read Jira (via `node .github/scripts/jira-read.js`), produce readiness verdict + gap list, log action via `log-agent-action.js`
  - Not allowed: create Jira issues, write to repository memory

- Designer Agent — test-case author
  - Role: generate positive/negative/boundary test scenarios from a ready story
  - Backing skill: [generate-test-scenarios](.github/skills/generate-test-scenarios/SKILL.md)
  - Invoke via: [designer-agent.prompt.md](.github/prompts/designer-agent.prompt.md)
  - Allowed: write business-level markdown specs under `playwrightTests/specs/`, link to artifacts for scoring
  - Not allowed: commit directly to remote systems without human approval

- Scripter Agent — Playwright implementer
  - Role: convert story-scoped test cases into Playwright specs and run real tests
  - Backing skill: [generate-playwright-ui-script](.github/skills/generate-playwright-ui-script/SKILL.md)
  - Invoke via: [scripter-agent.prompt.md](.github/prompts/scripter-agent.prompt.md)
  - Allowed: edit `playwrightTests/` files, run `npx playwright test`, produce `playwright-report/results.json`
  - Not allowed: target production without explicit human confirmation

- Healer Agent — failure triage and safe fixes
  - Role: classify failing runs and apply conservative, deterministic fixes
  - Backing skill: [analyze-playwright-failure](.github/skills/analyze-playwright-failure/SKILL.md)
  - Invoke via: [healer-agent.prompt.md](.github/prompts/healer-agent.prompt.md)
  - Allowed: apply limited auto-fixes (missing `await`, replace `waitForTimeout` when safe, parameterize hardcoded dates), rerun tests for verification
  - Not allowed: broad selector rewrites or changes that mask regressions

## Scoring, logging, and evidence

- Logging helper: `.github/scripts/log-agent-action.js` writes structured events to `audit/agent-actions/` (used by CI and scoring).
- Scoring pipeline: see `.github/scripts/generate-agent-quality-evidence.js`, `.github/scripts/validate-agent-quality-evidence.js`, and `.github/scripts/generate-agent-quality-report.js`.
- Canonical per-run evidence: `audit/agent-quality/*.score.json`; reports live in `reports/`.

## Memory and governance notes

- Repo-committed memory: `.github/memory/` (approved-static-context.md, decision-log.md). Agents must not write here autonomously — updates are human-reviewed via PRs.
- Guardrails: consult `.github/instructions/guardrails-policy.instructions.md` for allowed tools and write-scopes.

## Quick references

- Copilot/agent guidance: [`.github/copilot-instructions.md`](.github/copilot-instructions.md)
- Execution model and governance: [.github/instructions/execution-model.instructions.md](.github/instructions/execution-model.instructions.md) and [.github/instructions/guardrails-policy.instructions.md](.github/instructions/guardrails-policy.instructions.md)
- Scoring docs and validation: [docs/check-scoring.md](docs/check-scoring.md)

---
Generated to help AI coding agents and contributors quickly find agent responsibilities, constraints, and links to canonical skills and scripts.
