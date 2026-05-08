const mongoose = require('mongoose');

const syncQueueSchema = new mongoose.Schema({
  collectionName: { type: String, required: true },
  operation: { type: String, enum: ['create', 'update', 'delete'], required: true },
  docId: { type: mongoose.Schema.Types.Mixed },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['queued', 'processing', 'completed', 'failed'], default: 'queued' },
  errorMessage: { type: String },
  attempts: { type: Number, default: 0 },
  deviceId: { type: String },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

syncQueueSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('SyncQueue', syncQueueSchema);
