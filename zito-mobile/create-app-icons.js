#!/usr/bin/env node
/**
 * Create clean, bold app icons for Zito mobile apps
 * Using simple geometric "Z" shapes with brand colors
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets', 'images');

// Icon configurations
const apps = {
  customer: {
    name: 'Customer',
    color: '#0066FF', // Blue
    textColor: '#FFFFFF',
  },
  partner: {
    name: 'Partner',
    color: '#FF9500', // Orange
    textColor: '#FFFFFF',
  },
  admin: {
    name: 'Admin',
    color: '#9C27B0', // Purple
    textColor: '#FFFFFF',
  },
};

/**
 * Create Android adaptive icon foreground (centered icon with safe zone)
 * Safe zone: 540x540 (center) of 1080x1080
 */
function createForegroundIcon(color, size = 1080) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  // Draw bold "Z" shape (filling the safe zone center)
  const padding = size * 0.1; // 10% padding
  const x = padding;
  const y = padding;
  const w = size - 2 * padding;
  const h = size - 2 * padding;
  const strokeWidth = w * 0.12; // Thick strokes

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw "Z" shape as filled path
  

  // Top horizontal line
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);

  // Diagonal middle line
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);

  ctx.stroke();

  // Fill strokes with slight thickness using multiple strokes
  ctx.lineWidth = strokeWidth * 0.8;
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

/**
 * Create Android adaptive icon background (solid color)
 */
function createBackgroundIcon(color, size = 1080) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  return canvas.toBuffer('image/png');
}

/**
 * Create monochrome icon (for accessibility)
 */
function createMonochromeIcon(size = 1080) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  // Draw white "Z" shape
  const padding = size * 0.1;
  const x = padding;
  const y = padding;
  const w = size - 2 * padding;
  const h = size - 2 * padding;
  const strokeWidth = w * 0.12;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);

  ctx.stroke();
  ctx.lineWidth = strokeWidth * 0.8;
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

/**
 * Create regular app icon (108x108 minimum, usually 192x192 or 512x512)
 */
function createRegularIcon(color, size = 512) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Solid background
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  // Draw white "Z" shape
  const padding = size * 0.08;
  const x = padding;
  const y = padding;
  const w = size - 2 * padding;
  const h = size - 2 * padding;
  const strokeWidth = w * 0.12;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);

  ctx.stroke();
  ctx.lineWidth = strokeWidth * 0.8;
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

// Generate icons for each app
console.log('🎨 Creating clean app icons for Zito apps...\n');

Object.entries(apps).forEach(([appKey, config]) => {
  console.log(`📱 ${config.name} App (${config.color})`);

  // Create android-icon-{app}-foreground.png (1080x1080)
  const foreground = createForegroundIcon(config.color, 1080);
  const foregroundPath = path.join(assetsDir, `android-icon-${appKey}-foreground.png`);
  fs.writeFileSync(foregroundPath, foreground);
  console.log(`  ✓ ${foregroundPath}`);

  // Create icon-{app}.png (512x512 regular app icon)
  const regular = createRegularIcon(config.color, 512);
  const regularPath = path.join(assetsDir, `icon-${appKey}.png`);
  fs.writeFileSync(regularPath, regular);
  console.log(`  ✓ ${regularPath}`);
});

// Create shared background and monochrome (same for all)
console.log('\n🎨 Creating shared icon components...');

// Background (solid dark color)
const background = createBackgroundIcon('#050914', 1080);
const backgroundPath = path.join(assetsDir, 'android-icon-background.png');
fs.writeFileSync(backgroundPath, background);
console.log(`  ✓ ${backgroundPath}`);

// Monochrome (white Z for accessibility)
const monochrome = createMonochromeIcon(1080);
const monochromePath = path.join(assetsDir, 'android-icon-monochrome.png');
fs.writeFileSync(monochromePath, monochrome);
console.log(`  ✓ ${monochromePath}`);

console.log('\n✅ Clean app icons created successfully!');
console.log('   - Bold, recognizable "Z" shapes');
console.log('   - Brand colors: Blue, Orange, Purple');
console.log('   - Android adaptive icon compatible');
console.log('   - Visible at all sizes');
