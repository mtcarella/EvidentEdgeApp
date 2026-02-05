@echo off
echo ========================================
echo   Sync with GitHub (First Time)
echo ========================================
echo.
echo This script will:
echo   1. Pull any existing files from GitHub
echo   2. Merge them with your local files
echo   3. Push everything to GitHub
echo.
pause

echo.
echo Fetching remote changes...
git fetch origin main

echo.
echo Merging remote changes (allowing unrelated histories)...
git pull origin main --allow-unrelated-histories --no-rebase

if errorlevel 1 (
    echo.
    echo ========================================
    echo   Merge Conflict Detected
    echo ========================================
    echo.
    echo Please resolve the conflicts manually, then run:
    echo   git add .
    echo   git commit -m "Merge remote changes"
    echo   git push origin main
    echo.
    pause
    exit /b 1
)

echo.
echo Pushing all changes to GitHub...
git push origin main

if errorlevel 1 (
    echo.
    echo ========================================
    echo   X Push still failed!
    echo ========================================
    echo.
    echo Please check your authentication.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ✓ Successfully Synced with GitHub!
echo ========================================
echo.
echo Your local and remote repositories are now in sync.
echo.
echo For future deployments, use:
echo   setup-and-deploy.bat
echo.
pause
