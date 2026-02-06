# 📚 Hướng Dẫn Phát Triển - Antigravity Manager

> Tài liệu này cung cấp hướng dẫn toàn diện về kiến trúc, quy ước code và best practices cho dự án Antigravity Manager.

## 📋 Mục Lục

- [Tổng Quan Dự Án](#-tổng-quan-dự-án)
- [Kiến Trúc Hệ Thống](#-kiến-trúc-hệ-thống)
- [Cấu Trúc Thư Mục](#-cấu-trúc-thư-mục)
- [Tech Stack](#-tech-stack)
- [Quy Ước Code](#-quy-ước-code)
- [Bảo Mật](#-bảo-mật)
- [Testing](#-testing)
- [Build & Deploy](#-build--deploy)

---

## 🎯 Tổng Quan Dự Án

**Antigravity Manager** là ứng dụng desktop Electron giúp quản lý nhiều tài khoản Google Gemini và Claude AI.

### Vấn Đề Giải Quyết

- ✅ Quota tài khoản AI hết nhanh khi sử dụng thường xuyên
- ✅ Phải thủ công chuyển đổi giữa nhiều tài khoản
- ✅ Không biết tài khoản nào còn quota
- ✅ Cần proxy local để tích hợp với các công cụ khác

### Giải Pháp

- 🔄 **Auto-switching**: Tự động chuyển tài khoản khi quota thấp
- 📊 **Real-time monitoring**: Giám sát quota tất cả tài khoản
- 🔌 **API Proxy**: Server proxy tương thích OpenAI/Anthropic API
- 🔐 **Secure Storage**: Mã hóa AES-256-GCM cho token và credentials

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────┐
│                  Renderer Process                    │
│  ┌───────────────────────────────────────────────┐  │
│  │  React UI (Port: vite dev server)            │  │
│  │  - TanStack Router (Routing)                 │  │
│  │  - TanStack Query (State Management)         │  │
│  │  - Radix UI + Tailwind CSS (UI Components)   │  │
│  └───────────────┬───────────────────────────────┘  │
└──────────────────┼──────────────────────────────────┘
                   │ ORPC (Type-safe RPC)
                   │ IPC (Electron)
┌──────────────────▼──────────────────────────────────┐
│                  Main Process                        │
│  ┌─────────────────────────────────────────────┐   │
│  │  IPC Handlers                               │   │
│  │  - Account Management                        │   │
│  │  - Config Management                         │   │
│  │  - Process Control                           │   │
│  └──────────────┬──────────────────────────────┘   │
│                  │                                    │
│  ┌──────────────▼──────────────────────────────┐   │
│  │  Services                                    │   │
│  │  - CloudMonitorService (Auto-switch logic)  │   │
│  │  - GoogleAPIService (API calls)             │   │
│  │  - AutoSwitchService (Switch logic)         │   │
│  └──────────────┬──────────────────────────────┘   │
│                  │                                    │
│  ┌──────────────▼──────────────────────────────┐   │
│  │  Database Layer (SQLite + WAL)              │   │
│  │  - CloudAccountRepo                         │   │
│  │  - Account CRUD                              │   │
│  │  - Encrypted Storage                         │   │
│  └─────────────────────────────────────────────┘   │
│                                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │  OAuth Server (Port 8888)                   │   │
│  │  - Google OAuth Callback Handler            │   │
│  └─────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│            NestJS Proxy Server (Port 8045)            │
│  ┌─────────────────────────────────────────────┐     │
│  │  API Routes                                 │     │
│  │  - /v1/chat/completions (OpenAI format)    │     │
│  │  - /v1/messages (Anthropic format)         │     │
│  └──────────────┬──────────────────────────────┘     │
│                  │                                     │
│  ┌──────────────▼──────────────────────────────┐     │
│  │  Token Manager Service                      │     │
│  │  - Load tokens from Main Process            │     │
│  │  - Rotate on rate-limit                     │     │
│  └──────────────┬──────────────────────────────┘     │
│                  │                                     │
│  ┌──────────────▼──────────────────────────────┐     │
│  │  Proxy to Gemini/Claude APIs               │     │
│  └─────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────┘
```

### Luồng Dữ Liệu Chính

#### 1. OAuth Authentication
```
User → Click Login → Main Process (Shell Open Browser) 
→ Google OAuth → Callback to localhost:8888 
→ AuthServer receives code → Send to Renderer via IPC 
→ Renderer calls API to exchange token → Save to DB (encrypted)
```

#### 2. Quota Monitoring
```
CloudMonitorService (every 5 min or on app focus)
→ Load all accounts from DB
→ Check token expiry → Refresh if needed
→ Fetch quota from Google API
→ Update DB with new quota
→ Check if auto-switch needed
```

#### 3. API Proxy Request
```
External Tool → Request to localhost:8045/v1/chat/completions
→ NestJS Proxy → TokenManager gets active token
→ Transform request to Gemini format
→ Call Gemini API → Transform response back
→ Return OpenAI-compatible response
```

---

## 📁 Cấu Trúc Thư Mục

```
AntigravityManager/
├── src/
│   ├── main.ts                    # Electron main process entry
│   ├── preload.ts                 # Preload script (IPC bridge)
│   ├── renderer.ts                # Renderer entry point
│   ├── App.tsx                    # React root component
│   │
│   ├── actions/                   # Frontend action wrappers
│   │   ├── account.ts            # Account-related actions
│   │   ├── cloud.ts              # Cloud account actions
│   │   └── ...
│   │
│   ├── components/                # React components
│   │   ├── ui/                   # Base UI components (Radix UI)
│   │   ├── AccountCard.tsx       # Account display card
│   │   ├── CloudAccountList.tsx  # Cloud account list
│   │   └── ...
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useAppConfig.ts       # Config management hook
│   │   └── useCloudAccounts.ts   # Cloud accounts hook
│   │
│   ├── ipc/                       # IPC handlers (Main Process)
│   │   ├── handler.ts            # Main RPC handler
│   │   ├── router.ts             # RPC router definition
│   │   ├── account/              # Account snapshot handlers
│   │   ├── cloud/                # Cloud account handlers
│   │   │   ├── authServer.ts    # OAuth callback server
│   │   │   └── handler.ts       # Cloud CRUD operations
│   │   ├── config/               # Config management
│   │   ├── database/             # Database layer
│   │   │   ├── handler.ts       # Main DB (Antigravity accounts)
│   │   │   └── cloudHandler.ts  # Cloud accounts DB
│   │   └── ...
│   │
│   ├── layouts/                   # Page layouts
│   │   └── MainLayout.tsx        # Main app layout
│   │
│   ├── lib/                       # Shared utilities
│   │   ├── utils.ts              # General utilities
│   │   └── antigravity/          # Antigravity-specific logic
│   │
│   ├── localization/              # i18n configuration
│   │   └── i18n.ts               # i18next setup
│   │
│   ├── routes/                    # TanStack Router routes
│   │   ├── __root.tsx            # Root route
│   │   ├── index.tsx             # Home page
│   │   ├── proxy.tsx             # Proxy management page
│   │   └── settings.tsx          # Settings page
│   │
│   ├── server/                    # NestJS proxy server
│   │   ├── main.ts               # Server bootstrap
│   │   ├── app.module.ts         # Main module
│   │   ├── server-config.ts      # Server configuration
│   │   └── modules/              # Feature modules
│   │       └── proxy/            # API proxy module
│   │
│   ├── services/                  # Business logic services
│   │   ├── AutoSwitchService.ts  # Auto-switch logic
│   │   ├── CloudMonitorService.ts # Background monitoring
│   │   └── GoogleAPIService.ts   # Google API client
│   │
│   ├── styles/                    # Global styles
│   │   └── global.css            # Tailwind + custom CSS
│   │
│   ├── types/                     # TypeScript type definitions
│   │   ├── account.ts            # Account types
│   │   ├── cloudAccount.ts       # Cloud account types
│   │   └── config.ts             # Config types
│   │
│   └── utils/                     # Utility functions
│       ├── logger.ts             # Logging utility
│       ├── security.ts           # Encryption/decryption
│       ├── paths.ts              # Path resolution
│       └── ...
│
├── docs/                          # Documentation
├── scripts/                       # Build scripts
├── tests/                         # Test files
│   ├── unit/                     # Unit tests
│   └── e2e/                      # E2E tests
│
├── forge.config.ts                # Electron Forge configuration
├── vite.main.config.mts          # Vite config (Main Process)
├── vite.preload.config.mts       # Vite config (Preload)
├── vite.renderer.config.mts      # Vite config (Renderer)
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Dependencies & scripts
```

---

## 🛠️ Tech Stack

### Core Technologies

| Thành Phần | Công Nghệ | Mục Đích |
|-----------|----------|----------|
| **Desktop Framework** | Electron 37 | Cross-platform desktop app |
| **UI Framework** | React 19 | Component-based UI |
| **Language** | TypeScript 5.9 | Type safety |
| **Build Tool** | Vite 5 | Fast HMR & bundling |
| **Backend Framework** | NestJS 11 | Proxy server |

### Frontend Stack

| Thành Phần | Công Nghệ | Mục Đích |
|-----------|----------|----------|
| **Routing** | TanStack Router | Type-safe routing |
| **State Management** | TanStack Query | Server state & caching |
| **UI Components** | Radix UI | Accessible primitives |
| **Styling** | Tailwind CSS 4 | Utility-first CSS |
| **Icons** | Lucide React | Icon library |
| **Toasts** | Sonner | Notification system |

### Backend Stack

| Thành Phần | Công Nghệ | Mục Đích |
|-----------|----------|----------|
| **HTTP Server** | Fastify | High-performance server |
| **RPC** | ORPC | Type-safe IPC communication |
| **Database** | Better-SQLite3 | Local SQLite database |
| **Validation** | Zod | Runtime validation |
| **HTTP Client** | Axios | API requests |

### Security & Storage

| Thành Phần | Công Nghệ | Mục Đích |
|-----------|----------|----------|
| **Encryption** | crypto (AES-256-GCM) | Data encryption |
| **Key Storage** | keytar + safeStorage | Secure credential storage |
| **Auth** | OAuth 2.0 | Google authentication |

### Development Tools

| Thành Phần | Công Nghệ | Mục Đích |
|-----------|----------|----------|
| **Testing** | Vitest | Unit testing |
| **E2E Testing** | Playwright | End-to-end testing |
| **Linting** | ESLint | Code quality |
| **Formatting** | Prettier | Code formatting |
| **Error Tracking** | Sentry | Error monitoring |

---

## 📝 Quy Ước Code

### Naming Conventions

```typescript
// ✅ Files
AccountCard.tsx           // Components: PascalCase
account.service.ts        // Services: camelCase.service.ts
cloudHandler.ts          // Handlers: camelCase
account.ts               // Types: camelCase

// ✅ Variables & Functions
const userName = 'John';              // camelCase
function getUserById(id: string) {}   // camelCase

// ✅ Constants
const MAX_RETRY_COUNT = 3;            // UPPER_SNAKE_CASE
const API_BASE_URL = 'https://...';   // UPPER_SNAKE_CASE

// ✅ Components
export const AccountCard: React.FC<Props> = () => {}  // PascalCase

// ✅ Types & Interfaces
interface CloudAccount {}             // PascalCase
type UserRole = 'admin' | 'user';    // PascalCase

// ❌ Tránh viết tắt không rõ nghĩa
const btn = document.getElementById('button');  // ❌
const button = document.getElementById('button'); // ✅
```

### File Structure Best Practices

```typescript
// ✅ Component Structure
// ComponentName.tsx

// 1. Imports (nhóm theo thứ tự)
import { useState, useEffect } from 'react';  // React
import { useQuery } from '@tanstack/react-query';  // External libs
import { Button } from '@/components/ui/button';  // Internal components
import { CloudAccount } from '@/types/cloudAccount';  // Types
import { logger } from '@/utils/logger';  // Utils

// 2. Types/Interfaces
interface ComponentProps {
  account: CloudAccount;
  onSelect?: (id: string) => void;
}

// 3. Component
export const ComponentName: React.FC<ComponentProps> = ({ account, onSelect }) => {
  // 4. Hooks (gọi theo thứ tự)
  const { t } = useTranslation();
  const [state, setState] = useState(false);
  const { data } = useQuery({ ... });
  
  // 5. Effects
  useEffect(() => {
    // ...
  }, []);
  
  // 6. Handlers
  const handleClick = () => {
    // ...
  };
  
  // 7. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

### Code Style Guidelines

#### 1. TypeScript Strict Mode

```typescript
// ✅ Luôn định nghĩa types rõ ràng
function processAccount(account: CloudAccount): void {
  // ...
}

// ❌ Tránh dùng any
function processData(data: any) {}  // ❌
function processData(data: unknown) {}  // ✅ (nếu thực sự không biết type)

// ✅ Sử dụng optional chaining
const email = account?.user?.email ?? 'unknown';

// ❌ Tránh non-null assertion nếu không chắc chắn
const name = user!.name;  // ❌ Chỉ dùng khi 100% chắc chắn
```

#### 2. Async/Await & Error Handling

```typescript
// ✅ Luôn handle errors
async function fetchAccounts() {
  try {
    const accounts = await CloudAccountRepo.getAccounts();
    return accounts;
  } catch (error) {
    logger.error('Failed to fetch accounts', error);
    throw new Error('Failed to fetch accounts');
  }
}

// ✅ Fail fast - kiểm tra input sớm
function calculateQuota(account: CloudAccount) {
  if (!account) {
    throw new Error('Account is required');
  }
  
  if (!account.quota) {
    throw new Error('Account quota is not available');
  }
  
  // ... logic
}
```

#### 3. React Best Practices

```typescript
// ✅ Sử dụng memo cho expensive computations
const expensiveValue = useMemo(() => {
  return accounts.filter(a => a.quota > 1000).sort(...);
}, [accounts]);

// ✅ Sử dụng useCallback cho handlers
const handleAccountSelect = useCallback((id: string) => {
  onSelect?.(id);
}, [onSelect]);

// ✅ Conditional rendering rõ ràng
return (
  <div>
    {isLoading ? (
      <LoadingSpinner />
    ) : error ? (
      <ErrorMessage error={error} />
    ) : (
      <AccountList accounts={accounts} />
    )}
  </div>
);
```

#### 4. Comments & Documentation

```typescript
// ✅ Giải thích "TẠI SAO" không phải "LÀM GÌ"

// ❌ Bad - stating the obvious
// Increment counter by 1
counter++;

// ✅ Good - explaining why
// We need to poll every 5 minutes to stay under rate limits
// More frequent polling would trigger 429 errors
const POLL_INTERVAL = 1000 * 60 * 5;

/**
 * ✅ JSDoc cho functions quan trọng
 * 
 * Decrypts encrypted data with automatic migration support.
 * If decryption fails with current key, attempts fallback keys
 * and re-encrypts with current key on success.
 * 
 * @param text - Encrypted string in format "iv:authTag:ciphertext"
 * @returns Decrypted value and optional re-encrypted string
 * @throws Error if decryption fails with all available keys
 */
export async function decryptWithMigration(text: string): Promise<{
  value: string;
  reencrypted?: string;
}> {
  // ...
}
```

#### 5. Database Operations

```typescript
// ✅ Luôn dùng prepared statements (Better-SQLite3 auto-prepare)
const stmt = db.prepare('SELECT * FROM accounts WHERE email = ?');
const account = stmt.get(email);

// ❌ NEVER concatenate user input
const query = `SELECT * FROM accounts WHERE email = '${email}'`;  // ❌ SQL Injection!

// ✅ Sử dụng transactions cho multiple operations
const db = getDb();
const transaction = db.transaction(() => {
  db.prepare('UPDATE accounts SET quota = ? WHERE id = ?').run(quota, id);
  db.prepare('INSERT INTO logs ...').run(...);
});
transaction();
```

### Import Organization

```typescript
// Thứ tự import chuẩn:

// 1. Node built-ins
import path from 'path';
import fs from 'fs';

// 2. External dependencies (theo alphabet)
import { app, BrowserWindow } from 'electron';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// 3. Internal imports (theo alphabet, sử dụng @ alias)
import { CloudAccount } from '@/types/cloudAccount';
import { Button } from '@/components/ui/button';
import { logger } from '@/utils/logger';
import { encrypt, decrypt } from '@/utils/security';

// 4. Relative imports (nếu cần)
import { helperFunction } from './helpers';
```

---

## 🔐 Bảo Mật

### Encryption Strategy

#### Key Storage Hierarchy

```typescript
Priority 1: Electron safeStorage (OS-level encryption)
  ↓ (nếu fail)
Priority 2: keytar (System Keychain - Keychain Access macOS, Credential Manager Windows)
  ↓ (nếu fail)
Priority 3: File-based encrypted storage (.mk file)
```

#### Encryption Implementation

```typescript
// AES-256-GCM với random IV
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

// Format: "iv_hex:auth_tag_hex:ciphertext_hex"
const encrypted = await encrypt(sensitiveData);

// Automatic migration khi detect key cũ
const { value, reencrypted } = await decryptWithMigration(encrypted);
if (reencrypted) {
  await saveToDatabase(reencrypted);  // Update với key mới
}
```

### Security Best Practices

#### 1. Token Management

```typescript
// ✅ Luôn encrypt tokens trước khi lưu DB
const tokenJson = JSON.stringify(token);
const encryptedToken = await encrypt(tokenJson);
db.prepare('INSERT INTO accounts (token_json) VALUES (?)').run(encryptedToken);

// ✅ Auto-refresh tokens trước khi expire
const now = Math.floor(Date.now() / 1000);
if (token.expiry_timestamp < now + 600) {  // 10 phút buffer
  const newToken = await GoogleAPIService.refreshAccessToken(token.refresh_token);
  // Save new token...
}

// ❌ NEVER log tokens
console.log('Token:', token);  // ❌
logger.info('Token refreshed for user', { email: user.email });  // ✅
```

#### 2. Input Validation

```typescript
// ✅ Validate tất cả input với Zod
import { z } from 'zod';

const AccountSchema = z.object({
  email: z.string().email(),
  provider: z.enum(['google', 'claude']),
  quota: z.number().min(0).max(100),
});

// Validation
const result = AccountSchema.safeParse(input);
if (!result.success) {
  throw new Error('Invalid input');
}
```

#### 3. Network Security

```typescript
// ⚠️ HIỆN TẠI: Proxy bind trên 0.0.0.0
await app.listen(port, '0.0.0.0');  // ⚠️ Có thể truy cập từ LAN

// ✅ KHUYẾN NGHỊ: Bind trên localhost only
await app.listen(port, '127.0.0.1');  // ✅ Chỉ localhost

// ✅ Hoặc thêm config option
if (config.proxy.allow_lan) {
  await app.listen(port, '0.0.0.0');
} else {
  await app.listen(port, '127.0.0.1');
}
```

#### 4. OAuth Security

```typescript
// ⚠️ CẦN CẢI THIỆN: Thêm CSRF protection
// Generate state token
const state = crypto.randomBytes(16).toString('hex');
sessionStorage.setItem('oauth_state', state);

// Include in OAuth URL
const authUrl = `${OAUTH_URL}?client_id=${CLIENT_ID}&state=${state}...`;

// Validate khi callback
if (receivedState !== storedState) {
  throw new Error('CSRF token mismatch');
}
```

### Security Checklist

- [ ] **Encryption**: Tất cả sensitive data phải được encrypt
- [ ] **Token Management**: Auto-refresh, never log, store encrypted
- [ ] **Input Validation**: Validate với Zod trước khi xử lý
- [ ] **SQL Injection**: Luôn dùng prepared statements
- [ ] **Network**: Bind proxy trên localhost nếu không cần LAN access
- [ ] **CSRF**: Implement state token cho OAuth flow
- [ ] **Logging**: Never log passwords, tokens, hoặc PII
- [ ] **Dependencies**: Thường xuyên update để patch vulnerabilities

---

## 🧪 Testing

### Test Structure

```
tests/
├── unit/                          # Unit tests
│   ├── services/
│   │   ├── CloudMonitorService.test.ts
│   │   └── GoogleAPIService.test.ts
│   ├── utils/
│   │   ├── security.test.ts
│   │   └── logger.test.ts
│   └── ipc/
│       └── cloudHandler.test.ts
│
└── e2e/                           # End-to-end tests
    ├── account-management.spec.ts
    ├── oauth-flow.spec.ts
    └── proxy-server.spec.ts
```

### Writing Tests

#### Unit Tests (Vitest)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudMonitorService } from '@/services/CloudMonitorService';

describe('CloudMonitorService', () => {
  beforeEach(() => {
    CloudMonitorService.resetStateForTesting();
  });

  it('should start monitoring with correct interval', () => {
    vi.useFakeTimers();
    
    CloudMonitorService.start();
    
    expect(CloudMonitorService['intervalId']).not.toBeNull();
    
    vi.useRealTimers();
  });

  it('should debounce rapid focus events', async () => {
    vi.useFakeTimers();
    const pollSpy = vi.spyOn(CloudMonitorService, 'poll');
    
    // First focus
    await CloudMonitorService.handleAppFocus();
    expect(pollSpy).toHaveBeenCalledTimes(1);
    
    // Second focus within debounce window
    vi.advanceTimersByTime(5000); // 5 seconds < 10 second debounce
    await CloudMonitorService.handleAppFocus();
    expect(pollSpy).toHaveBeenCalledTimes(1); // Should still be 1
    
    vi.useRealTimers();
  });
});
```

#### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test('should add cloud account via OAuth', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();
  
  // Click add account button
  await window.click('[data-testid="add-account-btn"]');
  
  // Wait for OAuth browser window
  // ... mock OAuth flow
  
  // Verify account appears in list
  await expect(window.locator('[data-testid="account-card"]')).toBeVisible();
  
  await app.close();
});
```

### Running Tests

```bash
# Unit tests
npm run test:unit                 # Run once
npm run test:unit -- --watch      # Watch mode
npm run test:unit -- path/to/test.test.ts  # Single file

# E2E tests
npm run test:e2e                  # All E2E tests
npm run test:e2e -- path/to/test.spec.ts   # Single spec

# All tests
npm run test:all                  # Run all tests

# Coverage
npm run test:unit -- --coverage   # Generate coverage report
```

### Test Best Practices

```typescript
// ✅ Descriptive test names
it('should refresh token when expiry is within 10 minutes', () => {});

// ❌ Vague test names
it('should work', () => {});

// ✅ Arrange-Act-Assert pattern
it('should calculate quota percentage correctly', () => {
  // Arrange
  const account = { quota: { used: 75, total: 100 } };
  
  // Act
  const percentage = calculateQuotaPercentage(account);
  
  // Assert
  expect(percentage).toBe(75);
});

// ✅ Mock external dependencies
it('should handle API errors gracefully', async () => {
  vi.spyOn(GoogleAPIService, 'fetchQuota').mockRejectedValue(
    new Error('Network error')
  );
  
  await expect(CloudMonitorService.poll()).rejects.toThrow();
});

// ✅ Clean up after tests
afterEach(() => {
  vi.restoreAllMocks();
  CloudMonitorService.stop();
});
```

---

## 🚀 Build & Deploy

### Build Process

```bash
# Development build
npm start                         # Start dev server with HMR

# Production build
npm run package                   # Package app (no installer)
npm run make                      # Build platform-specific installers

# Platform-specific builds (auto-detected)
# Windows: .exe, .msi
# macOS: .dmg, .app
# Linux: .deb, .rpm, .AppImage
```

### Build Configuration

```typescript
// forge.config.ts
export default {
  makers: [
    {
      name: '@electron-forge/maker-squirrel',  // Windows
      config: {
        name: 'AntigravityManager',
        authors: 'Draculabo',
        setupIcon: './src/assets/icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-dmg',       // macOS
      config: {
        format: 'ULFO',
        icon: './src/assets/icon.icns',
      },
    },
    {
      name: '@electron-forge/maker-deb',       // Linux (Debian)
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          { entry: 'src/main.ts', config: 'vite.main.config.mts' },
          { entry: 'src/preload.ts', config: 'vite.preload.config.mts' },
        ],
        renderer: [
          { name: 'main_window', config: 'vite.renderer.config.mts' },
        ],
      },
    },
  ],
};
```

### Release Process

Dự án sử dụng semantic-release tự động:

1. Commit theo [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add auto-switch feature"
   git commit -m "fix: resolve token refresh bug"
   git commit -m "docs: update README"
   ```

2. Push to main branch → GitHub Actions tự động:
   - Build for all platforms
   - Run tests
   - Create GitHub Release
   - Upload artifacts

### Pre-release Checklist

- [ ] All tests passing (`npm run test:all`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code formatted (`npm run format:write`)
- [ ] TypeScript check passes (`npm run type-check`)
- [ ] CHANGELOG updated (auto-generated)
- [ ] Version bumped (auto via semantic-release)

---

## 📚 Tài Liệu Tham Khảo

- [Electron Documentation](https://www.electronjs.org/docs/latest)
- [React Documentation](https://react.dev/)
- [TanStack Query](https://tanstack.com/query/latest)
- [TanStack Router](https://tanstack.com/router/latest)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3)
- [Electron Forge](https://www.electronforge.io/)

---

## 🤝 Đóng Góp

Xem [CONTRIBUTING.md](CONTRIBUTING.md) để biết chi tiết về quy trình đóng góp.

---

## 📄 License

[CC BY-NC-SA 4.0](LICENSE) - Chỉ cho mục đích học tập, không thương mại.
