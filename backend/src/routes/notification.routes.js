const { Router } = require('express');
const { notificationController } = require('../controllers');
const { validate, authenticate } = require('../middlewares');
const { notificationPrefsDto } = require('../dtos');

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => notificationController.getNotifications(req, res));
router.get('/count', (req, res) => notificationController.getUnreadCount(req, res));
router.post('/read-all', (req, res) => notificationController.markAllAsRead(req, res));
router.put('/:notificationId/read', (req, res) => notificationController.markAsRead(req, res));

// Preferences
router.get('/preferences', (req, res) => notificationController.getPreferences(req, res));
router.put('/preferences', validate(notificationPrefsDto), (req, res) => notificationController.updatePreference(req, res));

module.exports = router;
