const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  division: { type: String, required: true, index: true },
  district: { type: String, required: true, index: true },
  upazila: { type: String, required: true, index: true },
  union: { type: String, required: true, index: true },
  village: { type: String, required: true, index: true },
  para: { type: String, required: true },
  fullAddress: { type: String },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  }
}, { timestamps: true });

locationSchema.index({ division: 1, district: 1, upazila: 1, union: 1, village: 1, para: 1 }, { unique: true });

locationSchema.pre('save', function (next) {
  this.fullAddress = [this.para, this.village, this.union, this.upazila, this.district, this.division]
    .filter(Boolean).join(', ');
  next();
});

module.exports = mongoose.model('Location', locationSchema);
