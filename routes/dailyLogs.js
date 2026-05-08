const router = require('express').Router();
const ctrl = require('../controllers/dailyLogController');
const { manualReport } = require('../cron/telegramCron');

router.get('/', ctrl.getByDate);
router.get('/range', ctrl.getRange);
router.get('/today', ctrl.getTodaySummary);
router.get('/monthly', ctrl.getMonthlyReport);
router.post('/complete', ctrl.completeDay);
router.post('/send-report', async (req, res) => {
  await manualReport();
  res.json({ success: true, message: 'Report sent' });
});

module.exports = router;
