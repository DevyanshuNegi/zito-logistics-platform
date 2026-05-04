import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const [distDir, command, ...args] = process.argv.slice(2);

if (!distDir || !command) {
  console.error('Usage: node scripts/run-next.mjs <distDir> <command> [...args]');
  process.exit(1);
}

const nextBin = require.resolve('next/dist/bin/next');

const child = spawn(process.execPath, [nextBin, command, ...args], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ZITO_NEXT_DIST_DIR: distDir,
  },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
