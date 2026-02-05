@echo off
echo ====================================
echo Git Configuration Fix
echo ====================================
echo.
echo This script will configure Git to:
echo 1. Handle line endings properly on Windows
echo 2. Set up your Git remote correctly
echo.
echo You only need to run this once.
echo.
pause

REM Configure line endings for Windows
echo Configuring line endings...
git config core.autocrlf true

REM Ensure we're on main branch
echo Ensuring main branch...
git branch -M main

REM Check if remote exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adding remote origin...
    git remote add origin https://github.com/mtcarella/EvidentEdgeApp.git
) else (
    echo Remote origin already configured.
    echo Current remote URL:
    git remote get-url origin
)

echo.
echo ====================================
echo Configuration complete!
echo ====================================
echo.
echo You can now use deploy-simple.bat for all future deployments.
echo.
pause
