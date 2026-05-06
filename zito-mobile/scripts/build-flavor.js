#!/usr/bin/env node

/**
 * Build helper script for multi-flavor Expo app
 * Temporarily swaps app.json to build specific flavor
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const flavor = process.argv[2];
const profile = process.argv[3] || 'preview';

if (!flavor) {
  console.error('Usage: node build-flavor.js <customer|partner|admin> [profile]');
  process.exit(1);
}

// Get the root directory (parent of scripts/)
const appDir = path.resolve(__dirname, '..');
const appJsonPath = path.join(appDir, 'app.json');
const flavorJsonPath = path.join(appDir, `app-${flavor}.json`);
const backupJsonPath = path.join(appDir, 'app.json.backup');

console.log(`\n📱 Building ${flavor} app (${profile} profile)...\n`);

try {
  // Backup original app.json
  if (fs.existsSync(appJsonPath)) {
    fs.copyFileSync(appJsonPath, backupJsonPath);
    console.log('✓ Backed up app.json');
  }

  // Swap in flavor-specific config
  if (!fs.existsSync(flavorJsonPath)) {
    throw new Error(`Flavor config not found: ${flavorJsonPath}`);
  }
  
  fs.copyFileSync(flavorJsonPath, appJsonPath);
  console.log(`✓ Loaded ${flavor} configuration`);

  // Run EAS build
  const buildCmd = `eas build --platform android --profile ${flavor}-${profile}`;
  console.log(`\n$ ${buildCmd}\n`);
  
  try {
    execSync(buildCmd, { stdio: 'inherit', cwd: appDir });
    console.log(`\n✅ Build complete for ${flavor} app\n`);
  } catch (error) {
    console.error(`\n❌ Build failed for ${flavor} app\n`);
    throw error;
  }

} catch (error) {
  console.error(`\n❌ Error: ${error.message}\n`);
  process.exit(1);

} finally {
  // Restore original app.json
  if (fs.existsSync(backupJsonPath)) {
    fs.copyFileSync(backupJsonPath, appJsonPath);
    fs.unlinkSync(backupJsonPath);
    console.log('✓ Restored original app.json');
  }
}
