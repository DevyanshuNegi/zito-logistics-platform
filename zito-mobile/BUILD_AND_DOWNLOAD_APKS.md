# 📦 Building & Downloading 3 Separate APKs

## 🚀 Step-by-Step: Create 3 APKs

### **Step 1: Navigate to Mobile App**
```bash
cd c:\Users\Abcom\Desktop\Zito\zito-mobile
```

### **Step 2: Login to EAS (First Time Only)**
```bash
npm run eas:login
```
- Opens browser to Expo login
- Use your Expo account credentials
- Returns to terminal once authenticated

### **Step 3: Build All 3 APKs Simultaneously** ⚡

```bash
npm run build:all-preview
```

This builds:
- ✅ `Zito Customer` APK
- ✅ `Zito Partner` APK  
- ✅ `Zito Admin` APK

**Build time:** ~15-20 minutes total for all 3

Or build individually:
```bash
npm run customer:preview    # Customer app only (5-7 min)
npm run partner:preview     # Partner app only (5-7 min)
npm run admin:preview       # Admin app only (5-7 min)
```

---

## 📥 Step 4: Download APKs from EAS Dashboard

### **Option A: Download from Web Dashboard** (Easiest)

1. Go to: https://expo.dev
2. Login with your Expo account
3. Find **Project:** "zito" (ID: 9a3a10da-3cf5-4dba-bca8-07187831b78b)
4. Click **"Builds"** tab
5. You'll see 3 builds:
   - `zito-customer-1.0.0` 
   - `zito-partner-1.0.0`
   - `zito-admin-1.0.0`

6. For each build:
   - Click the build name
   - Click **"Download"** button
   - Choose **APK** format
   - Save to your computer

**Files downloaded:**
```
Downloads/
├── zito-customer-1.0.0.apk    (~85 MB)
├── zito-partner-1.0.0.apk     (~85 MB)
└── zito-admin-1.0.0.apk       (~85 MB)
```

### **Option B: Download via Terminal** (Advanced)

```bash
# List all builds
eas build:list

# Download specific build (copy build ID from list)
eas build:download --id <build-id>
```

---

## 📱 Step 5: Install APKs on Android Phone

### **Method 1: ADB (Recommended)**

```bash
# Connect phone via USB (enable Developer Mode)

# Install all 3
adb install zito-customer-1.0.0.apk
adb install zito-partner-1.0.0.apk
adb install zito-admin-1.0.0.apk

# Verify installation
adb shell pm list packages | findstr "com.aurenza.zito"
```

**Output should show:**
```
package:com.aurenza.zito.customer
package:com.aurenza.zito.partner
package:com.aurenza.zito.admin
```

### **Method 2: Manual Installation**

1. Copy APK files to phone via USB
2. Open Files app on phone
3. Tap each APK → Install
4. Grant permissions when prompted
5. Tap "Open" to launch

### **Method 3: Scan QR Code from EAS Dashboard**

On EAS dashboard, each build shows a QR code:
1. Scan with phone camera
2. Opens Expo app
3. Tap "Install" 
4. APK downloads and installs automatically

---

## ✅ Verify Installation

All 3 apps should appear on your home screen:

| App | Icon | Package | Color |
|-----|------|---------|-------|
| **Zito Customer** | Blue logo | com.aurenza.zito.customer | Blue (#0066FF) |
| **Zito Partner** | Orange logo | com.aurenza.zito.partner | Orange (#FF9500) |
| **Zito Admin** | Purple logo | com.aurenza.zito.admin | Purple (#9C27B0) |

---

## 🔄 Update Without Rebuilding

Made code changes? Push updates to installed apps instantly:

```bash
npm run customer:update    # Update just Customer app
npm run partner:update     # Update just Partner app
npm run admin:update       # Update just Admin app
npm run update:all         # Update all 3 apps
```

Users just restart their app and it auto-updates! ✨

---

## 📊 Build Status & History

Check EAS dashboard to see:
- ✅ Build status (success/failed)
- 📅 Build dates & times
- 📝 Build logs & error messages
- 🔗 Download links & QR codes

---

## ⚠️ Troubleshooting

### **Build Failed?**
```bash
npm run doctor          # Diagnose issues
npx eas-cli diagnostics # Full EAS diagnostic
```

### **APK Won't Install?**
```bash
# Uninstall old version first
adb uninstall com.aurenza.zito.customer

# Then reinstall
adb install zito-customer-1.0.0.apk
```

### **Wrong Version Installed?**
```bash
# Check installed version
adb shell dumpsys package com.aurenza.zito.customer | grep version

# Reinstall with -r flag (replace)
adb install -r zito-customer-1.0.0.apk
```

### **Need Older Build?**
Visit https://expo.dev → Builds tab → Select previous build

---

## 🎯 Next Steps

1. **Build APKs:**
   ```bash
   npm run build:all-preview
   ```

2. **Monitor EAS Dashboard:**
   - https://expo.dev
   - Wait for all 3 builds to complete (green checkmark)

3. **Download APKs:**
   - Click each build
   - Click "Download"
   - Select APK format

4. **Install on Phone:**
   ```bash
   adb install zito-customer-1.0.0.apk
   adb install zito-partner-1.0.0.apk
   adb install zito-admin-1.0.0.apk
   ```

5. **Test All 3 Apps:**
   - Launch each app
   - Login with different user roles
   - Verify correct portal opens

---

## 📞 EAS Support

- **Dashboard:** https://expo.dev
- **Docs:** https://docs.expo.dev/eas/introduction
- **Community:** https://forums.expo.dev

Built with ❤️ by Aurenza Limited
