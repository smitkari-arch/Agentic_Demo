// Agent-action audit logger — CLI entrypoint any skill can call at the end of its own run to
// record what it did, deterministically, without depending on a PostToolUse/Stop hook firing.
//
// Why a skill-writes-its-own-line design instead of a hook: hooks aren't guaranteed to fire for
// every tool call in every environment. Betting the audit trail on the same mechanism risks
// silent gaps, which defeats the point of an audit trail. Each skill logging its own outcome is
// deterministic — it only depends on the skill actually running to completion, the same
// guarantee this repo already relies on for local .feature-file writes.
//
// Event shape follows the mandatory-field subset of audit/hook-debug/LogCaptureDetails.txt's
// structured-event spec (event_id, correlation_id, jira_story_key, event_type, event_category,
// actor, source, workflow_stage, status, message) — deliberately NOT the full spec (no JSONL
// migration, no KPI aggregation, no Jira/Bitbucket/Karate/ReportPortal ingestion adapters).
// One JSON file per event, same as before, just richer per-event content.
//
// Usage (unchanged flags still work; all new flags are optional):
//   node .github/scripts/log-agent-action.js --skill <skill-name> --status <success|failure|blocked> --summary "<one-line outcome>" \
//     [--input "<ref>"] [--jira-story-key <KEY>] [--correlation-id <id>] \
//     [--event-type <type>] [--event-category <category>] [--workflow-stage "<stage>"] \
//     [--actor-name "<name>"] [--actor-id <id>] \
//     [--tokens <total_tokens>] [--tool-uses <count>] [--duration-ms <ms>] \
//     [--story-spec-path <path>] [--playwright-spec-path <path>] [--failure-report-path <path>]
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const VALID_STATUSES = ['success', 'failure', 'blocked'];

// Maps each skill to the agent identity + classification fields from LogCaptureDetails.txt's
// "Logging Expectations by Agent" section, so skills don't each have to hardcode this themselves.
const AGENT_META = {
  'jira-story-readiness': {
    actorName: 'Planner Agent',
    actorId: 'agent.planner.v1',
    eventCategory: 'planning',
    workflowStage: 'Story Readiness Review',
  },
  'generate-test-scenarios': {
    actorName: 'Designer Agent',
    actorId: 'agent.designer.v1',
    eventCategory: 'design',
    workflowStage: 'Test Scenario Generation',
  },
  'generate-playwright-ui-script': {
    actorName: 'Scripter Agent',
    actorId: 'agent.scripter.v1',
    eventCategory: 'scripting',
    workflowStage: 'Script Generation (UI)',
  },
  'analyze-playwright-failure': {
    actorName: 'Healer Agent',
    actorId: 'agent.healer.v1',
    eventCategory: 'healing',
    workflowStage: 'Failure Healing',
  },
};

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

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function timeStamp(date) {
  return (
    pad(date.getUTCHours(), 2) +
    pad(date.getUTCMinutes(), 2) +
    pad(date.getUTCSeconds(), 2) +
    pad(date.getUTCMilliseconds(), 3)
  );
}

function dateStamp(date) {
  return date.getUTCFullYear() + pad(date.getUTCMonth() + 1, 2) + pad(date.getUTCDate(), 2);
}

function toNumberOrNull(value) {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePathOrNull(value) {
  if (!value) return null;
  return String(value).replace(/\\/g, '/');
}

function buildHumanSummary(skill, status, summary) {
  const baseSkill = skill ? skill.replace(/-/g, ' ') : 'agent run';
  const cleanSummary = String(summary || '').trim();
  const outcomePrefix = status === 'failure'
    ? 'Outcome: The run did not complete successfully.'
    : status === 'blocked'
      ? 'Outcome: The run was blocked.'
      : 'Outcome: The run completed successfully.';
  const detail = cleanSummary ? ` ${cleanSummary}` : ` ${baseSkill} completed.`;

  let recommendation;
  if (status === 'failure') {
    recommendation = 'Recommended next step: inspect the failure, fix the root cause, and rerun the workflow.';
  } else if (status === 'blocked') {
    recommendation = 'Recommended next step: unblock the dependency or missing input before retrying.';
  } else {
    recommendation = 'Recommended next step: review the outcome and continue to the next workflow step.';
  }

  return {
    summary_line: `${outcomePrefix}${detail} ${recommendation}`,
    detail_summary: cleanSummary || `${baseSkill} finished with status ${status}.`,
    recommendation: status === 'failure'
      ? 'Inspect the failure, fix the root cause, and rerun the workflow before relying on this result.'
      : status === 'blocked'
        ? 'Resolve the blocker or missing input before retrying the workflow.'
        : 'Review the outcome and continue to the next workflow step.',
  };
}

function main() {
  const {
    skill,
    status,
    summary,
    input = '',
    'jira-story-key': jiraStoryKeyArg,
    'correlation-id': correlationIdArg,
    'event-type': eventTypeArg,
    'event-category': eventCategoryArg,
    'workflow-stage': workflowStageArg,
    'actor-name': actorNameArg,
    'actor-id': actorIdArg,
    tokens: tokensArg,
    'tool-uses': toolUsesArg,
    'duration-ms': durationMsArg,
    'story-spec-path': storySpecPathArg,
    'playwright-spec-path': playwrightSpecPathArg,
    'failure-report-path': failureReportPathArg,
    'skip-refresh': skipRefreshArg,
  } = parseArgs(process.argv.slice(2));

  if (!skill || !status || !summary) {
    throw new Error(
      'Usage: node log-agent-action.js --skill <name> --status <success|failure|blocked> --summary "<one-line>" [--input "<ref>"] [--jira-story-key <KEY>] [--correlation-id <id>] [--event-type <type>] [--event-category <category>] [--workflow-stage "<stage>"] [--actor-name "<name>"] [--actor-id <id>] [--tokens <n>] [--tool-uses <n>] [--duration-ms <n>] [--story-spec-path <path>] [--playwright-spec-path <path>] [--failure-report-path <path>]'
    );
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`--status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const now = new Date();
  const timestamp = now.toISOString();
  const meta = AGENT_META[skill] || {
    actorName: skill,
    actorId: `agent.${skill}.v1`,
    eventCategory: 'audit',
    workflowStage: 'Unspecified',
  };

  const jiraStoryKey = jiraStoryKeyArg || null;
  const correlationId =
    correlationIdArg || `${jiraStoryKey || 'no-story'}-run-${dateStamp(now)}`;
  const eventType =
    eventTypeArg || (status === 'failure' ? 'agent_task_failed' : 'agent_task_completed');

  const humanSummary = buildHumanSummary(skill, status, summary);

  const event = {
    event_id: `evt-${dateStamp(now)}-${timeStamp(now)}`,
    correlation_id: correlationId,
    jira_story_key: jiraStoryKey,
    event_timestamp: timestamp,
    event_type: eventType,
    event_category: eventCategoryArg || meta.eventCategory,
    workflow_stage: workflowStageArg || meta.workflowStage,
    actor: {
      actor_type: 'agent',
      actor_name: actorNameArg || meta.actorName,
      actor_id: actorIdArg || meta.actorId,
    },
    source: {
      source_system: 'GitHub Copilot IDE',
      source_component: 'agent-runtime',
      source_reference_id: null,
    },
    status,
    message: summary,
    summary_line: humanSummary.summary_line,
    detail_summary: humanSummary.detail_summary,
    recommendation: humanSummary.recommendation,
    input_reference: input ? { ref: input } : {},
    usage: {
      total_tokens: toNumberOrNull(tokensArg),
      tool_uses: toNumberOrNull(toolUsesArg),
      duration_ms: toNumberOrNull(durationMsArg),
    },
    additional_details: {
      model_name: 'GitHub Copilot',
      framework_version: 'phase1-operationalization-v1',
      environment: 'dev',
      human_summary: {
        summary_line: humanSummary.summary_line,
        detail_summary: humanSummary.detail_summary,
        recommendation: humanSummary.recommendation,
      },
      score_artifacts: {
        story_spec_path: normalizePathOrNull(storySpecPathArg),
        playwright_spec_path: normalizePathOrNull(playwrightSpecPathArg),
        failure_report_path: normalizePathOrNull(failureReportPathArg),
      },
    },
  };

  const mandatoryFields = [
    ['event_id', event.event_id],
    ['correlation_id', event.correlation_id],
    ['jira_story_key', 'jira_story_key' in event],
    ['event_timestamp', event.event_timestamp],
    ['event_type', event.event_type],
    ['event_category', event.event_category],
    ['workflow_stage', event.workflow_stage],
    ['actor.actor_type', event.actor.actor_type],
    ['actor.actor_name', event.actor.actor_name],
    ['source.source_system', event.source.source_system],
    ['status', event.status],
    ['message', event.message],
  ];
  const missing = mandatoryFields.filter(([, value]) => !value).map(([field]) => field);

  const dir = path.join(process.cwd(), 'audit', 'agent-actions');
  const stamp = timestamp.replace(/[:.]/g, '-');

  if (missing.length > 0) {
    const errDir = path.join(dir, 'errors');
    fs.mkdirSync(errDir, { recursive: true });
    const errFile = path.join(errDir, `${stamp}_${skill}.json`);
    fs.writeFileSync(
      errFile,
      JSON.stringify({ ...event, status: 'invalid_event', missing_fields: missing }, null, 2),
      'utf-8'
    );
    throw new Error(`Missing mandatory field(s): ${missing.join(', ')} — logged as invalid_event to ${errFile}`);
  }

  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${stamp}_${skill}.json`);
  fs.writeFileSync(file, JSON.stringify(event, null, 2), 'utf-8');

  const shouldRefreshScoring = skipRefreshArg === undefined;
  if (shouldRefreshScoring) {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const refresh = spawnSync('node', [path.join(repoRoot, '.github', 'scripts', 'refresh-agent-scoring.js'), '--standalone'], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
    });
    if (refresh.status !== 0) {
      throw new Error(`Auto-scoring refresh failed with exit code ${refresh.status}`);
    }
  }

  process.stdout.write(`Logged: ${file}\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`log-agent-action.js: ${err.message}\n`);
  process.exitCode = 1;
}
