# Liar's Dice Game

A multiplayer implementation of the classic game Liar's Dice.

## Development

### Prerequisites
- Node.js (v18 or later)
- npm

### Setup
1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev:all
```

This will start both the Next.js frontend and the WebSocket game server.

## Testing
Run the test suite:
```bash
npm test
```

## Deployment

### Prerequisites
- Node.js v18 or later
- PM2 (installed globally)
- Nginx
- SSL certificates from Let's Encrypt for lie-die.com

### Initial Server Setup
1. Install required software:
```bash
# Install Node.js 18
nvm install 18
nvm use 18

# Install PM2 globally
npm install -g pm2

# Install nginx
sudo yum install nginx
```

2. Set up SSL certificates using Let's Encrypt/Certbot
3. Copy nginx configuration:
```bash
sudo cp nginx/liar-dice.conf /etc/nginx/conf.d/
sudo nginx -t
sudo systemctl reload nginx
```

### Deployment Process
For regular deployments, use the provided deployment script:
```bash
./deploy.sh
```

The deployment script will:
- Pull latest changes
- Install dependencies
- Build the application
- Restart PM2 processes
- Verify nginx configuration
- Reload nginx if needed
- Verify services are running

### Manual Deployment Steps
If you need to deploy manually, follow these steps:

1. Pull latest changes:
```bash
git pull origin main
```

2. Install dependencies and build:
```bash
npm install
npm run build
```

3. Start/restart services:
```bash
# Start/restart WebSocket server
pm2 restart server

# Start/restart Next.js frontend
NODE_ENV=production pm2 restart client

# Save PM2 process list
pm2 save
```

4. Verify nginx and reload if needed:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Monitoring
- View PM2 process status: `pm2 status`
- Monitor resources: `pm2 monit`
- View logs:
  - PM2 logs: `pm2 logs`
  - Nginx access logs: `sudo tail -f /var/log/nginx/access.log`
  - Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### Configuration Files
- Nginx configuration: `nginx/liar-dice.conf`
- Deployment script: `deploy.sh`
- Deployment documentation: `deploy.md`

### Troubleshooting
See [deploy.md](deploy.md) for detailed troubleshooting steps and common issues.

## License
MIT
