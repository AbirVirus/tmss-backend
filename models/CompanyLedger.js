const mongoose = require('mongoose');

const companyLedgerSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  supervisorId: { type: String, required: true },
  dailyTarget: { type: Number, required: true },
  actualCollection: { type: Number, default: 0 },
  totalDuesGenerated: { type: Number, default: 0 },
  cashDepositedToOffice: { type: Number, default: 0 },
  depositStatus: { type: String, enum: ['pending', 'deposited', 'verified'], default: 'pending' },
  depositReference: { type: String },
  notes: { type: String },
  collections: [{
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
    amount: Number,
    installmentNumber: Number,
    collectedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

companyLedgerSchema.index({ date: 1, supervisorId: 1 }, { unique: true });

module.exports = mongoose.model('CompanyLedger', companyLedgerSchema);
