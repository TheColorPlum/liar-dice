#!/bin/bash

# Exit on any error
set -e

echo "Starting deployment process..."

# Load NVM
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    echo "Loading NVM..."
    source "$HOME/.nvm/nvm.sh"
else
    echo "Error: NVM not found. Please install NVM first."
    exit 1
fi

# Verify npm is available
if ! command -v npm &> /dev/null; then
    echo "Error: npm could not be found"
    exit 1
fi

# Check if we're in the right directory
if [ ! -d ".git" ]; then
    echo "Error: Not in a git repository. Please run this script from ~/liar-dice"
    exit 1
fi

# Check for unstaged changes
if [ -n "$(git status --porcelain)" ]; then
    echo "Warning: You have unstaged changes"
    read -p "Would you like to stash them? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git stash
        echo "Changes stashed"
    else
        echo "Deployment cancelled. Please handle unstaged changes first."
        exit 1
    fi
fi

echo "Pulling latest changes..."
git pull

echo "Installing dependencies..."
npm install

echo "Building application..."
npm run build

echo "Restarting PM2 process..."
pm2 restart liar-dice

echo "Checking nginx configuration..."
if [ -f "/etc/nginx/conf.d/liar-dice.conf" ]; then
    echo "Testing nginx configuration..."
    sudo nginx -t
    
    if [ $? -eq 0 ]; then
        echo "Reloading nginx..."
        sudo systemctl reload nginx
    else
        echo "Error: nginx configuration test failed"
        exit 1
    fi
else
    echo "Warning: nginx configuration not found"
fi

# If we stashed changes earlier, ask if we should restore them
if [ "$STASHED" = true ]; then
    read -p "Would you like to restore your stashed changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git stash pop
        echo "Stashed changes restored"
    fi
fi

echo "Deployment completed successfully!"
