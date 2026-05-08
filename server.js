require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { startTelegramCron } = require('./cron/telegramCron');

// Routes (আপনার কোড অনুযায়ী)
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

// Vercel-এ স্ট্যাটিক ফাইল সার্ভ করার দরকার নেই কারণ ফ্রন্টএন্ড আলাদাভাবে ডেপ্লয় হয়েছে। 
// তাই স্ট্যাটিক এবং '*' রাউটগুলো সরিয়ে দেওয়া হয়েছে।

app.use('/api/locations', locationRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/company-ledger', companyLedgerRoutes);
app.use('/api/personal-ledger', personalLedgerRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/daily-logs', dailyLogRoutes);
app.use('/api/sync', syncRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const PORT = process.env.PORT || 5000;

// MongoDB কানেকশন এবং অ্যাপ এক্সপোর্ট
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    // Vercel-এর জন্য app.listen সরাসরি দরকার নেই, তবে লোকাল টেস্টের জন্য এটি রাখা হয়েছে
    if (process.env.NODE_ENV !== 'production') {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
    // Cron Job স্টার্ট করা
    startTelegramCron();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
  });

module.exports = app; // Vercel-এর জন্য এটি আবশ্যিক
