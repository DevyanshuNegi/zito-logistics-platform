import { rm } from 'node:fs/promises';

const [distDir] = process.argv.slice(2);

if (!distDir) {
  console.error('Usage: node scripts/clean-next-dist.mjs <distDir>');
  process.exit(1);
}

await rm(distDir, { force: true, recursive: true });
