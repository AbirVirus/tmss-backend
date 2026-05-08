const mongoose = require('mongoose');

const personalLedgerSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  supervisorId: { type: String, required: true },
  openingCashBalance: { type: Number, default: 0 },
  dailyAllowance: { type: Number, default: 0 },
  lunchExpense: { type: Number, default: 0 },
  snacksExpense: { type: Number, default: 0 },
  mobileBill: { type: Number, default: 0 },
  otherExpenses: { type: Number, default: 0 },
  otherExpensesNote: { type: String },
  totalPersonalExpense: { type: Number, default: 0 },
  remainingBalance: { type: Number, default: 0 },
  notes: { type: String }
}, { timestamps: true });

personalLedgerSchema.index({ date: 1, supervisorId: 1 }, { unique: true });

personalLedgerSchema.pre('save', function (next) {
  this.totalPersonalExpense =
    this.dailyAllowance + this.lunchExpense + this.snacksExpense +
    this.mobileBill + this.otherExpenses;
  this.remainingBalance = this.openingCashBalance - this.totalPersonalExpense;
  next();
});

module.exports = mongoose.model('PersonalLedger', personalLedgerSchema);
