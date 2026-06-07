import { useState } from 'react';
import { Button } from '@heroui/react';
import { BarChart3, Check, Lock, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pollsApi } from '@/lib/endpoints';
import { useChatStore } from '@/stores/chatStore';

export default function PollMessage({ message, currentUserId }) {
  const { t } = useTranslation();
  const applyPollUpdate = useChatStore((s) => s.applyPollUpdate);
  const poll = message.poll;
  const [pending, setPending] = useState([]); // local selection for multiple choice
  const [busy, setBusy] = useState(false);

  if (!poll) return null;

  const expired = poll.closes_at && new Date(poll.closes_at) < new Date();
  const closed = poll.is_closed || expired;
  const total = poll.total_votes || 0;
  const isOwner = message.sender_id === currentUserId;

  const submitVote = async (optionIds) => {
    if (busy || closed || optionIds.length === 0) return;
    setBusy(true);
    try {
      const { data } = await pollsApi.vote(poll.id, optionIds);
      applyPollUpdate(message.id, data, { preserveVotes: false });
      setPending([]);
    } catch {
      // ignore; counts stay as they were
    } finally {
      setBusy(false);
    }
  };

  const handleOptionClick = (optionId) => {
    if (closed) return;
    if (poll.is_multiple) {
      setPending((prev) =>
        prev.includes(optionId) ? prev.filter((x) => x !== optionId) : [...prev, optionId],
      );
    } else {
      submitVote([optionId]);
    }
  };

  const handleRetract = async () => {
    if (busy || closed) return;
    setBusy(true);
    try {
      const { data } = await pollsApi.retract(poll.id);
      applyPollUpdate(message.id, data, { preserveVotes: false });
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    setBusy(true);
    try {
      const { data } = await pollsApi.close(poll.id);
      applyPollUpdate(message.id, data, { preserveVotes: false });
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-72 flex-col gap-2 sm:w-80">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-200">
        <BarChart3 size={12} />
        <span>{poll.is_multiple ? t('poll.multiple') : t('poll.single')}</span>
        {poll.is_anonymous && (
          <span className="flex items-center gap-0.5"><EyeOff size={11} /> {t('poll.anonymous')}</span>
        )}
        {closed && <span className="flex items-center gap-0.5 text-echo-dnd"><Lock size={11} /> {t('poll.closed')}</span>}
      </div>

      <p className="text-sm font-semibold text-foreground">{poll.question}</p>

      <div className="flex flex-col gap-1.5">
        {poll.options.map((opt) => {
          const pct = total > 0 ? Math.round((opt.vote_count / total) * 100) : 0;
          const selected = poll.is_multiple ? pending.includes(opt.id) : opt.voted;
          const showResults = poll.has_voted || closed;
          return (
            <Button
              key={opt.id}
              variant="ghost"
              isDisabled={closed || busy}
              onPress={() => handleOptionClick(opt.id)}
              className={[
                'relative flex h-auto w-full justify-start overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                opt.voted ? 'border-blurple-500/60' : selected ? 'border-blurple-400/60' : 'border-black/20',
                closed ? 'cursor-default' : 'hover:border-blurple-400/60',
                'bg-ink-900',
              ].join(' ')}
            >
              {showResults && (
                <span
                  className="absolute inset-y-0 left-0 bg-blurple-500/15"
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  {(opt.voted || selected) && <Check size={14} className="shrink-0 text-blurple-400" />}
                  <span className="truncate">{opt.text}</span>
                </span>
                {showResults && (
                  <span className="shrink-0 text-xs font-medium text-ink-200">{pct}%</span>
                )}
              </span>
            </Button>
          );
        })}
      </div>

      {poll.is_multiple && !closed && pending.length > 0 && (
        <Button
          variant="ghost"
          isDisabled={busy}
          onPress={() => submitVote(pending)}
          className="h-auto rounded-lg bg-blurple-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blurple-600"
        >
          {t('poll.vote')}
        </Button>
      )}

      <div className="flex items-center justify-between text-[11px] text-ink-200">
        <span>{t('poll.totalVotes', { count: total })}</span>
        <div className="flex items-center gap-2">
          {poll.has_voted && !closed && (
            <Button variant="ghost" onPress={handleRetract} isDisabled={busy} className="h-auto min-w-0 bg-transparent p-0 text-[11px] font-normal hover:bg-transparent hover:text-foreground">
              {t('poll.retract')}
            </Button>
          )}
          {isOwner && !closed && (
            <Button variant="ghost" onPress={handleClose} isDisabled={busy} className="h-auto min-w-0 bg-transparent p-0 text-[11px] font-normal hover:bg-transparent hover:text-echo-dnd">
              {t('poll.close')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
