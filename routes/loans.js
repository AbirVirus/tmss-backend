const router = require('express').Router();
const ctrl = require('../controllers/loanController');

router.get('/', ctrl.getAll);
router.get('/due-today', ctrl.getDueToday);
router.get('/due-tomorrow', ctrl.getDueTomorrow);
router.get('/village/:village', ctrl.getActiveByVillage);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.post('/:id/payment', ctrl.recordPayment);

module.exports = router;
