---
description: "Use whenever fetching or searching Jira issues - the canonical read-only access pattern via .github/scripts/jira-read.js, required env vars, and when raw curl is still needed (binary attachment downloads only)."
---

# Jira Access

Do not rely on a Jira MCP tool for text fetches. Fetch Jira data via [`.github/scripts/jira-read.js`](../scripts/jira-read.js) — a read-only Jira REST API v3 CLI that does its own PII redaction in-process before printing anything, rather than depending on a hook firing afterward. This is the canonical, guaranteed-redaction path — prefer it over raw `curl` or an MCP tool call for every text fetch (issue reads, JQL searches).

```
node .github/scripts/jira-read.js issue <ISSUE_KEY> <field1,field2,...>
node .github/scripts/jira-read.js search "<JQL>" <field1,field2,...>
```

Example:
```
node .github/scripts/jira-read.js issue PERF-2820 summary,description,issuetype,status
node .github/scripts/jira-read.js search "project=PROJ AND status=\"To Do\"" summary,description
```

`fields` is required on every call — never omit it, since a default field set often includes `reporter`/`assignee` and would carry real email addresses into model context. Only widen it beyond what's needed for the task at hand.

`JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` must come from environment variables — never hardcode the Atlassian site URL, username, or API token in a command, script, or config file. The script itself throws if any of the three is unset; don't guess a value to work around that.

## Why `jira-read.js` over raw `curl` or a hook-dependent path

Raw `curl` piped through a `PostToolUse` PII hook is a fragile pattern if that hook can intermittently fail to fire — a harness-level reliability concern, not something fixable by editing hook code alone. `jira-read.js` sidesteps the problem entirely: it fetches via Node's own `fetch()` (no hook dependency at all) and redacts PII **in the same process, before printing anything to stdout** — redaction is guaranteed by construction, not by a hook that may or may not run. It also writes its own audit entry to `audit/pii-scan-results/` (tagged `jira-read_<command>`) every time, same redaction-map format as the hooks.

## When raw `curl` is still needed

`jira-read.js` only covers `GET /issue` and `GET /search` — text/JSON responses. It has no binary-download support, so one thing still requires raw `curl`:

### Never redirect a text-response curl call's output to a file — let it print to stdout

If you do need raw `curl` for a text/JSON response (rare now that `jira-read.js` exists), always let the response body print to stdout. **Never** add `-o <file>`, `--output <file>`, or shell redirection (`> file`), even for a large response — narrow `fields` instead. Redirecting bypasses any output-scanning hook entirely (it only scans stdout), so a redirected raw-curl text fetch has no reliable redaction path at all. Prefer `jira-read.js` over this pattern.

### Exception: downloading a binary attachment (e.g. an image) *does* require `-o <file>`

Binary content can't meaningfully print to a text-oriented stdout, so attachment downloads are a deliberate, narrow exception — this is the one legitimate remaining use of raw `curl` in this folder's Jira workflows:

```
curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  "<attachment content URL, from the issue's attachment field>" \
  -o "<scratchpad path>/<filename>"
```

PII/secrets that might appear as *visible text inside the image itself* aren't covered by any hook or by `jira-read.js` — see the `jira-story-readiness` skill's attachment-handling step and [.github/pii-ocr/README.md](../pii-ocr/README.md) for how that gap is handled instead (an explicit, non-hook step inside the skill's own turn, not automatic).

> Note: if a TLS certificate-revocation-check error occurs on raw `curl` calls on a given machine (a local Schannel/corporate-proxy quirk, not specific to this repo), a `--ssl-no-revoke`-style flag may be needed for that one call only — it doesn't weaken any other TLS verification and shouldn't be applied by default.
