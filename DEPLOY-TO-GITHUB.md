# 🚀 Deploy to GitHub - Quick Reference

## ⚡ First Time? Start Here!

### Step 1: Run Initial Setup

**Windows:**
```bash
github-setup.bat
```

**Mac/Linux:**
```bash
./github-setup.sh
```

This configures everything automatically and pushes your first commit.

---

## 📦 Regular Deployments (After Initial Setup)

### Windows Users

**Recommended (handles merge conflicts):**
```bash
setup-and-deploy.bat
```

**Quick deploy (when no conflicts expected):**
```bash
deploy-simple.bat
```

**Fastest (basic git push):**
```bash
deploy.bat
```

### Mac/Linux Users

```bash
./deploy.sh "Your commit message"
```

Or just:
```bash
./deploy.sh
```

---

## 🔐 GitHub Authentication

When prompted for credentials:
- **Username**: mtcarella
- **Password**: Use a Personal Access Token (NOT your GitHub password)

### How to Get a Personal Access Token:

1. Visit: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Give it a name like "EvidentEdge Deploy"
4. Select scope: **`repo`** (Full control of private repositories)
5. Click **Generate token**
6. **Copy the token immediately** (you won't see it again!)
7. Use this token as your password when Git asks

---

## 📍 Your Repository

- **URL**: https://github.com/mtcarella/EvidentEdgeApp.git
- **Branch**: main
- **User**: mtcarella
- **Email**: mtcarella@evidenttitle.com

---

## 🛠️ Troubleshooting

### "rejected - fetch first" Error?

This happens when GitHub has files that aren't in your local copy (like a README).

**Quick Fix:**

**Windows:**
```bash
sync-with-github.bat
```

**Mac/Linux:**
```bash
./sync-with-github.sh
```

This will merge the remote files with your local files and sync everything.

### "Push Failed" Error?

Try:
```bash
fix-git.bat          # Windows
```

### Remote URL Wrong?

```bash
fix-git-config.bat   # Windows
```

### Still Having Issues?

1. Check if the repository exists on GitHub: https://github.com/mtcarella/EvidentEdgeApp
2. If not, create it at: https://github.com/new (name it `EvidentEdgeApp`)
3. Make sure your Personal Access Token has `repo` scope
4. Run `sync-with-github.bat` to sync, then try again

---

## 📋 Typical Workflow

1. **Make changes** to your code
2. **Test** that everything works
3. **Run** `setup-and-deploy.bat` (Windows) or `./deploy.sh` (Mac/Linux)
4. **Enter** a commit message describing your changes
5. **Done!** Your changes are now on GitHub

---

## 💡 Pro Tips

- **Commit messages** should be clear: "Fixed login bug" not "updates"
- **Deploy often** - Small frequent commits are better than large ones
- **Pull before push** - If working with a team, always sync first
- The `.env` file is **never** committed (it's in .gitignore for security)

---

## 🎯 What Gets Deployed?

Everything except:
- `node_modules/` (dependencies)
- `dist/` (build output)
- `.env` (environment variables)
- `*.log` (log files)
- `.DS_Store` (Mac system files)

These are automatically ignored by `.gitignore`.

---

## 📞 Need Help?

If you see any errors, read the error message carefully. Most issues are:
1. **Authentication** - Need a Personal Access Token
2. **Repository doesn't exist** - Create it on GitHub first
3. **Merge conflicts** - Use `setup-and-deploy.bat` instead of `deploy-simple.bat`
