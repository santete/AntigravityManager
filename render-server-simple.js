// Simple standalone server for Render.com
// Minimal NestJS server without Electron dependencies

const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.PORT || '10000', 10);
const API_KEY = process.env.API_KEY || 'sk-default-key';

console.log('🚀 Starting Antigravity Proxy (Standalone Mode)...');
console.log(`📋 Port: ${PORT}`);
console.log(`🔑 API Key: ${API_KEY.substring(0, 15)}...`);

// Health check server
const app = express();

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app. get('/', (req, res) => {
  res.json({
    name: 'Antigravity Proxy Server',
    version: '0.6.0',
    status: 'running',
    docs: '/v1/chat/completions',
  });
});

// Simple proxy implementation (without full NestJS if build fails)
app.post('/v1/chat/completions', express.json(), async (req, res) => {
  const authHeader = req.headers.authorization;
  const providedKey = authHeader?.replace('Bearer ', '');
  
  if (providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Placeholder response - replace with actual Google API call
  res.json({
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: req.body.model || 'gemini-2.5-flash',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: 'Antigravity Proxy đang chạy trên Render.com! API endpoints sẽ được implement sau khi solve Electron dependencies.',
      },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: 20,
      completion_tokens: 30,
      total_tokens: 50,
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
