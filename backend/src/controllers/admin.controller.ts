import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { adminService } from '../services';
import { qIntOr, qStr, type AuthRequest } from '../types/http';

class AdminController {
  async listUsers(req: AuthRequest, res: Response) {
    const users = await adminService.listUsers({
      search: qStr(req.query.search),
      status: qStr(req.query.status),
      department: qStr(req.query.department),
      limit: qIntOr(req.query.limit, 50),
      offset: qIntOr(req.query.offset, 0),
    });
    res.json({ status: 'success', data: users });
  }

  async createUser(req: AuthRequest, res: Response) {
    const user = await adminService.createUser(
      req.user.id,
      req.body,
      req.ip,
      req.get('user-agent'),
    );
    res.status(StatusCodes.CREATED).json({ status: 'success', data: user });
  }

  async updateUser(req: AuthRequest, res: Response) {
    const user = await adminService.updateUser(
      req.user.id,
      req.params.userId,
      req.body,
      req.ip,
      req.get('user-agent'),
    );
    res.json({ status: 'success', data: user });
  }

  async uploadUserAvatar(req: AuthRequest, res: Response) {
    const user = await adminService.uploadUserAvatar(
      req.user.id,
      req.params.userId,
      req.file,
      req.ip,
      req.get('user-agent'),
    );
    res.json({ status: 'success', data: user });
  }

  async removeUserAvatar(req: AuthRequest, res: Response) {
    const user = await adminService.removeUserAvatar(
      req.user.id,
      req.params.userId,
      req.ip,
      req.get('user-agent'),
    );
    res.json({ status: 'success', data: user });
  }

  async disableUser2fa(req: AuthRequest, res: Response) {
    const user = await adminService.disableUser2fa(
      req.user.id,
      req.params.userId,
      req.ip,
      req.get('user-agent'),
    );
    res.json({ status: 'success', data: user });
  }

  async deleteUser(req: AuthRequest, res: Response) {
    const user = await adminService.deleteUser(
      req.user.id,
      req.params.userId,
      req.ip,
      req.get('user-agent'),
    );
    res.json({ status: 'success', data: user });
  }

  async resetUserPassword(req: AuthRequest, res: Response) {
    const result = await adminService.resetUserPassword(
      req.user.id,
      req.params.userId,
      req.body.password,
      req.ip,
      req.get('user-agent'),
    );
    res.json({ status: 'success', data: result });
  }

  async listRoles(req: AuthRequest, res: Response) {
    const roles = await adminService.listRoles();
    res.json({ status: 'success', data: roles });
  }

  async getLdapStatus(req: AuthRequest, res: Response) {
    res.json({ status: 'success', data: adminService.getLdapStatus() });
  }

  async getIntegrations(req: AuthRequest, res: Response) {
    res.json({ status: 'success', data: adminService.getIntegrations() });
  }

  async syncLdap(req: AuthRequest, res: Response) {
    const summary = await adminService.importLdapUsers(
      req.user.id,
      req.ip,
      req.get('user-agent'),
    );
    res.json({ status: 'success', data: summary });
  }

  async getSettings(req: AuthRequest, res: Response) {
    const settings = await adminService.getSettings();
    res.json({ status: 'success', data: settings });
  }

  async updateSetting(req: AuthRequest, res: Response) {
    const setting = await adminService.updateSetting(
      req.user.id,
      req.params.key,
      req.body.value,
      req.ip,
      req.get('user-agent'),
    );
    res.json({ status: 'success', data: setting });
  }

  async getAuditLog(req: AuthRequest, res: Response) {
    const result = await adminService.getAuditLog({
      action: qStr(req.query.action),
      actor_id: qStr(req.query.actor_id),
      resource_type: qStr(req.query.resource_type),
      severity: qStr(req.query.severity),
      category: qStr(req.query.category),
      success: qStr(req.query.success),
      from: qStr(req.query.from),
      to: qStr(req.query.to),
      sort_column: qStr(req.query.sort_column),
      sort_dir: qStr(req.query.sort_dir),
      limit: qIntOr(req.query.limit, 50),
      offset: qIntOr(req.query.offset, 0),
    });
    res.json({ status: 'success', data: result });
  }

  async getStorageStats(req: AuthRequest, res: Response) {
    const stats = await adminService.getStorageStats();
    res.json({ status: 'success', data: stats });
  }

  async listStorageObjects(req: AuthRequest, res: Response) {
    const objects = await adminService.listStorageObjects({
      bucket: qStr(req.query.bucket),
      object_type: qStr(req.query.object_type),
      processing_status: qStr(req.query.processing_status),
      limit: qIntOr(req.query.limit, 50),
      offset: qIntOr(req.query.offset, 0),
    });
    res.json({ status: 'success', data: objects });
  }
}

export default new AdminController();
