#!/bin/bash

echo "========================================"
echo "  Evident Edge - GitHub Setup"
echo "========================================"
echo ""
echo "This script will:"
echo "  1. Configure your Git identity"
echo "  2. Initialize Git repository (if needed)"
echo "  3. Set up GitHub remote"
echo "  4. Push your first commit"
echo ""
echo "You only need to run this ONCE for initial setup."
echo "After that, use deploy.sh for all updates."
echo ""
read -p "Press Enter to continue..."

# Configure Git user settings
echo ""
echo "Configuring Git identity..."
git config --global user.name "mtcarella"
git config --global user.email "mtcarella@evidenttitle.com"

echo "Git identity configured:"
git config user.name
git config user.email
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "Initializing Git repository..."
    git init
    git branch -M main
    echo ""
else
    echo "Git repository already initialized."
    echo ""
fi

# Set up remote
echo "Setting up GitHub remote..."
if ! git remote get-url origin > /dev/null 2>&1; then
    git remote add origin https://github.com/mtcarella/EvidentEdgeApp.git
    echo "Remote added successfully."
else
    echo "Remote already exists, updating..."
    git remote set-url origin https://github.com/mtcarella/EvidentEdgeApp.git
    echo "Remote updated successfully."
fi

echo ""
echo "Current remote URL:"
git remote get-url origin
echo ""

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    echo "Creating .gitignore file..."
    cat > .gitignore << EOF
node_modules
dist
.DS_Store
*.log
.env.local
EOF
fi

# Add all files
echo "Adding all files to Git..."
git add .

# Commit
read -p "Enter commit message (or press Enter for 'Initial commit'): " commit_msg
if [ -z "$commit_msg" ]; then
    commit_msg="Initial commit"
fi

echo ""
echo "Committing changes..."
git commit -m "$commit_msg"

# Push to GitHub
echo ""
echo "Pushing to GitHub..."
echo "Note: You may need to authenticate with GitHub."
echo "If prompted, use your GitHub Personal Access Token as password."
echo ""

if ! git push -u origin main; then
    echo ""
    echo "========================================"
    echo "  X Push failed!"
    echo "========================================"
    echo ""
    echo "This is likely because:"
    echo "  1. You need to authenticate with GitHub"
    echo "  2. The repository doesn't exist yet on GitHub"
    echo "  3. You don't have write access to the repository"
    echo ""
    echo "To fix authentication:"
    echo "  1. Go to: https://github.com/settings/tokens"
    echo "  2. Generate a new Personal Access Token (classic)"
    echo "  3. Select 'repo' scope"
    echo "  4. Use the token as your password when prompted"
    echo ""
    echo "Or create the repository first at:"
    echo "https://github.com/new"
    echo "Name it: EvidentEdgeApp"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo ""
echo "========================================"
echo "  ✓ Setup Complete!"
echo "========================================"
echo ""
echo "Your repository is now connected to GitHub!"
echo ""
echo "For future updates, simply run:"
echo "  ./deploy.sh"
echo ""
read -p "Press Enter to exit..."
