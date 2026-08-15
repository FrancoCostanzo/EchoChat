import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import scimAuth from '../middlewares/scimAuth';
import { createRateLimitStore } from '../config/rateLimitStore';
import { scimController, scimErrorHandler } from '../controllers/scim.controller';

const router = Router();

// Los IdPs disparan ráfagas de requests al aprovisionar; damos un límite holgado
// (además del bearer token que ya protege estas rutas).
router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  store: createRateLimitStore('rl:scim:'),
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

export = router;
