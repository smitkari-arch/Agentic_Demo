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
2. Invoke the Designer Agent to fetch the real story via `node .github/scripts/jira-read.js issue <key> <fields>` and follow the canonical workflow in [.github/skills/generate-test-scenarios/SKILL.md](../skills/generate-test-scenarios/SKILL.md). Never call an Atlassian MCP Jira tool or raw `curl` for text fetches.
3. Create or update the design artifact under `playwrightTests/specs/<story-key>/<slug>.md`.
4. Return the saved file path plus a short summary as the final output.
5. Log usage per [.github/instructions/agent-usage-logging.instructions.md](../instructions/agent-usage-logging.instructions.md), using `--skill generate-test-scenarios`.

## Rules
- If the story is missing its description or acceptance criteria, or cannot be fetched, stop and surface the issue instead of guessing.
- The skill remains the source of truth for the full test-case format, guardrails, and logging commands.
- This prompt only orchestrates the run and writes the repo-local design artifact under [specs](../specs).
