const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

module.exports = async () => {
  const rootDir = path.resolve(__dirname, '..');
  const jsonPath = path.join(__dirname, 'playwright-report', 'results.json');

  if (!fs.existsSync(jsonPath)) {
    console.log(`KPI teardown skipped: no Playwright JSON report found at ${path.relative(rootDir, jsonPath)}`);
    return;
  }

  const scriptPath = path.join(rootDir, '.github', 'scripts', 'generate-kpi-report.js');
  const result = spawnSync(process.execPath, [scriptPath, '--playwright-json', jsonPath], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`KPI report generation failed with exit code ${result.status}`);
  }

  const htmlScriptPath = path.join(rootDir, '.github', 'scripts', 'generate-test-execution-report.js');
  const htmlResult = spawnSync(process.execPath, [htmlScriptPath], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  if (htmlResult.error) {
    throw htmlResult.error;
  }

  if (htmlResult.status !== 0) {
    throw new Error(`HTML report generation failed with exit code ${htmlResult.status}`);
  }
};
