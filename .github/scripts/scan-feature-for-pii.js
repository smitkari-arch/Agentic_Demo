// PII gate for generated test files — reuses the same deterministic detection rules already used
// for Jira PII scan/redact (.github/pii-ocr/pii-scanner.js), applied to local automation artifacts
// before they are committed.
//
// Detects: emails, phone numbers, SSNs, credit card numbers, and real-looking API keys/tokens
// (AWS/GitHub/generic/bearer). Deliberately does NOT apply pii-scanner.js's GENERIC_SECRET rule
// here because structured fixture data often includes ordinary password-like literals in test setup.
// The remaining rules have no legitimate reason to appear in test data at all, real or fake,
// so a match is worth stopping for. Also does NOT detect bare names (e.g. "John Doe").
//
// Usage:
//   node .github/scripts/scan-feature-for-pii.js <path-to-test-file>
//
// Exit code 0, prints "CLEAN: <path>" — no PII found (after allowlist filtering).
// Exit code 1, prints "PII_DETECTED: <path>" + one redacted line per match — caller must not
//   proceed with this file.
'use strict';

const fs = require('fs');
const { scanText } = require('../pii-ocr/pii-scanner');

// Public, intentionally-shared demo data already exempted by copilot-instructions.md's
// governing rules ("Public, intentionally-shared demo credentials... are fine as-is"). A match
// is ignored if it contains any of these substrings — extend this list as new demo apps/
// credentials are added.
const ALLOWLIST = [
  'standard_user', 'secret_sauce', // SauceDemo
  'John Doe', 'ThisIsNotAPassword', // CURA Healthcare demo test data
  'jane.doe.qa@example.com', // demoqa.com Automation Practice Form test data — @example.com is
  // IANA-reserved for documentation/testing (RFC 2606), never a real deliverable address
  '9876543210', // demoqa.com Automation Practice Form test data — synthetic mobile number
];

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error('Usage: node scan-feature-for-pii.js <path-to-.feature-file>');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const { matches } = scanText(content);
  const realMatches = matches
    .filter((m) => m.type !== 'GENERIC_SECRET')
    .filter((m) => !ALLOWLIST.some((safe) => m.value.includes(safe)));

  if (realMatches.length === 0) {
    process.stdout.write(`CLEAN: ${filePath}\n`);
    return;
  }

  process.stderr.write(`PII_DETECTED: ${filePath}\n`);
  for (const m of realMatches) {
    // Never print the raw matched value in this output — redact it, same principle as the
    // Jira PII hook's redaction map.
    process.stderr.write(`  - ${m.type} at character offset ${m.start}\n`);
  }
  process.exitCode = 1;
}

try {
  main();
} catch (err) {
  process.stderr.write(`scan-feature-for-pii.js: ${err.message}\n`);
  process.exitCode = 2;
}
