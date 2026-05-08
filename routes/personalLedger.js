const router = require('express').Router();
const ctrl = require('../controllers/personalLedgerController');

router.get('/', ctrl.getByDate);
router.get('/range', ctrl.getRange);
router.post('/', ctrl.createOrUpdate);

module.exports = router;
