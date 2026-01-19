# 云端账号管理与智能切换 (Cloud Account Features)

本文档详细介绍了 Antigravity Manager 中实现的云端 AI 账号管理与切换功能。该功能允许用户管理多个 Google 账号，监控 API 配额，并一键无缝切换 IDE 的当前活动账号。

## 1. 核心功能

### 1.1 账号池管理

- **添加账号**：支持通过 Google OAuth 授权码添加账号。
- **列表展示**：展示所有已添加的账号，包括头像、邮箱、最后使用时间。
- **状态监控**：实时显示账号状态（Active, Rate Limited, Expired）以及是否为当前活动账号。
- **删除账号**：支持从本地数据库中移除账号。

### 1.2 配额实时监控

- **多模型支持**：分别监控 `gemini-pro`, `claude-3-5-sonnet` 等模型的配额使用情况。
- **可视化展示**：通过进度条和颜色（绿/黄/红）直观展示剩余配额百分比。
- **自动/手动刷新**：支持手动刷新配额，系统也会在切换前自动检查。

### 1.4 智能自动切换 (Intelligent Auto-Switching)

- **无限池模式**：当检测到当前账号配额不足（<5%）或被限流时，系统会自动寻找最佳备用账号并切换。
- **后台监控**：内置 `CloudMonitorService`, 默认每 5 分钟轮询一次所有账号的 Quota 状态。
- **全局开关**：用户可在界面上一键开启或关闭此功能。

## 2. 技术实现

### 2.1 数据库设计 (`cloud_accounts.db`)

使用 SQLite 存储账号信息，独立于 IDE 的本地数据库。

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,          -- UUID
  provider TEXT NOT NULL,       -- 'google' | 'anthropic'
  email TEXT NOT NULL,          -- 邮箱
  name TEXT,                    -- 显示名称
  avatar_url TEXT,              -- 头像 URL
  token_json TEXT NOT NULL,     -- OAuth Token (JSON)
  quota_json TEXT,              -- 配额数据 (JSON)
  created_at INTEGER NOT NULL,  -- 创建时间戳
  last_used INTEGER NOT NULL,   -- 最后使用时间戳
  status TEXT DEFAULT 'active', -- 账号状态
  is_active INTEGER DEFAULT 0   -- 是否为当前 IDE 活动账号
);

-- 全局配置表
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### 2.2 IPC 接口设计

后端通过 `src/ipc/cloud` 提供以下 oRPC 接口：

- `addGoogleAccount(authCode: string)`: 交换 Token 并保存账号。
- `listCloudAccounts()`: 获取账号列表。
- `refreshAccountQuota(accountId: string)`: 刷新指定账号的配额和 Token。
- `switchCloudAccount(accountId: string)`: 执行账号切换流程。
- `deleteCloudAccount(accountId: string)`: 删除账号。
- `getAutoSwitchEnabled()` / `setAutoSwitchEnabled(enabled)`: 获取/设置自动切换开关。
- `forcePollCloudMonitor()`: 手动触发后台轮询。

### 2.3 Token 注入原理 (`ProtobufUtils`)

IDE 将鉴权信息存储在 `state.vscdb` 的 `ItemTable` 表中，key 为 `jetskiStateSync.agentManagerInitState`。
value 是一个 Base64 编码的 Protobuf 二进制数据。

我们实现了 `src/utils/protobuf.ts` 工具类，能够：

1.  **解码**：解析 Varint 和 Length-Delimited 字段。
2.  **修改**：定位并移除旧的 Field 6 (OAuthTokenInfo)。
3.  **重构**：根据新的 Access Token 和 Refresh Token 构建新的 Field 6 并插入。

### 2.4 切换流程

1.  **Token 检查**：检查目标账号 Token 是否临期，如需刷新则自动刷新。
2.  **停止进程**：优雅关闭 Antigravity 进程。
3.  **注入 Token**：调用 `CloudAccountRepo.injectCloudToken` 修改 IDE 数据库。
4.  **更新状态**：将目标账号标记为 `is_active = 1`，其他账号设为 0。
5.  **重启进程**：重新启动 IDE，使其加载新的凭证。

### 2.5 自动切换逻辑 (`AutoSwitchService`)

1.  **监控**：`CloudMonitorService` 定时（5分钟）轮询所有账号配额。
2.  **判断**：如果当前活动账号的所有关键模型配额低于 5%，或状态为 `rate_limited`。
3.  **择优**：从账号池中筛选状态为 `active` 且配额充足的账号，按配额剩余量排序。
4.  **执行**：自动调用 `switchCloudAccount` 完成切换，并通知用户。

### 2.6 安全加固 (Security Hardening)

- **密钥管理**：使用操作系统原生凭据管理器（Windows Credential Manager / macOS Keychain）通过 `keytar` 库安全存储 Master Key（AES-256）。
- **数据加密**：所有敏感数据（`token_json`, `quota_json`）在存入 SQLite 数据库前均使用 `AES-256-GCM` 算法加密。
- **自动迁移**：应用启动时会自动检测并迁移旧的明文数据，确保安全性平滑升级。
