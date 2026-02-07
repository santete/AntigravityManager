# Hướng dẫn Setup Google Accounts

Tài liệu này hướng dẫn cách thêm Google account vào Antigravity Proxy để sử dụng Gemini API.

## Cách 1: Lấy token từ Desktop App (Recommended)

### Bước 1: Thêm account trong Desktop App

1. Mở Antigravity Manager desktop app
2. Vào Settings → Cloud Accounts
3. Click "Add Google Account"
4. Đăng nhập với Google
5. Account sẽ được lưu vào database local

### Bước 2: Extract Refresh Token

#### Option A: Sử dụng DB Browser for SQLite

1. Download [DB Browser for SQLite](https://sqlitebrowser.org/dl/)
2. Mở file database:
   ```
   C:\Users\[YourUsername]\.antigravity-agent\cloud_accounts.db
   ```
3. Vào tab "Browse Data"
4. Chọn table `cloud_accounts`
5. Copy giá trị cột `refresh_token`

#### Option B: Sử dụng PowerShell Script

```powershell
# Chạy trong PowerShell
$dbPath = "$env:USERPROFILE\.antigravity-agent\cloud_accounts.db"

# Install System.Data.SQLite nếu chưa có
# Xem file: extract-token.ps1

# Hoặc dùng SQLite CLI
sqlite3 $dbPath "SELECT email, refresh_token FROM cloud_accounts"
```

### Bước 3: Thêm vào Web Admin

1. Mở Web Admin: https://your-app.vercel.app
2. Login với API key
3. Click "Accounts" ở header
4. Paste email và refresh token
5. Click "Thêm Account"
6. Copy ENV string được generate
7. Paste vào Render Dashboard

## Cách 2: Lấy token trực tiếp từ Google OAuth (Advanced)

### Prerequisites

- Google Cloud Project với Gemini API enabled
- OAuth 2.0 Client ID credentials

### Bước 1: Setup OAuth Credentials

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project hoặc tạo mới
3. Enable Gemini API
4. Vào "APIs & Services" → "Credentials"
5. Tạo "OAuth 2.0 Client ID"
   - Application type: Desktop app
   - Name: Antigravity Token Extractor
6. Download credentials JSON

### Bước 2: Generate Refresh Token

```bash
# Sử dụng OAuth Playground
# https://developers.google.com/oauthplayground/

# Hoặc dùng script:
node scripts/get-google-token.js
```

### Bước 3: Test Token

```bash
curl -X POST https://api.projectnow.app/v1/chat/completions \
  -H "Authorization: Bearer sk-237f70229d394f69af234a7609703c64" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.0-flash-exp",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Cách 3: Manual ENV Setup trong Render

### Format

```env
GOOGLE_ACCOUNT_1=email@gmail.com|1//0xxxxx-refresh-token-here
GOOGLE_ACCOUNT_2=another@gmail.com|1//0yyyyy-another-token
```

### Setup

1. Vào [Render Dashboard](https://dashboard.render.com/)
2. Chọn service: `antigravity-proxy`
3. Settings → Environment
4. Add environment variables:
   - Key: `GOOGLE_ACCOUNT_1`
   - Value: `email@gmail.com|1//0xxxxx...`
5. Click "Save Changes"
6. Service sẽ tự động redeploy (~2 phút)

## Troubleshooting

### Token không hoạt động

```
Error: invalid_grant
```

**Solution:** Token đã expire hoặc bị revoke
- Generate token mới
- Kiểm tra scope đúng: `https://www.googleapis.com/auth/generative-language`

### Account không xuất hiện trong API response

**Check:**
1. ENV variable đã save chưa?
2. Service đã redeploy chưa?
3. Health check: https://api.projectnow.app/health

### API trả về 503

```json
{"error": "No Google accounts configured"}
```

**Solution:** Chưa có GOOGLE_ACCOUNT_* nào trong ENV
- Add ít nhất 1 account theo hướng dẫn trên

## Security Notes

⚠️ **Quan trọng:**
- Refresh token là credential nhạy cảm
- Không commit vào Git
- Không share công khai
- Revoke token khi không dùng: https://myaccount.google.com/permissions

🔒 **Best practices:**
- Dùng account riêng cho API (không phải tài khoản chính)
- Enable 2FA trên Google account
- Monitor usage trong Google Cloud Console
- Rotate token định kỳ (3-6 tháng)

## Tự động hóa (Future)

Trong tương lai sẽ có:
- ✅ Google OAuth flow trực tiếp trong web app
- ✅ Auto refresh token
- ✅ Account health monitoring
- ✅ Usage quota tracking
- ✅ Multi-user support

## Links

- Desktop App: https://github.com/santete/AntigravityManager
- Web Admin: https://your-app.vercel.app
- Backend API: https://api.projectnow.app
- Render Dashboard: https://dashboard.render.com/
- Google OAuth Playground: https://developers.google.com/oauthplayground/
