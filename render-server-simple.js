// Simple standalone server for Render.com
// Minimal NestJS server without Electron dependencies

const express = require('express');

const PORT = parseInt(process.env.PORT || '10000', 10);
const API_KEY = process.env.API_KEY || 'sk-default-key';

// Supabase config (dùng REST API để persistent storage)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mygkmiofmbhnxzrvrqml.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15Z2ttaW9mbWJobnh6cnZycW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMDI2MTgsImV4cCI6MjA4Mzg3ODYxOH0.agnb8OBTwlI3iOgWdkDRnsKg-WHD1C58ys_8nK4zsxo';

// In-memory Google accounts storage (synced with Supabase DB)
const googleAccounts = [];

// ==========================================
// Supabase Persistence Layer
// ==========================================

async function supabaseRequest(method, path, body = null) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : '',
    };
    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase ${method} ${path} failed: ${response.status} ${text}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// Load accounts từ Supabase DB khi startup
async function loadAccountsFromDB() {
    try {
        const rows = await supabaseRequest('GET', 'proxy_accounts?select=*');
        if (rows && rows.length > 0) {
            googleAccounts.length = 0;
            for (const row of rows) {
                googleAccounts.push({
                    email: row.email,
                    access_token: row.access_token,
                    refresh_token: row.refresh_token || '',
                    addedAt: row.added_at || new Date().toISOString(),
                });
            }
            console.log(`📦 Loaded ${googleAccounts.length} accounts from Supabase DB`);
        } else {
            console.log('📦 No accounts in Supabase DB');
        }
    } catch (err) {
        console.error('⚠️ Failed to load from Supabase DB:', err.message);
        console.log('   (Bảng proxy_accounts chưa tồn tại? Chạy SQL trong Supabase Dashboard)');
    }
}

// Lưu account vào DB
async function saveAccountToDB(account) {
    try {
        // Upsert: nếu email đã tồn tại thì update
        await supabaseRequest('POST',
            'proxy_accounts?on_conflict=email',
            {
                email: account.email,
                access_token: account.access_token,
                refresh_token: account.refresh_token || '',
                added_at: account.addedAt || new Date().toISOString(),
            }
        );
        console.log(`💾 Saved account to DB: ${account.email}`);
    } catch (err) {
        console.error(`⚠️ Failed to save to DB: ${err.message}`);
    }
}

// Xóa account khỏi DB
async function deleteAccountFromDB(email) {
    try {
        await supabaseRequest('DELETE', `proxy_accounts?email=eq.${encodeURIComponent(email)}`);
        console.log(`🗑️ Deleted from DB: ${email}`);
    } catch (err) {
        console.error(`⚠️ Failed to delete from DB: ${err.message}`);
    }
}

// Server configuration (in-memory, persists until restart)
const serverConfig = {
    autoSwitch: true,
    proxyMode: 'public', // 'public' | 'internal'
    roundRobin: true,
};
let roundRobinIndex = 0;

// ==========================================
// Model Usage Tracker (in-memory)
// ==========================================

// Gemini free tier limits (public API)
const MODEL_LIMITS = {
    'gemini-2.5-pro': { rpm: 5, rpd: 25, tpm: 250000 },
    'gemini-2.5-flash': { rpm: 10, rpd: 500, tpm: 250000 },
    'gemini-2.0-flash': { rpm: 15, rpd: 1500, tpm: 1000000 },
    'gemini-2.0-flash-lite': { rpm: 30, rpd: 1500, tpm: 1000000 },
    'gemini-1.5-pro': { rpm: 2, rpd: 50, tpm: 32000 },
    'gemini-1.5-flash': { rpm: 15, rpd: 1500, tpm: 1000000 },
};

// Usage tracker: { "email::model": { requests: [{timestamp}], errors: [{timestamp, code, message}] } }
const usageTracker = {};

function getUsageKey(email, model) {
    return `${email}::${model}`;
}

function recordUsage(email, model, isError = false, errorInfo = null) {
    const key = getUsageKey(email, model);
    if (!usageTracker[key]) {
        usageTracker[key] = { requests: [], errors: [] };
    }
    const now = Date.now();
    usageTracker[key].requests.push({ timestamp: now });
    if (isError && errorInfo) {
        usageTracker[key].errors.push({ timestamp: now, ...errorInfo });
    }
    // Giữ lại data trong 24h
    const dayAgo = now - 24 * 60 * 60 * 1000;
    usageTracker[key].requests = usageTracker[key].requests.filter(r => r.timestamp > dayAgo);
    usageTracker[key].errors = usageTracker[key].errors.filter(r => r.timestamp > dayAgo);
}

function getUsageStats(email, model) {
    const key = getUsageKey(email, model);
    const data = usageTracker[key];
    if (!data) {
        return { rpm: 0, rpd: 0, errors24h: 0, lastError: null };
    }
    const now = Date.now();
    const oneMinAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const rpm = data.requests.filter(r => r.timestamp > oneMinAgo).length;
    const rpd = data.requests.filter(r => r.timestamp > oneDayAgo).length;
    const errors24h = data.errors.filter(r => r.timestamp > oneDayAgo).length;
    const lastError = data.errors.length > 0 ? data.errors[data.errors.length - 1] : null;

    return { rpm, rpd, errors24h, lastError };
}

let accountIndex = 1;
while (process.env[`GOOGLE_ACCOUNT_${accountIndex}`]) {
    try {
        const accountData = JSON.parse(process.env[`GOOGLE_ACCOUNT_${accountIndex}`]);
        googleAccounts.push({
            ...accountData,
            addedAt: new Date().toISOString(),
        });
        console.log(`📧 Loaded account ${accountIndex}: ${accountData.email}`);
    } catch (e) {
        console.error(`❌ Failed to parse GOOGLE_ACCOUNT_${accountIndex}:`, e.message);
    }
    accountIndex++;
}

console.log('🚀 Starting Antigravity Proxy (Standalone Mode)...');
console.log(`📋 Port: ${PORT}`);
console.log(`🔑 API Key: ${API_KEY.substring(0, 15)}...`);
console.log(`👥 Google Accounts: ${googleAccounts.length}`);

// Health check server
const app = express();

// CORS middleware — cho phép admin web gọi API
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

app.use(express.json());

// Auth middleware
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const providedKey = authHeader?.replace('Bearer ', '');
    if (providedKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        accounts: googleAccounts.length,
        config: serverConfig,
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'Antigravity Proxy Server',
        version: '0.7.0',
        status: 'running',
        accounts: googleAccounts.length,
        docs: '/v1/chat/completions',
    });
});

// ==========================================
// Server Configuration API
// ==========================================

// Lấy config hiện tại
app.get('/config', requireAuth, (req, res) => {
    res.json(serverConfig);
});

// Cập nhật config
app.patch('/config', requireAuth, (req, res) => {
    const { autoSwitch, proxyMode, roundRobin } = req.body;

    if (typeof autoSwitch === 'boolean') {
        serverConfig.autoSwitch = autoSwitch;
    }
    if (proxyMode === 'public' || proxyMode === 'internal') {
        serverConfig.proxyMode = proxyMode;
    }
    if (typeof roundRobin === 'boolean') {
        serverConfig.roundRobin = roundRobin;
    }

    console.log('⚙️ Config updated:', JSON.stringify(serverConfig));
    res.json(serverConfig);
});

// ==========================================
// Model Status API
// ==========================================

// Kiểm tra danh sách models khả dụng cho 1 account
async function listModelsForAccount(account) {
    const axios = require('axios');
    const baseUrl = serverConfig.proxyMode === 'internal'
        ? 'https://cloudcode-pa.googleapis.com/v1internal'
        : 'https://generativelanguage.googleapis.com/v1beta';

    try {
        const response = await axios.get(`${baseUrl}/models`, {
            headers: { 'Authorization': `Bearer ${account.access_token}` },
            timeout: 15000,
        });
        // Lọc chỉ lấy Gemini generation models
        const models = (response.data.models || [])
            .filter(m => m.name && m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => ({
                id: m.name.replace('models/', ''),
                displayName: m.displayName || m.name,
                inputTokenLimit: m.inputTokenLimit,
                outputTokenLimit: m.outputTokenLimit,
            }));
        return { success: true, models };
    } catch (err) {
        return {
            success: false,
            models: [],
            error: err.response?.data?.error?.message || err.message,
        };
    }
}

// Kiểm tra nhanh 1 model có hoạt động không (gửi request nhẹ)
async function probeModel(account, modelId) {
    const axios = require('axios');
    const baseUrl = serverConfig.proxyMode === 'internal'
        ? 'https://cloudcode-pa.googleapis.com/v1internal'
        : 'https://generativelanguage.googleapis.com/v1beta';

    try {
        const response = await axios.post(
            `${baseUrl}/models/${modelId}:generateContent`,
            {
                contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
                generationConfig: { maxOutputTokens: 1 },
            },
            {
                headers: {
                    'Authorization': `Bearer ${account.access_token}`,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }
        );
        return { status: 'ok', latencyMs: 0 };
    } catch (err) {
        const status = err.response?.status;
        const message = err.response?.data?.error?.message || err.message;
        if (status === 429) {
            return { status: 'rate_limited', error: message };
        }
        if (status === 401 || status === 403) {
            return { status: 'auth_error', error: message };
        }
        return { status: 'error', error: message };
    }
}

// GET /models/status — trạng thái tất cả models × accounts
app.get('/models/status', requireAuth, async (req, res) => {
    if (googleAccounts.length === 0) {
        return res.json({ accounts: [], message: 'No accounts configured' });
    }

    const targetModels = Object.keys(MODEL_LIMITS);
    const results = [];

    // Xử lý song song cho từng account
    const accountPromises = googleAccounts.map(async (account) => {
        // Lấy list models từ Google
        const listResult = await listModelsForAccount(account);
        const availableModelIds = listResult.models.map(m => m.id);

        // Kiểm tra từng model trong free tier list
        const modelStatuses = targetModels.map(modelId => {
            const limits = MODEL_LIMITS[modelId];
            const usage = getUsageStats(account.email, modelId);
            const isAvailable = availableModelIds.some(id => id.startsWith(modelId));

            // Tính % sử dụng
            const rpmPercent = limits.rpm > 0 ? Math.round((usage.rpm / limits.rpm) * 100) : 0;
            const rpdPercent = limits.rpd > 0 ? Math.round((usage.rpd / limits.rpd) * 100) : 0;

            // Xác định trạng thái
            let status = 'unknown';
            if (!listResult.success) {
                status = 'auth_error';
            } else if (!isAvailable) {
                status = 'unavailable';
            } else if (rpmPercent >= 100 || rpdPercent >= 100) {
                status = 'exhausted';
            } else if (rpmPercent >= 80 || rpdPercent >= 80) {
                status = 'warning';
            } else {
                status = 'ok';
            }

            return {
                model: modelId,
                available: isAvailable,
                status,
                limits,
                usage: {
                    rpm: usage.rpm,
                    rpd: usage.rpd,
                    rpmPercent,
                    rpdPercent,
                    errors24h: usage.errors24h,
                    lastError: usage.lastError,
                },
            };
        });

        return {
            email: account.email,
            tokenValid: listResult.success,
            tokenError: listResult.error || null,
            models: modelStatuses,
        };
    });

    const accountResults = await Promise.all(accountPromises);
    res.json({ accounts: accountResults, checkedAt: new Date().toISOString() });
});

// POST /models/probe — probe 1 model cụ thể cho 1 account
app.post('/models/probe', requireAuth, async (req, res) => {
    const { email, model } = req.body;
    if (!email || !model) {
        return res.status(400).json({ error: 'email and model are required' });
    }
    const account = googleAccounts.find(a => a.email === email);
    if (!account) {
        return res.status(404).json({ error: 'Account not found' });
    }
    const result = await probeModel(account, model);
    res.json({ email, model, ...result });
});

// ==========================================
// Account Management API
// ==========================================

// Lấy danh sách accounts (masked tokens)
app.get('/auth/accounts', requireAuth, (req, res) => {
    const maskedAccounts = googleAccounts.map(acc => ({
        email: acc.email,
        hasToken: !!acc.access_token,
        addedAt: acc.addedAt || new Date().toISOString(),
    }));
    res.json({ accounts: maskedAccounts, total: maskedAccounts.length });
});

// Thêm account mới (từ Supabase OAuth token)
app.post('/auth/accounts', requireAuth, async (req, res) => {
    const { email, access_token, refresh_token } = req.body;

    if (!email || !access_token) {
        return res.status(400).json({ error: 'email and access_token are required' });
    }

    // Kiểm tra trùng email → update token
    const existingIndex = googleAccounts.findIndex(acc => acc.email === email);
    if (existingIndex >= 0) {
        googleAccounts[existingIndex] = {
            ...googleAccounts[existingIndex],
            access_token,
            refresh_token: refresh_token || googleAccounts[existingIndex].refresh_token,
            addedAt: new Date().toISOString(),
        };
        // Persist to DB
        await saveAccountToDB(googleAccounts[existingIndex]);
        console.log(`🔄 Updated account: ${email}`);
        return res.json({ message: 'Account updated', email });
    }

    // Thêm mới
    const newAccount = {
        email,
        access_token,
        refresh_token: refresh_token || '',
        addedAt: new Date().toISOString(),
    };
    googleAccounts.push(newAccount);
    // Persist to DB
    await saveAccountToDB(newAccount);
    console.log(`✅ Added account: ${email} (total: ${googleAccounts.length})`);
    res.json({ message: 'Account added', email, total: googleAccounts.length });
});

// Xóa account
app.delete('/auth/accounts/:email', requireAuth, async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const index = googleAccounts.findIndex(acc => acc.email === email);

    if (index < 0) {
        return res.status(404).json({ error: 'Account not found' });
    }

    googleAccounts.splice(index, 1);
    // Remove from DB
    await deleteAccountFromDB(email);
    console.log(`🗑️ Removed account: ${email} (remaining: ${googleAccounts.length})`);
    res.json({ message: 'Account removed', email, remaining: googleAccounts.length });
});

// Google API client
async function callGoogleGemini(account, messages, model) {
    const axios = require('axios');

    // Map model names
    const modelMap = {
        'gemini-2.5-flash': 'gemini-2.0-flash-exp',
        'gemini-2.0-flash': 'gemini-2.0-flash-exp',
        'gemini-1.5-pro': 'gemini-1.5-pro',
        'gpt-4': 'gemini-2.0-flash-exp',
        'gpt-3.5-turbo': 'gemini-1.5-flash',
        'claude-3-5-sonnet': 'gemini-2.0-flash-exp',
    };

    const geminiModel = modelMap[model] || model || 'gemini-2.0-flash-exp';

    // Convert messages to Gemini format
    const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
    }));

    // Chọn endpoint dựa vào proxy mode
    const baseUrl = serverConfig.proxyMode === 'internal'
        ? 'https://cloudcode-pa.googleapis.com/v1internal'
        : 'https://generativelanguage.googleapis.com/v1beta';

    const url = `${baseUrl}/models/${geminiModel}:generateContent`;
    const response = await axios.post(url, {
        contents,
        generationConfig: {
            temperature: 1,
            maxOutputTokens: 8192,
        },
    }, {
        headers: {
            'Authorization': `Bearer ${account.access_token}`,
            'Content-Type': 'application/json',
        },
        timeout: 30000,
    });

    return response.data;
}

// Chọn account theo chiến lược (round-robin hoặc first)
function pickAccount() {
    if (googleAccounts.length === 0) {
        return null;
    }
    if (serverConfig.roundRobin) {
        const account = googleAccounts[roundRobinIndex % googleAccounts.length];
        roundRobinIndex++;
        return account;
    }
    return googleAccounts[0];
}

// Proxy implementation with real Google API
app.post('/v1/chat/completions', requireAuth, async (req, res) => {

    // Check if we have Google accounts
    if (googleAccounts.length === 0) {
        return res.status(503).json({
            error: {
                message: 'No Google accounts configured. Add accounts via admin panel.',
                type: 'configuration_error',
            },
        });
    }

    const { model, messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
            error: { message: 'Invalid request: messages array required' },
        });
    }

    // Auto-switch: thử nhiều accounts nếu bật
    const maxRetries = serverConfig.autoSwitch ? googleAccounts.length : 1;
    let lastError = null;

    for (let i = 0; i < maxRetries; i++) {
        const account = pickAccount();
        if (!account) {
            break;
        }

        try {
            const geminiResponse = await callGoogleGemini(account, messages, model);

            // Track usage thành công
            const resolvedModel = model || 'gemini-2.0-flash';
            recordUsage(account.email, resolvedModel, false);

            // Extract response
            const candidate = geminiResponse.candidates?.[0];
            const content = candidate?.content?.parts?.[0]?.text || 'No response';

            // Convert to OpenAI format
            const response = {
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: model || 'gemini-2.5-flash',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: content,
                    },
                    finish_reason: candidate?.finishReason?.toLowerCase() || 'stop',
                }],
                usage: {
                    prompt_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
                    completion_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
                    total_tokens: geminiResponse.usageMetadata?.totalTokenCount || 0,
                },
            };

            return res.json(response);

        } catch (error) {
            // Track usage lỗi
            const resolvedModel = model || 'gemini-2.0-flash';
            recordUsage(account.email, resolvedModel, true, {
                code: error.response?.status || 0,
                message: error.response?.data?.error?.message || error.message,
            });

            lastError = error;
            console.error(`❌ Account ${account.email} failed:`, error.response?.data?.error?.message || error.message);

            // Nếu auto-switch bật và có account khác, thử tiếp
            if (serverConfig.autoSwitch && i < maxRetries - 1) {
                console.log(`🔄 Auto-switching to next account (attempt ${i + 2}/${maxRetries})...`);
                continue;
            }
        }
    }

    // Tất cả accounts đều fail
    res.status(lastError?.response?.status || 500).json({
        error: {
            message: lastError?.response?.data?.error?.message || lastError?.message || 'All accounts failed',
            type: 'api_error',
        },
    });
});

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
    console.log(`📡 Health: http://0.0.0.0:${PORT}/health`);
    console.log(`🎯 API: http://0.0.0.0:${PORT}/v1/chat/completions`);

    // Load accounts từ Supabase DB
    await loadAccountsFromDB();
    console.log(`👥 Total accounts available: ${googleAccounts.length}`);
});

// Self-ping for Render free tier
if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
        fetch(`http://localhost:${PORT}/health`)
            .then(res => console.log(`🏓 Self-ping: ${res.status}`))
            .catch(err => console.error('Self-ping failed:', err.message));
    }, 14 * 60 * 1000); // 14 minutes
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
});
