import { Router } from 'express';
import { notificationController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import {
  notificationPrefsDto,
  notificationSettingsDto,
  pushSubscribeDto,
  pushUnsubscribeDto,
  pushActionDto,
} from '../dtos';
import { withAuth } from '../types/http';

const router = Router();

// Acción tocada en una notificación push ("Marcar como leído", "Rechazar"). La
// llama el service worker, que no tiene la sesión: autoriza el token firmado.
router.post('/push/action', validate(pushActionDto), (req, res) => notificationController.runPushAction(req, res));

router.use(authenticate);

router.get('/', withAuth((req, res) => notificationController.getNotifications(req, res)));
router.get('/count', withAuth((req, res) => notificationController.getUnreadCount(req, res)));
router.post('/read-all', withAuth((req, res) => notificationController.markAllAsRead(req, res)));
router.put('/:notificationId/read', withAuth((req, res) => notificationController.markAsRead(req, res)));

// Preferences
router.get('/preferences', withAuth((req, res) => notificationController.getPreferences(req, res)));
router.put('/preferences', validate(notificationPrefsDto), withAuth((req, res) => notificationController.updatePreference(req, res)));
router.get('/push/config', withAuth((req, res) => notificationController.getPushConfig(req, res)));
router.get('/push/devices', withAuth((req, res) => notificationController.listPushDevices(req, res)));
router.post('/push/subscribe', validate(pushSubscribeDto), withAuth((req, res) => notificationController.subscribePush(req, res)));
router.post('/push/unsubscribe', validate(pushUnsubscribeDto), withAuth((req, res) => notificationController.unsubscribePush(req, res)));
router.delete('/push/devices/:deviceId', withAuth((req, res) => notificationController.removePushDevice(req, res)));
router.post('/push/test', withAuth((req, res) => notificationController.sendTestPush(req, res)));
router.get('/settings', withAuth((req, res) => notificationController.getSettings(req, res)));
router.put('/settings', validate(notificationSettingsDto), withAuth((req, res) => notificationController.updateSettings(req, res)));

export default router;
