// Simple standalone server for Render.com
// Minimal NestJS server without Electron dependencies

const express = require('express');

const PORT = parseInt(process.env.PORT || '10000', 10);
const API_KEY = process.env.API_KEY || 'sk-default-key';

// In-memory Google accounts storage (loaded from ENV + added via API)
const googleAccounts = [];

// Server configuration (in-memory, persists until restart)
const serverConfig = {
    autoSwitch: true,
    proxyMode: 'public', // 'public' | 'internal'
    roundRobin: true,
};
let roundRobinIndex = 0;

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
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
app.post('/auth/accounts', requireAuth, (req, res) => {
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
        console.log(`🔄 Updated account: ${email}`);
        return res.json({ message: 'Account updated', email });
    }

    // Thêm mới
    googleAccounts.push({
        email,
        access_token,
        refresh_token: refresh_token || '',
        addedAt: new Date().toISOString(),
    });
    console.log(`✅ Added account: ${email} (total: ${googleAccounts.length})`);
    res.json({ message: 'Account added', email, total: googleAccounts.length });
});

// Xóa account
app.delete('/auth/accounts/:email', requireAuth, (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const index = googleAccounts.findIndex(acc => acc.email === email);

    if (index < 0) {
        return res.status(404).json({ error: 'Account not found' });
    }

    googleAccounts.splice(index, 1);
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
    console.log(`📡 Health: http://0.0.0.0:${PORT}/health`);
    console.log(`🎯 API: http://0.0.0.0:${PORT}/v1/chat/completions`);
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
