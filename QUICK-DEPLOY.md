# Quick Deployment Guide

## Easiest Way to Deploy (One Command!)

After you export from Bolt and extract to `C:\Ai\project`:

### Open Terminal in Project Folder
1. Press `Win + R`
2. Type: `cmd`
3. Press Enter
4. Type: `cd C:\Ai\project`
5. Press Enter

### Deploy with One Command
```bash
setup-and-deploy.bat "your message here"
```

**Example:**
```bash
setup-and-deploy.bat "Added rate limiting"
```

That's it! The script will:
1. ✓ Initialize git (if needed)
2. ✓ Set up GitHub remote (if needed)
3. ✓ Add all changes
4. ✓ Commit changes
5. ✓ Pull from GitHub
6. ✓ Push to GitHub
7. ✓ Netlify auto-deploys from GitHub

---

## Even Easier: Double-Click Method

1. Open `C:\Ai\project` in File Explorer
2. Double-click `setup-and-deploy.bat`
3. Type your commit message when prompted
4. Press Enter

Done! Wait 2-3 minutes for Netlify to deploy.

---

## What This Replaces

**OLD WAY (9 steps):**
1. Git init
2. Git branch -M main
3. Git add .
4. Git commit -m "message"
5. Git remote add origin...
6. Git pull origin main --rebase
7. Git push origin main --force

**NEW WAY (1 step):**
```bash
setup-and-deploy.bat "message"
```

---

## First Time Setup

If this is your first time, you might need to authenticate with GitHub:

1. When prompted, sign in to GitHub
2. The script will remember your credentials
3. Future deploys won't need authentication

---

## Viewing Your Live Site

After deployment completes (2-3 minutes):
- Your site URL: Check Netlify dashboard
- Hard refresh if needed: `Ctrl+Shift+R`

---

## Troubleshooting

**"Rebase in progress" or git errors?**
1. Double-click `fix-git.bat` in your project folder
2. Press Y to confirm
3. Wait for it to complete
4. Run `setup-and-deploy.bat` again

**"Authentication failed"?**
- Run: `git config --global credential.helper wincred`
- Run the deploy script again

**"Not a git repository"?**
- Make sure you're in `C:\Ai\project`
- The script will initialize git automatically

**Need to check deployment status?**
- Visit: https://app.netlify.com/
- Click on your site
- Click "Deploys" tab

---

## Fix Your Current Error

You have an interrupted rebase. Here's how to fix it:

### Quick Fix (Easiest)
1. Open `C:\Ai\project` in File Explorer
2. Double-click `fix-git.bat`
3. Press Y when prompted
4. After it completes, run `setup-and-deploy.bat` again

### Manual Fix (Alternative)
If you prefer manual commands:
```bash
cd C:\Ai\project
git rebase --abort
git fetch origin main
git reset --hard origin/main
setup-and-deploy.bat "your message"
```
