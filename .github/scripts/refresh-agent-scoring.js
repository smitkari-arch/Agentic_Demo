// Runs the post-log scoring/report refresh flow in one command.
'use strict';

const { spawnSync } = require('child_process');

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const standalone = argv.includes('--standalone');

  const reportArgs = ['.github/scripts/generate-agent-execution-report.js'];
  if (standalone) reportArgs.push('--standalone');

  run('node', reportArgs);
  run('node', ['.github/scripts/generate-agent-quality-evidence.js']);
  run('node', ['.github/scripts/validate-agent-quality-evidence.js']);
  run('node', ['.github/scripts/generate-agent-quality-report.js']);

  process.stdout.write('Agent scoring refresh completed.\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(`refresh-agent-scoring.js: ${err.message}\n`);
  process.exitCode = 1;
}
