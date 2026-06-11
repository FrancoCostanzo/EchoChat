const { Router } = require('express');
const { adminController } = require('../controllers');
const { validate, authenticate, requirePermission } = require('../middlewares');
const {
  adminCreateUserDto,
  adminUpdateUserDto,
  adminUpdateSettingDto,
} = require('../dtos');

const router = Router();
router.use(authenticate);

// 7.1 — User management
router.get('/users', requirePermission('admin.users'), (req, res) => adminController.listUsers(req, res));
router.post('/users', requirePermission('admin.users'), validate(adminCreateUserDto), (req, res) => adminController.createUser(req, res));
router.patch('/users/:userId', requirePermission('admin.users'), validate(adminUpdateUserDto), (req, res) => adminController.updateUser(req, res));
router.delete('/users/:userId', requirePermission('admin.users'), (req, res) => adminController.deleteUser(req, res));
router.get('/roles', requirePermission('admin.users'), (req, res) => adminController.listRoles(req, res));

// 7.2 — System settings
router.get('/settings', requirePermission('admin.settings'), (req, res) => adminController.getSettings(req, res));
router.put('/settings/:key', requirePermission('admin.settings'), validate(adminUpdateSettingDto), (req, res) => adminController.updateSetting(req, res));

// 7.3 — Audit log
router.get('/audit', requirePermission('admin.view_audit'), (req, res) => adminController.getAuditLog(req, res));

// 7.4 — Storage dashboard
router.get('/storage/stats', requirePermission('admin.storage'), (req, res) => adminController.getStorageStats(req, res));
router.get('/storage/objects', requirePermission('admin.storage'), (req, res) => adminController.listStorageObjects(req, res));

module.exports = router;
