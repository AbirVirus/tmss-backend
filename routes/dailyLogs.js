const router = require('express').Router();
const ctrl = require('../controllers/dailyLogController');

router.get('/', ctrl.getByDate);
router.get('/range', ctrl.getRange);
router.get('/today', ctrl.getTodaySummary);
router.get('/monthly', ctrl.getMonthlyReport);
router.post('/complete', ctrl.completeDay);
router.post('/send-report', ctrl.sendReport);

module.exports = router;
