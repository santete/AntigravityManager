# ✨ Danh Sách Tính Năng Chi Tiết

> Tài liệu mô tả đầy đủ các tính năng của Antigravity Manager

## 📋 Mục Lục

- [Core Features](#-core-features)
- [Account Management](#-account-management)
- [Quota & Monitoring](#-quota--monitoring)
- [Auto-Switching](#-auto-switching)
- [API Proxy](#-api-proxy)
- [Security](#-security)
- [UI/UX](#-uiux)
- [System Integration](#-system-integration)

---

## 🎯 Core Features

### 1. Multi-Account Pool Management

**Mô tả**: Quản lý không giới hạn số lượng tài khoản Google Gemini và Claude AI.

**Chức năng**:
- ✅ Thêm tài khoản qua OAuth 2.0 (Google)
- ✅ Thêm tài khoản Claude qua API key
- ✅ Hiển thị danh sách tất cả tài khoản
- ✅ Đánh dấu tài khoản đang active
- ✅ Xóa tài khoản khỏi pool

**Cách sử dụng**:
```
1. Click nút "Thêm Tài Khoản"
2. Chọn provider (Google/Claude)
3. Đăng nhập qua OAuth hoặc nhập API key
4. Tài khoản tự động thêm vào pool
```

**Technical Details**:
- OAuth flow: Authorization Code Grant
- Token storage: Encrypted với AES-256-GCM
- Provider support: Google Gemini, Claude (Anthropic)

---

## 👤 Account Management

### 2.1 Account Snapshots (Backup/Restore)

**Mô tả**: Lưu snapshot của tài khoản Antigravity IDE để nhanh chóng chuyển đổi.

**Chức năng**:
- ✅ Capture snapshot từ `state.vscdb` của Antigravity IDE
- ✅ Lưu trữ multiple snapshots với tên ghi chú
- ✅ Restore snapshot về IDE (ghi đè file state.vscdb)
- ✅ Xem thông tin snapshot (email, thời gian tạo, size)
- ✅ Xóa snapshot không cần thiết

**Use Case**:
```
Scenario: Developer có 5 tài khoản Google, mỗi tài khoản cho project khác nhau

1. Đang dùng account A → Save snapshot "Project Alpha"
2. Switch sang account B trong IDE
3. Save snapshot "Project Beta"
...
4. Muốn quay lại Project Alpha → Click "Apply" snapshot "Project Alpha"
   → IDE tự động restart với account A
```

**Technical Details**:
```typescript
// Database Schema
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  data BLOB NOT NULL,        -- state.vscdb content
  created_at INTEGER NOT NULL,
  is_current INTEGER DEFAULT 0
);

// Snapshot Structure
interface AccountSnapshot {
  id: string;
  name: string;
  email: string | null;
  data: Buffer;              // Full state.vscdb binary
  createdAt: number;
  isCurrent: boolean;
}
```

**Limitations**:
- Cần phải có Antigravity IDE đã cài đặt
- Restore yêu cầu đóng IDE (process management)
- Không sync real-time, chỉ point-in-time snapshot

---

### 2.2 Cloud Account CRUD

**Mô tả**: Quản lý tài khoản cloud (Google Gemini/Claude) để sử dụng cho auto-switching.

**Chức năng**:

#### Add Account
```typescript
// Via OAuth (Google)
1. User clicks "Add Google Account"
2. Opens browser: Google OAuth consent screen
3. User authorizes
4. Callback to localhost:8888/oauth-callback
5. Exchange code for token
6. Fetch user info (email, name, avatar)
7. Encrypt & save to database

// Via API Key (Claude - future)
1. User enters API key
2. Validate key by test request
3. Encrypt & save
```

#### Update Account
- ✅ Update quota manually (refresh button)
- ✅ Update token (auto on expire)
- ✅ Update last_used timestamp
- ✅ Update status (active/rate_limited/expired)

#### Delete Account
- ✅ Remove from database
- ✅ Delete encrypted token from keychain
- ✅ Clear all associated data

#### Batch Operations
- ✅ Select multiple accounts (checkbox)
- ✅ Batch refresh quota
- ✅ Batch delete accounts

**Technical Details**:
```typescript
interface CloudAccount {
  id: string;
  provider: 'google' | 'claude';
  email: string;
  name: string | null;
  avatar_url: string | null;
  token: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expiry_timestamp: number;
  };
  quota: {
    [model: string]: {
      used: number;
      total: number;
      reset_at?: number;
    };
  };
  created_at: number;
  last_used: number;
  status: 'active' | 'rate_limited' | 'expired' | 'error';
  is_active: boolean;  // Currently active account
}
```

---

## 📊 Quota & Monitoring

### 3.1 Real-time Quota Display

**Mô tả**: Hiển thị trực quan quota còn lại cho từng tài khoản và từng model.

**UI Components**:

```
┌─────────────────────────────────────────┐
│  📧 user@gmail.com                      │
│  ━━━━━━━━━━━━━━━━░░░░ 75%  (75/100)    │  ← Gemini 2.0 Flash Exp
│  ━━━━━━░░░░░░░░░░░░░░ 30%  (3/10)      │  ← Claude Sonnet 3.5
│                                         │
│  🔄 Last updated: 2 minutes ago         │
│  Status: ✅ Active                      │
└─────────────────────────────────────────┘
```

**Chức năng**:
- ✅ Progress bar với màu sắc theo mức độ:
  - 🟢 Green: > 50%
  - 🟡 Yellow: 20-50%
  - 🔴 Red: < 20%
- ✅ Tooltip hiển thị chi tiết model, quota, reset time
- ✅ Auto-refresh mỗi 5 phút
- ✅ Manual refresh button
- ✅ Loading states

**Technical Implementation**:
```typescript
// CloudMonitorService polls every 5 minutes
setInterval(async () => {
  for (const account of accounts) {
    const quota = await GoogleAPIService.fetchQuota(account.token);
    await CloudAccountRepo.updateQuota(account.id, quota);
  }
}, 5 * 60 * 1000);

// Frontend uses TanStack Query for caching
const { data: accounts } = useQuery({
  queryKey: ['cloud-accounts'],
  queryFn: async () => await cloudActions.getAccounts(),
  refetchInterval: 5 * 60 * 1000,  // Auto-refetch
});
```

---

### 3.2 Background Monitoring

**Mô tả**: Service chạy background tự động cập nhật quota và kiểm tra auto-switch.

**Hoạt động**:

```
Startup → CloudMonitorService.start()
  ↓
Every 5 minutes OR on app focus:
  ↓
  1. Load all accounts from DB
  2. Check token expiry (< 10 min)
     → Refresh token if needed
  3. Fetch quota from Google API
     → Delay 1s between requests (rate limit prevention)
  4. Update DB with new quota
  5. Check if auto-switch needed
     → If active account quota < 5%
     → Or status = 'rate_limited'
     → Switch to backup account
```

**Debounce & Rate Limiting**:
```typescript
// Prevent spam on rapid focus events
const DEBOUNCE_TIME = 10000;  // 10 seconds
let lastFocusTime = 0;

handleAppFocus() {
  const now = Date.now();
  if (now - lastFocusTime < DEBOUNCE_TIME) {
    return;  // Skip
  }
  lastFocusTime = now;
  this.poll();  // Trigger immediate update
}
```

**Error Handling**:
- ✅ Retry on network errors (exponential backoff)
- ✅ Mark account as 'error' on persistent failures
- ✅ Log errors to file for debugging
- ✅ Continue with other accounts if one fails

---

## 🔄 Auto-Switching

### 4.1 Intelligent Account Switching

**Mô tả**: Tự động chuyển sang tài khoản khác khi tài khoản hiện tại hết quota hoặc bị rate-limit.

**Logic**:

```typescript
async function checkAndSwitchIfNeeded() {
  const activeAccount = await getActiveAccount();
  
  // Điều kiện cần switch:
  const needsSwitch = (
    activeAccount.status === 'rate_limited' ||
    anyQuotaBelowThreshold(activeAccount.quota, 5) ||  // < 5%
    activeAccount.status === 'expired'
  );
  
  if (!needsSwitch) return;
  
  // Tìm account backup tốt nhất
  const backup = await findBestBackupAccount({
    criteria: [
      { key: 'quota', weight: 0.6 },      // 60% quan trọng
      { key: 'last_used', weight: 0.2 },  // 20% (prefer least recently used)
      { key: 'status', weight: 0.2 },     // 20% (prefer active)
    ],
  });
  
  if (!backup) {
    notify('Không còn tài khoản available!');
    return;
  }
  
  // Thực hiện switch
  await switchToAccount(backup.id);
  
  // Notification
  notify(`Đã chuyển từ ${activeAccount.email} → ${backup.email}`);
}
```

**Selection Strategy**:

| Tiêu Chí | Trọng Số | Mô Tả |
|----------|----------|-------|
| **Quota** | 60% | Account có quota cao nhất được ưu tiên |
| **Last Used** | 20% | Account ít dùng nhất được ưu tiên (load balancing) |
| **Status** | 20% | Active > Rate Limited > Expired |

**Example**:
```
Active: user1@gmail.com → Quota: 2% (rate limited)

Available backups:
- user2@gmail.com: Quota 80%, last_used: 1 hour ago
- user3@gmail.com: Quota 95%, last_used: 5 minutes ago
- user4@gmail.com: Quota 60%, last_used: 2 days ago

Score calculation:
user2: 80*0.6 + 70*0.2 + 100*0.2 = 82
user3: 95*0.6 + 30*0.2 + 100*0.2 = 83  ← Selected!
user4: 60*0.6 + 100*0.2 + 100*0.2 = 76

→ Switch to user3@gmail.com
```

**Configuration**:
```typescript
interface AutoSwitchConfig {
  enabled: boolean;              // Bật/tắt auto-switch
  threshold: number;             // Quota threshold (default: 5%)
  check_interval: number;        // Polling interval (default: 5 min)
  notification: boolean;         // Show notification on switch
  fallback_to_manual: boolean;   // Nếu không có backup, prompt user
}
```

---

### 4.2 Manual Switching

**Mô tả**: User có thể manually chọn tài khoản để active.

**Chức năng**:
- ✅ Click vào account card → Set as active
- ✅ Confirmation dialog nếu đang có request active
- ✅ Update Antigravity IDE config với account mới
- ✅ Restart IDE process (nếu cần)

**UI Flow**:
```
1. User clicks "Set Active" on account card
2. Show confirmation:
   "Chuyển sang user2@gmail.com? 
    Antigravity IDE sẽ được restart."
   [Cancel] [Confirm]
3. On confirm:
   - Save new account to IDE state.vscdb
   - Kill IDE process
   - Restart IDE with new account
   - Update UI (new active badge)
```

---

## 🔌 API Proxy

### 5.1 OpenAI-Compatible Proxy

**Mô tả**: Local proxy server chuyển đổi OpenAI API calls thành Gemini API calls.

**Endpoint**: `http://localhost:8045/v1/chat/completions`

**Request Format** (OpenAI):
```typescript
POST /v1/chat/completions
Headers:
  Authorization: Bearer <API_KEY>
  Content-Type: application/json

Body:
{
  "model": "gpt-4",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "stream": false
}
```

**Response Format** (OpenAI-compatible):
```typescript
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 56,
    "completion_tokens": 31,
    "total_tokens": 87
  }
}
```

**Model Mapping**:
```typescript
const MODEL_MAP = {
  'gpt-4': 'gemini-2.0-flash-exp',
  'gpt-4-turbo': 'gemini-2.0-flash-exp',
  'gpt-3.5-turbo': 'gemini-1.5-flash',
  'claude-3-5-sonnet': 'gemini-2.0-flash-exp',
};
```

---

### 5.2 Anthropic-Compatible Proxy

**Mô tả**: Proxy tương thích với Anthropic API format.

**Endpoint**: `http://localhost:8045/v1/messages`

**Request Format**:
```typescript
POST /v1/messages
Headers:
  x-api-key: <API_KEY>
  anthropic-version: 2023-06-01
  Content-Type: application/json

Body:
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 1024,
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

**Conversion Logic**:
```typescript
// Anthropic → Gemini
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [...]
}
↓
{
  "model": "gemini-2.0-flash-exp",
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "..." }]
    }
  ]
}

// Gemini Response → Anthropic Format
{
  "candidates": [
    { "content": { "parts": [{ "text": "..." }] } }
  ]
}
↓
{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "content": [{ "type": "text", "text": "..." }]
}
```

---

### 5.3 Token Management & Rotation

**Mô tả**: Proxy tự động quản lý tokens và rotate khi cần.

**Chức năng**:

#### Token Loading
```typescript
class TokenManagerService {
  private tokens: Map<string, CloudAccountToken> = new Map();
  
  async loadTokens() {
    const accounts = await ipcGetCloudAccounts();
    for (const account of accounts) {
      this.tokens.set(account.id, account.token);
    }
  }
  
  getActiveToken(): string {
    const active = Array.from(this.tokens.values())
      .find(t => t.is_active);
    return active?.access_token;
  }
}
```

#### Auto Rotation on Rate Limit
```typescript
async proxyRequest(req: FastifyRequest) {
  let token = this.tokenManager.getActiveToken();
  
  try {
    const response = await axios.post(GEMINI_API_URL, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {  // Rate limited
      // Trigger auto-switch in main process
      await ipcTriggerAutoSwitch();
      
      // Retry with new token
      token = this.tokenManager.getActiveToken();
      return await axios.post(GEMINI_API_URL, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }
    throw error;
  }
}
```

#### Token Refresh
```typescript
// Tự động refresh token trước khi expire (10 phút buffer)
setInterval(async () => {
  for (const [id, token] of this.tokens) {
    const expiresIn = token.expiry_timestamp - Date.now() / 1000;
    if (expiresIn < 600) {  // < 10 minutes
      const newToken = await refreshAccessToken(token.refresh_token);
      this.tokens.set(id, newToken);
      await ipcUpdateToken(id, newToken);
    }
  }
}, 60 * 1000);  // Check every minute
```

---

### 5.4 Proxy Configuration

**Settings**:
```typescript
interface ProxyConfig {
  enabled: boolean;           // Bật/tắt proxy server
  port: number;               // Port (default: 8045)
  auto_start: boolean;        // Tự động start khi mở app
  allow_lan: boolean;         // Cho phép truy cập từ LAN (default: false)
  timeout: number;            // Request timeout (ms)
  log_requests: boolean;      // Log all requests
  model_mapping: {            // Custom model mapping
    [key: string]: string;
  };
}
```

**Configuration UI**:
```
┌────────────────────────────────────────┐
│  Proxy Configuration                   │
├────────────────────────────────────────┤
│                                        │
│  ☑ Enable Proxy Server                │
│  ☑ Auto-start on app launch            │
│  ☐ Allow LAN access (⚠️ Security risk) │
│  ☑ Log requests                        │
│                                        │
│  Port: [8045]                          │
│  Timeout: [30000] ms                   │
│                                        │
│  Model Mapping:                        │
│  gpt-4         → [gemini-2.0-flash-exp]│
│  gpt-3.5-turbo → [gemini-1.5-flash]   │
│                                        │
│  [Add Mapping] [Reset Defaults]       │
│                                        │
│  📋 Base URL:                          │
│     http://localhost:8045/v1           │
│     [Copy]                             │
│                                        │
│  [Save] [Cancel]                       │
└────────────────────────────────────────┘
```

---

## 🔐 Security

### 6.1 Encryption System

**AES-256-GCM Encryption**:
```typescript
Algorithm: AES-256-GCM
Key Size: 256 bits (32 bytes)
IV Size: 128 bits (16 bytes, random per encryption)
Auth Tag: 128 bits (16 bytes, for integrity)

Format: "iv_hex:auth_tag_hex:ciphertext_hex"
Example: "a1b2c3d4...f0:1a2b3c4d...f0:9f8e7d6c..."
```

**Encryption Flow**:
```typescript
// Encrypt
const key = await getMasterKey();  // From OS keychain
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(plaintext, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag();
return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

// Decrypt
const [ivHex, authTagHex, ciphertext] = encrypted.split(':');
const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
decrypted += decipher.final('utf8');
return decrypted;
```

---

### 6.2 Key Storage Hierarchy

**Priority System**:

```typescript
1️⃣ Electron safeStorage (Preferred)
   ↓
   - Uses OS-level encryption
   - Windows: Data Protection API (DPAPI)
   - macOS: Keychain
   - Linux: libsecret
   
   If fail ↓

2️⃣ keytar (System Keychain)
   ↓
   - Direct access to OS credential manager
   - Fallback when safeStorage unavailable
   
   If fail ↓

3️⃣ File-based (Last Resort)
   ↓
   - Encrypted file: ~/.config/AntigravityManager/.mk
   - Permissions: 0600 (owner only)
   - ⚠️ Less secure, but better than plaintext
```

**Implementation**:
```typescript
async function getMasterKey(): Promise<Buffer> {
  // Try safeStorage
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return await getOrCreateSafeStorageKey();
    } catch (e) {
      logger.warn('safeStorage failed, trying keytar');
    }
  }
  
  // Try keytar
  try {
    const keytar = await import('keytar');
    return await getOrCreateKeytarKey(keytar);
  } catch (e) {
    logger.warn('keytar failed, using file fallback');
  }
  
  // Fallback to file
  return await getOrCreateFileFallbackKey();
}
```

---

### 6.3 Automatic Key Migration

**Problem**: User upgrade app, key storage method thay đổi (keytar → safeStorage).

**Solution**: Automatic migration with backward compatibility.

```typescript
async function decryptWithMigration(encrypted: string) {
  const primary = await getPrimaryMasterKey();  // Current preferred method
  
  try {
    // Try decrypt với key hiện tại
    return decrypt(encrypted, primary.key);
  } catch (error) {
    if (error.message.includes('auth tag mismatch')) {
      // Wrong key! Try fallback keys
      const fallbacks = await getFallbackMasterKeys();
      
      for (const fallback of fallbacks) {
        try {
          const decrypted = decrypt(encrypted, fallback.key);
          
          // Success! Re-encrypt với primary key
          const reencrypted = encrypt(decrypted, primary.key);
          await saveToDatabase(reencrypted);
          
          logger.info(`Migrated data from ${fallback.source} to ${primary.source}`);
          return decrypted;
        } catch {
          continue;
        }
      }
      
      throw new Error('Decryption failed with all available keys');
    }
    throw error;
  }
}
```

**Migration Scenarios**:

| Scenario | Action |
|----------|--------|
| User A: keytar → safeStorage | Auto-migrate on first decrypt |
| User B: file → safeStorage | Auto-migrate on first decrypt |
| User C: safeStorage unavailable | Use file, migrate later when available |

---

## 🎨 UI/UX

### 7.1 Theme System

**Chức năng**:
- ✅ Light mode
- ✅ Dark mode
- ✅ System auto (follow OS)

**Implementation**:
```typescript
// ThemeProvider
<ThemeProvider defaultTheme="system" storageKey="app-theme">
  <App />
</ThemeProvider>

// Toggle
<ToggleTheme />  // Button component
```

**CSS Variables** (Tailwind CSS 4):
```css
@theme {
  --color-background: light-dark(#ffffff, #0a0a0a);
  --color-foreground: light-dark(#0a0a0a, #fafafa);
  --color-primary: light-dark(#18181b, #fafafa);
  --color-accent: light-dark(#f4f4f5, #27272a);
}
```

---

### 7.2 Internationalization (i18n)

**Languages**:
- 🇺🇸 English (default)
- 🇨🇳 简体中文
- 🇻🇳 Tiếng Việt (planned)

**Usage**:
```typescript
import { useTranslation } from 'react-i18next';

function Component() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('account.title')}</h1>
      <p>{t('account.description', { count: 5 })}</p>
    </div>
  );
}
```

**Translation Files**:
```typescript
// src/localization/en.json
{
  "account": {
    "title": "Accounts",
    "description": "You have {{count}} accounts",
    "add": "Add Account",
    "delete": "Delete Account"
  }
}

// src/localization/zh-CN.json
{
  "account": {
    "title": "账号",
    "description": "你有 {{count}} 个账号",
    "add": "添加账号",
    "delete": "删除账号"
  }
}
```

---

### 7.3 Notifications System

**Toast Notifications** (using Sonner):

```typescript
import { toast } from 'sonner';

// Success
toast.success('Account added successfully!');

// Error
toast.error('Failed to fetch quota', {
  description: 'Network error. Please try again.',
  action: {
    label: 'Retry',
    onClick: () => refetch()
  }
});

// Loading
const toastId = toast.loading('Refreshing quota...');
// ... async operation
toast.success('Quota updated!', { id: toastId });

// Custom
toast('Account switched', {
  description: `Now using: ${account.email}`,
  duration: 5000,
});
```

---

### 7.4 Status Indicators

**Account Status**:
- ✅ **Active** (Green): Account đang được sử dụng
- ⏸️ **Idle** (Gray): Account có trong pool nhưng không active
- ⚠️ **Rate Limited** (Yellow): Bị rate limit, chờ reset
- ❌ **Expired** (Red): Token expired, cần login lại
- 🔄 **Refreshing** (Blue): Đang refresh token

**Quota Status** (Color-coded):
- 🟢 **High** (> 50%): Sufficient quota
- 🟡 **Medium** (20-50%): Should consider switching soon
- 🔴 **Low** (< 20%): Auto-switch recommended
- ⚫ **Depleted** (0%): No quota available

**Server Status**:
- ✅ **Running** (Green): Proxy server đang chạy
- ⏹️ **Stopped** (Gray): Server chưa start
- ❌ **Error** (Red): Server gặp lỗi

---

## 🖥️ System Integration

### 8.1 System Tray

**Chức năng**:
- ✅ Background mode (app chạy nền khi close window)
- ✅ Tray icon với context menu
- ✅ Quick actions từ tray

**Tray Menu**:
```
┌─────────────────────────┐
│  Antigravity Manager    │
├─────────────────────────┤
│  📊 Active: user@gmail  │
│     Quota: 75%          │
├─────────────────────────┤
│  ▶️  Start Proxy        │
│  ⏸️  Stop Proxy         │
├─────────────────────────┤
│  🔄 Refresh Quota       │
│  ⚙️  Settings           │
├─────────────────────────┤
│  👁️  Show Window        │
│  ❌ Quit                │
└─────────────────────────┘
```

**Implementation**:
```typescript
const tray = new Tray(iconPath);
const menu = Menu.buildFromTemplate([
  { label: `Active: ${activeAccount.email}`, enabled: false },
  { type: 'separator' },
  { label: 'Start Proxy', click: () => startProxy() },
  { label: 'Settings', click: () => showSettings() },
  { type: 'separator' },
  { label: 'Quit', click: () => app.quit() }
]);
tray.setContextMenu(menu);
```

---

### 8.2 Auto-start on Login

**Chức năng**:
- ✅ Start app khi login vào OS
- ✅ Start minimized to tray
- ✅ Configurable trong Settings

**Implementation**:
```typescript
import autoLaunch from 'auto-launch';

const antiGravityAutoLauncher = new autoLaunch({
  name: 'Antigravity Manager',
  path: app.getPath('exe'),
});

// Enable
await antiGravityAutoLauncher.enable();

// Disable
await antiGravityAutoLauncher.disable();

// Check status
const isEnabled = await antiGravityAutoLauncher.isEnabled();
```

---

### 8.3 Process Management

**Antigravity IDE Control**:

```typescript
// Detect if IDE is running
async function isAntigravityRunning(): Promise<boolean> {
  const processes = await findProcess('name', 'cursor');
  return processes.length > 0;
}

// Launch IDE
async function launchAntigravity() {
  if (process.platform === 'win32') {
    shell.openPath('cursor://');  // URI protocol
  } else {
    spawn('/usr/bin/cursor', { detached: true });
  }
}

// Close IDE gracefully
async function closeAntigravity() {
  const processes = await findProcess('name', 'cursor');
  for (const proc of processes) {
    process.kill(proc.pid, 'SIGTERM');
  }
}

// Force kill (if graceful fails)
async function forceKillAntigravity() {
  const processes = await findProcess('name', 'cursor');
  for (const proc of processes) {
    process.kill(proc.pid, 'SIGKILL');
  }
}
```

**Use Cases**:
- Apply account snapshot → Close IDE → Restore state.vscdb → Reopen IDE
- Switch active account → Restart IDE with new config

---

### 8.4 File System Access

**Database Paths**:
```typescript
// Antigravity IDE state database
Windows: %APPDATA%\Cursor\User\globalStorage\state.vscdb
macOS: ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
Linux: ~/.config/Cursor/User/globalStorage/state.vscdb

// AntigravityManager databases
Windows: %APPDATA%\AntigravityManager\
macOS: ~/Library/Application Support/AntigravityManager/
Linux: ~/.config/AntigravityManager/

Files:
- accounts.db         # Account snapshots
- cloud_accounts.db   # Cloud accounts + tokens
- config.json         # App configuration
- .mk                 # Master key (fallback)
- logs/               # Application logs
```

**Permissions**:
```typescript
// Ensure proper permissions on sensitive files
fs.chmodSync(keyFilePath, 0o600);      // Owner read/write only
fs.chmodSync(dbPath, 0o600);           // Owner read/write only
```

---

## ⚙️ Advanced Features

### 9.1 Developer Tools

**Built-in cURL Generator**:
```typescript
// Generate cURL command for testing proxy
const curl = `curl -X POST http://localhost:${port}/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;

// Copy to clipboard
clipboard.writeText(curl);
```

**Python Code Generator**:
```python
# Generate Python code snippet
import openai

openai.api_base = "http://localhost:8045/v1"
openai.api_key = "ag_xxxxxxxxxxxx"

response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)
print(response.choices[0].message.content)
```

---

### 9.2 Logs & Debugging

**Log Levels**:
- 🔵 **INFO**: Normal operations
- 🟡 **WARN**: Potential issues
- 🔴 **ERROR**: Errors that need attention
- 🐛 **DEBUG**: Detailed debugging info (dev only)

**Log Files**:
```
logs/
├── main.log              # Main process logs
├── renderer.log          # Renderer process logs
├── server.log            # NestJS server logs
├── orpc_packets.log      # RPC communication logs (debug)
└── errors.log            # Error-only logs
```

**Log Viewer UI**:
```
Settings → Advanced → View Logs
- Real-time log streaming
- Filter by level
- Search functionality
- Export logs
```

---

### 9.3 Performance Monitoring

**Metrics Tracked**:
- 📊 API request latency
- 📊 Token rotation frequency
- 📊 Database query times
- 📊 Memory usage
- 📊 Account switch count

**Performance Dashboard** (Future):
```
┌───────────────────────────────────────┐
│  Performance Metrics (Last 24h)      │
├───────────────────────────────────────┤
│  Average API Latency: 245ms          │
│  Token Rotations: 12                 │
│  Account Switches: 8                 │
│  Memory Usage: 156 MB                │
│  Database Size: 2.3 MB               │
└───────────────────────────────────────┘
```

---

## 🎁 Bonus Features

### 10.1 Export/Import Configuration

**Chức năng**:
- ✅ Export toàn bộ config + accounts + snapshots
- ✅ Import trên máy mới
- ✅ Encrypted export file

**Format**:
```typescript
interface ExportData {
  version: string;
  exported_at: number;
  config: AppConfig;
  accounts: AccountSnapshot[];
  cloud_accounts: CloudAccount[];  // Tokens encrypted
  checksum: string;                 // For integrity
}
```

---

### 10.2 Backup & Restore

**Auto Backup**:
- ✅ Daily auto backup of databases
- ✅ Keep last 7 days
- ✅ Compressed backup files

**Manual Backup**:
- ✅ One-click backup trong Settings
- ✅ Custom backup location
- ✅ Restore from backup file

---

### 10.3 Usage Statistics

**Tracked Data**:
- Total requests per account
- Most used models
- Average quota consumption rate
- Peak usage hours
- Account performance comparison

**Privacy**: All data stored locally, không gửi về server.

---

## 🔮 Planned Features (Roadmap)

### Phase 1 (Current)
- [x] Multi-account management
- [x] Auto-switching
- [x] API Proxy (OpenAI)
- [x] Real-time quota monitoring

### Phase 2 (Q2 2026)
- [ ] Claude API key support
- [ ] Anthropic proxy improvements
- [ ] Usage analytics dashboard
- [ ] Better error recovery

### Phase 3 (Q3 2026)
- [ ] Plugin system
- [ ] Custom scripts/automation
- [ ] Team sharing (encrypted)
- [ ] Advanced quota prediction

### Phase 4 (Future)
- [ ] More AI providers (Azure OpenAI, AWS Bedrock)
- [ ] Load balancing algorithm customization
- [ ] Webhook support
- [ ] CLI tool

---

## 📞 Support

- 📖 Docs: [README.md](README.md)
- 🐛 Bug Reports: [GitHub Issues](https://github.com/Draculabo/AntigravityManager/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/Draculabo/AntigravityManager/discussions)

---

**Last Updated**: February 6, 2026
