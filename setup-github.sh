#!/bin/bash

# GitHub Repository Setup Script
# This script helps you push your code to GitHub using SSH with a custom alias

echo "🚀 GitHub Repository Setup"
echo "=========================="
echo ""

# Get repository name from user
read -p "Enter your GitHub repository name (e.g., kite-fighters-ui): " REPO_NAME

# Get GitHub username
read -p "Enter your GitHub username: " GITHUB_USERNAME

echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Create a new repository on GitHub:"
echo "   - Go to: https://github.com/new"
echo "   - Repository name: $REPO_NAME"
echo "   - Keep it Public or Private (your choice)"
echo "   - DO NOT initialize with README (we already have files)"
echo ""
echo "2. Once created, come back and press Enter to continue..."
read -p "Press Enter after creating the repository on GitHub..."

echo ""
echo "🔗 Setting up remote with SSH alias 'github-personal'..."

# Add remote using the SSH alias
git remote add origin github-personal:$GITHUB_USERNAME/$REPO_NAME.git

echo ""
echo "✅ Remote added successfully!"
echo ""
echo "📤 Pushing to GitHub..."

# Push to GitHub
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Success! Your code is now on GitHub!"
    echo "🌐 View it at: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
else
    echo ""
    echo "❌ Push failed. Please check your SSH configuration."
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Verify your SSH config has github-personal alias:"
    echo "   cat ~/.ssh/config"
    echo ""
    echo "2. Test SSH connection:"
    echo "   ssh -T github-personal"
    echo ""
    echo "3. Make sure your SSH key is added to GitHub:"
    echo "   https://github.com/settings/keys"
fi
