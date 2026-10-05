---
name: generate-test-scenarios
description: Write test cases (positive/negative/boundary) from a user story's description and acceptance criteria. Does NOT write automation scripts — output is a structured test-case list only. Use when asked to "plan tests", "write test cases", "generate test scenarios", or "create a test plan" from a story or Jira issue. (Renamed from test-planner.)
argument-hint: '[Jira story key or pasted story text]'
---

# Generate Test Scenarios

Turn a user story into a structured, ready-to-automate test case list. Nothing else — no scripts, no framework code, no selectors. Backs the Designer Agent role in [.github/agents/designer-agent.agent.md](../../agents/designer-agent.agent.md) and follows the repo workflow defined in [.github/instructions/execution-model.instructions.md](../../instructions/execution-model.instructions.md).

## Access & tool scope
- **Invoke by:** anyone drafting test coverage from a story — read-only against the repo and Jira, plus a local repo write for the generated design spec.
- **Tools this skill relies on:** read, search (file/text search), execute (for `jira-read.js`, and for logging this run's outcome), and local file write under [specs](../../specs) — this is a direct, repo-local artifact output and is allowed as part of the design workflow.
- **No Atlassian MCP tool** — this skill never calls an MCP Jira tool.

## Relationship to jira-story-readiness
Ideally this skill runs after [jira-story-readiness](../jira-story-readiness/SKILL.md) has verdicted a story Ready. It also works standalone — if invoked directly against a story that hasn't been through a readiness check, apply the same "ask, don't guess" rule below as a built-in safety net.

## Input required
- Story key (fetch via `jira-read.js`, per [instructions/jira-access.instructions.md](../../instructions/jira-access.instructions.md)) or pasted story text.
- Must contain a description + acceptance criteria (AC). If either is missing, ask for it — don't guess business rules.
- If the story or ACs imply negative or boundary coverage but do not define the needed cases, ask the user to provide those cases before generating the spec.
- If the story genuinely does not imply negative or boundary coverage, say that explicitly in the spec as not applicable.
- If given a story key, fetch it via `node .github/scripts/jira-read.js issue <key> summary,description` — never an Atlassian MCP tool, and never raw `curl` (`jira-read.js` redacts PII in-process before printing, so it doesn't depend on a `PostToolUse`-style hook's intermittent firing the way raw `curl` did). `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` must come from environment variables — the script throws if any is unset, don't guess a value to work around that. Always constrain the fields to what's needed, e.g. `summary,description` — never the default/full field set, which includes `reporter`/`assignee` and would carry real email addresses into model context. Only widen the field list if a specific field is actually needed.

## Process
1. Read the description and every AC individually.
2. For each AC, write one or more test cases covering, where applicable:
   - **Positive** — the AC's happy path.
   - **Negative** — invalid input, missing required field, unauthorized/blocked state.
   - **Boundary** — min/max length, edge dates, empty vs. max values (only where the story's own data implies a real boundary — don't invent one).
3. Number test cases and map each to its AC (e.g. `AC2-TC1`).
4. Save the final result as a review-friendly Markdown spec under `playwrightTests/specs/<story-key>/<slug>.md` (for example: `playwrightTests/specs/KAN-3/login-valid-user.md`). Use a numbered test-case format with sections like `TC-01`, `TC-02`, and a short note when negative or boundary coverage is not applicable. The saved artifact must contain test-case content only; do not include `## Story Summary` or `## Acceptance Criteria` sections.
5. Stop at business-level steps. No UI selectors, URLs, or framework/tool syntax — that belongs to the scripting skills.
6. Log this run: `node .github/scripts/log-agent-action.js --skill generate-test-scenarios --status success --summary "<N> test cases generated for <story key or ref>" --jira-story-key <story key>` (use `--status blocked` instead if the story lacked a description/AC and generation was refused; omit `--jira-story-key` if only pasted text with no key was given).

## Output format
The artifact saved under `playwrightTests/specs/` should use a readable Markdown structure like:

```md
# KAN-3: Verify a valid user login to application

## Test Cases

### TC-01: Successful login with valid credentials
- AC: AC1
- Type: Positive
- Preconditions:
  - ...
- Steps:
  1. ...
- Expected Result:
  - ...

### TC-02: Login rejected with invalid password
- AC: AC1
- Type: Negative
- ...

## Coverage Notes
- Boundary coverage is not applicable when no explicit boundaries are defined in the story.
```

Allowed top-level sections are title, `## Test Cases`, and optional `## Coverage Notes`.
Do not restate the story description or acceptance criteria as separate sections in the saved artifact.

Do not rely on a chat-only table as the canonical artifact; the saved spec file is the deliverable.

## Guardrails (Non-Negotiable)
- Never call an Atlassian/Jira MCP tool — Jira access is via `jira-read.js`, per [instructions/jira-access.instructions.md](../../instructions/jira-access.instructions.md). Never hardcode `JIRA_BASE_URL`, `JIRA_EMAIL`, or `JIRA_API_TOKEN` — read them from environment variables, and stop rather than guess if any is unset.
- Never invent or assume a business rule, validation limit, or data constraint that isn't stated in the story/AC — if the story is ambiguous or silent on a case, ask the user rather than guessing (this includes boundary values: don't fabricate a "max length" that was never given).
- Never include implementation details — selectors, URLs, code, tool/framework syntax — in a test case. That belongs to the scripting skills (e.g. [generate-playwright-ui-script](../generate-playwright-ui-script/SKILL.md)), not here; this skill's output must stay usable regardless of which framework later automates it.
- Never silently drop an AC because it's hard to test — if a category (positive/negative/boundary) genuinely doesn't apply, say so explicitly rather than omitting it without comment.
- Never include `## Story Summary` or `## Acceptance Criteria` sections in the saved spec; preserve story traceability via AC mapping within each test case (for example `- AC: AC2`).

## Checklist before finishing
- [ ] Every AC has at least one test case
- [ ] Positive, negative, and boundary considered per AC (note explicitly if a category doesn't apply, don't just omit it silently)
- [ ] Test data is concrete — no "some value" / "valid input" placeholders
- [ ] Each test case is independently executable (preconditions stated, not assumed from a prior test case)
- [ ] No duplicate test cases across ACs
- [ ] No implementation detail leaked in (selectors, code, tool/framework names)
- [ ] This run logged via `log-agent-action.js`
