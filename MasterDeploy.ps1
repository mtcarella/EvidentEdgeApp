# ============================================================================
# MasterDeploy - Comprehensive Git Deployment Script (PowerShell)
# ============================================================================
# This script handles the complete deployment process for the Evident Edge App
# including initialization, committing changes, and pushing to GitHub
# ============================================================================

# Requires -Version 5.1

# Set error action preference to stop on errors
$ErrorActionPreference = "Stop"

# Function to display colored messages
function Write-Step {
    param(
        [string]$Message,
        [string]$Type = "INFO"
    )

    $timestamp = Get-Date -Format "HH:mm:ss"
    switch ($Type) {
        "SUCCESS" { Write-Host "[$timestamp] [SUCCESS] $Message" -ForegroundColor Green }
        "ERROR" { Write-Host "[$timestamp] [ERROR] $Message" -ForegroundColor Red }
        "WARNING" { Write-Host "[$timestamp] [WARNING] $Message" -ForegroundColor Yellow }
        "INFO" { Write-Host "[$timestamp] [INFO] $Message" -ForegroundColor Cyan }
        "STEP" { Write-Host "`n[$timestamp] $Message" -ForegroundColor White -BackgroundColor DarkBlue }
    }
}

function Write-Header {
    param([string]$Text)
    Write-Host "`n============================================================================" -ForegroundColor Magenta
    Write-Host "  $Text" -ForegroundColor Magenta
    Write-Host "============================================================================`n" -ForegroundColor Magenta
}

# Main deployment process
try {
    Clear-Host
    Write-Header "MASTER DEPLOYMENT SCRIPT - Evident Edge Application"

    # ============================================================================
    # STEP 1: Navigate to project directory
    # ============================================================================
    Write-Step "[STEP 1/7] Navigating to project directory..." -Type "STEP"

    $projectPath = "c:\ai\project"
    if (-not (Test-Path $projectPath)) {
        Write-Step "Project directory does not exist: $projectPath" -Type "ERROR"
        Write-Host "`nPlease verify the directory path and try again."
        Read-Host "`nPress Enter to exit"
        exit 1
    }

    Set-Location $projectPath
    Write-Step "Changed directory to: $(Get-Location)" -Type "SUCCESS"

    # ============================================================================
    # STEP 2: Initialize Git repository (if not already initialized)
    # ============================================================================
    Write-Step "[STEP 2/7] Initializing Git repository..." -Type "STEP"

    if (-not (Test-Path ".git")) {
        git init
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to initialize Git repository"
        }
        Write-Step "Git repository initialized" -Type "SUCCESS"
    }
    else {
        Write-Step "Git repository already initialized" -Type "INFO"
    }

    # ============================================================================
    # STEP 3: Set main branch
    # ============================================================================
    Write-Step "[STEP 3/7] Setting main branch..." -Type "STEP"

    git branch -M main
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set main branch"
    }
    Write-Step "Main branch set" -Type "SUCCESS"

    # ============================================================================
    # STEP 4: Get commit message from user
    # ============================================================================
    Write-Step "[STEP 4/7] Preparing commit..." -Type "STEP"

    $commitMessage = Read-Host "Enter commit message (or press Enter for default)"
    if ([string]::IsNullOrWhiteSpace($commitMessage)) {
        $commitMessage = "Deployment update - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        Write-Step "Using default commit message: $commitMessage" -Type "INFO"
    }

    # ============================================================================
    # STEP 5: Stage and commit changes
    # ============================================================================
    Write-Step "[STEP 5/7] Staging and committing changes..." -Type "STEP"

    # Check if there are changes to commit
    $status = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Step "No changes detected in the working directory" -Type "WARNING"
    }
    else {
        git add .
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to stage changes"
        }
        Write-Step "All changes staged" -Type "SUCCESS"

        git commit -m "$commitMessage"
        if ($LASTEXITCODE -ne 0) {
            Write-Step "Commit failed - possibly no changes to commit" -Type "WARNING"
        }
        else {
            Write-Step "Changes committed successfully" -Type "SUCCESS"
        }
    }

    # ============================================================================
    # STEP 6: Configure remote repository
    # ============================================================================
    Write-Step "[STEP 6/7] Configuring remote repository..." -Type "STEP"

    $remoteUrl = "https://github.com/mtcarella/EvidentEdgeApp.git"
    $remoteExists = git remote get-url origin 2>$null

    if ($LASTEXITCODE -ne 0) {
        git remote add origin $remoteUrl
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to add remote origin"
        }
        Write-Step "Remote origin added" -Type "SUCCESS"
    }
    else {
        Write-Step "Remote origin already configured" -Type "INFO"
        git remote set-url origin $remoteUrl
        Write-Step "Remote origin URL updated" -Type "SUCCESS"
    }

    # ============================================================================
    # STEP 7: Pull and push changes
    # ============================================================================
    Write-Step "[STEP 7/7] Synchronizing with remote repository..." -Type "STEP"

    Write-Step "Pulling latest changes from remote..." -Type "INFO"
    git pull origin main --rebase 2>$null

    if ($LASTEXITCODE -ne 0) {
        Write-Step "Pull failed or conflicts detected" -Type "WARNING"
        Write-Host "`nYou may need to resolve conflicts manually"

        $continue = Read-Host "`nDo you want to continue with force push? (Y/N)"
        if ($continue -ne 'Y' -and $continue -ne 'y') {
            Write-Step "Deployment cancelled by user" -Type "WARNING"
            Read-Host "`nPress Enter to exit"
            exit 0
        }
    }

    # ============================================================================
    # FORCE PUSH WARNING
    # ============================================================================
    Write-Host "`n"
    Write-Header "WARNING - FORCE PUSH"

    Write-Host "You are about to FORCE PUSH to the main branch." -ForegroundColor Yellow
    Write-Host "This will OVERWRITE the remote repository with your local changes.`n" -ForegroundColor Yellow

    Write-Host "This action:" -ForegroundColor White
    Write-Host "  - Cannot be undone" -ForegroundColor Red
    Write-Host "  - Will overwrite any changes on the remote" -ForegroundColor Red
    Write-Host "  - May cause data loss for other collaborators" -ForegroundColor Red
    Write-Host ""
    Write-Host "Repository: $remoteUrl" -ForegroundColor Cyan
    Write-Host "Branch: main" -ForegroundColor Cyan
    Write-Host ""

    $confirmation = Read-Host "Are you sure you want to proceed with FORCE PUSH? (Type 'YES' to confirm)"

    if ($confirmation -ne 'YES') {
        Write-Host "`n"
        Write-Step "Deployment cancelled by user" -Type "WARNING"
        Write-Step "Your local changes have been committed but not pushed" -Type "INFO"
        Read-Host "`nPress Enter to exit"
        exit 0
    }

    Write-Host "`n"
    Write-Step "Pushing changes to remote repository..." -Type "INFO"

    git push origin main --force
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to push changes to remote repository"
    }

    # ============================================================================
    # DEPLOYMENT COMPLETE
    # ============================================================================
    Write-Host "`n"
    Write-Header "DEPLOYMENT COMPLETED SUCCESSFULLY!"

    Write-Host "Commit Message: $commitMessage" -ForegroundColor Green
    Write-Host "Repository: $remoteUrl" -ForegroundColor Green
    Write-Host "Branch: main" -ForegroundColor Green
    Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
    Write-Host "`nYour changes have been successfully deployed to GitHub.`n" -ForegroundColor Green

    Read-Host "Press Enter to exit"
    exit 0
}
catch {
    Write-Host "`n"
    Write-Step "Deployment failed: $_" -Type "ERROR"
    Write-Host "`nCommon issues:" -ForegroundColor Yellow
    Write-Host "  1. Check your internet connection" -ForegroundColor White
    Write-Host "  2. Verify you have write access to the repository" -ForegroundColor White
    Write-Host "  3. Ensure your Git credentials are configured" -ForegroundColor White
    Write-Host "  4. Check if Git is installed and in your PATH" -ForegroundColor White
    Write-Host ""

    Read-Host "Press Enter to exit"
    exit 1
}
