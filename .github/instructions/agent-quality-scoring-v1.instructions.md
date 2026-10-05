---
description: "Scoring contract v1 for Planner, Designer, Scripter, and Healer outcome/confidence calculation."
---

# Agent Quality Scoring Contract v1

## Scope
- Applies to local scoring artifacts and reports generated from audit logs.


## Score Bands
- 90 to 100: High confidence
- 75 to 89: Medium confidence
- 60 to 74: Low confidence
- Below 60: Not reliable

## Outcome Metric Formulas
All metric scores are normalized to a 0-100 scale.

This scoring contract intentionally includes only metrics that are directly measurable from real story, spec, run, or report artifacts. Metrics that require an undisclosed baseline, manual labeling, or unobservable ground truth are excluded.

### Planner Agent
- Acceptance Criteria Extraction Coverage = (correct_ac_extracted / total_ac_in_story) * 100
- Requirement Testability Coverage = (testable_requirements / total_requirements) * 100
- Story Clarity Coverage = (requirements_without_blocking_gaps / total_requirements) * 100

Planner Outcome Score =
- Acceptance Criteria Extraction Coverage * 0.45
- Requirement Testability Coverage * 0.35
- Story Clarity Coverage * 0.20

### Designer Agent
- Requirement Coverage = (requirements_covered / total_testable_requirements) * 100
- Acceptance Criteria Coverage = (ac_covered / total_ac) * 100
- Scenario Type Coverage = (scenario_types_covered / applicable_scenario_types) * 100
- Test Case Quality Score = average(quality_attributes)
- Duplicate Test Rate = (duplicate_cases / total_generated_cases) * 100
- Uniqueness Score = 100 - Duplicate Test Rate

Designer Outcome Score =
- Requirement Coverage * 0.25
- Acceptance Criteria Coverage * 0.25
- Scenario Type Coverage * 0.20
- Test Case Quality Score * 0.20
- Uniqueness Score * 0.10

### Scripter Agent
- Script Generation Success Rate = (scripts_generated_successfully / selected_cases) * 100
- Syntax Pass Rate = (scripts_pass_syntax / scripts_generated) * 100
- Framework Compliance Score = (framework_rules_passed / total_framework_rules) * 100
- Assertion Quality Score = (meaningful_assertions / expected_assertions) * 100
- Reusability Score = (reusable_components_used / applicable_reusable_components) * 100

Scripter Outcome Score =
- Script Generation Success Rate * 0.20
- Syntax Pass Rate * 0.20
- Framework Compliance Score * 0.20
- Assertion Quality Score * 0.25
- Reusability Score * 0.15

### Healer Agent
- Failure Reproduction Rate = (failures_reproduced / total_failed_tests_analyzed) * 100
- Healing Success Rate = (healed_pass_dry_run / healing_attempts) * 100
- Regression Safety Score = (healed_not_breaking_existing / total_healed_scripts) * 100
- False Healing Rate = (incorrect_healings / total_healing_suggestions) * 100

Healer Outcome Score =
- Failure Reproduction Rate * 0.20
- Healing Success Rate * 0.35
- Regression Safety Score * 0.30
- (100 - False Healing Rate) * 0.15

## Excluded KPI policy
The following metrics are intentionally excluded from the official scoring contract because they cannot be measured reliably without a hidden ground truth or manual labeling step:
- Ambiguity Detection Rate
- Failure Classification Accuracy
- Inverse False Healing Rate
- Any metric whose denominator is not observable from a story, script, run, or report artifact

## Confidence Formula
Confidence Score =
- Evidence Completeness * 0.40
- Validation Pass Rate * 0.35
- Historical Accuracy * 0.25

## Missing Evidence Policy
- If a metric cannot be measured, store:
  - value: null
  - reason_code: one of:
    - EXTERNAL_REVIEW_UNAVAILABLE
    - HISTORICAL_BASELINE_UNAVAILABLE
    - ARTIFACT_NOT_FOUND
    - NOT_APPLICABLE
- Use HISTORICAL_BASELINE_UNAVAILABLE only when the metric depends on prior run history and no valid historical baseline exists yet.
- Metrics with null values are excluded from weighted denominator.
- If excluded weights exceed 40 percent of total metric weight, confidence receives an evidence penalty.

## Required Evidence Fields Per Run
- event_id
- correlation_id
- jira_story_key
- skill
- actor_name
- actor_id
- event_timestamp
- metric_version
- outcome_score
- confidence_score
- confidence_band
- metrics[] with raw inputs, computed value, weight, and reason_code if null
- confidence_factors[] with raw inputs, computed value, weight, and reason_code if null
