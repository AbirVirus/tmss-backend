const mongoose = require('mongoose');

const dailyLogSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  supervisorId: { type: String, required: true },
  companyLedger: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanyLedger' },
  personalLedger: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonalLedger' },
  dailyRoute: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyRoute' },
  totalCollection: { type: Number, default: 0 },
  totalDue: { type: Number, default: 0 },
  totalKmTraveled: { type: Number, default: 0 },
  totalFuelCost: { type: Number, default: 0 },
  totalPersonalExpense: { type: Number, default: 0 },
  officeDepositStatus: { type: String, enum: ['pending', 'deposited', 'verified'], default: 'pending' },
  membersVisited: { type: Number, default: 0 },
  newMembersRegistered: { type: Number, default: 0 },
  isComplete: { type: Boolean, default: false },
  telegramReportSent: { type: Boolean, default: false }
}, { timestamps: true });

dailyLogSchema.index({ date: 1, supervisorId: 1 }, { unique: true });
dailyLogSchema.index({ date: 1 });

module.exports = mongoose.model('DailyLog', dailyLogSchema);
