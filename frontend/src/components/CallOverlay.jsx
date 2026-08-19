import { useEffect, useRef, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@heroui/react';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  MonitorOff,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import UserAvatar from '@/components/UserAvatar';

/* Attaches a MediaStream to a <video> element (streams can't be passed as props). */
function VideoTile({
  camStream, screenStream, muted = false, isSelf = false, camOff, name, avatar, speakingLabel, onClick,
}) {
  const mainRef = useRef(null);
  const bubbleRef = useRef(null);
  const sharingHere = !!screenStream;
  const mainStream = sharingHere ? screenStream : camStream;

  useEffect(() => {
    if (mainRef.current) mainRef.current.srcObject = mainStream || null;
  }, [mainStream]);

  useEffect(() => {
    if (bubbleRef.current) bubbleRef.current.srcObject = sharingHere ? camStream || null : null;
  }, [sharingHere, camStream]);

  const hasMainVideo = mainStream && mainStream.getVideoTracks().length > 0 && (sharingHere || !camOff);
  const hasBubbleVideo = sharingHere && camStream && camStream.getVideoTracks().length > 0 && !camOff;

  return (
    <div
      onClick={onClick}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-ink-900 ring-1 ring-white/10 cursor-pointer"
    >
      <video
        ref={mainRef}
        autoPlay
        playsInline
        muted={muted}
        className={[
          'h-full w-full transition-opacity duration-300',
          hasMainVideo ? 'opacity-100' : 'opacity-0',
          sharingHere ? 'object-contain bg-black' : 'object-cover',
          !sharingHere && isSelf ? '-scale-x-100' : '',
        ].join(' ')}
      />
      {!hasMainVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 echo-grad-brand-soft">
          <UserAvatar user={{ display_name: name, avatar_url: avatar }} size="lg" />
        </div>
      )}
      {hasBubbleVideo && (
        <div className="absolute bottom-3 right-3 h-16 w-24 overflow-hidden rounded-lg shadow-lg ring-2 ring-white/25 sm:h-20 sm:w-32">
          <video
            ref={bubbleRef}
            autoPlay
            playsInline
            muted
            className={['h-full w-full object-cover', isSelf ? '-scale-x-100' : ''].join(' ')}
          />
        </div>
      )}
      {/* Name tag */}
      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur-sm">
        {speakingLabel}
        <span className="truncate max-w-[9rem]">{name}</span>
      </div>
    </div>
  );
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ── Incoming call prompt ─────────────────────────────────────────────── */
function IncomingCall() {
  const { t } = useTranslation();
  const incoming = useCallStore((s) => s.incoming);
  const accept = useCallStore((s) => s.acceptCall);
  const reject = useCallStore((s) => s.rejectCall);

  if (!incoming) return null;
  const from = incoming.from || {};
  const isVideo = incoming.type === 'video';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="pointer-events-auto w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-white/10 bg-ink-850/95 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-8">
        <div className="relative">
          <span className="absolute -inset-3 animate-ping rounded-full bg-accent/25" />
          <UserAvatar user={{ display_name: from.display_name, avatar_url: from.avatar_url }} size="lg" />
        </div>
        <div className="text-center">
          <p className="echo-display text-xl font-semibold">{from.display_name || t('call.unknown')}</p>
          <p className="mt-0.5 flex items-center justify-center gap-1.5 text-sm text-ink-100">
            {isVideo ? <Video size={14} /> : <PhoneIncoming size={14} />}
            {isVideo ? t('call.incomingVideo') : t('call.incomingVoice')}
          </p>
        </div>

        <div className="mt-2 flex w-full items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-1.5">
            <Button
              isIconOnly
              onPress={reject}
              className="h-14 w-14 rounded-full bg-echo-dnd text-white shadow-lg transition-transform hover:scale-105"
              aria-label={t('call.decline')}
            >
              <PhoneOff size={22} />
            </Button>
            <span className="text-[11px] text-ink-200">{t('call.decline')}</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Button
              isIconOnly
              onPress={accept}
              className="h-14 w-14 rounded-full bg-success text-white shadow-lg transition-transform hover:scale-105"
              aria-label={t('call.accept')}
            >
              <Phone size={22} />
            </Button>
            <span className="text-[11px] text-ink-200">{t('call.accept')}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Active / outgoing call window ────────────────────────────────────── */
function ActiveCall() {
  const { t } = useTranslation();
  const self = useAuthStore((s) => s.user);
  const {
    status, call, participants, localStream, screenStream, micOff, camOff, sharingScreen, elapsed,
    toggleMute, toggleCamera, toggleScreenShare, hangup,
  } = useCallStore();

  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pinnedId, setPinnedId] = useState(null);
  const prevSharerId = useRef(null);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen();
  };

  const remote = useMemo(() => Object.values(participants), [participants]);
  const isVideo = call?.type === 'video';

  // Self + remotos como una sola lista de tiles (cada uno con cámara y/o pantalla).
  const tiles = useMemo(() => ([
    {
      id: '__self__',
      isSelf: true,
      camStream: localStream,
      screenStream,
      camOff,
      name: `${self?.display_name || ''} (${t('call.you')})`,
      avatar: self?.avatar_url,
      speakingLabel: micOff ? <MicOff size={12} className="text-echo-dnd" /> : null,
    },
    ...remote.map((p) => ({
      id: p.id,
      isSelf: false,
      camStream: p.stream,
      screenStream: p.screenStream,
      camOff: p.camOff,
      name: p.displayName || t('call.participant'),
      avatar: p.avatar_url,
      speakingLabel: p.micOff ? <MicOff size={12} className="text-echo-dnd" /> : null,
    })),
  ]), [remote, localStream, screenStream, camOff, micOff, self, t]);

  // Grid columns scale with participant count (self + remotes).
  const cols = tiles.length <= 1 ? 1 : tiles.length <= 4 ? 2 : 3;

  // Foco automático sobre quien empieza a compartir pantalla (sin pelear con un
  // "despinado" manual mientras esa misma persona sigue compartiendo).
  const sharerId = tiles.find((tl) => !!tl.screenStream)?.id || null;
  useEffect(() => {
    if (sharerId && sharerId !== prevSharerId.current) setPinnedId(sharerId);
    prevSharerId.current = sharerId;
  }, [sharerId]);

  // Si el tile pineado se va de la llamada, volver a la grilla.
  useEffect(() => {
    if (pinnedId && !tiles.some((tl) => tl.id === pinnedId)) setPinnedId(null);
  }, [pinnedId, tiles]);

  const pinned = pinnedId ? tiles.find((tl) => tl.id === pinnedId) : null;

  const subtitle = status === 'outgoing'
    ? t('call.calling')
    : remote.length === 0
      ? t('call.connecting')
      : formatDuration(elapsed);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={[
        'pointer-events-auto flex flex-col overflow-hidden bg-ink-900/95 shadow-2xl backdrop-blur-2xl',
        isFullscreen
          ? 'h-screen w-screen rounded-none border-0'
          : 'h-[min(88vh,44rem)] w-[min(92vw,60rem)] rounded-3xl border border-white/10',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-5 py-3">
        <div className="min-w-0">
          <p className="echo-display truncate text-lg font-semibold">
            {call?.conversationName || t('call.title')}
          </p>
          <p className="flex items-center gap-1.5 text-[13px] text-ink-100">
            {isVideo ? <Video size={13} /> : <Phone size={13} />}
            {subtitle}
          </p>
        </div>
        <Button
          isIconOnly
          variant="light"
          onPress={toggleFullscreen}
          aria-label={isFullscreen ? t('call.exitFullscreen') : t('call.fullscreen')}
          title={isFullscreen ? t('call.exitFullscreen') : t('call.fullscreen')}
          className="h-9 w-9 shrink-0 rounded-full text-ink-100 hover:bg-white/10"
        >
          {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </Button>
      </div>

      {/* Tiles */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {pinned ? (
          <div className="flex h-full flex-col gap-3">
            <div className="min-h-0 flex-1">
              <VideoTile {...pinned} muted={pinned.isSelf} onClick={() => setPinnedId(null)} />
            </div>
            {tiles.length > 1 && (
              <div className="flex shrink-0 gap-2 overflow-x-auto">
                {tiles.filter((tl) => tl.id !== pinnedId).map((tl) => (
                  <div key={tl.id} className="h-20 w-32 shrink-0">
                    <VideoTile {...tl} muted={tl.isSelf} onClick={() => setPinnedId(tl.id)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="grid h-full gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {tiles.map((tl) => (
              <VideoTile key={tl.id} {...tl} muted={tl.isSelf} onClick={() => setPinnedId(tl.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/8 px-5 py-4">
        <ControlButton
          active={!micOff}
          onPress={toggleMute}
          on={<Mic size={20} />}
          off={<MicOff size={20} />}
          label={micOff ? t('call.unmute') : t('call.mute')}
        />
        <ControlButton
          active={!camOff}
          onPress={toggleCamera}
          on={<Video size={20} />}
          off={<VideoOff size={20} />}
          label={camOff ? t('call.cameraOn') : t('call.cameraOff')}
        />
        <ControlButton
          active={sharingScreen}
          onPress={toggleScreenShare}
          on={<MonitorOff size={20} />}
          off={<MonitorUp size={20} />}
          label={sharingScreen ? t('call.stopShare') : t('call.share')}
          highlightWhenActive
        />
        <Button
          isIconOnly
          onPress={() => hangup('hangup')}
          className="h-12 w-16 rounded-full bg-echo-dnd text-white shadow-lg transition-transform hover:scale-105"
          aria-label={t('call.hangup')}
        >
          <PhoneOff size={22} />
        </Button>
      </div>
    </motion.div>
  );
}

function ControlButton({ active, onPress, on, off, label, highlightWhenActive = false }) {
  const lit = highlightWhenActive ? active : !active;
  return (
    <Button
      isIconOnly
      onPress={onPress}
      aria-label={label}
      className={[
        'h-12 w-12 rounded-full shadow-md transition-transform hover:scale-105',
        lit && highlightWhenActive
          ? 'bg-accent text-white'
          : active
            ? 'bg-ink-700 text-foreground hover:bg-ink-600'
            : 'bg-ink-600 text-ink-100',
      ].join(' ')}
    >
      {active ? on : off}
    </Button>
  );
}

export default function CallOverlay() {
  const status = useCallStore((s) => s.status);
  if (status === 'idle') return null;

  const overlay = (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        {status === 'incoming' ? (
          <IncomingCall key="incoming" />
        ) : (
          <ActiveCall key="active" />
        )}
      </AnimatePresence>
    </div>
  );

  return createPortal(overlay, document.body);
}
