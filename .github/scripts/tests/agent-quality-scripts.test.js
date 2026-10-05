'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');

const {
  parseSpecMarkdown,
  inferDesignerMetrics,
  inferScripterMetrics,
} = require('../generate-agent-quality-evidence.js');
const { buildSummary } = require('../format-agent-chat-summary.js');
const { validateScoreObject } = require('../validate-agent-quality-evidence.js');

function mkTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-quality-test-'));
}

test('parseSpecMarkdown extracts tc/ac/types and quality hints', () => {
  const spec = [
    '# KAN-9: Sample',
    '## Test Cases',
    '### TC-01: Positive path',
    '- AC: AC1',
    '- Type: Positive',
    '- Preconditions:',
    '  - user exists',
    '- Steps:',
    '  1. Open page',
    '- Expected Result:',
    '  - Success',
    '### TC-02: Boundary path',
    '- AC: AC2',
    '- Type: Boundary',
  ].join('\n');

  const parsed = parseSpecMarkdown(spec);
  assert.equal(parsed.testCaseCount, 2);
  assert.equal(parsed.acRefCount, 2);
  assert.deepEqual(parsed.scenarioTypes.sort(), ['boundary', 'positive']);
  assert.ok(parsed.qualityHits >= 4);
});

test('buildSummary converts raw reason codes into reader-friendly chat text', () => {
  const summary = buildSummary({
    verdict: 'Ready',
    quality: 87.05,
    confidence: 87.84,
    reason: 'NOT_APPLICABLE',
    recommendation: 'Keep this as a reference example and continue monitoring trends over time.',
  });

  assert.ok(summary.includes('Verdict: Ready'));
  assert.ok(summary.includes('Main issue: No major issue found.'));
  assert.ok(summary.includes('Recommended next step: Keep this as a reference example and continue monitoring trends over time.'));
});

test('inferDesignerMetrics uses linked story spec path when provided', () => {
  const root = mkTempDir();
  const specDir = path.join(root, 'playwrightTests', 'specs', 'KAN-9');
  fs.mkdirSync(specDir, { recursive: true });

  const specPath = path.join(specDir, 'sample.md');
  fs.writeFileSync(
    specPath,
    [
      '# KAN-9',
      '### TC-01',
      '- AC: AC1',
      '- Type: Positive',
      '- Preconditions:',
      '- Steps:',
      '- Expected Result:',
    ].join('\n'),
    'utf-8'
  );

  const event = {
    jira_story_key: 'KAN-9',
    status: 'success',
    message: '1 test cases generated for KAN-9',
    additional_details: {
      score_artifacts: {
        story_spec_path: path.relative(root, specPath).replace(/\\/g, '/'),
      },
    },
  };

  const metrics = inferDesignerMetrics(event, { root });
  assert.equal(metrics.requirement_coverage.value, 100);
  assert.equal(metrics.acceptance_criteria_coverage.value, 100);
  assert.ok(metrics.scenario_type_coverage.value <= 100);
});

test('inferScripterMetrics computes assertion/reusability from linked spec', () => {
  const root = mkTempDir();
  const testsDir = path.join(root, 'playwrightTests', 'tests');
  const reportDir = path.join(root, 'playwrightTests', 'playwright-report');
  fs.mkdirSync(testsDir, { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });

  const specPath = path.join(testsDir, 'kan-9.sample.spec.ts');
  fs.writeFileSync(
    specPath,
    [
      "import { test, expect } from '../fixtures/base';",
      "import { LoginPage } from '../pages/LoginPage';",
      "test('sample', async ({ page }) => {",
      '  const login = new LoginPage(page);',
      '  await expect(page.getByRole(\'button\', { name: \'Sign in\' })).toBeVisible();',
      '});',
    ].join('\n'),
    'utf-8'
  );

  fs.writeFileSync(
    path.join(reportDir, 'results.json'),
    JSON.stringify({ stats: { expected: 1, unexpected: 0 } }, null, 2),
    'utf-8'
  );

  const event = {
    jira_story_key: 'KAN-9',
    status: 'success',
    message: '1 scenario scripted and npx playwright test passed for KAN-9',
    additional_details: {
      score_artifacts: {
        playwright_spec_path: path.relative(root, specPath).replace(/\\/g, '/'),
      },
    },
  };

  const metrics = inferScripterMetrics(event, { root });
  assert.equal(metrics.syntax_pass_rate.value, 100);
  assert.ok(metrics.assertion_quality_score.value >= 0);
  assert.ok(metrics.reusability_score.value >= 0);
});

test('validateScoreObject accepts valid payload and flags missing reason_code', () => {
  const errors = [];

  const valid = {
    score_event_version: 'v2',
    metric_version: 'v2',
    outcome_score: 80,
    confidence_score: 70,
    confidence_band: 'Low confidence',
    summary_line: 'Partial result. The run scored 80/100 quality with 70/100 confidence.',
    detail_summary: 'The run was usable but incomplete evidence reduced confidence.',
    recommendation: 'Add missing baseline data and rerun scoring before relying on this result.',
    primary_reason_code: 'HISTORICAL_BASELINE_UNAVAILABLE',
    missing_metric_list: ['scenario_type_coverage'],
    metric_explanations: [
      { key: 'scenario_type_coverage', explanation: 'The scenario type coverage was lower than ideal because a valid historical baseline was unavailable.' },
    ],
    source_event: {
      event_id: 'evt-1',
      correlation_id: 'corr-1',
      event_timestamp: '2026-01-01T00:00:00.000Z',
      skill: 'generate-test-scenarios',
      actor_name: 'Designer Agent',
      actor_id: 'agent.designer.v1',
    },
    metrics: [
      { key: 'requirement_coverage', weight: 0.2, value: 90 },
      { key: 'acceptance_criteria_coverage', weight: 0.2, value: 90 },
      { key: 'scenario_type_coverage', weight: 0.15, value: 90 },
      { key: 'risk_based_coverage', weight: 0.15, value: null, reason_code: 'HISTORICAL_BASELINE_UNAVAILABLE' },
      { key: 'defect_history_coverage', weight: 0.1, value: null, reason_code: 'ARTIFACT_NOT_FOUND' },
      { key: 'test_case_quality_score', weight: 0.15, value: 90 },
      { key: 'uniqueness_score', weight: 0.05, value: 95 },
    ],
    confidence_factors: [
      { key: 'evidence_completeness', weight: 0.3, value: 80 },
      { key: 'validation_pass_rate', weight: 0.3, value: 90 },
      { key: 'historical_accuracy', weight: 0.2, value: null, reason_code: 'HISTORICAL_BASELINE_UNAVAILABLE' },
    ],
  };

  validateScoreObject('valid.score.json', valid, errors);
  assert.equal(errors.length, 0);

  const invalid = JSON.parse(JSON.stringify(valid));
  invalid.metrics[3].reason_code = undefined;

  const invalidErrors = [];
  validateScoreObject('invalid.score.json', invalid, invalidErrors);
  assert.ok(invalidErrors.some((e) => e.includes('missing reason_code')));
});

test('generate-agent-execution-report omits usage and score columns', () => {
  const root = mkTempDir();
  const actionsDir = path.join(root, 'audit', 'agent-actions');
  const reportsDir = path.join(root, 'reports');
  fs.mkdirSync(actionsDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });

  const completion = {
    event_id: 'evt-1',
    event_timestamp: '2026-09-29T08:35:09.258Z',
    event_type: 'agent_task_completed',
    jira_story_key: 'KAN-7',
    correlation_id: 'KAN-7-run-20260929',
    status: 'success',
    workflow_stage: 'Test Scenario Generation',
    message: '1 test case generated for KAN-7',
    actor: {
      actor_name: 'Designer Agent',
      actor_id: 'agent.designer.v1',
    },
  };

  const usage = {
    event_id: 'evt-2',
    event_timestamp: '2026-09-29T08:35:10.258Z',
    event_type: 'agent_usage_reported',
    jira_story_key: 'KAN-7',
    correlation_id: 'KAN-7-run-20260929',
    usage: {
      total_tokens: 123,
      tool_uses: 5,
      duration_ms: 456,
    },
  };

  fs.writeFileSync(
    path.join(actionsDir, '2026-09-29T08-35-09-258Z_generate-test-scenarios.json'),
    JSON.stringify(completion),
    'utf-8'
  );

  fs.writeFileSync(
    path.join(actionsDir, '2026-09-29T08-35-10-258Z_generate-test-scenarios.json'),
    JSON.stringify(usage),
    'utf-8'
  );

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, '..', 'generate-agent-execution-report.js')],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const reportCsv = fs.readFileSync(path.join(reportsDir, 'agent-execution-report.csv'), 'utf-8');
  const header = reportCsv.split('\n')[0];
  assert.equal(header, 'Timestamp,Skill,ActorName,ActorId,JiraStoryKey,CorrelationId,Status,WorkflowStage,Summary,EventId');
  assert.doesNotMatch(header, /Tokens|ToolUses|DurationMs|OutcomeScore|ConfidenceScore|ConfidenceBand|MetricVersion/);
});

test('log-agent-action writes human-readable summary metadata', () => {
  const root = mkTempDir();
  const script = path.join(__dirname, '..', 'log-agent-action.js');

  const result = spawnSync(
    process.execPath,
    [
      script,
      '--skill',
      'jira-story-readiness',
      '--status',
      'success',
      '--summary',
      'Verdict: Ready for KAN-7',
      '--jira-story-key',
      'KAN-7',
      '--skip-refresh',
    ],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const actionDir = path.join(root, 'audit', 'agent-actions');
  const file = fs.readdirSync(actionDir).find((f) => f.endsWith('.json'));
  assert.ok(file, 'expected action audit file to be created');

  const event = JSON.parse(fs.readFileSync(path.join(actionDir, file), 'utf-8'));
  assert.ok(event.summary_line.includes('Outcome: The run completed successfully.'));
  assert.ok(event.detail_summary.includes('Verdict: Ready for KAN-7'));
  assert.ok(event.recommendation.includes('Review the outcome'));
  assert.ok(event.additional_details.human_summary.summary_line.includes('Outcome: The run completed successfully.'));
});

test('generate-agent-quality-report omits MetricVersion column', () => {
  const root = mkTempDir();
  const evidenceDir = path.join(root, 'audit', 'agent-quality');
  const reportsDir = path.join(root, 'reports');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });

  const evidence = {
    metric_version: 'v2',
    outcome_score: 86.67,
    confidence_score: 100,
    confidence_band: 'High confidence',
    summary_line: 'Strong result. The run scored 86.67/100 quality with 100/100 confidence.',
    detail_summary: 'The run was strong and fully supported by evidence.',
    recommendation: 'Keep this run as a reference for future scoring comparisons.',
    primary_reason_code: 'NOT_APPLICABLE',
    missing_metric_list: [],
    metric_explanations: [],
    source_event: {
      event_timestamp: '2026-09-29T08:36:41.788Z',
      event_id: 'evt-1',
      correlation_id: 'KAN-7-run-20260929',
      skill: 'generate-test-scenarios',
      actor_name: 'Designer Agent',
      actor_id: 'agent.designer.v1',
      jira_story_key: 'KAN-7',
      status: 'success',
    },
    outcome_weights: { missing_weight: 0 },
    confidence_factors: [
      { key: 'evidence_completeness', value: 100 },
      { key: 'validation_pass_rate', value: 100 },
      { key: 'historical_accuracy', value: 100 },
    ],
  };

  fs.writeFileSync(path.join(evidenceDir, 'evt-1.score.json'), JSON.stringify(evidence), 'utf-8');

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, '..', 'generate-agent-quality-report.js')],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const reportCsv = fs.readFileSync(path.join(reportsDir, 'agent-quality-report.csv'), 'utf-8');
  const header = reportCsv.split('\n')[0];
  assert.equal(
    header,
    'Timestamp,EventId,CorrelationId,Skill,ActorName,ActorId,JiraStoryKey,Status,OutcomeScore,ConfidenceScore,ConfidenceBand,SummaryLine,PrimaryReasonCode,MissingMetrics,Recommendation,MissingMetricWeight,EvidenceCompleteness,ValidationPassRate,HistoricalAccuracy'
  );
  assert.doesNotMatch(header, /MetricVersion/);
});
