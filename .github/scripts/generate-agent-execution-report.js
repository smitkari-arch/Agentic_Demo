// Agent/skill execution KPI report — one row per real agent run, sourced entirely from
// audit/agent-actions/*.json. Distinct from generate-kpi-report.js (the Playwright KPI report
// sourced from real Karate/Playwright test-execution output) — the two are complementary,
// covering agent/skill activity specifically.
//
// Full CSV rewrite each run (not append-only like the test-KPI report) — this is meant to be a
// current snapshot of the audit log, not an accumulating history file.
//
// Pairing completion events with their real token/tool-use/duration numbers:
// A skill's own "Log this run" step (event_type agent_task_completed/agent_task_failed) never
// knows its own usage figures — those only exist in a SEPARATE agent_usage_reported event, logged
// afterward by whatever invoked the skill run (see instructions/agent-usage-logging.instructions.md).
// The two events share a correlation_id, but that ID is derived as `${storyKey}-run-${date}` —
// identical across EVERY run of the same skill for the same story on the same day, not unique per
// run. Default mode keeps the strict immediate-adjacency heuristic; standalone mode relaxes that to
// a FIFO match within the same skill/story/day bucket.
//
// Earlier version of this script matched "nearest unclaimed usage event with the same skill,
// searched forward across the whole timeline" instead of strict adjacency — that cascaded: a
// completion with no real usage event (happens — logging usage is a separate manual step, easy to
// skip) had nothing to stop it from stealing the NEXT completion's usage event to fill its own
// gap, which then stole the one after that, shifting every subsequent same-skill pairing by one
// for the rest of the session. Strict immediate-adjacency in the full stream can't cascade: a gap
// just leaves that one completion unmatched, with zero effect on any other pairing. Standalone
// mode keeps the same safety property while tolerating interleaved audit events between completion
// and usage.
//
// Usage:
//   node .github/scripts/generate-agent-execution-report.js [--standalone]
'use strict';

const fs = require('fs');
const path = require('path');

const CSV_HEADER = 'Timestamp,Skill,ActorName,ActorId,JiraStoryKey,CorrelationId,Status,WorkflowStage,Summary,EventId';

function csvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function skillFromFilename(filename) {
  // Filenames are `${ISO-stamp-with-dashes}_${skill}.json`, e.g.
  // "2026-08-10T11-47-11-637Z_jira-story-readiness.json" -> "jira-story-readiness"
  const match = filename.match(/^\d{4}-\d{2}-\d{2}T[\d-]+Z_(.+)\.json$/);
  return match ? match[1] : null;
}

function loadEvents(dir) {
  if (!fs.existsSync(dir)) return [];
  const events = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(dir, file);
    if (!fs.statSync(filePath).isFile()) continue; // skips the errors/ subfolder

    let event;
    try {
      event = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue; // malformed record — skip rather than crash the whole report
    }

    const skill = skillFromFilename(file);
    if (!skill || !event.event_timestamp || !event.event_type) continue;
    events.push({ ...event, _skill: skill, _file: file });
  }
  events.sort((a, b) => a.event_timestamp.localeCompare(b.event_timestamp));
  return events;
}

function runBucket(event) {
  const day = event.event_timestamp ? event.event_timestamp.slice(0, 10) : 'unknown-day';
  return `${event._skill}|${event.jira_story_key || 'no-story'}|${day}`;
}

// `events` is the FULL chronologically-sorted stream (every event type, every skill, every
// story) — pairing must walk it as one sequence, not per-skill/per-story subsets. A completion
// is paired with a usage event only when that usage event is the very next entry in the WHOLE
// stream (nothing of any kind in between) and shares the same skill+story. This intentionally
// does not use "nearest matching usage event, searched forward across the whole timeline": that
// approach cascades when a completion has no real usage event of its own (a real, observed case
// — logging usage is a separate manual step, easy to skip) — the gap makes the next completion's
// usage event get stolen to fill it, then the next, shifting every subsequent pairing by one for
// the rest of the session. Strict immediate-adjacency in the full stream can't cascade: a gap
// just leaves that one completion unmatched, with no effect on any other pairing.
function pairUsageEvents(events, standaloneMode = false) {
  const completions = [];
  const pendingByBucket = new Map();

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (event.event_type === 'agent_task_completed' || event.event_type === 'agent_task_failed') {
      if (standaloneMode) {
        const bucket = runBucket(event);
        const queue = pendingByBucket.get(bucket) || [];
        queue.push(event);
        pendingByBucket.set(bucket, queue);
      } else {
        const next = events[i + 1];
        if (
          next &&
          next.event_type === 'agent_usage_reported' &&
          next._skill === event._skill &&
          next.jira_story_key === event.jira_story_key
        ) {
          event._usage = next.usage;
        }
      }

      completions.push(event);
      continue;
    }

    if (!standaloneMode || event.event_type !== 'agent_usage_reported') continue;

    const bucket = runBucket(event);
    const queue = pendingByBucket.get(bucket);
    if (!queue || queue.length === 0) continue;

    const completion = queue.shift();
    completion._usage = event.usage;
    if (queue.length === 0) pendingByBucket.delete(bucket);
  }

  return completions;
}

function buildRows(completions) {
  return completions.map((e) => [
    e.event_timestamp,
    e._skill,
    (e.actor && e.actor.actor_name) || '',
    (e.actor && e.actor.actor_id) || '',
    e.jira_story_key || '',
    e.correlation_id || '',
    e.status || '',
    e.workflow_stage || '',
    e.message || '',
    e.event_id || '',
  ]);
}

function main() {
  const standaloneMode = process.argv.includes('--standalone');
  const root = process.cwd();
  const events = loadEvents(path.join(root, 'audit', 'agent-actions'));
  if (events.length === 0) {
    process.stdout.write('No agent-action events found in audit/agent-actions/. Nothing written.\n');
    return;
  }

  const completions = pairUsageEvents(events, standaloneMode);
  if (completions.length === 0) {
    process.stdout.write('No agent_task_completed/agent_task_failed events found (only usage/other events). Nothing written.\n');
    return;
  }

  const rows = buildRows(completions);

  const csvPath = path.join(root, 'reports', 'agent-execution-report.csv');
  fs.mkdirSync(path.dirname(csvPath), { recursive: true });
  const lines = [CSV_HEADER, ...rows.map((r) => r.map(csvField).join(','))];
  fs.writeFileSync(csvPath, lines.join('\n') + '\n', 'utf-8');

  process.stdout.write(
    `Wrote ${rows.length} row(s) to ${path.relative(root, csvPath)}${standaloneMode ? ' [standalone mode]' : ''}.\n`
  );
}

try {
  main();
} catch (err) {
  process.stderr.write(`generate-agent-execution-report.js: ${err.message}\n`);
  process.exitCode = 1;
}
