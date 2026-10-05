# Repository Guide: Purpose, Structure, Agentic Workflow, and Usage Instructions

## 1. Overview

This repository is a governed, AI-assisted Playwright automation project designed to support a structured testing workflow from story intake to execution, validation, and failure healing.

At a high level, it does three things:

- helps evaluate whether a Jira story is ready for test design
- turns a ready story into structured test cases and Playwright automation
- executes the tests and triages failures with explicit human review gates

The project is intentionally not a generic app repo. It is a testing and automation framework around a controlled workflow built for:
- Playwright UI tests
- AI agent roles and skills
- governance and safety rules
- audit, reporting, and knowledge retention

The repo is centered around [playwrightTests](playwrightTests) and the governance layer under [.github](.github). The actual test project and its supporting docs and prompts are separated so the workflow remains auditable and safe.

---

## 2. What problem this repo solves

This repo addresses a common issue in QA automation: moving from a user story to reliable automation without losing traceability or making unsafe assumptions.

It helps teams do the following:

- evaluate a Jira story before writing tests
- generate business-level test scenarios from acceptance criteria
- convert those scenarios into Playwright specs
- verify the scripts against the live DOM and run them for real
- handle failures with a documented triage process
- keep reports, logs, and audit artifacts for human review

The repo also includes guardrails for:
- not targeting production systems without explicit confirmation
- not hardcoding credentials or real secrets
- not writing directly to Jira or memory without a human trigger
- not silently weakening assertions to force green tests

---

## 3. Repository map

| Area | Purpose |
|---|---|
| [.github](.github) | Governance, prompts, skills, agents, policies, scripts, and workflow metadata |
| [.github/agents](.github/agents) | Agent role definitions and responsibilities |
| [.github/prompts](.github/prompts) | One-off prompt entry points that invoke specific agents |
| [.github/skills](.github/skills) | Canonical reusable logic for readiness, test generation, scripting, and failure analysis |
| [.github/instructions](.github/instructions) | Rules, execution model, security model, Jira access instructions |
| [.github/hooks](.github/hooks) | Hook-based checks for prompt scanning, Jira access, and RTK output reduction |
| [.github/pii-ocr](.github/pii-ocr) | PII/redaction logic and OCR-related sanitization rules |
| [.github/memory](.github/memory) | Approved project knowledge and decision history |
| [.github/workflows](.github/workflows) | CI workflow for Playwright runs |
| [playwrightTests](playwrightTests) | Actual Playwright test project: config, pages, tests, fixtures, reports |
| [playwrightTests/specs](playwrightTests/specs) | Business-level design artifacts for stories |
| [audit](audit) | Execution and audit logs |
| [artifacts](artifacts) | Generated artifacts and supporting outputs |
| [reports](reports) | KPI and summary reports |
| [test-results](test-results) | Local test-run outputs |
| [rtk](rtk) | Rust token-reduction project used to trim terminal output |
| [.vscode](.vscode) | VS Code / MCP local configuration |
| [reports](reports) | Aggregated reporting output |

---

## 4. Folder-by-folder explanation

### 4.1 .github

This is the governance and orchestration center of the repository. It contains:
- agent definitions
- prompts
- skills
- instructions
- hooks
- scripts
- known workflows

This is where the repo defines how the testing workflow should operate and what must be reviewed by a human.

---

### 4.2 .github/agents

The agent files define the specialist roles used in the repo.

Current role files include:
- [planner-agent.agent.md](.github/agents/planner-agent.agent.md)
- [designer-agent.agent.md](.github/agents/designer-agent.agent.md)
- [scripter-agent.agent.md](.github/agents/scripter-agent.agent.md)
- [healer-agent.agent.md](.github/agents/healer-agent.agent.md)

These are not generic “chat assistants”; they are purpose-built roles aligned with the workflow:
- Planner: assess story readiness
- Designer: turn ready stories into structured test cases
- Scripter: generate Playwright specs and run tests
- Healer: diagnose failed runs and propose safe fixes

Each agent file points to the canonical skill that defines the real behavior.

---

### 4.3 .github/prompts

The prompt files are the direct entry points that invoke a specific agent.

Examples:
- [planner-agent.prompt.md](.github/prompts/planner-agent.prompt.md)
- [designer-agent.prompt.md](.github/prompts/designer-agent.prompt.md)
- [scripter-agent.prompt.md](.github/prompts/scripter-agent.prompt.md)
- [healer-agent.prompt.md](.github/prompts/healer-agent.prompt.md)

These prompts are short wrappers that:
- validate the input
- invoke the relevant agent
- enforce guardrails
- log tool usage when required

Think of prompts as a user-facing “launcher” for the workflow.

---

### 4.4 .github/skills

This is the real implementation layer for each major workflow step.

Relevant skills:
- [jira-story-readiness](.github/skills/jira-story-readiness)
- [generate-test-scenarios](.github/skills/generate-test-scenarios)
- [generate-playwright-ui-script](.github/skills/generate-playwright-ui-script)
- [analyze-playwright-failure](.github/skills/analyze-playwright-failure)

These skills define:
- what counts as a valid input
- the expected process
- guardrails
- output format
- verification requirements

This folder is the repo’s “method”: the canonical playbook for each task.

---

### 4.5 .github/instructions

This directory contains project policy and workflow documentation.

Important files:
- [execution-model.instructions.md](.github/instructions/execution-model.instructions.md)
- [guardrails-policy.instructions.md](.github/instructions/guardrails-policy.instructions.md)
- [jira-access.instructions.md](.github/instructions/jira-access.instructions.md)
- [agent-usage-logging.instructions.md](.github/instructions/agent-usage-logging.instructions.md)

These explain:
- how agents work together
- which tasks require human approval
- what actions are allowed or prohibited
- how Access, QA ownership, and implementation are divided
- how Jira access must be handled safely
- how agent actions are logged for auditability

This is the governance backbone.

---

### 4.6 .github/hooks

This area contains automation hooks to guard the environment.

Examples:
- [user-prompt-pii-scan.json](.github/hooks/user-prompt-pii-scan.json)
- [jira-pretool-guard.json](.github/hooks/jira-pretool-guard.json)
- [jira-posttool-guard.json](.github/hooks/jira-posttool-guard.json)
- [rtk-truncate.json](.github/hooks/rtk-truncate.json)

These do things like:
- scan submitted prompts for PII or secret-like values
- guard Jira-related tool access
- reduce noisy terminal output to fit within model token budgets

This layer exists to enforce safe and efficient operating behavior.

---

### 4.7 .github/pii-ocr

This folder is about PII detection and sanitization.

It includes logic and documentation for:
- regex-based scanning for emails, phone numbers, secrets, tokens, and IDs
- redaction behavior
- OCR-driven image inspection when required in the Jira workflow
- audit logs for redaction decisions

This matters because the repo takes data protection seriously. It does not want real credentials or private data leaking into prompts, logs, or test artifacts.

---

### 4.8 .github/memory

This is the repo’s shared knowledge layer, distinct from a user’s personal Copilot memory.

Per the repo docs, it is intended for:
- approved static context
- decision logs
- project knowledge
- execution history
- failure learning

This is a shared, governed record of project decisions and context, not a runtime cache.

---

### 4.9 reports

The repository maintains a dedicated reporting layer that turns raw execution and audit logs into decision-ready summaries for QA and workflow review.

The main outputs are:

- [reports/kpi-report.csv](reports/kpi-report.csv)  
  Stores a time-ordered log of each real Playwright run. Each row includes the run timestamp, total test count, passed/failed/skipped values, duration, and the source JSON path. This is the raw KPI history used to track automation health over time.

- [reports/test-execution-report.html](reports/test-execution-report.html)  
  Builds a human-readable dashboard from the KPI CSV. It shows total runs, pass/fail summaries, average duration, recent trend, and execution history for quick QA review.

- [reports/agent-quality-report.csv](reports/agent-quality-report.csv)  
  Aggregates the agent-scoring evidence produced after each agent run. It captures outcome score, confidence score, confidence band, missing metrics, and recommendations for each skill run.

- [reports/agent-quality-trends.csv](reports/agent-quality-trends.csv)  
  Summarizes agent quality over time by date, skill, and actor. It helps reviewers see whether the planner, designer, scripter, and healer are improving or declining in reliability.

- [reports/agent-execution-report.csv](reports/agent-execution-report.csv)  
  Records the workflow timeline of agent activity, including start/end status, Jira story key, workflow stage, and summary message for each task. This report explains what the agents actually did, not just how well they scored.

Together, these reports give the repository three layers of evidence:
- execution health of the Playwright suite
- quality of the AI-generated work
- audit trail of the workflow itself

This makes it possible to review automation status, agent performance, and governance compliance without digging through raw logs manually.

---

### 4.10 .github/workflows

This repo contains a GitHub Actions workflow for running Playwright tests automatically.

The main file is:
- [playwright.yml](.github/workflows/playwright.yml)

It does:
This gives humans a reviewable chain of evidence.

### Agent scoring and quality metrics (detailed)

This repository includes a deterministic agent-scoring pipeline that converts logged agent actions into per-run evidence, validates schema, and aggregates CSV reports for human review.

- Primary scripts (located in `.github/scripts`):
   - `generate-agent-quality-evidence.js` — reads `audit/agent-actions/*.json`, inspects linked artifacts, and emits deterministic per-run evidence JSON to `audit/agent-quality/*.score.json`.
   - `validate-agent-quality-evidence.js` — enforces the evidence schema and required metric keys per-skill.
   - `generate-agent-quality-report.js` — aggregates evidence files into `reports/agent-quality-report.csv` and `reports/agent-quality-trends.csv`.
   - `generate-agent-execution-report.js` — writes `reports/agent-execution-report.csv` from raw action logs.
   - `refresh-agent-scoring.js` — convenience wrapper to run evidence generation, validation, and report production in order.
   - `log-agent-action.js` — helper used by prompts/agents to write `agent_task_completed`/`agent_task_failed` events to `audit/agent-actions/` and optionally trigger refresh.

- Evidence files:
   - Location: `audit/agent-quality/`
   - Naming: `<ISOstamp>_<skill>_<eventId>.score.json`
   - Each file contains: `score_event_version`, `metric_version`, `source_event` (metadata), `metrics` (per-metric values and weights), `outcome_score`, `confidence_factors`, and `confidence_band`.

- Evidence schema highlights (what `validate-agent-quality-evidence.js` checks):
   - Top-level required fields: `score_event_version`, `metric_version`, `metrics`, `confidence_factors`, `confidence_band`.
   - `source_event` must include: `event_id`, `correlation_id`, `event_timestamp`, `skill`, `actor_name`, `actor_id`.
   - Skill-specific required metric keys (examples):
      - `jira-story-readiness`: `acceptance_criteria_extraction_coverage`, `requirement_testability_coverage`, `story_clarity_coverage`.
      - `generate-test-scenarios`: `requirement_coverage`, `acceptance_criteria_coverage`, `scenario_type_coverage`, `test_case_quality_score`, `uniqueness_score`.
      - `generate-playwright-ui-script`: `script_generation_success_rate`, `syntax_pass_rate`, `framework_compliance_score`, `assertion_quality_score`, `reusability_score`.
      - `analyze-playwright-failure`: `failure_reproduction_rate`, `healing_success_rate`, `regression_safety_score`, `false_healing_rate`.
   - Valid `reason_code` values for null metrics: `EXTERNAL_REVIEW_UNAVAILABLE`, `HISTORICAL_BASELINE_UNAVAILABLE`, `ARTIFACT_NOT_FOUND`, `NOT_APPLICABLE`.

### Human-readable scoring enhancement

The scoring pipeline keeps the original deterministic evidence model, but also adds a user-facing summary layer so reviewers do not need to inspect raw JSON to understand the result.

Relevant implementation points:
- `.github/scripts/generate-agent-quality-evidence.js` adds the readable narrative and metric explanations used to interpret a score.
- `.github/scripts/log-agent-action.js` adds a concise human summary to each logged agent event and includes the next-step recommendation.
- `.github/scripts/generate-agent-quality-report.js` exposes the human-readable summary fields in the aggregated CSV output.
- `.github/scripts/tests/agent-quality-scripts.test.js` validates the summary metadata and report output.

The generated score evidence now includes the following fields in addition to the numeric metrics:
- `summary_line` — a short explanation designed for chat and quick review.
- `detail_summary` — a fuller narrative describing evidence strength or missing data.
- `recommendation` — suggested next action for the user.
- `primary_reason_code` — the dominant reason why the score was limited or incomplete.
- `missing_metric_list` — the metrics that were unavailable or incomplete.
- `metric_explanations` — plain-language descriptions for each metric and why it mattered.

The human summary uses score bands that are easier to interpret than raw numbers alone:
- Strong result
- Good overall result
- Partial result
- Insufficient evidence

This improves trust, readability, and actionability without replacing the underlying audit trail. Reviewers can quickly tell whether the score is strong, partially supported, or not reliable enough for a final decision.

### Metric models and evidence sources

- Metric definitions live in `generate-agent-quality-evidence.js` under `OUTCOME_MODELS`. For each supported skill the model declares metric keys, labels, and weights.
- Evidence sources used by the scoring pipeline include:
   - Story spec markdown under `playwrightTests/specs/` (parsed for TC count, AC references, scenario types, and quality heuristics).
   - Playwright test files under `playwrightTests/tests/` (scanned for `expect(...)`, Web-first matchers, `page.` locators, forbidden waits, and page-object imports).
   - Machine-readable Playwright report: `playwrightTests/playwright-report/results.json` (used for `syntax_pass_rate` and validation metrics).
   - Linked artifacts referenced in `audit/agent-actions` event `additional_details.score_artifacts` fields: `story_spec_path`, `playwright_spec_path`, `failure_report_path`.

- The evidence generator computes per-metric values (or emits null with a reason code), combines them with their configured weights to an `outcome_score`, and computes `confidence_factors` (evidence completeness, validation pass rate, historical accuracy). A `confidence_band` string is derived from the confidence score.

### CSV reports and interpretation

- `reports/agent-quality-report.csv` columns include: `Timestamp, EventId, CorrelationId, Skill, ActorName, ActorId, JiraStoryKey, Status, OutcomeScore, ConfidenceScore, ConfidenceBand, MissingMetricWeight, EvidenceCompleteness, ValidationPassRate, HistoricalAccuracy`.
- `reports/agent-quality-trends.csv` groups runs by date/skill/actor and shows run counts, average outcome and confidence scores, and counts for confidence-band buckets.
- `reports/agent-execution-report.csv` is a human-friendly summary including status, workflow stage, summary message, and event metadata without the usage or score columns.

### CI integration and local usage

- The Playwright CI workflow (`.github/workflows/playwright.yml`) runs score evidence generation and validation as post-run steps:
   - `generate-agent-quality-evidence.js` → `validate-agent-quality-evidence.js` → `generate-agent-quality-report.js`.
- Run the full refresh locally from the repository root:

```bash
node .github/scripts/refresh-agent-scoring.js --standalone
```

- Run steps individually:

```bash
node .github/scripts/generate-agent-quality-evidence.js
node .github/scripts/validate-agent-quality-evidence.js
node .github/scripts/generate-agent-quality-report.js
node .github/scripts/generate-agent-execution-report.js --standalone
```

### Logging and auto-refresh

- Use `log-agent-action.js` for structured agent event writes to `audit/agent-actions/`. Events can include `additional_details.score_artifacts` with artifact paths to help scoring.
- The log helper can trigger `refresh-agent-scoring.js` automatically; pass `--skip-refresh` to avoid automatic refresh when desired.

### Troubleshooting notes

- If validation reports missing metrics, confirm the matching `audit/agent-actions/*.json` includes the expected `score_artifacts` paths or run the relevant agent to generate artifacts.
- If `playwright-report/results.json` is absent, run `npx playwright test` under `playwrightTests` to produce the machine-readable report used in several metrics.

---
- checks out code
- installs Node dependencies
- installs Playwright browsers
- runs Playwright tests
- uploads the HTML report as an artifact

This is the CI entry point for automated execution.

---

### 4.10 playwrightTests

This is the actual Playwright project.

Key files:
- [package.json](playwrightTests/package.json)
- [playwright.config.ts](playwrightTests/playwright.config.ts)
- [fixtures](playwrightTests/fixtures)
- [pages](playwrightTests/pages)
- [tests](playwrightTests/tests)
- [specs](playwrightTests/specs)
- [playwright-report](playwrightTests/playwright-report)
- [test-results](playwrightTests/test-results)

This folder is the core execution path. It contains the real test framework logic.

#### playwrightTests/config
The configuration defines:
- test directory
- browser settings
- base URL
- reporter
- headless settings
- browser stack

The base URL in this repo is the demo site:
- https://demowebshop.tricentis.com

This is a public demo app and is appropriate for test automation under the repo’s rules.

#### playwrightTests/pages
This folder contains Page Object Model classes that encapsulate UI interactions.

Examples:
- [HomePage.ts](playwrightTests/pages/HomePage.ts)
- [RegisterPage.ts](playwrightTests/pages/RegisterPage.ts)
- [BasePage.ts](playwrightTests/pages/BasePage.ts)

These reduce duplication and make test cases easier to maintain.

#### playwrightTests/tests
This is where actual test files live.

The repository includes:
- [kan-6-registration-navigation.spec.ts](playwrightTests/tests/kan-6-registration-navigation.spec.ts)
- [seed.spec.ts](playwrightTests/tests/seed.spec.ts)

These are the concrete Playwright specs.

#### playwrightTests/specs
This folder holds business-level design artifacts created from Jira stories or acceptance criteria.

Example:
- [KAN-6](playwrightTests/specs/KAN-6)

The repository is designed to:
- generate story-based specs here
- turn them into Playwright scripts
- validate them through execution

This is where business intent and automation begin to meet.

---

### 4.11 audit and artifacts

These folders store project execution evidence.

- [audit](audit)
- [artifacts](artifacts)

They are used to preserve:
- logs
- PII scan results
- agent action history
- generated outputs
- evidence for human review

This supports traceability and compliance.

---

### 4.12 reports

This folder holds KPI and summary outputs.

Examples:
- [reports/kpi-report.csv](reports/kpi-report.csv)
- [reports/agent-execution-report.csv](reports/agent-execution-report.csv)

This is where aggregate execution and reporting data are saved for review.

---

### 4.13 test-results

This folder contains local execution output produced by Playwright:
- HTML results
- traces
- screenshots when relevant
- logs

It is meant for debugging and verifying test runs.

---

### 4.14 rtk

The [rtk](rtk) folder is a Rust project called RTK, or “Rust Token Killer.”

Its purpose is to trim noisy terminal output before it reaches the model context, reducing token usage during CLI-heavy sessions.

Key files:
- [rtk/README.md](rtk/README.md)
- [rtk/src/lib.rs](rtk/src/lib.rs)
- [rtk/src/main.rs](rtk/src/main.rs)
- [rtk/config.toml](rtk/config.toml)

This project is not the app under test. It is an optimization and governance utility.

---

### 4.15 .vscode

This folder contains editor and MCP configuration:
- [.vscode/mcp.json](.vscode/mcp.json)

It configures local tooling such as the Playwright MCP server. This is part of the operational environment, not the business logic of the tests.

---

## 5. Key scripts and their purpose

The repo contains scripts under [.github/scripts](.github/scripts). These are essential for the workflow.

### jira-read.js
This is the canonical Jira read helper.

It:
- reads issue or search data via Jira REST API
- requires environment variables for Jira credentials
- redacts sensitive data before output
- avoids direct Atlassian MCP usage

This script is important because the repo requires read-only Jira access and explicitly avoids creating issues via agent actions.

### log-agent-action.js
Tracks agent usage and action logging.

### generate-kpi-report.js
Creates KPI files summarizing test execution trends.

### generate-agent-execution-report.js
Aggregates agent execution metadata into an execution summary.

### pre-prompt-pii-scan.js
Scans user input before prompts are submitted to detect sensitive or secret patterns.

### scan-feature-for-pii.js
Checks generated feature/test artifact files for PII patterns before they are committed.

### post-tool-rtk.truncate.js
Runs the RTK reduction logic for terminal output.

### pretool-jira-guard.js and posttool-jira-guard.js
Provide guardrails around Jira tool usage and sensitive output.

---

## 6. Agentic workflow in this repo

The repo follows a structured AI workflow:

### Step 1: Story readiness review
A Jira story is reviewed to determine whether it is ready for test design.

This is handled by:
- Planner Agent
- Jira story readiness skill

If the story lacks clarity or acceptance criteria, it is marked Not Ready.

### Step 2: Business test case generation
A ready story is turned into positive, negative, and boundary test cases.

This is handled by:
- Designer Agent
- generate-test-scenarios skill

The output is a markdown test-case artifact saved under [playwrightTests/specs](playwrightTests/specs).

### Step 3: Script generation
A resolved story or test case becomes a working Playwright spec.

This is handled by:
- Scripter Agent
- generate-playwright-ui-script skill

The agent writes or updates tests under [playwrightTests](playwrightTests), reuses page objects where possible, and verifies selectors against the DOM.

### Step 4: Real test execution
The repo requires a real execution with Playwright.

Command:
- `cd playwrightTests`
- `npx playwright test`

This is mandatory before claiming success.

### Step 5: Failure triage
When tests fail, the Healer Agent follows the failure-analysis workflow.

It classifies issues as:
- flaky tests
- script bug
- stale data
- selector drift
- likely app regression

The key rule is: do not silently patch unsafe issues or weaken assertions to force green.

### Step 6: Reporting and audit trail
The project records:
- KPI summaries
- agent action logs
- test outputs
- audit results

This gives humans a reviewable chain of evidence.

---

## 7. Human ownership and workflow gates

The project separates agent work from human accountability.

The binding workflow is defined by:

- [.github/instructions/execution-model.instructions.md](.github/instructions/execution-model.instructions.md)
- [.github/instructions/guardrails-policy.instructions.md](.github/instructions/guardrails-policy.instructions.md)

Key rule:
- external writes (Jira, memory, repo changes) are human-triggered
- local test code under [playwrightTests](playwrightTests) is acceptable as a direct agent action under normal review
- human signoff remains required for repo actions, defects, and final artifact approval

---

## 8. Guardrails and safety rules

This repo is intentionally constrained.

### Must not do
- target production or transactional systems without explicit confirmation
- hardcode real credentials or secrets
- create Jira issues directly
- update memory autonomously
- silently weaken assertions
- mark a test run as passed without a real Playwright execution

### Must do
- validate selectors against the live DOM
- run real tests before claiming pass
- use environment variables for secrets
- use demo/test URLs only unless human approval says otherwise
- keep evidence in reports and logs

---

## 9. Prerequisites

Before using this repository, make sure you have:

- Node.js and npm installed
- Playwright dependency installed for the test project
- Chrome or supported browser available for the configured Playwright project
- Project dependencies installed via:
  - `cd playwrightTests`
  - `npm ci`
- Browser installation via:
  - `npx playwright install --with-deps`
- Jira credentials configured in your environment before attempting any Jira-backed workflow

Required for Jira access:
- `JIRA_BASE_URL` (for example, `https://your-company.atlassian.net`)
- `JIRA_EMAIL` (your Atlassian account email)
- `JIRA_API_TOKEN` (API token created in Atlassian)

Example local setup:

```bash
export JIRA_BASE_URL="https://your-company.atlassian.net"
export JIRA_EMAIL="you@company.com"
export JIRA_API_TOKEN="your_api_token_here"
```

Important:
- do not store real credentials in repo files
- always use environment variables or securely managed local settings
- if any Jira variable is missing, the repo should stop rather than guessing or hardcoding values
- Jira-backed steps such as story readiness review require these values before they can fetch issue data

---

## 10. Step-by-step usage instructions

### 10.1 Run Playwright tests

From the repo root:

```bash
cd playwrightTests
npm ci
npx playwright install --with-deps
npx playwright test
```

To open the generated HTML report:

```bash
npx playwright show-report
```

This repository is configured to use the public demo site and a local test setup, so the default flow is safe for validation.

---

### 10.2 Use the Planner Agent

Goal:
- determine whether a Jira story is ready for automation design

Prompt pattern:
- provide a Jira issue key

Example:
- `KAN-6`

This runs the story-readiness flow and should return:
- readiness verdict
- gap list
- reasons the story is not ready if applicable

The workflow follows the readiness skill and must not guess missing acceptance criteria.

---

### 10.3 Use the Designer Agent

Goal:
- create a test-case design artifact from a ready Jira story

Typical input:
- story key

This writes a markdown file under [playwrightTests/specs](playwrightTests/specs) and returns a summary of the generated scenarios.

Expected output:
- positive scenarios
- negative scenarios
- boundary cases
- business-level coverage only

---

### 10.4 Use the Scripter Agent

Goal:
- convert a story-scoped test case into working Playwright automation

Typical input:
- story ID
- story path
- or story key + case id

Example:
- `KAN-6`
- `playwrightTests/specs/KAN-6/<file>.md`
- `KAN-6:TC-01`

The agent:
- resolves the target case
- writes the Playwright spec under [playwrightTests](playwrightTests)
- verifies selectors against the actual DOM
- runs `npx playwright test`
- reports the real outcome

This is the core implementation step.

---

### 10.5 Use the Healer Agent

Goal:
- triage and fix failing Playwright runs

Input:
- actual failing output or report path

The Healer Agent must:
- identify whether the failure is flaky, deterministic, stale, selector drift, or likely regression
- fix only within safe, bounded rules
- verify the fix with a real rerun

This step is intentionally strict. It does not “force” green by relaxing assertions.

---

## 11. Common workflow examples

### Example A: Story readiness
1. Human provides Jira story key
2. Planner Agent checks readiness
3. If Not Ready, fix story gaps
4. Once Ready, move to test design

### Example B: Scenario creation
1. Story is ready
2. Designer Agent generates test-case artifact
3. Human reviews artifact
4. Scripter Agent creates Playwright specs

### Example C: Script execution
1. Script is written
2. `npx playwright test` runs
3. If pass, archive and report
4. If fail, invoke Healer Agent

### Example D: Failure fix
1. Capture failing output
2. Healer Agent classifies failure
3. Safe fix is applied
4. Rerun test to confirm pass
5. Human validates final outcome

---

## 12. Output expectations

Each phase has a different expected artifact:

| Phase | Expected output |
|---|---|
| Story readiness | ready/not ready verdict + gap list |
| Test design | markdown scenario/spec under [playwrightTests/specs](playwrightTests/specs) |
| Script generation | Playwright spec under [playwrightTests](playwrightTests) |
| Execution | real test result with pass/fail outcome |
| Failure healing | fix and verification evidence or human-review recommendation |
| Reporting | KPI/report files in [reports](reports) and [audit](audit) |

---

## 13. Quick start checklist

Use this as a minimal starter flow:

1. Install dependencies:
   - `cd playwrightTests`
   - `npm ci`
   - `npx playwright install --with-deps`

2. Validate whether the target story is ready:
   - use the Planner Agent or readiness skill

3. Create test scenarios:
   - use the Designer Agent

4. Create Playwright automation:
   - use the Scripter Agent

5. Run tests:
   - `npx playwright test`

6. If failed:
   - use the Healer Agent

7. Review generated outputs:
   - [playwrightTests/specs](playwrightTests/specs)
   - [playwrightTests/tests](playwrightTests/tests)
   - [reports](reports)
   - [audit](audit)

8. Do not commit or update external systems without human approval.

---

## 14. Troubleshooting / FAQ

### Why are there agent, skill, and prompt folders?
Because the repo separates:
- the role definition
- the canonical logic
- the user entry point

This makes the workflow easier to reason about and safer to govern.

### Why is there a no-direct-write rule?
Because the system is meant to be human-reviewed. It ensures external systems are not changed by automation without explicit consent.

### Why is there a PII scanning layer?
Because the repo handles Jira data and automation execution and must avoid leaking secrets, emails, tokens, or identifiable data into logs or prompts.

### What if a test fails?
Use the Healer Agent and validate with a real rerun. Do not hide the failure or relax assertions without justification.

### Can I run tests against a production environment?
No, not without explicit human confirmation. The repo explicitly forbids it unless the target environment is confirmed safe.

### Why is RTK in the repo?
Because CLI-heavy sessions can generate large terminal output. RTK reduces noise while preserving essential fail/error signals.

---

## 15. Final summary

This repository is a structured automation and governance framework for AI-assisted Playwright testing.

Its key idea is simple:

- humans define the story and approve outcomes
- agents handle the design, script generation, execution, and failure triage
- policies and hooks protect data, enforce safety, and keep evidence

The project is strongest when used as a disciplined workflow:
- ready story
- scenario generation
- automation
- real run
- failure analysis
- human review
- reportable evidence

This is not just a Playwright test project; it is a controlled agent-driven QA workflow with built-in traceability, safety, and review checkpoints.
