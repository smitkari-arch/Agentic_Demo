// UserPromptSubmit hook: scans the user's own prompt text for PII/secrets before it reaches
// the model, using the same deterministic detector as the Jira PreToolUse/PostToolUse hooks
// (see ../pii-ocr/pii-scanner.js). Implements .github/hooks/user-prompt-pii-scan.json.
//
// Unlike the Jira hooks, this event only supports blocking or adding context, not modifying the
// prompt (no "updatedInput" equivalent for UserPromptSubmit). So on a match this hook blocks the
// prompt outright via {"decision":"block"} and asks the user to resubmit without the sensitive
// content, instead of silently redacting it.
//
// Registered via .github/hooks/user-prompt-pii-scan.json under hooks.UserPromptSubmit (no
// matcher needed — this event isn't scoped to a tool_name).
'use strict';

const fs = require('fs');
const path = require('path');
const { scanText } = require('../pii-ocr/pii-scanner');

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
    fs.writeFileSync(path.join(dir, `${stamp}_UserPromptSubmit_prompt.json`), JSON.stringify(entry, null, 2), 'utf-8');
  } catch (err) {
    // Fail open: audit logging must never break prompt submission.
    process.stderr.write(`pre-prompt-pii-scan.js: failed to write audit log: ${err.message}\n`);
  }
}

function main() {
  const raw = readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write('{}');
    return;
  }

  if (payload.hook_event_name !== 'UserPromptSubmit' || typeof payload.prompt !== 'string') {
    process.stdout.write('{}');
    return;
  }

  const { hasPII, matches } = scanText(payload.prompt);

  if (!hasPII) {
    process.stdout.write('{}');
    return;
  }

  const matchCounts = matches.reduce((acc, m) => ((acc[m.type] = (acc[m.type] || 0) + 1), acc), {});

  // Log the real matched values for authorized human lookup only — never echoed back into the
  // block reason, which the model/transcript will see.
  writeAuditLog(payload.cwd || process.cwd(), {
    timestamp: new Date().toISOString(),
    session_id: payload.session_id,
    hook_event_name: 'UserPromptSubmit',
    matchCounts,
    matches, // {type, value, start, end} — human-only, lives under audit/, not sent to the model
  });

  const typesList = Object.entries(matchCounts)
    .map(([type, count]) => `${type} x${count}`)
    .join(', ');

  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        `Guardrail violation (Data Protection controls, instructions/guardrails-policy.instructions.md): your prompt appears to contain PII/secrets (${typesList}). ` +
        'This cannot be redacted in place for a prompt (unlike tool calls), so the prompt is blocked rather than sent to the model. ' +
        'Remove the sensitive content and resubmit. Details logged for authorized human review under audit/pii-scan-results/.',
    })
  );
}

main();
