'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const moduleApi = require('../jira-read.js');

test('jira-read exports a reusable Node CA bootstrap helper', () => {
  assert.equal(typeof moduleApi.ensureNodeSystemCa, 'function');
  const env = {};
  const nextEnv = moduleApi.ensureNodeSystemCa(env);
  assert.equal(nextEnv.NODE_OPTIONS, '--use-system-ca');
});
