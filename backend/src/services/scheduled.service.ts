import logger from '../config/logger';
import { toUser } from '../config/eventBus';
import {
  scheduledMessageRepository,
  reminderRepository,
  conversationRepository,
  messageRepository,
  notificationRepository,
} from '../repositories';
import messageService from './message.service';
import notificationService from './notification.service';
import { NotFoundError, ForbiddenError } from '../errors';
import { toScheduledMessageResponse, toReminderResponse } from '../models/scheduled.model';
import type { ScheduleMessageRequest, CreateReminderRequest } from '../dtos/scheduled.dto';

/**
 * Mensajes programados y recordatorios.
 *
 * El despacho lo dispara el job `scheduled-messages` (uno por minuto); acá vive
 * la lógica para que el job sea un archivo de tres líneas y para que se pueda
 * probar sin cron.
 */
class ScheduledService {
  // ── Mensajes programados ────────────────────────────────────────────────
  async programar(userId: string, data: ScheduleMessageRequest) {
    const miembro = await conversationRepository.getMember(data.conversation_id, userId);
    if (!miembro) throw new ForbiddenError('Not a member of this conversation');

    const fila = await scheduledMessageRepository.create({
      conversation_id: data.conversation_id,
      sender_id: userId,
      body: data.body,
      body_format: data.body_format,
      scheduled_at: data.scheduled_at as Date,
    });
    logger.info({ scheduledId: fila.id, at: fila.scheduled_at }, 'Message scheduled');
    return toScheduledMessageResponse(fila);
  }

  async listarProgramados(userId: string) {
    const filas = await scheduledMessageRepository.findByUser(userId);
    return filas.map(toScheduledMessageResponse);
  }

  async cancelarProgramado(id: string, userId: string) {
    const fila = await scheduledMessageRepository.cancelar(id, userId);
    // Sin fila: o no existe, o no es de este usuario, o ya salió. En los tres
    // casos lo que corresponde decir es que no hay nada pendiente que cancelar.
    if (!fila) throw new NotFoundError('Scheduled message');
    return toScheduledMessageResponse(fila);
  }

  /**
   * Despacha los programados vencidos. Cada uno pasa por `messageService.send`,
   * así que hereda todo lo del envío normal (menciones, acuses, tiempo real).
   */
  async despacharVencidos(): Promise<number> {
    const vencidos = await scheduledMessageRepository.tomarVencidos();
    let enviados = 0;

    for (const programado of vencidos) {
      try {
        const mensaje = await messageService.send(programado.sender_id, {
          conversation_id: programado.conversation_id,
          type: 'text',
          body: programado.body,
          body_format: (programado.body_format as 'plain' | 'markdown' | 'html') || 'plain',
        });
        await scheduledMessageRepository.marcarEnviado(programado.id, mensaje.id);
        toUser(programado.sender_id, 'scheduled:sent', {
          id: programado.id,
          message_id: mensaje.id,
          conversation_id: programado.conversation_id,
        });
        enviados++;
      } catch (err) {
        // Típico: lo sacaron de la conversación entre que programó y venció.
        const motivo = (err as Error).message;
        await scheduledMessageRepository.marcarFallido(programado.id, motivo);
        toUser(programado.sender_id, 'scheduled:failed', { id: programado.id, error: motivo });
        logger.warn({ err: motivo, scheduledId: programado.id }, 'Scheduled message failed');
      }
    }
    return enviados;
  }

  // ── Recordatorios ───────────────────────────────────────────────────────
  async recordar(userId: string, data: CreateReminderRequest) {
    const mensaje = await messageRepository.findById(data.message_id);
    if (!mensaje) throw new NotFoundError('Message');
    // Sólo se puede poner un recordatorio sobre algo que uno puede ver.
    const miembro = await conversationRepository.getMember(mensaje.conversation_id, userId);
    if (!miembro) throw new ForbiddenError('Not a member of this conversation');

    const fila = await reminderRepository.create({
      user_id: userId,
      message_id: data.message_id,
      conversation_id: mensaje.conversation_id,
      remind_at: data.remind_at as Date,
      note: data.note,
    });
    logger.info({ reminderId: fila.id, at: fila.remind_at }, 'Reminder created');
    return toReminderResponse(fila);
  }

  async listarRecordatorios(userId: string) {
    const filas = await reminderRepository.findByUser(userId);
    return filas.map(toReminderResponse);
  }

  async cancelarRecordatorio(id: string, userId: string) {
    const fila = await reminderRepository.cancelar(id, userId);
    if (!fila) throw new NotFoundError('Reminder');
    return toReminderResponse(fila);
  }

  /**
   * Entrega los recordatorios vencidos como notificación in-app.
   *
   * Igual que en las menciones, la notificación NO guarda el texto del mensaje:
   * `notifications.body` es texto plano y el contenido va cifrado en reposo. La
   * nota que el usuario escribió sí, porque la escribió para leerla acá.
   */
  async entregarRecordatoriosVencidos(): Promise<number> {
    const vencidos = await reminderRepository.tomarVencidos();

    for (const recordatorio of vencidos) {
      try {
        if (await notificationService.shouldNotifyInApp(recordatorio.user_id, 'reminder')) {
          await notificationRepository.create({
            recipient_id: recordatorio.user_id,
            type: 'reminder',
            title: 'Recordatorio',
            body: recordatorio.note || null,
            reference_type: 'message',
            reference_id: recordatorio.message_id,
            reference_data: { conversation_id: recordatorio.conversation_id },
          });
        }
        toUser(recordatorio.user_id, 'notification:new', {
          type: 'reminder',
          message_id: recordatorio.message_id,
          conversation_id: recordatorio.conversation_id,
          note: recordatorio.note,
        });
      } catch (err) {
        logger.warn(
          { err: (err as Error).message, reminderId: recordatorio.id },
          'Failed to deliver reminder',
        );
      }
    }
    return vencidos.length;
  }
}

export default new ScheduledService();
