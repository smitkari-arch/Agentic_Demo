// PreToolUse / PostToolUse hook entrypoint.
//
// Implements the "Log + redact only" mode: this script NEVER blocks a tool call. It scans the
// tool's input (PreToolUse) or output (PostToolUse) for PII/secrets using pii-scanner.js, and if
// anything matches, rewrites the payload with placeholders before it reaches the tool / the
// model's context. The original values are written to a redaction map under
// audit/pii-scan-results/ for authorized human lookup only — never echoed back to the model.
//
// Registered via .github/hooks/jira-pretool-guard.json and .github/hooks/jira-posttool-guard.json
// under hooks.PreToolUse / hooks.PostToolUse. See .github/instructions/guardrails-policy.instructions.md
// for the governance this protects, and .github/instructions/jira-access.instructions.md for the
// broader Jira-access pattern.
'use strict';

const fs = require('fs');
const path = require('path');
const { scanText, redactText } = require('./pii-scanner');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

function writeAuditLog(cwd, entry) {
  try {
    const dir = path.join(cwd, 'audit', 'pii-scan-results');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `${stamp}_${entry.hook_event_name}_${entry.tool_name || 'unknown'}.json`);
    fs.writeFileSync(file, JSON.stringify(entry, null, 2), 'utf-8');
  } catch (err) {
    // Fail open: audit logging must never break the tool pipeline.
    process.stderr.write(`sanitize.js: failed to write audit log: ${err.message}\n`);
  }
}

// Scans+redacts PII/secrets for a single parsed hook payload and returns the hookSpecificOutput
// object to emit. Exported so other hooks that must combine PII redaction with additional
// decisions in one process can call this directly, instead of running as a separate parallel
// hook — hooks from every configured location fire together for a matching event, with no
// documented precedence or chaining guaranteed between their outputs, so merging concerns that
// must agree into a single process avoids relying on unconfirmed ordering behavior.
function processPayload(payload) {
  const cwd = payload.cwd || process.cwd();
  const hookEvent = payload.hook_event_name; // "PreToolUse" | "PostToolUse"
  const toolName = payload.tool_name;

  const targetText =
    hookEvent === 'PreToolUse'
      ? JSON.stringify(payload.tool_input ?? {}, null, 2)
      : typeof payload.tool_output === 'string'
      ? payload.tool_output
      : JSON.stringify(payload.tool_output ?? {}, null, 2);

  const { hasPII, matches } = scanText(targetText);

  if (!hasPII) {
    return hookEvent === 'PreToolUse'
      ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } }
      : { hookSpecificOutput: { hookEventName: 'PostToolUse' } };
  }

  const { redactedText, redactionMap } = redactText(targetText, matches);

  writeAuditLog(cwd, {
    timestamp: new Date().toISOString(),
    session_id: payload.session_id,
    hook_event_name: hookEvent,
    tool_name: toolName,
    matchCounts: matches.reduce((acc, m) => ((acc[m.type] = (acc[m.type] || 0) + 1), acc), {}),
    redactionMap, // placeholder -> original value, human-lookup only, never sent back to the model
  });

  if (hookEvent === 'PreToolUse') {
    let updatedInput;
    try {
      updatedInput = JSON.parse(redactedText);
    } catch {
      updatedInput = payload.tool_input; // redaction broke JSON shape; fall back to original rather than corrupt the call
    }
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: `PII/secrets detected in tool input and redacted before execution (${matches.length} match(es); see audit/pii-scan-results/).`,
        updatedInput,
      },
    };
  }

  // PostToolUse
  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedToolOutput: redactedText,
    },
  };
}

// Curl-based Jira access (jira-access.instructions.md's documented path — no Atlassian MCP
// connector required) has no PreToolUse/PostToolUse matcher of its own; it runs as a plain
// terminal command, so it's invisible to the Atlassian-MCP-tool hooks above. This narrowly
// reuses the same scanner for that path, scoped to only commands that actually reference the
// Jira base URL, so ordinary terminal calls (the vast majority) see zero added work.
function isJiraCurlCommand(command) {
  return typeof command === 'string' && /JIRA_BASE_URL|\batlassian\.net\b/i.test(command);
}

// Terminal-tool PostToolUse payloads nest real output under tool_response.{stdout,stderr} in
// Claude Code's shape, not a top-level tool_output like MCP tool calls use. Whether this
// environment's terminal tool (e.g. run_in_terminal) uses the same payload shape is unconfirmed
// — verify empirically before relying on this in a live hook run. Returns the redacted combined
// stdout+stderr text if this command was in scope and PII was found, or null if out of scope /
// nothing to redact — the caller decides what null means.
function processBashJiraPayload(payload) {
  const command = payload.tool_input && payload.tool_input.command;
  if (!isJiraCurlCommand(command)) return null;

  const toolResponse = payload.tool_response || {};
  const stdout = typeof toolResponse.stdout === 'string' ? toolResponse.stdout : '';
  const stderr = typeof toolResponse.stderr === 'string' ? toolResponse.stderr : '';
  const combined = stderr ? `${stdout}\n${stderr}` : stdout;

  const { hasPII, matches } = scanText(combined);
  if (!hasPII) return null;

  const { redactedText, redactionMap } = redactText(combined, matches);

  writeAuditLog(payload.cwd || process.cwd(), {
    timestamp: new Date().toISOString(),
    session_id: payload.session_id,
    hook_event_name: 'PostToolUse',
    tool_name: payload.tool_name,
    matchCounts: matches.reduce((acc, m) => ((acc[m.type] = (acc[m.type] || 0) + 1), acc), {}),
    redactionMap,
  });

  return redactedText;
}

function main() {
  const raw = readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // No parseable hook payload — allow the tool call through unchanged.
    process.stdout.write('{}');
    return;
  }

  process.stdout.write(JSON.stringify(processPayload(payload)));
}

if (require.main === module) main();

module.exports = { processPayload, processBashJiraPayload, isJiraCurlCommand };
