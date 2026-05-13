# 🔴 CRITICAL ISSUES IDENTIFIED & FIXES REQUIRED

**Date:** May 13, 2026  
**Status:** Ready for Implementation  
**Priority:** CRITICAL - APKs need rebuild after fixes

---

## 🎯 Issues Found vs PRD Requirements

### **Issue 1: App Names Not Per PRD** ❌
**Current:**
- Customer: "Zito Logistics Services"
- Partner: "Zito Partners" ✓
- Admin: "Zito Management"

**PRD Requirement:**
- Customer: "Zito Logistics"
- Partner: "Zito Partners" ✓
- Admin: "Zito Operations"

**Action:** Update app-admin.json name

---

### **Issue 2: Login Screen - Email Instead of Phone** ❌
**Current:** Login asks for email first (inherited from frontend web design)

**PRD Requirement per Section 2.5:**
- Customer app: Should default to **PHONE** login (for customers)
- Partner app: Should default to **PHONE** login (for drivers/agents)
- Admin app: Can accept both phone and email

**Action:** Modify mobile login screen to show phone input first, with email as secondary option

---

### **Issue 3: Logo/Branding Not Clean** ❌
**Current:**
- Showing "Aurenza Limited" company branding
- Mixed company + product branding

**PRD Requirement (Section 66.3C):**
- Pure product branding: "ZITO" only
- Full logo should show: Z icon + "ZITO" text + tagline
- Tagline: "Smarter. Faster. Reliable."
- NO company name "Aurenza Limited" in customer/partner app UI
- Aurenza Limited only appears in Admin/legal footer

**Action:** 
- Remove company name from app headers
- Use clean Z icon only
- Update brand configuration

---

### **Issue 4: Not Industry Standard** ❌
**Analysis:**
- Mobile apps must follow Material Design 3 guidelines
- Login screens should follow OS conventions
- Spacing, typography, colors must match brand guidelines

**PRD Requirement (Section 66):**
- Customer: Blue theme (#0066FF)
- Partner: Orange theme (#FF9500)
- Admin: Purple theme (#9C27B0)

**Action:** Apply theme colors to login screens

---

### **Issue 5: Design Mismatch with PRD** ❌
**PRD App Store Listing Requirements:**

**Customer App:**
- Title: "Zito Logistics"
- Subtitle: "Africa's Unified Logistics Platform"
- Icon: Blue branding (#0066FF)
- Primary workflow: Browse → Book → Track → Deliver

**Partner App:**
- Title: "Zito Partners"
- Subtitle: "Earn More. Deliver Smart. Grow Your Business."
- Icon: Orange branding (#FF9500)
- Primary workflow: See jobs → Accept → Track → Earn

**Admin App:**
- Title: "Zito Operations"
- Subtitle: "Platform Management & Control"
- Icon: Purple branding (#9C27B0)
- Access: Staff only

**Action:** Update splash screens, headers, and UI colors to match

---

## 🔧 Required Fixes (Priority Order)

### **Fix 1: Update App Configurations** (5 min)
File: `app-admin.json`
```json
// Change from:
"name": "Zito Management",

// To:
"name": "Zito Operations",
```

### **Fix 2: Update Login Screen for Mobile** (30 min)
File: `zito-mobile/app/(auth)/login.js`

**Changes:**
1. Phone input as PRIMARY (not email)
2. Tab to switch between Phone/Email (email as secondary)
3. Default to phone for Customer & Partner apps
4. Allow email for Admin app

**Sample tab structure:**
```
┌────────────────────┐
│ Phone  │  Email    │  ← Default: PHONE
└────────────────────┘
 [Phone Input Field]
 [Continue Button]
```

### **Fix 3: Remove Company Branding** (15 min)
Files to update:
- `zito-mobile/src/components/BrandLockup.js`
- Login screen header
- App name display

**Changes:**
- Remove "Aurenza Limited" text
- Show only "ZITO" or app-specific title
- Update company name to only appear in Admin footer under "Legal"

### **Fix 4: Apply Theme Colors** (15 min)
Update login screens:
- Customer: Blue (#0066FF)
- Partner: Orange (#FF9500)
- Admin: Purple (#9C27B0)

Files:
- `login.js` - theme colors
- Button colors
- Header colors
- Active states

### **Fix 5: Update Splash Screen** (10 min)
Update `_layout.js` splash screen to show:
- Clean Z icon
- App name (Zito Logistics / Zito Partners / Zito Operations)
- Tagline (if applicable)
- NO company name

---

## ✅ After Fixes Required

1. **Rebuild APKs:**
   ```bash
   cd c:\Users\Abcom\Desktop\Zito\zito-mobile
   npm run build:all-preview
   ```

2. **Download new APKs from EAS**

3. **QA Testing:**
   - ✅ Logo clean, no company name
   - ✅ App name matches PRD
   - ✅ Login defaults to phone
   - ✅ Colors match brand (Blue/Orange/Purple)
   - ✅ Follows Material Design 3
   - ✅ Industry standard appearance

4. **Redistribute:**
   - New APK_DOWNLOADS
   - Update QR codes
   - Share with QA team

---

## 📋 Final Checklist

**Branding:**
- [ ] Logo is clean Z icon only
- [ ] No "Aurenza Limited" in Customer/Partner apps
- [ ] Only shows "ZITO" or app-specific name
- [ ] Aurenza only in Admin footer (legal)

**Login Flow:**
- [ ] Customer app: Phone first, email second
- [ ] Partner app: Phone first, email second  
- [ ] Admin app: Both options equal (staff use email usually)

**Colors:**
- [ ] Customer app: Blue (#0066FF) theme applied
- [ ] Partner app: Orange (#FF9500) theme applied
- [ ] Admin app: Purple (#9C27B0) theme applied

**Design:**
- [ ] Material Design 3 compliant
- [ ] Industry standard look & feel
- [ ] Matches PRD specifications
- [ ] Professional appearance

---

## 🚀 Ready to Proceed?

I can implement all these fixes right now. Just confirm and I'll:

1. Update app configurations
2. Fix login screens (phone-first)
3. Remove company branding
4. Apply correct theme colors
5. Rebuild all 3 APKs
6. Generate new QR codes
7. Create updated distribution package

**Estimated time:** 45 minutes to rebuild & download

Proceed? ✅
