const { notificationService } = require('../services');

class NotificationController {
  async getNotifications(req, res) {
    const { limit = 30, offset = 0, unread } = req.query;
    const notifications = await notificationService.getByUser(req.user.id, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      unreadOnly: unread === 'true',
    });
    res.json({ status: 'success', data: notifications });
  }

  async markAsRead(req, res) {
    await notificationService.markAsRead(req.params.notificationId, req.user.id);
    res.json({ status: 'success', message: 'Notification marked as read' });
  }

  async markAllAsRead(req, res) {
    const count = await notificationService.markAllAsRead(req.user.id);
    res.json({ status: 'success', data: { marked: count } });
  }

  async getUnreadCount(req, res) {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ status: 'success', data: { count } });
  }

  async getPreferences(req, res) {
    const prefs = await notificationService.getPreferences(req.user.id);
    res.json({ status: 'success', data: prefs });
  }

  async updatePreference(req, res) {
    const pref = await notificationService.updatePreference(req.user.id, req.body);
    res.json({ status: 'success', data: pref });
  }
}

module.exports = new NotificationController();
