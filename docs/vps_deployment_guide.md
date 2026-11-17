# AKNU Hostel Management System — Linux VPS Production Deployment Guide

## 1. Server Prerequisites
- **Operating System**: Ubuntu 22.04 LTS / 24.04 LTS
- **Hardware**: Minimum 2 vCPU, 4GB RAM, 20GB SSD
- **Domain**: `hostels.aknu.edu.in` pointing to VPS public IP

---

## 2. Server Base Setup & Packages

```bash
# Update repositories
sudo apt update && sudo apt upgrade -y

# Install essential build tools & git
sudo apt install -y curl git ufw nginx postgresql postgresql-contrib

# Install Node.js v22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v
npm -v
```

---

## 3. PostgreSQL Database Configuration

```bash
# Switch to postgres user
sudo -u postgres psql

-- Inside psql prompt:
CREATE DATABASE aknu_hostels;
CREATE USER aknu_admin WITH ENCRYPTED PASSWORD 'ReplaceWithStrongSecurePassword2026!';
GRANT ALL PRIVILEGES ON DATABASE aknu_hostels TO aknu_admin;
\q
```

Initialize database tables using the schema script:
```bash
psql -U aknu_admin -d aknu_hostels -h localhost -f /var/www/aknu-hostels/database/schema.sql
```

---

## 4. Application Installation & PM2 Setup

```bash
# Clone repository
sudo mkdir -p /var/www/aknu-hostels
sudo chown -R $USER:$USER /var/www/aknu-hostels
git clone <repository_url> /var/www/aknu-hostels
cd /var/www/aknu-hostels

# 1. Backend Setup
cd backend
npm install
npm run build

# Configure Production .env
cat << 'EOF' > .env
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://aknu_admin:ReplaceWithStrongSecurePassword2026!@localhost:5432/aknu_hostels
JWT_SECRET=super_strong_cryptographic_jwt_key_aknu_hostels_2026
JWT_EXPIRES_IN=7d
QR_SECRET_KEY=aknu_qr_signature_key_2026_super_unpredictable
FRONTEND_URL=https://hostels.aknu.edu.in
EOF

# Install PM2 Globally
sudo npm install -g pm2

# Start Backend with PM2
pm2 start dist/server.js --name "aknu-hostel-api"
pm2 save
pm2 startup

# 2. Frontend Build
cd ../frontend
npm install
npm run build
# Built static files are now located in /var/www/aknu-hostels/frontend/dist
```

---

## 5. Nginx Configuration & Reverse Proxy

Create an Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/aknu-hostels
```

Paste the following configuration:
```nginx
server {
    listen 80;
    server_name hostels.aknu.edu.in;

    # Static Web Frontend
    root /var/www/aknu-hostels/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse Proxy REST API calls to Express Server
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health Check Endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
        proxy_set_header Host $host;
    }

    # Max upload limit for spreadsheets & photos
    client_max_body_size 20M;
}
```

Enable site and test Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/aknu-hostels /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. HTTPS SSL Configuration with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d hostels.aknu.edu.in
```

---

## 7. Firewall Hardening (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```
