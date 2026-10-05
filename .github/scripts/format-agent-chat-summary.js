#!/usr/bin/env node

const fs = require('node:fs');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function toDisplay(value) {
  if (value === undefined || value === null || value === true) return '';
  return String(value).trim();
}

function formatReasonForChat(reason) {
  const normalized = String(reason || '').trim();
  if (!normalized) return 'No major issue found';

  switch (normalized.toUpperCase()) {
    case 'NOT_APPLICABLE':
      return 'No major issue found';
    case 'HISTORICAL_BASELINE_UNAVAILABLE':
      return 'Historical baseline is unavailable';
    case 'ARTIFACT_NOT_FOUND':
      return 'Required artifact is unavailable';
    case 'EXTERNAL_REVIEW_UNAVAILABLE':
      return 'External review data is unavailable';
    default:
      return normalized;
  }
}

function buildSummary(args) {
  const verdict = toDisplay(args.verdict || args.status || args.result) || 'Outcome';
  const quality = toDisplay(args.quality ?? args['quality-score'] ?? args['outcome-score']);
  const confidence = toDisplay(args.confidence ?? args['confidence-score']);
  const reason = toDisplay(args.reason ?? args['primary-reason-code'] ?? args['reason-code']);
  const recommendation = toDisplay(args.recommendation ?? args['next-step']);
  const gaps = toDisplay(args.gaps ?? args['gap-list'] ?? args['missing-metrics'] ?? 'none');
  const summaryLine = toDisplay(args['summary-line']);

  if (summaryLine) {
    return summaryLine;
  }

  const parts = [`Verdict: ${verdict}`];

  if (quality || confidence) {
    const qualityText = quality ? `${quality}/100 quality` : 'quality unavailable';
    const confidenceText = confidence ? `${confidence}/100 confidence` : 'confidence unavailable';
    parts.push(`Outcome: ${qualityText} with ${confidenceText}.`);
  }

  if (reason) {
    parts.push(`Main issue: ${formatReasonForChat(reason)}.`);
  }

  if (recommendation) {
    parts.push(`Recommended next step: ${recommendation}`);
  }

  if (gaps && gaps !== 'none') {
    parts.push(`Gaps: ${gaps}`);
  }

  return parts.join(' ');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log('Usage: node format-agent-chat-summary.js --verdict "Ready" --quality 86 --confidence 89 --reason "HISTORICAL_BASELINE_UNAVAILABLE" --recommendation "Collect more historical runs before relying on this score."');
    return;
  }

  const text = buildSummary(args);
  console.log(text);
}

if (require.main === module) {
  main();
}

module.exports = { buildSummary };
