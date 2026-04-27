import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

async function waitForHealth(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch('http://127.0.0.1:3000/api/health');
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Dev server did not become healthy in time.');
}

const server = spawn('npm', ['run', 'dev'], { stdio: 'pipe', shell: true, env: process.env });
let serverOutput = '';
server.stdout.on('data', (d) => { serverOutput += d.toString(); });
server.stderr.on('data', (d) => { serverOutput += d.toString(); });

try {
  await waitForHealth();

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('Playwright is not installed. Run `npm i -D playwright` and `npx playwright install chromium`.');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
  await fs.mkdir('docs', { recursive: true });
  await page.screenshot({ path: path.join('docs', 'current-ui.png'), fullPage: true });
  await browser.close();
  console.log('Saved screenshot to docs/current-ui.png');
} catch (error) {
  console.error('Screenshot generation failed:', error instanceof Error ? error.message : String(error));
  console.error('Server output:\n', serverOutput.slice(-1200));
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
}
