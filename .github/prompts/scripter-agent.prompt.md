---
description: Convert a story-scoped test case into working Playwright UI specs by invoking the Scripter Agent directly, as a standalone run. Prefer supplying a short `story_id` (e.g., KAN-6) so the prompt will resolve the matching markdown under `playwrightTests/specs/`.
argument-hint: '<story_id (example: "KAN-6") | story_path (example: "playwrightTests/specs/KAN-6/...md") | story_key:test_case_id (example: "KAN-4:TC-01"), optional target_url (falls back to playwright.config.ts baseURL), optional run_tests (true|false), optional output_path>'
agent: scripter-agent
tools: [read, edit, execute]
---

You are invoking the Scripter Agent directly (see [.github/agents/scripter-agent.agent.md](../agents/scripter-agent.agent.md)) to turn a resolved story-scoped test case into Playwright automation and verify it with a real test run.

This prompt accepts any of these inputs (story_id preferred):

- a `story_id` (e.g., `KAN-6`) — the agent will resolve the appropriate markdown under `playwrightTests/specs/` using folder-first lookup rules;
- an explicit `story_path` to a markdown file under `playwrightTests/specs/`;
- a canonical selector in the form `KAN-4:TC-01` to target a single test-case within a story.

If a bare `TC-01` is supplied and ambiguous across stories, stop and ask for the story key instead of guessing.

Argument received: $ARGUMENTS

## Required flow

1. Resolve input to a story markdown using the following precedence (folder-first):
   - If `story_path` is provided and exists, use it.
   - Else if `story_id` is provided, prefer a folder under `playwrightTests/specs/` that matches the id (case-insensitive) and use the first markdown file in that folder. If multiple candidate folders/files remain, return a deterministic disambiguation list and require the caller to re-run with `story_path` or a chosen index.
   - Else if a full selector `story_key:test_case_id` is provided, locate the story folder and test-case section.
2. Locate the exact test-case section to automate.
3. Invoke the Scripter Agent with the resolved story key, test-case ID, and target URL.
4. Instruct the agent to:
   - follow `generate-playwright-ui-script`
   - verify selectors against the live DOM before writing them
   - write the spec under `playwrightTests/`
   - run `npx playwright test` and report the actual pass/fail result
5. Present the spec path(s) and the real Playwright result as the final output.
6. Log usage per [.github/instructions/agent-usage-logging.instructions.md](../instructions/agent-usage-logging.instructions.md), using `--skill generate-playwright-ui-script` and `--jira-story-key <story key>` when the case belongs to a story.

## Safety rules

- Never point the script at a production or transactional environment without explicit human confirmation.
- Never hardcode real credentials or secrets; only intentionally public demo credentials are acceptable.
- Never guess a selector or ambiguous test data when the DOM or case mapping is unclear.
- Local Playwright writes under `playwrightTests/` are a direct agent action; Jira/TestRail or remote repo changes remain human-triggered actions this prompt does not perform.
