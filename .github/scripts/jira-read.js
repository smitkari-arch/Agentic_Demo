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
const { spawnSync } = require('child_process');
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
    redactionMap,
  });
  return redactedText;
}

function ensureNodeSystemCa(env = process.env) {
  if (process.platform !== 'win32') return env;

  const current = String(env.NODE_OPTIONS || '').trim();
  const parts = current ? current.split(/\s+/).filter(Boolean) : [];
  if (parts.includes('--use-system-ca')) {
    return env;
  }

  return {
    ...env,
    NODE_OPTIONS: [...parts, '--use-system-ca'].join(' '),
  };
}

function restartWithSystemCaIfNeeded() {
  if (process.platform !== 'win32') return;
  if (process.env.JIRA_READ_REEXEC === '1') return;

  const nextEnv = ensureNodeSystemCa(process.env);
  if (nextEnv.NODE_OPTIONS === (process.env.NODE_OPTIONS || '')) return;

  const childEnv = {
    ...process.env,
    ...nextEnv,
    JIRA_READ_REEXEC: '1',
  };

  const child = spawnSync(process.execPath, process.argv.slice(1), {
    env: childEnv,
    stdio: 'inherit',
  });

  process.exit(child.status ?? 0);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env var ${name}. Set it in your own shell — never paste the value into chat.`);
  }
  return value;
}

function explainJiraFetchFailure(error) {
  const message = String(error && (error.message || error));
  if (!/(fetch failed|self[- ]signed|CERT|certificate|ERR_TLS|ECONNRESET|EAI_AGAIN|ENOTFOUND)/i.test(message)) {
    return null;
  }

  const suggestions = [
    'Jira fetch failed. Check the local environment before retrying:',
    '1) Verify JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN are all set in the current shell.',
    '2) In Windows/corporate proxy environments, Node often needs the system CA store: $env:NODE_OPTIONS="--use-system-ca"',
    '3) To persist this for future shells: [Environment]::SetEnvironmentVariable("NODE_OPTIONS","--use-system-ca","User")',
    '4) Never disable TLS validation globally with NODE_TLS_REJECT_UNAUTHORIZED=0 for a permanent fix.',
    `Original error: ${message}`,
  ];
  return suggestions.join('\n');
}

restartWithSystemCaIfNeeded();

async function jiraFetch(urlPath) {
  const baseUrl = requireEnv('JIRA_BASE_URL').replace(/\/+$/, '');
  const email = requireEnv('JIRA_EMAIL');
  const token = requireEnv('JIRA_API_TOKEN');
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  try {
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
  } catch (error) {
    const hint = explainJiraFetchFailure(error);
    if (hint) {
      throw new Error(`${hint}\n${error && error.stack ? error.stack : ''}`.trim());
    }
    throw error;
  }
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
    const bodyText = await jiraFetch(`/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(fields.join(','))}`);
    process.stdout.write(redactAndLog('search', bodyText) + '\n');
    return;
  }

  throw new Error('Usage:\n  node jira-read.js issue <ISSUE_KEY> <field1,field2,...>\n  node jira-read.js search "<JQL>" <field1,field2,...>');
}

module.exports = {
  ensureNodeSystemCa,
  restartWithSystemCaIfNeeded,
  redactAndLog,
  requireEnv,
  parseFields,
  jiraFetch,
  main,
};

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`jira-read.js: ${err.message}\n`);
    process.exitCode = 1;
  });
}
