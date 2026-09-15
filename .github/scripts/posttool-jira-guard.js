// Consolidated PostToolUse handler for Atlassian/Jira tool calls. Combines two concerns that
// would otherwise be separate parallel hooks on the same matcher:
//   1. PII/secrets scan-and-redact on tool_output (reporter/assignee emails, etc.) before it
//      enters model context.
//   2. Story-readiness gate for generate-test-scenarios' "Input required" guardrail: a Jira
//      issue fetched via a get/search Jira tool must have a description AND numbered acceptance
//      criteria, or the response is flagged with decision:block.
//
// Why one script instead of two: hooks from every configured location fire together for a
// matching event with no documented precedence/merge rule between one hook's tool-output rewrite
// and another's block decision, and no guaranteed chaining of one hook's output into another's
// input — see .github/instructions/guardrails-policy.instructions.md. Merging both into one
// process guarantees PII is always redacted (regardless of the readiness verdict) and the
// readiness block is always evaluated against the same payload, as a single deterministic JSON
// result.
//
// Registered via .github/hooks/jira-posttool-guard.json under hooks.PostToolUse, matched against
// this environment's Atlassian MCP tool names (mcp_atlassian-mcp_* in this environment — verify
// the exact prefix empirically per environment).
'use strict';

const fs = require('fs');
const { processPayload } = require('../pii-ocr/sanitize');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

function tryParseJSON(str) {
  const trimmed = str.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

// MCP tool_output commonly arrives wrapped as {content:[{type:"text", text:"<JSON string>"}]} —
// the real fields (including description) live inside that JSON-encoded string, not as a plain
// object property, so string values need a parse attempt before recursion can reach them.
function findDescription(node) {
  if (node && typeof node === 'object') {
    if (typeof node.description === 'string') return node.description;
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (typeof value === 'string') {
        const parsed = tryParseJSON(value);
        if (parsed) {
          const found = findDescription(parsed);
          if (found) return found;
        }
      } else {
        const found = findDescription(value);
        if (found) return found;
      }
    }
  }
  return null;
}

// Verify empirically per environment — this prefix matches this environment's Atlassian MCP
// tool names (mcp_atlassian-mcp_*), not Claude Code's mcp__atlassian__* convention.
const JIRA_TOOL_PREFIX = /^mcp_atlassian-mcp_/;

// Diagnostic trace, kept as a defensive fallback in case this environment's tool_output shape
// needs re-verification (Claude Code's payload shape was confirmed via a live-run trace; this
// environment's equivalent shape has not yet been empirically confirmed). Writes unconditionally,
// before any parsing that could throw, so a failure still leaves forensic evidence behind.
function writeDebugTrace(raw, extra) {
  try {
    const dir = 'audit/hook-debug';
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(
      `${dir}/${stamp}_posttool-jira-guard.json`,
      JSON.stringify({ raw, ...extra }, null, 2),
      'utf-8'
    );
  } catch (err) {
    // best-effort only
  }
}

function main() {
  const raw = readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    writeDebugTrace(raw, { parseError: String(err) });
    process.stdout.write('{}');
    return;
  }

  if (payload.hook_event_name !== 'PostToolUse' || !JIRA_TOOL_PREFIX.test(payload.tool_name || '')) {
    process.stdout.write('{}');
    return;
  }

  writeDebugTrace(undefined, {
    hook_event_name: payload.hook_event_name,
    tool_name: payload.tool_name,
    tool_output_type: typeof payload.tool_output,
    tool_output_preview: (typeof payload.tool_output === 'string' ? payload.tool_output : JSON.stringify(payload.tool_output)).slice(0, 4000),
  });

  const piiResult = processPayload(payload); // always redact PII, regardless of readiness verdict

  const isJiraFetch = /getJiraIssue|searchJiraIssuesUsingJql/.test(payload.tool_name || '');
  if (!isJiraFetch) {
    process.stdout.write(JSON.stringify(piiResult));
    return;
  }

  let outputObj;
  try {
    outputObj = typeof payload.tool_output === 'string' ? JSON.parse(payload.tool_output) : payload.tool_output;
  } catch {
    process.stdout.write(JSON.stringify(piiResult));
    return;
  }

  const description = findDescription(outputObj) || '';
  const hasAC = /acceptance criteria/i.test(description) && /\bAC\d/i.test(description);

  if (description.trim().length > 0 && hasAC) {
    process.stdout.write(JSON.stringify(piiResult));
    return;
  }

  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        "Guardrail violation (generate-test-scenarios SKILL.md, 'Input required'): this Jira issue is missing a description and/or numbered acceptance criteria (AC1, AC2, ...). Do not guess business rules or invent test cases from an incomplete story — stop and ask the user for the missing description/AC before generating test scenarios.",
      ...piiResult,
    })
  );
}

main();
