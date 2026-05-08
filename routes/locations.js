const router = require('express').Router();
const ctrl = require('../controllers/locationController');

router.get('/divisions', ctrl.getDivisions);
router.get('/districts', ctrl.getDistricts);
router.get('/upazilas', ctrl.getUpazilas);
router.get('/unions', ctrl.getUnions);
router.get('/villages', ctrl.getVillages);
router.get('/paras', ctrl.getParas);
router.get('/search', ctrl.searchLocations);
router.post('/seed', ctrl.seedLocations);

module.exports = router;
