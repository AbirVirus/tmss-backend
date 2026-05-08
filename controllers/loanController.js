const Loan = require('../models/Loan');
const Member = require('../models/Member');

exports.getAll = async (req, res) => {
  const { status, memberId, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (memberId) filter.memberId = memberId;
  const loans = await Loan.find(filter)
    .populate('memberId')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Loan.countDocuments(filter);
  res.json({ loans, total, page: Number(page), pages: Math.ceil(total / limit) });
};

exports.getById = async (req, res) => {
  const loan = await Loan.findById(req.params.id).populate('memberId');
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  res.json(loan);
};

exports.create = async (req, res) => {
  const {
    memberId, principalAmount, interestRate, totalInstallments,
    installmentAmount, startDate, disbursedBy
  } = req.body;

  const member = await Member.findById(memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const totalPayable = principalAmount + (principalAmount * interestRate / 100);
  const loanId = 'LN-' + Date.now().toString(36).toUpperCase();

  const installments = [];
  let currentDate = new Date(startDate);
  for (let i = 0; i < totalInstallments; i++) {
    const dueDate = new Date(currentDate);
    dueDate.setMonth(dueDate.getMonth() + 1);
    currentDate = dueDate;
    installments.push({
      installmentNumber: i + 1,
      dueDate,
      amount: installmentAmount,
      paidAmount: 0,
      status: 'pending'
    });
  }

  const loan = await Loan.create({
    loanId,
    memberId,
    principalAmount,
    interestRate,
    totalPayable,
    totalPaid: 0,
    remainingBalance: totalPayable,
    installmentAmount,
    totalInstallments,
    installments,
    startDate,
    endDate: installments[installments.length - 1].dueDate,
    disbursedBy
  });

  res.status(201).json(loan);
};

exports.recordPayment = async (req, res) => {
  const { installmentNumber, amount, collectedBy } = req.body;
  const loan = await Loan.findById(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });

  const installment = loan.installments.find(i => i.installmentNumber === Number(installmentNumber));
  if (!installment) return res.status(404).json({ error: 'Installment not found' });

  installment.paidAmount += Number(amount);
  if (installment.paidAmount >= installment.amount) {
    installment.status = 'paid';
    installment.paidAt = new Date();
    installment.collectedBy = collectedBy;
  } else {
    installment.status = 'partial';
  }

  loan.totalPaid = loan.installments.reduce((sum, i) => sum + i.paidAmount, 0);
  loan.remainingBalance = loan.totalPayable - loan.totalPaid;

  const allPaid = loan.installments.every(i => i.status === 'paid');
  if (allPaid) {
    loan.status = 'completed';
    loan.endDate = new Date();
  }

  await loan.save();
  res.json(loan);
};

exports.getDueToday = async (req, res) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const loans = await Loan.find({
    status: 'active',
    'installments.dueDate': { $gte: today, $lt: tomorrow },
    'installments.status': { $in: ['pending', 'partial', 'overdue'] }
  }).populate('memberId');
  res.json(loans);
};

exports.getDueTomorrow = async (req, res) => {
  const tomorrow = new Date();
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

  const loans = await Loan.find({
    status: 'active',
    'installments.dueDate': { $gte: tomorrow, $lt: dayAfter },
    'installments.status': { $in: ['pending', 'partial', 'overdue'] }
  }).populate('memberId');
  res.json(loans);
};

exports.getActiveByVillage = async (req, res) => {
  const members = await Member.find({ 'location.village': req.params.village, isActive: true });
  const memberIds = members.map(m => m._id);
  const loans = await Loan.find({ memberId: { $in: memberIds }, status: 'active' })
    .populate('memberId');
  res.json(loans);
};
