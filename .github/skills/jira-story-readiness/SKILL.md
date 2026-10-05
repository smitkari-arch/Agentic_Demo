---
name: jira-story-readiness
description: Score a Jira story's readiness for test design — completeness, consistency, and whether acceptance criteria are concrete enough to generate test cases from. Does NOT write test cases itself — output is a readiness verdict + gap list. Use when asked to "check if this story is ready", "review story readiness", or as the first step before "plan tests"/"generate test scenarios" for a story that hasn't been checked yet.
argument-hint: '[Jira story key or pasted story text]'
---

# Jira Story Readiness

Upstream gate for [generate-test-scenarios](../generate-test-scenarios/SKILL.md), per the Planner Agent role in [.github/agents/planner-agent.agent.md](../../agents/planner-agent.agent.md) and the repo execution model in [.github/instructions/execution-model.instructions.md](../../instructions/execution-model.instructions.md).

## Access & tool scope
- **Invoke by:** anyone about to design test coverage from a story — read-only against the repo and Jira, lowest-risk skill here.
- **Tools this skill relies on:** read, search (file/text search), and execute (for running `jira-read.js` and, when an image attachment needs downloading, `curl`) — see [.github/instructions/jira-access.instructions.md](../../instructions/jira-access.instructions.md). No file-edit access, and no Atlassian MCP tool — this skill never creates files, runs other commands, or calls an MCP Jira tool.

## Input required
- Story key (fetch via `jira-read.js`, per [.github/instructions/jira-access.instructions.md](../../instructions/jira-access.instructions.md)) or pasted story text.

## Process
1. Fetch/read the story's description and acceptance criteria. If given a story key, fetch it via `node .github/scripts/jira-read.js issue <key> summary,description,attachment` — never an Atlassian MCP tool, and never raw `curl` for this text fetch (see [instructions/jira-access.instructions.md](../../instructions/jira-access.instructions.md) for why `jira-read.js` is the canonical path: it redacts PII in-process, before printing, so it doesn't depend on a `PostToolUse`-style hook firing the way raw `curl` did). Include `attachment` in the fields list so any image attachments are visible for step 1a below — the default/full field set is still never used, since it also includes `reporter`/`assignee` and would carry real email addresses into model context. Only widen the field list beyond `summary,description,attachment` if something else is actually needed. `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` must come from environment variables — the script itself throws if any is unset; don't guess a value to work around that.

1a. **If the fetched `attachment` array contains any image (`mimeType` starting `image/`):** for each one, download it with raw `curl` (`jira-read.js` doesn't handle binary content — this is the one legitimate remaining use of raw `curl` in this skill, `-o <file>` required since binary can't print to stdout — see [instructions/jira-access.instructions.md](../../instructions/jira-access.instructions.md#exception-downloading-a-binary-attachment-eg-an-image-does-require--o-file)). Then:
   - Read the downloaded image yourself and transcribe any visible text as accurately as you can. **This is you reading the image, not a deterministic OCR library** — there is no OCR engine wired into this skill, so treat your own transcription as best-effort, not guaranteed-accurate, and say so when reporting findings.
   - Pipe your transcription into `node .github/scripts/scan-ocr-text-for-pii.js --story-key <key> --source-image "<filename>"` via stdin. It reuses the same deterministic scanner used elsewhere in this repo, writes a redaction-map audit entry to `audit/pii-scan-results/` (tagged `SkillStep_ImageOCR`, never a real hook event name), and prints `{hasPII, matchCounts}` back to you — report that summary (never the raw values) alongside the readiness verdict.
   - This step only runs when an image attachment is actually present. No attachment, no extra work — don't fetch attachment content speculatively.

2. Check for:
   - **Completeness** — is there a description AND acceptance criteria? Are all ACs stated as testable Given/When/Then (or equivalent) conditions, not vague goals?
   - **Consistency** — do the ACs contradict each other or the description? Is test data (URLs, credentials, sample values) present where the story implies it's needed?
   - **Testability** — can each AC be turned into at least one concrete positive test case without guessing a business rule?
3. Produce a verdict: **Ready** (safe to hand to `generate-test-scenarios`) or **Not Ready** (list the specific gaps, one per issue, referencing the AC number where applicable).
4. Log this run: `node .github/scripts/log-agent-action.js --skill jira-story-readiness --status success --summary "Verdict: <Ready|Not Ready> for <story key or ref>" --jira-story-key <story key>` (use `--status blocked` instead if the story key/text couldn't be read at all; omit `--jira-story-key` if only pasted text with no key was given).

## Output format
A short readiness report:
- **Verdict:** Ready / Not Ready
- **Gaps** (if any): one bullet per issue, each naming the AC or section it affects
- **Notes:** anything ambiguous worth flagging even if it didn't block readiness (e.g. an AC that's testable but underspecified on boundaries)
- **Attachment findings** (only if step 1a ran): which image(s) were checked, and the `{hasPII, matchCounts}` summary from `scan-ocr-text-for-pii.js` — explicitly note this came from your own vision-based transcription, not a deterministic scan, so it's best-effort

## Guardrails (Non-Negotiable)
- Never call an Atlassian/Jira MCP tool — Jira access is via `jira-read.js` (text) and, only for binary attachments, raw `curl`, per [.github/instructions/jira-access.instructions.md](../../instructions/jira-access.instructions.md). Never hardcode `JIRA_BASE_URL`, `JIRA_EMAIL`, or `JIRA_API_TOKEN` — read them from environment variables, and stop rather than guess if any is unset.
- Never invent or assume a missing business rule, acceptance criterion, or data constraint to make a story "pass" readiness — an incomplete story is Not Ready, full stop.
- Never write test cases here — that's [generate-test-scenarios](../generate-test-scenarios/SKILL.md)'s job. This skill only scores and reports.
- Never silently skip an AC when scoring — every AC gets assessed for testability individually.

## Checklist before finishing
- [ ] Every AC individually assessed for testability
- [ ] Verdict is unambiguous (Ready or Not Ready, not "mostly ready")
- [ ] Every gap is specific and actionable, not vague ("AC3 doesn't state a max length" not "AC3 is unclear")
- [ ] This run logged via `log-agent-action.js`
