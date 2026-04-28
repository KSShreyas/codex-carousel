import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const flowsDir = '.maestro/flows';
if (!fs.existsSync(flowsDir)) {
  console.error('No Maestro flows directory found at .maestro/flows');
  process.exit(1);
}

const check = spawnSync('node', ['scripts/maestro-check.mjs'], { stdio: 'inherit' });
if (check.status !== 0) process.exit(check.status ?? 1);

const run = spawnSync('maestro', ['test', flowsDir], { stdio: 'inherit' });
process.exit(run.status ?? 1);
