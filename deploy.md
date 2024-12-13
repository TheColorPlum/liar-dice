# Deployment Instructions for Liar's Dice

## Local Development Steps:

1. Make and test your changes locally
2. Commit changes to git
3. Push to main branch: `git push origin main`

## Server Deployment Steps:

1. SSH into the server:
```bash
ssh -i "liars-dice-new-key.pem" ec2-user@ec2-18-234-124-214.compute-1.amazonaws.com
```

2. Navigate to the project directory and handle any unstaged changes:
```bash
cd ~/liar-dice
git status  # Check for any unstaged changes
git stash   # If there are unstaged changes, stash them
```

3. Load NVM and run deploy script:
```bash
source ~/.nvm/nvm.sh
~/scripts/deploy.sh
```

4. (Optional) If you stashed changes earlier, restore them:
```bash
git stash pop
```

The deploy script will:
- Pull latest changes from GitHub
- Install dependencies
- Build the application
- Restart the PM2 process
- Ensure nginx configuration is up to date

## Verification Steps:

1. Check PM2 status: `pm2 status`
2. Verify the application is running: Visit http://18.234.124.214
3. Check logs if needed: `pm2 logs`

## Rollback Process (if needed):

1. Use PM2 to restart the application: `pm2 restart liar-dice`
2. If issues persist, you can revert to the previous git commit:
```bash
cd ~/liar-dice
git reset --hard HEAD~1
source ~/.nvm/nvm.sh  # Ensure npm is available
~/scripts/deploy.sh
```

## Note:
- Always ensure your .env.production file is properly configured before deploying
- The deployment script will use these environment variables for the production build
- If you encounter "npm not found" errors, make sure to source nvm before running npm commands
- If you encounter git pull errors due to local changes, use git stash to temporarily store them
