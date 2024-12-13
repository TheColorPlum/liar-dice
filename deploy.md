# Deployment Guide

## Server Configuration

### Prerequisites
- Node.js (v18 or later)
- PM2 (installed globally)
- Nginx
- SSL certificates from Let's Encrypt for lie-die.com

### Environment Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Build the application: `npm run build`

### PM2 Process Setup
Start both the Next.js frontend and WebSocket server:
```bash
# Start WebSocket server
pm2 start server.js --name server

# Start Next.js frontend
NODE_ENV=production pm2 start npm --name client -- start -- -H 0.0.0.0

# Save PM2 process list to persist across reboots
pm2 save
```

### Nginx Configuration
The nginx configuration should be placed in `/etc/nginx/conf.d/liar-dice.conf`:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name lie-die.com www.lie-die.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name lie-die.com www.lie-die.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/lie-die.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lie-die.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/lie-die.com/chain.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_buffers 8 32k;
        proxy_buffer_size 64k;
    }

    # Game server WebSocket with enhanced configuration
    location /socket.io/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Match timeouts with server configuration
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        proxy_connect_timeout 60s;
        
        # WebSocket specific settings
        proxy_buffering off;
        proxy_set_header X-NginX-Proxy true;
        proxy_ssl_verify off;
    }
}
```

### Deployment Steps
1. Pull latest changes: `git pull origin main`
2. Install dependencies: `npm install`
3. Build the application: `npm run build`
4. Restart PM2 processes:
   ```bash
   pm2 restart server
   pm2 restart client
   ```
5. Verify nginx configuration: `sudo nginx -t`
6. Reload nginx if needed: `sudo systemctl reload nginx`

### SSL Certificate Renewal
Let's Encrypt certificates auto-renew through certbot's cron job. After renewal, reload nginx:
```bash
sudo systemctl reload nginx
```

### Troubleshooting
1. Check PM2 logs: `pm2 logs`
2. Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
3. Check nginx access logs: `sudo tail -f /var/log/nginx/access.log`
4. Verify services are running:
   ```bash
   pm2 status
   sudo systemctl status nginx
   ```

### Monitoring
- Monitor PM2 processes: `pm2 monit`
- Check system resources: `htop`
- View real-time logs: `pm2 logs`
