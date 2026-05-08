const router = require('express').Router();
const ctrl = require('../controllers/memberController');

router.get('/', ctrl.getAll);
router.get('/phone/:phone', ctrl.getByPhone);
router.get('/village/:village', ctrl.getByVillage);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.delete);

module.exports = router;
