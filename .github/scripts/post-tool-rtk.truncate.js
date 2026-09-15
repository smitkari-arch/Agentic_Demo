// RTK (Rust Token Killer) — PostToolUse hook for this environment's terminal tool calls. Shrinks
// large command output (truncation, dedup, ANSI-strip) before it reaches model context, to cut
// token consumption in CLI-heavy sessions. See rtk/README.md for the reduction policy and
// rtk/src/lib.rs for the logic itself — this file is only a thin wrapper that invokes the
// compiled Rust binary, matching this repo's `node .github/scripts/<file>.js` command-
// registration convention.
//
// Registered via .github/hooks/rtk-truncate.json under hooks.PostToolUse, matched against this
// environment's terminal tool name — verify empirically per environment, since exact tool
// naming varies (this environment's terminal tool is run_in_terminal; Claude Code's equivalent
// matcher was "Bash|PowerShell"). Uses a distinct matcher from the Atlassian-MCP-tool hooks, so
// there's no parallel-hook precedence conflict between the two.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { processBashJiraPayload } = require('../pii-ocr/sanitize');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

function binaryPath() {
  const binName = process.platform === 'win32' ? 'rtk.exe' : 'rtk';
  return path.join(__dirname, '..', '..', 'rtk', 'target', 'release', binName);
}

function emitRedactedOnly(redactedText) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', updatedToolOutput: redactedText } })
  );
}

// Verify empirically per environment — this environment's terminal tool is run_in_terminal.
const TERMINAL_TOOL_NAME = /^run_in_terminal$/;

function main() {
  const raw = readStdin();

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write('{}');
    return;
  }

  if (payload.hook_event_name !== 'PostToolUse' || !TERMINAL_TOOL_NAME.test(payload.tool_name || '')) {
    process.stdout.write('{}');
    return;
  }

  // Curl-based Jira access (this repo's documented path — see
  // .github/instructions/jira-access.instructions.md) has no Atlassian-MCP-tool matcher of its
  // own, so it's invisible to the Jira PII hooks. Scan+redact it here instead, scoped to only
  // commands referencing the Jira base URL — see sanitize.js. NOTE: whether this environment's
  // terminal-tool payload nests stdout/stderr under tool_response the same way Claude Code's
  // Bash/PowerShell payloads did is unconfirmed — verify empirically before relying on this in a
  // live hook run.
  const redactedText = processBashJiraPayload(payload);

  // Feed RTK the already-redacted text (not the original) so any further truncation never
  // operates on unredacted content. Route it all through stdout so RTK's own stdout+stderr
  // concatenation doesn't double up on text already merged by processBashJiraPayload.
  let inputForRtk = raw;
  if (redactedText !== null) {
    const patched = {
      ...payload,
      tool_response: { ...payload.tool_response, stdout: redactedText, stderr: '' },
    };
    inputForRtk = JSON.stringify(patched);
  }

  const binPath = binaryPath();
  if (!fs.existsSync(binPath)) {
    // Not built yet — fail open for ordinary commands, but PII redaction (already computed, no
    // RTK involved) must still go out rather than being silently dropped.
    if (redactedText !== null) emitRedactedOnly(redactedText);
    else process.stdout.write('{}');
    return;
  }

  // Captured (not inherited) so we can tell whether RTK actually rewrote the output: RTK no-ops
  // (emits "{}", no updatedToolOutput) when input is below its truncation threshold, and that
  // no-op must not be allowed to mean "pass the original unredacted stdout through unchanged."
  const result = spawnSync(binPath, [], { input: inputForRtk, stdio: ['pipe', 'pipe', 'inherit'], encoding: 'utf-8' });

  if (result.error || result.status !== 0) {
    if (redactedText !== null) emitRedactedOnly(redactedText);
    else process.stdout.write('{}');
    return;
  }

  if (redactedText === null) {
    process.stdout.write(result.stdout || '{}');
    return;
  }

  let rtkResult;
  try {
    rtkResult = JSON.parse(result.stdout);
  } catch {
    rtkResult = {};
  }
  const rtkTruncated =
    rtkResult && rtkResult.hookSpecificOutput && typeof rtkResult.hookSpecificOutput.updatedToolOutput === 'string';

  if (rtkTruncated) {
    process.stdout.write(result.stdout);
  } else {
    emitRedactedOnly(redactedText);
  }
}

main();
