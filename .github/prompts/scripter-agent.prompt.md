---
description: Convert a story-scoped test case into working Playwright UI specs by invoking the Scripter Agent directly, as a standalone run. Prefer supplying a short `story_id` (e.g., KAN-6) so the prompt will resolve the matching markdown under `playwrightTests/specs/`.
argument-hint: '<story_id (example: "KAN-6") | story_path (example: "playwrightTests/specs/KAN-6/...md") | story_key:test_case_id (example: "KAN-4:TC-01"), optional target_url (falls back to playwright.config.ts baseURL), optional run_tests (true|false), optional output_path>'
agent: scripter-agent
tools: [read, edit, execute]
---

You are invoking the Scripter Agent directly (see [.github/agents/scripter-agent.agent.md](../agents/scripter-agent.agent.md)) to turn a resolved story-scoped specification into Playwright automation and verify it with a real test run.

This prompt accepts any of these inputs (story_id preferred):

- a `story_id` (e.g., `KAN-6`) — the agent resolves the matching markdown under `playwrightTests/specs/` and generates a script for every `TC-*` section in that story;
- an explicit `story_path` to a markdown file under `playwrightTests/specs/`;
- a canonical selector in the form `KAN-4:TC-01` to target a single test-case within a story.

If a bare `TC-01` is supplied and ambiguous across stories, stop and ask for the story key instead of guessing.

Argument received: $ARGUMENTS

## Required flow

1. Resolve the input to a story markdown using the following precedence (folder-first):
   - If `story_path` is provided and exists, use it.
   - Else if `story_id` is provided, prefer a folder under `playwrightTests/specs/` that matches the id (case-insensitive), read the markdown file(s) in that folder, and process every `TC-*` section in the story. If multiple candidate folders/files remain, return a deterministic disambiguation list and require the caller to re-run with `story_path` or a chosen index.
   - Else if a full selector `story_key:test_case_id` is provided, locate the story folder and target just that test-case section.
2. Locate each relevant test-case section to automate.
   - If the story input resolves to multiple `TC-*` sections, generate one Playwright scenario per case in the same story spec.
   - Do not silently pick only the first happy-path case.
3. Invoke the Scripter Agent with the resolved story key, all target test-case IDs for the story, and the target URL.
4. Instruct the agent to:
   - follow `generate-playwright-ui-script`
   - verify selectors against the live DOM before writing them
   - write the story-level spec under `playwrightTests/`
   - generate one scenario per matching `TC-*` case in the resolved story
   - run `npx playwright test` and report the actual pass/fail result
5. Present the spec path(s) and the real Playwright result as the final output, and append a short score-aware summary produced from the run metadata using `node .github/scripts/format-agent-chat-summary.js` whenever scoring information is available.
6. Log usage per [.github/instructions/agent-usage-logging.instructions.md](../instructions/agent-usage-logging.instructions.md), using `--skill generate-playwright-ui-script` and `--jira-story-key <story key>` when the case belongs to a story.
7. Optional auto-refresh: if the caller requests automatic scoring refresh, run `node .github/scripts/refresh-agent-scoring.js --standalone` after logging.

## Final response formatting
Use this exact response structure for chat output:

```text
✅ <STORY_KEY> Playwright automation is in place
I created the scenario in <spec-file> and updated the supporting page objects in <page-object files> where needed.

Verification
I ran the real Playwright check:
<command>

Result from the actual run:
<actual output, e.g. "1 passed (15.7s)">

Scoring summary:
Outcome: <quality>/100 quality with <confidence>/100 confidence. Main issue: <reason_code>. Recommended next step: <recommendation>.
```

Rules:
- Keep the real Playwright verification result first.
- Append the score summary only when the run has scoring metadata.
- If the run is not scored, keep the answer focused on the test result and state that scoring metadata is unavailable.

## Safety rules

- Never point the script at a production or transactional environment without explicit human confirmation.
- Never hardcode real credentials or secrets; only intentionally public demo credentials are acceptable.
- Never guess a selector or ambiguous test data when the DOM or case mapping is unclear.
- Local Playwright writes under `playwrightTests/` are a direct agent action; Jira/TestRail or remote repo changes remain human-triggered actions this prompt does not perform.
