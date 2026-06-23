import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button, InputGroup } from '@heroui/react';
import { Search, X, Loader, MessageSquareText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { messagesApi } from '@/lib/endpoints';
import UserAvatar from '@/components/UserAvatar';
import { formatMessageTime } from '@/lib/dates';

/* Highlights every occurrence of `query` inside `text`. */
function Highlighted({ text, query }) {
  const parts = useMemo(() => {
    if (!text) return [];
    if (!query) return [{ match: false, value: text }];
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safe})`, 'ig');
    return text
      .split(regex)
      .filter(Boolean)
      .map((value, i) => ({ key: i, match: value.toLowerCase() === query.toLowerCase(), value }));
  }, [text, query]);

  return (
    <>
      {parts.map((p) => (
        <span
          key={p.key}
          className={p.match ? 'rounded-[3px] bg-blurple-500/30 font-semibold text-foreground' : undefined}
        >
          {p.value}
        </span>
      ))}
    </>
  );
}

export default function MessageSearchPanel({ conversationId, onClose, onJump }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset when switching conversation
  useEffect(() => {
    setQuery('');
    setResults([]);
    setTouched(false);
  }, [conversationId]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setTouched(true);
    const timeout = setTimeout(async () => {
      try {
        const { data } = await messagesApi.search(conversationId, q, 30);
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, conversationId]);

  return (
    <motion.aside
      initial={{ x: '100%', opacity: 0.6 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.6 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-black/30 bg-ink-800 shadow-2xl md:static md:z-0 md:w-80 md:shrink-0"
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-black/20 px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-ink-100" />
          <h3 className="text-[15px] font-semibold">{t('chat.searchMessages')}</h3>
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="h-7 w-7 min-w-0"
          onPress={onClose}
          aria-label={t('common.close')}
        >
          <X size={16} />
        </Button>
      </div>

      {/* Search field */}
      <div className="border-b border-black/20 p-3">
        <InputGroup variant="secondary" className="bg-ink-900">
          <InputGroup.Prefix>
            {loading ? (
              <Loader size={14} className="animate-spin text-ink-200" />
            ) : (
              <Search size={14} className="text-ink-200" />
            )}
          </InputGroup.Prefix>
          <InputGroup.Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (query ? setQuery('') : onClose())}
            placeholder={t('chat.searchPlaceholder')}
          />
          {query && (
            <InputGroup.Suffix>
              <Button
                isIconOnly
                variant="ghost"
                onPress={() => setQuery('')}
                className="flex h-auto w-auto min-w-0 items-center p-0 text-ink-200 transition-colors hover:bg-transparent hover:text-foreground"
                aria-label={t('common.clear')}
              >
                <X size={13} />
              </Button>
            </InputGroup.Suffix>
          )}
        </InputGroup>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {query.trim().length >= 2 && !loading && (
          <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-ink-200">
            {t('chat.searchResults', { count: results.length })}
          </p>
        )}

        {/* Empty / hint states */}
        {!touched && query.trim().length < 2 && (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-ink-200">
            <MessageSquareText size={30} className="opacity-40" />
            <p className="text-[13px]">{t('chat.searchHint')}</p>
          </div>
        )}

        {touched && !loading && query.trim().length >= 2 && results.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-ink-200">
            <Search size={30} className="opacity-40" />
            <p className="text-[13px]">{t('chat.searchNoResults')}</p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {results.map((msg) => (
            <Button
              key={msg.id}
              variant="ghost"
              onPress={() => onJump?.(msg.id)}
              className="group flex h-auto w-full flex-col items-stretch justify-start gap-1 whitespace-normal rounded-md px-2 py-2 text-left transition-colors hover:bg-ink-750"
            >
              <div className="flex items-center gap-2">
                <UserAvatar
                  user={{ display_name: msg.sender_display_name, avatar_url: msg.sender_avatar_url }}
                  size="sm"
                />
                <span className="truncate text-[13px] font-semibold text-foreground">
                  {msg.sender_display_name}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-ink-200">
                  {formatMessageTime(msg.sent_at)}
                </span>
              </div>
              <p className="line-clamp-3 pl-9 text-[13px] leading-snug text-ink-100">
                {msg.body
                  ? <Highlighted text={msg.body} query={query.trim()} />
                  : <span className="italic text-ink-200">{t('chat.attachedFile')}</span>}
              </p>
            </Button>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
