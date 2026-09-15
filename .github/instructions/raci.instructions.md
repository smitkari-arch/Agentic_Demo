---
description: "Use when determining who (human role or agent) is Responsible/Accountable/Consulted/Informed for a given work activity - story readiness, test design, scripting, healing, reporting, defect approval, repo check-in."
---

# RACI Matrix

**R** = Responsible (performs work), **A** = Accountable (owns final outcome), **C** = Consulted, **I** = Informed.

| Activity | Planner (QA) | Designer Agent | Scripter Agent | Healer Agent | Human / QA Owner |
|---|---|---|---|---|---|
| Story Readiness Review | R | - | - | - | A |
| Test Scenario Generation | - | R | I | - | A |
| Playwright Script Generation | - | - | R | - | A |
| Artifact Validation (Coverage, quality) | C | - | - | - | A |
| Test Run Execution | - | - | R | - | A |
| Failure Analysis | - | - | - | C | A/R |
| Healing Recommendation | - | - | - | R | A |
| Defect Approval | - | - | - | - | A/R |
| Repository Check-In | - | - | - | - | A/R |
| Policy & Compliance Review | C | I | I | I | A/R |
| Agent & Framework Improvement Actions | C | C | C | C | A |

## Mapping to this folder's skills/agents

| RACI role | This folder's implementation |
|---|---|
| Planner (QA) | Human — the person invoking a skill/prompt, plus [.github/agents/planner-agent.agent.md](../agents/planner-agent.agent.md) for the readiness-scoring check |
| Designer Agent | [generate-test-scenarios](../skills/generate-test-scenarios/SKILL.md), backed by [designer-agent.agent.md](../agents/designer-agent.agent.md) |
| Scripter Agent (Playwright) | [generate-playwright-ui-script](../skills/generate-playwright-ui-script/SKILL.md), backed by [scripter-agent.agent.md](../agents/scripter-agent.agent.md) |
| Healer Agent | [analyze-playwright-failure](../skills/analyze-playwright-failure/SKILL.md), backed by [healer-agent.agent.md](../agents/healer-agent.agent.md) |
| Human / QA Owner | Human review and approval for repo actions, defects, and artifact signoff |
