const assert = require('node:assert/strict');
const { extractStoryTestCases } = require('./story-case-resolver');

const markdown = `# KAN-8: Register a new customer

## Test Cases

### TC-01: Registration form is displayed from the home page
- AC: AC1
- Type: Positive

### TC-02: Successful registration with valid details
- AC: AC2
- Type: Positive

### TC-03: Registration is blocked when a required field is blank
- AC: AC3
- Type: Negative

### TC-04: Registration is blocked when passwords do not match
- AC: AC3
- Type: Negative

### TC-05: Registration is blocked when the email already has an account
- AC: AC4
- Type: Negative
`;

const cases = extractStoryTestCases(markdown);
assert.equal(cases.length, 5, 'Expected all five story cases to be discovered');
assert.deepEqual(cases.map((c) => c.id), ['TC-01', 'TC-02', 'TC-03', 'TC-04', 'TC-05']);
console.log(`Validated ${cases.length} cases from story markdown.`);
