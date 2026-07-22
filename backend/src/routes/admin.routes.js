const { Router } = require('express');
const multer = require('multer');
const { adminController } = require('../controllers');
const { validate, authenticate, requirePermission } = require('../middlewares');
const {
  adminCreateUserDto,
  adminUpdateUserDto,
  adminUpdateSettingDto,
  adminResetPasswordDto,
} = require('../dtos');

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();
router.use(authenticate);

// 7.1 — User management
router.get('/users', requirePermission('admin.users'), (req, res) => adminController.listUsers(req, res));
router.post('/users', requirePermission('admin.users'), validate(adminCreateUserDto), (req, res) => adminController.createUser(req, res));
router.patch('/users/:userId', requirePermission('admin.users'), validate(adminUpdateUserDto), (req, res) => adminController.updateUser(req, res));
router.post('/users/:userId/avatar', requirePermission('admin.users'), avatarUpload.single('file'), (req, res) => adminController.uploadUserAvatar(req, res));
router.delete('/users/:userId/avatar', requirePermission('admin.users'), (req, res) => adminController.removeUserAvatar(req, res));
router.delete('/users/:userId/2fa', requirePermission('admin.users'), (req, res) => adminController.disableUser2fa(req, res));
router.patch('/users/:userId/password', requirePermission('admin.users'), validate(adminResetPasswordDto), (req, res) => adminController.resetUserPassword(req, res));
router.delete('/users/:userId', requirePermission('admin.users'), (req, res) => adminController.deleteUser(req, res));
router.get('/roles', requirePermission('admin.users'), (req, res) => adminController.listRoles(req, res));

// LDAP — importación manual de usuarios
router.get('/ldap/status', requirePermission('admin.users'), (req, res) => adminController.getLdapStatus(req, res));
router.post('/ldap/sync', requirePermission('admin.users'), (req, res) => adminController.syncLdap(req, res));

// Integraciones — estado agregado (LDAP + SSO) para el panel de admin
router.get('/integrations', requirePermission('admin.users'), (req, res) => adminController.getIntegrations(req, res));

// 7.2 — System settings
router.get('/settings', requirePermission('admin.settings'), (req, res) => adminController.getSettings(req, res));
router.put('/settings/:key', requirePermission('admin.settings'), validate(adminUpdateSettingDto), (req, res) => adminController.updateSetting(req, res));

// 7.3 — Audit log
router.get('/audit', requirePermission('admin.view_audit'), (req, res) => adminController.getAuditLog(req, res));

// 7.4 — Storage dashboard
router.get('/storage/stats', requirePermission('admin.storage'), (req, res) => adminController.getStorageStats(req, res));
router.get('/storage/objects', requirePermission('admin.storage'), (req, res) => adminController.listStorageObjects(req, res));

module.exports = router;
