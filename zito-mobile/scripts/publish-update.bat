@echo off
REM Publish OTA Update to EAS
REM This pushes code changes to already-installed APKs without needing to rebuild

echo.
echo ========================================
echo   ZITO - Publishing Over-The-Air Update
echo ========================================
echo.
echo This will push your code changes to all installed Zito apps.
echo The update will be installed next time the app restarts.
echo.

REM Check if logged into EAS
npx eas whoami >nul 2>&1
if errorlevel 1 (
  echo [!] Not logged into EAS. Logging in...
  call npx eas login
)

REM Publish update
echo.
echo [*] Publishing to Android...
call npx eas update --platform android

echo.
echo ========================================
echo   Update Published Successfully! ✓
echo ========================================
echo.
echo On your device:
echo   1. Close the Zito app completely
echo   2. Reopen the app
echo   3. You'll see "Checking for updates..." briefly
echo   4. The new version will install automatically
echo.
pause
