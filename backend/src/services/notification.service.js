const { notificationRepository } = require('../repositories');

class NotificationService {
  async getByUser(userId, options) {
    return notificationRepository.findByUser(userId, options);
  }

  async markAsRead(notificationId, userId) {
    return notificationRepository.markAsRead(notificationId, userId);
  }

  async markAllAsRead(userId) {
    return notificationRepository.markAllAsRead(userId);
  }

  async getUnreadCount(userId) {
    return notificationRepository.getUnreadCount(userId);
  }

  async getPreferences(userId) {
    return notificationRepository.getPreferences(userId);
  }

  async updatePreference(userId, prefs) {
    return notificationRepository.upsertPreference(userId, prefs);
  }

  async create(data) {
    return notificationRepository.create(data);
  }
}

module.exports = new NotificationService();
