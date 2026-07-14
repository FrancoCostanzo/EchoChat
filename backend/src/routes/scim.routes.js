const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const scimAuth = require('../middlewares/scimAuth');
const { scimController, scimErrorHandler } = require('../controllers/scim.controller');

const router = Router();

// Los IdPs disparan ráfagas de requests al aprovisionar; damos un límite holgado
// (además del bearer token que ya protege estas rutas).
router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
}));

router.use(scimAuth);

router.get('/ServiceProviderConfig', (req, res) => scimController.serviceProviderConfig(req, res));

router.get('/Users', (req, res) => scimController.listUsers(req, res));
router.post('/Users', (req, res) => scimController.createUser(req, res));
router.get('/Users/:id', (req, res) => scimController.getUser(req, res));
router.put('/Users/:id', (req, res) => scimController.replaceUser(req, res));
router.patch('/Users/:id', (req, res) => scimController.patchUser(req, res));
router.delete('/Users/:id', (req, res) => scimController.deleteUser(req, res));

router.get('/Groups', (req, res) => scimController.listGroups(req, res));

router.use(scimErrorHandler);

module.exports = router;
