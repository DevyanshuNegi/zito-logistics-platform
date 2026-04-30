import { existsSync } from 'fs';
import { resolve } from 'path';

export const BRAND = {
  appName: 'Zito',
  companyName: 'Aurenza Limited',
  appTagline: 'Smarter. Faster. Reliable.',
  companyTagline: 'Connecting possibilities. Delivering value.',
  issuerLine: 'Issued by Aurenza Limited via the Zito platform',
} as const;

export function resolveBrandAsset(fileName: string) {
  const absolutePath = resolve(process.cwd(), 'assets', 'branding', fileName);
  return existsSync(absolutePath) ? absolutePath : null;
}
