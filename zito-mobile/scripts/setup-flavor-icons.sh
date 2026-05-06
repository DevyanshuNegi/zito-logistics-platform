#!/bin/bash

# Setup flavor-specific icon assets
# Run this once to create the necessary icon files for each flavor

echo "Setting up flavor-specific icons..."
echo ""

# Check if base icons exist
if [ ! -f "assets/images/icon.png" ]; then
  echo "❌ Error: icon.png not found in assets/images/"
  exit 1
fi

echo "Creating Customer app icons..."
cp assets/images/icon.png assets/images/icon-customer.png 2>/dev/null || echo "✓ icon-customer.png"
cp assets/images/android-icon-foreground.png assets/images/android-icon-customer-foreground.png 2>/dev/null || echo "✓ android-icon-customer-foreground.png"

echo "Creating Partner app icons..."
cp assets/images/icon.png assets/images/icon-partner.png 2>/dev/null || echo "✓ icon-partner.png"
cp assets/images/android-icon-foreground.png assets/images/android-icon-partner-foreground.png 2>/dev/null || echo "✓ android-icon-partner-foreground.png"

echo "Creating Admin app icons..."
cp assets/images/icon.png assets/images/icon-admin.png 2>/dev/null || echo "✓ icon-admin.png"
cp assets/images/android-icon-foreground.png assets/images/android-icon-admin-foreground.png 2>/dev/null || echo "✓ android-icon-admin-foreground.png"

echo ""
echo "✅ Icon setup complete!"
echo ""
echo "Optional: Customize each flavor's icons:"
echo "  - assets/images/icon-customer.png"
echo "  - assets/images/icon-partner.png"
echo "  - assets/images/icon-admin.png"
