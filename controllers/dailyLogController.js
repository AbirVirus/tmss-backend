const DailyLog = require('../models/DailyLog');
const CompanyLedger = require('../models/CompanyLedger');
const PersonalLedger = require('../models/PersonalLedger');
const DailyRoute = require('../models/DailyRoute');

exports.getByDate = async (req, res) => {
  const { date, supervisorId } = req.query;
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const log = await DailyLog.findOne({ date: d, supervisorId })
    .populate('companyLedger')
    .populate('personalLedger')
    .populate('dailyRoute');
  res.json(log || null);
};

exports.getRange = async (req, res) => {
  const { startDate, endDate, supervisorId } = req.query;
  const logs = await DailyLog.find({
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    supervisorId
  }).populate('companyLedger').populate('personalLedger').populate('dailyRoute').sort({ date: -1 });
  res.json(logs);
};

exports.getTodaySummary = async (req, res) => {
  const { supervisorId } = req.query;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);

  let log = await DailyLog.findOne({ date: d, supervisorId })
    .populate('companyLedger')
    .populate('personalLedger')
    .populate('dailyRoute');

  if (!log) {
    log = await DailyLog.create({ date: d, supervisorId });
  }

  res.json(log);
};

exports.completeDay = async (req, res) => {
  const { date, supervisorId } = req.body;
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  const log = await DailyLog.findOneAndUpdate(
    { date: d, supervisorId },
    { isComplete: true },
    { new: true }
  ).populate('companyLedger').populate('personalLedger').populate('dailyRoute');

  if (!log) return res.status(404).json({ error: 'Daily log not found' });
  res.json(log);
};

exports.getMonthlyReport = async (req, res) => {
  const { month, year, supervisorId } = req.query;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));

  const logs = await DailyLog.find({
    date: { $gte: start, $lte: end },
    supervisorId
  }).populate('companyLedger');

  const summary = {
    totalCollection: logs.reduce((s, l) => s + (l.totalCollection || 0), 0),
    totalDue: logs.reduce((s, l) => s + (l.totalDue || 0), 0),
    totalKm: logs.reduce((s, l) => s + (l.totalKmTraveled || 0), 0),
    totalFuelCost: logs.reduce((s, l) => s + (l.totalFuelCost || 0), 0),
    totalPersonalExpense: logs.reduce((s, l) => s + (l.totalPersonalExpense || 0), 0),
    workingDays: logs.filter(l => l.isComplete).length,
    totalDays: logs.length
  };

  res.json({ summary, logs });
};
