// Read-only Jira REST API v3 client — CLI entrypoint for skills/agents that need Jira data
// without going through Atlassian MCP tools.
//
// Why this exists instead of MCP: this repo's PII scan/redact hooks (pretool-jira-guard.js /
// posttool-jira-guard.js) only match Jira/Atlassian MCP tool names, and depending on the hook
// system's reliability in a given environment, PostToolUse isn't guaranteed to fire for every
// Jira fetch (see .github/instructions/jira-access.instructions.md for the rationale this
// script exists to sidestep). This script does its own PII redaction in-process instead of
// depending on a hook firing after the fact.
//
// Read-only by design: only GET /issue and GET /search are implemented. There is deliberately
// no create/edit/transition call here — copilot-instructions.md's governing rule that this
// project's agents must never create a Jira issue directly holds by omission, not by hook-deny.
//
// Usage:
//   node .github/scripts/jira-read.js issue <ISSUE_KEY> <field1,field2,...>
//   node .github/scripts/jira-read.js search "<JQL>" <field1,field2,...>
//
// Required env vars (never hardcode these): JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
'use strict';

const fs = require('fs');
const path = require('path');
const { scanText, redactText } = require('../pii-ocr/pii-scanner');

function writeAuditLog(entry) {
  try {
    const dir = path.join(process.cwd(), 'audit', 'pii-scan-results');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(dir, `${stamp}_jira-read_${entry.command}.json`), JSON.stringify(entry, null, 2), 'utf-8');
  } catch (err) {
    process.stderr.write(`jira-read.js: failed to write audit log: ${err.message}\n`);
  }
}

function redactAndLog(command, rawText) {
  const { hasPII, matches } = scanText(rawText);
  if (!hasPII) return rawText;

  const { redactedText, redactionMap } = redactText(rawText, matches);
  writeAuditLog({
    timestamp: new Date().toISOString(),
    command,
    matchCounts: matches.reduce((acc, m) => ((acc[m.type] = (acc[m.type] || 0) + 1), acc), {}),
    redactionMap, // placeholder -> original value, human-lookup only, never printed to stdout
  });
  return redactedText;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env var ${name}. Set it in your own shell — never paste the value into chat.`);
  }
  return value;
}

async function jiraFetch(urlPath) {
  const baseUrl = requireEnv('JIRA_BASE_URL').replace(/\/+$/, '');
  const email = requireEnv('JIRA_EMAIL');
  const token = requireEnv('JIRA_API_TOKEN');
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  const res = await fetch(`${baseUrl}${urlPath}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Jira API returned ${res.status} ${res.statusText}\n${redactAndLog('error', bodyText)}`);
  }
  return bodyText;
}

function parseFields(fieldsArg) {
  if (!fieldsArg) {
    throw new Error('fields argument is required (e.g. summary,description) — never omit it, the API default field set includes reporter/assignee emails.');
  }
  return fieldsArg.split(',').map((f) => f.trim()).filter(Boolean);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (command === 'issue') {
    const [issueKey, fieldsArg] = rest;
    if (!issueKey) {
      throw new Error('Usage: node jira-read.js issue <ISSUE_KEY> <field1,field2,...>');
    }
    const fields = parseFields(fieldsArg);
    const bodyText = await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=${encodeURIComponent(fields.join(','))}`);
    process.stdout.write(redactAndLog('issue', bodyText) + '\n');
    return;
  }

  if (command === 'search') {
    const [jql, fieldsArg] = rest;
    if (!jql) {
      throw new Error('Usage: node jira-read.js search "<JQL>" <field1,field2,...>');
    }
    const fields = parseFields(fieldsArg);
    // /rest/api/3/search was removed by Atlassian (410 Gone) in favor of /search/jql — see
    // https://developer.atlassian.com/changelog/#CHANGE-2046
    const bodyText = await jiraFetch(`/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(fields.join(','))}`);
    process.stdout.write(redactAndLog('search', bodyText) + '\n');
    return;
  }

  throw new Error('Usage:\n  node jira-read.js issue <ISSUE_KEY> <field1,field2,...>\n  node jira-read.js search "<JQL>" <field1,field2,...>');
}

main().catch((err) => {
  process.stderr.write(`jira-read.js: ${err.message}\n`);
  process.exitCode = 1;
});
