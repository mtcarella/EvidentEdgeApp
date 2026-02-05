@echo off
REM Quick push with automatic commit message
git config --global user.name "mtcarella"
git config --global user.email "mtcarella@evidenttitle.com"
echo Pushing changes to GitHub...
git add .
git commit -m "Quick update - %date% %time%"
git push origin main || git push origin master
echo.
if errorlevel 1 (
    echo Push failed - see push-to-github.bat for more options
) else (
    echo Successfully pushed!
)
pause
