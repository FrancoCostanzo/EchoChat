import type { Response } from 'express';
import { notificationService } from '../services';
import { qInt, type AuthRequest } from '../types/http';

class NotificationController {
  async getNotifications(req: AuthRequest, res: Response) {
    const { limit, offset, unread } = req.query;
    const notifications = await notificationService.getByUser(req.user.id, {
      limit: qInt(limit, 30),
      offset: qInt(offset, 0),
      unreadOnly: unread === 'true',
    });
    res.json({ status: 'success', data: notifications });
  }

  async markAsRead(req: AuthRequest, res: Response) {
    await notificationService.markAsRead(req.params.notificationId, req.user.id);
    res.json({ status: 'success', message: 'Notification marked as read' });
  }

  async markAllAsRead(req: AuthRequest, res: Response) {
    const count = await notificationService.markAllAsRead(req.user.id);
    res.json({ status: 'success', data: { marked: count } });
  }

  async getUnreadCount(req: AuthRequest, res: Response) {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ status: 'success', data: { count } });
  }

  async getPreferences(req: AuthRequest, res: Response) {
    const prefs = await notificationService.getPreferences(req.user.id);
    res.json({ status: 'success', data: prefs });
  }

  async updatePreference(req: AuthRequest, res: Response) {
    const pref = await notificationService.updatePreference(req.user.id, req.body);
    res.json({ status: 'success', data: pref });
  }
}

export default new NotificationController();
