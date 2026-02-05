@echo off
echo ========================================
echo   Git Initial Setup
echo ========================================
echo.

echo Configuring git user...
git config --global user.name "mtcarella"
git config --global user.email "mtcarella@evidenttitle.com"

echo Initializing repository...
git init

echo Adding remote repository...
git remote add origin https://github.com/mtcarella/EvidentEdgeApp.git

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Your git is now configured with:
echo   Name: mtcarella
echo   Email: mtcarella@evidenttitle.com
echo   Repository: https://github.com/mtcarella/EvidentEdgeApp.git
echo.
echo You can now use push-to-github.bat to push your code!
echo.
pause
