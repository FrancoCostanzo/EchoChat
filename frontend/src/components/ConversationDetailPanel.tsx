import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Users, Hash, X, Pencil, Check, Camera, Trash2,
  Image as ImageIcon, FileText, Link2, Play, Download, Loader,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Chip, InputGroup, Input, TextArea, ScrollShadow, Tooltip, Tabs, toast } from '@heroui/react';
import type { ReactNode } from 'react';
import UserAvatar from '@/components/UserAvatar';
import ImageViewer from '@/components/ImageViewer';
import VideoViewer from '@/components/VideoViewer';
import { useAuthStore } from '@/stores/authStore';
import { useStorageUrl } from '@/lib/useStorageUrl';
import { messagesApi } from '@/lib/endpoints';
import { formatMessageTime } from '@/lib/dates';
import type { MemberResponse, ConversationResponse } from '@/types/conversation';
import type { ConversationAttachmentItem, ConversationLinkItem } from '@/types/message';

export type DetailTab = 'info' | 'members' | 'media' | 'files' | 'links';

const ACTIVE_PRESENCES = new Set(['online', 'away', 'busy', 'dnd']);
const PRESENCE_RANK: Record<string, number> = { online: 0, away: 1, busy: 2, dnd: 3 };
const ROLE_I18N: Record<string, string> = {
  owner: 'chat.roleOwner',
  admin: 'chat.roleAdmin',
  moderator: 'chat.roleModerator',
};
const ROLE_COLOR: Record<string, 'success' | 'accent' | 'default' | 'warning' | 'danger'> = {
  owner: 'warning',
  admin: 'accent',
  moderator: 'default',
};
const SEARCH_THRESHOLD = 6;
const PAGE_SIZE = 30;

function memberName(member: MemberResponse): string {
  return member.display_name || member.username || '?';
}

function compareMembers(a: MemberResponse, b: MemberResponse): number {
  const aActive = ACTIVE_PRESENCES.has(a.presence || 'offline');
  const bActive = ACTIVE_PRESENCES.has(b.presence || 'offline');
  if (aActive !== bActive) return aActive ? -1 : 1;
  const rank = (PRESENCE_RANK[a.presence || ''] ?? 9) - (PRESENCE_RANK[b.presence || ''] ?? 9);
  if (rank) return rank;
  return memberName(a).localeCompare(memberName(b), undefined, { sensitivity: 'base' });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadBlob(url: string, filename: string | null | undefined) {
  fetch(url)
    .then((r) => r.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'file';
      a.click();
      URL.revokeObjectURL(blobUrl);
    })
    .catch(() => window.open(url, '_blank'));
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function SectionLabel({ children, count }: { children: ReactNode; count: number }) {
  return (
    <p className="px-2 pb-1 pt-3 first:pt-1 text-[10px] font-semibold uppercase tracking-widest text-ink-300 select-none">
      {children}
      <span className="ml-1 tabular-nums text-ink-400">· {count}</span>
    </p>
  );
}

/* ─────────────────────────── Members tab ─────────────────────────── */
function MemberRow({ member, isMe }: { member: MemberResponse; isMe: boolean }) {
  const { t } = useTranslation();
  const name = memberName(member);
  const presence = member.presence || 'offline';
  const roleKey = ROLE_I18N[member.role];

  return (
    <div
      className={[
        'flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors',
        isMe ? 'bg-accent/10' : 'hover:bg-ink-750',
      ].join(' ')}
    >
      <UserAvatar
        user={{ display_name: name, presence, avatar_url: member.avatar_url }}
        size="sm"
        showStatus
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{name}</p>
          {isMe && (
            <Chip size="sm" variant="soft" className="h-4 min-h-0 shrink-0 px-1.5 text-[10px]">
              {t('common.you')}
            </Chip>
          )}
        </div>
        <p className="truncate text-[11px] text-ink-300">
          {t(`settings.presenceOptions.${presence}`, presence)}
        </p>
      </div>
      {roleKey && (
        <Chip size="sm" variant="soft" color={ROLE_COLOR[member.role]} className="h-5 min-h-0 shrink-0">
          {t(roleKey)}
        </Chip>
      )}
    </div>
  );
}

function MembersTab({ members, loading }: { members: MemberResponse[]; loading: boolean }) {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => [...members].sort(compareMembers), [members]);
  const { active, offline, onlineCount } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? sorted.filter((m) => memberName(m).toLowerCase().includes(q) || (m.username || '').toLowerCase().includes(q))
      : sorted;
    return {
      active: filtered.filter((m) => ACTIVE_PRESENCES.has(m.presence || 'offline')),
      offline: filtered.filter((m) => !ACTIVE_PRESENCES.has(m.presence || 'offline')),
      onlineCount: members.filter((m) => m.presence === 'online').length,
    };
  }, [sorted, members, query]);

  const showSearch = members.length >= SEARCH_THRESHOLD;
  const isMe = (member: MemberResponse) => member.user_id === currentUser?.id;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-3 pb-1 pt-2.5">
        <p className="text-[11px] text-ink-300">
          {members.length} {t('chat.members')}
          {onlineCount > 0 && (
            <>
              {' · '}
              <span className="font-medium text-success">
                {t('chat.membersOnlineCount', { count: onlineCount })}
              </span>
            </>
          )}
        </p>
      </div>

      {showSearch && (
        <div className="shrink-0 px-2.5 pb-2">
          <InputGroup variant="secondary" className="bg-ink-900">
            <InputGroup.Prefix>
              <Search size={14} className="text-ink-200" />
            </InputGroup.Prefix>
            <InputGroup.Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('chat.searchMembers')}
              aria-label={t('chat.searchMembers')}
            />
            {query && (
              <InputGroup.Suffix>
                <Button
                  isIconOnly
                  variant="ghost"
                  onPress={() => setQuery('')}
                  className="flex h-auto w-auto min-w-0 items-center p-0 text-ink-200 hover:bg-transparent hover:text-foreground"
                  aria-label={t('common.clear')}
                >
                  <X size={13} />
                </Button>
              </InputGroup.Suffix>
            )}
          </InputGroup>
        </div>
      )}

      <ScrollShadow className="min-h-0 flex-1 px-1.5 pb-2">
        {loading && members.length === 0 && (
          <div className="flex flex-col gap-2 px-1 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                <div className="echo-shimmer h-8 w-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="echo-shimmer h-3 w-24 rounded-full" />
                  <div className="echo-shimmer h-2.5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && active.length === 0 && offline.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-ink-200">
            <Users size={22} className="opacity-40" />
            <p className="text-[13px]">{query ? t('chat.noMemberResults') : t('chat.emptyMembers')}</p>
          </div>
        )}

        {active.length > 0 && (
          <>
            <SectionLabel count={active.length}>{t('chat.membersActive')}</SectionLabel>
            {active.map((member) => (
              <MemberRow key={member.user_id || member.id} member={member} isMe={isMe(member)} />
            ))}
          </>
        )}
        {offline.length > 0 && (
          <>
            <SectionLabel count={offline.length}>{t('chat.membersOffline')}</SectionLabel>
            {offline.map((member) => (
              <MemberRow key={member.user_id || member.id} member={member} isMe={isMe(member)} />
            ))}
          </>
        )}
      </ScrollShadow>
    </div>
  );
}

/* ─────────────────────────── Info tab ─────────────────────────── */
function BigAvatar({
  conversation, isDirect, canEdit, onPick, onRemove,
}: {
  conversation: ConversationResponse;
  isDirect: boolean;
  canEdit: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const isGroup = conversation.type === 'group';
  const photoUrl = isDirect ? conversation.other_avatar_url : conversation.avatar_url;
  const label = (isDirect ? conversation.display_name : conversation.name) || '?';
  const initials = label.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="relative mx-auto h-20 w-20 shrink-0">
      {photoUrl ? (
        <img src={photoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
      ) : isDirect ? (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ink-600 text-xl font-semibold text-ink-50">
          {initials}
        </div>
      ) : (
        <div className="echo-grad-brand echo-glow-md echo-on-accent flex h-20 w-20 items-center justify-center rounded-full">
          {isGroup ? <Users size={32} strokeWidth={1.8} /> : <Hash size={32} strokeWidth={1.8} />}
        </div>
      )}
      {canEdit && (
        <Tooltip delay={0}>
          <Button
            isIconOnly
            variant="ghost"
            onPress={onPick}
            aria-label={t('chat.changeGroupPhoto')}
            className="absolute inset-0 h-20 w-20 min-w-0 rounded-full bg-black/0 text-transparent transition-colors hover:bg-black/45 hover:text-white"
          >
            <Camera size={20} />
          </Button>
          <Tooltip.Content>{t('chat.changeGroupPhoto')}</Tooltip.Content>
        </Tooltip>
      )}
      {canEdit && photoUrl && (
        <Tooltip delay={0}>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={onRemove}
            aria-label={t('chat.removeGroupPhoto')}
            className="absolute -bottom-1 -right-1 h-7 w-7 min-w-0 rounded-full bg-ink-800 text-ink-100 ring-1 ring-divider hover:bg-danger/20 hover:text-danger"
          >
            <Trash2 size={13} />
          </Button>
          <Tooltip.Content>{t('chat.removeGroupPhoto')}</Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
}

function EditableName({ value, canEdit, onSave }: { value: string; canEdit: boolean; onSave: (v: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  if (!canEdit) {
    return <h3 className="echo-display truncate text-xl font-semibold">{value}</h3>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={t('chat.editName')}
        className="group -mx-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-ink-750"
      >
        <h3 className="echo-display truncate text-xl font-semibold">{value}</h3>
        <Pencil size={13} className="shrink-0 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }

  const commit = async () => {
    const next = draft.trim();
    if (!next || next === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      // El toast de error ya lo muestra el caller; nos quedamos en edición para reintentar.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') setEditing(false); }}
        disabled={saving}
        maxLength={200}
        className="h-8 flex-1 text-[15px]"
      />
      <Button isIconOnly size="sm" variant="ghost" isDisabled={saving} onPress={commit} className="h-8 w-8 min-w-0 shrink-0 text-success">
        {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
      </Button>
      <Button isIconOnly size="sm" variant="ghost" isDisabled={saving} onPress={() => setEditing(false)} className="h-8 w-8 min-w-0 shrink-0 text-ink-200">
        <X size={14} />
      </Button>
    </div>
  );
}

function EditableDescription({ value, canEdit, onSave }: { value: string | null; canEdit: boolean; onSave: (v: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!editing) setDraft(value || ''); }, [value, editing]);

  if (!canEdit && !value) return null;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => canEdit && setEditing(true)}
        disabled={!canEdit}
        aria-label={t('chat.editDescription')}
        className={[
          'group flex w-full items-start gap-1.5 rounded-lg px-2 py-1.5 text-left',
          canEdit ? 'hover:bg-ink-750' : 'cursor-default',
        ].join(' ')}
      >
        <p className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed ${value ? 'text-ink-100' : 'text-ink-300 italic'}`}>
          {value || t('chat.noDescription')}
        </p>
        {canEdit && (
          <Pencil size={13} className="mt-0.5 shrink-0 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </button>
    );
  }

  const commit = async () => {
    const next = draft.trim();
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      // El toast de error ya lo muestra el caller; nos quedamos en edición para reintentar.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-2">
      <TextArea
        autoFocus
        variant="secondary"
        rows={3}
        fullWidth
        maxLength={500}
        placeholder={t('chat.descriptionPlaceholder')}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={saving}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
      />
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" isDisabled={saving} onPress={() => setEditing(false)}>
          {t('common.cancel')}
        </Button>
        <Button size="sm" isDisabled={saving} onPress={commit} className="bg-accent text-accent-foreground">
          {saving ? <Loader size={14} className="animate-spin" /> : t('common.save')}
        </Button>
      </div>
    </div>
  );
}

function InfoTab({
  conversation, isDirect, canEditGroup, onPickAvatar, onRemoveAvatar, onUpdateInfo,
}: {
  conversation: ConversationResponse;
  isDirect: boolean;
  canEditGroup: boolean;
  onPickAvatar: () => void;
  onRemoveAvatar: () => void;
  onUpdateInfo: (patch: { name?: string; description?: string | null }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const title = (isDirect ? conversation.display_name : conversation.name) || t('chat.conversation');

  return (
    <ScrollShadow className="min-h-0 flex-1">
      <div className="flex flex-col items-center gap-3 px-4 pb-2 pt-5 text-center">
        <BigAvatar conversation={conversation} isDirect={isDirect} canEdit={canEditGroup} onPick={onPickAvatar} onRemove={onRemoveAvatar} />
        {isDirect ? (
          <div>
            <h3 className="echo-display text-xl font-semibold">{title}</h3>
            {conversation.other_username && (
              <p className="text-[13px] text-ink-300">@{conversation.other_username}</p>
            )}
            {conversation.member_presence && (
              <p className="mt-0.5 text-[12px] capitalize text-ink-200">
                {t(`settings.presenceOptions.${conversation.member_presence}`, conversation.member_presence)}
              </p>
            )}
            {conversation.member_presence_message && (
              <p className="mt-1 max-w-xs text-[12px] italic text-ink-300">{conversation.member_presence_message}</p>
            )}
          </div>
        ) : (
          <EditableName value={title} canEdit={canEditGroup} onSave={(name) => onUpdateInfo({ name })} />
        )}
      </div>

      {!isDirect && (
        <div className="px-2 pb-3">
          <EditableDescription
            value={conversation.description}
            canEdit={canEditGroup}
            onSave={(description) => onUpdateInfo({ description })}
          />
        </div>
      )}
    </ScrollShadow>
  );
}

/* ─────────────────────── Media / Files / Links tabs ─────────────────────── */
type ListKind = 'media' | 'files' | 'links';

function fetchListPage(kind: ListKind, conversationId: string, limit: number, offset: number) {
  if (kind === 'media') return messagesApi.getMedia(conversationId, limit, offset).then((r) => r.data);
  if (kind === 'files') return messagesApi.getFiles(conversationId, limit, offset).then((r) => r.data);
  return messagesApi.getLinks(conversationId, limit, offset).then((r) => r.data);
}

function useDetailList<T>(kind: ListKind, conversationId: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchListPage(kind, conversationId, PAGE_SIZE, 0)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows as T[]);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch(() => { if (!cancelled) { setItems([]); setHasMore(false); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind, conversationId]);

  const loadMore = useCallback(() => {
    setLoading(true);
    fetchListPage(kind, conversationId, PAGE_SIZE, items.length)
      .then((rows) => {
        setItems((prev) => [...prev, ...(rows as T[])]);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoading(false));
  }, [kind, conversationId, items.length]);

  return { items, loading, hasMore, loadMore };
}

function EmptyList({ icon: Icon, label }: { icon: typeof ImageIcon; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-ink-200">
      <Icon size={22} className="opacity-40" />
      <p className="text-[13px]">{label}</p>
    </div>
  );
}

function LoadMoreButton({ loading, onLoadMore }: { loading: boolean; onLoadMore: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-center py-2">
      <Button
        variant="ghost"
        onPress={onLoadMore}
        isDisabled={loading}
        className="h-auto rounded-md border border-ink-400/40 bg-ink-800 px-3 py-1 text-xs text-ink-100 hover:bg-ink-750 hover:text-foreground"
      >
        {loading ? <Loader size={12} className="animate-spin" /> : t('chat.loadMoreGeneric')}
      </Button>
    </div>
  );
}

function MediaGridItem({ item }: { item: ConversationAttachmentItem }) {
  const url = useStorageUrl(item.id);
  const isVideo = item.object_type === 'video';
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!url}
        className="group relative aspect-square overflow-hidden rounded-lg bg-ink-800"
      >
        {!url && <div className="echo-shimmer absolute inset-0" />}
        {url && (isVideo ? (
          <video src={url} className="h-full w-full object-cover" muted preload="metadata" />
        ) : (
          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ))}
        {url && isVideo && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
            <Play size={16} className="text-white drop-shadow" fill="currentColor" />
          </span>
        )}
      </button>
      {open && url && (isVideo ? (
        <VideoViewer src={url} filename={item.original_filename ?? undefined} onClose={() => setOpen(false)} />
      ) : (
        <ImageViewer src={url} filename={item.original_filename ?? undefined} onClose={() => setOpen(false)} />
      ))}
    </>
  );
}

function MediaTab({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation();
  const { items, loading, hasMore, loadMore } = useDetailList<ConversationAttachmentItem>('media', conversationId);

  return (
    <ScrollShadow className="min-h-0 flex-1 p-2">
      {loading && items.length === 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="echo-shimmer aspect-square rounded-lg" />)}
        </div>
      )}
      {!loading && items.length === 0 && <EmptyList icon={ImageIcon} label={t('chat.emptyMedia')} />}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((item) => <MediaGridItem key={item.id} item={item} />)}
        </div>
      )}
      {hasMore && items.length > 0 && <LoadMoreButton loading={loading} onLoadMore={loadMore} />}
    </ScrollShadow>
  );
}

function FileRow({ item, onJump }: { item: ConversationAttachmentItem; onJump: (id: string) => void }) {
  const { t } = useTranslation();
  const url = useStorageUrl(item.id);

  return (
    <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-ink-750">
      <button type="button" onClick={() => onJump(item.message_id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15">
          <FileText size={16} className="echo-accent-fg" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">{item.original_filename || '—'}</p>
          <p className="truncate text-[11px] text-ink-300">{formatSize(item.file_size_bytes)} · {formatMessageTime(item.sent_at)}</p>
        </div>
      </button>
      {url && (
        <Tooltip delay={0}>
          <Button
            isIconOnly
            variant="ghost"
            onPress={() => downloadBlob(url, item.original_filename)}
            className="h-8 w-8 min-w-0 shrink-0 text-ink-200 hover:text-foreground"
          >
            <Download size={14} />
          </Button>
          <Tooltip.Content>{t('common.download')}</Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
}

function FilesTab({ conversationId, onJump }: { conversationId: string; onJump: (id: string) => void }) {
  const { t } = useTranslation();
  const { items, loading, hasMore, loadMore } = useDetailList<ConversationAttachmentItem>('files', conversationId);

  return (
    <ScrollShadow className="min-h-0 flex-1 px-1.5 pb-2 pt-1.5">
      {loading && items.length === 0 && (
        <div className="flex flex-col gap-2 px-1">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="echo-shimmer h-12 rounded-xl" />)}
        </div>
      )}
      {!loading && items.length === 0 && <EmptyList icon={FileText} label={t('chat.emptyFiles')} />}
      {items.map((item) => <FileRow key={item.id} item={item} onJump={onJump} />)}
      {hasMore && items.length > 0 && <LoadMoreButton loading={loading} onLoadMore={loadMore} />}
    </ScrollShadow>
  );
}

function LinkRow({ item, onJump }: { item: ConversationLinkItem; onJump: (id: string) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onJump(item.message_id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onJump(item.message_id); }}
      className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-ink-750"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15">
        <Link2 size={16} className="echo-accent-fg" />
      </div>
      <div className="min-w-0 flex-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block truncate text-[13px] font-medium text-accent hover:underline"
        >
          {domainOf(item.url)}
        </a>
        <p className="truncate text-[11px] text-ink-300">{item.url}</p>
      </div>
      <span className="shrink-0 text-[11px] text-ink-300">{formatMessageTime(item.sent_at)}</span>
    </div>
  );
}

function LinksTab({ conversationId, onJump }: { conversationId: string; onJump: (id: string) => void }) {
  const { t } = useTranslation();
  const { items, loading, hasMore, loadMore } = useDetailList<ConversationLinkItem>('links', conversationId);

  return (
    <ScrollShadow className="min-h-0 flex-1 px-1.5 pb-2 pt-1.5">
      {loading && items.length === 0 && (
        <div className="flex flex-col gap-2 px-1">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="echo-shimmer h-12 rounded-xl" />)}
        </div>
      )}
      {!loading && items.length === 0 && <EmptyList icon={Link2} label={t('chat.emptyLinks')} />}
      {items.map((item, i) => <LinkRow key={`${item.message_id}-${i}`} item={item} onJump={onJump} />)}
      {hasMore && items.length > 0 && <LoadMoreButton loading={loading} onLoadMore={loadMore} />}
    </ScrollShadow>
  );
}

/* ─────────────────────────── Root component ─────────────────────────── */
interface ConversationDetailPanelProps {
  conversation: ConversationResponse | null;
  conversationId: string;
  isDirect: boolean;
  canEditGroup: boolean;
  members?: MemberResponse[];
  loading?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onJump: (messageId: string) => void;
  onPickAvatar: () => void;
  onRemoveAvatar: () => void;
  onUpdateInfo: (patch: { name?: string; description?: string | null }) => Promise<void>;
  className?: string;
}

export default function ConversationDetailPanel({
  conversation,
  conversationId,
  isDirect,
  canEditGroup,
  members = [],
  loading = false,
  open = false,
  onOpenChange,
  activeTab,
  onTabChange,
  onJump,
  onPickAvatar,
  onRemoveAvatar,
  onUpdateInfo,
  className = '',
}: ConversationDetailPanelProps) {
  const { t } = useTranslation();
  const onlineCount = members.filter((m) => m.presence === 'online').length;
  const visible = useMemo(() => [...members].sort(compareMembers).slice(0, 10), [members]);
  const overflowCount = Math.max(0, members.length - visible.length);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onOpenChange?.(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!conversation) return null;

  // Collapsed rail — full-height opaque strip, top slot aligned with the chat header
  if (!open) {
    return (
      <aside
        className={[
          'echo-sidebar-bg hidden h-full w-14 shrink-0 flex-col items-center border-l border-divider lg:flex',
          className,
        ].filter(Boolean).join(' ')}
      >
        <div className="flex h-12 w-full shrink-0 items-center justify-center border-b border-white/8">
          <Tooltip>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => { onTabChange(isDirect ? 'info' : 'members'); onOpenChange?.(true); }}
              aria-label={t('chat.detailTitle')}
              className="h-8 w-8 min-w-0 rounded-lg text-ink-200 hover:bg-ink-750 hover:text-foreground"
            >
              <Users size={16} />
            </Button>
            <Tooltip.Content placement="left">
              <p>{t('chat.detailTitle')}</p>
            </Tooltip.Content>
          </Tooltip>
        </div>

        {!isDirect && (
          <ScrollShadow hideScrollBar className="flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 py-2">
            {visible.map((member) => {
              const name = memberName(member);
              const presence = member.presence || 'offline';
              return (
                <Tooltip key={member.user_id || member.id}>
                  <button
                    type="button"
                    onClick={() => { onTabChange('members'); onOpenChange?.(true); }}
                    className="echo-press rounded-full"
                    aria-label={name}
                  >
                    <UserAvatar user={{ display_name: name, presence, avatar_url: member.avatar_url }} size="sm" showStatus />
                  </button>
                  <Tooltip.Content placement="left">
                    <p>{name} · {t(`settings.presenceOptions.${presence}`, presence)}</p>
                  </Tooltip.Content>
                </Tooltip>
              );
            })}
            {overflowCount > 0 && (
              <Button
                isIconOnly
                variant="ghost"
                onPress={() => { onTabChange('members'); onOpenChange?.(true); }}
                aria-label={t('chat.detailTitle')}
                className="h-8 w-8 min-w-0 rounded-full bg-ink-700 text-[11px] font-bold text-ink-100 ring-1 ring-divider hover:bg-ink-600 hover:text-foreground"
              >
                +{overflowCount}
              </Button>
            )}
          </ScrollShadow>
        )}

        {!isDirect && onlineCount > 0 && (
          <span className="mb-2.5 flex items-center gap-1 text-[10px] font-semibold tabular-nums text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {onlineCount}
          </span>
        )}
      </aside>
    );
  }

  const tabListClassName = [
    'flex gap-1 border-none bg-transparent p-0',
    '**:data-[slot=tabs-tab]:rounded-lg **:data-[slot=tabs-tab]:px-2.5 **:data-[slot=tabs-tab]:py-1.5',
    '**:data-[slot=tabs-tab]:text-[12px] **:data-[slot=tabs-tab]:font-medium **:data-[slot=tabs-tab]:text-ink-200',
    '**:data-[slot=tabs-tab]:data-[selected=true]:text-foreground',
    '**:data-[slot=tabs-indicator]:rounded-lg **:data-[slot=tabs-indicator]:bg-ink-700',
  ].join(' ');

  // Expanded drawer — full height of the chat card so the header lines up with the chat header
  return (
    <motion.aside
      initial={{ x: 16 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={[
        'echo-sidebar-bg absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-divider shadow-2xl md:static md:z-0 md:w-80 md:shrink-0 md:shadow-none',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/8 px-3">
        <h3 className="echo-display truncate text-[15px] font-semibold leading-tight">{t('chat.detailTitle')}</h3>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="h-7 w-7 min-w-0 shrink-0"
          onPress={() => onOpenChange?.(false)}
          aria-label={t('common.close')}
        >
          <X size={14} />
        </Button>
      </div>

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => onTabChange(key as DetailTab)}
        variant="secondary"
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.ListContainer className="shrink-0 border-b border-white/8 bg-transparent px-2 py-1.5">
          <Tabs.List aria-label={t('chat.detailTitle')} className={tabListClassName}>
            <Tabs.Tab id="info">{t('chat.detailTabInfo')}<Tabs.Indicator /></Tabs.Tab>
            {!isDirect && <Tabs.Tab id="members">{t('chat.memberPanel')}<Tabs.Indicator /></Tabs.Tab>}
            <Tabs.Tab id="media">{t('chat.detailTabMedia')}<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="files">{t('chat.detailTabFiles')}<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="links">{t('chat.detailTabLinks')}<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="info" className="flex min-h-0 flex-1 flex-col">
          <InfoTab
            conversation={conversation}
            isDirect={isDirect}
            canEditGroup={canEditGroup}
            onPickAvatar={onPickAvatar}
            onRemoveAvatar={onRemoveAvatar}
            onUpdateInfo={async (patch) => {
              await onUpdateInfo(patch);
              toast.success(t('chat.groupInfoUpdated'));
            }}
          />
        </Tabs.Panel>
        {!isDirect && (
          <Tabs.Panel id="members" className="flex min-h-0 flex-1 flex-col">
            <MembersTab members={members} loading={loading} />
          </Tabs.Panel>
        )}
        <Tabs.Panel id="media" className="flex min-h-0 flex-1 flex-col">
          <MediaTab conversationId={conversationId} />
        </Tabs.Panel>
        <Tabs.Panel id="files" className="flex min-h-0 flex-1 flex-col">
          <FilesTab conversationId={conversationId} onJump={onJump} />
        </Tabs.Panel>
        <Tabs.Panel id="links" className="flex min-h-0 flex-1 flex-col">
          <LinksTab conversationId={conversationId} onJump={onJump} />
        </Tabs.Panel>
      </Tabs>
    </motion.aside>
  );
}
