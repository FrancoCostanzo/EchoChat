import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button, Tabs, Tooltip } from '@heroui/react';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Video,
  Users,
  Hash,
  ArrowLeft,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { callsApi } from '@/lib/endpoints';
import { useAuthStore } from '@/stores/authStore';
import { useCallStore } from '@/stores/callStore';
import UserAvatar from '@/components/UserAvatar';
import { formatFullTime } from '@/lib/dates';

function formatDuration(secs) {
  if (!secs || secs <= 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function CallsEmptyState({ tab, t }) {
  const missed = tab === 'missed';
  const Icon = missed ? PhoneMissed : Phone;
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className="relative flex h-20 w-20 items-center justify-center rounded-3xl echo-grad-brand-soft echo-ring-soft text-accent"
      >
        <Icon size={30} strokeWidth={2} />
      </motion.div>
      <div className="max-w-xs">
        <p className="text-[15px] font-semibold text-foreground">
          {missed ? t('call.page.noMissed') : t('call.page.empty')}
        </p>
        <p className="mt-1 text-[13px] text-ink-200">
          {missed ? t('call.page.noMissedHint') : t('call.page.emptyHint')}
        </p>
      </div>
    </div>
  );
}

function CallSkeleton() {
  return (
    <div className="flex flex-col gap-1 pt-1">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ opacity: 1 - i * 0.12 }}>
          <div className="echo-shimmer h-9 w-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="echo-shimmer h-3 w-32 rounded-full" />
            <div className="echo-shimmer h-2.5 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CallRow({ call, selfId, onOpen, onCallAgain, t }) {
  const isDirect = call.conversation_type === 'direct';
  const isVideo = call.type === 'video';
  const outgoing = call.initiated_by === selfId;
  const missed = call.status === 'missed' || call.status === 'failed';
  const declined = call.status === 'rejected';
  const bad = missed || declined;

  const DirIcon = bad ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
  const duration = formatDuration(call.duration_seconds);
  const name = call.display_name || t('call.page.unknownConversation');

  let outcome;
  if (missed) outcome = outgoing ? t('call.timeline.noAnswer') : t('call.timeline.missed');
  else if (declined) outcome = t('call.timeline.declined');
  else outcome = duration || t('call.history.answered');

  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-ink-750">
      <button
        type="button"
        onClick={() => onOpen(call)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {isDirect ? (
          <UserAvatar user={{ display_name: name, avatar_url: call.avatar_url }} size="sm" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-700 text-ink-100">
            {call.conversation_type === 'channel' ? <Hash size={16} /> : <Users size={16} />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className={`flex items-center gap-1.5 text-xs ${bad ? 'text-echo-dnd' : 'text-ink-200'}`}>
            {isVideo ? <Video size={13} className="shrink-0" /> : <DirIcon size={13} className="shrink-0" />}
            <span className="truncate">{outcome} · {formatFullTime(call.initiated_at)}</span>
          </p>
        </div>
      </button>

      <Tooltip delay={200} placement="top">
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={() => onCallAgain(call)}
          aria-label={t('call.history.callAgain')}
          className="shrink-0 text-accent opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          {isVideo ? <Video size={16} /> : <Phone size={16} />}
        </Button>
        <Tooltip.Content><p>{t('call.history.callAgain')}</p></Tooltip.Content>
      </Tooltip>
    </div>
  );
}

export default function CallsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const self = useAuthStore((s) => s.user);
  const startCall = useCallStore((s) => s.startCall);
  const callStatus = useCallStore((s) => s.status);
  const [tab, setTab] = useState('all');
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await callsApi.getHistory(tab === 'missed' ? { filter: 'missed' } : {});
      setCalls(Array.isArray(data) ? data : []);
    } catch {
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const openConversation = useCallback((call) => {
    if (call.conversation_id) navigate(`/chat/${call.conversation_id}`);
  }, [navigate]);

  const callAgain = useCallback(async (call) => {
    if (!call.conversation_id || callStatus !== 'idle') return;
    try {
      await startCall({
        conversationId: call.conversation_id,
        type: call.type === 'video' ? 'video' : 'voice',
        isGroup: call.conversation_type !== 'direct',
        conversationName: call.display_name,
        self,
      });
    } catch { /* el overlay/store maneja el error */ }
  }, [startCall, callStatus, self]);

  return (
    <div className="flex h-full flex-col">
      {/* Header — consistent with Contacts / Saved pages */}
      <div className="flex items-center gap-3 border-b border-black/20 px-5 py-4">
        <Button isIconOnly size="sm" variant="ghost" className="md:hidden shrink-0" onPress={() => navigate('/chat')}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Phone size={18} />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">{t('call.page.title')}</h1>
          <p className="truncate text-xs text-ink-200">{t('call.page.subtitle')}</p>
        </div>
      </div>

      <div className="px-4 py-3">
        <Tabs selectedKey={tab} onSelectionChange={setTab}>
          <Tabs.ListContainer>
            <Tabs.List aria-label={t('call.page.title')} className="w-fit">
              <Tabs.Tab id="all">{t('call.page.all')}<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="missed">{t('call.page.missed')}<Tabs.Indicator /></Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <CallSkeleton />
        ) : calls.length === 0 ? (
          <CallsEmptyState tab={tab} t={t} />
        ) : (
          calls.map((call) => (
            <CallRow
              key={call.id}
              call={call}
              selfId={self?.id}
              onOpen={openConversation}
              onCallAgain={callAgain}
              t={t}
            />
          ))
        )}
      </div>
    </div>
  );
}
