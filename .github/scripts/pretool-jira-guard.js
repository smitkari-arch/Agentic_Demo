// Consolidated PreToolUse handler for Atlassian/Jira tool calls. Combines two concerns that
// would otherwise be separate parallel hooks on the same matcher:
//   1. Hard-deny a Jira "create issue" tool call (copilot-instructions.md governing rule: agents
//      must never create a Jira issue/story directly; story creation is human-only).
//   2. PII/secrets scan-and-redact on tool_input for all other Atlassian tool calls.
//
// Why one script instead of two: hooks from every configured location fire together for a
// matching event, with no documented precedence rule for one hook's "deny" vs another's "allow",
// and no guaranteed chaining of one hook's output into another's input. Merging both concerns
// into a single process removes that ambiguity regardless of the exact execution model — see
// .github/instructions/guardrails-policy.instructions.md.
//
// Registered via .github/hooks/jira-pretool-guard.json under hooks.PreToolUse, matched against
// this environment's Atlassian MCP tool names. This environment's tool prefix is
// mcp_atlassian-mcp_* (e.g. mcp_atlassian-mcp_createJiraIssue, mcp_atlassian-mcp_getJiraIssue) —
// verify the exact prefix empirically per environment, since MCP tool-name prefixing can vary.
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

// Verify empirically per environment — this prefix matches this environment's Atlassian MCP
// tool names (mcp_atlassian-mcp_*), not Claude Code's mcp__atlassian__* convention.
const JIRA_TOOL_PREFIX = /^mcp_atlassian-mcp_/;
const CREATE_JIRA_ISSUE_TOOL = 'mcp_atlassian-mcp_createJiraIssue';

function main() {
  const raw = readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write('{}');
    return;
  }

  if (payload.hook_event_name !== 'PreToolUse' || !JIRA_TOOL_PREFIX.test(payload.tool_name || '')) {
    process.stdout.write('{}');
    return;
  }

  if (payload.tool_name === CREATE_JIRA_ISSUE_TOOL) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            'Guardrail violation (copilot-instructions.md governing rules): agents must never create a Jira issue/story directly. Story creation is human-only — create/edit the story in Jira yourself, then give the agent the issue key or pasted text to work from.',
        },
      })
    );
    return;
  }

  process.stdout.write(JSON.stringify(processPayload(payload)));
}

main();
