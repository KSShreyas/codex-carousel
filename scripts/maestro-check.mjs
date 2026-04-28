import { spawnSync } from 'node:child_process';

const probe = spawnSync('maestro', ['--version'], { encoding: 'utf-8' });
if (probe.status === 0) {
  console.log(`Maestro CLI detected: ${probe.stdout.trim() || probe.stderr.trim()}`);
  process.exit(0);
}

console.error('Maestro CLI is not installed or not on PATH.');
console.error('Install:');
console.error('  macOS/Linux: curl -fsSL "https://get.maestro.mobile.dev" | bash');
console.error('  Windows: https://maestro.mobile.dev/getting-started/installing-maestro/windows');
process.exit(1);
