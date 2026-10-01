import type { NotificationSettings } from '@/types/notification';

/**
 * Dispositivos elegidos para las llamadas. Se guardan en este navegador y no
 * en el servidor: los ids de micrófono/cámara/parlante son propios de cada
 * navegador y no sirven en otro.
 */
export interface DevicePrefs {
  audioinput?: string;
  videoinput?: string;
  audiooutput?: string;
}

const KEY = 'echochat_call_devices';

export function getDevicePrefs(): DevicePrefs {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as DevicePrefs;
  } catch {
    return {};
  }
}

export function setDevicePref(kind: keyof DevicePrefs, deviceId: string | null): void {
  try {
    const prefs = getDevicePrefs();
    if (deviceId) prefs[kind] = deviceId;
    else delete prefs[kind];
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Sin storage (navegación privada): se usa el dispositivo por defecto.
  }
}

type AudioSettings = Pick<NotificationSettings, 'noise_suppression' | 'echo_cancellation' | 'auto_gain_control'>;

/**
 * Restricciones de audio con el micrófono elegido y el procesamiento que
 * configuró el usuario. `ideal` y no `exact`: si el micrófono guardado ya no
 * está conectado, el navegador usa otro en vez de fallar.
 */
export function audioConstraints(settings: AudioSettings | null, deviceId?: string): MediaTrackConstraints {
  return {
    deviceId: deviceId ? { ideal: deviceId } : undefined,
    noiseSuppression: settings?.noise_suppression ?? true,
    echoCancellation: settings?.echo_cancellation ?? true,
    autoGainControl: settings?.auto_gain_control ?? true,
  };
}

export function videoConstraints(deviceId?: string): MediaTrackConstraints {
  return {
    deviceId: deviceId ? { ideal: deviceId } : undefined,
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
}

/** ¿Este navegador deja elegir el parlante de salida? (Firefox/Safari no siempre.) */
export function canChooseSpeaker(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
}
