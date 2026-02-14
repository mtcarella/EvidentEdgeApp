@echo off
REM ============================================================================
REM MasterDeploy - Comprehensive Git Deployment Script
REM ============================================================================
REM This script handles the complete deployment process for the Evident Edge App
REM including initialization, committing changes, and pushing to GitHub
REM ============================================================================

setlocal enabledelayedexpansion

REM Set console colors for better readability
color 0A

echo.
echo ============================================================================
echo                    MASTER DEPLOYMENT SCRIPT
echo                    Evident Edge Application
echo ============================================================================
echo.

REM ============================================================================
REM STEP 1: Navigate to project directory
REM ============================================================================
echo [STEP 1/7] Navigating to project directory...
cd /d "c:\ai\project"
if errorlevel 1 (
    echo [ERROR] Failed to navigate to c:\ai\project
    echo Please verify the directory exists and try again.
    pause
    exit /b 1
)
echo [SUCCESS] Changed directory to: %CD%
echo.

REM ============================================================================
REM STEP 2: Initialize Git repository (if not already initialized)
REM ============================================================================
echo [STEP 2/7] Initializing Git repository...
if not exist ".git" (
    git init
    if errorlevel 1 (
        echo [ERROR] Failed to initialize Git repository
        pause
        exit /b 1
    )
    echo [SUCCESS] Git repository initialized
) else (
    echo [INFO] Git repository already initialized
)
echo.

REM ============================================================================
REM STEP 3: Set main branch
REM ============================================================================
echo [STEP 3/7] Setting main branch...
git branch -M main
if errorlevel 1 (
    echo [ERROR] Failed to set main branch
    pause
    exit /b 1
)
echo [SUCCESS] Main branch set
echo.

REM ============================================================================
REM STEP 4: Get commit message from user
REM ============================================================================
echo [STEP 4/7] Preparing commit...
set /p COMMIT_MESSAGE="Enter commit message (or press Enter for default): "
if "!COMMIT_MESSAGE!"=="" (
    set COMMIT_MESSAGE=Deployment update - %DATE% %TIME%
    echo [INFO] Using default commit message: !COMMIT_MESSAGE!
)
echo.

REM ============================================================================
REM STEP 5: Stage and commit changes
REM ============================================================================
echo [STEP 5/7] Staging all changes...
git add .
if errorlevel 1 (
    echo [ERROR] Failed to stage changes
    pause
    exit /b 1
)
echo [SUCCESS] All changes staged

echo.
echo Committing changes...
git commit -m "!COMMIT_MESSAGE!"
if errorlevel 1 (
    echo [WARNING] Commit failed - possibly no changes to commit
    echo Continuing with deployment...
)
echo [SUCCESS] Changes committed
echo.

REM ============================================================================
REM STEP 6: Configure remote repository
REM ============================================================================
echo [STEP 6/7] Configuring remote repository...

REM Check if remote already exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [INFO] Adding remote origin...
    git remote add origin https://github.com/mtcarella/EvidentEdgeApp.git
    if errorlevel 1 (
        echo [ERROR] Failed to add remote origin
        pause
        exit /b 1
    )
    echo [SUCCESS] Remote origin added
) else (
    echo [INFO] Remote origin already configured
    git remote set-url origin https://github.com/mtcarella/EvidentEdgeApp.git
    echo [SUCCESS] Remote origin URL updated
)
echo.

REM ============================================================================
REM STEP 7: Pull and push changes
REM ============================================================================
echo [STEP 7/7] Synchronizing with remote repository...
echo.
echo [INFO] Pulling latest changes from remote...
git pull origin main --rebase
if errorlevel 1 (
    echo [WARNING] Pull failed or conflicts detected
    echo You may need to resolve conflicts manually
    echo.
    choice /C YN /M "Do you want to continue with force push"
    if errorlevel 2 (
        echo [CANCELLED] Deployment cancelled by user
        pause
        exit /b 1
    )
)
echo.

REM ============================================================================
REM FORCE PUSH WARNING
REM ============================================================================
echo.
echo ============================================================================
echo                         WARNING - FORCE PUSH
echo ============================================================================
echo You are about to FORCE PUSH to the main branch.
echo This will OVERWRITE the remote repository with your local changes.
echo.
echo This action:
echo   - Cannot be undone
echo   - Will overwrite any changes on the remote
echo   - May cause data loss for other collaborators
echo.
echo Repository: https://github.com/mtcarella/EvidentEdgeApp.git
echo Branch: main
echo ============================================================================
echo.

choice /C YN /M "Are you sure you want to proceed with FORCE PUSH"
if errorlevel 2 (
    echo.
    echo [CANCELLED] Deployment cancelled by user
    echo [INFO] Your local changes have been committed but not pushed
    pause
    exit /b 0
)

echo.
echo [INFO] Pushing changes to remote repository...
git push origin main --force
if errorlevel 1 (
    echo [ERROR] Failed to push changes to remote repository
    echo.
    echo Common issues:
    echo   1. Check your internet connection
    echo   2. Verify you have write access to the repository
    echo   3. Ensure your Git credentials are configured
    echo.
    pause
    exit /b 1
)

REM ============================================================================
REM DEPLOYMENT COMPLETE
REM ============================================================================
echo.
echo ============================================================================
echo                    DEPLOYMENT COMPLETED SUCCESSFULLY!
echo ============================================================================
echo.
echo Commit Message: !COMMIT_MESSAGE!
echo Repository: https://github.com/mtcarella/EvidentEdgeApp.git
echo Branch: main
echo Time: %DATE% %TIME%
echo.
echo Your changes have been successfully deployed to GitHub.
echo ============================================================================
echo.

pause
exit /b 0
