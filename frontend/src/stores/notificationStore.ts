import { create } from 'zustand';
import { notificationsApi } from '@/lib/endpoints';
import { playMessageSound } from '@/lib/sounds';
import { useAuthStore } from '@/stores/authStore';
import type { ConversationResponse } from '@/types/conversation';
import type {
  NotificationEvent,
  NotificationPreferenceResponse,
  NotificationPrefsRequest,
  NotificationSettings,
  NotificationSettingsRequest,
} from '@/types/notification';

/**
 * Preferencias de notificación del usuario, cargadas al iniciar sesión.
 *
 * Las notificaciones que guarda el backend (menciones, hilos, llamadas…) ya
 * llegan filtradas. Los mensajes comunes no generan notificación en el
 * servidor: el aviso nativo y el sonido los decide el cliente con las mismas
 * reglas que `notificationService.resolve`, que se replican acá.
 */

const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function minutos(hora: string | null): number | null {
  if (!hora) return null;
  const [h, m] = hora.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/** Hora y día de la semana en la zona horaria del perfil (no la del navegador). */
function momentoLocal(timezone: string | null | undefined): { minutos: number; dia: number } {
  const ahora = new Date();
  try {
    const partes = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || undefined,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    }).formatToParts(ahora);
    const h = Number(partes.find((p) => p.type === 'hour')?.value);
    const m = Number(partes.find((p) => p.type === 'minute')?.value);
    const dia = DIAS.indexOf(partes.find((p) => p.type === 'weekday')?.value ?? '');
    if (Number.isFinite(h) && Number.isFinite(m) && dia >= 0) return { minutos: (h % 24) * 60 + m, dia };
  } catch {
    // Zona inválida: la del navegador.
  }
  return { minutos: ahora.getHours() * 60 + ahora.getMinutes(), dia: ahora.getDay() };
}

/** ¿Está activo el "no molestar" manual (sin vencer)? */
export function isDndActive(settings: NotificationSettings | null): boolean {
  if (!settings?.dnd_enabled) return false;
  return !settings.dnd_until || new Date(settings.dnd_until).getTime() > Date.now();
}

export function isQuiet(settings: NotificationSettings | null, timezone: string | null | undefined): boolean {
  if (!settings) return false;
  if (isDndActive(settings)) return true;
  const { minutos: ahora, dia } = momentoLocal(timezone);
  if (settings.quiet_days.includes(dia)) return true;
  const desde = minutos(settings.quiet_hours_start);
  const hasta = minutos(settings.quiet_hours_end);
  if (desde === null || hasta === null || desde === hasta) return false;
  return desde < hasta ? ahora >= desde && ahora < hasta : ahora >= desde || ahora < hasta;
}

/** ¿El chat está silenciado ahora (sin vencer)? */
export function isConversationMuted(conversation: Pick<ConversationResponse, 'is_muted' | 'muted_until'> | undefined): boolean {
  if (!conversation?.is_muted) return false;
  return !conversation.muted_until || new Date(conversation.muted_until).getTime() > Date.now();
}

interface NotificationState {
  settings: NotificationSettings | null;
  events: NotificationPreferenceResponse[];
  channels: { push: boolean; email: boolean };
  loaded: boolean;

  load: () => Promise<void>;
  updateSettings: (patch: NotificationSettingsRequest) => Promise<void>;
  updatePreference: (patch: NotificationPrefsRequest) => Promise<void>;
  /**
   * ¿Avisar (notificación nativa + sonido) un mensaje entrante de este chat?
   * `quiet` = corresponde avisar pero en silencio (no molestar / horario).
   */
  shouldAlert: (
    event: NotificationEvent,
    conversation?: ConversationResponse,
  ) => { alert: boolean; quiet: boolean };
  /** Suena si el usuario tiene sonidos activos y no está en silencio. */
  playAlertSound: () => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  settings: null,
  events: [],
  channels: { push: true, email: true },
  loaded: false,

  load: async () => {
    try {
      const [{ data: settings }, { data: prefs }] = await Promise.all([
        notificationsApi.getSettings(),
        notificationsApi.getPreferences(),
      ]);
      set({ settings, events: prefs.events, channels: prefs.channels, loaded: true });
    } catch {
      // Sin preferencias se avisa todo, que es el comportamiento por defecto.
      set({ loaded: true });
    }
  },

  updateSettings: async (patch) => {
    const previous = get().settings;
    if (previous) set({ settings: { ...previous, ...patch } });
    try {
      const { data } = await notificationsApi.updateSettings(patch);
      set({ settings: data });
    } catch (err) {
      set({ settings: previous });
      throw err;
    }
  },

  updatePreference: async (patch) => {
    const previous = get().events;
    set({
      events: previous.map((e) => (e.event_type === patch.event_type ? { ...e, ...patch } : e)),
    });
    try {
      const { data } = await notificationsApi.updatePreferences(patch);
      set((s) => ({ events: s.events.map((e) => (e.event_type === data.event_type ? data : e)) }));
    } catch (err) {
      set({ events: previous });
      throw err;
    }
  },

  shouldAlert: (event, conversation) => {
    const { events, settings } = get();
    const pref = events.find((e) => e.event_type === event);
    if (pref?.locked) return { alert: pref.in_app_enabled, quiet: false };

    if (conversation) {
      const isMention = event === 'message.mention';
      if (conversation.notification_level === 'none') return { alert: false, quiet: true };
      if ((conversation.notification_level === 'mentions' || isConversationMuted(conversation)) && !isMention) {
        return { alert: false, quiet: true };
      }
    }
    if (pref && !pref.in_app_enabled) return { alert: false, quiet: true };
    const timezone = useAuthStore.getState().user?.timezone;
    return { alert: true, quiet: isQuiet(settings, timezone) };
  },

  playAlertSound: () => {
    const { settings } = get();
    if (!settings) {
      playMessageSound('ping', 70);
      return;
    }
    if (!settings.sound_enabled) return;
    playMessageSound(settings.sound_name, settings.sound_volume);
  },

  reset: () => set({ settings: null, events: [], channels: { push: true, email: true }, loaded: false }),
}));
