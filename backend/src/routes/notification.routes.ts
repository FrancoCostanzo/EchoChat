import { Router } from 'express';
import { notificationController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import { notificationPrefsDto } from '../dtos';
import { withAuth } from '../types/http';

const router = Router();
router.use(authenticate);

router.get('/', withAuth((req, res) => notificationController.getNotifications(req, res)));
router.get('/count', withAuth((req, res) => notificationController.getUnreadCount(req, res)));
router.post('/read-all', withAuth((req, res) => notificationController.markAllAsRead(req, res)));
router.put('/:notificationId/read', withAuth((req, res) => notificationController.markAsRead(req, res)));

// Preferences
router.get('/preferences', withAuth((req, res) => notificationController.getPreferences(req, res)));
router.put('/preferences', validate(notificationPrefsDto), withAuth((req, res) => notificationController.updatePreference(req, res)));

export = router;
