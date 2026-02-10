@echo off
echo ========================================
echo   Evident Edge - Quick Deploy Script
echo ========================================
echo.

REM Check if we're in a git repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo Error: Not a git repository!
    echo Please run this script from your project root.
    pause
    exit /b 1
)

REM Use first argument as message, or prompt if not provided
if not "%~1"=="" (
    set message=%~1
) else (
    set /p message="Enter commit message (or press Enter for default): "
    if "%message%"=="" set message=Update deployment
)

echo.
echo Checking for changes...
git diff-index --quiet HEAD
if not errorlevel 1 (
    echo No changes to commit.
    pause
    exit /b 0
)

echo Adding all changes...
git add .

echo Committing changes...
git commit -m "%message%"

echo Pushing to GitHub...
git push
if errorlevel 1 (
    echo.
    echo ========================================
    echo   X Push failed!
    echo   Check your git configuration.
    echo ========================================
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Deployment complete!
echo   Netlify will auto-deploy from GitHub.
echo   Check your Netlify dashboard.
echo ========================================
echo.
pause
