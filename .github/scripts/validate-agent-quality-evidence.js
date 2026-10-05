// Validates score evidence schema for audit/agent-quality/*.score.json.
'use strict';

const fs = require('fs');
const path = require('path');

const REQUIRED_METRIC_KEYS = {
  'jira-story-readiness': [
    'acceptance_criteria_extraction_coverage',
    'requirement_testability_coverage',
    'story_clarity_coverage',
  ],
  'generate-test-scenarios': [
    'requirement_coverage',
    'acceptance_criteria_coverage',
    'scenario_type_coverage',
    'test_case_quality_score',
    'uniqueness_score',
  ],
  'generate-playwright-ui-script': [
    'script_generation_success_rate',
    'syntax_pass_rate',
    'framework_compliance_score',
    'assertion_quality_score',
    'reusability_score',
  ],
  'analyze-playwright-failure': [
    'failure_reproduction_rate',
    'healing_success_rate',
    'regression_safety_score',
    'false_healing_rate',
  ],
};

const REQUIRED_CONFIDENCE_KEYS = [
  'evidence_completeness',
  'validation_pass_rate',
  'historical_accuracy',
];

const VALID_REASON_CODES = new Set([
  'EXTERNAL_REVIEW_UNAVAILABLE',
  'HISTORICAL_BASELINE_UNAVAILABLE',
  'ARTIFACT_NOT_FOUND',
  'NOT_APPLICABLE',
]);

function parseArgs(argv) {
  const args = {
    dir: path.join(process.cwd(), 'audit', 'agent-quality'),
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith('--') ? (i++, next) : '';
    if (key === 'dir' && value) args.dir = path.resolve(value);
  }

  return args;
}

function fail(errors) {
  process.stderr.write(`Evidence schema validation failed with ${errors.length} issue(s):\n`);
  for (const e of errors) process.stderr.write(`- ${e}\n`);
  process.exitCode = 1;
}

function isFiniteScore(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
}

function validateScoreObject(file, obj, errors) {
  if (!obj || typeof obj !== 'object') {
    errors.push(`${file}: payload is not an object`);
    return;
  }

  const source = obj.source_event || {};
  const skill = source.skill;

  const requiredRoot = [
    'score_event_version',
    'metric_version',
    'metrics',
    'confidence_factors',
    'confidence_band',
    'summary_line',
    'detail_summary',
    'recommendation',
    'primary_reason_code',
    'missing_metric_list',
    'metric_explanations',
  ];
  for (const key of requiredRoot) {
    if (!(key in obj)) errors.push(`${file}: missing root field ${key}`);
  }

  const requiredSource = ['event_id', 'correlation_id', 'event_timestamp', 'skill', 'actor_name', 'actor_id'];
  for (const key of requiredSource) {
    if (!(key in source)) errors.push(`${file}: missing source_event.${key}`);
  }

  if (!Array.isArray(obj.metrics)) {
    errors.push(`${file}: metrics is not an array`);
  }

  if (!Array.isArray(obj.confidence_factors)) {
    errors.push(`${file}: confidence_factors is not an array`);
  }

  if (!Array.isArray(obj.missing_metric_list)) {
    errors.push(`${file}: missing_metric_list is not an array`);
  }

  if (!Array.isArray(obj.metric_explanations)) {
    errors.push(`${file}: metric_explanations is not an array`);
  }

  if (typeof obj.summary_line !== 'string' || !obj.summary_line.trim()) {
    errors.push(`${file}: summary_line must be a non-empty string`);
  }

  if (typeof obj.detail_summary !== 'string' || !obj.detail_summary.trim()) {
    errors.push(`${file}: detail_summary must be a non-empty string`);
  }

  if (typeof obj.recommendation !== 'string' || !obj.recommendation.trim()) {
    errors.push(`${file}: recommendation must be a non-empty string`);
  }

  if (obj.primary_reason_code && !VALID_REASON_CODES.has(obj.primary_reason_code)) {
    errors.push(`${file}: invalid primary_reason_code ${obj.primary_reason_code}`);
  }

  if (obj.outcome_score !== null && obj.outcome_score !== undefined && !isFiniteScore(obj.outcome_score)) {
    errors.push(`${file}: outcome_score is outside 0..100`);
  }

  if (obj.confidence_score !== null && obj.confidence_score !== undefined && !isFiniteScore(obj.confidence_score)) {
    errors.push(`${file}: confidence_score is outside 0..100`);
  }

  if (Array.isArray(obj.metrics)) {
    const expected = REQUIRED_METRIC_KEYS[skill] || [];
    const actual = new Set(obj.metrics.map((m) => m.key));

    for (const key of expected) {
      if (!actual.has(key)) errors.push(`${file}: missing metric key ${key} for skill ${skill}`);
    }

    for (const m of obj.metrics) {
      if (typeof m.key !== 'string') errors.push(`${file}: metric has non-string key`);
      if (typeof m.weight !== 'number') errors.push(`${file}: metric ${m.key} has non-number weight`);
      if (m.value !== null && m.value !== undefined && !isFiniteScore(m.value)) {
        errors.push(`${file}: metric ${m.key} value outside 0..100`);
      }
      if (m.value === null) {
        if (!m.reason_code) errors.push(`${file}: metric ${m.key} missing reason_code for null value`);
        if (m.reason_code && !VALID_REASON_CODES.has(m.reason_code)) {
          errors.push(`${file}: metric ${m.key} has invalid reason_code ${m.reason_code}`);
        }
      }
    }
  }

  if (Array.isArray(obj.confidence_factors)) {
    const actual = new Set(obj.confidence_factors.map((m) => m.key));
    for (const key of REQUIRED_CONFIDENCE_KEYS) {
      if (!actual.has(key)) errors.push(`${file}: missing confidence factor key ${key}`);
    }

    for (const m of obj.confidence_factors) {
      if (typeof m.key !== 'string') errors.push(`${file}: confidence factor has non-string key`);
      if (typeof m.weight !== 'number') errors.push(`${file}: confidence factor ${m.key} has non-number weight`);
      if (m.value !== null && m.value !== undefined && !isFiniteScore(m.value)) {
        errors.push(`${file}: confidence factor ${m.key} value outside 0..100`);
      }
      if (m.value === null) {
        if (!m.reason_code) errors.push(`${file}: confidence factor ${m.key} missing reason_code for null value`);
        if (m.reason_code && !VALID_REASON_CODES.has(m.reason_code)) {
          errors.push(`${file}: confidence factor ${m.key} has invalid reason_code ${m.reason_code}`);
        }
      }
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.dir)) {
    process.stdout.write(`No evidence directory found at ${args.dir}. Nothing to validate.\n`);
    return;
  }

  const files = fs.readdirSync(args.dir)
    .filter((f) => f.endsWith('.score.json'))
    .map((f) => path.join(args.dir, f));

  if (!files.length) {
    process.stdout.write(`No score evidence files found in ${args.dir}. Nothing to validate.\n`);
    return;
  }

  const errors = [];

  for (const filePath of files) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      errors.push(`${path.basename(filePath)}: invalid JSON (${err.message})`);
      continue;
    }

    validateScoreObject(path.basename(filePath), parsed, errors);
  }

  if (errors.length) {
    fail(errors);
    return;
  }

  process.stdout.write(`Validated ${files.length} score evidence file(s) successfully.\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`validate-agent-quality-evidence.js: ${err.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  validateScoreObject,
};
