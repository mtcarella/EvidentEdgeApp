@echo off
echo ========================================
echo   Git Repository Fix
echo ========================================
echo.

echo Checking git status...
git status

echo.
echo This will abort any in-progress rebase/merge and clean up your git state.
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

echo Aborting any in-progress merge...
git merge --abort 2>nul

echo.
echo Cleaning up git state...
if exist ".git\rebase-merge" (
    rmdir /s /q ".git\rebase-merge"
    echo Removed rebase-merge directory
)

if exist ".git\MERGE_HEAD" (
    del /f /q ".git\MERGE_HEAD"
    echo Removed MERGE_HEAD file
)

echo.
echo Adding all current files...
git add .

echo.
echo ========================================
echo   ✓ Git repository cleaned!
echo ========================================
echo.
echo Now run sync-with-github.bat to complete the sync.
echo.
pause
