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
3. Present the verdict and gap list as the final output.
4. Log usage per [.github/instructions/agent-usage-logging.instructions.md](../instructions/agent-usage-logging.instructions.md), using `--skill jira-story-readiness`.

## Guardrails

- Never call an Atlassian MCP Jira tool.
- Never hardcode Jira credentials or guess missing values.
- Never invent acceptance criteria or business rules.
- If the story cannot be fetched, stop and report the issue instead of guessing.
