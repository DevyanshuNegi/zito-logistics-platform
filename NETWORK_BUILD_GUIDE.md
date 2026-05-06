# 🚀 Build APKs - Network Unavailable

## Issue: Cannot Reach Expo Build Servers

Your system cannot currently reach `https://api.expo.dev` - this could be:
- ✓ Network/firewall restriction
- ✓ Local development environment
- ✓ Proxy/VPN blocking
- ✓ Temporary Expo service outage

---

## ✅ Solution: Use EAS Web UI Instead

**Step 1: Navigate to EAS Web Dashboard**
```
https://expo.dev
```

**Step 2: Trigger Builds Manually**
```
Project: "zito"
ID: 9a3a10da-3cf5-4dba-bca8-07187831b78b
```

**Step 3: For Each App, Click "Trigger Build":**

### Customer App:
```
Platform: Android
Profile: customer-preview
Wait: ~7-10 minutes
```

### Partner App:
```
Platform: Android  
Profile: partner-preview
Wait: ~7-10 minutes
```

### Admin App:
```
Platform: Android
Profile: admin-preview
Wait: ~7-10 minutes
```

---

## 📥 Download APKs

Once builds complete (green checkmark):

1. Click build name
2. Scroll to "Build Artifacts"
3. Click "Download" next to APK
4. Select format: APK
5. Save to Downloads

---

## 🔧 Verify Configuration Files

Make sure these files exist in `zito-mobile/`:

```bash
ls -la app*.json
```

Should show:
```
app.json              ← Main (customer by default)
app-customer.json     ← Customer flavor
app-partner.json      ← Partner flavor  
app-admin.json        ← Admin flavor
```

All 3 flavor configs are in place ✓

---

## 📋 Alternative: Use Expo Prebuild (Local Testing)

If you want to test builds locally:

```bash
# Test Customer app locally
expo prebuild --platform android --clean

# This will generate Android build files without uploading to EAS
# Useful for verifying configuration
```

---

## ✨ Everything is Ready

Your build configuration is complete:
- ✅ app-customer.json configured
- ✅ app-partner.json configured
- ✅ app-admin.json configured
- ✅ EAS profiles set up (customer-preview, partner-preview, admin-preview)
- ✅ npm scripts ready (npm run customer:preview, etc.)

**When network is available:**
```bash
npm run build:all-preview
```

This will:
1. Swap in customer config
2. Upload to EAS
3. Build Customer APK (~7-10 min)
4. Swap in partner config
5. Upload to EAS
6. Build Partner APK (~7-10 min)
7. Swap in admin config
8. Upload to EAS
9. Build Admin APK (~7-10 min)
10. Restore original app.json

---

## 🔗 Resources

- **EAS Dashboard:** https://expo.dev
- **Documentation:** https://docs.expo.dev/eas/build
- **Status Page:** https://status.expo.io

**When ready to build, use EAS Web Dashboard or ensure network connectivity for CLI builds.**
