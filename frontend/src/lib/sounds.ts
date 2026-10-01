/**
 * Sonidos de notificación sintetizados con Web Audio: no hay archivos que
 * servir ni cachear, y cada sonido son unas pocas notas.
 *
 * Los navegadores no dejan reproducir audio antes de la primera interacción
 * del usuario con la página; en ese caso el sonido simplemente no sale.
 */

/** Una nota: frecuencia (Hz), inicio y duración (s) relativos al disparo. */
interface Tone {
  freq: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  /** Desliza la frecuencia hasta este valor durante la nota. */
  glideTo?: number;
}

export const MESSAGE_SOUNDS: Record<string, Tone[]> = {
  ping: [{ freq: 880, start: 0, duration: 0.18 }],
  chime: [
    { freq: 660, start: 0, duration: 0.22 },
    { freq: 990, start: 0.12, duration: 0.3 },
  ],
  pop: [{ freq: 420, start: 0, duration: 0.09, glideTo: 900, type: 'triangle' }],
  bubble: [
    { freq: 500, start: 0, duration: 0.08, glideTo: 750 },
    { freq: 700, start: 0.09, duration: 0.1, glideTo: 1050 },
  ],
  knock: [
    { freq: 180, start: 0, duration: 0.07, type: 'triangle' },
    { freq: 180, start: 0.14, duration: 0.07, type: 'triangle' },
  ],
};

export const MESSAGE_SOUND_NAMES = Object.keys(MESSAGE_SOUNDS);

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume().catch(() => {});
  return context;
}

/** Toca una secuencia de notas al `volume` (0–100) dado. */
export function playTones(tones: Tone[], volume: number): void {
  const ctx = getContext();
  if (!ctx || volume <= 0) return;
  const gainMax = Math.min(1, volume / 100) * 0.35;
  const now = ctx.currentTime;

  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type ?? 'sine';
    osc.frequency.setValueAtTime(tone.freq, now + tone.start);
    if (tone.glideTo) {
      osc.frequency.exponentialRampToValueAtTime(tone.glideTo, now + tone.start + tone.duration);
    }
    // Ataque corto y caída exponencial: sin clics al empezar ni al cortar.
    gain.gain.setValueAtTime(0.0001, now + tone.start);
    gain.gain.exponentialRampToValueAtTime(gainMax, now + tone.start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + tone.start);
    osc.stop(now + tone.start + tone.duration + 0.02);
  }
}

export function playMessageSound(name: string, volume: number): void {
  playTones(MESSAGE_SOUNDS[name] ?? MESSAGE_SOUNDS.ping, volume);
}

// ── Tonos de llamada ───────────────────────────────────────────────────

/** Un ciclo del tono; se repite cada `period` segundos mientras suena. */
export const RINGTONES: Record<string, { period: number; tones: Tone[] }> = {
  classic: {
    period: 3,
    tones: [
      { freq: 440, start: 0, duration: 0.4 },
      { freq: 480, start: 0, duration: 0.4 },
      { freq: 440, start: 0.6, duration: 0.4 },
      { freq: 480, start: 0.6, duration: 0.4 },
    ],
  },
  soft: {
    period: 2.6,
    tones: [
      { freq: 523, start: 0, duration: 0.35, type: 'triangle' },
      { freq: 659, start: 0.25, duration: 0.35, type: 'triangle' },
      { freq: 784, start: 0.5, duration: 0.55, type: 'triangle' },
    ],
  },
  digital: {
    period: 2,
    tones: [
      { freq: 1046, start: 0, duration: 0.09, type: 'square' },
      { freq: 1046, start: 0.15, duration: 0.09, type: 'square' },
      { freq: 1046, start: 0.3, duration: 0.09, type: 'square' },
    ],
  },
};

export const RINGTONE_NAMES = Object.keys(RINGTONES);

/** Toca un ciclo del tono (para la vista previa en Ajustes). */
export function previewRingtone(name: string, volume: number): void {
  playTones((RINGTONES[name] ?? RINGTONES.classic).tones, volume);
}

/** Hace sonar el tono en bucle; devuelve la función que lo corta. */
export function startRingtone(name: string, volume: number): () => void {
  const ringtone = RINGTONES[name] ?? RINGTONES.classic;
  playTones(ringtone.tones, volume);
  const timer = setInterval(() => playTones(ringtone.tones, volume), ringtone.period * 1000);
  return () => clearInterval(timer);
}
