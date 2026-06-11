const { StatusCodes } = require('http-status-codes');
const { adminService } = require('../services');

class AdminController {
  async listUsers(req, res) {
    const users = await adminService.listUsers({
      search: req.query.search,
      status: req.query.status,
      department: req.query.department,
      limit: parseInt(req.query.limit, 10) || 50,
      offset: parseInt(req.query.offset, 10) || 0,
    });
    res.json({ status: 'success', data: users });
  }

  async createUser(req, res) {
    const user = await adminService.createUser(
      req.user.id,
      req.body,
      req.ip,
      req.get('user-agent'),
    );
    res.status(StatusCodes.CREATED).json({ status: 'success', data: user });
  }

  async updateUser(req, res) {
    const user = await adminService.updateUser(
      req.user.id,
      req.params.userId,
      req.body,
      req.ip,
      req.get('user-agent'),
    );
    res.json({ status: 'success', data: user });
  }

  async deleteUser(req, res) {
    const user = await adminService.deleteUser(
      req.user.id,
      req.params.userId,
      req.ip,
      req.get('user-agent'),
    );
    res.json({ status: 'success', data: user });
  }

  async listRoles(req, res) {
    const roles = await adminService.listRoles();
    res.json({ status: 'success', data: roles });
  }

  async getSettings(req, res) {
    const settings = await adminService.getSettings();
    res.json({ status: 'success', data: settings });
  }

  async updateSetting(req, res) {
    const setting = await adminService.updateSetting(
      req.user.id,
      req.params.key,
      req.body.value,
      req.ip,
      req.get('user-agent'),
    );
    res.json({ status: 'success', data: setting });
  }

  async getAuditLog(req, res) {
    const entries = await adminService.getAuditLog({
      action: req.query.action,
      actor_id: req.query.actor_id,
      resource_type: req.query.resource_type,
      success: req.query.success,
      from: req.query.from,
      to: req.query.to,
      limit: parseInt(req.query.limit, 10) || 50,
      offset: parseInt(req.query.offset, 10) || 0,
    });
    res.json({ status: 'success', data: entries });
  }

  async getStorageStats(req, res) {
    const stats = await adminService.getStorageStats();
    res.json({ status: 'success', data: stats });
  }

  async listStorageObjects(req, res) {
    const objects = await adminService.listStorageObjects({
      bucket: req.query.bucket,
      object_type: req.query.object_type,
      processing_status: req.query.processing_status,
      limit: parseInt(req.query.limit, 10) || 50,
      offset: parseInt(req.query.offset, 10) || 0,
    });
    res.json({ status: 'success', data: objects });
  }
}

module.exports = new AdminController();
