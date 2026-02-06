// render-server.js
// Standalone server cho Render.com (không cần Electron)

const path = require('path');
const fs = require('fs');
const express = require('express');

console.log('🚀 Starting Antigravity Proxy for Render.com...');

// Environment variables
const PORT = parseInt(process.env.PORT || '10000', 10);
const API_KEY = process.env.API_KEY || 'sk-your-default-key';
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('📋 Configuration:');
console.log(`   - Port: ${PORT}`);
console.log(`   - API Key: ${API_KEY.substring(0, 15)}...`);
console.log(`   - Environment: ${NODE_ENV}`);

// Mock config (thay thế AppConfig từ Electron)
const config = {
    port: PORT,
    auto_start: true,
    allow_lan: true,
    timeout: 30000,
    model_mapping: {
        'gpt-4': 'gemini-2.0-flash-exp',
        'gpt-3.5-turbo': 'gemini-1.5-flash',
        'gpt-4-turbo': 'gemini-2.0-flash-exp',
        'claude-3-5-sonnet': 'gemini-2.0-flash-exp',
        'claude-3-opus': 'gemini-2.0-flash-exp',
    },
};

// Express app cho health check
const app = express();

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        port: PORT,
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'Antigravity Proxy Server',
        version: '1.0.0',
        status: 'running',
        docs: '/v1/chat/completions',
    });
});

// Start Express (health check only)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Express health check running on http://0.0.0.0:${PORT}`);
    console.log(`🏥 Health endpoint: http://0.0.0.0:${PORT}/health`);

    // Bootstrap NestJS server
    bootstrapNestServer();
});

// Bootstrap NestJS from Vite build
async function bootstrapNestServer() {
    try {
        console.log('🔄 Loading NestJS server from Vite build...');

        //Strategy 1: Try Vite built output (.vite/build)
        let bootstrapFn;
        try {
            const viteServerPath = path.join(__dirname, '.vite', 'build', 'server', 'main.js');
            if (fs.existsSync(viteServerPath)) {
                console.log('📦 Using Vite build:', viteServerPath);
                const serverModule = require(viteServerPath);
                bootstrapFn = serverModule.bootstrapNestServer;
            }
        } catch (e) {
            console.log('⚠️  Vite build not found, trying direct TS...');
        }

        // Strategy 2: Run TypeScript directly with ts-node
        if (!bootstrapFn) {
            console.log('📦 Using ts-node to run TypeScript source...');

            // Register ts-node
            require('ts-node').register({
                transpileOnly: true,
                compilerOptions: {
                    module: 'commonjs',
                    target: 'es2020',
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
            });

            // Mock electron before importing
            require.cache['electron'] = {
                exports: require('./src/mocks/electron.ts'),
                id: 'electron',
                filename: 'electron.js',
                loaded: true,
                children: [],
                paths: [],
            };

            const serverModule = require('./src/server/main.ts');
            bootstrapFn = serverModule.bootstrapNestServer;
        }

        if (!bootstrapFn) {
            throw new Error('Could not load NestJS server module');
        }

        // Start NestJS
        await bootstrapFn(config);

        console.log('✅ NestJS server started successfully');
        console.log(`📡 API endpoint: http://0.0.0.0:${PORT}/v1/chat/completions`);
        console.log(`🔑 Authorization: Bearer ${API_KEY.substring(0, 15)}...`);

    } catch (error) {
        console.error('❌ Failed to start NestJS server:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Self-ping để tránh sleep (mỗi 14 phút)
const SELF_PING_INTERVAL = 14 * 60 * 1000; // 14 minutes

if (NODE_ENV === 'production') {
    console.log('🏓 Self-ping enabled (every 14 minutes)');

    setInterval(async () => {
        try {
            const response = await fetch(`http://localhost:${PORT}/health`);
            const data = await response.json();
            console.log('🏓 Self-ping OK:', data.timestamp);
        } catch (err) {
            console.error('❌ Self-ping failed:', err.message);
        }
    }, SELF_PING_INTERVAL);
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('⚠️  Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('⚠️  Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

// Uncaught error handling
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

console.log('⏳ Waiting for NestJS bootstrap...');
