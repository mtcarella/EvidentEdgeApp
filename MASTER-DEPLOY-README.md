# MasterDeploy Scripts - User Guide

## Overview
Two comprehensive deployment scripts for the Evident Edge Application that automate the Git deployment process to GitHub.

## Available Scripts

### 1. MasterDeploy.bat (Batch File)
- **Best for**: Quick execution, traditional Windows users
- **Execution**: Double-click the file or run from Command Prompt

### 2. MasterDeploy.ps1 (PowerShell)
- **Best for**: Advanced users, better error handling, colored output
- **Execution**: Right-click → "Run with PowerShell" or run from PowerShell terminal

## Features

Both scripts include:
- ✅ Automatic Git repository initialization
- ✅ Interactive commit message input
- ✅ Configurable remote repository
- ✅ Automatic staging of all changes
- ✅ Pull with rebase before push
- ✅ Force push capability with confirmation prompts
- ✅ Comprehensive error handling
- ✅ Step-by-step progress indicators
- ✅ Safety warnings before destructive operations

## How to Use

### Method 1: Double-Click Execution
1. Navigate to the project folder: `c:\ai\project`
2. Double-click `MasterDeploy.bat` or `MasterDeploy.ps1`
3. Follow the on-screen prompts

### Method 2: Command Line Execution

**For Batch File:**
```cmd
cd c:\ai\project
MasterDeploy.bat
```

**For PowerShell:**
```powershell
cd c:\ai\project
.\MasterDeploy.ps1
```

### Method 3: PowerShell with Execution Policy Bypass
If you get an execution policy error with PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File "c:\ai\project\MasterDeploy.ps1"
```

## What Each Script Does

### Step 1: Navigate to Project Directory
Changes to `c:\ai\project` where your code is located.

### Step 2: Initialize Git Repository
Creates a new Git repository if one doesn't exist.

### Step 3: Set Main Branch
Ensures the primary branch is named "main".

### Step 4: Get Commit Message
Prompts you to enter a commit message. Press Enter for a default timestamped message.

### Step 5: Stage and Commit Changes
Stages all modified files and creates a commit with your message.

### Step 6: Configure Remote Repository
Sets up or updates the GitHub repository URL:
`https://github.com/mtcarella/EvidentEdgeApp.git`

### Step 7: Sync with Remote
Pulls latest changes and pushes your commits to GitHub.

## Safety Features

### Confirmation Prompts
- ✋ Asks for confirmation before force pushing
- ⚠️ Displays warnings about data loss risks
- 🛑 Allows cancellation at any point

### Error Handling
- Stops execution if any step fails
- Displays helpful error messages
- Suggests solutions for common issues

## Common Issues & Solutions

### Issue: "Failed to navigate to directory"
**Solution**: Verify the path `c:\ai\project` exists. Update the path in the script if different.

### Issue: "Permission denied" or "Authentication failed"
**Solution**:
1. Configure Git credentials:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```
2. Set up GitHub authentication (Personal Access Token or SSH key)

### Issue: PowerShell execution policy error
**Solution**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Issue: Merge conflicts after pull
**Solution**:
1. Script will ask if you want to continue with force push
2. Alternatively, cancel and resolve conflicts manually:
   ```bash
   git status
   git merge --abort  # If needed
   # Resolve conflicts manually
   git add .
   git commit -m "Resolved conflicts"
   ```

## Customization

### Change Project Directory
Edit the path in the script:
- **Batch**: Change `cd /d "c:\ai\project"`
- **PowerShell**: Change `$projectPath = "c:\ai\project"`

### Change Repository URL
Edit the repository URL in the script:
- **Batch**: Look for `https://github.com/mtcarella/EvidentEdgeApp.git`
- **PowerShell**: Change `$remoteUrl = "https://github.com/..."`

### Disable Force Push
Remove or comment out the `--force` flag from the push command if you want safer pushes.

## Security Notes

⚠️ **IMPORTANT**: These scripts use FORCE PUSH which overwrites remote history. Only use if:
- You are the sole developer on the project
- You understand the risks of force pushing
- You have confirmed no one else is working on the repository

For team environments, consider removing the `--force` flag.

## Script Comparison

| Feature | MasterDeploy.bat | MasterDeploy.ps1 |
|---------|------------------|------------------|
| Execution Speed | Fast | Fast |
| Colored Output | Limited | Full Color |
| Error Handling | Good | Excellent |
| Status Messages | Basic | Detailed |
| Cross-Platform | Windows Only | Windows (+ Mac/Linux with PowerShell Core) |
| Requires Admin | No | No |
| Dependencies | Command Prompt | PowerShell 5.1+ |

## Best Practices

1. **Always review changes** before running the script:
   ```bash
   git status
   git diff
   ```

2. **Use meaningful commit messages** instead of the default

3. **Back up important work** before force pushing

4. **Test on a branch** first if you're uncertain

5. **Keep scripts updated** if repository URLs change

## Support

If you encounter issues:
1. Check the error message displayed by the script
2. Verify Git is installed: `git --version`
3. Ensure you have repository access on GitHub
4. Review the common issues section above

## License

These scripts are provided as-is for the Evident Edge Application deployment process.
