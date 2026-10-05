---
description: Triage a failing Playwright UI test run by invoking the Healer Agent with real failure evidence.
argument-hint: <path to the failing report or the pasted failure/output text>
agent: healer-agent
tools: [read, edit, execute, playwright/*]
---

You are invoking the Healer Agent directly (see [.github/agents/healer-agent.agent.md](../agents/healer-agent.agent.md)) to triage a failing Playwright test run.

This prompt accepts exactly one parameter: the actual failing output or report path. A vague description is not sufficient input.

Argument received: $ARGUMENTS

## Steps

1. Validate that the argument contains real failure evidence (a report path the session can read, or pasted stack traces/output).
2. Invoke the Healer Agent with that evidence. The agent will follow the canonical skill [.github/skills/analyze-playwright-failure/SKILL.md](../skills/analyze-playwright-failure/SKILL.md).
3. Present the Healer Agent's result as the final output: either a fix plus passing rerun, or an evidence-backed report for human review. When scoring metadata is available, append a short summary line generated with `node .github/scripts/format-agent-chat-summary.js` so the final answer includes the reasoning, confidence, and recommended next step in chat.
4. Log usage per [.github/instructions/agent-usage-logging.instructions.md](../instructions/agent-usage-logging.instructions.md) with `--skill analyze-playwright-failure`.
5. Optional auto-refresh: if the caller requests automatic scoring refresh, run `node .github/scripts/refresh-agent-scoring.js --standalone` after logging.

## Final response formatting
Use this exact response structure for chat output:

```text
✅ Fix applied / investigation result
<Issue summary>

Root cause:
- <deterministic cause or evidence-backed explanation>

Verification:
- <rerun command>
- <actual result>

Scoring summary:
Outcome: <quality>/100 quality with <confidence>/100 confidence. Main issue: <reason_code>. Recommended next step: <recommendation>.
```

Rules:
- Keep the fix or review finding first.
- Append the score summary only when scoring metadata exists.
- If scoring metadata is absent, keep the actual fix/review narrative and do not invent a score.

## Required guardrails

- Never silently patch selector drift or loosen assertions to force a pass.
- Never repoint the scenario to a different environment.
- Do not widen timeouts as a first response; rule out flake/environment slowness first.
- Do not push anything to Jira, TestRail, or a remote repo.
