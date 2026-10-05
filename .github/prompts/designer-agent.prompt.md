---
description: Generate a test-case list for a single Jira story by invoking the Designer Agent directly, as a standalone run.
argument-hint: <story-id>
agent: designer-agent
tools: [read, execute]
---

You are invoking the Designer Agent directly to generate a structured test-case list from one Jira story.

This prompt accepts exactly one Jira story ID/key.

Argument received: $ARGUMENTS

## Steps

1. Validate the argument: it must be exactly one Jira story key. If zero arguments, more than one, or a non-plausible issue key was provided, stop and ask the user to rerun with a single story ID.
2. Invoke the Designer Agent to fetch the real story via `node .github/scripts/jira-read.js issue <key> <fields>` and follow the canonical workflow in [.github/skills/generate-test-scenarios/SKILL.md](../skills/generate-test-scenarios/SKILL.md). If the story implies negative or boundary coverage but does not define the needed cases, ask the user to provide them; if those categories are not applicable, say so explicitly in the spec. Never call an Atlassian MCP Jira tool or raw `curl` for text fetches.
3. Create or update the design artifact under `playwrightTests/specs/<story-key>/<slug>.md`. The artifact must contain test cases only (plus optional coverage notes); do not include `## Story Summary` or `## Acceptance Criteria` sections.
4. Return the saved file path plus a short summary as the final output, and if score metadata is available from the run, append a short summary line generated from the scoring metadata using `node .github/scripts/format-agent-chat-summary.js` so the chat output includes the outcome quality/confidence and recommendation.
5. Log usage per [.github/instructions/agent-usage-logging.instructions.md](../instructions/agent-usage-logging.instructions.md), using `--skill generate-test-scenarios`.
6. Optional auto-refresh: if the caller requests automatic scoring refresh, run `node .github/scripts/refresh-agent-scoring.js --standalone` after logging.

## Final response formatting
Use this exact response structure for chat output:

```text
✅ Test design artifact created
Saved at <repo-relative path>

This spec includes <N> business-level test cases for <STORY_KEY>, covering:
- <primary positive path>
- <negative validation path>
- <boundary or edge coverage if applicable>
- <coverage note if not applicable>

Verification:
- <brief confirmation that the artifact matches the story and acceptance criteria>

Scoring summary:
Outcome: <quality>/100 quality with <confidence>/100 confidence. Main issue: <reason_code>. Recommended next step: <recommendation>.
```

Rules:
- Keep the saved artifact result first; do not bury it under raw metrics.
- Append the score summary after the narrative when scoring metadata exists.
- If the run was not scored or the metadata is missing, omit the score block rather than inventing values.

## Rules
- If the story is missing its description or acceptance criteria, or cannot be fetched, stop and surface the issue instead of guessing.
- The skill remains the source of truth for the full test-case format, guardrails, and logging commands.
- This prompt only orchestrates the run and writes the repo-local design artifact under [specs](../specs).
- Keep the saved artifact lean: AC traceability belongs inside each test case (e.g., `- AC: AC1`), not in a separate acceptance-criteria section.
