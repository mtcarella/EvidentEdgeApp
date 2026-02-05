# How to Deploy - Simple Guide

## What You Should Do

### Option 1: Double-Click Method (Easiest)
1. Open `C:\Ai\project` in File Explorer
2. Double-click **`setup-and-deploy.bat`**
3. Enter your commit message
4. Press Enter
5. Done!

### Option 2: Command Line
```bash
cd C:\Ai\project
setup-and-deploy.bat "your commit message here"
```

---

## What You Were Doing (and Why It's Wrong)

You were manually typing these commands every time:
```bash
git init
git branch -M main
git add .
git commit -m "message"
git remote add origin https://github.com/mtcarella/EvidentEdgeApp.git
git pull origin main
git push origin main --force
```

### Problems with This Approach:

1. **`git remote add origin` fails** - You only need to add the remote ONCE, not every time. That's why you get "remote origin already exists."

2. **`git pull origin main` fails** - Gets "refusing to merge unrelated histories" because your local and remote histories have diverged.

3. **`--force` is dangerous** - Force pushing overwrites GitHub's history. If multiple people work on the project, this causes data loss.

4. **It's repetitive** - You're typing 7+ commands when you should type 1.

---

## How the Script Works

The `setup-and-deploy.bat` script automatically:

1. ✓ Checks if Git is initialized (initializes only if needed)
2. ✓ Checks if remote exists (adds only if needed)
3. ✓ Stages all changes
4. ✓ Commits with your message
5. ✓ Pulls from GitHub with rebase (no conflicts)
6. ✓ Pushes to GitHub (no force needed)

---

## First Time Only: Fix Your Git Config

Run this once to stop the line ending warnings:

**Option 1: Use the script**
```bash
fix-git-config.bat
```

**Option 2: Manual command**
```bash
git config core.autocrlf true
```

---

## Summary

**DON'T DO THIS:**
```bash
git init
git remote add origin https://github.com/...
git pull origin main
git push origin main --force
```

**DO THIS:**
```bash
setup-and-deploy.bat "your message"
```

That's it!
