import { Router } from 'express';
import { authController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import { registerDto, loginDto, changePasswordDto, totpEnableDto, totpDisableDto, totpChallengeDto, totpRegenerateDto } from '../dtos';
import { withAuth } from '../types/http';

const router = Router();

router.get('/registration-status', (req, res) => authController.registrationStatus(req, res));
router.post('/register', validate(registerDto), (req, res) => authController.register(req, res));
router.post('/login', validate(loginDto), (req, res) => authController.login(req, res));
router.post('/2fa/challenge', validate(totpChallengeDto), (req, res) => authController.verify2faChallenge(req, res));

// SSO / OIDC (públicas: son navegaciones del navegador, no llamadas autenticadas)
router.get('/sso/providers', (req, res) => authController.ssoProviders(req, res));
router.get('/sso/:provider/login', (req, res) => authController.ssoLogin(req, res));
router.get('/sso/:provider/callback', (req, res) => authController.ssoCallback(req, res));

// Protected routes
router.use(authenticate);
router.post('/logout', withAuth((req, res) => authController.logout(req, res)));
router.post('/logout-all', withAuth((req, res) => authController.logoutAll(req, res)));
router.get('/me', withAuth((req, res) => authController.me(req, res)));
router.put('/password', validate(changePasswordDto), withAuth((req, res) => authController.changePassword(req, res)));
router.get('/sessions', withAuth((req, res) => authController.getSessions(req, res)));
router.delete('/sessions/:sessionId', withAuth((req, res) => authController.revokeSession(req, res)));

// 2FA management (all require auth)
router.post('/2fa/setup', withAuth((req, res) => authController.setup2fa(req, res)));
router.post('/2fa/enable', validate(totpEnableDto), withAuth((req, res) => authController.enable2fa(req, res)));
router.post('/2fa/disable', validate(totpDisableDto), withAuth((req, res) => authController.disable2fa(req, res)));
router.post('/2fa/backup-codes/regenerate', validate(totpRegenerateDto), withAuth((req, res) => authController.regenerateBackupCodes(req, res)));

export default router;
