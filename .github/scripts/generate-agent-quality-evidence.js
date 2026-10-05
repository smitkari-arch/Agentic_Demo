// Generates per-run quality evidence from audit/agent-actions events.
// Output is deterministic JSON under audit/agent-quality/ and can be used to build dashboard reports.
'use strict';

const fs = require('fs');
const path = require('path');

const OUTPUT_VERSION = 'v2';
const DEFAULT_HISTORY_WINDOW = 30;

const OUTCOME_MODELS = {
  'jira-story-readiness': {
    agent: 'Planner Agent',
    actorId: 'agent.planner.v1',
    metrics: [
      { key: 'acceptance_criteria_extraction_coverage', label: 'Acceptance Criteria Extraction Coverage', weight: 0.45 },
      { key: 'requirement_testability_coverage', label: 'Requirement Testability Coverage', weight: 0.35 },
      { key: 'story_clarity_coverage', label: 'Story Clarity Coverage', weight: 0.2 },
    ],
  },
  'generate-test-scenarios': {
    agent: 'Designer Agent',
    actorId: 'agent.designer.v1',
    metrics: [
      { key: 'requirement_coverage', label: 'Requirement Coverage', weight: 0.25 },
      { key: 'acceptance_criteria_coverage', label: 'Acceptance Criteria Coverage', weight: 0.25 },
      { key: 'scenario_type_coverage', label: 'Scenario Type Coverage', weight: 0.2 },
      { key: 'test_case_quality_score', label: 'Test Case Quality Score', weight: 0.2 },
      { key: 'uniqueness_score', label: 'Uniqueness Score', weight: 0.1 },
    ],
  },
  'generate-playwright-ui-script': {
    agent: 'Scripter Agent',
    actorId: 'agent.scripter.v1',
    metrics: [
      { key: 'script_generation_success_rate', label: 'Script Generation Success Rate', weight: 0.2 },
      { key: 'syntax_pass_rate', label: 'Syntax Pass Rate', weight: 0.2 },
      { key: 'framework_compliance_score', label: 'Framework Compliance Score', weight: 0.2 },
      { key: 'assertion_quality_score', label: 'Assertion Quality Score', weight: 0.25 },
      { key: 'reusability_score', label: 'Reusability Score', weight: 0.15 },
    ],
  },
  'analyze-playwright-failure': {
    agent: 'Healer Agent',
    actorId: 'agent.healer.v1',
    metrics: [
      { key: 'failure_reproduction_rate', label: 'Failure Reproduction Rate', weight: 0.2 },
      { key: 'healing_success_rate', label: 'Healing Success Rate', weight: 0.35 },
      { key: 'regression_safety_score', label: 'Regression Safety Score', weight: 0.3 },
      { key: 'false_healing_rate', label: 'False Healing Rate', weight: 0.15 },
    ],
  },
};

const REASON = {
  EXTERNAL_REVIEW_UNAVAILABLE: 'EXTERNAL_REVIEW_UNAVAILABLE',
  HISTORICAL_BASELINE_UNAVAILABLE: 'HISTORICAL_BASELINE_UNAVAILABLE',
  ARTIFACT_NOT_FOUND: 'ARTIFACT_NOT_FOUND',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
};

function parseArgs(argv) {
  const args = {
    dryRun: false,
    outDir: path.join(process.cwd(), 'audit', 'agent-quality'),
    historyWindow: DEFAULT_HISTORY_WINDOW,
  };

  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (!t.startsWith('--')) continue;

    const key = t.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith('--') ? (i++, next) : '';

    if (key === 'out-dir' && value) args.outDir = path.resolve(value);
    if (key === 'history-window' && value) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) args.historyWindow = Math.floor(n);
    }
  }

  return args;
}

function clamp100(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Number(n.toFixed(2));
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function resolveRepoPath(root, candidatePath) {
  if (!candidatePath) return null;
  const normalized = String(candidatePath).replace(/\\/g, '/').trim();
  if (!normalized) return null;
  const full = path.isAbsolute(normalized) ? normalized : path.join(root, normalized);
  const resolved = path.resolve(full);
  return fs.existsSync(resolved) ? resolved : null;
}

function getLinkedArtifacts(event, root) {
  const details = event.additional_details || {};
  const artifacts = details.score_artifacts || {};

  return {
    storySpecPath: resolveRepoPath(root, artifacts.story_spec_path),
    playwrightSpecPath: resolveRepoPath(root, artifacts.playwright_spec_path),
    failureReportPath: resolveRepoPath(root, artifacts.failure_report_path),
  };
}

function listFilesRecursive(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (predicate(full)) out.push(full);
    }
  }

  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function skillFromFilename(filename) {
  const match = filename.match(/^\d{4}-\d{2}-\d{2}T[\d-]+Z_(.+)\.json$/);
  return match ? match[1] : null;
}

function loadCompletionEvents(root) {
  const dir = path.join(root, 'audit', 'agent-actions');
  if (!fs.existsSync(dir)) return [];

  const events = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(dir, file);
    if (!fs.statSync(filePath).isFile()) continue;

    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue;
    }

    const skill = skillFromFilename(file);
    if (!skill) continue;
    if (payload.event_type !== 'agent_task_completed' && payload.event_type !== 'agent_task_failed') continue;

    events.push({
      ...payload,
      _skill: skill,
      _file: file,
      _filePath: filePath,
    });
  }

  events.sort((a, b) => {
    const t = String(a.event_timestamp).localeCompare(String(b.event_timestamp));
    if (t !== 0) return t;
    return String(a._file).localeCompare(String(b._file));
  });

  return events;
}

function parseIntFromMessage(message) {
  const m = String(message || '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function extractVerdict(message) {
  const text = String(message || '');
  const match = text.match(/Verdict:\s*(Ready|Not Ready|Needs Clarification)/i);
  if (match) {
    const verdict = match[1].toLowerCase();
    if (verdict === 'ready') return 'ready';
    if (verdict === 'not ready') return 'not-ready';
    if (verdict === 'needs clarification') return 'needs-clarification';
  }
  if (/\bnot ready\b/i.test(text)) return 'not-ready';
  if (/\bneeds clarification\b/i.test(text)) return 'needs-clarification';
  if (/\bready\b/i.test(text)) return 'ready';
  return 'unknown';
}

function metric(value, raw_inputs) {
  return { value: value === null ? null : clamp100(value), raw_inputs };
}

function nullMetric(reason_code, raw_inputs) {
  return { value: null, reason_code, raw_inputs };
}

function parseSpecMarkdown(text) {
  const tcMatches = text.match(/^###\s+TC-\d+/gim) || [];
  const acRefs = text.match(/\bAC\d+\b/gi) || [];
  const typeMatches = text.match(/-\s*Type\s*:\s*(.+)$/gim) || [];

  const typeSet = new Set();
  for (const m of typeMatches) {
    const lower = m.toLowerCase();
    if (lower.includes('positive')) typeSet.add('positive');
    if (lower.includes('negative')) typeSet.add('negative');
    if (lower.includes('boundary')) typeSet.add('boundary');
    if (lower.includes('validation')) typeSet.add('validation');
    if (lower.includes('error')) typeSet.add('error_handling');
    if (lower.includes('role') || lower.includes('permission')) typeSet.add('role_permission');
    if (lower.includes('data')) typeSet.add('data_variation');
    if (lower.includes('integration')) typeSet.add('integration');
  }

  const expectedSections = [
    /preconditions?:/i,
    /steps?:/i,
    /expected result/i,
    /\bAC\d+\b/i,
  ];

  let qualityHits = 0;
  for (const pattern of expectedSections) {
    if (pattern.test(text)) qualityHits += 1;
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let duplicateLines = 0;
  const seen = new Set();
  for (const line of lines) {
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      if (seen.has(line.toLowerCase())) duplicateLines += 1;
      else seen.add(line.toLowerCase());
    }
  }

  return {
    testCaseCount: tcMatches.length,
    acRefCount: acRefs.length,
    scenarioTypes: Array.from(typeSet),
    qualityHits,
    duplicateLines,
    lineCount: lines.length,
  };
}

function locateStorySpec(root, storyKey, linkedStorySpecPath) {
  if (linkedStorySpecPath) return linkedStorySpecPath;
  if (!storyKey) return null;
  const specsRoot = path.join(root, 'playwrightTests', 'specs');
  const candidates = listFilesRecursive(specsRoot, (f) => f.toLowerCase().endsWith('.md'));
  const token = String(storyKey).toLowerCase();
  const matched = candidates.filter((f) => f.toLowerCase().includes(token));
  if (!matched.length) return null;
  return matched[0];
}

function parseScripterArtifacts(root, storyKey, linkedSpecPath) {
  if (linkedSpecPath) {
    const text = readTextIfExists(linkedSpecPath);
    if (text) {
      let totalAssertions = 0;
      let meaningfulAssertions = 0;
      let directPageLocatorHits = 0;
      let waitsForbidden = 0;
      let fixtureImportsOk = 0;
      let pageObjectImports = 0;

      const assertions = text.match(/\bexpect\s*\(/g) || [];
      const webFirst = text.match(/\bto(BeVisible|HaveText|HaveCount|BeHidden|HaveURL|ContainText)\b/g) || [];
      const directLocators = text.match(/\bpage\.(getBy|locator\s*\()/g) || [];
      const forbiddenWaits = text.match(/waitForTimeout\s*\(|waitForSelector\s*\(/g) || [];

      totalAssertions += assertions.length;
      meaningfulAssertions += Math.max(webFirst.length, Math.min(assertions.length, webFirst.length));
      directPageLocatorHits += directLocators.length;
      waitsForbidden += forbiddenWaits.length;

      if (/from\s+['"]\.\.\/fixtures\/base['"]/m.test(text)) fixtureImportsOk += 1;
      if (/from\s+['"]\.\.\/pages\//m.test(text) || /new\s+\w+Page\s*\(/m.test(text)) pageObjectImports += 1;

      const reportJson = readJsonIfExists(path.join(root, 'playwrightTests', 'playwright-report', 'results.json'));
      let syntaxPass = null;
      if (reportJson && reportJson.stats) {
        const unexpected = Number(reportJson.stats.unexpected || 0);
        const expected = Number(reportJson.stats.expected || 0);
        const total = expected + unexpected;
        if (total > 0) syntaxPass = unexpected === 0 ? 100 : clamp100((expected / total) * 100);
      }

      return {
        filesAnalyzed: 1,
        totalAssertions,
        meaningfulAssertions,
        directPageLocatorHits,
        waitsForbidden,
        fixtureImportsOk,
        pageObjectImports,
        syntaxPass,
      };
    }
  }

  const testsRoot = path.join(root, 'playwrightTests', 'tests');
  const specs = listFilesRecursive(testsRoot, (f) => f.toLowerCase().endsWith('.spec.ts'));
  if (!specs.length) return null;

  const token = storyKey ? String(storyKey).toLowerCase() : '';
  const selected = token
    ? specs.filter((f) => f.toLowerCase().includes(token))
    : specs;
  const files = selected.length ? selected : specs;

  let totalAssertions = 0;
  let meaningfulAssertions = 0;
  let directPageLocatorHits = 0;
  let waitsForbidden = 0;
  let fixtureImportsOk = 0;
  let pageObjectImports = 0;
  let totalFiles = 0;

  for (const file of files) {
    const text = readTextIfExists(file);
    if (!text) continue;

    totalFiles += 1;

    const assertions = text.match(/\bexpect\s*\(/g) || [];
    const webFirst = text.match(/\bto(BeVisible|HaveText|HaveCount|BeHidden|HaveURL|ContainText)\b/g) || [];
    const directLocators = text.match(/\bpage\.(getBy|locator\s*\()/g) || [];
    const forbiddenWaits = text.match(/waitForTimeout\s*\(|waitForSelector\s*\(/g) || [];

    totalAssertions += assertions.length;
    meaningfulAssertions += Math.max(webFirst.length, Math.min(assertions.length, webFirst.length));
    directPageLocatorHits += directLocators.length;
    waitsForbidden += forbiddenWaits.length;

    if (/from\s+['"]\.\.\/fixtures\/base['"]/m.test(text)) fixtureImportsOk += 1;
    if (/from\s+['"]\.\.\/pages\//m.test(text) || /new\s+\w+Page\s*\(/m.test(text)) pageObjectImports += 1;
  }

  const reportJson = readJsonIfExists(path.join(root, 'playwrightTests', 'playwright-report', 'results.json'));
  let syntaxPass = null;
  if (reportJson && reportJson.stats) {
    const unexpected = Number(reportJson.stats.unexpected || 0);
    const expected = Number(reportJson.stats.expected || 0);
    const total = expected + unexpected;
    if (total > 0) syntaxPass = unexpected === 0 ? 100 : clamp100((expected / total) * 100);
  }

  return {
    filesAnalyzed: totalFiles,
    totalAssertions,
    meaningfulAssertions,
    directPageLocatorHits,
    waitsForbidden,
    fixtureImportsOk,
    pageObjectImports,
    syntaxPass,
  };
}

function parseHealerArtifacts(root, event, linkedFailureReportPath) {
  const message = String(event.message || '').toLowerCase();
  const reportJson = readJsonIfExists(linkedFailureReportPath || path.join(root, 'playwrightTests', 'playwright-report', 'results.json'));
  const lastRun = readJsonIfExists(path.join(root, 'test-results', '.last-run.json'));

  const classifiedKeywords = ['flake', 'flaky', 'deterministic', 'selector drift', 'regression', 'stale'];
  const classFound = classifiedKeywords.some((k) => message.includes(k));
  const reproFound = /repro|reproduce|rerun/.test(message);

  let regressionSafety = null;
  if (reportJson && reportJson.stats) {
    const unexpected = Number(reportJson.stats.unexpected || 0);
    const expected = Number(reportJson.stats.expected || 0);
    const total = expected + unexpected;
    if (total > 0) regressionSafety = unexpected === 0 ? 100 : clamp100((expected / total) * 100);
  }

  return {
    reproFound,
    classFound,
    message,
    lastRunStatus: lastRun && lastRun.status ? String(lastRun.status) : null,
    regressionSafety,
  };
}

function inferPlannerMetrics(event) {
  const verdict = extractVerdict(event.message);
  const success = event.status === 'success';
  const isBlocked = verdict === 'not-ready' || verdict === 'needs-clarification';
  const pass = success && verdict === 'ready';

  const acceptanceCoverage = pass ? 85 : isBlocked ? 24 : 40;
  const requirementCoverage = pass ? 88 : isBlocked ? 28 : 42;

  const storyClarityCoverage = pass ? 90 : isBlocked ? 35 : 55;

  return {
    acceptance_criteria_extraction_coverage: metric(acceptanceCoverage, { status: event.status, message: event.message || '', verdict }),
    requirement_testability_coverage: metric(requirementCoverage, { status: event.status, message: event.message || '', verdict }),
    story_clarity_coverage: metric(storyClarityCoverage, {
      status: event.status,
      message: event.message || '',
      verdict,
      note: 'Story clarity is derived from explicit blocking gaps and requirement testability in the Jira story itself.',
    }),
  };
}

function inferDesignerMetrics(event, ctx) {
  const linked = getLinkedArtifacts(event, ctx.root);
  const specPath = locateStorySpec(ctx.root, event.jira_story_key, linked.storySpecPath);
  if (!specPath) {
    const count = parseIntFromMessage(event.message);
    const success = event.status === 'success';
    const scenarioCount = Number.isFinite(count) ? count : 0;

    return {
      requirement_coverage: metric(success ? Math.min(100, 70 + scenarioCount * 3) : 35, { status: event.status, inferred_test_case_count: scenarioCount }),
      acceptance_criteria_coverage: metric(success ? Math.min(100, 72 + scenarioCount * 3) : 35, { status: event.status, inferred_test_case_count: scenarioCount }),
      scenario_type_coverage: metric(success ? Math.min(100, 60 + scenarioCount * 4) : 30, { status: event.status, inferred_test_case_count: scenarioCount }),
      test_case_quality_score: metric(success ? Math.min(100, 65 + scenarioCount * 4) : 30, { status: event.status, inferred_test_case_count: scenarioCount }),
      uniqueness_score: metric(success ? 92 : 40, { status: event.status, note: 'Duplicate detection corpus not integrated; using conservative default.' }),
    };
  }

  const content = readTextIfExists(specPath);
  if (!content) {
    return {
      requirement_coverage: nullMetric(REASON.ARTIFACT_NOT_FOUND, { spec_path: path.relative(ctx.root, specPath).replace(/\\/g, '/') }),
      acceptance_criteria_coverage: nullMetric(REASON.ARTIFACT_NOT_FOUND, { spec_path: path.relative(ctx.root, specPath).replace(/\\/g, '/') }),
      scenario_type_coverage: nullMetric(REASON.ARTIFACT_NOT_FOUND, { spec_path: path.relative(ctx.root, specPath).replace(/\\/g, '/') }),
      test_case_quality_score: nullMetric(REASON.ARTIFACT_NOT_FOUND, { spec_path: path.relative(ctx.root, specPath).replace(/\\/g, '/') }),
      uniqueness_score: nullMetric(REASON.ARTIFACT_NOT_FOUND, { spec_path: path.relative(ctx.root, specPath).replace(/\\/g, '/') }),
    };
  }

  const parsed = parseSpecMarkdown(content);
  const eventCount = parseIntFromMessage(event.message);
  const denominator = Number.isFinite(eventCount) && eventCount > 0 ? eventCount : parsed.testCaseCount;

  const reqCoverage = denominator > 0 ? clamp100((parsed.testCaseCount / denominator) * 100) : null;
  const acCoverage = parsed.testCaseCount > 0 ? clamp100((Math.min(parsed.acRefCount, parsed.testCaseCount) / parsed.testCaseCount) * 100) : null;

  const applicableTypes = ['positive', 'negative', 'boundary'];
  const coveredApplicable = applicableTypes.filter((t) => parsed.scenarioTypes.includes(t)).length;
  const scenarioCoverage = clamp100((coveredApplicable / applicableTypes.length) * 100);

  const qualityScore = clamp100((parsed.qualityHits / 4) * 100);

  // Duplicate heuristic from normalized bullet/step repetition.
  let uniqueness = 100;
  if (parsed.lineCount > 0) {
    const duplicateRate = clamp100((parsed.duplicateLines / parsed.lineCount) * 100);
    uniqueness = clamp100(100 - duplicateRate);
  }

  return {
    requirement_coverage: reqCoverage === null
      ? nullMetric(REASON.HISTORICAL_BASELINE_UNAVAILABLE, { spec_path: path.relative(ctx.root, specPath).replace(/\\/g, '/'), parsed_test_cases: parsed.testCaseCount, event_test_cases: eventCount })
      : metric(reqCoverage, { spec_path: path.relative(ctx.root, specPath).replace(/\\/g, '/'), parsed_test_cases: parsed.testCaseCount, event_test_cases: eventCount }),
    acceptance_criteria_coverage: acCoverage === null
      ? nullMetric(REASON.HISTORICAL_BASELINE_UNAVAILABLE, { spec_path: path.relative(ctx.root, specPath).replace(/\\/g, '/'), parsed_ac_refs: parsed.acRefCount })
      : metric(acCoverage, { spec_path: path.relative(ctx.root, specPath).replace(/\\/g, '/'), parsed_ac_refs: parsed.acRefCount }),
    scenario_type_coverage: metric(scenarioCoverage, { scenario_types_found: parsed.scenarioTypes }),
    test_case_quality_score: metric(qualityScore, { quality_hits: parsed.qualityHits, quality_checks: 4 }),
    uniqueness_score: metric(uniqueness, { duplicate_lines: parsed.duplicateLines, analyzed_lines: parsed.lineCount }),
  };
}

function inferScripterMetrics(event, ctx) {
  const linked = getLinkedArtifacts(event, ctx.root);
  const parsed = parseScripterArtifacts(ctx.root, event.jira_story_key, linked.playwrightSpecPath);
  const message = String(event.message || '').toLowerCase();
  const success = event.status === 'success';
  const passed = success && /playwright test passed|passed/.test(message);

  if (!parsed || parsed.filesAnalyzed === 0) {
    return {
      script_generation_success_rate: metric(success ? 100 : 40, { status: event.status, message: event.message || '' }),
      syntax_pass_rate: metric(passed ? 100 : success ? 80 : 35, { status: event.status, message: event.message || '' }),
      framework_compliance_score: metric(success ? 85 : 40, { status: event.status, note: 'No test spec artifact matched story; using event fallback.' }),
      assertion_quality_score: nullMetric(REASON.ARTIFACT_NOT_FOUND, { note: 'No matching Playwright spec artifacts found for this run.' }),
      reusability_score: nullMetric(REASON.ARTIFACT_NOT_FOUND, { note: 'No matching Playwright spec artifacts found for this run.' }),
    };
  }

  const assertionQuality = parsed.totalAssertions > 0
    ? clamp100((parsed.meaningfulAssertions / parsed.totalAssertions) * 100)
    : 0;

  const reusability = parsed.filesAnalyzed > 0
    ? clamp100((parsed.pageObjectImports / parsed.filesAnalyzed) * 100)
    : 0;

  const fixtureCompliance = parsed.filesAnalyzed > 0
    ? clamp100((parsed.fixtureImportsOk / parsed.filesAnalyzed) * 100)
    : 0;

  // Framework compliance blends fixture import, page-object pattern, and no forbidden waits.
  const pageObjectCompliance = parsed.filesAnalyzed > 0
    ? clamp100((parsed.pageObjectImports / parsed.filesAnalyzed) * 100)
    : 0;

  const forbiddenPenalty = Math.min(40, parsed.waitsForbidden * 10 + parsed.directPageLocatorHits * 2);
  const frameworkCompliance = clamp100((fixtureCompliance * 0.4) + (pageObjectCompliance * 0.6) - forbiddenPenalty);

  const syntaxScore = parsed.syntaxPass !== null
    ? parsed.syntaxPass
    : (passed ? 100 : success ? 80 : 35);

  return {
    script_generation_success_rate: metric(success ? 100 : 40, { status: event.status, files_analyzed: parsed.filesAnalyzed }),
    syntax_pass_rate: metric(syntaxScore, { report_based: parsed.syntaxPass !== null, results_json_score: parsed.syntaxPass }),
    framework_compliance_score: metric(frameworkCompliance, {
      fixture_import_compliance: fixtureCompliance,
      page_object_compliance: pageObjectCompliance,
      forbidden_wait_hits: parsed.waitsForbidden,
      direct_page_locator_hits: parsed.directPageLocatorHits,
    }),
    assertion_quality_score: metric(assertionQuality, { total_assertions: parsed.totalAssertions, meaningful_assertions: parsed.meaningfulAssertions }),
    reusability_score: metric(reusability, { files_with_page_objects: parsed.pageObjectImports, files_analyzed: parsed.filesAnalyzed }),
  };
}

function inferHealerMetrics(event, ctx) {
  const linked = getLinkedArtifacts(event, ctx.root);
  const details = parseHealerArtifacts(ctx.root, event, linked.failureReportPath);
  const success = event.status === 'success';
  const healed = /fixed|healed|pass|passed/.test(details.message);

  let falseHealingRate = 0;
  if (details.lastRunStatus === 'failed') {
    falseHealingRate = 25;
  } else if (success && healed) {
    falseHealingRate = 10;
  }

  return {
    failure_reproduction_rate: details.reproFound
      ? metric(100, { message: event.message || '' })
      : metric(success ? 70 : 35, { message: event.message || '', inferred: true }),
    healing_success_rate: metric(healed ? 95 : success ? 70 : 30, { status: event.status, message: event.message || '' }),
    regression_safety_score: details.regressionSafety !== null
      ? metric(details.regressionSafety, { source: 'playwright-report/results.json', last_run_status: details.lastRunStatus })
      : nullMetric(REASON.ARTIFACT_NOT_FOUND, { note: 'No Playwright report stats available to evaluate regression safety.' }),
    false_healing_rate: metric(falseHealingRate, {
      status: event.status,
      message: event.message || '',
      note: 'Computed from rerun safety signals when healing outcome is observable; otherwise kept conservative.',
    }),
  };
}

function inferOutcomeMetrics(event, ctx) {
  switch (event._skill) {
    case 'jira-story-readiness':
      return inferPlannerMetrics(event);
    case 'generate-test-scenarios':
      return inferDesignerMetrics(event, ctx);
    case 'generate-playwright-ui-script':
      return inferScripterMetrics(event, ctx);
    case 'analyze-playwright-failure':
      return inferHealerMetrics(event, ctx);
    default:
      return {};
  }
}

function computeWeightedScore(metricDefs, scoredByKey) {
  let totalWeight = 0;
  let activeWeight = 0;
  let weightedSum = 0;

  const metrics = metricDefs.map((def) => {
    const scored = scoredByKey[def.key] || nullMetric(REASON.NOT_APPLICABLE, { note: 'Metric not configured for this event.' });
    totalWeight += def.weight;

    if (scored.value === null) {
      return {
        key: def.key,
        label: def.label,
        weight: def.weight,
        value: null,
        reason_code: scored.reason_code || REASON.NOT_APPLICABLE,
        raw_inputs: scored.raw_inputs || {},
      };
    }

    activeWeight += def.weight;
    weightedSum += scored.value * def.weight;

    return {
      key: def.key,
      label: def.label,
      weight: def.weight,
      value: scored.value,
      raw_inputs: scored.raw_inputs || {},
    };
  });

  const missingWeight = Number((totalWeight - activeWeight).toFixed(4));
  const score = activeWeight > 0 ? weightedSum / activeWeight : null;

  return {
    metrics,
    score: score === null ? null : clamp100(score),
    activeWeight: Number(activeWeight.toFixed(4)),
    totalWeight: Number(totalWeight.toFixed(4)),
    missingWeight,
  };
}

function inferValidationPassRate(event, root) {
  if (event.status !== 'success') return metric(30, { status: event.status });

  if (event._skill === 'jira-story-readiness') {
    const verdict = extractVerdict(event.message);
    if (verdict === 'not-ready' || verdict === 'needs-clarification') {
      return metric(25, { status: event.status, verdict, message: event.message || '' });
    }
    if (verdict === 'ready') {
      return metric(100, { status: event.status, verdict, message: event.message || '' });
    }
  }

  // Prefer machine-readable Playwright results for scripting/healing paths.
  if (event._skill === 'generate-playwright-ui-script' || event._skill === 'analyze-playwright-failure') {
    const reportJson = readJsonIfExists(path.join(root, 'playwrightTests', 'playwright-report', 'results.json'));
    if (reportJson && reportJson.stats) {
      const expected = Number(reportJson.stats.expected || 0);
      const unexpected = Number(reportJson.stats.unexpected || 0);
      const total = expected + unexpected;
      if (total > 0) {
        return metric((expected / total) * 100, {
          source: 'playwright-report/results.json',
          expected,
          unexpected,
        });
      }
    }
  }

  const message = String(event.message || '').toLowerCase();
  if (/passed|ready|generated|scripted/.test(message)) return metric(100, { status: event.status, message: event.message || '' });
  return metric(80, { status: event.status, message: event.message || '' });
}

function confidenceBand(score) {
  if (score === null) return 'Not reliable';
  if (score >= 90) return 'High confidence';
  if (score >= 75) return 'Medium confidence';
  if (score >= 60) return 'Low confidence';
  return 'Not reliable';
}

function computeHistoricalAccuracy(historyScores) {
  if (!historyScores.length) {
    return nullMetric(REASON.HISTORICAL_BASELINE_UNAVAILABLE, { note: 'No historical completed runs for this agent yet.' });
  }
  const avg = historyScores.reduce((a, b) => a + b, 0) / historyScores.length;
  return metric(avg, { sample_size: historyScores.length });
}

function buildConfidenceFactors(event, outcomeInfo, historyScores, root) {
  const evidenceCompleteness = metric(
    outcomeInfo.totalWeight > 0 ? (outcomeInfo.activeWeight / outcomeInfo.totalWeight) * 100 : 0,
    {
      active_weight: outcomeInfo.activeWeight,
      total_weight: outcomeInfo.totalWeight,
      missing_weight: outcomeInfo.missingWeight,
    }
  );

  const validationPassRate = inferValidationPassRate(event, root);
  const historicalAccuracy = computeHistoricalAccuracy(historyScores);

  const defs = [
    { key: 'evidence_completeness', label: 'Evidence Completeness', weight: 0.4, scored: evidenceCompleteness },
    { key: 'validation_pass_rate', label: 'Validation Pass Rate', weight: 0.35, scored: validationPassRate },
    { key: 'historical_accuracy', label: 'Historical Accuracy', weight: 0.25, scored: historicalAccuracy },
  ];

  let totalWeight = 0;
  let activeWeight = 0;
  let weightedSum = 0;

  const factors = defs.map((f) => {
    totalWeight += f.weight;
    if (f.scored.value === null) {
      return {
        key: f.key,
        label: f.label,
        weight: f.weight,
        value: null,
        reason_code: f.scored.reason_code || REASON.NOT_APPLICABLE,
        raw_inputs: f.scored.raw_inputs || {},
      };
    }

    activeWeight += f.weight;
    weightedSum += f.scored.value * f.weight;
    return {
      key: f.key,
      label: f.label,
      weight: f.weight,
      value: f.scored.value,
      raw_inputs: f.scored.raw_inputs || {},
    };
  });

  let score = activeWeight > 0 ? weightedSum / activeWeight : null;

  // Evidence penalty when missing outcome metric weight exceeds 40%.
  if (score !== null && outcomeInfo.totalWeight > 0) {
    const missingRatio = outcomeInfo.missingWeight / outcomeInfo.totalWeight;
    if (missingRatio > 0.4) {
      score = Math.max(0, score - 10);
    }
  }

  return {
    factors,
    score: score === null ? null : clamp100(score),
    activeWeight: Number(activeWeight.toFixed(4)),
    totalWeight: Number(totalWeight.toFixed(4)),
  };
}

function reasonText(reasonCode) {
  switch (reasonCode) {
    case REASON.EXTERNAL_REVIEW_UNAVAILABLE:
      return 'external review was unavailable';
    case REASON.HISTORICAL_BASELINE_UNAVAILABLE:
      return 'a valid historical baseline was unavailable for this metric';
    case REASON.ARTIFACT_NOT_FOUND:
      return 'the required artifact could not be found';
    case REASON.NOT_APPLICABLE:
      return 'this metric was not applicable for this run';
    default:
      return 'the data needed for this metric was unavailable';
  }
}

function metricExplanation(metric, outcomeScore, confidenceScore) {
  if (!metric || typeof metric !== 'object') {
    return 'This metric could not be explained from the available evidence.';
  }

  if (metric.value === null) {
    const reason = metric.reason_code || REASON.NOT_APPLICABLE;
    return `This metric was not scored because ${reasonText(reason)}.`;
  }

  const threshold = metric.value >= 85 ? 'strong' : metric.value >= 70 ? 'moderate' : 'limited';
  return `This metric scored ${metric.value}/100 and contributed ${threshold} support to the overall outcome score of ${Math.round(outcomeScore || 0)}/100 and confidence score of ${Math.round(confidenceScore || 0)}/100.`;
}

function buildSummaryNarrative(event, outcomeScore, confidenceScore, outcomeInfo, metrics) {
  const missing = (metrics || []).filter((metric) => metric && metric.value === null);
  const missingMetricList = missing.map((metric) => metric.key || 'unknown_metric');
  const primaryReasonCode = missing.length ? (missing[0].reason_code || REASON.NOT_APPLICABLE) : REASON.NOT_APPLICABLE;

  let status = 'Strong result';
  if (outcomeScore === null || confidenceScore === null || outcomeInfo.missingWeight > 0.4) {
    status = 'Insufficient evidence';
  } else if (outcomeScore < 65 || confidenceScore < 60 || outcomeInfo.missingWeight > 0.2) {
    status = 'Partial result';
  } else if (outcomeScore < 85 || confidenceScore < 80) {
    status = 'Good overall result';
  }

  const skillLabel = event && event._skill ? event._skill.replace(/-/g, ' ') : 'agent run';
  const summaryBase = `${status}. The ${skillLabel} scored ${Number(outcomeScore ?? 0).toFixed(2)}/100 quality with ${Number(confidenceScore ?? 0).toFixed(2)}/100 confidence.`;

  if (status === 'Strong result') {
    const summaryLine = `${summaryBase} The evidence is solid and the validation checks passed.`;
    const detailSummary = 'This run is strong and well supported by evidence. The score and confidence are based on available validation and metric coverage.';
    const recommendation = 'Keep this as a reference example and continue monitoring trends over time.';
    const metricExplanations = (metrics || []).map((metric) => ({
      key: metric.key,
      label: metric.label,
      value: metric.value,
      reason_code: metric.reason_code || null,
      explanation: metricExplanation(metric, outcomeScore, confidenceScore),
    }));

    return {
      summary_line: summaryLine,
      detail_summary: detailSummary,
      recommendation,
      primary_reason_code: primaryReasonCode,
      missing_metric_list: missingMetricList,
      metric_explanations: metricExplanations,
    };
  }

  if (status === 'Good overall result') {
    const missingText = missing.length
      ? ` Some evidence is missing or less complete, including ${missingMetricList.slice(0, 3).join(', ')}${missingMetricList.length > 3 ? ' and more' : ''}.`
      : ' The output is usable, but some evidence is less complete than ideal.';
    const summaryLine = `${summaryBase}${missingText} The confidence is acceptable, but additional evidence would make the result more reliable.`;
    const detailSummary = missing.length
      ? `This run is usable but not fully complete. The main issue was ${reasonText(primaryReasonCode)}; this reduced the score and confidence. The missing metric(s) were ${missingMetricList.join(', ')}.`
      : 'This run is acceptable and generally supported by evidence. The score and confidence are based on available validation and metric coverage.';
    const recommendation = missing.length
      ? 'Add the missing baseline or artifact data and rerun scoring before using this result as a final decision signal.'
      : 'Review the output quality and add stronger evidence before using it as a final decision input.';
    const metricExplanations = (metrics || []).map((metric) => ({
      key: metric.key,
      label: metric.label,
      value: metric.value,
      reason_code: metric.reason_code || null,
      explanation: metricExplanation(metric, outcomeScore, confidenceScore),
    }));

    return {
      summary_line: summaryLine,
      detail_summary: detailSummary,
      recommendation,
      primary_reason_code: primaryReasonCode,
      missing_metric_list: missingMetricList,
      metric_explanations: metricExplanations,
    };
  }

  if (status === 'Partial result') {
    const missingText = missing.length
      ? ` Key evidence is missing, including ${missingMetricList.slice(0, 3).join(', ')}${missingMetricList.length > 3 ? ' and more' : ''}.`
      : ' The output was created, but validation quality was limited.';
    const summaryLine = `${summaryBase}${missingText} The output was created, but key evidence is missing or validation was limited.`;
    const detailSummary = missing.length
      ? `This run is only partially reliable. The main issue was ${reasonText(primaryReasonCode)}; this reduced the score and confidence. The missing metric(s) were ${missingMetricList.join(', ')}.`
      : 'This run was produced successfully, but the evidence did not fully support a higher confidence level.';
    const recommendation = 'Collect the missing evidence or rerun the workflow before relying on this score.';
    const metricExplanations = (metrics || []).map((metric) => ({
      key: metric.key,
      label: metric.label,
      value: metric.value,
      reason_code: metric.reason_code || null,
      explanation: metricExplanation(metric, outcomeScore, confidenceScore),
    }));

    return {
      summary_line: summaryLine,
      detail_summary: detailSummary,
      recommendation,
      primary_reason_code: primaryReasonCode,
      missing_metric_list: missingMetricList,
      metric_explanations: metricExplanations,
    };
  }

  const missingText = missing.length
    ? ` Key baseline or artifact data was unavailable, including ${missingMetricList.slice(0, 3).join(', ')}${missingMetricList.length > 3 ? ' and more' : ''}.`
    : ' Key baseline or artifact data was unavailable.';
  const summaryLine = `${summaryBase}${missingText} Insufficient evidence exists to treat this score as final.`;
  const detailSummary = missing.length
    ? `This run is not reliable enough for final decision-making. The main issue was ${reasonText(primaryReasonCode)}; this reduced the score and confidence. The missing metric(s) were ${missingMetricList.join(', ')}.`
    : 'This run does not have enough evidence to be treated as a final decision signal.';
  const recommendation = 'Gather the missing data before making decisions from this score.';
  const metricExplanations = (metrics || []).map((metric) => ({
    key: metric.key,
    label: metric.label,
    value: metric.value,
    reason_code: metric.reason_code || null,
    explanation: metricExplanation(metric, outcomeScore, confidenceScore),
  }));

  return {
    summary_line: summaryLine,
    detail_summary: detailSummary,
    recommendation,
    primary_reason_code: primaryReasonCode,
    missing_metric_list: missingMetricList,
    metric_explanations: metricExplanations,
  };
}

function buildEvidenceEvent(event, model, priorOutcomeScores, ctx) {
  const inferred = inferOutcomeMetrics(event, ctx);
  const outcome = computeWeightedScore(model.metrics, inferred);
  const confidence = buildConfidenceFactors(event, outcome, priorOutcomeScores, ctx.root);
  const narrative = buildSummaryNarrative(event, outcome.score, confidence.score, outcome, outcome.metrics);

  return {
    score_event_version: OUTPUT_VERSION,
    generated_at: new Date().toISOString(),
    source_event: {
      event_id: event.event_id || null,
      correlation_id: event.correlation_id || null,
      jira_story_key: event.jira_story_key || null,
      skill: event._skill,
      actor_name: (event.actor && event.actor.actor_name) || model.agent,
      actor_id: (event.actor && event.actor.actor_id) || model.actorId,
      status: event.status || null,
      event_timestamp: event.event_timestamp || null,
      workflow_stage: event.workflow_stage || null,
      message: event.message || '',
      source_file: path.relative(ctx.root, event._filePath).replace(/\\/g, '/'),
    },
    metric_version: OUTPUT_VERSION,
    outcome_score: outcome.score,
    confidence_score: confidence.score,
    confidence_band: confidenceBand(confidence.score),
    summary_line: narrative.summary_line,
    detail_summary: narrative.detail_summary,
    recommendation: narrative.recommendation,
    primary_reason_code: narrative.primary_reason_code,
    missing_metric_list: narrative.missing_metric_list,
    metric_explanations: narrative.metric_explanations,
    outcome_weights: {
      active_weight: outcome.activeWeight,
      total_weight: outcome.totalWeight,
      missing_weight: outcome.missingWeight,
    },
    metrics: outcome.metrics,
    confidence_factors: confidence.factors,
  };
}

function assertEvidenceShape(ev) {
  const required = [
    ['score_event_version', ev.score_event_version],
    ['source_event.event_id', ev.source_event && ev.source_event.event_id],
    ['source_event.skill', ev.source_event && ev.source_event.skill],
    ['source_event.event_timestamp', ev.source_event && ev.source_event.event_timestamp],
    ['metric_version', ev.metric_version],
    ['confidence_band', ev.confidence_band],
    ['summary_line', ev.summary_line],
    ['detail_summary', ev.detail_summary],
    ['recommendation', ev.recommendation],
    ['primary_reason_code', ev.primary_reason_code],
    ['missing_metric_list', Array.isArray(ev.missing_metric_list)],
    ['metric_explanations', Array.isArray(ev.metric_explanations)],
    ['metrics', Array.isArray(ev.metrics)],
    ['confidence_factors', Array.isArray(ev.confidence_factors)],
  ];

  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Malformed evidence payload: ${missing.join(', ')}`);
}

function outputFileName(event) {
  const stamp = String(event.event_timestamp || '').replace(/[:.]/g, '-');
  const eventId = String(event.event_id || 'no-event').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${stamp}_${event._skill}_${eventId}.score.json`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const events = loadCompletionEvents(root);

  if (!events.length) {
    process.stdout.write('No completion events found in audit/agent-actions. Nothing generated.\n');
    return;
  }

  const historyByActor = new Map();
  const outputs = [];
  const ctx = { root };

  for (const event of events) {
    const model = OUTCOME_MODELS[event._skill];
    if (!model) continue;

    const actorId = (event.actor && event.actor.actor_id) || model.actorId;
    const history = historyByActor.get(actorId) || [];
    const prior = history.slice(-args.historyWindow);

    const evidence = buildEvidenceEvent(event, model, prior, ctx);
    assertEvidenceShape(evidence);

    outputs.push({ event, evidence });

    if (evidence.outcome_score !== null) {
      history.push(evidence.outcome_score);
      historyByActor.set(actorId, history);
    }
  }

  if (!outputs.length) {
    process.stdout.write('No supported skill events found for scoring. Nothing generated.\n');
    return;
  }

  if (!args.dryRun) fs.mkdirSync(args.outDir, { recursive: true });

  for (const row of outputs) {
    const fileName = outputFileName(row.event);
    const outPath = path.join(args.outDir, fileName);
    const json = JSON.stringify(row.evidence, null, 2);

    if (!args.dryRun) fs.writeFileSync(outPath, json, 'utf-8');
  }

  process.stdout.write(
    `${args.dryRun ? 'Dry-run:' : 'Generated:'} ${outputs.length} score evidence file(s) ${args.dryRun ? '(no files written)' : `in ${path.relative(root, args.outDir)}`} .\n`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`generate-agent-quality-evidence.js: ${err.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  extractVerdict,
  parseSpecMarkdown,
  locateStorySpec,
  parseScripterArtifacts,
  parseHealerArtifacts,
  inferPlannerMetrics,
  inferDesignerMetrics,
  inferScripterMetrics,
  inferHealerMetrics,
  getLinkedArtifacts,
};
