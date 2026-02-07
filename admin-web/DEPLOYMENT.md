# Deployment Guide

Web admin panel cho Antigravity Proxy Manager - triển khai lên Vercel.

## Prerequisites

- Tài khoản GitHub
- Tài khoản Vercel (free tier)
- Code đã push lên GitHub

## Bước 1: Chuẩn bị Repository

```bash
cd admin-web
git add .
git commit -m "Add admin web panel"
git push origin main
```

## Bước 2: Triển khai lên Vercel

### Cách 1: Vercel Dashboard

1. Đăng nhập https://vercel.com
2. Click **"Add New..."** → **"Project"**
3. Import repository: `santete/AntigravityManager`
4. Root Directory: `admin-web`
5. Framework Preset: `Vite`
6. Build Command: `npm run build`
7. Output Directory: `dist`
8. Install Command: `npm install`
9. Click **"Deploy"**

### Cách 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd admin-web
vercel

# Follow prompts:
# - Set up and deploy: Y
# - Which scope: [Your account]
# - Link to existing project: N
# - Project name: antigravity-admin
# - Directory: ./
# - Override settings: N

# Deploy to production
vercel --prod
```

## Bước 3: Custom Domain (Optional)

1. Vào Vercel dashboard → Project settings
2. Chọn **Domains**
3. Thêm domain: `admin.projectnow.app`
4. Configure DNS:
   - Type: `CNAME`
   - Name: `admin`
   - Value: `cname.vercel-dns.com`

## Bước 4: Kiểm tra

- Login với API key: `sk-237f70229d394f69af234a7609703c64`
- Xem server status, uptime, memory usage
- Copy API usage examples

## Kết cấu dự án deployed

```
https://antigravity-admin.vercel.app/
│
├─ / (Login page)
└─ /dashboard (sau khi login)
```

## Cập nhật sau này

```bash
# Push code changes
git add .
git commit -m "Update admin panel"
git push

# Vercel tự động redeploy
```

## Environment Variables

Không cần ENV vars - API endpoint hardcoded: `https://api.projectnow.app`

## Troubleshooting

### Build fails

```bash
# Local build test
npm run build
npm run preview
```

### Path alias not working

Check [tsconfig.app.json](./tsconfig.app.json) and [vite.config.ts](./vite.config.ts) có `paths` và `alias` đúng.

### API connection failed

Kiểm tra:
- Backend đang chạy: https://api.projectnow.app/health
- CORS được bật trên Render
- API key đúng format

## Bảo mật

- ✅ API key lưu localStorage (không lộ trong URL)
- ✅ HTTPS trên Vercel (auto SSL)
- ✅ No sensitive data in code
- ⚠️ Cần thêm rate limiting nếu public

## Chi phí

- Vercel Free tier:
  - 100GB bandwidth/month
  - Unlimited requests
  - Automatic HTTPS
  - Bổ sung: $0 (miễn phí)

## Liên kết

- Admin panel: https://antigravity-admin.vercel.app (sau khi deploy)
- Backend API: https://api.projectnow.app
- GitHub: https://github.com/santete/AntigravityManager
