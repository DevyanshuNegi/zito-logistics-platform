@echo off
REM Setup flavor-specific icon assets for Windows
REM Run this once to create the necessary icon files for each flavor

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Setting up flavor-specific icons...
echo ========================================
echo.

REM Check if base icons exist
if not exist "assets\images\icon.png" (
  echo [X] Error: icon.png not found in assets\images\
  exit /b 1
)

REM Create Customer app icons
echo [*] Creating Customer app icons...
if not exist "assets\images\icon-customer.png" (
  copy "assets\images\icon.png" "assets\images\icon-customer.png" >nul
  echo [+] icon-customer.png
)
if not exist "assets\images\android-icon-customer-foreground.png" (
  copy "assets\images\android-icon-foreground.png" "assets\images\android-icon-customer-foreground.png" >nul
  echo [+] android-icon-customer-foreground.png
)

REM Create Partner app icons
echo [*] Creating Partner app icons...
if not exist "assets\images\icon-partner.png" (
  copy "assets\images\icon.png" "assets\images\icon-partner.png" >nul
  echo [+] icon-partner.png
)
if not exist "assets\images\android-icon-partner-foreground.png" (
  copy "assets\images\android-icon-foreground.png" "assets\images\android-icon-partner-foreground.png" >nul
  echo [+] android-icon-partner-foreground.png
)

REM Create Admin app icons
echo [*] Creating Admin app icons...
if not exist "assets\images\icon-admin.png" (
  copy "assets\images\icon.png" "assets\images\icon-admin.png" >nul
  echo [+] icon-admin.png
)
if not exist "assets\images\android-icon-admin-foreground.png" (
  copy "assets\images\android-icon-foreground.png" "assets\images\android-icon-admin-foreground.png" >nul
  echo [+] android-icon-admin-foreground.png
)

echo.
echo ========================================
echo   Icon setup complete!
echo ========================================
echo.
echo Optional: Customize each flavor's icons
echo   - assets\images\icon-customer.png
echo   - assets\images\icon-partner.png
echo   - assets\images\icon-admin.png
echo.
echo [Ready to build]
echo.
pause
