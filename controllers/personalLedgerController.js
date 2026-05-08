const PersonalLedger = require('../models/PersonalLedger');
const DailyLog = require('../models/DailyLog');

exports.getByDate = async (req, res) => {
  const { date, supervisorId } = req.query;
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const ledger = await PersonalLedger.findOne({ date: d, supervisorId });
  res.json(ledger || null);
};

exports.getRange = async (req, res) => {
  const { startDate, endDate, supervisorId } = req.query;
  const ledgers = await PersonalLedger.find({
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    supervisorId
  }).sort({ date: -1 });
  res.json(ledgers);
};

exports.createOrUpdate = async (req, res) => {
  const { date, supervisorId } = req.body;
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  let ledger = await PersonalLedger.findOne({ date: d, supervisorId });
  if (ledger) {
    Object.assign(ledger, req.body);
    await ledger.save();
  } else {
    ledger = await PersonalLedger.create(req.body);
  }

  await DailyLog.findOneAndUpdate(
    { date: d, supervisorId },
    { personalLedger: ledger._id, totalPersonalExpense: ledger.totalPersonalExpense },
    { upsert: true }
  );

  res.json(ledger);
};
