const CompanyLedger = require('../models/CompanyLedger');
const DailyLog = require('../models/DailyLog');

exports.getByDate = async (req, res) => {
  const { date, supervisorId } = req.query;
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const ledger = await CompanyLedger.findOne({ date: d, supervisorId })
    .populate('collections.memberId')
    .populate('collections.loanId');
  res.json(ledger || null);
};

exports.getRange = async (req, res) => {
  const { startDate, endDate, supervisorId } = req.query;
  const ledgers = await CompanyLedger.find({
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    supervisorId
  }).sort({ date: -1 });
  res.json(ledgers);
};

exports.createOrUpdate = async (req, res) => {
  const { date, supervisorId } = req.body;
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  let ledger = await CompanyLedger.findOne({ date: d, supervisorId });
  if (ledger) {
    Object.assign(ledger, req.body);
    await ledger.save();
  } else {
    ledger = await CompanyLedger.create(req.body);
  }

  await DailyLog.findOneAndUpdate(
    { date: d, supervisorId },
    { companyLedger: ledger._id, totalCollection: ledger.actualCollection,
      totalDue: ledger.totalDuesGenerated, officeDepositStatus: ledger.depositStatus },
    { upsert: true }
  );

  res.json(ledger);
};

exports.addCollection = async (req, res) => {
  const { date, supervisorId, memberId, loanId, amount, installmentNumber } = req.body;
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  let ledger = await CompanyLedger.findOne({ date: d, supervisorId });
  if (!ledger) {
    ledger = await CompanyLedger.create({
      date: d, supervisorId, dailyTarget: 0, actualCollection: 0,
      totalDuesGenerated: 0, cashDepositedToOffice: 0
    });
  }

  ledger.collections.push({ memberId, loanId, amount, installmentNumber });
  ledger.actualCollection += Number(amount);
  await ledger.save();

  await DailyLog.findOneAndUpdate(
    { date: d, supervisorId },
    { companyLedger: ledger._id, totalCollection: ledger.actualCollection },
    { upsert: true }
  );

  res.json(ledger);
};
