require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { startTelegramCron, initBot, handleWebhook, sendTelegramMessage } = require('./cron/telegramCron');

const locationRoutes = require('./routes/locations');
const memberRoutes = require('./routes/members');
const loanRoutes = require('./routes/loans');
const companyLedgerRoutes = require('./routes/companyLedger');
const personalLedgerRoutes = require('./routes/personalLedger');
const routeRoutes = require('./routes/routes');
const dailyLogRoutes = require('./routes/dailyLogs');
const syncRoutes = require('./routes/sync');

let dbError = null;

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Telegram webhook — raw body needed for telegraf
app.post('/api/telegram-webhook', express.json(), (req, res) => {
  handleWebhook(req, res);
});

// API routes
app.use('/api/locations', locationRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/company-ledger', companyLedgerRoutes);
app.use('/api/personal-ledger', personalLedgerRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/daily-logs', dailyLogRoutes);
app.use('/api/sync', syncRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Full system status
app.get('/api/status', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  let memberCount = 0, loanCount = 0, todayLog = null;
  if (dbState === 1) {
    try {
      memberCount = await require('./models/Member').countDocuments();
      loanCount = await require('./models/Loan').countDocuments();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 86400000);
      todayLog = await require('./models/DailyLog').findOne({
        date: { $gte: today, $lt: tomorrow }
      });
    } catch (e) {}
  }

  res.json({
    status: dbState === 1 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    database: {
      status: states[dbState],
      connected: dbState === 1,
      configured: !!process.env.MONGO_URI,
      error: dbError
    },
    telegram: {
      tokenConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
      chatIdConfigured: !!process.env.TELEGRAM_CHAT_ID,
      vercelUrl: process.env.VERCEL_URL || null
    },
    stats: {
      members: memberCount,
      loans: loanCount,
      todayLogExists: !!todayLog,
      todayCollection: todayLog?.totalCollection || 0,
      todayKm: todayLog?.totalKmTraveled || 0,
      reportSent: todayLog?.telegramReportSent || false
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

const PORT = process.env.PORT || 5000;

// Start Telegram bot immediately — doesn't need database
initBot().catch(err => console.error('Telegram init error:', err.message));

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000
})
  .then(async () => {
    console.log('MongoDB connected');
    dbError = null;
    startTelegramCron();

    if (process.env.NODE_ENV !== 'production') {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    dbError = err.message;
  });

// Vercel requires the export
module.exports = app;
