#!/usr/bin/env python3
"""Generate favicon sizes from zito-app-icon.png"""

from PIL import Image
import os

source_icon = r"C:\Users\Abcom\Desktop\Zito\frontend\public\zito-app-icon.png"
target_dir = r"C:\Users\Abcom\Desktop\Zito\frontend\public"
backend_dir = r"C:\Users\Abcom\Desktop\Zito\backend\assets\branding"

if os.path.exists(source_icon):
    print("🎨 Creating favicon sizes from zito-app-icon.png...")
    icon = Image.open(source_icon)
    print(f"Source icon size: {icon.size}")
    
    # Create different sizes
    sizes = {
        48: "favicon-48.png",
        96: "favicon-96.png", 
        192: "favicon-192.png",
        256: "favicon-256.png",
        512: "favicon-512.png",
    }
    
    for size, filename in sizes.items():
        resized = icon.resize((size, size), Image.Resampling.LANCZOS)
        
        # Save to frontend public
        frontend_path = os.path.join(target_dir, filename)
        resized.save(frontend_path, "PNG")
        print(f"✓ Created {filename} ({size}x{size})")
        
        # Save to backend
        backend_path = os.path.join(backend_dir, filename)
        resized.save(backend_path, "PNG")
    
    # Create favicon.ico from 48x48
    favicon_ico = icon.resize((48, 48), Image.Resampling.LANCZOS)
    favicon_path = os.path.join(target_dir, "favicon.ico")
    favicon_ico.save(favicon_path, "ICO", sizes=[(48, 48)])
    print(f"✓ Created favicon.ico (48x48)")
    
    print("\n✅ All favicons created successfully!")
else:
    print(f"✗ Source file not found: {source_icon}")
