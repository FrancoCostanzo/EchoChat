import { Router } from 'express';
import multer from 'multer';
import { conversationController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import { createConversationDto, updateConversationDto, addMembersDto, updateMemberDto } from '../dtos';
import { withAuth } from '../types/http';

// Mismos límites que el avatar de usuario (ver user.routes).
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();
router.use(authenticate);

router.post('/', validate(createConversationDto), withAuth((req, res) => conversationController.create(req, res)));
router.get('/', withAuth((req, res) => conversationController.getUserConversations(req, res)));
router.get('/:conversationId', withAuth((req, res) => conversationController.getById(req, res)));
router.put('/:conversationId', validate(updateConversationDto), withAuth((req, res) => conversationController.update(req, res)));

// Members
// Foto del grupo/canal (los directos usan el avatar del otro miembro).
router.post('/:conversationId/avatar', avatarUpload.single('file'), withAuth((req, res) => conversationController.uploadAvatar(req, res)));
router.delete('/:conversationId/avatar', withAuth((req, res) => conversationController.removeAvatar(req, res)));

router.get('/:conversationId/members', withAuth((req, res) => conversationController.getMembers(req, res)));
router.post('/:conversationId/members', validate(addMembersDto), withAuth((req, res) => conversationController.addMembers(req, res)));
router.put('/:conversationId/members/:userId', validate(updateMemberDto), withAuth((req, res) => conversationController.updateMember(req, res)));
router.delete('/:conversationId/members/:userId', withAuth((req, res) => conversationController.removeMember(req, res)));

// Read status
router.post('/:conversationId/read', withAuth((req, res) => conversationController.markAsRead(req, res)));

export default router;
