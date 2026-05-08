const mongoose = require('mongoose');

const waypointSchema = new mongoose.Schema({
  name: { type: String, required: true },
  lat: { type: Number },
  lng: { type: Number },
  order: { type: Number, required: true }
});

const legSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  distanceKm: { type: Number, required: true },
  durationMin: { type: Number }
});

const dailyRouteSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  supervisorId: { type: String, required: true },

  // Calculation method: 'osrm' or 'manual_odometer'
  calculationMethod: { type: String, enum: ['osrm', 'manual_odometer'], required: true, default: 'manual_odometer' },

  // Option A: Manual Odometer
  startOdometer: { type: Number },
  endOdometer: { type: Number },

  // Option B: OSRM Route (coordinates optional for manual method)
  startLocation: {
    name: { type: String },
    lat: { type: Number },
    lng: { type: Number }
  },
  waypoints: [waypointSchema],
  endLocation: {
    name: { type: String },
    lat: { type: Number },
    lng: { type: Number }
  },

  // Computed from either method
  legs: [legSchema],
  totalDistanceKm: { type: Number, required: true },
  fuelCostPerKm: { type: Number, default: 15 },
  totalFuelCost: { type: Number },
  travelMode: { type: String, enum: ['motorcycle', 'bicycle', 'walking', 'public_transport'], default: 'motorcycle' },

  // OSRM raw response (useful for debugging)
  osrmResponse: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

dailyRouteSchema.index({ date: 1, supervisorId: 1 }, { unique: true });

dailyRouteSchema.pre('save', function (next) {
  if (this.calculationMethod === 'manual_odometer' && this.startOdometer != null && this.endOdometer != null) {
    this.totalDistanceKm = +(this.endOdometer - this.startOdometer).toFixed(2);
  }
  this.totalFuelCost = Math.round(this.totalDistanceKm * (this.fuelCostPerKm || 15));
  next();
});

module.exports = mongoose.model('DailyRoute', dailyRouteSchema);
