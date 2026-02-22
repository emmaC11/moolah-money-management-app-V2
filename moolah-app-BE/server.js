require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Initialise Firebase Admin (and Firestore) once
require('./firebase/admin');

const app = express();

app.use(express.json());

// ✅ CORS (fixes "cors is not defined")
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Routes
app.use('/api/v1/transactions', require('./routes/transaction.routes'));
app.use('/api/v1/budgets', require('./routes/budget.routes'));
app.use('/api/v1/goals', require('./routes/goal.routes'));
app.use('/api/v1/categories', require('./routes/category.routes'));
app.use('/api/v1/user', require('./routes/user.routes'));
app.use('/api/v1/crypto', require('./routes/crypto.routes'));
app.use('/api/v1/currency',require('./routes/currency.routes'))

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// Minimal terminal error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on :${port}`));
