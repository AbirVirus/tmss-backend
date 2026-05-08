const router = require('express').Router();
const ctrl = require('../controllers/routeController');

router.get('/', ctrl.getByDate);
router.get('/range', ctrl.getRange);
router.post('/calculate', ctrl.calculateAndSave);
router.post('/preview', ctrl.calculatePreview);

module.exports = router;
