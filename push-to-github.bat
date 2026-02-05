@echo off
echo ========================================
echo   Push to GitHub
echo ========================================
echo.

REM Configure git user (safe to run multiple times)
echo Configuring git user...
git config --global user.name "mtcarella"
git config --global user.email "mtcarella@evidenttitle.com"

REM Check if git is initialized
if not exist ".git" (
    echo.
    echo Initializing git repository...
    git init
    git remote add origin https://github.com/mtcarella/EvidentEdgeApp.git
    echo Repository initialized!
    echo.
)

REM Show current status
echo Current changes:
echo ----------------------------------------
git status --short
echo ----------------------------------------
echo.

REM Ask for commit message
set /p commit_message="Enter commit message (or press Enter for 'Update application'): "
if "%commit_message%"=="" set commit_message=Update application

echo.
echo Adding all changes...
git add .

echo Committing changes...
git commit -m "%commit_message%"

if errorlevel 1 (
    echo.
    echo No changes to commit or commit failed.
    echo.
    pause
    exit /b 1
)

echo.
echo Pushing to GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo Push failed. Trying 'master' branch instead...
    git push -u origin master
)

if errorlevel 1 (
    echo.
    echo ========================================
    echo   Push failed!
    echo ========================================
    echo.
    echo This might be because:
    echo 1. You need to authenticate with GitHub
    echo 2. The branch name is different
    echo 3. There are conflicts to resolve
    echo.
    echo Try running: git push -u origin main
    echo Or: git push -u origin master
    echo.
) else (
    echo.
    echo ========================================
    echo   Successfully pushed to GitHub!
    echo ========================================
    echo.
)

pause
