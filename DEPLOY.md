# How to Update Your Deployment

When you make changes and want to update the live site:

## Option 1: Simple Command (Recommended)

**On Windows:**
```bash
deploy.bat "describe your changes"
```

**On Mac/Linux:**
```bash
./deploy.sh "describe your changes"
```

Example:
```bash
deploy.bat "Fixed login bug"
```

That's it! Netlify will automatically rebuild and update your site in 2-3 minutes.

---

## Option 2: Manual Steps

If you prefer to do it manually:

1. **Open terminal in your project folder**

2. **Stage your changes:**
   ```bash
   git add .
   ```

3. **Commit your changes:**
   ```bash
   git commit -m "describe your changes"
   ```

4. **Push to GitHub:**
   ```bash
   git push origin main
   ```

5. **Wait for Netlify to deploy** (2-3 minutes)
   - Go to your Netlify dashboard
   - Click "Deploys" tab to watch progress
   - Site will auto-update when complete

---

## Viewing Your Updated Site

After deployment completes:
- Visit your site URL
- If you see old content, hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

---

## Troubleshooting

**Build fails?**
- Check Netlify "Deploys" tab for error logs
- Verify environment variables are set:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

**Blank page?**
- Check browser console (F12 → Console tab)
- Verify environment variables in Netlify dashboard
