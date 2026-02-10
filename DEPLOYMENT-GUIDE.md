# Deployment Guide

## STOP! Don't Type Git Commands Manually

You already have automated scripts that do everything for you. Instead of typing git commands, just run:

```bash
setup-and-deploy.bat
```

Or double-click `setup-and-deploy.bat` in File Explorer.

---

## Why Your Manual Process Has Problems

Your current manual process has these issues:

1. **Repetitive `git remote add origin`** - You only need to add the remote once. After that, it's saved in your Git configuration.

2. **"Refusing to merge unrelated histories"** - This happens when your local repository and GitHub repository have diverged (different commit histories).

3. **Force pushing** - Using `--force` overwrites GitHub's history with your local history, which can cause data loss if multiple people are working on the project.

## Solution: Use the Automated Scripts

### Option 1: Simple Deploy (Recommended for regular updates)

Use this once your repository is already set up:

```bash
deploy-simple.bat
```

This script:
- Stages all changes
- Asks for a commit message
- Commits the changes
- Pushes to GitHub
- If push fails, it automatically pulls and rebases, then retries

### Option 2: Quick Deploy (For first-time setup or troubleshooting)

Use this if you need to initialize or reset your repository:

```bash
quick-deploy.bat
```

This script:
- Checks if Git is initialized (only initializes if needed)
- Only adds the remote if it doesn't exist
- Stages, commits, and pushes changes

## Manual Workflow (If you prefer command line)

### First Time Setup (One time only!)
```bash
cd c:\ai\project
git init
git branch -M main
git remote add origin https://github.com/mtcarella/EvidentEdgeApp.git
```

### Regular Updates (Every time you deploy)
```bash
cd c:\ai\project
git add .
git commit -m "your commit message"
git pull origin main --rebase
git push origin main
```

**Key Points:**
- You should NOT run `git init` or `git remote add` every time
- Using `--rebase` when pulling prevents the "unrelated histories" error
- You should NOT need `--force` in normal operation

## Fixing Line Ending Warnings

The warnings about "LF will be replaced by CRLF" are normal on Windows. To eliminate them, run this once:

```bash
git config core.autocrlf true
```

## If You Need to Force Push (Emergency Only)

Only use force push if you're absolutely sure you want to overwrite GitHub's history:

```bash
git push origin main --force
```

**Warning:** This can cause data loss if others are working on the project or if you have changes on GitHub that aren't in your local repository.
