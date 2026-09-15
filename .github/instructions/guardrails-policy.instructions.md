---
description: "Use when checking what agents/skills are allowed or prohibited from doing autonomously - RBAC, PII handling, tool controls, human-in-the-loop gates, and this repo's scoping of 'no direct write' to local .feature files only."
---

# Guardrails & Policy Layer

This is the narrative/rationale behind [copilot-instructions.md](../copilot-instructions.md)'s enforceable "Governing rules (non-negotiable)" section — `copilot-instructions.md` is what's actually binding day-to-day; this file explains the broader model it's drawn from.

## Layered model
- **Human Governance** — governance ownership, approval gates, exception handling, and audit accountability.
- **Policy & Guardrails Layer** — RBAC, tool permissions, PII masking/redaction, prompt controls, output validation, audit logs, memory governance. Implemented under [.github/hooks/](../hooks/), [.github/pii-ocr/](../pii-ocr/).
- **Agent Execution Layer** — Designer Agent, Scripter Agent, and Healer Agent. See [.github/agents/](../agents/).
- **Tool Access Layer** — IDE extension, browser, Jira, TestRail, Playwright test run, reports, logs. See `.vscode/mcp.json`.
- **Knowledge & Memory Layer** — approved static KB, sprint context, decision log, execution history, failure learning. See [.github/memory/](../memory/).

## Ownership & control model

| Area | Controls |
|---|---|
| Agent Access & Perm | Role-based agent skills; on-behalf-of access to agents; read + execute in Phase 1 |
| Data Protection | PII/secrets blocking; sanitized logs/payloads; no credentials/key visibility |
| Tool Controls | Approved skills/prompts; debug prompts read-only; tool calls controlled & auditable |
| Output Validation | Syntax and standards; traceability mandatory; no hallucinated APIs / selectors / test data |
| HITL | Review agent outcomes; approve high-impact actions; validate exceptions/failures; delegate permitted tasks to agents |
| Audit & Memory | Key agent actions/decisions logged; approved KB updates; decision log maintained |

## Phase 1 principle
Agents generate, execute, analyze, and recommend. Humans approve coverage changes, script promotion, defect creation, healing acceptance, and memory updates.

## Agent Prohibited Actions
- No bypass of RBAC / tenant boundaries.
- No autonomous privileged access.
- No direct write to repo/tools *for external systems of record* (Jira, TestRail) — see the note below on how this folder scopes that principle.
- No destructive actions or production changes.
- No hallucinated APIs, test results, or evidence.
- No autonomous release, defect closure, or healing acceptance.

### How this repo scopes "no direct write"
This repo treats local Playwright specs and helpers as direct agent actions under human PR/code review, and it also treats business-level design artifacts under [specs](../../specs) as direct agent actions for the design workflow. External systems of record remain explicit human-triggered actions. Local writes remain gated by [copilot-instructions.md](../copilot-instructions.md)'s existing rules: live-DOM verification, mandatory real `npx playwright test` runs, and conservative healing limits. See [phase1-scope.instructions.md](phase1-scope.instructions.md).

## Workflow Checkpoints
Every agent step in [execution-model.instructions.md](execution-model.instructions.md) has a defined input/output and an explicit human checkpoint before anything is written externally or checked into the repository.
