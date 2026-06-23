const { Router } = require('express');
const { authController } = require('../controllers');
const { validate, authenticate } = require('../middlewares');
const { registerDto, loginDto, changePasswordDto, totpEnableDto, totpDisableDto, totpChallengeDto, totpRegenerateDto } = require('../dtos');

const router = Router();

router.get('/registration-status', (req, res) => authController.registrationStatus(req, res));
router.post('/register', validate(registerDto), (req, res) => authController.register(req, res));
router.post('/login', validate(loginDto), (req, res) => authController.login(req, res));
router.post('/2fa/challenge', validate(totpChallengeDto), (req, res) => authController.verify2faChallenge(req, res));

// Protected routes
router.use(authenticate);
router.post('/logout', (req, res) => authController.logout(req, res));
router.post('/logout-all', (req, res) => authController.logoutAll(req, res));
router.get('/me', (req, res) => authController.me(req, res));
router.put('/password', validate(changePasswordDto), (req, res) => authController.changePassword(req, res));
router.get('/sessions', (req, res) => authController.getSessions(req, res));
router.delete('/sessions/:sessionId', (req, res) => authController.revokeSession(req, res));

// 2FA management (all require auth)
router.post('/2fa/setup', (req, res) => authController.setup2fa(req, res));
router.post('/2fa/enable', validate(totpEnableDto), (req, res) => authController.enable2fa(req, res));
router.post('/2fa/disable', validate(totpDisableDto), (req, res) => authController.disable2fa(req, res));
router.post('/2fa/backup-codes/regenerate', validate(totpRegenerateDto), (req, res) => authController.regenerateBackupCodes(req, res));

module.exports = router;
