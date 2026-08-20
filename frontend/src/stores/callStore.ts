import { create } from 'zustand';
import { getSocket } from '@/lib/socket';
import { callsApi, conversationsApi } from '@/lib/endpoints';
import type { CallType, CallEndReason, InitiateCallRequest } from '@/types/call';

/*
 * callStore — Llamadas de voz/vídeo 1:1 y grupales sobre WebRTC (malla P2P).
 *
 * El backend solo transporta señalización (SDP/ICE) y el ciclo de vida de la
 * llamada por Socket.IO; el audio y el vídeo viajan directo entre navegadores.
 * Para cada par remoto se abre un RTCPeerConnection. Con N participantes cada
 * cliente mantiene N-1 conexiones (malla) — pensado para grupos pequeños.
 */

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
};

const RING_TIMEOUT_MS = 35000;

/** "Perfect negotiation" necesita guardar dos banderas por conexión que el DOM no expone. */
type NegotiatingPeerConnection = RTCPeerConnection & { _polite: boolean; _makingOffer: boolean };

interface DirectoryEntry {
  display_name: string;
  avatar_url: string | null;
}

interface CallInfo {
  id: string;
  type: CallType;
  conversationId: string;
  isGroup: boolean;
  conversationName?: string | null;
  calleeIds?: string[];
}

interface IncomingCall {
  callId: string;
  type: CallType;
  from: { id: string; display_name?: string; avatar_url?: string | null };
  conversationId: string;
  conversationName?: string | null;
  participantIds?: string[];
}

export interface Participant {
  id: string;
  displayName?: string;
  avatar_url?: string | null;
  stream?: MediaStream;
  screenStream?: MediaStream | null;
  micOff?: boolean;
  camOff?: boolean;
}

interface SignalData {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

// Estado no serializable fuera de Zustand (RTCPeerConnection no debe re-renderizar).
let selfId: string | null = null;
let attached = false;
const peers = new Map<string, NegotiatingPeerConnection>();
/** userId -> RTCIceCandidateInit[] (llegados antes del answer) */
const pendingIce = new Map<string, RTCIceCandidateInit[]>();
let localStream: MediaStream | null = null;
/** stream de pantalla compartida (independiente de la cámara) */
let screenStream: MediaStream | null = null;
/** userId -> id del MediaStream de cámara (para distinguirlo del de pantalla en ontrack) */
const camStreamIds = new Map<string, string>();
let ringTimer: ReturnType<typeof setTimeout> | null = null;
let durationTimer: ReturnType<typeof setInterval> | null = null;

function socket() {
  return getSocket();
}

/* Regla determinista para evitar "glare": de cada par, quien tiene el id mayor
   crea la oferta. Ambos lados ejecutan la misma comparación → una sola oferta. */
function shouldOffer(otherId: string): boolean {
  return String(selfId) > String(otherId);
}

async function getLocalMedia(withVideo: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: withVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
  });
}

export type CallUiStatus = 'idle' | 'incoming' | 'outgoing' | 'active';

interface CallState {
  status: CallUiStatus;
  call: CallInfo | null;
  incoming: IncomingCall | null;
  participants: Record<string, Participant>;
  /** nombres conocidos */
  directory: Record<string, DirectoryEntry>;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  micOff: boolean;
  camOff: boolean;
  sharingScreen: boolean;
  /** timestamp ms cuando la llamada pasa a activa */
  startedAt: number | null;
  /** segundos transcurridos (para el cronómetro) */
  elapsed: number;
  endReason?: string;

  attach: (userId: string) => void;
  detach: () => void;
  _loadDirectory: (conversationId: string | null | undefined) => Promise<Record<string, DirectoryEntry>>;
  startCall: (opts: {
    conversationId: string;
    type?: CallType;
    isGroup?: boolean;
    conversationName?: string | null;
    self?: { display_name?: string; avatar_url?: string | null };
  }) => Promise<void>;
  _onIncoming: (payload: IncomingCall) => void;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  hangup: (reason?: string) => void;
  _onPeers: (userIds: string[]) => void;
  _onPeerJoined: (uid: string) => void;
  _onPeerLeft: (uid: string) => void;
  _ensurePeer: (uid: string) => NegotiatingPeerConnection | undefined;
  _onSignal: (from: string, data: SignalData) => Promise<void>;
  _onRejected: (uid: string, reason: string) => void;
  _onCancelled: () => void;
  _onRemoteMedia: (uid: string, kind: 'audio' | 'video' | 'screen', enabled: boolean) => void;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  _stopScreenShare: () => void;
  _upsertParticipant: (uid: string, patch: Partial<Participant>) => void;
  _startDurationTimer: () => void;
  _cleanup: () => void;
}

export const useCallStore = create<CallState>()((set, get) => ({
  status: 'idle',
  call: null,
  incoming: null,
  participants: {},
  directory: {},
  localStream: null,
  screenStream: null,
  micOff: false,
  camOff: false,
  sharingScreen: false,
  startedAt: null,
  elapsed: 0,

  // ── Registro de listeners de socket ──────────────────────────────────
  attach: (userId) => {
    const sock = socket();
    if (!sock || attached) return;
    selfId = userId;
    attached = true;

    sock.on('call:incoming', (payload: IncomingCall) => get()._onIncoming(payload));
    sock.on('call:peers', ({ userIds }: { userIds: string[] }) => get()._onPeers(userIds));
    sock.on('call:peer-joined', ({ userId: uid }: { userId: string }) => get()._onPeerJoined(uid));
    sock.on('call:peer-left', ({ userId: uid }: { userId: string }) => get()._onPeerLeft(uid));
    sock.on('call:signal', ({ from, data }: { from: string; data: SignalData }) => get()._onSignal(from, data));
    sock.on('call:rejected', ({ userId: uid, reason }: { userId: string; reason: string }) => get()._onRejected(uid, reason));
    sock.on('call:cancelled', () => get()._onCancelled());
    sock.on('call:media', ({ userId: uid, kind, enabled }: { userId: string; kind: 'audio' | 'video' | 'screen'; enabled: boolean }) => get()._onRemoteMedia(uid, kind, enabled));
  },

  detach: () => {
    const sock = socket();
    if (sock) {
      [
        'call:incoming', 'call:peers', 'call:peer-joined', 'call:peer-left',
        'call:signal', 'call:rejected', 'call:cancelled', 'call:media',
      ].forEach((ev) => sock.off(ev));
    }
    attached = false;
    get()._cleanup();
  },

  // ── Directorio de nombres (para tiles) ───────────────────────────────
  _loadDirectory: async (conversationId) => {
    if (!conversationId) return {};
    try {
      const { data } = await conversationsApi.getMembers(conversationId);
      const dir: Record<string, DirectoryEntry> = {};
      for (const m of data || []) {
        dir[m.user_id] = { display_name: m.display_name || '', avatar_url: null };
      }
      set((s) => ({ directory: { ...s.directory, ...dir } }));
      return dir;
    } catch {
      return {};
    }
  },

  // ── Iniciar una llamada (saliente) ───────────────────────────────────
  startCall: async ({ conversationId, type = 'voice', isGroup = false, conversationName, self }) => {
    if (get().status !== 'idle') return;
    try {
      // Resolver participantes reales desde los miembros de la conversación.
      const { data: members } = await conversationsApi.getMembers(conversationId);
      const calleeIds = (members || [])
        .map((m) => m.user_id)
        .filter((id) => id !== selfId);
      if (calleeIds.length === 0) throw new Error('no-participants');

      const dir: Record<string, DirectoryEntry> = {};
      for (const m of members || []) {
        dir[m.user_id] = { display_name: m.display_name || '', avatar_url: null };
      }

      const stream = await getLocalMedia(type === 'video');
      localStream = stream;

      // Persistir la llamada para el historial y obtener un id de servidor.
      const { data: callRow } = await callsApi.create({
        conversation_id: conversationId,
        type,
        participant_ids: calleeIds,
      } satisfies InitiateCallRequest);
      const callId = callRow.id;

      set({
        status: 'outgoing',
        call: { id: callId, type, conversationId, isGroup, conversationName, calleeIds },
        localStream: stream,
        directory: dir,
        micOff: false,
        camOff: type !== 'video',
        sharingScreen: false,
        participants: {},
        elapsed: 0,
      });

      socket()?.emit('call:start', {
        callId,
        conversationId,
        type,
        calleeIds,
        from: {
          id: selfId,
          display_name: self?.display_name,
          avatar_url: self?.avatar_url || null,
        },
      });

      // Sin respuesta tras el timeout → colgar como "no contestada".
      ringTimer = setTimeout(() => {
        if (get().status === 'outgoing') get().hangup('timeout');
      }, RING_TIMEOUT_MS);
    } catch (err) {
      get()._cleanup();
      set({ status: 'idle' });
      throw err;
    }
  },

  // ── Llamada entrante ─────────────────────────────────────────────────
  _onIncoming: (payload) => {
    // Ya ocupado en otra llamada → rechazar automáticamente como "busy".
    if (get().status !== 'idle') {
      socket()?.emit('call:reject', { callId: payload.callId, reason: 'busy' });
      return;
    }
    set({ status: 'incoming', incoming: payload });
    get()._loadDirectory(payload.conversationId);
  },

  acceptCall: async () => {
    const inc = get().incoming;
    if (!inc) return;
    try {
      const stream = await getLocalMedia(inc.type === 'video');
      localStream = stream;
      set({
        status: 'active',
        call: {
          id: inc.callId,
          type: inc.type,
          conversationId: inc.conversationId,
          isGroup: (inc.participantIds?.length || 0) > 2,
          conversationName: inc.conversationName,
        },
        incoming: null,
        localStream: stream,
        micOff: false,
        camOff: inc.type !== 'video',
        sharingScreen: false,
        startedAt: Date.now(),
      });
      get()._startDurationTimer();
      socket()?.emit('call:accept', { callId: inc.callId });
    } catch {
      get().rejectCall();
    }
  },

  rejectCall: () => {
    const inc = get().incoming;
    if (inc) socket()?.emit('call:reject', { callId: inc.callId, reason: 'declined' });
    get()._cleanup();
    set({ status: 'idle', incoming: null });
  },

  // ── Colgar / abandonar ───────────────────────────────────────────────
  hangup: (reason = 'hangup') => {
    const { status, call } = get();
    if (call) {
      if (status === 'outgoing') {
        // Aún timbrando: cancelar en los invitados por su sala personal.
        socket()?.emit('call:cancel', { callId: call.id, calleeIds: call.calleeIds || [] });
      }
      socket()?.emit('call:leave', { callId: call.id });
      // Cierra el registro para el historial. Si nunca se conectó (seguía
      // timbrando o expiró) queda como "perdida"; si estaba activa, "finalizada".
      const answered = status === 'active';
      callsApi.updateStatus(call.id, answered
        ? { status: 'ended', end_reason: 'hangup' as CallEndReason }
        : { status: 'missed', end_reason: 'no_answer' as CallEndReason }).catch(() => {});
    }
    get()._cleanup();
    set({ status: 'idle', call: null, incoming: null });
  },

  // ── Malla WebRTC ─────────────────────────────────────────────────────
  // Al aceptar, el servidor devuelve quiénes ya estaban → creamos conexión.
  _onPeers: (userIds) => {
    for (const uid of userIds) get()._ensurePeer(uid);
  },

  // Alguien nuevo entró; si somos el iniciador del par, le ofrecemos.
  _onPeerJoined: (uid) => {
    // Un peer entrante confirma que la llamada saliente fue aceptada.
    if (get().status === 'outgoing') {
      if (ringTimer) clearTimeout(ringTimer);
      set({ status: 'active', startedAt: Date.now() });
      get()._startDurationTimer();
    }
    get()._ensurePeer(uid);
  },

  _onPeerLeft: (uid) => {
    const pc = peers.get(uid);
    if (pc) { try { pc.close(); } catch { /* noop */ } peers.delete(uid); }
    pendingIce.delete(uid);
    camStreamIds.delete(uid);
    set((s) => {
      const next = { ...s.participants };
      delete next[uid];
      return { participants: next };
    });
    // En 1:1 (o si no queda nadie) la llamada terminó.
    const remaining = Object.keys(get().participants);
    if (!get().call?.isGroup || remaining.length === 0) {
      get()._cleanup();
      set({ status: 'idle', call: null });
    }
  },

  // Crea (o reutiliza) la conexión con un par usando "perfect negotiation":
  // la renegociación se dispara sola vía onnegotiationneeded, lo que cubre tanto
  // el establecimiento inicial como añadir la cámara a mitad de una llamada.
  _ensurePeer: (uid) => {
    if (peers.has(uid) || uid === selfId) return peers.get(uid);
    const pc = new RTCPeerConnection(ICE_CONFIG) as NegotiatingPeerConnection;
    // El par con id menor es "polite": ante una colisión de ofertas cede.
    pc._polite = !shouldOffer(uid);
    pc._makingOffer = false;
    peers.set(uid, pc);

    if (localStream) {
      for (const track of localStream.getTracks()) pc.addTrack(track, localStream);
    }
    // Si ya estábamos compartiendo pantalla cuando este peer se une, sumarle esa pista también.
    if (screenStream) {
      for (const track of screenStream.getTracks()) pc.addTrack(track, screenStream);
    }

    pc.onnegotiationneeded = async () => {
      try {
        pc._makingOffer = true;
        await pc.setLocalDescription();
        socket()?.emit('call:signal', {
          callId: get().call?.id,
          to: uid,
          data: { sdp: pc.localDescription },
        });
      } catch { /* noop */ } finally {
        pc._makingOffer = false;
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket()?.emit('call:signal', {
          callId: get().call?.id,
          to: uid,
          data: { candidate: e.candidate },
        });
      }
    };

    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (!stream) return;
      // La cámara/mic viajan en el primer MediaStream que vemos de este uid; cualquier
      // stream posterior con otro id es la pantalla compartida (no hay orden garantizado
      // entre la señal call:media y el evento ontrack, así que no se puede usar eso).
      const knownCamId = camStreamIds.get(uid);
      if (!knownCamId) {
        camStreamIds.set(uid, stream.id);
        get()._upsertParticipant(uid, { stream });
      } else if (stream.id === knownCamId) {
        get()._upsertParticipant(uid, { stream });
      } else {
        get()._upsertParticipant(uid, { screenStream: stream });
      }
    };

    // Registrar el tile del participante aunque el stream aún no llegue.
    const info = get().directory[uid] || { display_name: '', avatar_url: null };
    get()._upsertParticipant(uid, {
      displayName: info.display_name || 'Participante',
      avatar_url: info.avatar_url || null,
      micOff: false,
      camOff: false,
    });

    return pc;
  },

  _onSignal: async (from, data) => {
    let pc = peers.get(from);
    if (!pc) pc = get()._ensurePeer(from);
    if (!pc) return;
    try {
      if (data.sdp) {
        const offerCollision =
          data.sdp.type === 'offer' &&
          (pc._makingOffer || pc.signalingState !== 'stable');
        // El impolite ignora la oferta en colisión; el polite hace rollback.
        if (offerCollision && !pc._polite) return;

        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        // Vaciar ICE que llegó antes de tener descripción remota.
        const queued = pendingIce.get(from);
        if (queued) {
          for (const c of queued) { try { await pc.addIceCandidate(c); } catch { /* noop */ } }
          pendingIce.delete(from);
        }
        if (data.sdp.type === 'offer') {
          await pc.setLocalDescription();
          socket()?.emit('call:signal', {
            callId: get().call?.id,
            to: from,
            data: { sdp: pc.localDescription },
          });
        }
      } else if (data.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try { await pc.addIceCandidate(data.candidate); } catch { /* noop */ }
        } else {
          const arr = pendingIce.get(from) || [];
          arr.push(data.candidate);
          pendingIce.set(from, arr);
        }
      }
    } catch { /* noop */ }
  },

  _onRejected: (uid, reason) => {
    const { status, call } = get();
    if (status === 'outgoing') {
      // 1:1: el otro rechazó → terminamos. Grupo: seguimos esperando al resto.
      if (!call?.isGroup && call) {
        // Persistir el resultado para que quede el evento en el chat/historial.
        callsApi.updateStatus(call.id, {
          status: reason === 'busy' ? 'missed' : 'rejected',
          end_reason: reason === 'busy' ? 'no_answer' as CallEndReason : 'rejected' as CallEndReason,
        }).catch(() => {});
        get()._cleanup();
        set({ status: 'idle', call: null, endReason: reason });
      }
    }
  },

  _onCancelled: () => {
    if (get().status === 'incoming') {
      get()._cleanup();
      set({ status: 'idle', incoming: null });
    }
  },

  _onRemoteMedia: (uid, kind, enabled) => {
    if (kind === 'screen') {
      // El stream real llega por ontrack; acá sólo nos importa limpiarlo cuando para.
      if (!enabled) get()._upsertParticipant(uid, { screenStream: null });
      return;
    }
    get()._upsertParticipant(uid, kind === 'audio' ? { micOff: !enabled } : { camOff: !enabled });
  },

  // ── Controles de medios locales ──────────────────────────────────────
  toggleMute: () => {
    if (!localStream) return;
    const next = !get().micOff;
    localStream.getAudioTracks().forEach((t) => { t.enabled = !next; });
    set({ micOff: next });
    socket()?.emit('call:media', { callId: get().call?.id, kind: 'audio', enabled: !next });
  },

  toggleCamera: async () => {
    if (!localStream) return;
    const hasVideo = localStream.getVideoTracks().length > 0;
    if (!hasVideo) {
      // Encender cámara por primera vez (llamada de voz que pasa a vídeo).
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = cam.getVideoTracks()[0];
        localStream.addTrack(track);
        for (const pc of peers.values()) pc.addTrack(track, localStream);
        set({ camOff: false, localStream: localStream });
        socket()?.emit('call:media', { callId: get().call?.id, kind: 'video', enabled: true });
      } catch { /* noop */ }
      return;
    }
    const next = !get().camOff;
    localStream.getVideoTracks().forEach((t) => { t.enabled = !next; });
    set({ camOff: next });
    socket()?.emit('call:media', { callId: get().call?.id, kind: 'video', enabled: !next });
  },

  // Cámara y pantalla son pistas/streams independientes: compartir pantalla
  // agrega un sender de video nuevo por peer en vez de reemplazar el de la cámara,
  // así se pueden transmitir ambas a la vez.
  toggleScreenShare: async () => {
    if (get().sharingScreen) {
      get()._stopScreenShare();
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = display.getVideoTracks()[0];
      screenStream = display;
      // El usuario corta desde la barra nativa del navegador.
      screenTrack.onended = () => { get()._stopScreenShare(); };
      for (const pc of peers.values()) pc.addTrack(screenTrack, screenStream);
      socket()?.emit('call:media', { callId: get().call?.id, kind: 'screen', enabled: true });
      set({ sharingScreen: true, screenStream: display });
    } catch { /* cancelado */ }
  },

  _stopScreenShare: () => {
    if (!screenStream) { set({ sharingScreen: false, screenStream: null }); return; }
    const track = screenStream.getVideoTracks()[0];
    for (const pc of peers.values()) {
      const sender = pc.getSenders().find((s) => s.track === track);
      if (sender) { try { pc.removeTrack(sender); } catch { /* noop */ } }
    }
    try { track?.stop(); } catch { /* noop */ }
    socket()?.emit('call:media', { callId: get().call?.id, kind: 'screen', enabled: false });
    screenStream = null;
    set({ sharingScreen: false, screenStream: null });
  },

  // ── Helpers de estado ────────────────────────────────────────────────
  _upsertParticipant: (uid, patch) => {
    set((s) => ({
      participants: {
        ...s.participants,
        [uid]: { ...(s.participants[uid] || {}), ...patch, id: uid },
      },
    }));
  },

  _startDurationTimer: () => {
    if (durationTimer) clearInterval(durationTimer);
    durationTimer = setInterval(() => {
      const started = get().startedAt;
      if (started) set({ elapsed: Math.floor((Date.now() - started) / 1000) });
    }, 1000);
  },

  _cleanup: () => {
    if (ringTimer) clearTimeout(ringTimer);
    if (durationTimer) clearInterval(durationTimer);
    ringTimer = null;
    durationTimer = null;
    for (const pc of peers.values()) { try { pc.close(); } catch { /* noop */ } }
    peers.clear();
    pendingIce.clear();
    camStreamIds.clear();
    if (localStream) {
      localStream.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
    }
    localStream = null;
    screenStream = null;
    set({
      participants: {},
      localStream: null,
      screenStream: null,
      micOff: false,
      camOff: false,
      sharingScreen: false,
      startedAt: null,
      elapsed: 0,
    });
  },
}));
