require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Initialise Firebase Admin (and Firestore) once
require('./firebase/admin');

const app = express();

// Parse JSON bodies
app.use(express.json());

// CORS (allow Vite dev server)
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Health check endpoints
app.get('/', (req, res) => res.send('Backend is running ✅'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Token handshake test endpoint (MOST SIMPLE CHECK)
const authFirebase = require('./middleware/authFirebase');
app.get('/api/v1/whoami', authFirebase, (req, res) => {
  res.json({
    ok: true,
    uid: req.user?.uid || null,
    email: req.user?.email || null,
  });
});

// API routes
app.use('/api/v1/transactions', require('./routes/transaction.routes'));
app.use('/api/v1/budgets', require('./routes/budget.routes'));
app.use('/api/v1/goals', require('./routes/goal.routes'));
app.use('/api/v1/categories', require('./routes/category.routes'));
app.use('/api/v1/user', require('./routes/user.routes'));
app.use('/api/v1/crypto', require('./routes/crypto.routes'));
app.use('/api/v1/currency',require('./routes/currency.routes'))

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Single global error handler (keep ONE)
app.use((err, req, res, next) => {
  console.error('[API ERROR]', {
    method: req.method,
    path: req.originalUrl,
    message: err.message,
    stack: err.stack,
  });

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on :${port}`));