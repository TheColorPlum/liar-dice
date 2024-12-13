#!/bin/bash

# Exit on error
set -e

echo "Starting deployment process..."

# Pull latest changes
echo "Pulling latest changes..."
git pull origin main

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the application
echo "Building application..."
npm run build

# Restart PM2 processes
echo "Restarting PM2 processes..."
pm2 restart server
pm2 restart client

# Save PM2 process list
echo "Saving PM2 process list..."
pm2 save

# Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

# Reload nginx if test passes
if [ $? -eq 0 ]; then
    echo "Reloading nginx..."
    sudo systemctl reload nginx
else
    echo "Nginx configuration test failed!"
    exit 1
fi

# Verify services are running
echo "Verifying services..."
pm2 status
curl -I http://localhost:3000
curl -I http://localhost:3002

echo "Deployment complete! Checking logs for any errors..."
pm2 logs --lines 20

echo "Deployment successful!"
