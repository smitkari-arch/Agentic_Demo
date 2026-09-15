---
name: analyze-playwright-failure
description: "Diagnose and safely heal failing Playwright UI test runs — classify flakes, deterministic scripting bugs, selector drift, stale test data, and regressions. Auto-fix only deterministic, well-scoped issues and always verify via `npx playwright test`."
argument-hint: "Paste the Playwright failure output, failing spec path(s), and optional CI run URL."
---

# Analyze Playwright Failure

Purpose
-------
This skill is the canonical source of truth for the Healer workflow. It triages failing Playwright UI test runs and takes only conservative, deterministic actions automatically. The agent and prompt are thin wrappers around this logic; they should not duplicate the detailed decision tree.

For anything ambiguous (selector drift that may indicate an app regression, or test logic that makes high-risk changes) the skill produces a detailed report and recommended next steps for a human reviewer.

Scope
-----
- Framework: Playwright (UI tests executed with `npx playwright test`).
- Input: Playwright test output (console/stdout/stderr), failing spec path(s), optional CI link, and any relevant stack traces.
- Output: classification, optional local edits to Playwright spec files (only allowed for deterministic fixes), verification logs, and an audit entry logged via `.github/scripts/log-agent-action.js`.

Allowed Tools (examples)
------------------------
- Read/search repository files
- Edit local Playwright spec files in `playwrightTests/` or `tests/` when auto-fix rules apply
- Run local Playwright tests: `npx playwright test` (required for verification)
- Write audit/log entry using the repository's logging script

Non-Allowed Actions (guardrails)
--------------------------------
- No external writes (Jira/TestRail) without explicit human instruction.
- No embedding of secrets or credentials into test files.
- No speculative edits that could mask application regressions; these must be surfaced for human review.
- Follow the repo guardrails in `.github/instructions/guardrails-policy.instructions.md`.

Process (high level)
--------------------
1. Reproduce: Rerun the failing spec(s) locally targeting the failing test only.
2. Classify: Determine whether the failure is a `flake`, `deterministic script bug`, `selector drift`, `stale test data`, or `application regression`.
3. Auto-fix (if applicable): Apply only agreed deterministic edits (see Auto-fix Rules) and run verification.
4. Verify: Run `npx playwright test <spec> -g "<test name>"` and capture full output and reporter artifacts.
5. Report & Log: Produce a concise report with classification, diffs of any edits, verification output, and write an audit event with `.github/scripts/log-agent-action.js`.

Classification buckets (signals → action)
-----------------------------------------
- Flake:
  - Signal: Single transient timeout, network hiccup, intermittent 5xx in external resource; reruns succeed.
  - Action: Retry locally up to 3 times; if stable, annotate as flaky and do not edit tests.
- Deterministic script bug:
  - Signal: Clear test code anti-patterns (missing awaits, incorrect use of Promise-returning helpers), deterministic replay reproduces failure.
  - Action: Auto-fix allowed when pattern matches known-safe fixes (see Auto-fix Rules). Require verification run.
- Selector drift:
  - Signal: Selectors that previously matched now return 0 elements but page structure shows only small, local renames.
  - Action: Do NOT auto-fix unless the selector can be deterministically and locally repaired with high confidence; otherwise report for human review with suggested selector(s).
- Stale test data:
  - Signal: Assertions expecting data that is time-bound or environment-bound (dates, tokens), or known test account state mismatch.
  - Action: Auto-fix only where test contains hardcoded timestamps that can be safely parameterized; otherwise produce remediation steps.
- Application regression:
  - Signal: Multiple unrelated selectors break, or manual inspection shows UI changed in a featureful way.
  - Action: Report immediately for human review; do not auto-fix.

Auto-fix Rules (conservative)
----------------------------
- Allowed auto-fixes (only when the pattern matches exactly):
  1. Missing `await` before Playwright navigation or locator actions when stack traces and code inspection clearly show a missing await and adding it has deterministic effect.
  2. Replace flaky `page.waitForTimeout(<ms>)` uses with `await page.waitForSelector('<selector>', { state: 'visible', timeout: <ms> })` when the selector is stable and present on the page.
  3. Fix trivial selector typos where a single-character typo is the only plausible cause and an identical selector exists elsewhere in the repo matching the DOM.
  4. Parameterize hardcoded dates/timestamps in test code to use dynamic helpers if present in the repo (prefer existing helpers in `playwrightTests/` or `tests/`).

- Forbidden auto-fixes:
  - Broad selector rewrites or heuristics that may change test semantics.
  - Any edit that touches authentication, credentials, or external-system integration.
  - Changes that would alter assertions' intent (e.g., weakening assertions to avoid failures).

Verification (required)
----------------------
Always run targeted verification after any edit. Use these commands locally to reproduce and verify:

```bash
# Run the single failing spec (example)
npx playwright test path/to/spec.spec.ts -g "Test name substring"

# Run with HTML reporter to inspect traces
npx playwright test path/to/spec.spec.ts -g "Test name substring" --reporter=html
```

Capture and attach stdout/stderr, Playwright trace or HTML report, and include the full command and exit code in the skill output.

Logging & Audit
---------------
Call the repository logging helper with the skill name, classification, and brief summary. Example pattern (adapt per repo script arguments):

```bash
node .github/scripts/log-agent-action.js --skill analyze-playwright-failure --status fixed --summary "Fixed missing await in tests/foo.spec.ts" --artifact ./playwright-report.html
```

Examples (inputs and suggested edits)
------------------------------------

Example 1 — Missing await (auto-fix allowed)

Input (snippet failing stack trace):

```
TypeError: Cannot read properties of undefined (reading 'click')
at Object.<anonymous> (playwrightTests/LoginPage.ts:42:12)
```

Before (playwrightTests/LoginPage.ts):

```ts
page.locator('#login-button').click();
await page.waitForSelector('#dashboard');
```

After (fixed):

```ts
await page.locator('#login-button').click();
await page.waitForSelector('#dashboard');
```

Verification: run the failing spec and confirm it passes; include run output and exit code.

Example 2 — Replace waitForTimeout with waitForSelector (auto-fix allowed)

Before (tests/saucedemo/Login.spec.ts):

```ts
await page.waitForTimeout(2000);
await expect(page.locator('.inventory_list')).toBeVisible();
```

After (fixed):

```ts
await page.waitForSelector('.inventory_list', { state: 'visible', timeout: 5000 });
await expect(page.locator('.inventory_list')).toBeVisible();
```

Reviewer checklist (what to validate before merging)
--------------------------------------------------
- Confirm the failing spec reproduces locally before edits.
- Confirm the edit is one of the allowed auto-fix patterns.
- Run the single spec with `npx playwright test` and verify it passes consistently.
- Confirm no secrets or credentials were added or changed.
- Confirm audit log entry exists in `audit/agent-actions/` after running the skill.

Human escalation
----------------
If classification is `selector drift` (uncertain) or `application regression`, produce a human-readable report containing:
- Steps to reproduce
- Screenshots / Playwright HTML report or trace
- Suggested selectors or remediation steps (but do not apply them automatically)

References
----------
- Guardrails and non-negotiables: `.github/instructions/guardrails-policy.instructions.md`.
- Playwright scripting conventions and examples: `playwrightTests/` and `tests/` in the repo.
