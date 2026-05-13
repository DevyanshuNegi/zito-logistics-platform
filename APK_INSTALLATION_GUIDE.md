# 📱 Zito Mobile Apps - APK Installation Guide

## 📥 Quick Install Methods

### **Method 1: USB/ADB (Fastest for Testing)**

**Requirements:**
- USB cable
- Android phone (Developer Mode enabled)
- ADB installed on Windows

**Steps:**

1. **Enable Developer Mode on Phone:**
   - Settings → About Phone → Tap "Build Number" 7 times
   - Settings → Developer Options → Enable USB Debugging

2. **Connect Phone via USB**

3. **Install APKs:**
   ```powershell
   # Navigate to APK folder
   cd c:\Users\Abcom\Desktop\Zito\APK_DOWNLOADS
   
   # Install all 3 apps
   adb install Zito-Customer-v1.0.0.apk
   adb install Zito-Partner-v1.0.0.apk
   adb install Zito-Admin-v1.0.0.apk
   
   # Verify installation
   adb shell pm list packages | findstr "com.aurenza.zito"
   ```

**Expected Output:**
```
package:com.aurenza.zito.customer
package:com.aurenza.zito.partner
package:com.aurenza.zito.admin
```

---

### **Method 2: Manual File Transfer (For Non-Technical Users)**

1. **Connect phone via USB**
2. **Copy APK files to phone:**
   ```powershell
   # Copy to phone storage
   adb push Zito-Customer-v1.0.0.apk /sdcard/Download/
   adb push Zito-Partner-v1.0.0.apk /sdcard/Download/
   adb push Zito-Admin-v1.0.0.apk /sdcard/Download/
   ```
3. **On phone:** Open Files → Download → Tap each APK → Install

---

### **Method 3: Firebase App Distribution (Recommended for Teams)**

*See Firebase setup section below*

---

## 🔐 Test Credentials

### **Customer App** (Logistics Service)
```
Email:  qa.customer@zito.local
Phone:  +254 (use OTP login)
Password: QaCustomer@123 (if password auth enabled)
```
**Access:** Customer booking dashboard

### **Partner App** (Drivers & Agents)
```
Email:  qa.driver@zito.local
Phone:  +254712345678 (use OTP login)
Password: QaDriver@123 (if password auth enabled)
```
**Access:** Driver/agent operations dashboard

### **Admin App** (Super Admin)
```
Email:     qa.superadmin@zito.local
Password:  QaSuperAdmin@123 (required after OTP)
Role:      SUPER_ADMIN
```
**Access:** Full admin control panel with all features

---

## 🧪 Installation Verification

### **Check Installed Packages:**
```powershell
adb shell pm list packages | findstr "com.aurenza.zito"
```

### **Check App Versions:**
```powershell
adb shell dumpsys package | findstr -A 5 "com.aurenza.zito"
```

### **Clear App Data (if needed):**
```powershell
adb shell pm clear com.aurenza.zito.customer
adb shell pm clear com.aurenza.zito.partner
adb shell pm clear com.aurenza.zito.admin
```

### **Uninstall Apps:**
```powershell
adb uninstall com.aurenza.zito.customer
adb uninstall com.aurenza.zito.partner
adb uninstall com.aurenza.zito.admin
```

---

## 🚀 First Launch Checklist

After installing each app:

- [ ] **App launches successfully** (no crashes)
- [ ] **Zito branding visible** (logo, colors, fonts)
- [ ] **Login screen displays** with proper UI
- [ ] **OTP code can be requested** (check terminal for debug OTP)
- [ ] **User can authenticate** with test credentials
- [ ] **Dashboard loads** after successful login
- [ ] **Navigation works** (drawer/tabs respond)
- [ ] **API connectivity confirmed** (no network errors)

---

## 📊 APK File Information

| App | File Size | Package ID | Version |
|-----|-----------|------------|---------|
| Customer | 88 MB | `com.aurenza.zito.customer` | 1.0.0 |
| Partner | 88 MB | `com.aurenza.zito.partner` | 1.0.0 |
| Admin | 88 MB | `com.aurenza.zito.admin` | 1.0.0 |

**Build Info:**
- SDK: 54.0.0
- Runtime: 1.0.0
- Build Date: May 12, 2026
- Distribution: Internal/Preview

---

## 🔧 Troubleshooting

### **"Installation Failed"**
- Check Android version (requires Android 5.0+)
- Ensure phone storage has >200MB free space
- Try: `adb install -r` (force reinstall)

### **"App Crashes on Launch"**
- Check backend is running on port 5000
- Verify API URL in app config
- Clear app data: `adb shell pm clear com.aurenza.zito.customer`

### **"Can't Find Debug OTP"**
- Debug OTP only displays in development mode
- Check backend console for OTP value
- Use provided test credentials if OTP unavailable

### **"Network Connection Failed"**
- Verify backend API is accessible from phone's network
- Check if backend is running: `netstat -an | findstr 5000`
- Try using API IP address instead of localhost

---

## 📞 Support

For issues or questions:
1. Check backend logs: `npm run dev` in backend folder
2. Check frontend console: Inspect element in browser
3. Check mobile logs: `adb logcat`
4. Verify database connection (Neon PostgreSQL)

---

## 📋 APK File Locations

**Main folder:**
```
c:\Users\Abcom\Desktop\Zito\APK_DOWNLOADS\
├── Zito-Customer-v1.0.0.apk
├── Zito-Partner-v1.0.0.apk
└── Zito-Admin-v1.0.0.apk
```

**Also available at:**
```
https://expo.dev/accounts/zitoapp/projects/zito/builds/
```

---

**Last Updated:** May 12, 2026  
**Version:** 1.0.0  
**Status:** ✅ Ready for Testing
