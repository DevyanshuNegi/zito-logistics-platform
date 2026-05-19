# 🔴 APK FAILURE ANALYSIS & FIX GUIDE

**Date:** May 18, 2026  
**Status:** CRITICAL - Multiple blocking issues preventing APK launch  
**Recommendation:** Fix ALL issues before rebuilding APKs

---

## 📱 CRITICAL ISSUES BLOCKING APK LOGIN

### ❌ **ISSUE 1: Login Screen Shows EMAIL Instead of PHONE (CRITICAL)**

**Impact:** APK fails testing because users cannot log in with phone (PRD requirement)

**Current State:**
- Mobile app login defaults to email/username input
- Users cannot select phone as login method
- Inherited from web frontend design (wrong for mobile)

**PRD Requirement (§2.5):**
```
- Customer App: Phone login FIRST (primary for users)
- Partner App: Phone login FIRST (primary for drivers)
- Admin App: Both phone and email supported
```

**Where to Fix:**
- Login form component in mobile app
- Need to add phone input as PRIMARY option
- Email should be secondary/fallback

**Impact on Testing:**
- ❌ Testers cannot log in with phone
- ❌ All login flows fail
- ❌ Prevents access to entire app

---

### ❌ **ISSUE 2: API Configuration - Missing/Placeholder Values (HIGH)**

**Impact:** Mobile app cannot communicate with backend

**Current Problems:**
```json
{
  "apiUrl": "YOUR_GOOGLE_MAPS_API_KEY_HERE",  // ❌ PLACEHOLDER
  "bundleId": "com.aurenza.zito.customer",    // ✓ OK but see Issue 3
  "scheme": "zito-customer"
}
```

**Missing Configurations:**
- `API_URL` environment variable (should point to backend)
- Google Maps API keys (currently placeholders)
- Backend base URL not set in constants/theme.js

**Files to Check:**
- `zito-mobile/src/constants/theme.js` - API_URL definition
- `zito-mobile/app-customer.json` - Google Maps API key
- `zito-mobile/app-partner.json` - Google Maps API key  
- `zito-mobile/app-admin.json` - Google Maps API key

---

### ❌ **ISSUE 3: App Naming NOT Per PRD (MEDIUM)**

**Current Config:**
```
app-customer.json:  "name": "Zito Logistics"     ✗ Should be "Zito Logistics"
app-partner.json:   "name": "Zito Partners"      ✓ CORRECT
app-admin.json:     "name": "Zito Management"    ✗ Should be "Zito Operations"
```

**PRD Requirement (§3.1):**
| App | Correct Name |
|-----|---|
| Customer | Zito Logistics ✓ |
| Partner | Zito Partners ✓ |
| Admin | Zito Operations ✗ Need to fix |

**Action:** Update app-admin.json name from "Zito Management" → "Zito Operations"

---

### ❌ **ISSUE 4: Branding Still Shows Company Name (MEDIUM)**

**Current:**
- App displays "Aurenza Limited" in UI
- Mixed company + product branding
- Violates PRD §66.3C (pure product branding only)

**PRD Requirement (§66.3C):**
```
✅ Show: ZITO icon + "ZITO" text + "Smarter. Faster. Reliable."
❌ Hide: "Aurenza Limited" in all customer/partner UI
⚠️  "Aurenza Limited" ONLY in Admin app legal footer
```

**Impact:** Users see wrong branding, unprofessional appearance

---

### ❌ **ISSUE 5: Frontend Dev Server Cannot Start (BLOCKER)**

**Error:**
```
Error: listen EADDRINUSE: address already in use 127.0.0.1:3001
```

**Cause:** Port 3001 already in use by another process

**Impact:**
- Cannot test frontend changes
- Cannot make frontend modifications for fixes
- Blocks development workflow

---

## 🔧 FIXING THE ISSUES

### **STEP 1: Kill Port 3001 and Restart Frontend**

```powershell
# Find process using port 3001
Get-NetTCPConnection -LocalPort 3001 | Select-Object OwnerModule

# Kill the process (use PID from above)
Stop-Process -Id <PID> -Force

# Then restart frontend dev server
cd c:\Users\Abcom\Desktop\Zito\frontend
npm run dev:clean
```

---

### **STEP 2: Update Admin App Name**

**File:** `zito-mobile/app-admin.json`

Change:
```json
"name": "Zito Management"
```

To:
```json
"name": "Zito Operations"
```

---

### **STEP 3: Configure API URLs**

**File:** `zito-mobile/src/constants/theme.js`

Add/Update:
```javascript
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
// For production: 'https://api.zito.app/api/v1'
```

**File:** `zito-mobile/.env` (Create if missing)

```
EXPO_PUBLIC_API_URL=http://YOUR_BACKEND_IP:5000/api/v1
```

---

### **STEP 4: Add Google Maps API Keys**

**To get API Keys:**
1. Go to Google Cloud Console
2. Create/select project
3. Enable Maps SDK for Android & iOS
4. Create API key
5. Restrict to Android/iOS

**Update All App Configs:**

```json
// app-customer.json
"ios": {
  "config": {
    "googleMapsApiKey": "YOUR_ACTUAL_GOOGLE_MAPS_KEY_HERE"
  }
}

// app-partner.json  
"ios": {
  "config": {
    "googleMapsApiKey": "YOUR_ACTUAL_GOOGLE_MAPS_KEY_HERE"
  }
}

// app-admin.json
"ios": {
  "config": {
    "googleMapsApiKey": "YOUR_ACTUAL_GOOGLE_MAPS_KEY_HERE"
  }
}
```

---

### **STEP 5: Fix Login Screen - Phone First (CRITICAL)**

**Locate:** `zito-mobile/src` → Look for login/auth components

**Change Required:**
```javascript
// BEFORE (wrong):
<Input placeholder="Email or Username" />
<Input placeholder="Password" />

// AFTER (correct per PRD):
<PhoneNumberInput placeholder="+254 7XX XXX XXX" />  // Primary
<PasswordInput placeholder="Password" />
<Link>Or sign in with email</Link>  // Secondary option
```

**Why:** PRD §2.5 requires phone-first for mobile apps (customers and drivers)

---

### **STEP 6: Update Branding References**

**Search & Replace in Mobile App:**

Find all instances of "Aurenza Limited" and:
- ❌ Remove from all screens EXCEPT admin footer
- ✅ Replace with "ZITO" where appropriate
- ✅ Use tagline: "Smarter. Faster. Reliable."

**Files to Check:**
- All login screens
- Home/dashboard screens
- Settings screens
- About screens

---

### **STEP 7: Verify Environment Configuration**

**Backend (.env):**
```
DATABASE_URL=postgresql://user:password@localhost:5432/zito
NODE_ENV=development
JWT_SECRET=your_secret_here
OTP_EXPIRY=600
```

**Frontend (.env.local):**
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:5000
```

**Mobile (app.json or .env):**
```
EXPO_PUBLIC_API_URL=http://YOUR_BACKEND_IP:5000/api/v1
EXPO_PUBLIC_WS_URL=ws://YOUR_BACKEND_IP:5000
```

---

## ✅ TESTING CHECKLIST AFTER FIXES

- [ ] Backend `npm run dev` starts successfully on port 5000
- [ ] Frontend `npm run dev` starts successfully on port 3001
- [ ] Mobile app can reach backend (no API timeout errors)
- [ ] **Login with PHONE works on all 3 apps**
- [ ] Login with email works on admin app
- [ ] OTP verification works
- [ ] User can access dashboard after login
- [ ] App names display correctly:
  - [ ] Customer: "Zito Logistics"
  - [ ] Partner: "Zito Partners"
  - [ ] Admin: "Zito Operations"
- [ ] No "Aurenza Limited" shown in customer/partner UI
- [ ] Google Maps loads without errors
- [ ] All API calls return data (bookings, users, etc.)

---

## 🚀 REBUILDING APKs

**After all fixes are complete:**

```bash
cd zito-mobile

# Customer APK
npm run customer:preview

# Partner APK  
npm run partner:preview

# Admin APK
npm run admin:preview

# Or all at once
npm run build:all-preview
```

---

## 📋 SUMMARY OF CHANGES NEEDED

| Issue | Priority | File(s) | Action |
|-------|----------|---------|--------|
| **Login: Email instead of Phone** | 🔴 CRITICAL | Mobile auth component | Change to phone-first input |
| **Admin app name** | 🟠 HIGH | app-admin.json | "Zito Management" → "Zito Operations" |
| **API URL missing** | 🟠 HIGH | constants/theme.js, .env | Add API_URL configuration |
| **Google Maps keys** | 🟠 HIGH | All app-*.json | Add real API keys |
| **Branding: Company name shown** | 🟡 MEDIUM | All screens | Remove/hide "Aurenza Limited" |
| **Port 3001 in use** | 🟡 MEDIUM | System | Kill process on port 3001 |

---

**REPORT GENERATED:** May 18, 2026  
**ACTION REQUIRED:** All 6 issues must be fixed before APK rebuild  
**ESTIMATED FIX TIME:** 2-3 hours (if all info available)
