const router = require('express').Router();
const ctrl = require('../controllers/syncController');

router.post('/push', ctrl.push);
router.get('/pull', ctrl.pull);
router.get('/status', ctrl.status);
router.post('/process', ctrl.manualProcess);

module.exports = router;
