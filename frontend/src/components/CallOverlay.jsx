import { useEffect, useRef, useMemo } from 'react';
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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import UserAvatar from '@/components/UserAvatar';

/* Attaches a MediaStream to a <video> element (streams can't be passed as props). */
function VideoTile({ stream, muted = false, mirror = false, camOff, name, avatar, speakingLabel }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream && stream.getVideoTracks().length > 0 && !camOff;

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-ink-900 ring-1 ring-white/10">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={[
          'h-full w-full object-cover transition-opacity duration-300',
          hasVideo ? 'opacity-100' : 'opacity-0',
          mirror ? '-scale-x-100' : '',
        ].join(' ')}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 echo-grad-brand-soft">
          <UserAvatar user={{ display_name: name, avatar_url: avatar }} size="lg" />
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
    status, call, participants, localStream, micOff, camOff, sharingScreen, elapsed,
    toggleMute, toggleCamera, toggleScreenShare, hangup,
  } = useCallStore();

  const remote = useMemo(() => Object.values(participants), [participants]);
  const isVideo = call?.type === 'video';

  // Grid columns scale with participant count (self + remotes).
  const tileCount = remote.length + 1;
  const cols = tileCount <= 1 ? 1 : tileCount <= 4 ? 2 : 3;

  const subtitle = status === 'outgoing'
    ? t('call.calling')
    : remote.length === 0
      ? t('call.connecting')
      : formatDuration(elapsed);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto flex h-[min(88vh,44rem)] w-[min(92vw,60rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900/95 shadow-2xl backdrop-blur-2xl"
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
      </div>

      {/* Tiles */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div
          className="grid h-full gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {/* Self */}
          <VideoTile
            stream={localStream}
            muted
            mirror={!sharingScreen}
            camOff={camOff}
            name={`${self?.display_name || ''} (${t('call.you')})`}
            avatar={self?.avatar_url}
            speakingLabel={micOff ? <MicOff size={12} className="text-echo-dnd" /> : null}
          />
          {/* Remotes */}
          {remote.map((p) => (
            <VideoTile
              key={p.id}
              stream={p.stream}
              camOff={p.camOff}
              name={p.displayName || t('call.participant')}
              avatar={p.avatar_url}
              speakingLabel={p.micOff ? <MicOff size={12} className="text-echo-dnd" /> : null}
            />
          ))}
        </div>
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
