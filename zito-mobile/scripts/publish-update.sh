#!/bin/bash

# Publish OTA Update to EAS
# This pushes code changes to already-installed APKs without needing to rebuild

echo "🚀 Publishing Over-The-Air Update to EAS..."
echo ""
echo "This will push your code changes to all installed Zito apps."
echo "The update will be installed next time the app restarts."
echo ""

# Check if logged into EAS
if ! npx eas whoami > /dev/null 2>&1; then
  echo "❌ Not logged into EAS. Logging in..."
  npx eas login
fi

# Publish update
echo ""
echo "📤 Publishing to Android..."
npx eas update --platform android

echo ""
echo "✅ Update published! 🎉"
echo ""
echo "On your device:"
echo "  1. Close the Zito app completely"
echo "  2. Reopen the app"
echo "  3. You'll see 'Checking for updates...' briefly"
echo "  4. The new version will install automatically"
echo ""
