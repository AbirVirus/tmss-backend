const mongoose = require('mongoose');

const installmentSchema = new mongoose.Schema({
  installmentNumber: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'partial', 'paid', 'overdue'], default: 'pending' },
  paidAt: { type: Date },
  collectedBy: { type: String }
});

const loanSchema = new mongoose.Schema({
  loanId: { type: String, required: true, unique: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  principalAmount: { type: Number, required: true },
  interestRate: { type: Number, required: true },
  totalPayable: { type: Number, required: true },
  totalPaid: { type: Number, default: 0 },
  remainingBalance: { type: Number, required: true },
  installmentAmount: { type: Number, required: true },
  totalInstallments: { type: Number, required: true },
  installments: [installmentSchema],
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  status: { type: String, enum: ['active', 'completed', 'defaulted'], default: 'active' },
  disbursedBy: { type: String }
}, { timestamps: true });

loanSchema.index({ memberId: 1 });
loanSchema.index({ loanId: 1 });
loanSchema.index({ status: 1 });

loanSchema.pre('save', function (next) {
  this.remainingBalance = this.totalPayable - this.totalPaid;
  next();
});

module.exports = mongoose.model('Loan', loanSchema);
