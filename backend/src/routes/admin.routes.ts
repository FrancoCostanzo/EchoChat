import { Router } from 'express';
import multer from 'multer';
import { adminController } from '../controllers';
import { validate, authenticate, requirePermission } from '../middlewares';
import {
  adminCreateUserDto,
  adminUpdateUserDto,
  adminUpdateSettingDto,
  adminResetPasswordDto,
} from '../dtos';
import { withAuth } from '../types/http';

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
router.get('/users', requirePermission('admin.users'), withAuth((req, res) => adminController.listUsers(req, res)));
router.post('/users', requirePermission('admin.users'), validate(adminCreateUserDto), withAuth((req, res) => adminController.createUser(req, res)));
router.patch('/users/:userId', requirePermission('admin.users'), validate(adminUpdateUserDto), withAuth((req, res) => adminController.updateUser(req, res)));
router.post('/users/:userId/avatar', requirePermission('admin.users'), avatarUpload.single('file'), withAuth((req, res) => adminController.uploadUserAvatar(req, res)));
router.delete('/users/:userId/avatar', requirePermission('admin.users'), withAuth((req, res) => adminController.removeUserAvatar(req, res)));
router.delete('/users/:userId/2fa', requirePermission('admin.users'), withAuth((req, res) => adminController.disableUser2fa(req, res)));
router.patch('/users/:userId/password', requirePermission('admin.users'), validate(adminResetPasswordDto), withAuth((req, res) => adminController.resetUserPassword(req, res)));
router.delete('/users/:userId', requirePermission('admin.users'), withAuth((req, res) => adminController.deleteUser(req, res)));
router.get('/roles', requirePermission('admin.users'), withAuth((req, res) => adminController.listRoles(req, res)));

// LDAP — importación manual de usuarios
router.get('/ldap/status', requirePermission('admin.users'), withAuth((req, res) => adminController.getLdapStatus(req, res)));
router.post('/ldap/sync', requirePermission('admin.users'), withAuth((req, res) => adminController.syncLdap(req, res)));

// Integraciones — estado agregado (LDAP + SSO) para el panel de admin
router.get('/integrations', requirePermission('admin.users'), withAuth((req, res) => adminController.getIntegrations(req, res)));

// 7.2 — System settings
router.get('/settings', requirePermission('admin.settings'), withAuth((req, res) => adminController.getSettings(req, res)));
router.put('/settings/:key', requirePermission('admin.settings'), validate(adminUpdateSettingDto), withAuth((req, res) => adminController.updateSetting(req, res)));

// 7.3 — Audit log
router.get('/audit', requirePermission('admin.view_audit'), withAuth((req, res) => adminController.getAuditLog(req, res)));

// 7.4 — Storage dashboard
router.get('/storage/stats', requirePermission('admin.storage'), withAuth((req, res) => adminController.getStorageStats(req, res)));
router.get('/storage/objects', requirePermission('admin.storage'), withAuth((req, res) => adminController.listStorageObjects(req, res)));

export = router;
