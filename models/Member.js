const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  memberId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  status: { type: String, enum: ['New', 'Old'], default: 'New' },
  location: {
    division: { type: String, required: true },
    district: { type: String, required: true },
    upazila: { type: String, required: true },
    union: { type: String, required: true },
    village: { type: String, required: true },
    para: { type: String, required: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    }
  },
  somitiName: { type: String },
  joinedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

memberSchema.index({ phone: 1 });
memberSchema.index({ 'location.village': 1, 'location.para': 1 });
memberSchema.index({ memberId: 1 });

module.exports = mongoose.model('Member', memberSchema);
