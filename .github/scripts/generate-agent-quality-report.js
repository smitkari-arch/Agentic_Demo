// Aggregates score evidence files into dashboard-ready CSV reports.
'use strict';

const fs = require('fs');
const path = require('path');

const REPORT_HEADER = [
  'Timestamp',
  'EventId',
  'CorrelationId',
  'Skill',
  'ActorName',
  'ActorId',
  'JiraStoryKey',
  'Status',
  'OutcomeScore',
  'ConfidenceScore',
  'ConfidenceBand',
  'SummaryLine',
  'PrimaryReasonCode',
  'MissingMetrics',
  'Recommendation',
  'MissingMetricWeight',
  'EvidenceCompleteness',
  'ValidationPassRate',
  'HistoricalAccuracy',
].join(',');

const TRENDS_HEADER = [
  'Date',
  'Skill',
  'ActorName',
  'Runs',
  'AvgOutcomeScore',
  'AvgConfidenceScore',
  'HighConfidenceRuns',
  'MediumConfidenceRuns',
  'LowConfidenceRuns',
  'NotReliableRuns',
].join(',');

function parseArgs(argv) {
  const args = {
    evidenceDir: path.join(process.cwd(), 'audit', 'agent-quality'),
    reportPath: path.join(process.cwd(), 'reports', 'agent-quality-report.csv'),
    trendsPath: path.join(process.cwd(), 'reports', 'agent-quality-trends.csv'),
  };

  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const key = t.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith('--') ? (i++, next) : '';

    if (key === 'evidence-dir' && value) args.evidenceDir = path.resolve(value);
    if (key === 'report' && value) args.reportPath = path.resolve(value);
    if (key === 'trends' && value) args.trendsPath = path.resolve(value);
  }

  return args;
}

function csvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function num(value) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : '';
}

function factorValue(ev, key) {
  const f = (ev.confidence_factors || []).find((x) => x.key === key);
  return f && f.value !== null && f.value !== undefined ? f.value : null;
}

function readEvidenceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const rows = [];

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.score.json')) continue;
    const filePath = path.join(dir, file);
    if (!fs.statSync(filePath).isFile()) continue;

    let ev;
    try {
      ev = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue;
    }

    if (!ev.source_event || !ev.source_event.event_timestamp) continue;
    rows.push(ev);
  }

  rows.sort((a, b) => {
    const t = a.source_event.event_timestamp.localeCompare(b.source_event.event_timestamp);
    if (t !== 0) return t;
    return String(a.source_event.event_id || '').localeCompare(String(b.source_event.event_id || ''));
  });

  return rows;
}

function buildRunRows(evidenceRows) {
  return evidenceRows.map((ev) => {
    const source = ev.source_event || {};
    const missingWeight = ev.outcome_weights ? ev.outcome_weights.missing_weight : null;

    const missingMetrics = Array.isArray(ev.missing_metric_list) ? ev.missing_metric_list.join('; ') : '';

    return [
      source.event_timestamp || '',
      source.event_id || '',
      source.correlation_id || '',
      source.skill || '',
      source.actor_name || '',
      source.actor_id || '',
      source.jira_story_key || '',
      source.status || '',
      num(ev.outcome_score),
      num(ev.confidence_score),
      ev.confidence_band || '',
      ev.summary_line || '',
      ev.primary_reason_code || '',
      missingMetrics,
      ev.recommendation || '',
      num(missingWeight),
      num(factorValue(ev, 'evidence_completeness')),
      num(factorValue(ev, 'validation_pass_rate')),
      num(factorValue(ev, 'historical_accuracy')),
    ];
  });
}

function pushTrendCount(bucket, band) {
  if (band === 'High confidence') bucket.high += 1;
  else if (band === 'Medium confidence') bucket.medium += 1;
  else if (band === 'Low confidence') bucket.low += 1;
  else bucket.notReliable += 1;
}

function buildTrendRows(evidenceRows) {
  const byKey = new Map();

  for (const ev of evidenceRows) {
    const source = ev.source_event || {};
    const day = String(source.event_timestamp || '').slice(0, 10);
    const key = `${day}|${source.skill || ''}|${source.actor_name || ''}`;

    const current = byKey.get(key) || {
      day,
      skill: source.skill || '',
      actorName: source.actor_name || '',
      runs: 0,
      outcomeSum: 0,
      outcomeCount: 0,
      confidenceSum: 0,
      confidenceCount: 0,
      high: 0,
      medium: 0,
      low: 0,
      notReliable: 0,
    };

    current.runs += 1;
    if (Number.isFinite(ev.outcome_score)) {
      current.outcomeSum += ev.outcome_score;
      current.outcomeCount += 1;
    }
    if (Number.isFinite(ev.confidence_score)) {
      current.confidenceSum += ev.confidence_score;
      current.confidenceCount += 1;
    }

    pushTrendCount(current, ev.confidence_band || 'Not reliable');
    byKey.set(key, current);
  }

  const rows = [];
  for (const bucket of byKey.values()) {
    rows.push([
      bucket.day,
      bucket.skill,
      bucket.actorName,
      bucket.runs,
      bucket.outcomeCount ? num(bucket.outcomeSum / bucket.outcomeCount) : '',
      bucket.confidenceCount ? num(bucket.confidenceSum / bucket.confidenceCount) : '',
      bucket.high,
      bucket.medium,
      bucket.low,
      bucket.notReliable,
    ]);
  }

  rows.sort((a, b) => {
    const t = String(a[0]).localeCompare(String(b[0]));
    if (t !== 0) return t;
    const s = String(a[1]).localeCompare(String(b[1]));
    if (s !== 0) return s;
    return String(a[2]).localeCompare(String(b[2]));
  });

  return rows;
}

function writeCsv(filePath, header, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lines = [header, ...rows.map((r) => r.map(csvField).join(','))];
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const evidence = readEvidenceFiles(args.evidenceDir);

  if (!evidence.length) {
    process.stdout.write('No score evidence files found. Nothing written.\n');
    return;
  }

  const runRows = buildRunRows(evidence);
  const trendRows = buildTrendRows(evidence);

  writeCsv(args.reportPath, REPORT_HEADER, runRows);
  writeCsv(args.trendsPath, TRENDS_HEADER, trendRows);

  process.stdout.write(
    `Wrote ${runRows.length} run rows to ${path.relative(root, args.reportPath)} and ${trendRows.length} trend rows to ${path.relative(root, args.trendsPath)}.\n`
  );
}

try {
  main();
} catch (err) {
  process.stderr.write(`generate-agent-quality-report.js: ${err.message}\n`);
  process.exitCode = 1;
}
