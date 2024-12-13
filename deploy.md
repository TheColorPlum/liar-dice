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

2. Navigate to the project directory:
```bash
cd ~/liar-dice
```

3. Run the deploy script:
```bash
./deploy.sh
```

The deploy script will:
- Check for and handle any unstaged changes
- Pull latest changes from GitHub
- Install dependencies
- Build the application
- Clean up existing PM2 processes
- Start both server and client processes with PM2
- Save the PM2 process list
- Ensure nginx configuration is up to date

## Verification Steps:

1. Check PM2 status to ensure both processes are running:
```bash
pm2 status
```
Expected output should show:
- `liar-dice` process (server) in 'online' state
- `client` process in 'online' state

2. Verify the application is running: Visit http://18.234.124.214

3. Check logs if needed:
```bash
pm2 logs liar-dice  # For server logs
pm2 logs client     # For client logs
```

## Troubleshooting:

### If Node.js/npm is not found:
1. Ensure NVM is loaded:
```bash
source ~/.nvm/nvm.sh
```

2. If Node.js is not installed:
```bash
sudo dnf install nodejs -y
```

### If PM2 is not found:
```bash
sudo npm install -g pm2
```

### If processes are in error state:
1. Check the logs:
```bash
pm2 logs
```

2. Clean up and restart:
```bash
pm2 delete all
pm2 start server.js --name liar-dice
pm2 start npm --name client -- start
pm2 save
```

### If port conflicts occur:
1. Check running processes:
```bash
pm2 status
```

2. Delete all processes and restart:
```bash
pm2 delete all
./deploy.sh
```

## Rollback Process:

If issues persist after deployment:

1. Stop all processes:
```bash
pm2 delete all
```

2. Revert to previous commit:
```bash
git reset --hard HEAD~1
```

3. Redeploy:
```bash
./deploy.sh
```

## Important Notes:

- Always ensure your .env.production file is properly configured before deploying
- The deployment script will use these environment variables for the production build
- After any PM2 process changes, always run `pm2 save` to persist the process list
- Both server and client processes must be running for the application to work properly
- If you make changes to the deployment process, update both deploy.sh and deploy.md
- Always verify both processes are running correctly after deployment using `pm2 status`
