'use strict';

require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { URL } = require('url');

const db = require('./src/db');
const sessionRoutes = require('./src/routes/sessions');
const mailRoutes = require('./src/routes/mail');
const customerRoutes = require('./src/routes/customers');
const teamRoutes = require('./src/routes/teams');
const { createAgentSession } = require('./src/services/agent');

const PORT = parseInt(process.env.PORT || '8000', 10);

// ── Express ────────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api', sessionRoutes);
app.use('/api', mailRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/teams', teamRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── HTTP + WebSocket server ────────────────────────────────────────────────
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  try {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const sessionId = urlObj.searchParams.get('session_id');
    if (!sessionId) {
      ws.close(1008, 'session_id required');
      return;
    }
    console.log(`[WS] New connection for session ${sessionId}`);
    createAgentSession(ws, sessionId);
  } catch (err) {
    console.error('[WS] connection error', err);
    ws.close(1011, 'Internal error');
  }
});

// ── Start ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await db.sequelize.authenticate();
    console.log('[DB] Connected to MySQL');
    await db.sequelize.sync({ alter: false });
    console.log('[DB] Models synced');
  } catch (err) {
    console.warn('[DB] Could not connect to MySQL:', err.message);
    console.warn('[DB] Continuing without DB (some features may not work)');
  }

  server.listen(PORT, () => {
    console.log(`[Server] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[Server] WebSocket at ws://0.0.0.0:${PORT}/ws?session_id=<id>`);
  });
}

start();
