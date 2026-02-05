@echo off
echo ====================================
echo Evident Edge - Simple Deploy
echo ====================================
echo.

REM Stage all changes
git add .

REM Commit with message
set /p commit_msg="Enter commit message: "
if "%commit_msg%"=="" (
    echo Error: Commit message required
    pause
    exit /b 1
)

git commit -m "%commit_msg%"

REM Push to GitHub
echo.
echo Pushing to GitHub...
git push origin main

if errorlevel 1 (
    echo.
    echo Push failed. Trying to pull and merge first...
    git pull origin main --rebase
    echo.
    echo Retrying push...
    git push origin main
)

echo.
echo ====================================
echo Deployment complete!
echo ====================================
pause
