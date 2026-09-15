// PII scan for text extracted from an image (Jira attachment) by an agent's own vision reading —
// NOT a deterministic OCR library, and NOT a hook. Hooks are plain scripts with no vision/LLM
// access, so there is no way to make "read text out of an arbitrary image" run silently in the
// background the way the regex-based PII hooks do. This script is the second half only: once an
// agent (jira-story-readiness, in practice) has already looked at the image and typed out what it
// saw, this reuses the same deterministic scanner/redactor used everywhere else in this repo
// (pii-ocr/pii-scanner.js) against that transcribed text, and writes an audit entry in the same
// audit/pii-scan-results/ format as the other consumers — see pii-ocr/README.md.
//
// Because the "OCR" half is an LLM reading an image, not a deterministic function, treat any
// finding from this path as best-effort: transcription accuracy is not guaranteed the way regex
// matching is. The audit entry's hook_event_name is prefixed "SkillStep_" (not "PreToolUse"/
// "PostToolUse") specifically so it's never mistaken for a real hook firing.
//
// Usage:
//   echo "<transcribed text>" | node .github/scripts/scan-ocr-text-for-pii.js --story-key PERF-2820 --source-image "confirmation-screenshot.png"
//
// Prints a JSON summary to stdout ({hasPII, matchCounts}) for the calling skill to report back to
// the user. Never prints the raw matched values — those live only in the audit file.
'use strict';

const fs = require('fs');
const path = require('path');
const { scanText, redactText } = require('../pii-ocr/pii-scanner');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const args = { storyKey: null, sourceImage: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--story-key') args.storyKey = argv[++i];
    else if (argv[i] === '--source-image') args.sourceImage = argv[++i];
  }
  return args;
}

function writeAuditLog(entry) {
  const dir = path.join(process.cwd(), 'audit', 'pii-scan-results');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `${stamp}_SkillStep_ImageOCR.json`);
  fs.writeFileSync(file, JSON.stringify(entry, null, 2), 'utf-8');
  return file;
}

function main() {
  const { storyKey, sourceImage } = parseArgs(process.argv.slice(2));
  const text = readStdin();

  if (!text.trim()) {
    process.stdout.write(JSON.stringify({ hasPII: false, matchCounts: {}, note: 'no transcribed text provided' }));
    return;
  }

  const { hasPII, matches } = scanText(text);

  if (!hasPII) {
    process.stdout.write(JSON.stringify({ hasPII: false, matchCounts: {} }));
    return;
  }

  const { redactionMap } = redactText(text, matches);
  const matchCounts = matches.reduce((acc, m) => ((acc[m.type] = (acc[m.type] || 0) + 1), acc), {});

  const auditFile = writeAuditLog({
    timestamp: new Date().toISOString(),
    hook_event_name: 'SkillStep_ImageOCR',
    note:
      'Transcription performed by an LLM reading the image (jira-story-readiness process step), ' +
      'not a deterministic OCR library — treat as best-effort, not guaranteed-accurate.',
    jira_story_key: storyKey || null,
    source_image: sourceImage || null,
    matchCounts,
    redactionMap,
  });

  process.stdout.write(JSON.stringify({ hasPII: true, matchCounts, auditFile }));
}

main();
