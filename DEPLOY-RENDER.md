# 🎨 Deploy Antigravity Manager Lên Render.com

> Free tier, dễ setup, tự động deploy khi push code!

## ⚠️ Lưu Ý Trước Khi Bắt Đầu

**Render.com Free Tier Limitations:**

| Feature | Free Tier | Impact |
|---------|-----------|--------|
| RAM | 512 MB | ⚠️ Hơi ít cho Node.js + NestJS |
| CPU | Shared | ⚠️ Có thể chậm |
| Sleep | After 15 min inactive | ⚠️ Cần keep-alive |
| Build Minutes | 500/month | ✅ OK |
| Bandwidth | 100 GB/month | ✅ OK |
| Custom Domain | ✅ Supported | ✅ |

**Recommendation**: 
- ✅ OK cho **testing/development**
- ⚠️ Không tốt cho **production 24/7** (vì sleep)
- ✅ Nếu OK với sleep → Tiếp tục guide này
- ❌ Nếu cần 24/7 uptime → Dùng Oracle Cloud (free mãi)

---

## 🎯 Tổng Quan

**Flow:**
```
GitHub Repo → Render.com → Auto Deploy → Running API
```

**Kết quả:**
- ✅ URL: `https://your-app.onrender.com/v1/chat/completions`
- ✅ Auto deploy khi push code
- ✅ Free SSL
- ⚠️ Sleep sau 15 phút không activity

---

## 📦 Bước 1: Prepare Repository

### 1.1 Fork/Clone Repository

```bash
# Option A: Fork trên GitHub UI
# 1. Vào: https://github.com/Draculabo/AntigravityManager
# 2. Click "Fork" (góc trên phải)
# 3. Tạo fork về account của bạn

# Option B: Push lên GitHub repo mới của bạn
cd C:\Users\nangh\Documents\workplace\google-antigravity\antigravity-manager\AntigravityManager

# Init git (nếu chưa có)
git init

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/antigravity-render.git

# Commit & push
git add .
git commit -m "Initial commit for Render deployment"
git push -u origin main
```

### 1.2 Tạo Standalone Server File

**Tạo file mới**: `render-server.js` ở root project:

```javascript
// render-server.js
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Antigravity Proxy for Render.com...');

// Đọc environment variables
const PORT = process.env.PORT || 8045;
const API_KEY = process.env.API_KEY || 'your-default-key';

// Mock config (vì không có Electron)
const config = {
  port: PORT,
  auto_start: true,
  allow_lan: true,
  timeout: 30000,
  model_mapping: {
    'gpt-4': 'gemini-2.0-flash-exp',
    'gpt-3.5-turbo': 'gemini-1.5-flash',
    'claude-3-5-sonnet': 'gemini-2.0-flash-exp',
  }
};

console.log('📋 Config:', config);
console.log('🔑 API Key:', API_KEY.substring(0, 10) + '...');

// Dynamically import NestJS server
async function bootstrap() {
  try {
    // Import từ built files
    const serverPath = path.join(__dirname, 'dist', 'server', 'main.js');
    
    if (!fs.existsSync(serverPath)) {
      console.error('❌ Server build not found. Run: npm run build:server');
      process.exit(1);
    }

    const { bootstrapNestServer } = require(serverPath);
    
    await bootstrapNestServer(config);
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Health check endpoint (cho Render.com)
const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏥 Health check endpoint: http://0.0.0.0:${PORT}/health`);
  bootstrap();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});
```

### 1.3 Thêm Build Script

**Sửa `package.json`**, thêm scripts:

```json
{
  "scripts": {
    "start": "electron-forge start",
    "build:server": "tsc -p tsconfig.server.json",
    "render": "node render-server.js",
    "package": "electron-forge package",
    "make": "electron-forge make"
  }
}
```

### 1.4 Tạo `tsconfig.server.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "module": "commonjs",
    "target": "ES2020",
    "lib": ["ES2020"],
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": [
    "src/server/**/*",
    "src/services/**/*",
    "src/utils/**/*",
    "src/types/**/*"
  ],
  "exclude": [
    "node_modules",
    "src/main.ts",
    "src/preload.ts",
    "src/renderer.ts",
    "src/routes/**/*",
    "src/components/**/*"
  ]
}
```

### 1.5 Commit & Push

```bash
git add render-server.js tsconfig.server.json package.json
git commit -m "Add Render.com deployment support"
git push
```

---

## 🌐 Bước 2: Deploy Trên Render.com

### 2.1 Tạo Account

1. Vào: https://render.com/
2. Click **"Get Started"** hoặc **"Sign Up"**
3. Chọn **"Sign up with GitHub"** (recommended)
4. Authorize Render to access GitHub

### 2.2 Tạo Web Service

1. Dashboard → Click **"New +"** → **"Web Service"**

2. **Connect Repository**:
   - Chọn repository: `YOUR_USERNAME/antigravity-render`
   - Click **"Connect"**

3. **Configure Service**:

```yaml
Name: antigravity-proxy

Region: Singapore (gần VN nhất)

Branch: main

Build Command: npm install && npm run build:server

Start Command: npm run render

Instance Type: Free
```

4. **Advanced Settings** (click "Advanced"):

**Environment Variables**:
```
API_KEY = sk-237f70229d394f69af234a7609703c64
PORT = 10000
NODE_ENV = production
```

**Health Check Path**: `/health`

5. Click **"Create Web Service"**

### 2.3 Wait for Deploy

Render sẽ:
1. Clone repo từ GitHub
2. Run `npm install`
3. Run `npm run build:server`
4. Run `npm run render`
5. Deploy lên `https://antigravity-proxy.onrender.com`

**Thời gian**: ~5-10 phút lần đầu.

---

## ✅ Bước 3: Verify Deployment

### 3.1 Check Logs

1. Render Dashboard → Service → **"Logs"** tab
2. Tìm dòng:
   ```
   ✅ Server running on port 10000
   📡 Health check: http://localhost:10000/health
   ```

### 3.2 Test Health Check

```powershell
# Test health endpoint
Invoke-RestMethod -Uri "https://antigravity-proxy.onrender.com/health"

# Expected:
# {
#   "status": "ok",
#   "timestamp": "2026-02-06T12:34:56.789Z"
# }
```

### 3.3 Test API

```powershell
$body = '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Hello from Render!"}]}'

Invoke-RestMethod -Uri "https://antigravity-proxy.onrender.com/v1/chat/completions" `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{"Authorization"="Bearer sk-237f70229d394f69af234a7609703c64"} `
  -Body $body
```

✅ **Nếu nhận được response → SUCCESS!**

---

## 🔄 Bước 4: Sync Cloud Accounts

**Vấn đề**: Database với cloud accounts đang ở local, cần sync lên Render.

### Option A: Environment Variables (Recommended)

**Lưu tokens vào ENV variables** thay vì database:

1. Render Dashboard → Service → **Environment**

2. Add variables:
```
GOOGLE_TOKEN_1 = {"access_token":"ya29.xxx","refresh_token":"1//xxx",...}
GOOGLE_TOKEN_2 = {"access_token":"ya29.yyy","refresh_token":"1//yyy",...}
```

3. Code đọc từ ENV:

```javascript
// render-server.js (update)
const tokens = [];
let i = 1;
while (process.env[`GOOGLE_TOKEN_${i}`]) {
  tokens.push(JSON.parse(process.env[`GOOGLE_TOKEN_${i}`]));
  i++;
}
console.log(`Loaded ${tokens.length} cloud accounts`);
```

### Option B: Mount Database (Paid Feature)

Render Persistent Disks ($1/GB/month) - **không free**.

### Option C: External Database

- PostgreSQL free tier (Render cung cấp)
- Convert SQLite → PostgreSQL schema

---

## 🛡️ Bước 5: Handle Sleep Issue

**Problem**: Free tier sleep sau 15 phút không request.

### Solution 1: Cron Job Ping (External)

**Dùng UptimeRobot** (free):

1. Vào: https://uptimerobot.com/
2. Sign up free
3. Add Monitor:
   ```
   Monitor Type: HTTP(s)
   URL: https://antigravity-proxy.onrender.com/health
   Interval: 5 minutes (free tier)
   ```

**Kết quả**: Ping mỗi 5 phút → Keep service awake.

### Solution 2: Self-Ping (Trong Code)

```javascript
// render-server.js (thêm vào cuối)
const SELF_PING_INTERVAL = 14 * 60 * 1000; // 14 minutes

if (process.env.NODE_ENV === 'production') {
  setInterval(async () => {
    try {
      const response = await fetch(`http://localhost:${PORT}/health`);
      console.log('🏓 Self-ping:', response.status);
    } catch (err) {
      console.error('Self-ping failed:', err.message);
    }
  }, SELF_PING_INTERVAL);
}
```

### Solution 3: Upgrade to Paid ($7/month)

- No sleep
- 512MB → 2GB RAM
- Better performance

---

## 🔐 Bước 6: Security Hardening

### 6.1 Restrict API Key Access

```javascript
// Add middleware
const validApiKeys = [
  process.env.API_KEY,
  process.env.API_KEY_2,
];

app.use('/v1', (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.replace('Bearer ', '');
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
});
```

### 6.2 Rate Limiting

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
});

app.use('/v1', limiter);
```

---

## 📊 Bước 7: Monitoring & Logs

### 7.1 View Logs

Render Dashboard → Service → **Logs** tab

**Real-time streaming**.

### 7.2 Metrics

Render Dashboard → Service → **Metrics** tab

- CPU usage
- Memory usage
- Request count
- Response time

### 7.3 Alerts (Paid)

Email alerts khi service down (paid feature).

---

## 🎯 Bước 8: Custom Domain (Optional)

### 8.1 Add Domain

1. Render Dashboard → Service → **Settings**
2. Scroll to **Custom Domains**
3. Click **"Add Custom Domain"**
4. Enter: `api.yourdomain.com`

### 8.2 Update DNS

**Cloudflare DNS**:

```
Type: CNAME
Name: api
Target: antigravity-proxy.onrender.com
Proxy: OFF (orange → gray)
```

**Note**: Render cần Proxy OFF để verify SSL.

### 8.3 SSL

Render tự động provision SSL từ Let's Encrypt (free).

**Sau ~5 phút**: `https://api.yourdomain.com` ready!

---

## 🔄 Auto Deploy on Push

**Đã setup sẵn!** Mỗi khi push code lên GitHub:

```bash
git add .
git commit -m "Update feature"
git push
```

→ Render tự động:
1. Detect push
2. Rebuild
3. Deploy
4. Zero-downtime rollout

**View progress**: Dashboard → Service → **Events** tab

---

## 💰 Cost

| Item | Cost |
|------|------|
| Render Web Service (Free) | $0/month |
| Bandwidth (100GB) | $0/month |
| Custom Domain SSL | $0/month |
| UptimeRobot Monitoring | $0/month |
| **TOTAL** | **FREE** ✅ |

**Upgrade Options**:
- Starter ($7/mo): No sleep, 512MB RAM
- Standard ($25/mo): 2GB RAM, better CPU
- Pro ($85/mo): 8GB RAM, dedicated CPU

---

## 📝 Summary

**Setup trong 10 phút:**

```bash
# 1. Tạo render-server.js
# 2. Commit & push lên GitHub
# 3. Connect repo trên Render.com
# 4. Deploy & verify
# 5. Setup UptimeRobot keep-alive
```

**Kết quả:**
- ✅ API endpoint: `https://antigravity-proxy.onrender.com/v1/...`
- ✅ Auto SSL
- ✅ Auto deploy on git push
- ⚠️ Sleep after 15 min (keep-alive với UptimeRobot)

**Production Deployment:**
```
Frontend: Vercel (free)
    ↓
Backend API: https://antigravity-proxy.onrender.com/v1/
    ↓
Google Gemini API
```

---

## 🐛 Troubleshooting

### Build Failed

**Error**: `Cannot find module 'express'`

**Fix**: Add express to dependencies:

```bash
npm install express --save
git commit -am "Add express dependency"
git push
```

### Out of Memory

**Error**: `JavaScript heap out of memory`

**Fix**: Add to `package.json`:

```json
{
  "scripts": {
    "render": "node --max-old-space-size=460 render-server.js"
  }
}
```

### Service Keeps Sleeping

**Fix**: 
1. Verify UptimeRobot monitor is active
2. Check interval = 5 minutes (free tier)
3. Verify URL is correct

### Cannot Connect to Database

**Fix**: Use environment variables cho tokens thay vì SQLite.

---

## 🚀 Next Steps

1. ✅ Deploy thành công
2. ✅ Test API endpoints
3. ✅ Setup keep-alive
4. 📱 Update frontend code để point về Render URL
5. 🎨 (Optional) Add custom domain

---

**Xong rồi!** Giờ bạn có production API endpoint free, auto-deploy! 🎉
