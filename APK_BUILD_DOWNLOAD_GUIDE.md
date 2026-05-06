# 🚀 QUICK GUIDE: Build & Download 3 APKs

## ⏱️ Total Time: ~20 minutes

---

## **STEP 1: Open Terminal**

```powershell
# Navigate to mobile app
cd c:\Users\Abcom\Desktop\Zito\zito-mobile
```

---

## **STEP 2: Login to EAS (First Time Only)**

```bash
npm run eas:login
```

- Opens browser → Sign in with Expo account
- Returns to terminal when done

---

## **STEP 3: Build All 3 APKs** ⚡

```bash
npm run build:all-preview
```

**What happens:**
- Starts building Zito Customer app (~5-7 min)
- Then builds Zito Partner app (~5-7 min)
- Then builds Zito Admin app (~5-7 min)
- Total: ~15-20 minutes

**Console shows:**
```
✓ Building zito-customer...
✓ Build successful! ID: abc123...
✓ Building zito-partner...
✓ Build successful! ID: def456...
✓ Building zito-admin...
✓ Build successful! ID: ghi789...
```

**Keep terminal open!** Don't close it.

---

## **STEP 4: Download APKs from Expo Dashboard**

### **Method A: Easy (Recommended)**

1. **Open:** https://expo.dev
2. **Login** with your Expo account
3. **Find project:** "zito" 
4. **Click:** "Builds" tab
5. **You'll see 3 builds:**
   - `zito-customer-1.0.0` ← Click to open
   - `zito-partner-1.0.0`  ← Click to open
   - `zito-admin-1.0.0`    ← Click to open

6. **For each build:**
   - Click **"Build Details"**
   - Scroll down → **"Download"** button
   - Select **"APK"** format
   - Save to `Downloads` folder

**Files saved:**
```
C:\Users\Abcom\Downloads\
├── zito-customer-1.0.0.apk
├── zito-partner-1.0.0.apk
└── zito-admin-1.0.0.apk
```

### **Method B: Terminal**

```bash
eas build:list
# Shows all builds with IDs

eas build:download --id abc123...  # Download specific build
```

---

## **STEP 5: Install on Android Phone**

### **Option 1: USB + ADB (Fastest)**

```bash
# Connect phone via USB
# Enable Developer Mode on phone

# Install all 3 at once:
adb install C:\Users\Abcom\Downloads\zito-customer-1.0.0.apk
adb install C:\Users\Abcom\Downloads\zito-partner-1.0.0.apk
adb install C:\Users\Abcom\Downloads\zito-admin-1.0.0.apk

# Verify:
adb shell pm list packages | findstr "com.aurenza.zito"
# Output should show all 3 packages
```

### **Option 2: Manual (No USB needed)**

1. Copy APK files to phone storage (USB or cloud)
2. Open **Files** app on phone
3. Tap each APK → **Install**
4. Grant permissions
5. Done!

### **Option 3: QR Code from Expo**

1. On Expo dashboard, each build has a QR code
2. Scan with phone camera
3. Opens Expo app → Tap **"Install"**
4. APK auto-downloads & installs

---

## **STEP 6: Verify Installation ✅**

**All 3 apps on home screen:**

| App | Package | Icon Color |
|-----|---------|-----------|
| **Zito Logistics** | com.aurenza.zito.customer | Blue |
| **Zito Partners** | com.aurenza.zito.partner | Orange |
| **Zito Operations** | com.aurenza.zito.admin | Purple |

**Launch each app:**
- Zito Logistics → Login as **Customer** role
- Zito Partners → Login as **Driver/Transporter** role
- Zito Operations → Login as **Admin** role

---

## **STEP 7: Update Apps (Without Rebuilding)**

Made code changes? Push instant updates:

```bash
npm run customer:update    # Update Customer app only
npm run partner:update     # Update Partner app only
npm run admin:update       # Update Admin app only
npm run update:all         # Update all 3 apps
```

**On user's phone:**
1. Force-close the app
2. Reopen it
3. See "Checking for updates..." briefly
4. Update downloads & installs automatically ✨

---

## **TROUBLESHOOTING**

### ❌ Build Failed?
```bash
npm run doctor          # Check for issues
npm install             # Reinstall dependencies
npm run build:all-preview  # Try again
```

### ❌ APK Won't Install?
```bash
# Uninstall old version first
adb uninstall com.aurenza.zito.customer

# Reinstall
adb install C:\Users\Abcom\Downloads\zito-customer-1.0.0.apk
```

### ❌ Can't Find EAS Builds?
```bash
npm run eas:login  # Login to Expo
# Then go to https://expo.dev
```

### ❌ Phone Permission Issues?
- Go to **Settings** → **Apps** → **Unknown Sources** → Enable
- Or scan QR code instead of manual USB install

---

## **WHAT'S IN EACH APP**

### 📦 **Zito Logistics** (Blue)
- Book shipments
- Track deliveries  
- Upload proof of delivery
- Pay for services
- View invoices

### 🚗 **Zito Partners** (Orange)
- Accept delivery jobs
- Track active trips
- Confirm delivery with OTP
- Earn money
- Manage fleet

### ⚙️ **Zito Operations** (Purple)
- Platform dashboard
- Manage users & approvals
- View analytics
- Handle compliance
- Internal staff only

---

## **NEXT STEPS**

✅ Build complete:
```
npm run build:all-preview
```

✅ Download from:
```
https://expo.dev → Builds tab
```

✅ Install on phone:
```
adb install zito-customer-1.0.0.apk
adb install zito-partner-1.0.0.apk
adb install zito-admin-1.0.0.apk
```

✅ Test all 3 apps with different roles

✅ Push updates without rebuilding:
```
npm run update:all
```

---

## 📊 **Useful Links**

- **EAS Dashboard:** https://expo.dev
- **Build Logs:** https://expo.dev → Project → Builds → [App Name]
- **Documentation:** https://docs.expo.dev/eas/introduction

---

**Built with ❤️ by Aurenza Limited**
**Updated: May 6, 2026**
