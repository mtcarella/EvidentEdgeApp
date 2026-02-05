# GitHub Deployment Instructions

## Quick Start

1. **Double-click** `push-to-github.bat` in your project folder
2. Enter a commit message (or press Enter for default)
3. Done! Your code is pushed to GitHub

## What the Script Does

The script automatically:
- ✅ Initializes git (if needed)
- ✅ Adds all your changes
- ✅ Commits with your message
- ✅ Pushes to GitHub

## First Time Setup

The scripts automatically configure git with your credentials:
- Username: mtcarella
- Email: mtcarella@evidenttitle.com

If this is your first time pushing to GitHub, you may need to authenticate:

### Option 1: GitHub Desktop (Easiest)
1. Install [GitHub Desktop](https://desktop.github.com/)
2. Sign in with your GitHub account
3. Run the script - it will use your credentials

### Option 2: Personal Access Token
1. Go to GitHub.com → Settings → Developer settings → Personal access tokens
2. Generate a new token with `repo` permissions
3. When prompted for password, use the token instead

### Option 3: SSH Key
1. Generate SSH key: `ssh-keygen -t ed25519 -C "your_email@example.com"`
2. Add key to GitHub: Settings → SSH and GPG keys
3. Update remote URL: `git remote set-url origin git@github.com:mtcarella/EvidentEdgeApp.git`

## Troubleshooting

### "Push failed" error
- Make sure you're logged into GitHub
- Check your internet connection
- Try running: `git pull origin main` first (in case remote has changes)

### "Authentication failed"
- Use GitHub Desktop for easiest authentication
- Or set up a Personal Access Token

### Different branch name
The script tries both `main` and `master` branches. If your branch is different:
```bash
git push -u origin your-branch-name
```

## Manual Commands (if needed)

If you prefer to run commands manually:
```bash
git add .
git commit -m "Your message here"
git push origin main
```

## Repository Location
- Local: `c:\ai\project`
- Remote: `https://github.com/mtcarella/EvidentEdgeApp.git`
