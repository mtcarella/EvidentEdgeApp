@echo off
echo ========================================
echo   Evident Edge - GitHub Setup
echo ========================================
echo.
echo This script will:
echo   1. Configure your Git identity
echo   2. Initialize Git repository (if needed)
echo   3. Set up GitHub remote
echo   4. Push your first commit
echo.
echo You only need to run this ONCE for initial setup.
echo After that, use setup-and-deploy.bat for all updates.
echo.
pause

REM Configure Git user settings
echo.
echo Configuring Git identity...
git config --global user.name "mtcarella"
git config --global user.email "mtcarella@evidenttitle.com"

REM Configure line endings for Windows
git config --global core.autocrlf true

echo Git identity configured:
git config user.name
git config user.email
echo.

REM Check if git is initialized
if not exist ".git" (
    echo Initializing Git repository...
    git init
    git branch -M main
    echo.
) else (
    echo Git repository already initialized.
    echo.
)

REM Set up remote
echo Setting up GitHub remote...
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin https://github.com/mtcarella/EvidentEdgeApp.git
    echo Remote added successfully.
) else (
    echo Remote already exists, updating...
    git remote set-url origin https://github.com/mtcarella/EvidentEdgeApp.git
    echo Remote updated successfully.
)

echo.
echo Current remote URL:
git remote get-url origin
echo.

REM Create .gitignore if it doesn't exist
if not exist ".gitignore" (
    echo Creating .gitignore file...
    (
        echo node_modules
        echo dist
        echo .DS_Store
        echo *.log
        echo .env.local
    ) > .gitignore
)

REM Add all files
echo Adding all files to Git...
git add .

REM Commit
set /p commit_msg="Enter commit message (or press Enter for 'Initial commit'): "
if "%commit_msg%"=="" set commit_msg=Initial commit

echo.
echo Committing changes...
git commit -m "%commit_msg%"

REM Push to GitHub
echo.
echo Pushing to GitHub...
echo Note: You may need to authenticate with GitHub.
echo If prompted, use your GitHub Personal Access Token as password.
echo.

git push -u origin main

if errorlevel 1 (
    echo.
    echo ========================================
    echo   X Push failed!
    echo ========================================
    echo.
    echo This is likely because:
    echo   1. You need to authenticate with GitHub
    echo   2. The repository doesn't exist yet on GitHub
    echo   3. You don't have write access to the repository
    echo.
    echo To fix authentication:
    echo   1. Go to: https://github.com/settings/tokens
    echo   2. Generate a new Personal Access Token (classic)
    echo   3. Select 'repo' scope
    echo   4. Use the token as your password when prompted
    echo.
    echo Or create the repository first at:
    echo https://github.com/new
    echo Name it: EvidentEdgeApp
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ✓ Setup Complete!
echo ========================================
echo.
echo Your repository is now connected to GitHub!
echo.
echo For future updates, simply run:
echo   setup-and-deploy.bat
echo.
echo Or for quick updates without merge handling:
echo   deploy-simple.bat
echo.
pause
