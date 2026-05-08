const SyncQueue = require('../models/SyncQueue');
const Member = require('../models/Member');
const Loan = require('../models/Loan');
const CompanyLedger = require('../models/CompanyLedger');
const PersonalLedger = require('../models/PersonalLedger');
const DailyRoute = require('../models/DailyRoute');
const DailyLog = require('../models/DailyLog');

const modelMap = {
  members: Member,
  loans: Loan,
  companyledgers: CompanyLedger,
  personalledgers: PersonalLedger,
  dailyroutes: DailyRoute,
  dailylogs: DailyLog
};

exports.push = async (req, res) => {
  const { operations } = req.body;
  const results = { success: [], failed: [] };

  for (const op of operations) {
    try {
      await SyncQueue.create({
        collectionName: op.collection,
        operation: op.operation,
        docId: op.docId,
        data: op.data,
        deviceId: op.deviceId
      });
      results.success.push(op.docId);
    } catch (err) {
      results.failed.push({ docId: op.docId, error: err.message });
    }
  }

  // Process immediately
  await processQueue();
  res.json(results);
};

exports.pull = async (req, res) => {
  const { since, collections } = req.query;
  const sinceDate = since ? new Date(since) : new Date(0);
  const data = {};

  for (const col of (collections || 'members,loans').split(',')) {
    const Model = modelMap[col];
    if (Model) {
      data[col] = await Model.find({ updatedAt: { $gt: sinceDate } }).limit(1000);
    }
  }

  res.json({ data, pulledAt: new Date().toISOString() });
};

exports.status = async (req, res) => {
  const pending = await SyncQueue.countDocuments({ status: 'queued' });
  const processing = await SyncQueue.countDocuments({ status: 'processing' });
  const failed = await SyncQueue.countDocuments({ status: 'failed' });
  const completed = await SyncQueue.countDocuments({ status: 'completed' });
  res.json({ pending, processing, failed, completed });
};

async function processQueue() {
  const items = await SyncQueue.find({ status: 'queued' }).limit(50);

  for (const item of items) {
    item.status = 'processing';
    item.attempts += 1;
    await item.save();

    try {
      const Model = modelMap[item.collectionName];
      if (!Model) throw new Error(`Unknown collection: ${item.collectionName}`);

      switch (item.operation) {
        case 'create':
          await Model.create(item.data);
          break;
        case 'update':
          await Model.findByIdAndUpdate(item.docId, item.data, { new: true });
          break;
        case 'delete':
          await Model.findByIdAndDelete(item.docId);
          break;
      }

      item.status = 'completed';
      item.processedAt = new Date();
    } catch (err) {
      item.status = 'failed';
      item.errorMessage = err.message;
    }
    await item.save();
  }
}

exports.manualProcess = async (req, res) => {
  await processQueue();
  const status = await SyncQueue.find({}).sort({ createdAt: -1 }).limit(20);
  res.json(status);
};
