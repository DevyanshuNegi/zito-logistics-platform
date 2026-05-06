# Quick Start: Building 3 Separate Apps

## ✅ What's Changed

Your Zito mobile app now builds as **3 separate Android/iOS apps** (like Uber):

| App | For | Package | Download Size |
|-----|-----|---------|---|
| **Zito Customer** | Customers booking shipments | `com.aurenza.zito.customer` | ~85MB |
| **Zito Partner** | Drivers, Transporters, Couriers, Warehouses | `com.aurenza.zito.partner` | ~85MB |
| **Zito Admin** | Platform admins & managers | `com.aurenza.zito.admin` | ~85MB |

---

## 🎯 First Steps

### **1. Setup Icons** (One-time)

Windows:
```bash
cd zito-mobile
scripts\setup-flavor-icons.bat
```

Mac/Linux:
```bash
cd zito-mobile
bash scripts/setup-flavor-icons.sh
```

This copies your existing icons to flavor-specific files. You can customize them later.

---

### **2. Build All 3 Apps for Testing**

```bash
npm run build:all-preview
```

Or build individually:
```bash
npm run customer:preview   # Customer APK
npm run partner:preview    # Partner APK
npm run admin:preview      # Admin APK
```

This creates 3 APKs ready to install on your phone.

---

### **3. Install on Your Phone**

```bash
# Download from EAS dashboard:
# - zito-customer-1.0.0.apk
# - zito-partner-1.0.0.apk
# - zito-admin-1.0.0.apk

# Or use ADB (Android):
adb install zito-customer-1.0.0.apk
adb install zito-partner-1.0.0.apk
adb install zito-admin-1.0.0.apk
```

✨ **All 3 apps will appear on your home screen!**

---

### **4. Update Apps Without Rebuilding**

Made a code change? Push it to installed apps instantly:

```bash
npm run customer:update    # Update Customer app
npm run partner:update     # Update Partner app
npm run admin:update       # Update Admin app
```

Users just restart their app and the update downloads automatically.

---

## 📊 Each App Has

✅ **Unique Package Name**
- Customer: `com.aurenza.zito.customer`
- Partner: `com.aurenza.zito.partner`  
- Admin: `com.aurenza.zito.admin`

✅ **Unique Deep Link Scheme**
- Customer: `zito-customer://`
- Partner: `zito-partner://`
- Admin: `zito-admin://`

✅ **Unique Branding**
- Different colors per flavor (blue, orange, purple)
- Different splash screens
- Different app names & descriptions

✅ **Different Entry Routes**
- Customer → Home (book shipments)
- Partner → Trips (accept jobs)
- Admin → Dashboard (manage platform)

---

## 🚀 Production Deployment

When ready for Google Play / App Store:

```bash
# Build production apps (all platforms)
npm run build:all-production

# Then submit from EAS dashboard:
# Each app is a separate store listing with own reviews, ratings, pricing
```

---

## 🔗 File Reference

| File | Purpose |
|------|---------|
| `app-customer.json` | Customer app config |
| `app-partner.json` | Partner app config |
| `app-admin.json` | Admin app config |
| `eas.json` | EAS build profiles (customer-preview, partner-preview, etc.) |
| `src/constants/flavors.ts` | Flavor branding & config in code |
| `scripts/setup-flavor-icons.bat` | Setup flavor icons (Windows) |
| `scripts/setup-flavor-icons.sh` | Setup flavor icons (Mac/Linux) |
| `MULTI_FLAVOR_BUILD.md` | Full technical documentation |

---

## ❓ FAQ

**Q: Can I install all 3 apps on one phone?**  
A: Yes! Each has a different package name, so they don't conflict.

**Q: Do they share the same backend?**  
A: Yes, all 3 apps connect to your same Zito backend API.

**Q: Can I update them independently?**  
A: Yes! `npm run customer:update` updates only the Customer app.

**Q: What if I need different features per app?**  
A: Check `src/constants/flavors.ts` — you can conditionally show features based on `currentFlavor`.

**Q: How do users know which app to download?**  
A: Each has a different name and description in Google Play / App Store.

---

## 🆘 Issues?

Icon not showing?
```bash
scripts\setup-flavor-icons.bat
npm run customer:preview
```

Can't find build?
- Log in to EAS: `npm run eas:login`
- Check dashboard: https://expo.dev

Build failed?
```bash
npm run doctor  # Diagnose issues
```

---

**Ready to go!** 🚀

Start with: `npm run build:all-preview`
