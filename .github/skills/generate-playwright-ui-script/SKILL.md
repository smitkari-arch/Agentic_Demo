---
name: generate-playwright-ui-script
description: Convert a story-scoped test case into Playwright UI framework test scripts only. Does NOT write test cases or analyze requirements — input must already be a resolved story test case (preferred input: a `story_id` that maps to a spec under `playwrightTests/specs/`). Use when asked to "write Playwright scripts", "automate these test cases in Playwright", "generate Playwright UI tests", or "generate Playwright tests".
argument-hint: '[story_id (example: "KAN-6") | story_path (example: "playwrightTests/specs/KAN-6/...md") | story_key:test_case_id (example: "KAN-4:TC-01"), target app URL (optional), run_tests?]'
---

# Generate Playwright UI Script

Turn a resolved story-scoped test cases such as `KAN-4` into working Playwright specs, page objects, and helpers inside `playwrightTests/`. Playwright only — never Karate, Cypress, or Selenium code. Backs the Playwright Scripter Agent role in [.github/agents/scripter-agent.agent.md](../../agents/scripter-agent.agent.md) and follows the repo workflow documented in [.github/instructions/execution-model.instructions.md](../../instructions/execution-model.instructions.md).

## Access & tool scope
- **Invoke by:** automation engineers who own `playwrightTests/` — this skill writes files and runs `npx playwright test`, not for casual/read-only use.
- **Tools this skill relies on:** read, edit, search (file/text search), execute (for `npx playwright test` only), and the `playwright/*` MCP tools (live-DOM selector verification only). No TestRail or Jira calls.
- **Scope boundary:** This skill creates and validates Playwright UI scripts only. It does not generate a final-review package, approval artifact, or analyst-style review output. Any execution log or report produced during the run is operational audit data only, not a separate workflow gate.
- **Note on local writes:** writing/editing Playwright test files here is a confirmed, deliberate exception to the "no direct write" principle for external systems — see [.github/instructions/guardrails-policy.instructions.md](../../instructions/guardrails-policy.instructions.md#how-this-repo-scopes-no-direct-write).

## Input required
- A `story_id` (e.g., `KAN-6`) which the skill will resolve to a markdown file under `playwrightTests/specs/` (preferred), OR
- A resolved story-scoped test case selector in the canonical form `KAN-4:TC-01` (to target a single test-case), OR
- An explicit `story_path` pointing at the markdown file to process.
- Target app URL (optional) — if omitted, fall back to `playwright.config.ts` `baseURL`.
- Confirm `playwrightTests/` already exists at repo root before starting — reuse its `playwright.config.ts` and project structure, never create a second Playwright project.

If a selector is provided in the form `story_key:test_case_id`, generate only that single test scenario/spec. If the input is a story ID or a story path and the resolved markdown contains multiple `TC-*` sections, generate one Playwright scenario per test case found in that story. Do not silently pick the first happy-path case. If a bare `TC-01` is supplied and more than one story contains that ID, stop and ask for the story key instead of guessing.

### Story-id resolution rules
- `resolveStoryPath({story_id, story_path})` precedence:
	1. If `story_path` is provided and exists, use it.
	2. If `story_id` is provided, prefer a folder under `playwrightTests/specs/` that matches the id (case-insensitive), and use the first markdown file in that folder.
	3. Fallback: search for files under `playwrightTests/specs/` whose filename or path contains the `story_id` substring.
	4. Final fallback: scan markdown frontmatter or leading lines for the story id.
	5. If multiple candidates remain, return a deterministic list and require the caller to provide `story_path` or choose an index.

Implementers: expose `story_id` and `story_path` as accepted inputs. The skill should return a clear message when resolution is ambiguous and avoid guessing.

## Before writing any script
- [ ] Inspect the live app (browser tool / DOM check) for real selectors — never guess ids/classes/attributes.
- [ ] Confirm whether the app is a single-page app or a traditional multi-page flow; this affects waits, route transitions, and page-object structure.

## Before writing any code
- Read `playwrightTests/tests/seed.spec.ts` as the reference baseline for project style and patterns.
- Inspect existing page objects under `playwrightTests/pages/` before creating new ones.

## Project conventions (reuse, don't reinvent)
- Keep the project self-contained under `playwrightTests/`.
- Place reusable UI actions in `pages/` as page-object classes.
- Place scenario specs under `tests/`, grouped by feature or page area.
- Reuse `playwright.config.ts` for baseURL, reporters, timeouts, and browser setup.
- Prefer `page.getByRole()`, `getByLabel()`, and `getByTestId()` when the DOM exposes stable semantic selectors.
- Keep one test scenario per test case, with clear naming and a meaningful title.

## Framework rules — NON-NEGOTIABLE
These rules are mandatory for any script or page-object produced by this skill.

### Imports
- Import `test` and `expect` from `fixtures/base.ts` — never import them directly from `@playwright/test`.
- Import page objects from `playwrightTests/pages/` (do not inline locators in specs).

### File naming and location
- Test files must be kebab-case and end in `.spec.ts`.
- File path should mirror the app URL or feature hierarchy.
- One feature area per `test.describe` block.

### Test structure
- Wrap scenarios in `test.describe('<feature name>', () => { ... })`.
- Use `test.step()` for flows that contain more than 3 actions to improve traceability.

### Page Object contract
- Every page object is a class in `playwrightTests/pages/` that extends `BasePage`.
- Constructor signature: `constructor(page: Page)` only.
- All locators are `readonly` properties and must be initialised in the constructor.
- Action methods return `Promise<void>` or the next page object instance.
- Page objects MUST NOT contain `expect()` assertions — assertions belong only in specs.

### Locator strategy (STRICT priority order)
For every element interaction, choose a locator in this order. Stop at the first one that resolves uniquely:
1. `getByRole(role, { name })` with an accessible name
2. `getByLabel(labelText)` for form fields
3. `getByPlaceholder(text)` when no label exists
4. `getByTestId(id)` — attribute name is `data-test-id`
5. `getByText(text)` only for genuinely static UI copy

Forbidden without an explicit code comment justifying it:
- CSS selectors
- XPath
- Chained deep selectors
- Nth-based selection when a name is available

If none of the priority locators resolve uniquely, STOP and ask the user rather than falling back to CSS.

### Assertion rules
- Prefer web-first assertions (for example, `expect(locator).toBeVisible()`, `toHaveCount()`, `toHaveText()`).
- NEVER use `page.waitForTimeout` — rely on auto-waiting locators and explicit `expect()` checks.
- NEVER use `waitForSelector` — use `expect(locator).toBeVisible()` instead.

## Reference example — match this style
```ts
import { test, expect } from '../../src/fixtures/base';
import { LoginPage } from '../../src/pages/LoginPage';
import { InventoryPage } from '../../src/pages/InventoryPage';
import users from '../data/users.json';

test.describe('Standard user login', () => {
	test('lands on inventory with 6 products ', async ({ page }) => {
		const login = new LoginPage(page);
		await login.goto();
		const inventory = await login.loginAs(users.standard);
		await expect(inventory.productCards).toHaveCount(6);
	});
});
```

Match this style:
- Import order: fixtures, page objects.
- Page objects instantiated with `new`, before any actions.
- No direct `page.getByRole()` in the spec — locators live in page objects.
- Assertions target `pageObject.locator`, not `page.getByRole()`.

## Known Playwright gotchas (apply proactively, don't wait to hit them)
1. **Selector drift**: a locator that worked in one build may fail after a UI change. Always verify selectors against the live DOM before finalizing a script.
2. **Race conditions after navigation**: add a stable wait after page loads or route changes before acting on elements (`await page.waitForLoadState('networkidle')`, `await expect(locator).toBeVisible()`, etc.).
3. **Overly brittle selectors**: avoid relying on CSS class names or fragile text matches when semantic roles/labels are available.
4. **Timing on SPA transitions**: for React/Vue/Angular apps, wait for the target element or state update instead of hardcoded `setTimeout()`-style sleeps.
5. **Form fields with delayed updates**: if typing triggers async validation or upstream state changes, wait for the expected state before asserting.

## Process
1. Resolve the provided input to a story markdown and the target test-case(s) (use `resolveStoryPath` when a `story_id` or `story_path` is provided).
2. If the result is a story ID or story path, parse all `### TC-*` sections in the markdown and generate a scenario for each discovered case. This is the default for story-level input; do not auto-truncate to the first happy-path case.
3. Group steps by page/screen → one page object per screen.
4. Write one story-level Playwright spec containing one `test()` block per discovered story case, unless a single-case selector is explicitly supplied.
5. **PII gate — run immediately after writing/editing any Playwright spec file, before anything else**: if a new file contains user personal data, stop and report it rather than running tests.
6. Reuse the existing `pages/` and `tests/` organization; do not create a duplicate Playwright structure.
7. **Run `npx playwright test` for real** and fix failures using the actual error output — never declare done without executing it.
8. Treat this skill as script-generation only: do not create a final review package, approval artifact, or analyst-style signoff as part of the execution flow.
9. Log this run: `node .github/scripts/log-agent-action.js --skill generate-playwright-ui-script --status <success|failure|blocked> --summary "<N> scenarios scripted for <story key>, npx playwright test <passed|failed>, OR PII detected and write blocked" --jira-story-key <story key>` (omit `--jira-story-key` if the selector was not tied to a story).

## Checklist before finishing
- [ ] Imports `test` and `expect` from `fixtures/base.ts` (not `@playwright/test`)
- [ ] Every element interaction goes through a page object (no direct `page.getByRole()` in specs)
- [ ] Locator priority order followed for all locators
- [ ] No `page.waitForTimeout` or `waitForSelector` usage
- [ ] At least one meaningful assertion in the test
- [ ] Tag applied to the test title (e.g., `@smoke`, `@kan-6`)
- [ ] For a story ID or story path, every discovered `TC-*` case in the story has a corresponding scenario
- [ ] When a single-case selector is supplied, only that target case is scripted
- [ ] Every page object uses stable, verified selectors
- [ ] Page actions wait for the right UI state before interaction
- [ ] No duplicate Playwright spec files created for a page that already has one
- [ ] No final-review artifact, approval package, or analyst-style review output was created as part of this skill run
- [ ] `npx playwright test` run and passing (or remaining failures explained with real error output, not assumed)
- [ ] This run logged via `log-agent-action.js`

