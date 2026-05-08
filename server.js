require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { startTelegramCron } = require('./cron/telegramCron');

const locationRoutes = require('./routes/locations');
const memberRoutes = require('./routes/members');
const loanRoutes = require('./routes/loans');
const companyLedgerRoutes = require('./routes/companyLedger');
const personalLedgerRoutes = require('./routes/personalLedger');
const routeRoutes = require('./routes/routes');
const dailyLogRoutes = require('./routes/dailyLogs');
const syncRoutes = require('./routes/sync');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('../frontend/dist'));

app.use('/api/locations', locationRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/company-ledger', companyLedgerRoutes);
app.use('/api/personal-ledger', personalLedgerRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/daily-logs', dailyLogRoutes);
app.use('/api/sync', syncRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.get('*', (req, res) => {
  res.sendFile('index.html', { root: '../frontend/dist' });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startTelegramCron();
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
