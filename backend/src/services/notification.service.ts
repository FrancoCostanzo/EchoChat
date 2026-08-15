import { notificationRepository } from '../repositories';
import type { NotificationPrefsRequest } from '../dtos/notification.dto';

class NotificationService {
  async getByUser(
    userId: string,
    options?: { limit?: number; offset?: number; unreadOnly?: boolean },
  ) {
    return notificationRepository.findByUser(userId, options);
  }

  async markAsRead(notificationId: string, userId: string) {
    return notificationRepository.markAsRead(notificationId, userId);
  }

  async markAllAsRead(userId: string) {
    return notificationRepository.markAllAsRead(userId);
  }

  async getUnreadCount(userId: string) {
    return notificationRepository.getUnreadCount(userId);
  }

  async getPreferences(userId: string) {
    return notificationRepository.getPreferences(userId);
  }

  async updatePreference(userId: string, prefs: NotificationPrefsRequest) {
    return notificationRepository.upsertPreference(userId, prefs);
  }

  async create(data: Parameters<typeof notificationRepository.create>[0]) {
    return notificationRepository.create(data);
  }
}

export default new NotificationService();
