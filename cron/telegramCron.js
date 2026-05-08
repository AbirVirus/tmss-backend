const cron = require('node-cron');
const axios = require('axios');
const DailyLog = require('../models/DailyLog');
const Loan = require('../models/Loan');
const Member = require('../models/Member');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function sendTelegramMessage(text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML'
    });
    console.log('Telegram report sent successfully');
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

  // Next day's tentative plan: find installments due tomorrow
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
  // Run at 11:59 PM Bangladesh time (UTC+6 = 17:59 UTC)
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

// export for manual trigger via API if needed
async function manualReport() {
  await generateDailyReport();
}

module.exports = { startTelegramCron, manualReport, sendTelegramMessage };
