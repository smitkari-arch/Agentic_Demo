'use strict';

const fs = require('fs');
const path = require('path');

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

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || '').trim();
    });
    return row;
  });
}

function buildTemplate(rows) {
  const normalized = rows.map((row) => ({
    ...row,
    Total: Number(row.Total || 0),
    Passed: Number(row.Passed || 0),
    Failed: Number(row.Failed || 0),
    Skipped: Number(row.Skipped || 0),
    DurationSec: Number(row.DurationSec || 0),
  }));

  const totalRuns = normalized.length;
  const totalTests = normalized.reduce((sum, row) => sum + row.Total, 0);
  const totalPassed = normalized.reduce((sum, row) => sum + row.Passed, 0);
  const totalFailed = normalized.reduce((sum, row) => sum + row.Failed, 0);
  const totalSkipped = normalized.reduce((sum, row) => sum + row.Skipped, 0);
  const avgDuration = normalized.length
    ? (normalized.reduce((sum, row) => sum + row.DurationSec, 0) / normalized.length).toFixed(2)
    : '0.00';
  const passRate = totalTests ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';
  const failureRate = totalTests ? ((totalFailed / totalTests) * 100).toFixed(1) : '0.0';
  const latestRun = normalized[normalized.length - 1] || null;

  const newestFirst = [...normalized].reverse();

  const trendItems = newestFirst.map((row) => {
    const total = row.Total || 1;
    const passWidth = (row.Passed / total) * 100;
    const failWidth = (row.Failed / total) * 100;
    return `
      <div class="trend-item">
        <div class="time">${new Date(row.Timestamp).toLocaleString()}</div>
        <div>
          <div class="progress">
            <div class="progress-bar pass" style="width: ${passWidth}%;"></div>
            <div class="progress-bar fail" style="width: ${failWidth}%; margin-top: -12px;"></div>
          </div>
        </div>
        <div class="count">${row.Passed}/${row.Total}</div>
      </div>
    `;
  }).join('');

  const historyRows = newestFirst.map((row) => {
    const statusClass = row.Failed > 0 ? 'status-fail' : 'status-pass';
    const statusText = row.Failed > 0 ? 'Failing' : 'Passing';
    return `
      <tr>
        <td>${new Date(row.Timestamp).toLocaleString()}</td>
        <td>${row.Suite}</td>
        <td>${row.Total}</td>
        <td>${row.Passed}</td>
        <td>${row.Failed}</td>
        <td>${row.Skipped}</td>
        <td>${row.DurationSec}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      </tr>
    `;
  }).join('');

  const latestStatus = latestRun && latestRun.Failed > 0 ? 'Failing' : 'Passing';
  const latestSummary = latestRun
    ? `${latestRun.Passed}/${latestRun.Total} passed in ${latestRun.DurationSec}s`
    : 'No execution rows available';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Test Execution Report</title>
    <style>
      :root {
        --bg: #f4f7fb;
        --card: #ffffff;
        --text: #18212f;
        --muted: #5d6b82;
        --line: #dfe7f3;
        --primary: #2563eb;
        --success: #16a34a;
        --warning: #f59e0b;
        --danger: #dc2626;
        --shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      .container {
        max-width: 1200px;
        margin: 32px auto;
        padding: 0 20px 40px;
      }
      .header {
        background: linear-gradient(135deg, #0f172a, #1d4ed8);
        color: white;
        padding: 28px 32px;
        border-radius: 18px;
        box-shadow: var(--shadow);
        margin-bottom: 24px;
      }
      .header h1 { margin: 0; font-size: clamp(1.8rem, 2vw, 2.6rem); }
      .header p { margin: 10px 0 0; opacity: 0.9; }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 18px;
        margin-bottom: 24px;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 14px;
        box-shadow: var(--shadow);
        padding: 18px 20px;
      }
      .metric-label {
        font-size: 0.8rem;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .metric-value {
        margin-top: 12px;
        font-size: clamp(1.6rem, 2vw, 2.3rem);
        font-weight: 700;
      }
      .metric-sub { margin-top: 8px; font-size: 0.92rem; color: var(--muted); }
      .success { color: var(--success); }
      .danger { color: var(--danger); }
      .primary { color: var(--primary); }
      .warning { color: var(--warning); }
      .section {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
        box-shadow: var(--shadow);
        padding: 24px;
        margin-top: 20px;
      }
      .section h2 { margin: 0 0 18px; font-size: 1.2rem; }
      .trend-list { display: grid; gap: 16px; }
      .trend-item {
        display: grid;
        grid-template-columns: 120px 1fr 70px;
        align-items: center;
        gap: 12px;
      }
      .trend-item .time { color: var(--muted); font-size: 0.9rem; }
      .progress {
        position: relative;
        background: #edf2fb;
        border-radius: 999px;
        height: 12px;
        overflow: hidden;
      }
      .progress-bar { height: 100%; border-radius: 999px; }
      .pass { background: linear-gradient(90deg, var(--success), #4ade80); }
      .fail { background: linear-gradient(90deg, var(--danger), #f87171); }
      .count { text-align: right; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td {
        padding: 12px 10px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        font-size: 0.96rem;
      }
      th {
        color: var(--muted);
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .status-badge {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        font-weight: 600;
        font-size: 0.8rem;
      }
      .status-pass { background: rgba(22, 163, 74, 0.12); color: var(--success); }
      .status-fail { background: rgba(220, 38, 38, 0.12); color: var(--danger); }
      @media (max-width: 760px) {
        .trend-item { grid-template-columns: 1fr; }
        .trend-item .time, .count { text-align: left; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <header class="header">
        <h1>Test Execution Report</h1>
        <p>Quality summary for automated regression runs</p>
      </header>

      <section class="summary-grid">
        <div class="card">
          <div class="metric-label">Total runs</div>
          <div class="metric-value primary">${totalRuns}</div>
          <div class="metric-sub">Execution snapshots</div>
        </div>
        <div class="card">
          <div class="metric-label">Passed</div>
          <div class="metric-value success">${totalPassed}</div>
          <div class="metric-sub">${passRate}% pass rate</div>
        </div>
        <div class="card">
          <div class="metric-label">Failed</div>
          <div class="metric-value danger">${totalFailed}</div>
          <div class="metric-sub">${failureRate}% fail rate</div>
        </div>
        <div class="card">
          <div class="metric-label">Avg duration</div>
          <div class="metric-value warning">${avgDuration}s</div>
          <div class="metric-sub">Per run average</div>
        </div>
      </section>

      <section class="section">
        <h2>Recent trend</h2>
        <div class="trend-list">${trendItems || '<p>No recent runs available.</p>'}</div>
      </section>

      <section class="section">
        <h2>Execution history</h2>
        <div style="margin-bottom: 12px; color: var(--muted);">Latest run: ${latestStatus} — ${latestSummary}</div>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Suite</th>
              <th>Total</th>
              <th>Passed</th>
              <th>Failed</th>
              <th>Skipped</th>
              <th>Duration (s)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${historyRows || '<tr><td colspan="8">No rows available.</td></tr>'}</tbody>
        </table>
      </section>
    </div>
  </body>
</html>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(__dirname, '..', '..');
  const csvPath = path.resolve(rootDir, args.csv || 'reports/kpi-report.csv');
  const outputPath = path.resolve(rootDir, args.output || 'reports/test-execution-report.html');

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV report not found at ${path.relative(rootDir, csvPath)}`);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf-8'));
  const html = buildTemplate(rows);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf-8');

  console.log(`Generated ${path.relative(rootDir, outputPath)} from ${path.relative(rootDir, csvPath)} with ${rows.length} run(s).`);
}

try {
  main();
} catch (error) {
  console.error(`generate-test-execution-report.js: ${error.message}`);
  process.exitCode = 1;
}
