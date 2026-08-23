import { Router } from 'express';
import { scheduledController } from '../controllers';
import { validate, authenticate } from '../middlewares';
import { scheduleMessageDto, createReminderDto } from '../dtos';
import { withAuth } from '../types/http';

const router = Router();
router.use(authenticate);

// Mensajes programados: escribir ahora, que salga después.
router.post('/messages', validate(scheduleMessageDto), withAuth((req, res) => scheduledController.schedule(req, res)));
router.get('/messages', withAuth((req, res) => scheduledController.listScheduled(req, res)));
router.delete('/messages/:id', withAuth((req, res) => scheduledController.cancelScheduled(req, res)));

// Recordatorios sobre un mensaje ajeno o propio.
router.post('/reminders', validate(createReminderDto), withAuth((req, res) => scheduledController.createReminder(req, res)));
router.get('/reminders', withAuth((req, res) => scheduledController.listReminders(req, res)));
router.delete('/reminders/:id', withAuth((req, res) => scheduledController.cancelReminder(req, res)));

export default router;
