---
description: Score a Jira story's readiness by invoking the Planner Agent for a standalone review.
argument-hint: <story-id>
agent: planner-agent
tools: [read, execute]
---

You are invoking the Planner Agent to assess story readiness before any test design begins.

This prompt accepts exactly one Jira story ID/key.

Argument received: $ARGUMENTS

## Steps

1. Validate the argument: it must be exactly one Jira story ID/key. If zero arguments, more than one, or something that is not a plausible issue key was given, stop and ask the user to re-run with a single story ID.
2. Invoke the Planner Agent to fetch the story via `node .github/scripts/jira-read.js issue <key> ...` and follow the ready-to-use workflow in [.github/skills/jira-story-readiness/SKILL.md](../skills/jira-story-readiness/SKILL.md).
3. Present the verdict and gap list as the final output, and if score metadata is available from the run, append a short summary line generated from the scoring metadata using `node .github/scripts/format-agent-chat-summary.js` so users also see the quality/confidence/recommendation in chat.
4. Log usage per [.github/instructions/agent-usage-logging.instructions.md](../instructions/agent-usage-logging.instructions.md), using `--skill jira-story-readiness`.
5. Optional auto-refresh: if the caller requests automatic scoring refresh, run `node .github/scripts/refresh-agent-scoring.js --standalone` after logging.

## Final response formatting
Use this exact response structure for chat output:

```text
Story Readiness Assessment for <STORY_KEY>
Verdict: <Ready|Not Ready|Needs Clarification>

Gaps: <none blocking readiness | list of blocking gaps>

Notes:
- <brief evidence-based summary>
- <note about acceptance criteria/testability>
- <note about attachments/OCR if applicable>

Scoring summary:
Outcome: <quality>/100 quality with <confidence>/100 confidence. Main issue: <reason_code>. Recommended next step: <recommendation>.
```

Rules:
- Keep the verdict first and the narrative before the scoring block.
- Append a short score-aware summary only when scoring metadata exists.
- If no score metadata exists, keep the verdict and note that scoring details were unavailable.

## Guardrails

- Never call an Atlassian MCP Jira tool.
- Never hardcode Jira credentials or guess missing values.
- Never invent acceptance criteria or business rules.
- If the story cannot be fetched, stop and report the issue instead of guessing.
