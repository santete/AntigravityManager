# ⚡ Quick Start Guide - Chạy Local Development

> Hướng dẫn setup và chạy Antigravity Manager trên môi trường local trong 5 phút.

## 📋 Yêu Cầu Hệ Thống

### Required

- ✅ **Node.js**: v20+ (Khuyến nghị: v20.11.0 hoặc mới hơn)
- ✅ **npm**: v10+ (đi kèm với Node.js)
- ✅ **Git**: Để clone repository
- ✅ **OS**: Windows 10+, macOS 10.15+, hoặc Linux (Ubuntu 20.04+)

### Optional

- 🔧 **VSCode**: Editor khuyên dùng
- 🔧 **PowerShell 7**: Cho Windows users (tốt hơn CMD)

### Kiểm Tra Version

```bash
# Kiểm tra Node.js
node --version
# Output mong đợi: v20.x.x hoặc cao hơn

# Kiểm tra npm
npm --version
# Output mong đợi: v10.x.x hoặc cao hơn

# Kiểm tra Git
git --version
# Output mong đợi: git version 2.x.x
```

---

## 🚀 Setup Nhanh (5 Phút)

### Bước 1: Clone Repository

```bash
# Clone project
git clone https://github.com/Draculabo/AntigravityManager.git

# Di chuyển vào thư mục
cd AntigravityManager
```

### Bước 2: Cài Đặt Dependencies

```bash
# Cài đặt tất cả packages (có thể mất 2-3 phút)
npm install
```

**Lưu ý**: 
- Project này **bắt buộc dùng npm** (không dùng yarn hoặc pnpm)
- Đã có `package-lock.json`, npm sẽ cài đúng version

**⚠️ Về Security Vulnerabilities**:

Sau khi cài, có thể thấy warnings về vulnerabilities (VD: "50 vulnerabilities"). **Đừng lo!** Đây là normal với Electron projects:

```bash
# Xem chi tiết
npm audit

# Auto-fix những cái safe (recommended)
npm audit fix

# Verify app vẫn chạy
npm start
```

**Tại sao có nhiều vulnerabilities?**
- ~80% là devDependencies (chỉ dùng lúc dev, không vào production build)
- ~15% là transitive deps (deps của deps, không trực tiếp exploit được)
- Electron apps chạy local, ít threat hơn web apps exposed trên internet
- Nhiều warnings là false positives hoặc không áp dụng với desktop app context

**Khi nào cần lo?**
- ✅ Production dependencies có CRITICAL vulnerability và có exploit proof
- ✅ Vulnerability ảnh hưởng đến user data hoặc system security
- ❌ DevDependencies có moderate/high (có thể ignore)
- ❌ Vulnerabilities trong packages không được app sử dụng

### Bước 3: Chạy Development Server

```bash
# Start app trong development mode
npm start
```

**Chờ**:
- Vite sẽ compile (10-20 giây lần đầu)
- Electron window tự động mở
- Console hiển thị: `"Window created"`, `"Page finished loading"`

### Bước 4: Verify

Sau khi app mở, bạn sẽ thấy:

```
┌─────────────────────────────────────────┐
│  Antigravity Manager                    │
├─────────────────────────────────────────┤
│  📂 Accounts Tab (empty initially)      │
│  🔌 Proxy Tab                           │
│  ⚙️  Settings Tab                       │
└─────────────────────────────────────────┘
```

✅ **Thành công!** App đã chạy trên dev mode.

---

## 🧪 Verify Installation

### Test 1: Main Window Loads

- ✅ Electron window opens
- ✅ UI hiển thị đầy đủ (không có blank screen)
- ✅ Navigation menu hoạt động

### Test 2: Database Initialized

```bash
# Kiểm tra database files được tạo
# Windows
dir %APPDATA%\AntigravityManager\

# macOS/Linux
ls ~/Library/Application\ Support/AntigravityManager/
# hoặc
ls ~/.config/AntigravityManager/
```

**Các files cần có**:
- `accounts.db` - Account snapshots database
- `cloud_accounts.db` - Cloud accounts database

### Test 3: DevTools

Trong app window:
- **Windows/Linux**: `Ctrl + Shift + I`
- **macOS**: `Cmd + Option + I`

Console không có error đỏ (có warnings màu vàng OK).

---

## 📂 Cấu Trúc Project (Quick Overview)

```
AntigravityManager/
│
├── src/
│   ├── main.ts              ← Electron main process entry
│   ├── preload.ts           ← IPC bridge
│   ├── renderer.ts          ← React entry
│   ├── App.tsx              ← Root component
│   │
│   ├── components/          ← React UI components
│   ├── routes/              ← Pages (TanStack Router)
│   ├── ipc/                 ← Backend logic (IPC handlers)
│   ├── server/              ← NestJS proxy server
│   ├── services/            ← Business logic
│   ├── utils/               ← Helper functions
│   └── types/               ← TypeScript types
│
├── forge.config.ts          ← Build configuration
├── package.json             ← Dependencies & scripts
└── vite.*.config.mts        ← Vite configs
```

---

## 🛠️ Development Scripts

### Chạy App

```bash
# Development mode (with hot reload)
npm start

# Tương đương với:
electron-forge start
```

**Hot Reload**:
- Frontend (React): ✅ Auto reload (Vite HMR)
- Backend (Main Process): ❌ Cần restart (Ctrl+C → npm start)

### Code Quality

```bash
# Lint code (ESLint)
npm run lint

# Format code (Prettier)
npm run format:write

# Type checking (TypeScript)
npm run type-check
```

### Testing

```bash
# Unit tests (Vitest)
npm run test:unit
# hoặc watch mode:
npm run test:unit -- --watch

# E2E tests (Playwright)
npm run test:e2e

# Chạy tất cả tests
npm run test:all
```

### Building

```bash
# Package app (không tạo installer)
npm run package

# Build installers cho platform hiện tại
npm run make

# Output:
# - out/AntigravityManager-win32-x64/  (Windows)
# - out/AntigravityManager-darwin-x64/ (macOS)
# - out/make/                          (Installers)
```

---

## 🔧 Development Tips

### 1. Code Inspector (Shift + Click)

Project có tích hợp `code-inspector-plugin`:

1. Chạy `npm start`
2. **Shift + Click** vào bất kỳ UI element nào
3. VSCode tự động mở đúng file component!

### 2. React DevTools

```bash
# Đã được cài tự động trong dev mode
```

Trong app DevTools (F12), bạn sẽ thấy 2 tabs thêm:
- ⚛️ Components (React tree)
- ⚛️ Profiler (Performance)

### 3. Database Browser

Để xem SQLite databases:

```bash
# Cài SQLite browser (nếu chưa có)
# Windows
choco install sqlite

# macOS
brew install sqlite

# Mở database
sqlite3 ~/Library/Application\ Support/AntigravityManager/cloud_accounts.db

# Queries
sqlite> .tables
sqlite> SELECT * FROM accounts;
sqlite> .quit
```

**Hoặc dùng GUI**: [DB Browser for SQLite](https://sqlitebrowser.org/)

### 4. Logging

**View logs trong terminal**:
- Main process: Logs hiển thị trực tiếp trong terminal
- Renderer process: Mở DevTools (F12) → Console tab

**Log files** (nếu chạy production build):
```
Windows: %APPDATA%\AntigravityManager\logs\
macOS: ~/Library/Logs/AntigravityManager/
Linux: ~/.config/AntigravityManager/logs/
```

### 5. Clear App Data (Troubleshooting)

Nếu gặp lỗi lạ, thử clear data:

```bash
# Windows (PowerShell)
Remove-Item -Recurse -Force $env:APPDATA\AntigravityManager\

# macOS
rm -rf ~/Library/Application\ Support/AntigravityManager/

# Linux
rm -rf ~/.config/AntigravityManager/
```

Sau đó restart app → Databases được tạo mới.

---

## 🧩 Common Tasks

### Task 1: Thêm Một Route Mới

```typescript
// 1. Tạo file: src/routes/my-page.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/my-page')({
  component: MyPage,
});

function MyPage() {
  return <div>My New Page!</div>;
}

// 2. TanStack Router tự động detect route
// 3. Access: http://localhost:5173/my-page (dev server port)
```

### Task 2: Thêm API Endpoint (IPC)

```typescript
// 1. Define trong src/ipc/router.ts
export const appRouter = router({
  myNewEndpoint: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      return { message: `Hello ${input.name}!` };
    }),
});

// 2. Call từ renderer (React component)
import { ipcClient } from '@/actions/ipc';

const { data } = await ipcClient.myNewEndpoint.query({ name: 'World' });
console.log(data.message); // "Hello World!"
```

### Task 3: Thêm Component UI Mới

```bash
# Sử dụng shadcn CLI để add component
npx shadcn@latest add button
# Hoặc
npx shadcn@latest add card
npx shadcn@latest add dialog
```

Component sẽ được add vào `src/components/ui/`.

### Task 4: Debug Main Process

**Method 1: Console Logs**
```typescript
// src/main.ts hoặc bất kỳ main process file
import { logger } from './utils/logger';

logger.info('Debug info:', someVariable);
logger.error('Error occurred:', error);
```

Logs hiển thị trong terminal đang chạy `npm start`.

**Method 2: VSCode Debugger**

1. Tạo `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": ["."],
      "outputCapture": "std"
    }
  ]
}
```

2. Set breakpoints trong main process code
3. F5 để start debugging

---

## 🐛 Troubleshooting

### Issue 1: `npm install` Fails

**Lỗi**: `gyp ERR! build error` hoặc `node-gyp` errors

**Giải pháp**:

```bash
# Windows: Cài Visual Studio Build Tools
npm install --global windows-build-tools

# macOS: Cài Xcode Command Line Tools
xcode-select --install

# Linux: Cài build-essential
sudo apt-get install build-essential

# Sau đó retry
npm install
```

**Lỗi**: `keytar` build fails

**Giải pháp**: keytar là optional dependency, app vẫn chạy được (dùng fallback encryption).

---

### Issue 2: App Window Không Mở

**Check**:
```bash
# Xem logs trong terminal
# Tìm errors như:
# - "Failed to load preload script"
# - "render-process-gone"
# - "Page failed to load"
```

**Common fixes**:

```bash
# 1. Clear cache và node_modules
rm -rf node_modules
rm package-lock.json
npm install

# 2. Clear Electron cache
# Windows
del /f "%APPDATA%\Electron\*"

# macOS/Linux
rm -rf ~/Library/Caches/electron/
```

---

### Issue 3: Hot Reload Không Hoạt Động

**Main Process**: Hot reload KHÔNG support cho main process.

**Workaround**: Restart manually (Ctrl+C → npm start)

**Renderer Process**: Nếu HMR không work:

```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Restart
npm start
```

---

### Issue 4: Database Permission Error

**Lỗi**: `SQLITE_CANTOPEN` hoặc `EACCES`

**Giải pháp**:

```bash
# Ensure app data directory exists và có quyền write
# Windows
mkdir %APPDATA%\AntigravityManager
icacls %APPDATA%\AntigravityManager /grant %USERNAME%:F

# macOS/Linux
mkdir -p ~/Library/Application\ Support/AntigravityManager
chmod 755 ~/Library/Application\ Support/AntigravityManager
```

---

### Issue 5: Proxy Server Không Start

**Check logs**:
```
# Trong terminal, tìm:
"NestJS Proxy Server running on http://localhost:8045"
```

**Nếu không thấy**:

1. Port 8045 có thể đã bị chiếm:
```bash
# Windows
netstat -ano | findstr :8045

# macOS/Linux
lsof -i :8045
```

2. Kill process đang dùng port, hoặc đổi port trong Settings.

---

### Issue 6: Security Vulnerabilities Sau `npm install`

**Scenario**: Sau `npm install` thấy "50 vulnerabilities (6 low, 6 moderate, 38 high)"

**Đánh giá rủi ro**:

```bash
# 1. Chi tiết từng cái
npm audit

# 2. Filter chỉ xem high/critical
npm audit --audit-level=high

# 3. Xem advisory URLs để đọc chi tiết
# Click vào links trong output
```

**Action Plan**:

```bash
# ✅ STEP 1: Auto-fix (safe, recommended)
npm audit fix

# Kiểm tra app vẫn chạy
npm start

# ✅ STEP 2: Check remaining vulns
npm audit --production  # Chỉ xem production deps

# ❌ KHÔNG NÊN (trừ khi hiểu rõ):
# npm audit fix --force  # Có thể break app
```

**Quyết định Fix hay Ignore**:

| Tình Huống | Action |
|------------|--------|
| **devDependency** (vite, vitest, eslint, etc.) | ✅ Ignore - Không vào production build |
| **Production dep, severity: LOW** | ⏸️ Monitor - Check trong next update |
| **Production dep, severity: MODERATE** | 📖 Read advisory - Fix nếu áp dụng với use case |
| **Production dep, severity: HIGH/CRITICAL** | 🚨 **Priority fix** - Update hoặc find alternative |
| **Transitive dep không có fix** | ⏰ Wait - Chờ maintainer release patch |

**Ví dụ phân tích**:

```bash
# Output mẫu:
┌───────────────┬─────────────────┐
│ Package       │ better-sqlite3  │
│ Severity      │ high            │
│ Dependency of │ better-sqlite3  │  ← Direct dependency!
│ Path          │ better-sqlite3  │
└───────────────┴─────────────────┘
# ↑ NÀY CẦN QUAN TÂM vì là direct production dep

┌───────────────┬─────────────────┐
│ Package       │ nth-check       │
│ Severity      │ high            │
│ Dependency of │ vite [dev]      │  ← DevDependency!
│ Path          │ vite > ... > nth-check │
└───────────────┴─────────────────┘
# ↑ NÀY CÓ THỂ IGNORE vì chỉ dùng lúc dev
```

**Long-term Strategy**:

1. **Khi start project mới**: Accept current state
2. **Định kỳ (monthly)**: `npm audit` và update deps
3. **Trước release**: `npm audit --production` phải clean
4. **CI/CD**: Add `npm audit --audit-level=high --production` vào pipeline

---

## 🎓 Next Steps

Sau khi chạy được app:

1. **Đọc Architecture**: [GUIDELINE.vi.md](GUIDELINE.vi.md)
2. **Xem Features**: [FEATURES.vi.md](FEATURES.vi.md)
3. **Try Adding Account**: 
   - Click "Add Account" trong UI
   - Follow OAuth flow
   - Xem account xuất hiện trong list
4. **Explore Code**:
   - Start từ `src/main.ts` (entry point)
   - Đọc `src/App.tsx` (React root)
   - Xem `src/ipc/router.ts` (API definitions)

---

## 📚 Useful Resources

### Documentation

- [Electron Docs](https://www.electronjs.org/docs/latest)
- [React Docs](https://react.dev/)
- [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/overview)
- [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Tools

- [Electron Fiddle](https://www.electronjs.org/fiddle) - Electron playground
- [React DevTools](https://react.dev/learn/react-developer-tools) - Browser extension
- [DB Browser for SQLite](https://sqlitebrowser.org/) - Database GUI
- [Postman](https://www.postman.com/) - API testing (cho proxy endpoints)

### Community

- [GitHub Issues](https://github.com/Draculabo/AntigravityManager/issues) - Bug reports
- [GitHub Discussions](https://github.com/Draculabo/AntigravityManager/discussions) - Questions

---

## ⚡ Quick Commands Reference

```bash
# Development
npm start                      # Start dev server
npm run lint                   # Lint code
npm run format:write           # Format code
npm run type-check             # TypeScript check

# Testing
npm run test:unit              # Unit tests
npm run test:e2e               # E2E tests
npm run test:all               # All tests

# Building
npm run package                # Package app
npm run make                   # Build installers

# Cleaning
rm -rf node_modules            # Clear dependencies
rm -rf out                     # Clear build output
rm -rf .vite                   # Clear Vite cache
```

---

## 🆘 Need Help?

Nếu gặp vấn đề:

1. ✅ **Check Troubleshooting section** ở trên
2. ✅ **Check existing issues**: [GitHub Issues](https://github.com/Draculabo/AntigravityManager/issues)
3. ✅ **Search discussions**: [GitHub Discussions](https://github.com/Draculabo/AntigravityManager/discussions)
4. ✅ **Create new issue** với:
   - OS version
   - Node.js version
   - Error logs (paste trong code block)
   - Steps to reproduce

---

**Happy Coding! 🚀**

> Tài liệu được tạo: February 6, 2026  
> Phiên bản: 0.6.0
