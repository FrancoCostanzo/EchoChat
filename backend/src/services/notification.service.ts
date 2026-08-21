import { notificationRepository, userRepository } from '../repositories';
import type { NotificationPrefsRequest } from '../dtos/notification.dto';

/**
 * ¿La hora `ahora` (en minutos desde medianoche) cae dentro de la franja de
 * silencio? La franja puede cruzar la medianoche (22:00 → 08:00).
 */
function enHorarioSilencioso(inicio: string, fin: string, ahoraMin: number): boolean {
  const aMinutos = (hora: string): number | null => {
    const [h, m] = String(hora).split(':');
    const total = parseInt(h, 10) * 60 + parseInt(m, 10);
    return Number.isFinite(total) ? total : null;
  };
  const desde = aMinutos(inicio);
  const hasta = aMinutos(fin);
  if (desde === null || hasta === null || desde === hasta) return false;
  return desde < hasta
    ? ahoraMin >= desde && ahoraMin < hasta
    : ahoraMin >= desde || ahoraMin < hasta; // cruza medianoche
}

/** Minutos desde medianoche en la zona horaria del usuario. */
function minutosLocales(timezone: string | null | undefined): number {
  const ahora = new Date();
  try {
    const partes = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(ahora);
    const hora = Number(partes.find((p) => p.type === 'hour')?.value);
    const minuto = Number(partes.find((p) => p.type === 'minute')?.value);
    if (Number.isFinite(hora) && Number.isFinite(minuto)) return hora * 60 + minuto;
  } catch {
    // Zona inválida guardada en el perfil: caemos a la hora del servidor.
  }
  return ahora.getHours() * 60 + ahora.getMinutes();
}

class NotificationService {
  async getByUser(
    userId: string,
    options?: { limit?: number; offset?: number; unreadOnly?: boolean },
  ) {
    return notificationRepository.findByUser(userId, options);
  }

  async markAsRead(notificationId: string, userId: string) {
    return notificationRepository.markAsRead(notificationId, userId);
  }

  async markAllAsRead(userId: string) {
    return notificationRepository.markAllAsRead(userId);
  }

  async getUnreadCount(userId: string) {
    return notificationRepository.getUnreadCount(userId);
  }

  async getPreferences(userId: string) {
    return notificationRepository.getPreferences(userId);
  }

  async updatePreference(userId: string, prefs: NotificationPrefsRequest) {
    return notificationRepository.upsertPreference(userId, prefs);
  }

  /**
   * ¿Corresponde mostrarle al usuario una notificación in-app de este evento?
   * Sin fila de preferencias el default es que sí, igual que muestra la UI de
   * ajustes. La franja de silencio se evalúa en la zona horaria del usuario.
   */
  async shouldNotifyInApp(userId: string, eventType: string): Promise<boolean> {
    const pref = await notificationRepository.findPreference(userId, eventType);
    if (!pref) return true;
    if (pref.in_app_enabled === false) return false;
    if (!pref.quiet_hours_start || !pref.quiet_hours_end) return true;

    // Sólo vamos a buscar la zona horaria cuando hay franja configurada.
    const usuario = await userRepository.findById(userId);
    return !enHorarioSilencioso(
      String(pref.quiet_hours_start),
      String(pref.quiet_hours_end),
      minutosLocales(usuario?.timezone),
    );
  }

  async create(data: Parameters<typeof notificationRepository.create>[0]) {
    return notificationRepository.create(data);
  }
}

export default new NotificationService();
