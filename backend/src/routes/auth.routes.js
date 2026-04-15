const { Router } = require('express');
const { authController } = require('../controllers');
const { validate, authenticate } = require('../middlewares');
const { registerDto, loginDto, changePasswordDto } = require('../dtos');

const router = Router();

router.post('/register', validate(registerDto), (req, res) => authController.register(req, res));
router.post('/login', validate(loginDto), (req, res) => authController.login(req, res));

// Protected routes
router.use(authenticate);
router.post('/logout', (req, res) => authController.logout(req, res));
router.post('/logout-all', (req, res) => authController.logoutAll(req, res));
router.get('/me', (req, res) => authController.me(req, res));
router.put('/password', validate(changePasswordDto), (req, res) => authController.changePassword(req, res));
router.get('/sessions', (req, res) => authController.getSessions(req, res));
router.delete('/sessions/:sessionId', (req, res) => authController.revokeSession(req, res));

module.exports = router;
