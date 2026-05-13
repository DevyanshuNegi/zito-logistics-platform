# 🔥 Firebase App Distribution Setup Guide

## 📋 Overview

Firebase App Distribution lets you share test APKs with your QA team and partners easily. No manual APK transfers needed!

---

## 🔑 Step 1: Create Firebase Project

### **1.1 Go to Firebase Console**
- URL: https://console.firebase.google.com/
- Click **"Create a project"** (or use existing)
- Project Name: `Zito` or `Zito-Testing`
- Region: Choose your region

### **1.2 Enable App Distribution**
- Left menu → **App Distribution**
- Follow setup wizard
- You'll see "Release Testing" section

---

## 📱 Step 2: Register Your Apps

### **2.1 Add Android Apps**

Go to **Project Settings** → **Your Apps** → Click Android icon

For each app:

**Customer App:**
```
Package name: com.aurenza.zito.customer
App nickname: Zito Customer
SHA-1 certificate fingerprint: (see Step 3)
```

**Partner App:**
```
Package name: com.aurenza.zito.partner
App nickname: Zito Partner
SHA-1 certificate fingerprint: (see Step 3)
```

**Admin App:**
```
Package name: com.aurenza.zito.admin
App nickname: Zito Admin
SHA-1 certificate fingerprint: (see Step 3)
```

---

## 🔐 Step 3: Get SHA-1 Certificate Fingerprint

### **Option A: From Expo (Recommended)**

```bash
cd c:\Users\Abcom\Desktop\Zito\zito-mobile

# Get build certificate details
npx eas build --platform android --profile preview --fingerprint
```

### **Option B: From Keystore File**

```powershell
# If you have a keystore
keytool -list -v -keystore your-keystore.jks -alias your-alias
```

**Note:** For development, Expo generates certificates automatically. Copy the SHA-1 from Expo dashboard.

---

## 📤 Step 4: Upload APKs to Firebase

### **4.1 Using Firebase CLI**

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Navigate to project
cd c:\Users\Abcom\Desktop\Zito

# Initialize Firebase (choose Zito project)
firebase init

# Upload APKs
firebase appdistribution:distribute c:\Users\Abcom\Desktop\Zito\APK_DOWNLOADS\Zito-Customer-v1.0.0.apk \
  --app 1:123456789:android:abcdef1234567890abcdef \
  --release-notes "Version 1.0.0 - Initial release" \
  --testers "qa.team@yourcompany.com"
```

### **4.2 Using Firebase Web Console**

1. Go to **App Distribution** → **Release Testing**
2. Click **"Upload from file"**
3. Select APK file
4. Add release notes
5. Add tester emails
6. Click **"Distribute"**

---

## 👥 Step 5: Add Testers

### **5.1 In Firebase Console**

Go to **App Distribution** → **Testers & Groups**

**Add individual testers:**
```
qa.team@zito.local
qa.admin@zito.local
qa.customer@zito.local
qa.partner@zito.local
```

**Create groups (optional):**
- QA Team
- Admin Team
- Customer Team
- Partner Team

### **5.2 Invite Testers**

1. Enter email addresses
2. Send invitations
3. Testers receive Firebase email
4. They can download APKs directly

---

## 🔗 Step 6: Tester Download Link

Once distributed, testers get a link:

```
https://console.firebase.google.com/project/zito-testing/appdistribution/app/android:com.aurenza.zito.customer/releases
```

**Or simpler:** They receive email with download link

---

## 📊 Firebase Console Dashboard

Once set up, you can see:

✅ **All uploads** with versions  
✅ **Download analytics** (who downloaded, when)  
✅ **Tester feedback** (crash reports, comments)  
✅ **Release notes** history  
✅ **Automatic updates** (notify testers of new versions)  

---

## 🚀 Automated Distribution Workflow

### **CI/CD Integration (GitHub Actions)**

Create `.github/workflows/distribute.yml`:

```yaml
name: Distribute APKs

on:
  push:
    branches: [main]

jobs:
  distribute:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Upload to Firebase
        uses: wzieba/Firebase-Distribution-Github-Action@v1
        with:
          firebaseToken: ${{ secrets.FIREBASE_TOKEN }}
          file: APK_DOWNLOADS/Zito-Customer-v1.0.0.apk
          groups: "qa-team"
          releaseNotes: "Latest build from CI/CD pipeline"
```

---

## 📲 Tester Instructions

**For your QA team, send them this:**

1. **You'll receive an email** from Firebase with invitation
2. **Click the link** in the email
3. **Download the APK** directly to your phone
4. **Install the app** (may need to enable unknown sources)
5. **Test and provide feedback**
6. **Use test credentials provided**

---

## 🔄 Update & Re-distribute

When you build new versions:

```bash
# Build new APK
cd c:\Users\Abcom\Desktop\Zito\zito-mobile
npm run build:all-preview

# Download from EAS
npx eas build:download --id <build-id>

# Upload to Firebase
firebase appdistribution:distribute Zito-Customer-v1.0.0.apk \
  --app 1:123456789:android:abcdef1234567890abcdef \
  --release-notes "Version 1.0.1 - Bug fixes"
```

---

## ✅ Troubleshooting

### **"Invalid app ID"**
- Verify package ID matches registered app in Firebase
- Check console.firebase.google.com for correct IDs

### **"SHA-1 mismatch"**
- Regenerate from Expo (builds are signed by Expo by default)
- Get SHA-1 from: `npx eas build:fingerprint`

### **"Testers can't download"**
- Ensure they have Firebase account
- Check email invitation was sent
- Verify APK upload completed successfully

### **"APK won't install"**
- Device may block unknown sources (enable in settings)
- Android version must be 5.0+
- Check previous version not installed with different certificate

---

## 🎯 Best Practices

✅ **Use meaningful version numbers** (1.0.0, 1.0.1, etc.)  
✅ **Add detailed release notes** for each build  
✅ **Test on Firebase** before production release  
✅ **Monitor download analytics** to see tester engagement  
✅ **Collect feedback** through Firebase crash reports  
✅ **Create tester groups** (QA, Management, Partners)  

---

## 📞 Firebase Support

- Firebase Docs: https://firebase.google.com/docs/app-distribution
- Firebase CLI: https://firebase.google.com/docs/cli
- GitHub Actions: https://github.com/marketplace/actions/firebase-distribution

---

**Status:** ✅ Ready to set up  
**Estimated Setup Time:** 15-20 minutes  
**Cost:** Free (using Firebase free tier)
