@echo off
echo ========================================
echo   Git Repository Fix
echo ========================================
echo.

echo Checking git status...
git status

echo.
echo This will abort any in-progress rebase and clean up your git state.
echo.
set /p confirm="Continue? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo Aborting any in-progress rebase...
git rebase --abort 2>nul

echo.
echo Cleaning up git state...
if exist ".git\rebase-merge" (
    rmdir /s /q ".git\rebase-merge"
    echo Removed rebase-merge directory
)

echo.
echo Resetting to remote state...
git fetch origin main
git reset --hard origin/main

echo.
echo ========================================
echo   ✓ Git repository fixed!
echo ========================================
echo.
echo You can now run setup-and-deploy.bat again.
echo.
pause
