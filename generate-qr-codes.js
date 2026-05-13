#!/usr/bin/env node

/**
 * Generate QR codes for Zito APK files
 * Usage: node generate-qr-codes.js
 */

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const apps = [
  {
    name: 'Zito Customer',
    file: 'Zito-Customer-v1.0.0.apk',
    packageId: 'com.aurenza.zito.customer',
    url: 'https://storage.googleapis.com/zito-apks/Zito-Customer-v1.0.0.apk',
    description: 'Customer logistics app',
  },
  {
    name: 'Zito Partner',
    file: 'Zito-Partner-v1.0.0.apk',
    packageId: 'com.aurenza.zito.partner',
    url: 'https://storage.googleapis.com/zito-apks/Zito-Partner-v1.0.0.apk',
    description: 'Partner/driver app',
  },
  {
    name: 'Zito Admin',
    file: 'Zito-Admin-v1.0.0.apk',
    packageId: 'com.aurenza.zito.admin',
    url: 'https://storage.googleapis.com/zito-apks/Zito-Admin-v1.0.0.apk',
    description: 'Admin control panel',
  },
];

const outputDir = path.join(__dirname, 'QR_CODES');

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`✓ Created directory: ${outputDir}`);
}

// Generate QR codes
(async () => {
  console.log('\n🔲 Generating QR Codes for Zito APKs...\n');

  for (const app of apps) {
    try {
      const filename = path.join(outputDir, `${app.packageId}.png`);

      // Generate QR code for download URL
      await QRCode.toFile(filename, app.url, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      console.log(`✓ ${app.name}`);
      console.log(`  File: ${filename}`);
      console.log(`  Size: 300x300 px`);
      console.log(`  Package: ${app.packageId}`);
      console.log(`  URL: ${app.url}\n`);
    } catch (error) {
      console.error(`✗ Error generating QR for ${app.name}:`, error.message);
    }
  }

  // Generate HTML viewer
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zito Mobile Apps - QR Codes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      text-align: center;
      color: white;
      margin-bottom: 60px;
    }
    header h1 {
      font-size: 3em;
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    header p {
      font-size: 1.2em;
      opacity: 0.9;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 40px;
      margin-bottom: 60px;
    }
    .card {
      background: white;
      border-radius: 15px;
      padding: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      transition: transform 0.3s, box-shadow 0.3s;
      text-align: center;
    }
    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 15px 40px rgba(0,0,0,0.4);
    }
    .card-icon {
      font-size: 3em;
      margin-bottom: 20px;
    }
    .card h2 {
      color: #333;
      margin-bottom: 10px;
      font-size: 1.5em;
    }
    .card p {
      color: #666;
      margin-bottom: 20px;
      font-size: 0.95em;
    }
    .qr-code {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 10px;
      margin: 20px 0;
    }
    .qr-code img {
      width: 250px;
      height: 250px;
      border: 3px solid #ddd;
      border-radius: 8px;
    }
    .package-id {
      background: #f0f0f0;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 0.85em;
      color: #333;
      word-break: break-all;
      margin: 15px 0;
    }
    .instructions {
      background: white;
      border-radius: 15px;
      padding: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      margin-top: 60px;
    }
    .instructions h2 {
      color: #333;
      margin-bottom: 20px;
      font-size: 1.8em;
    }
    .instructions ol {
      margin-left: 20px;
      color: #555;
      line-height: 1.8;
    }
    .instructions li {
      margin-bottom: 15px;
    }
    .download-btn {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      text-decoration: none;
      margin-top: 10px;
      transition: background 0.3s;
    }
    .download-btn:hover {
      background: #764ba2;
    }
    .footer {
      text-align: center;
      color: white;
      margin-top: 60px;
      font-size: 0.9em;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📱 Zito Mobile Apps</h1>
      <p>Scan QR codes to download testing APKs</p>
    </header>

    <div class="grid">
      <div class="card">
        <div class="card-icon">👥</div>
        <h2>Zito Customer</h2>
        <p>Logistics Service App</p>
        <div class="qr-code">
          <img src="com.aurenza.zito.customer.png" alt="Zito Customer QR Code">
        </div>
        <div class="package-id">com.aurenza.zito.customer</div>
        <p style="font-size: 0.85em; color: #999;">File: Zito-Customer-v1.0.0.apk (88 MB)</p>
      </div>

      <div class="card">
        <div class="card-icon">🚗</div>
        <h2>Zito Partner</h2>
        <p>Driver & Agent App</p>
        <div class="qr-code">
          <img src="com.aurenza.zito.partner.png" alt="Zito Partner QR Code">
        </div>
        <div class="package-id">com.aurenza.zito.partner</div>
        <p style="font-size: 0.85em; color: #999;">File: Zito-Partner-v1.0.0.apk (88 MB)</p>
      </div>

      <div class="card">
        <div class="card-icon">⚙️</div>
        <h2>Zito Admin</h2>
        <p>Control Panel & Dashboard</p>
        <div class="qr-code">
          <img src="com.aurenza.zito.admin.png" alt="Zito Admin QR Code">
        </div>
        <div class="package-id">com.aurenza.zito.admin</div>
        <p style="font-size: 0.85em; color: #999;">File: Zito-Admin-v1.0.0.apk (88 MB)</p>
      </div>
    </div>

    <div class="instructions">
      <h2>📥 Installation Instructions</h2>
      <ol>
        <li><strong>Open your phone camera app</strong> and point it at any QR code above</li>
        <li><strong>Tap the notification</strong> or link that appears (it will open a download link)</li>
        <li><strong>Download the APK file</strong> to your phone</li>
        <li><strong>Open the APK file</strong> from your Downloads folder</li>
        <li><strong>Tap "Install"</strong> when prompted (you may need to enable unknown sources)</li>
        <li><strong>Launch the app</strong> and log in with test credentials</li>
      </ol>
    </div>

    <div class="footer">
      <p>Zito v1.0.0 • Built with Expo • May 12, 2026</p>
      <p>For technical support, see APK_INSTALLATION_GUIDE.md</p>
    </div>
  </div>
</body>
</html>`;

  const htmlPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`✓ Generated interactive HTML viewer: ${htmlPath}`);
  console.log(`\n📂 Open in browser: file:///${htmlPath.replace(/\\\\/g, '/')}`);
  console.log(`\n✅ QR Code generation complete!`);
})();
