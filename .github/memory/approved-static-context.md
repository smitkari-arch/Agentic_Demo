# Approved static context

Human-approved, standing context for this repo. This document is the shared project memory that agents may use without re-deriving it each run.

## 1. Business purpose

- Product name:
- Business goal:
- Target users:
- Primary user journeys:
- Key success metrics:
- Business risk if the feature fails:

## 2. Product and domain context

### Product overview
- Summary of the application and its primary function.
- What problem it solves for the end user.
- What business value it provides.

### Core workflows
1. Workflow name
   - Trigger
   - User role
   - Expected outcome
   - Key validation points

2. Workflow name
   - Trigger
   - User role
   - Expected outcome
   - Key validation points

### Business rules
- Rule 1:
- Rule 2:
- Rule 3:
- Regulatory / compliance constraints:
- Data sensitivity / privacy constraints:

## 3. User roles and access model

- Admin
- Standard user
- Guest
- External user
- System role

### Role-based access patterns
- Which roles can create, edit, view, or delete data
- Which actions are restricted
- Which flows require approval / confirmation

## 4. Application architecture overview

- Frontend:
- Backend/API:
- Auth model:
- Data sources:
- Integration points:
- External dependencies:
- Environments:
  - Local
  - QA
  - Staging
  - Production

## 5. Functional boundaries and constraints

- Supported browsers:
- Supported devices:
- Known limitations:
- Out-of-scope items:

## 6. Validation and UX standards

- Required user messaging patterns
- Acceptable error states
- Success-state behavior
- Empty-state behavior
- Required confirmation dialogs
- Data validation rules
- Default values and business defaults

## 7. Domain glossary

- term: meaning
- term: meaning
- term: meaning

## 8. Data model notes

- Core business entities:
- Key fields and constraints:
- Unique identifiers:
- Status values:
- Valid transitions:
- Example values:
- Test data requirements:

## 9. Test environment guidance

- Base URL(s):
- Test credentials policy:
- Public demo credentials allowed? yes/no
- Data setup requirements:
- Clean-up requirements:
- Known flaky elements or scenarios:
- Known environment-specific dependencies:

## 10. Known failure patterns

- Common selector drift patterns
- Known stale-data issues
- Reusable validation texts
- UI states that often cause false negatives
- Historical defects that repeat by workflow

## 11. Agent usage guidance

### Planner Agent
Use this context to assess:
- whether the story is testable
- whether acceptance criteria are business-complete
- whether risk and dependencies are clear

### Designer Agent
Use this context to generate:
- scenario coverage by user journey
- positive, negative, and boundary test cases
- regression-focused scenarios

### Scripter Agent
Use this context to generate:
- robust Playwright flows
- correct assertion logic
- environment-aware selectors and waits
- page-object conventions consistent with the repo

### Healer Agent
Use this context to:
- classify failure type accurately
- distinguish flaky vs deterministic issues
- avoid unnecessary test weakening
- validate whether the fix is a true recovery or a regression

## 12. Approval log

- Approved by:
- Date:
- Change summary:
- Review notes: