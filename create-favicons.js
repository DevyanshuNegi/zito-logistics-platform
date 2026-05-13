#!/usr/bin/env node
/**
 * Favicon Generator - Creates favicon sizes from zito-app-icon.png
 * Uses native Node.js or available image libraries
 */

const fs = require('fs');
const path = require('path');

// Try to load sharp if available
let sharp;
try {
  // First try local installation
  sharp = require(path.join(__dirname, 'frontend', 'node_modules', 'sharp'));
  console.log('✓ Using sharp for image processing');
} catch (e) {
  try {
    // Then try global
    sharp = require('sharp');
    console.log('✓ Using sharp for image processing');
  } catch (err) {
    console.error('✗ sharp not found. Please run:');
    console.error('  cd frontend && npm install sharp --no-save');
    process.exit(1);
  }
}

async function createFavicons() {
  const sourceIcon = path.join(__dirname, 'frontend', 'public', 'zito-app-icon.png');
  const targetDir = path.join(__dirname, 'frontend', 'public');
  const backendDir = path.join(__dirname, 'backend', 'assets', 'branding');

  if (!fs.existsSync(sourceIcon)) {
    console.error(`✗ Source file not found: ${sourceIcon}`);
    process.exit(1);
  }

  console.log('🎨 Creating favicon sizes from zito-app-icon.png...\n');

  const sizes = {
    48: 'favicon-48.png',
    96: 'favicon-96.png',
    192: 'favicon-192.png',
    256: 'favicon-256.png',
    512: 'favicon-512.png',
  };

  try {
    for (const [size, filename] of Object.entries(sizes)) {
      // Frontend
      const frontendPath = path.join(targetDir, filename);
      await sharp(sourceIcon)
        .resize(parseInt(size), parseInt(size), {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(frontendPath);

      console.log(`✓ Created ${filename} (${size}x${size})`);

      // Backend
      const backendPath = path.join(backendDir, filename);
      if (fs.existsSync(backendDir)) {
        await sharp(sourceIcon)
          .resize(parseInt(size), parseInt(size), {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png()
          .toFile(backendPath);
        console.log(`  ↳ Also saved to backend/assets/branding/`);
      }
    }

    // Create favicon.ico
    const faviconPath = path.join(targetDir, 'favicon.ico');
    await sharp(sourceIcon)
      .resize(48, 48)
      .toFile(faviconPath);
    console.log(`\n✓ Created favicon.ico (48x48)`);

    console.log('\n✅ All favicons created successfully!');
  } catch (err) {
    console.error('✗ Error creating favicons:', err.message);
    process.exit(1);
  }
}

createFavicons();
