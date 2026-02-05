@echo off
echo ========================================
echo   Evident Edge - Setup and Deploy
echo ========================================
echo.

REM Check if git is initialized
if not exist ".git" (
    echo Setting up Git repository...
    git init
    git branch -M main

    echo Setting up remote...
    git remote add origin https://github.com/mtcarella/EvidentEdgeApp.git 2>nul
    if errorlevel 1 (
        echo Remote already exists, updating...
        git remote set-url origin https://github.com/mtcarella/EvidentEdgeApp.git
    )

    echo.
    echo Git repository initialized!
    echo.
)

REM Get commit message
if not "%~1"=="" (
    set message=%~1
) else (
    set /p message="Enter commit message (or press Enter for default): "
    if "%message%"=="" set message=Update deployment
)

echo.
echo Adding all changes...
git add .

echo Committing changes...
git commit -m "%message%"

echo.
echo Syncing with GitHub...
git fetch origin main

REM Check if we're in the middle of a rebase
git status | findstr /C:"rebase in progress" >nul
if not errorlevel 1 (
    echo.
    echo ========================================
    echo   Warning: Rebase in progress detected!
    echo ========================================
    echo.
    echo Run fix-git.bat to clean up, then try again.
    echo.
    pause
    exit /b 1
)

REM Try to pull with rebase to keep clean history
git pull origin main --rebase
if errorlevel 1 (
    echo.
    echo Note: If there are conflicts, run fix-git.bat
    pause
    exit /b 1
)

echo.
echo Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo.
    echo ========================================
    echo   X Push failed!
    echo   Trying to pull and merge first...
    echo ========================================
    echo.
    git pull origin main --rebase
    echo Retrying push...
    git push origin main
    if errorlevel 1 (
        echo.
        echo Push still failed. You may need to authenticate with GitHub.
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo   ✓ Deployment Complete!
echo ========================================
echo.
echo Your changes have been pushed to GitHub.
echo Netlify will automatically deploy in 2-3 minutes.
echo.
echo View deployment status:
echo https://app.netlify.com/
echo.
pause
