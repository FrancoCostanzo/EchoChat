import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { notificationService } from '../services';
import pushService from '../services/push.service';
import pushActionService from '../services/pushAction.service';
import mailService from '../services/mail.service';
import { userRepository } from '../repositories';
import { idiomaDe } from '../i18n';
import { qInt, qStr, type AuthRequest } from '../types/http';

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

  // ── Web Push ──────────────────────────────────────────────────────────

  async getPushConfig(req: AuthRequest, res: Response) {
    res.json({ status: 'success', data: { public_key: pushService.getPublicKey() } });
  }

  async listPushDevices(req: AuthRequest, res: Response) {
    const devices = await pushService.listDevices(req.user.id);
    res.json({ status: 'success', data: devices });
  }

  async subscribePush(req: AuthRequest, res: Response) {
    const device = await pushService.subscribe(req.user.id, req.body, req.get('user-agent') ?? null);
    res.status(StatusCodes.CREATED).json({ status: 'success', data: device });
  }

  async unsubscribePush(req: AuthRequest, res: Response) {
    await pushService.unsubscribeEndpoint(req.user.id, req.body.endpoint);
    res.json({ status: 'success', message: 'Unsubscribed' });
  }

  async removePushDevice(req: AuthRequest, res: Response) {
    await pushService.removeDevice(req.user.id, req.params.deviceId);
    res.json({ status: 'success', message: 'Device removed' });
  }

  async sendTestPush(req: AuthRequest, res: Response) {
    const user = await userRepository.findById(req.user.id);
    const delivered = await pushService.sendTest(req.user.id, idiomaDe(user?.locale));
    res.json({ status: 'success', data: { delivered } });
  }

  /** Sin sesión: lo llama el service worker con el token firmado del aviso. */
  async runPushAction(req: Request, res: Response) {
    await pushActionService.run(req.body.token);
    res.json({ status: 'success', message: 'Done' });
  }

  /** Sin sesión: el token firmado del link del email identifica al usuario. */
  async unsubscribeEmail(req: Request, res: Response) {
    const token = qStr(req.query.token) || (typeof req.body?.token === 'string' ? req.body.token : '');
    await mailService.unsubscribe(token);
    res.json({ status: 'success', message: 'Unsubscribed' });
  }

  async getSettings(req: AuthRequest, res: Response) {
    const settings = await notificationService.getSettings(req.user.id);
    res.json({ status: 'success', data: settings });
  }

  async updateSettings(req: AuthRequest, res: Response) {
    const settings = await notificationService.updateSettings(req.user.id, req.body);
    res.json({ status: 'success', data: settings });
  }
}

export default new NotificationController();
