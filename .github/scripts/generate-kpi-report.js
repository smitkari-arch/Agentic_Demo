// KPI report generator — appends one row per real Playwright test suite run to reports/kpi-report.csv.
// Sourced from real, already-executed run output only — never fabricates a row for a suite that wasn't actually run.
//
// Playwright source: pass --playwright-json <path> pointing at output from `npx playwright test --reporter=json`.
// The default HTML reporter in playwright.config.ts does not produce a single machine-readable summary file.
//
// AgentRuns column: optional in older CSVs. Pass --jira-story-key <KEY> to print counts to stdout —
// counts real agent runs from audit/agent-actions/*.json whose jira_story_key matches. This value
// is no longer written to the CSV file; the script will still print counts for diagnostics.
//
// Usage:
//   node .github/scripts/generate-kpi-report.js [--playwright-json <path>] [--jira-story-key <KEY>]
'use strict';

const fs = require('fs');
const path = require('path');

const CSV_HEADER = 'Timestamp,Framework,Suite,Total,Passed,Failed,Skipped,DurationSec,SourceReportPath';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith('--') ? (i++, next) : '';
  }
  return args;
}

function csvField(value) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function extractAttr(tag, attr) {
  const match = tag.match(new RegExp(`\\b${attr}="([^"]*)"`));
  return match ? match[1] : undefined;
}

function parsePlaywrightJson(jsonPath, rootDir) {
  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const stats = report.stats || {};
  const durationSec = typeof stats.duration === 'number' ? stats.duration / 1000 : 0;
  const expected = stats.expected || 0;
  const unexpected = stats.unexpected || 0;
  const skipped = stats.skipped || 0;
  const flaky = stats.flaky || 0;
  const total = expected + unexpected + skipped + flaky;

  return [
    {
      framework: 'playwright',
      suite: path.basename(jsonPath),
      total,
      passed: expected,
      failed: unexpected,
      skipped,
      durationSec,
      sourceReportPath: path.relative(rootDir, jsonPath),
    },
  ];
}

// Counts real agent runs tied to a story key, for the AgentRuns column. Reads
// audit/agent-actions/*.json directly (top-level files only — skips the errors/ subfolder,
// those are malformed-event records, not real runs). Excludes agent_usage_reported entries so a
// run that got both its own completion log AND a separate usage-reporting log (per
// agent-usage-logging.instructions.md) counts once, not twice. Returns { count, breakdown } where
// breakdown is actor_name -> count, for the console summary (not written to the CSV itself).
function countAgentRuns(root, storyKey) {
  const dir = path.join(root, 'audit', 'agent-actions');
  if (!fs.existsSync(dir)) return { count: 0, breakdown: {} };

  const breakdown = {};
  let count = 0;

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(dir, file);
    if (!fs.statSync(filePath).isFile()) continue;

    let event;
    try {
      event = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue; // not a valid event record — skip rather than crash the whole report
    }

    if (event.jira_story_key !== storyKey) continue;
    if (event.event_type === 'agent_usage_reported') continue; // paired usage event, not a distinct run

    count += 1;
    const actor = (event.actor && event.actor.actor_name) || 'Unknown';
    breakdown[actor] = (breakdown[actor] || 0) + 1;
  }

  return { count, breakdown };
}

function appendRows(rows, csvPath) {
  const isNewFile = !fs.existsSync(csvPath);
  fs.mkdirSync(path.dirname(csvPath), { recursive: true });

  if (isNewFile) {
    fs.writeFileSync(csvPath, CSV_HEADER + '\n', 'utf-8');
  }

  const timestamp = new Date().toISOString();
  const lines = rows.map((r) =>
    [timestamp, r.framework, r.suite, r.total, r.passed, r.failed, r.skipped, r.durationSec, r.sourceReportPath]
      .map(csvField)
      .join(',')
  );

  fs.appendFileSync(csvPath, lines.join('\n') + '\n', 'utf-8');
  return lines.length;
}

function main() {
  const { 'playwright-json': playwrightJsonPath, 'jira-story-key': jiraStoryKey } = parseArgs(process.argv.slice(2));
  const root = path.resolve(__dirname, '..', '..');
  const rows = [];

  if (playwrightJsonPath) {
    if (!fs.existsSync(playwrightJsonPath)) {
      throw new Error(`--playwright-json path does not exist: ${playwrightJsonPath}`);
    }
    rows.push(...parsePlaywrightJson(playwrightJsonPath, root));
  }

  if (rows.length === 0) {
    process.stdout.write('No real Playwright JSON report found. Nothing written.\n');
    return;
  }

  if (jiraStoryKey) {
    const { count, breakdown } = countAgentRuns(root, jiraStoryKey);
    const breakdownStr = Object.entries(breakdown)
      .map(([actor, n]) => `${actor} x${n}`)
      .join(', ');
    process.stdout.write(`AgentRuns for ${jiraStoryKey}: ${count}${breakdownStr ? ` (${breakdownStr})` : ''}\n`);
  }

  const csvPath = path.join(root, 'reports', 'kpi-report.csv');
  const count = appendRows(rows, csvPath);
  process.stdout.write(`Appended ${count} row(s) to ${path.relative(root, csvPath)}\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`generate-kpi-report.js: ${err.message}\n`);
  process.exitCode = 1;
}
