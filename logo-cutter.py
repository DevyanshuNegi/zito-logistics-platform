#!/usr/bin/env python3
"""
ZITO Logo Cutter - Properly extracts and cuts the Z icon for various uses
Generates:
- favicon-48.png (48x48 - for browser favicon)
- favicon-96.png (96x96 - for larger favicon)
- zito-icon.png (512x512 - for app icon, just the Z)
- zito-app-icon.png (1024x1024 - high res app icon)
- zito-wordmark.png (full text ZITO branding)
"""

from PIL import Image
import os

def create_favicons_from_icon():
    """
    Creates properly sized favicons from the app icon
    The Z icon should be extracted as a perfect square
    """
    frontend_public = r"C:\Users\Abcom\Desktop\Zito\frontend\public"
    backend_assets = r"C:\Users\Abcom\Desktop\Zito\backend\assets\branding"
    
    print("🎨 ZITO Logo Cutter - Creating properly sized logos...")
    print()
    
    # Check if source icon exists
    if os.path.exists(os.path.join(frontend_public, "zito-app-icon.png")):
        icon = Image.open(os.path.join(frontend_public, "zito-app-icon.png"))
        print(f"✓ Found app icon: {icon.size}")
        
        # Create favicon sizes
        sizes = [48, 96, 192, 256, 512]
        for size in sizes:
            resized = icon.resize((size, size), Image.Resampling.LANCZOS)
            
            # Save to frontend public
            favicon_path = os.path.join(frontend_public, f"favicon-{size}.png")
            resized.save(favicon_path)
            print(f"✓ Created favicon-{size}.png ({size}x{size})")
            
            # Also save to backend assets
            backend_favicon = os.path.join(backend_assets, f"favicon-{size}.png")
            resized.save(backend_favicon)
            print(f"  → Also saved to backend/assets/branding/")
    
    else:
        print("✗ zito-app-icon.png not found")
        return False
    
    print()
    print("═" * 60)
    print("📋 LOGO USAGE GUIDE:")
    print("═" * 60)
    print()
    print("🔷 Browser Favicon (favicon.ico):")
    print("  - favicon-48.png (48x48) - Main favicon")
    print("  - favicon-96.png (96x96) - High DPI displays")
    print()
    print("📱 App Icons:")
    print("  - favicon-192.png (192x192) - Android Chrome")
    print("  - favicon-256.png (256x256) - Larger displays")
    print("  - favicon-512.png (512x512) - App store/launcher")
    print()
    print("🎯 Cutting Instructions:")
    print("  1. The Z icon is PERFECT SQUARE - maintain aspect ratio")
    print("  2. Logo has BLUE to PURPLE gradient (top-left to bottom-right)")
    print("  3. Rounded corners with BLUE border/glow")
    print()
    return True

def verify_logo_cuts():
    """Verify all logo cuts are correct"""
    frontend_public = r"C:\Users\Abcom\Desktop\Zito\frontend\public"
    
    print("\n✓ Verifying logo files:")
    files = [
        "favicon-48.png",
        "favicon-96.png", 
        "favicon-192.png",
        "favicon-256.png",
        "favicon-512.png",
        "zito-app-icon.png",
        "zito-logo.png",
        "zito-wordmark.png"
    ]
    
    for fname in files:
        path = os.path.join(frontend_public, fname)
        if os.path.exists(path):
            img = Image.open(path)
            print(f"  ✓ {fname:<25} - {img.size[0]}x{img.size[1]}")
        else:
            print(f"  ✗ {fname:<25} - MISSING")

if __name__ == "__main__":
    create_favicons_from_icon()
    verify_logo_cuts()
    print("\n✅ Done!")
