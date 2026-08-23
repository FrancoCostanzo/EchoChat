import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Button, Input, Tabs, Spinner, Modal, Card, InputGroup } from '@heroui/react';
import {
  Compass,
  Hash,
  Search,
  BadgeCheck,
  Users,
  Lock,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { channelsApi } from '@/lib/endpoints';
import { useChatStore } from '@/stores/chatStore';
import UserAvatar from '@/components/UserAvatar';
import { listItemEntry } from '@/lib/motion';
import type { ChannelResponse, JoinRequestResponse } from '@/types/channel';
import type { ApiParams } from '@/lib/api';

type TFunc = ReturnType<typeof useTranslation>['t'];

const CATEGORIES = ['all', 'announcements', 'department', 'project', 'general'];
const MANAGE_ROLES = ['owner', 'admin', 'moderator'];

interface ChannelCardProps {
  channel: ChannelResponse;
  t: TFunc;
  onJoin: (channel: ChannelResponse) => void;
  onRequest: (channel: ChannelResponse) => void;
  onManage: (channel: ChannelResponse) => void;
  onOpen: (channel: ChannelResponse) => void;
  busy: boolean;
}

/* ── Channel card ── */
function ChannelCard({ channel, t, onJoin, onRequest, onManage, onOpen, busy }: ChannelCardProps) {
  const isManager = MANAGE_ROLES.includes(channel.member_role || '');
  const categoryLabel = channel.category
    ? t(`channels.categories.${channel.category}`, channel.category)
    : null;

  const renderAction = () => {
    if (channel.is_member) {
      return (
        <Button size="sm" variant="secondary" onPress={() => onOpen(channel)}>
          {t('channels.open')}
        </Button>
      );
    }
    if (channel.has_pending_request) {
      return (
        <Button size="sm" variant="ghost" isDisabled className="gap-1">
          <Clock size={14} /> {t('channels.requested')}
        </Button>
      );
    }
    if (channel.join_mode === 'invite_only') {
      return (
        <Button size="sm" variant="ghost" isDisabled className="gap-1">
          <Lock size={14} /> {t('channels.inviteOnly')}
        </Button>
      );
    }
    if (channel.join_mode === 'request') {
      return (
        <Button size="sm" variant="secondary" onPress={() => onRequest(channel)}>
          {t('channels.request')}
        </Button>
      );
    }
    return (
      <Button size="sm" isPending={busy} onPress={() => onJoin(channel)}>
        {busy ? t('channels.joining') : t('channels.join')}
      </Button>
    );
  };

  return (
    <Card className="flex w-full flex-col gap-3 p-4 transition-colors hover:border-accent/40">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink-700 text-ink-100">
          <Hash size={20} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[15px] font-semibold">{channel.name}</h3>
            {channel.is_official && (
              <span title={t('channels.official')} className="shrink-0 text-accent">
                <BadgeCheck size={15} />
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-200">
            <span className="flex items-center gap-1">
              <Users size={11} /> {t('channels.members', { count: channel.member_count })}
            </span>
            {categoryLabel && (
              <span className="rounded-full bg-ink-700 px-2 py-0.5 font-medium">{categoryLabel}</span>
            )}
          </div>
        </div>
      </div>

      {channel.description && (
        <p className="line-clamp-2 text-xs text-ink-200">{channel.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2">
        {isManager ? (
          <Button size="sm" variant="ghost" className="gap-1" onPress={() => onManage(channel)}>
            <Users size={14} /> {t('channels.manageRequests')}
          </Button>
        ) : (
          <span />
        )}
        {renderAction()}
      </div>
    </Card>
  );
}

export default function ChannelsExplorePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  const [channels, setChannels] = useState<ChannelResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [requestModal, setRequestModal] = useState<ChannelResponse | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  const [requestsModal, setRequestsModal] = useState<ChannelResponse | null>(null);
  const [requests, setRequests] = useState<JoinRequestResponse[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: ApiParams = {};
      if (search.trim()) params.search = search.trim();
      if (category !== 'all') params.category = category;
      const { data } = await channelsApi.discover(params);
      setChannels(data || []);
    } catch (err) {
      setError((err instanceof Error && err.message) || t('channels.error'));
    } finally {
      setLoading(false);
    }
  }, [search, category, t]);

  useEffect(() => {
    const timeout = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [load, search]);

  const patchChannel = (id: string, patch: Partial<ChannelResponse>) =>
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const handleJoin = async (channel: ChannelResponse) => {
    setJoiningId(channel.id);
    setError('');
    try {
      await channelsApi.join(channel.id);
      patchChannel(channel.id, { is_member: true, member_count: channel.member_count + 1 });
      await fetchConversations();
      await setActiveConversation(channel.id);
      navigate(`/chat/${channel.id}`);
    } catch (err) {
      setError((err instanceof Error && err.message) || t('channels.error'));
    } finally {
      setJoiningId(null);
    }
  };

  const handleOpen = async (channel: ChannelResponse) => {
    await setActiveConversation(channel.id);
    navigate(`/chat/${channel.id}`);
  };

  const handleSendRequest = async () => {
    if (!requestModal) return;
    setSendingRequest(true);
    setError('');
    try {
      await channelsApi.join(requestModal.id, requestMessage.trim() || undefined);
      patchChannel(requestModal.id, { has_pending_request: true });
      setRequestModal(null);
      setRequestMessage('');
    } catch (err) {
      setError((err instanceof Error && err.message) || t('channels.error'));
    } finally {
      setSendingRequest(false);
    }
  };

  const openRequests = async (channel: ChannelResponse) => {
    setRequestsModal(channel);
    setRequestsLoading(true);
    try {
      const { data } = await channelsApi.listRequests(channel.id);
      setRequests(data || []);
    } catch {
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  };

  const reviewRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!requestsModal) return;
    try {
      await channelsApi.reviewRequest(requestsModal.id, requestId, status);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (status === 'approved') {
        patchChannel(requestsModal.id, { member_count: (requestsModal.member_count || 0) + 1 });
      }
    } catch (err) {
      setError((err instanceof Error && err.message) || t('channels.error'));
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-black/20 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Compass size={18} />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">{t('channels.explore')}</h1>
          <p className="truncate text-xs text-ink-200">{t('channels.exploreSubtitle')}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 px-5 pt-4">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 z-1 text-ink-200" />
          <Input
            fullWidth
            className="pl-9"
            placeholder={t('channels.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs selectedKey={category} onSelectionChange={(k) => setCategory(String(k))} className="w-full">
          <Tabs.ListContainer>
            <Tabs.List aria-label={t('channels.categories.all')} className="w-full">
              {CATEGORIES.map((cat) => (
                <Tabs.Tab key={cat} id={cat}>
                  {t(`channels.categories.${cat}`)}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-lg bg-echo-dnd/15 px-3 py-2 text-xs text-echo-dnd">{error}</div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label={t('common.loading')}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-xl border border-white/5 bg-ink-800/50 p-4" style={{ opacity: 1 - i * 0.1 }}>
                <div className="flex items-start gap-3">
                  <div className="echo-shimmer h-11 w-11 shrink-0 rounded-2xl" />
                  <div className="flex flex-1 flex-col gap-2 pt-1">
                    <div className="echo-shimmer h-3.5 w-2/3 rounded-full" />
                    <div className="echo-shimmer h-2.5 w-1/2 rounded-full" />
                  </div>
                </div>
                <div className="echo-shimmer h-2.5 w-full rounded-full" />
                <div className="flex justify-end">
                  <div className="echo-shimmer h-7 w-20 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : channels.length === 0 ? (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22 }}
            className="flex flex-col items-center gap-2 py-16 text-ink-200"
          >
            <Compass size={32} className="opacity-50" />
            <p className="text-sm">{t('channels.empty')}</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {channels.map((channel, i) => (
              <motion.div key={channel.id} {...listItemEntry(i, reducedMotion)} className="flex">
                <ChannelCard
                  channel={channel}
                  t={t}
                  busy={joiningId === channel.id}
                  onJoin={handleJoin}
                  onOpen={handleOpen}
                  onRequest={(c) => { setRequestModal(c); setRequestMessage(''); }}
                  onManage={openRequests}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Request access modal */}
      <Modal isOpen={!!requestModal} onOpenChange={(o) => { if (!o) setRequestModal(null); }}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t('channels.requestTitle')}</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-sm font-medium">{requestModal?.name}</p>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-200">{t('channels.requestMessage')}</label>
                  <InputGroup>
                    <InputGroup.TextArea
                      className="min-h-24"
                      placeholder={t('channels.requestMessagePlaceholder')}
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      maxLength={500}
                    />
                  </InputGroup>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button className="w-full" isPending={sendingRequest} onPress={handleSendRequest}>
                  {t('channels.sendRequest')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Manage requests modal */}
      <Modal isOpen={!!requestsModal} onOpenChange={(o) => { if (!o) setRequestsModal(null); }}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{`${t('channels.pendingRequests')} · ${requestsModal?.name ?? ''}`}</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body>
                {requestsLoading ? (
                  <div className="flex h-24 items-center justify-center">
                    <Spinner />
                  </div>
                ) : requests.length === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-200">{t('channels.noRequests')}</p>
                ) : (
                  <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                    {requests.map((req) => (
                      <div key={req.id} className="flex items-center gap-3 rounded-lg bg-ink-700 p-2">
                        <UserAvatar user={req} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{req.display_name}</p>
                          {req.message && <p className="truncate text-xs text-ink-200">{req.message}</p>}
                        </div>
                        <Button isIconOnly size="sm" variant="ghost" className="text-echo-online"
                          onPress={() => reviewRequest(req.id, 'approved')} aria-label={t('channels.approve')}>
                          <Check size={16} />
                        </Button>
                        <Button isIconOnly size="sm" variant="ghost" className="text-echo-dnd"
                          onPress={() => reviewRequest(req.id, 'rejected')} aria-label={t('channels.reject')}>
                          <X size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
