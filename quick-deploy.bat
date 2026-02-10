@echo off
echo ====================================
echo Evident Edge - Quick Deploy Script
echo ====================================
echo.

REM Check if we're in a git repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo Initializing Git repository...
    git init
    git branch -M main
    git remote add origin https://github.com/mtcarella/EvidentEdgeApp.git
) else (
    echo Git repository already initialized.
)

echo.
echo Staging all changes...
git add .

echo.
echo Committing changes...
set /p commit_msg="Enter commit message (or press Enter for default): "
if "%commit_msg%"=="" set commit_msg=Update deployment

git commit -m "%commit_msg%"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ====================================
echo Deployment complete!
echo ====================================
pause
