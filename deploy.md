# Deployment Instructions for Liar's Dice

## Local Development Steps:

1. Make and test your changes locally
2. Commit changes to git
3. Push to main branch: `git push origin main`

## Server Deployment Steps:

### 1. SSH into the server:
```bash
ssh -i "liars-dice-new-key.pem" ec2-user@ec2-18-234-124-214.compute-1.amazonaws.com
```

### 2. Navigate to project directory and run deploy script:
```bash
cd ~/liar-dice
/home/ec2-user/scripts/deploy.sh
```

This script will:
- Pull latest changes from GitHub
- Install dependencies
- Build the application
- Ensure nginx configuration is up to date

### 3. Restart PM2 Processes:
After the deploy script completes:
```bash
pm2 status        # Check current process status
pm2 restart all   # Restart all processes to apply changes
```

## Verification Steps:

1. Check PM2 status: `pm2 status`
   - Verify both 'client' and 'liar-dice' processes are 'online'
2. Verify the application is running: Visit http://18.234.124.214
3. Check logs if needed: `pm2 logs`

## Rollback Process (if needed):

1. If issues persist after PM2 restart, you can revert to the previous git commit:
```bash
cd ~/liar-dice
git reset --hard HEAD~1
/home/ec2-user/scripts/deploy.sh
pm2 restart all
```

**Note:** Always ensure your `.env.production` file is properly configured before deploying. The deployment script will use these environment variables for the production build.
