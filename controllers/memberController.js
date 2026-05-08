const Member = require('../models/Member');
const Loan = require('../models/Loan');

exports.getAll = async (req, res) => {
  const { search, status, village, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (village) filter['location.village'] = village;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { memberId: { $regex: search, $options: 'i' } }
    ];
  }
  const members = await Member.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Member.countDocuments(filter);
  res.json({ members, total, page: Number(page), pages: Math.ceil(total / limit) });
};

exports.getById = async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  const loans = await Loan.find({ memberId: member._id, status: 'active' });
  res.json({ member, loans });
};

exports.create = async (req, res) => {
  const { phone } = req.body;
  const existing = await Member.findOne({ phone });
  if (existing) return res.status(400).json({ error: 'Phone number already registered' });
  const member = await Member.create(req.body);
  res.status(201).json(member);
};

exports.update = async (req, res) => {
  const member = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!member) return res.status(404).json({ error: 'Member not found' });
  res.json(member);
};

exports.delete = async (req, res) => {
  await Member.findByIdAndDelete(req.params.id);
  res.json({ success: true });
};

exports.getByPhone = async (req, res) => {
  const member = await Member.findOne({ phone: req.params.phone });
  if (!member) return res.status(404).json({ error: 'Member not found' });
  res.json(member);
};

exports.getByVillage = async (req, res) => {
  const members = await Member.find({ 'location.village': req.params.village, isActive: true })
    .populate({ path: 'loans', match: { status: 'active' } });
  res.json(members);
};
