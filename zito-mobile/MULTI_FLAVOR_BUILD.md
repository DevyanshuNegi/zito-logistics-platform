# 🚀 Zito Multi-Flavor Mobile Apps

**3 Separate Apps** — Customer, Partner, Admin (like Uber, DoorDash, etc.)

---

## 📱 The 3 Apps

| App | Package Name | Bundle ID | Target Users | Deep Link |
|-----|--------------|-----------|--------------|-----------|
| **Zito Customer** | `com.aurenza.zito.customer` | `com.aurenza.zito.customer` | End customers booking shipments | `zito-customer://` |
| **Zito Partner** | `com.aurenza.zito.partner` | `com.aurenza.zito.partner` | Drivers, Transporters, Couriers, Warehouses | `zito-partner://` |
| **Zito Admin** | `com.aurenza.zito.admin` | `com.aurenza.zito.admin` | Internal admins, platform managers | `zito-admin://` |

---

## 🏗️ Configuration Files

Each app has its own configuration:

- **Customer:** `app-customer.json`
- **Partner:** `app-partner.json`
- **Admin:** `app-admin.json`
- **Base:** `app.json` (fallback for dev)

Each includes:
- ✅ Unique app name
- ✅ Unique Android package name
- ✅ Unique iOS bundle ID
- ✅ Unique deep link scheme
- ✅ Unique icon/branding
- ✅ Unique splash screen colors
- ✅ Environment variables

---

## 🔨 Build Commands

### **Preview Builds (Testing)**

Build APK for testing on your device:

```bash
# Customer App
npm run customer:preview

# Partner App
npm run partner:preview

# Admin App
npm run admin:preview

# All 3 apps at once
npm run build:all-preview
```

### **Production Builds (App Store)**

Build production app bundles for Google Play & App Store:

```bash
# Customer App (both iOS + Android)
npm run customer:production

# Partner App (both iOS + Android)
npm run partner:production

# Admin App (both iOS + Android)
npm run admin:production

# All 3 apps at once
npm run build:all-production
```

---

## 🔄 Over-The-Air Updates

Push code updates to installed apps **without rebuilding**:

```bash
# Update Customer app
npm run customer:update

# Update Partner app
npm run partner:update

# Update Admin app
npm run admin:update

# Update all apps
npm run update:all
```

---

## 📲 Installation & Testing

### **Step 1: Build APKs**

```bash
npm run customer:preview
npm run partner:preview
npm run admin:preview
```

This creates 3 separate APKs:
- `zito-customer-1.0.0.apk`
- `zito-partner-1.0.0.apk`
- `zito-admin-1.0.0.apk`

### **Step 2: Install on Device**

You can install **all 3 apps on the same phone** simultaneously:

```bash
adb install zito-customer-1.0.0.apk
adb install zito-partner-1.0.0.apk
adb install zito-admin-1.0.0.apk
```

Or manually download and install from EAS:
- Open EAS dashboard
- Select build → "Install on device"
- Scan QR code on your phone

### **Step 3: Deep Linking**

Link to specific app from your backend:

```
# Customer app
zito-customer://book/ABC123

# Partner app
zito-partner://trips/ABC123

# Admin app
zito-admin://dashboard

# These work with Firebase Dynamic Links too:
https://zito.link/customer/ABC123  → opens Zito Customer
https://zito.link/partner/ABC123   → opens Zito Partner
https://zito.link/admin/ABC123     → opens Zito Admin
```

---

## 🎨 Customization Per Flavor

Each app can have different:

### **Visual Branding**
- Different icons per flavor (icon-customer.png, icon-partner.png, icon-admin.png)
- Different splash screens
- Different app colors in constants

### **Functionality**
- Different entry routes (customer → home, partner → trips, admin → dashboard)
- Different bottom tabs shown
- Different feature access

### **Environment**
- Different API endpoints per flavor (optional)
- Different feature flags per flavor
- Different analytics tracking per flavor

---

## 🔗 Linking to App Config

The `--app-config` flag ensures EAS uses the right configuration:

```bash
eas build --platform android --profile customer-preview --app-config app-customer.json
```

---

## 📊 Build Status Dashboard

Check all 3 apps on EAS dashboard:
- **Project ID:** `9a3a10da-3cf5-4dba-bca8-07187831b78b`
- **View at:** https://expo.dev
- Each build shows in separate section
- OTA updates tracked per app

---

## ⚠️ Important Notes

1. **Each app is independent:**
   - Can be installed on same phone
   - Can be updated independently
   - Share same API backend
   - Have different authentication contexts

2. **Google Play / App Store:**
   - Each package name = separate store listing
   - Can have different pricing/regions
   - Can have different release dates
   - Each needs separate signing certificate

3. **Android Version Codes:**
   - Currently all set to `versionCode: 1`
   - You may want to offset (customer: 1, partner: 100, admin: 200) to avoid conflicts
   - Increment in app-{flavor}.json before production build

4. **iOS TestFlight:**
   - Each bundle ID needs separate Apple Developer enrollment
   - Can submit all 3 to different TestFlight groups

---

## 🚀 Next Steps

1. **Test locally:**
   ```bash
   npm run customer:preview
   npm run partner:preview
   npm run admin:preview
   ```

2. **Customize flavors** (if needed):
   - Edit icons in `assets/images/icon-{flavor}.png`
   - Update colors in each `app-{flavor}.json`
   - Modify routes in `app/_layout.js` based on flavor

3. **Deploy to stores:**
   ```bash
   npm run customer:production
   npm run partner:production
   npm run admin:production
   ```

4. **Submit to Play Store / App Store** via EAS dashboard

---

## 🆘 Troubleshooting

**APK not installing?**
```bash
adb uninstall com.aurenza.zito.customer
adb install zito-customer-1.0.0.apk
```

**EAS says "Multiple apps in project"?**
- That's normal! Each flavor uses same Expo project
- The `--app-config` flag handles the differences

**Can't update apps?**
```bash
npm run eas:login
npm run customer:update
```

---

Built with ❤️ by Aurenza Limited
