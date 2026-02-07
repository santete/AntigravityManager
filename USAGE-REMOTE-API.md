# 🔌 Config External Apps Call Render API

## A. ChatGPT Desktop / Cursor / VS Code Copilot

### Config File Location

**Windows:**
```
%APPDATA%\<app-name>\config.json
```

**Example ChatGPT Desktop:**
```
C:\Users\nangh\AppData\Roaming\ChatGPT\config.json
```

### Update API Endpoint

Sửa file config:

```json
{
  "openai": {
    "apiBase": "https://api.projectnow.app/v1",
    "apiKey": "sk-237f70229d394f69af234a7609703c64"
  }
}
```

Hoặc:

```json
{
  "api": {
    "endpoint": "https://api.projectnow.app",
    "key": "sk-237f70229d394f69af234a7609703c64"
  }
}
```

---

## B. VS Code with Copilot/Continue Extension

### Continue Extension (Recommended)

1. VS Code → Extensions → Cài **Continue**
2. Settings (Click gear icon in Continue sidebar)
3. Edit `config.json`:

```json
{
  "models": [
    {
      "title": "Gemini via Render",
      "provider": "openai",
      "model": "gemini-2.5-flash",
      "apiBase": "https://api.projectnow.app/v1",
      "apiKey": "sk-237f70229d394f69af234a7609703c64"
    }
  ]
}
```

---

## C. Python Script / API Client

```python
import openai

# Config endpoint
openai.api_key = "sk-237f70229d394f69af234a7609703c64"
openai.api_base = "https://api.projectnow.app/v1"

# Call API
response = openai.ChatCompletion.create(
    model="gemini-2.5-flash",
    messages=[{"role": "user", "content": "Hello from Python!"}]
)

print(response.choices[0].message.content)
```

---

## D. cURL / PowerShell Test

### PowerShell

```powershell
$body = @{
    model = "gemini-2.5-flash"
    messages = @(
        @{
            role = "user"
            content = "Xin chào từ PowerShell!"
        }
    )
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod `
    -Uri "https://api.projectnow.app/v1/chat/completions" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{"Authorization"="Bearer sk-237f70229d394f69af234a7609703c64"} `
    -Body $body

Write-Host $response.choices[0].message.content
```

### cURL (Git Bash)

```bash
curl https://api.projectnow.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-237f70229d394f69af234a7609703c64" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Hello from cURL!"}]
  }'
```

---

## E. Postman / Insomnia

### Postman Collection

1. New Request
2. **Method:** POST
3. **URL:** `https://api.projectnow.app/v1/chat/completions`
4. **Headers:**
   ```
   Content-Type: application/json
   Authorization: Bearer sk-237f70229d394f69af234a7609703c64
   ```
5. **Body (raw JSON):**
   ```json
   {
     "model": "gemini-2.5-flash",
     "messages": [
       {"role": "user", "content": "Test from Postman"}
     ]
   }
   ```

---

## F. Node.js / JavaScript

```javascript
const axios = require('axios');

async function callAPI() {
  const response = await axios.post(
    'https://api.projectnow.app/v1/chat/completions',
    {
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'Hello from Node.js!' }]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-237f70229d394f69af234a7609703c64'
      }
    }
  );

  console.log(response.data.choices[0].message.content);
}

callAPI();
```

---

## 🔐 Security Note

**API Key hiện đang public trong guide này!** 

Before production:
1. Generate new API key
2. Rotate ngay key `sk-237f70229d39...` 
3. Không commit key vào Git
4. Dùng environment variables

---

## 📊 Test Different Models

```powershell
# Test gemini-2.5-flash
$body = '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Say hi"}]}'
Invoke-RestMethod -Uri "https://api.projectnow.app/v1/chat/completions" -Method POST -Headers @{"Authorization"="Bearer sk-237f70229d394f69af234a7609703c64"} -ContentType "application/json" -Body $body

# Test gpt-4 (auto map to Gemini)
$body = '{"model":"gpt-4","messages":[{"role":"user","content":"Say hi"}]}'
Invoke-RestMethod -Uri "https://api.projectnow.app/v1/chat/completions" -Method POST -Headers @{"Authorization"="Bearer sk-237f70229d394f69af234a7609703c64"} -ContentType "application/json" -Body $body

# Test claude-3-5-sonnet (auto map to Gemini)
$body = '{"model":"claude-3-5-sonnet","messages":[{"role":"user","content":"Say hi"}]}'
Invoke-RestMethod -Uri "https://api.projectnow.app/v1/chat/completions" -Method POST -Headers @{"Authorization"="Bearer sk-237f70229d394f69af234a7609703c64"} -ContentType "application/json" -Body $body
```

---

## 🚀 Summary

**Endpoint:** `https://api.projectnow.app/v1/chat/completions`

**API Key:** `sk-237f70229d394f69af234a7609703c64`

**Models:**
- `gemini-2.5-flash` - Fast, recommended
- `gemini-2.0-flash` - Alt
- `gpt-4` - Auto maps to Gemini
- `claude-3-5-sonnet` - Auto maps to Gemini

**Compatible với OpenAI SDK!** 🎉
