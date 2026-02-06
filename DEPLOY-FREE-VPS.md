# 🎁 Deploy Antigravity Manager Lên Oracle Cloud Free Tier

> Hướng dẫn deploy lên VPS **free mãi mãi** (not clickbait!)

## 📋 Yêu Cầu

- ✅ Email (để đăng ký Oracle account)
- ✅ Credit card (để verify, không charge tiền)
- ✅ SSH client (Windows có sẵn)

---

## 🚀 Bước 1: Tạo Oracle Cloud Account

### 1.1 Đăng Ký

1. Vào: https://www.oracle.com/cloud/free/
2. Click **"Start for free"**
3. Chọn region (khuyên dùng: **Singapore** - gần Việt Nam)
4. Điền thông tin:
   - Email
   - Country: Vietnam
   - Cloud Account Name: `your-name-cloud` (unique)

### 1.2 Verify

1. Nhập credit card (chỉ để verify, không charge)
2. Confirm email
3. Wait 5-10 phút để account active

### 1.3 Login

- URL: https://cloud.oracle.com/
- Tenancy: `your-name-cloud`
- Username: email của bạn

---

## 🖥️ Bước 2: Tạo VM Instance

### 2.1 Create Instance

1. Dashboard → **Compute** → **Instances**
2. Click **"Create Instance"**

### 2.2 Cấu Hình

**Name**: `antigravity-proxy`

**Image**: 
- Click "Change Image"
- Chọn **Ubuntu 22.04** (hoặc 24.04)

**Shape**:
- Click "Change Shape"
- Trong tab **"Ampere"**, chọn:
  - **VM.Standard.A1.Flex**
  - OCPU: 2 (có thể dùng tới 4)
  - Memory: 12 GB (có thể dùng tới 24GB)
- ✅ Đây là **Always Free Eligible** - check icon

**Networking**:
- VCN: (default)
- Subnet: (default)
- ✅ **Assign public IP**: ON

**Add SSH Keys**:
- Upload `.ssh/id_rsa.pub` hoặc generate mới
- Windows: `ssh-keygen -t rsa -b 4096`

**Boot Volume**: 50GB (default OK)

### 2.3 Launch

- Click **"Create"**
- Wait 2-3 phút
- Note lại **Public IP**: `xxx.xxx.xxx.xxx`

---

## 🔓 Bước 3: Mở Port

### 3.1 Security List (Firewall)

1. Instance Details → **Primary VNIC** → Click subnet name
2. Security Lists → **Default Security List**
3. **Add Ingress Rules**:

```
Ingress Rule 1 (HTTP):
- Source CIDR: 0.0.0.0/0
- IP Protocol: TCP
- Destination Port: 80

Ingress Rule 2 (HTTPS):
- Source CIDR: 0.0.0.0/0
- IP Protocol: TCP
- Destination Port: 443

Ingress Rule 3 (Antigravity Proxy):
- Source CIDR: 0.0.0.0/0
- IP Protocol: TCP
- Destination Port: 8045
```

### 3.2 OS Firewall (UFW)

```bash
# SSH vào VM
ssh ubuntu@xxx.xxx.xxx.xxx

# Setup firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8045/tcp  # Antigravity Proxy
sudo ufw enable
```

---

## 📦 Bước 4: Cài Đặt Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # v20.x.x
npm --version   # v10.x.x

# Install build tools (cho better-sqlite3)
sudo apt install -y build-essential python3 git

# Install PM2 (process manager)
sudo npm install -g pm2
```

---

## 🔧 Bước 5: Deploy Antigravity Manager

### 5.1 Clone Repository

```bash
cd /opt
sudo git clone https://github.com/Draculabo/AntigravityManager.git
sudo chown -R ubuntu:ubuntu AntigravityManager
cd AntigravityManager
```

### 5.2 Install & Build

```bash
# Install dependencies
npm install

# Build (chỉ build server, không cần Electron GUI)
npm run package
```

### 5.3 Tạo Standalone Server Script

```bash
nano start-proxy-server.js
```

**Paste code:**

```javascript
// start-proxy-server.js
const path = require('path');
const fs = require('fs');

// Import từ built files
const { bootstrapNestServer } = require('./out/AntigravityManager-linux-arm64/resources/app/.vite/build/main.js');

// Proxy config
const config = {
  port: 8045,
  auto_start: true,
  allow_lan: true,  // Cho phép truy cập từ internet
  timeout: 30000,
  model_mapping: {
    'gpt-4': 'gemini-2.0-flash-exp',
    'gpt-3.5-turbo': 'gemini-1.5-flash',
    'claude-3-5-sonnet': 'gemini-2.0-flash-exp',
  }
};

console.log('Starting Antigravity Proxy Server...');
console.log('Config:', config);

bootstrapNestServer(config)
  .then(() => {
    console.log(`✅ Proxy server running on port ${config.port}`);
    console.log(`📡 Accessible at: http://0.0.0.0:${config.port}/v1`);
  })
  .catch(err => {
    console.error('❌ Failed to start:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});
```

Save: `Ctrl+X`, `Y`, `Enter`

### 5.4 Sync Accounts & Tokens

**Cần copy database từ máy local → VPS:**

```powershell
# Trên máy Windows local, tìm database
$dbPath = "$env:APPDATA\AntigravityManager\cloud_accounts.db"

# Copy lên VPS qua SCP
scp $dbPath ubuntu@xxx.xxx.xxx.xxx:/opt/AntigravityManager/data/
```

**Trên VPS:**

```bash
# Tạo data directory
mkdir -p /opt/AntigravityManager/data

# Set permissions
chmod 600 /opt/AntigravityManager/data/cloud_accounts.db
```

---

## 🚀 Bước 6: Start Server

### 6.1 Test Run

```bash
cd /opt/AntigravityManager
node start-proxy-server.js
```

**Expected output:**
```
Starting Antigravity Proxy Server...
✅ Proxy server running on port 8045
📡 Accessible at: http://0.0.0.0:8045/v1
```

**Test từ máy local:**

```powershell
# Replace xxx.xxx.xxx.xxx với Public IP của VPS
$body = '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Hello from VPS!"}]}'
Invoke-RestMethod -Uri "http://xxx.xxx.xxx.xxx:8045/v1/chat/completions" `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{"Authorization"="Bearer sk-237f70229d394f69af234a7609703c64"} `
  -Body $body
```

✅ Nếu nhận được response → SUCCESS!

### 6.2 Run với PM2 (Background)

```bash
# Stop test run (Ctrl+C)

# Start với PM2
pm2 start start-proxy-server.js --name antigravity-proxy

# Save PM2 config
pm2 save

# Auto-start on reboot
pm2 startup
# Copy & paste lệnh output để enable auto-start

# Monitor
pm2 monit

# Logs
pm2 logs antigravity-proxy
```

---

## 🌐 Bước 7: Setup Domain & SSL (Optional)

### 7.1 Install Nginx

```bash
sudo apt install -y nginx
```

### 7.2 Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/antigravity
```

**Paste:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;  # Thay bằng domain của bạn
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL (sẽ config sau với Certbot)
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Proxy to Antigravity
    location /v1/ {
        proxy_pass http://localhost:8045/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Timeouts for streaming
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/antigravity /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart
sudo systemctl restart nginx
```

### 7.3 SSL với Certbot (Free)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### 7.4 Cloudflare DNS

1. Login Cloudflare Dashboard
2. DNS → Add Record:
   ```
   Type: A
   Name: @ (hoặc subdomain)
   IPv4: xxx.xxx.xxx.xxx (VPS public IP)
   Proxy: ON (orange cloud)
   ```

3. SSL/TLS → Set to **Full (strict)**

**Giờ truy cập:**
- `https://yourdomain.com/v1/chat/completions`

---

## ✅ Bước 8: Verify & Test

### Test từ Internet

```bash
curl https://yourdomain.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-237f70229d394f69af234a7609703c64" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Hello from production!"}]
  }'
```

### Monitor

```bash
# Server status
pm2 status

# Logs
pm2 logs antigravity-proxy --lines 100

# System resources
htop

# Disk usage
df -h
```

---

## 🔧 Maintenance

### Update Code

```bash
cd /opt/AntigravityManager
git pull
npm install
npm run package
pm2 restart antigravity-proxy
```

### Backup Database

```bash
# Backup
cp /opt/AntigravityManager/data/cloud_accounts.db ~/backups/cloud_accounts_$(date +%Y%m%d).db

# Schedule daily backup (crontab)
crontab -e
# Add:
0 2 * * * cp /opt/AntigravityManager/data/cloud_accounts.db ~/backups/cloud_accounts_$(date +\%Y\%m\%d).db
```

### View Logs

```bash
# PM2 logs
pm2 logs antigravity-proxy

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 💰 Cost Breakdown

| Item | Cost |
|------|------|
| Oracle Cloud VM (ARM 4 cores, 24GB RAM) | **$0/month** ✅ |
| Bandwidth (10TB/month) | **$0/month** ✅ |
| Domain (optional) | $10-12/year |
| Cloudflare (optional) | **$0/month** ✅ |
| **TOTAL** | **FREE** 🎉 |

---

## 🎯 Summary

**Đã setup:**
- ✅ Oracle Cloud Always Free VM (24GB RAM!)
- ✅ Antigravity Proxy chạy 24/7
- ✅ PM2 auto-restart on crash/reboot
- ✅ Nginx reverse proxy
- ✅ SSL/TLS từ Certbot hoặc Cloudflare
- ✅ Domain pointing
- ✅ Accessible từ anywhere

**API Endpoint:**
```
https://yourdomain.com/v1/chat/completions
```

**Next Steps:**
1. Update frontend/backend code để dùng production URL
2. Setup monitoring (optional: UptimeRobot free tier)
3. Add more Google accounts để increase quota pool

---

## 🆘 Troubleshooting

### Port 8045 không accessible từ internet

```bash
# Check if server running
pm2 status

# Check port listening
sudo netstat -tulpn | grep 8045

# Check Oracle firewall
# Vào OCI Console → Compute → Instance → Security List
# Verify Ingress Rule cho port 8045 exists

# Check OS firewall
sudo ufw status
```

### Out of Memory

```bash
# Check memory
free -h

# Nếu ARM VM có 24GB, không nên xảy ra
# Nếu xảy ra, adjust PM2 max memory:
pm2 start start-proxy-server.js --name antigravity-proxy --max-memory-restart 1G
```

### SSL issues với Cloudflare

Cloudflare SSL/TLS mode phải là **Full** hoặc **Full (strict)**, không phải Flexible.

---

**Hoàn tất!** 🚀 VPS free chạy Antigravity Manager production-ready.
