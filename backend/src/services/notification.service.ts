import logger from '../config/logger';
import { toUser } from '../config/eventBus';
import {
  conversationRepository,
  emailRepository,
  notificationRepository,
  systemSettingsRepository,
  userRepository,
} from '../repositories';
import type { NotificationSettingsRow } from '../repositories/notification.repository';
import type { NotificationPrefsRequest, NotificationSettingsRequest } from '../dtos/notification.dto';
import { ForbiddenError } from '../errors';
import {
  BUILTIN_EVENT_DEFAULTS,
  NOTIFICATION_EVENTS,
  isNotificationEvent,
  type ChannelFlags,
  type NotificationEvent,
} from '../utils/notificationEvents';
import pushService, { type PushMessage } from './push.service';
import mailService from './mail.service';
import type { EmailTemplate, TemplateData } from '../emails/templates';
import { idiomaDe } from '../i18n';

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

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Minutos desde medianoche y día de la semana (0 = domingo) en la zona del usuario. */
function momentoLocal(timezone: string | null | undefined): { minutos: number; dia: number } {
  const ahora = new Date();
  try {
    const partes = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    }).formatToParts(ahora);
    const hora = Number(partes.find((p) => p.type === 'hour')?.value);
    const minuto = Number(partes.find((p) => p.type === 'minute')?.value);
    const dia = DIAS[partes.find((p) => p.type === 'weekday')?.value ?? ''];
    if (Number.isFinite(hora) && Number.isFinite(minuto) && dia !== undefined) {
      return { minutos: (hora % 24) * 60 + minuto, dia };
    }
  } catch {
    // Zona inválida guardada en el perfil: caemos a la hora del servidor.
  }
  return { minutos: ahora.getHours() * 60 + ahora.getMinutes(), dia: ahora.getDay() };
}

/** Lo que define el admin para toda la instancia (system_settings). */
export interface NotificationPolicy {
  push_enabled: boolean;
  email_enabled: boolean;
  defaults: Record<NotificationEvent, ChannelFlags>;
  locked: NotificationEvent[];
}

// La política se lee en cada notificación; con este cache una ráfaga de
// mensajes no multiplica las consultas. Un cambio del admin tarda a lo sumo
// esto en aplicarse.
const POLICY_TTL_MS = 15_000;
let policyCache: { value: NotificationPolicy; at: number } | null = null;

async function leerSetting(key: string): Promise<unknown> {
  try {
    return (await systemSettingsRepository.findByKey(key))?.value;
  } catch {
    return undefined;
  }
}

/** El setting lo edita el admin a mano: se toma sólo lo que tenga la forma esperada. */
function mergeDefaults(raw: unknown): Record<NotificationEvent, ChannelFlags> {
  const merged = { ...BUILTIN_EVENT_DEFAULTS };
  if (!raw || typeof raw !== 'object') return merged;
  for (const [event, flags] of Object.entries(raw as Record<string, unknown>)) {
    if (!isNotificationEvent(event) || !flags || typeof flags !== 'object') continue;
    const f = flags as Record<string, unknown>;
    merged[event] = {
      in_app: typeof f.in_app === 'boolean' ? f.in_app : merged[event].in_app,
      push: typeof f.push === 'boolean' ? f.push : merged[event].push,
      email: typeof f.email === 'boolean' ? f.email : merged[event].email,
    };
  }
  return merged;
}

/** Valores de user_notification_settings cuando el usuario no tiene fila. */
const SETTINGS_DEFAULTS: Omit<NotificationSettingsRow, 'user_id' | 'updated_at' | 'last_digest_at'> = {
  dnd_enabled: false,
  dnd_until: null,
  quiet_hours_start: null,
  quiet_hours_end: null,
  quiet_days: [],
  push_preview: 'full',
  push_when: 'inactive',
  sound_enabled: true,
  sound_name: 'ping',
  sound_volume: 70,
  ringtone_name: 'classic',
  badge_enabled: true,
  email_digest: 'off',
  email_digest_hour: 9,
  email_unread_delay_minutes: 30,
  email_locale: null,
  call_privacy: 'everyone',
  call_dnd_behavior: 'silent',
  ringtone_volume: 80,
  join_muted: false,
  join_camera_off: false,
  noise_suppression: true,
  echo_cancellation: true,
  auto_gain_control: true,
};

export type NotificationSettings = typeof SETTINGS_DEFAULTS;

/** Qué canales corresponden a un aviso puntual, ya aplicadas todas las reglas. */
export interface NotificationDecision extends ChannelFlags {
  /** En no molestar / horario de silencio: se registra, pero sin sonar ni push. */
  quiet: boolean;
}

export interface NotifyInput {
  event: NotificationEvent;
  /** `notifications.type`: lo que la bandeja usa para el ícono. */
  type: string;
  title: string;
  body?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  reference_data?: Record<string, unknown>;
  /** Para aplicar el silencio / nivel de aviso de ese chat. */
  conversationId?: string | null;
  /** Campos extra del evento de socket `notification:new`. */
  realtime?: Record<string, unknown>;
  /**
   * false = no guardar en la bandeja ni emitir `notification:new`. Para los
   * mensajes comunes, que el cliente ya avisa solo al recibirlos.
   */
  persist?: boolean;
  /** Contenido del push; sin esto el evento no manda push aunque esté activo. */
  push?: PushMessage;
  /**
   * Email inmediato (alertas de seguridad). Sin esto, un evento con email
   * activo se avisa por correo sólo si sigue sin leer tras la espera elegida.
   */
  email?: { template: EmailTemplate; data: Omit<TemplateData, 'appUrl' | 'name' | 'unsubscribeUrl'> };
}

/** "Activo" = con la app abierta y tocándola en los últimos minutos. */
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

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

  // ── Política de la instancia ───────────────────────────────────────────

  async getPolicy(): Promise<NotificationPolicy> {
    if (policyCache && Date.now() - policyCache.at < POLICY_TTL_MS) return policyCache.value;
    const [push, email, defaults, locked] = await Promise.all([
      leerSetting('notifications_push_enabled'),
      leerSetting('notifications_email_enabled'),
      leerSetting('notification_defaults'),
      leerSetting('notification_locked_events'),
    ]);
    const value: NotificationPolicy = {
      push_enabled: push !== false,
      email_enabled: email !== false,
      defaults: mergeDefaults(defaults),
      locked: Array.isArray(locked) ? locked.filter(isNotificationEvent) : [],
    };
    policyCache = { value, at: Date.now() };
    return value;
  }

  /** Para que un cambio del admin se vea en el acto en esta instancia. */
  invalidatePolicy(): void {
    policyCache = null;
  }

  // ── Preferencias del usuario ───────────────────────────────────────────

  /**
   * Matriz completa evento × canal ya resuelta (lo guardado por el usuario, o
   * el default del admin), más lo que la UI necesita para deshabilitar
   * controles: eventos bloqueados y canales apagados en la instancia.
   */
  async getPreferences(userId: string) {
    const [policy, rows] = await Promise.all([
      this.getPolicy(),
      notificationRepository.getPreferences(userId),
    ]);
    const events = NOTIFICATION_EVENTS.map((event) => {
      const locked = policy.locked.includes(event);
      const row = locked ? undefined : rows.find((r) => r.event_type === event);
      const base = policy.defaults[event];
      return {
        event_type: event,
        in_app_enabled: row?.in_app_enabled ?? base.in_app,
        push_enabled: row?.push_enabled ?? base.push,
        email_enabled: row?.email_enabled ?? base.email,
        locked,
      };
    });
    return {
      events,
      channels: {
        push: policy.push_enabled && pushService.isConfigured(),
        email: policy.email_enabled && mailService.isConfigured(),
      },
      // Los defaults de la instancia: para "volver al default" y para el editor del admin.
      defaults: policy.defaults,
    };
  }

  async updatePreference(userId: string, prefs: NotificationPrefsRequest) {
    const policy = await this.getPolicy();
    if (policy.locked.includes(prefs.event_type as NotificationEvent)) {
      throw new ForbiddenError('This notification is required by your organization');
    }
    await notificationRepository.upsertPreference(userId, prefs);
    const { events } = await this.getPreferences(userId);
    return events.find((e) => e.event_type === prefs.event_type);
  }

  async getSettings(userId: string): Promise<NotificationSettings> {
    const row = await notificationRepository.findSettings(userId);
    if (!row) return { ...SETTINGS_DEFAULTS };
    const { user_id: _u, updated_at: _a, last_digest_at: _d, ...settings } = row;
    return settings;
  }

  async updateSettings(userId: string, patch: NotificationSettingsRequest): Promise<NotificationSettings> {
    // Apagar el no molestar borra también su vencimiento, así no queda uno viejo
    // esperando a la próxima vez que se active "hasta desactivarlo".
    const normalized = patch.dnd_enabled === false ? { ...patch, dnd_until: null } : patch;
    const { user_id: _u, updated_at: _a, last_digest_at: _d, ...settings } =
      await notificationRepository.upsertSettings(userId, normalized);
    return settings;
  }

  // ── Resolución y envío ─────────────────────────────────────────────────

  /**
   * Decide por qué canales avisarle a `userId` de `event`. Orden de precedencia,
   * de lo más específico a lo más general:
   *
   *   1. Evento bloqueado por el admin → sus defaults, sin silencios posibles.
   *   2. Chat: nivel `none` apaga todo; `mentions` y `is_muted` dejan pasar
   *      sólo las menciones.
   *   3. Preferencia del usuario para el evento, o default del admin.
   *   4. Canales apagados en la instancia.
   *   5. No molestar / horario / días de silencio → `quiet` (se registra igual).
   */
  async resolve(
    userId: string,
    event: NotificationEvent,
    { conversationId = null }: { conversationId?: string | null } = {},
  ): Promise<NotificationDecision> {
    const policy = await this.getPolicy();
    const off: NotificationDecision = { in_app: false, push: false, email: false, quiet: true };

    const locked = policy.locked.includes(event);
    let flags: ChannelFlags = { ...policy.defaults[event] };

    if (!locked) {
      if (conversationId) {
        const member = await conversationRepository.getMember(conversationId, userId);
        if (!member) return off;
        const isMention = event === 'message.mention';
        const muted = Boolean(member.is_muted)
          && (!member.muted_until || new Date(member.muted_until as Date).getTime() > Date.now());
        if (member.notification_level === 'none') return off;
        if ((member.notification_level === 'mentions' || muted) && !isMention) return off;
      }

      const pref = await notificationRepository.findPreference(userId, event);
      if (pref) {
        flags = {
          in_app: pref.in_app_enabled ?? flags.in_app,
          push: pref.push_enabled ?? flags.push,
          email: pref.email_enabled ?? flags.email,
        };
      }
    }

    if (!policy.push_enabled || !pushService.isConfigured()) flags.push = false;
    if (!policy.email_enabled || !mailService.isConfigured()) flags.email = false;

    return { ...flags, quiet: locked ? false : await this.isQuietNow(userId) };
  }

  /** ¿El usuario está en no molestar, en su franja de silencio o en un día sin avisos? */
  async isQuietNow(userId: string): Promise<boolean> {
    const settings = await notificationRepository.findSettings(userId);
    if (!settings) return false;

    if (settings.dnd_enabled) {
      const until = settings.dnd_until ? new Date(settings.dnd_until as Date).getTime() : null;
      if (until === null || until > Date.now()) return true;
    }

    const hasDays = (settings.quiet_days?.length ?? 0) > 0;
    const hasHours = Boolean(settings.quiet_hours_start && settings.quiet_hours_end);
    if (!hasDays && !hasHours) return false;

    // Sólo vamos a buscar la zona horaria cuando hay algo que evaluar.
    const usuario = await userRepository.findById(userId);
    const { minutos, dia } = momentoLocal(usuario?.timezone);
    if (hasDays && settings.quiet_days.includes(dia)) return true;
    return hasHours && enHorarioSilencioso(
      String(settings.quiet_hours_start),
      String(settings.quiet_hours_end),
      minutos,
    );
  }

  /**
   * Único punto de entrada para avisarle algo a un usuario. Resuelve sus
   * preferencias y reparte por canal. Nunca lanza: un aviso que falla no debe
   * romper la acción que lo originó (mandar un mensaje, aprobar una solicitud…).
   *
   * Recordatorio de privacidad: `body` se guarda en texto plano, así que nunca
   * debe llevar contenido de mensajes (que van cifrados en reposo).
   */
  async notify(userId: string, input: NotifyInput): Promise<NotificationDecision | null> {
    try {
      const decision = await this.resolve(userId, input.event, { conversationId: input.conversationId });

      // El email "si sigue sin leer" necesita la fila para saber si se leyó:
      // se guarda aunque el aviso in-app esté apagado, pero entonces sin toast.
      const emailLater = decision.email && !input.email;
      if (input.persist !== false && (decision.in_app || emailLater)) {
        const notification = await notificationRepository.create({
          recipient_id: userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          reference_type: input.reference_type ?? null,
          reference_id: input.reference_id ?? null,
          // `notice` permite traducir el aviso al idioma del email.
          reference_data: input.push
            ? { ...input.reference_data, notice: { kind: input.push.kind, params: input.push.params ?? {} } }
            : input.reference_data ?? {},
        });
        if (decision.in_app) {
          toUser(userId, 'notification:new', {
            id: notification.id,
            type: input.type,
            event: input.event,
            title: input.title,
            silent: decision.quiet,
            ...input.realtime,
          });
        }
        if (emailLater) {
          const settings = await this.getSettings(userId);
          await emailRepository.setNotificationEmailDue(notification.id, settings.email_unread_delay_minutes);
        }
      }
      if (decision.email && input.email) {
        await mailService.enqueueForUser(userId, input.email.template, input.email.data);
      }
      if (decision.push && !decision.quiet && input.push) {
        await this._sendPush(userId, input.push);
      }
      return decision;
    } catch (err) {
      logger.warn({ err: (err as Error).message, userId, event: input.event }, 'Failed to notify');
      return null;
    }
  }

  /** Respeta "sólo si no estoy activo" y la privacidad elegida para el contenido. */
  async _sendPush(userId: string, message: PushMessage): Promise<void> {
    const [settings, user] = await Promise.all([this.getSettings(userId), userRepository.findById(userId)]);
    if (settings.push_when === 'inactive' && user?.presence === 'online' && user.last_seen_at
      && Date.now() - new Date(user.last_seen_at as Date).getTime() < ACTIVE_WINDOW_MS) {
      return;
    }
    await pushService.send(userId, message, {
      idioma: idiomaDe(user?.locale),
      preview: settings.push_preview as 'full' | 'sender' | 'none',
    });
  }
}

export default new NotificationService();
