# 🚀 QUICK START GUIDE - REBUILD & TEST APKs

**Last Updated:** May 18, 2026

---

## ✅ PRE-BUILD CHECKLIST

### 1. Verify Backend is Running
```powershell
# Terminal 1: Backend
cd c:\Users\Abcom\Desktop\Zito\backend
npm run dev

# Should show:
# [Nest] ... Listening on port 5000
# Found 0 errors. Watching for file changes.
```

### 2. Verify Frontend is Running (Optional)
```powershell
# Terminal 2: Frontend
cd c:\Users\Abcom\Desktop\Zito\frontend
npm run dev:clean

# Should show:
# > ready on 0.0.0.0:3001
```

### 3. Check Mobile App API Configuration
```bash
cat c:\Users\Abcom\Desktop\Zito\zito-mobile\.env

# Should show:
# EXPO_PUBLIC_API_URL=http://localhost:5000/api/v1
```

---

## 🔧 CONFIGURE FOR YOUR ENVIRONMENT

### For **Local Testing** (Windows Machine)
✅ Current configuration is correct:
```
EXPO_PUBLIC_API_URL=http://localhost:5000/api/v1
```

### For **Android Emulator** 
Update `.env`:
```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api/v1
```
*(10.0.2.2 is the special Android emulator alias for host machine)*

### For **Physical Device** (Mobile Phone)
1. Find your PC's IP: `ipconfig` (IPv4 Address like 192.168.1.X)
2. Update `.env`:
```bash
EXPO_PUBLIC_API_URL=http://192.168.1.100:5000/api/v1
# Replace 100 with your actual IP
```

---

## 🏗️ BUILD APKs

### Option A: Build Individual APKs
```bash
cd c:\Users\Abcom\Desktop\Zito\zito-mobile

# Build Customer App
npm run customer:preview
# Produces: zito-customer.apk (~150MB, 7 min)

# Build Partner App
npm run partner:preview
# Produces: zito-partner.apk (~150MB, 7 min)

# Build Admin App
npm run admin:preview
# Produces: zito-admin.apk (~150MB, 7 min)
```

### Option B: Build All 3 APKs at Once
```bash
cd c:\Users\Abcom\Desktop\Zito\zito-mobile
npm run build:all-preview
# Total time: ~20 min
```

---

## 📱 TEST ON DEVICE

### Android Emulator
```bash
# 1. Open Android Studio
# 2. Click "AVD Manager"
# 3. Start any emulator (e.g., Pixel 4 API 30)
# 4. Drag APK file onto emulator window to install
# 5. Or use adb:
adb install -r zito-customer.apk
```

### Physical Device (USB)
```bash
# 1. Enable USB debugging on phone
# 2. Connect via USB
# 3. Install APK:
adb install -r zito-customer.apk
```

### Build Output Location
```
APK files are in:
c:\Users\Abcom\Desktop\Zito\zito-mobile\output\
```

---

## 🧪 LOGIN FLOW TEST

### Test Case 1: Phone Login (Customer & Partner Apps)
1. Open Customer App
2. See login screen with "Phone Number" tab selected ✓
3. Enter phone: `+254711000000`
4. Tap "Continue"
5. **Expected:** 6-digit OTP code sent
6. Enter OTP code
7. **Expected:** Login successful → Dashboard

### Test Case 2: Email Login (Admin App)
1. Open Admin App
2. Click "Email" tab
3. Enter email: `admin@zito.app`
4. Tap "Continue"
5. **Expected:** 6-digit OTP code sent
6. Enter OTP code
7. **Expected:** Enter password → Login successful

### Test Case 3: Check App Names
1. Open each app's settings/about screen
2. **Verify:**
   - Customer: "Zito Logistics" ✓
   - Partner: "Zito Partners" ✓
   - Admin: "Zito Operations" ✓

---

## ⚠️ COMMON ISSUES & FIXES

### Issue: "Cannot reach API" Error
**Solution:**
- Verify backend is running: `curl http://localhost:5000/health`
- Check `.env` has correct API URL
- For device: Use PC's IP, not localhost

### Issue: "API timeout" Error
**Solution:**
- Check backend logs for errors
- Verify network connectivity (firewall)
- Increase timeout in client.js if needed

### Issue: "OTP not received"
**Solution:**
- Check backend logs for OTP generation
- Verify email/SMS provider is configured
- Check that phone number format is correct

### Issue: "Login successful but no dashboard"
**Solution:**
- Check browser console for errors
- Verify user has proper permissions in DB
- Check that JWT token is valid

---

## 📊 BUILD OUTPUT REFERENCE

```
After successful build, you'll see:

✅ Successfully built all target apps!

Outputs available in:
  zito-mobile/output/
    ├── zito-customer.apk (150MB)
    ├── zito-partner.apk (150MB)
    └── zito-admin.apk (150MB)

Installation instructions:
  adb install -r <apk-file>
```

---

## 🔗 USEFUL COMMANDS

```bash
# Check if backend is running
curl http://localhost:5000/health

# Check if frontend is running
curl http://localhost:3001

# Build and watch for changes
cd zito-mobile && npm run customer:preview

# Clean rebuild (remove cache)
npm run customer:preview -- --clear

# View build logs
npm run customer:preview -- --log

# Monitor app during testing (Android)
adb logcat | grep Zito

# Uninstall app from device
adb uninstall com.aurenza.zito.customer
```

---

## 📞 SUPPORT

**If login still fails after rebuilding:**

1. Check backend error logs:
   ```bash
   cat c:\Users\Abcom\Desktop\Zito\backend\logs\*.log
   ```

2. Verify database connection:
   ```bash
   # Backend should show "PrismaService initialized" on startup
   ```

3. Check that required tables exist:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   # Should show: users, bookings, otps, etc.
   ```

4. Test API directly:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"contact":"+254711000000","method":"otp"}'
   ```

---

**✅ All systems ready for rebuild and testing!**
