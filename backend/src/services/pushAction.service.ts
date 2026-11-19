import logger from '../config/logger';
import pushService from './push.service';
import callService from './call.service';
import conversationService from './conversation.service';
import { ForbiddenError } from '../errors';

/**
 * Acciones que el usuario toca en una notificación push sin abrir la app
 * ("Marcar como leído", "Rechazar"). Las ejecuta el service worker con el
 * token firmado que vino en el aviso, que sólo autoriza esa acción puntual.
 *
 * Vive aparte de push.service para no crear un ciclo: call.service ya usa el
 * despachador de notificaciones, que a su vez usa push.service.
 */
class PushActionService {
  async run(token: string): Promise<void> {
    const action = pushService.verifyAction(token);
    if (action.act === 'read') {
      await conversationService.markAsRead(action.conversationId, action.sub, action.messageId);
    } else {
      const found = await callService.getPeers(action.callId, action.sub);
      if (!found) throw new ForbiddenError('Not a participant of this call');
      await callService.decline(action.callId, action.sub, 'declined');
    }
    logger.info({ userId: action.sub, act: action.act }, 'Push action executed');
  }
}

export default new PushActionService();
