const router = require('express').Router();
const ctrl = require('../controllers/companyLedgerController');

router.get('/', ctrl.getByDate);
router.get('/range', ctrl.getRange);
router.post('/', ctrl.createOrUpdate);
router.post('/collection', ctrl.addCollection);

module.exports = router;
