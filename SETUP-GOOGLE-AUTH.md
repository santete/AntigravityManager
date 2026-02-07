# 🔐 Setup Google Account Authentication

## Bước 1: Lấy Google Account Token từ Desktop App

### Option A: Export từ UI (Nếu app có feature)

1. Mở Antigravity Manager desktop app
2. Settings → Cloud Accounts
3. Click account `nanghachoichang87@gmail.com`
4. Export token (nếu có button)

### Option B: Query từ Database (Manual)

```powershell
# Find database
$dbPath = "$env:USERPROFILE\.antigravity-agent\cloud_accounts.db"

# Install sqlite3 tool nếu chưa có
# Hoặc dùng DB Browser for SQLite: https://sqlitebrowser.org/

# Query account info
sqlite3 $dbPath "SELECT email, access_token FROM cloud_accounts WHERE email='nanghachoichang87@gmail.com';"
```

### Option C: Copy từ App Memory (Quickest)

Desktop app đang chạy, có thể lấy token từ logs hoặc inspect memory.

---

## Bước 2: Format Account Data

**Format JSON cần thiết:**

```json
{
  "email": "nanghachoichang87@gmail.com",
  "access_token": "ya29.a0AfB_byD...",
  "refresh_token": "1//0gXXXXX...",
  "token_expiry": "2026-02-07T12:00:00.000Z"
}
```

**Compact (one-line) cho ENV variable:**

```json
{"email":"nanghachoichang87@gmail.com","access_token":"ya29.xxx","refresh_token":"1//xxx","token_expiry":"2026-02-07T12:00:00.000Z"}
```

---

## Bước 3: Add vào Render Environment Variables

### Step-by-step:

1. **Render Dashboard**: https://dashboard.render.com/
2. Click service: **antigravity-proxy**
3. Tab **"Environment"** (bên trái)
4. Click **"Add Environment Variable"**
5. **Add account:**

```
Key: GOOGLE_ACCOUNT_1
Value: {"email":"nanghachoichang87@gmail.com","access_token":"ya29...","refresh_token":"1//..."}
```

6. Click **"Save Changes"**

### Add Multiple Accounts:

```
GOOGLE_ACCOUNT_1 = {...account 1...}
GOOGLE_ACCOUNT_2 = {...account 2...}
GOOGLE_ACCOUNT_3 = {...account 3...}
```

---

## Bước 4: Deploy Updated Code

```powershell
# Commit server changes
cd C:\Users\nangh\Documents\workplace\google-antigravity\antigravity-manager\AntigravityManager

git add render-server-simple.js
git commit -m "feat: integrate real Google Gemini API

- Add Google account loading from ENV
- Implement callGoogleGemini function
- Convert OpenAI format to Gemini format
- Handle API errors properly"

git push
```

Render sẽ tự động detect push và redeploy (~2-3 phút).

---

## Bước 5: Verify Integration

### Test 1: Check Logs

1. Render Dashboard → Service → **Logs**
2. Tìm dòng:
```
🚀 Starting Antigravity Proxy (Standalone Mode)...
📋 Port: 10000
🔑 API Key: sk-237f70229d3...
👥 Google Accounts: 1
📧 Loaded account 1: nanghachoichang87@gmail.com
✅ Server running on http://0.0.0.0:10000
```

### Test 2: API Call

```powershell
$body = '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Xin chào! Hãy giới thiệu ngắn gọn về Gemini AI bằng tiếng Việt."}]}'

$response = Invoke-RestMethod -Uri "https://api.projectnow.app/v1/chat/completions" `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{"Authorization"="Bearer sk-237f70229d394f69af234a7609703c64"} `
  -Body $body

Write-Host "`n=== AI Response ===" -ForegroundColor Cyan
Write-Host $response.choices[0].message.content -ForegroundColor Green
Write-Host "`n=== Usage ===" -ForegroundColor Cyan
Write-Host "Tokens: $($response.usage.total_tokens)" -ForegroundColor Yellow
```

**Expected:** Real Gemini response về AI (không phải placeholder nữa)!

---

## 🐛 Troubleshooting

### "No Google accounts configured"

→ Check ENV variable name chính xác: `GOOGLE_ACCOUNT_1`

### "Invalid authentication credentials"

→ Access token expired. Cần refresh token logic (implement sau).

### "Failed to parse GOOGLE_ACCOUNT_1"

→ JSON syntax error. Dùng online validator: https://jsonlint.com/

---

## 📝 Quick Access Token Guide (Nếu không có DB)

**Temporary solution - Get fresh token:**

1. Open Antigravity Manager desktop
2. Trigger API call (để force token refresh)
3. Check network inspector (F12) trong app
4. Look for Authorization header: `Bearer ya29...`
5. Copy token
6. Add vào Render ENV

**Note:** Token expires sau 1 giờuneed implement refresh logic sau.

---

## Next Steps

Sau khi có token working:
- [ ] Implement token refresh logic
- [ ] Add round-robin account selection
- [ ] Add quota monitoring
- [ ] Handle rate limits

---

**Ready to get your Google token?** Cho tao biết khi nào có, tao sẽ guide add vào Render! 🚀
