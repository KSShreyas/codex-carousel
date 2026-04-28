import { spawn } from 'child_process';

const proc = spawn('npx', ['tsx', 'scripts/capture-ui-screenshots.ts'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

proc.on('exit', (code) => {
  process.exit(code ?? 1);
});
