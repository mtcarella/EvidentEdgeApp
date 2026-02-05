#!/bin/bash

echo "========================================"
echo "  Evident Edge - Quick Deploy Script"
echo "========================================"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not a git repository!"
    echo "Please run this script from your project root."
    exit 1
fi

# Use first argument as message, or prompt if not provided
if [ -n "$1" ]; then
    message="$1"
else
    read -p "Enter commit message (or press Enter for default): " message
    if [ -z "$message" ]; then
        message="Update deployment"
    fi
fi

echo ""
echo "Checking for changes..."
if git diff-index --quiet HEAD --; then
    echo "No changes to commit."
    exit 0
fi

echo "Adding all changes..."
git add .

echo "Committing changes..."
git commit -m "$message"

echo "Pushing to GitHub..."
if git push; then
    echo ""
    echo "========================================"
    echo "  ✓ Deployment complete!"
    echo "  Netlify will auto-deploy from GitHub."
    echo "  Check your Netlify dashboard."
    echo "========================================"
    echo ""
else
    echo ""
    echo "========================================"
    echo "  ✗ Push failed!"
    echo "  Check your git configuration."
    echo "========================================"
    echo ""
    exit 1
fi
