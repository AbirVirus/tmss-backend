const cron = require('node-cron');
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const DailyLog = require('../models/DailyLog');
const Loan = require('../models/Loan');
const Member = require('../models/Member');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const VERCEL_URL = process.env.VERCEL_URL || process.env.VERCEL_BRANCH_URL;

let bot = null;

function getBot() {
  if (!TELEGRAM_BOT_TOKEN) return null;
  if (!bot) {
    bot = new Telegraf(TELEGRAM_BOT_TOKEN);

    // /start command — show bot connectivity status
    bot.start(async (ctx) => {
      const dbState = mongoose.connection.readyState;
      const dbStatus = { 0: 'Disconnected', 1: 'Connected', 2: 'Connecting', 3: 'Disconnecting' };
      const dbOk = dbState === 1;

      let apiOk = true;
      try {
        const axios = require('axios');
        const baseUrl = VERCEL_URL
          ? `https://${VERCEL_URL}`
          : 'http://localhost:' + (process.env.PORT || 5000);
        await axios.get(`${baseUrl}/api/health`, { timeout: 5000 });
      } catch (e) { apiOk = false; }

      const membersCount = dbOk ? await Member.countDocuments() : '?';
      const loansActive = dbOk ? await Loan.countDocuments({ status: 'active' }) : '?';

      const status = [
        '<b>TMSS Field Supervisor Bot</b>',
        '',
        '<b>System Status:</b>',
        `  Database: ${dbOk ? 'Connected ' : 'Disconnected '}` + (dbOk ? '' : ''),
        `  API Server: ${apiOk ? 'Online ' : 'Offline '}`,
        '',
        `<b>Stats:</b>`,
        `  Members: ${membersCount}`,
        `  Active Loans: ${loansActive}`,
        '',
        dbOk && apiOk
          ? 'All systems operational.'
          : '<b>Warning:</b> Some systems are down. Check Vercel logs.'
      ].join('\n');

      ctx.replyWithHTML(status);
      console.log(`/start command from chat ${ctx.chat.id}`);
    });

    // /status command — detailed status
    bot.command('status', async (ctx) => {
      const dbState = mongoose.connection.readyState;
      const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];

      let healthOk = false;
      try {
        const axios = require('axios');
        const baseUrl = VERCEL_URL
          ? `https://${VERCEL_URL}`
          : 'http://localhost:' + (process.env.PORT || 5000);
        const { data } = await axios.get(`${baseUrl}/api/health`, { timeout: 5000 });
        healthOk = data.status === 'ok';
      } catch (e) {}

      const today = new Date().toISOString().split('T')[0];
      const todayLog = dbOk === 1 ? await DailyLog.findOne({
        date: {
          $gte: new Date(today),
          $lt: new Date(new Date(today).getTime() + 86400000)
        }
      }) : null;

      const msg = [
        '<b>Detailed Status</b>',
        '',
        '<b>Connections:</b>',
        `  MongoDB: ${states[dbState]} (state ${dbState})`,
        `  Health API: ${healthOk ? 'OK' : 'FAIL'}`,
        `  Environment: ${process.env.NODE_ENV || 'development'}`,
        '',
        `<b>Today (${today}):</b>`,
        `  Log exists: ${todayLog ? 'Yes' : 'No'}`,
        todayLog ? `  Collection: ৳${(todayLog.totalCollection || 0).toLocaleString()}` : '',
        todayLog ? `  KM: ${todayLog.totalKmTraveled || 0}` : '',
        todayLog ? `  Report sent: ${todayLog.telegramReportSent ? 'Yes' : 'No'}` : '',
        '',
        `<b>Bot:</b>`,
        `  Chat ID: ${ctx.chat.id}`,
        `  Webhook: ${VERCEL_URL ? `https://${VERCEL_URL}/api/telegram-webhook` : 'polling (local)'}`
      ].filter(Boolean).join('\n');

      ctx.replyWithHTML(msg);
    });

    // /help command
    bot.command('help', (ctx) => {
      ctx.replyWithHTML(
        '<b>Available Commands:</b>\n\n' +
        '/start — Bot status & connectivity check\n' +
        '/status — Detailed system status\n' +
        '/help — Show this help\n\n' +
        '<i>The bot also sends a daily report at 11:59 PM Bangladesh time.</i>'
      );
    });

    bot.catch((err, ctx) => {
      console.error('Telegram bot error:', err.message);
      ctx.reply('An error occurred. Check server logs.').catch(() => {});
    });
  }
  return bot;
}

// Set webhook for Vercel, or use polling for local
async function initBot() {
  const b = getBot();
  if (!b) {
    console.warn('No TELEGRAM_BOT_TOKEN set — bot features disabled');
    return;
  }

  if (VERCEL_URL) {
    const webhookUrl = `https://${VERCEL_URL}/api/telegram-webhook`;
    try {
      await b.telegram.setWebhook(webhookUrl);
      console.log(`Telegram webhook set to: ${webhookUrl}`);
    } catch (err) {
      console.error('Failed to set webhook:', err.message);
    }
  } else {
    // Local development — use polling
    b.launch();
    console.log('Telegram bot started in polling mode');
  }
}

// Webhook handler for Vercel
async function handleWebhook(req, res) {
  const b = getBot();
  if (!b) return res.status(500).json({ error: 'Bot not configured' });
  try {
    await b.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ====== Existing send & cron ======

async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('Telegram not configured — skipping message');
    return;
  }
  const b = getBot();
  try {
    await b.telegram.sendMessage(TELEGRAM_CHAT_ID, text, { parse_mode: 'HTML' });
    console.log('Telegram message sent');
  } catch (err) {
    console.error('Telegram send failed:', err.response?.data || err.message);
  }
}

function formatCurrency(n) {
  return '৳' + Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2 });
}

function todayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

async function generateDailyReport() {
  const today = todayUTC();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const dailyLog = await DailyLog.findOne({ date: today })
    .populate('companyLedger')
    .populate('personalLedger')
    .populate('dailyRoute');

  if (!dailyLog) {
    await sendTelegramMessage(
      `<b>TMSS Daily Report - ${today.toDateString()}</b>\n\n` +
      'No daily log was recorded today.'
    );
    return;
  }

  const comp = dailyLog.companyLedger || {};
  const pers = dailyLog.personalLedger || {};
  const route = dailyLog.dailyRoute || {};

  const dueTomorrowLoans = await Loan.find({
    status: 'active',
    'installments.dueDate': {
      $gte: tomorrow,
      $lt: new Date(tomorrow.getTime() + 86400000)
    },
    'installments.status': { $in: ['pending', 'partial', 'overdue'] }
  }).populate('memberId');

  let expectedCollection = 0;
  const plannedVillages = new Set();
  const memberDetails = [];

  for (const loan of dueTomorrowLoans) {
    const dueInstallments = loan.installments.filter(i =>
      i.dueDate >= tomorrow &&
      i.dueDate < new Date(tomorrow.getTime() + 86400000) &&
      ['pending', 'partial', 'overdue'].includes(i.status)
    );
    for (const inst of dueInstallments) {
      expectedCollection += (inst.amount - (inst.paidAmount || 0));
    }
    const m = loan.memberId;
    if (m) {
      plannedVillages.add(`${m.location?.village || ''} > ${m.location?.para || ''}`);
      memberDetails.push(
        `• ${m.name} (${m.memberId}) - ${m.location?.village || '?'}, ${m.location?.para || '?'} - Due: ${formatCurrency(inst.amount - (inst.paidAmount || 0))}`
      );
    }
  }

  const topMembers = memberDetails.slice(0, 15);
  const remaining = memberDetails.length - 15;

  const planSection = memberDetails.length > 0
    ? topMembers.join('\n') + (remaining > 0 ? `\n... and ${remaining} more` : '')
    : 'No installments due tomorrow.';

  const villageList = [...plannedVillages].join('\n• ') || 'No planned stops';

  const report = [
    `<b>TMSS Field Report - ${today.toDateString()}</b>`,
    '',
    '<b>━━━ TODAY\'S SUMMARY ━━━</b>',
    '',
    '<b>Company Ledger:</b>',
    `  Daily Target: ${formatCurrency(comp.dailyTarget)}`,
    `  Actual Collection: ${formatCurrency(comp.actualCollection)}`,
    `  Total Dues Generated: ${formatCurrency(comp.totalDuesGenerated)}`,
    `  Cash Deposited: ${formatCurrency(comp.cashDepositedToOffice)} (${comp.depositStatus || 'N/A'})`,
    '',
    '<b>Personal Ledger:</b>',
    `  Daily Allowance: ${formatCurrency(pers.dailyAllowance)}`,
    `  Lunch: ${formatCurrency(pers.lunchExpense)} | Snacks: ${formatCurrency(pers.snacksExpense)}`,
    `  Mobile Bill: ${formatCurrency(pers.mobileBill)}`,
    `  Total Personal Expense: ${formatCurrency(pers.totalPersonalExpense)}`,
    `  Remaining Balance: ${formatCurrency(pers.remainingBalance)}`,
    '',
    '<b>Route:</b>',
    `  Distance Traveled: ${route.totalDistanceKm || 0} km`,
    `  Fuel Cost: ${formatCurrency(route.totalFuelCost || 0)}`,
    `  Members Visited: ${dailyLog.membersVisited || 0}`,
    '',
    '<b>━━━ NEXT DAY\'S PLAN ━━━</b>',
    '',
    `<b>Expected Collection:</b> ${formatCurrency(expectedCollection)}`,
    `<b>Members Due Tomorrow:</b> ${memberDetails.length}`,
    '',
    '<b>Planned Villages/Paras:</b>',
    `• ${villageList}`,
    '',
    '<b>Members Due:</b>',
    planSection
  ].join('\n');

  await sendTelegramMessage(report);

  dailyLog.telegramReportSent = true;
  await dailyLog.save();
}

function startTelegramCron() {
  cron.schedule('59 17 * * *', async () => {
    console.log('Running Telegram daily report cron...');
    try {
      await generateDailyReport();
    } catch (err) {
      console.error('Cron job error:', err);
      await sendTelegramMessage(
        `<b>TMSS Report Error</b>\n\nFailed to generate daily report: ${err.message}`
      );
    }
  }, { timezone: 'Asia/Dhaka' });

  console.log('Telegram cron job scheduled for 11:59 PM daily (Asia/Dhaka)');
}

async function manualReport() {
  await generateDailyReport();
}

module.exports = {
  startTelegramCron,
  manualReport,
  sendTelegramMessage,
  getBot,
  initBot,
  handleWebhook
};
