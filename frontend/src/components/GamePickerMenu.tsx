import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, toast } from '@heroui/react';
import { Gamepad2, Grid3x3, Scissors, Skull, ArrowLeft } from 'lucide-react';
import { gamesApi } from '@/lib/endpoints';

type GameKind = 'tictactoe' | 'rps' | 'hangman';

const GAMES: { kind: GameKind; icon: typeof Grid3x3 }[] = [
  { kind: 'tictactoe', icon: Grid3x3 },
  { kind: 'rps', icon: Scissors },
  { kind: 'hangman', icon: Skull },
];

const HANGMAN_WORD_PATTERN = /^[a-zA-Z]{2,20}$/;

/* ─────────────────────────────────────────────────────────
   GamePickerMenu — dedicated composer button that opens a
   small flyout to start a mini-game invite (Tic-Tac-Toe,
   Rock-Paper-Scissors, Hangman) in the current direct chat.
   Tic-Tac-Toe/RPS send the invite immediately; Hangman needs
   the inviter to type their secret word first (never sent to
   the opponent — only the masked word travels over the wire).
   ───────────────────────────────────────────────────────── */
interface GamePickerMenuProps {
  conversationId: string;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GamePickerMenu({ conversationId, disabled, open, onOpenChange }: GamePickerMenuProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [pickingHangmanWord, setPickingHangmanWord] = useState(false);
  const [word, setWord] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const wordInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setPickingHangmanWord(false);
      setWord('');
      return;
    }
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) onOpenChange(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (pickingHangmanWord) wordInputRef.current?.focus();
  }, [pickingHangmanWord]);

  const startGame = useCallback(async (kind: GameKind, extra: { word?: string } = {}) => {
    if (busy) return;
    setBusy(true);
    try {
      await gamesApi.create({ conversation_id: conversationId, kind, ...extra });
      onOpenChange(false);
    } catch (err) {
      toast.danger((err instanceof Error && err.message) || t('game.startError'));
    } finally {
      setBusy(false);
    }
  }, [busy, conversationId, onOpenChange, t]);

  const handlePick = useCallback((kind: GameKind) => {
    if (kind === 'hangman') {
      setPickingHangmanWord(true);
      return;
    }
    startGame(kind);
  }, [startGame]);

  const submitWord = useCallback(() => {
    const trimmed = word.trim();
    if (!HANGMAN_WORD_PATTERN.test(trimmed)) {
      toast.danger(t('hangman.wordInvalid'));
      return;
    }
    startGame('hangman', { word: trimmed });
  }, [word, startGame, t]);

  return (
    <div className="relative" ref={rootRef}>
      <Tooltip>
        <Button
          isIconOnly
          variant="ghost"
          isDisabled={disabled}
          onPress={() => onOpenChange(!open)}
          aria-label={t('game.play')}
          aria-expanded={open}
          className="flex h-9 w-9 min-w-0 shrink-0 items-center justify-center rounded-md text-ink-100 transition-colors hover:bg-ink-750 hover:text-foreground"
        >
          <Gamepad2 size={18} />
        </Button>
        <Tooltip.Content placement="top">
          <p>{t('game.play')}</p>
        </Tooltip.Content>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute bottom-11 right-0 z-40 w-64 overflow-hidden rounded-xl border border-ink-400/40 bg-ink-850 p-1.5 shadow-2xl"
          >
            {pickingHangmanWord ? (
              <div className="flex flex-col gap-2 p-1.5">
                <button
                  type="button"
                  onClick={() => setPickingHangmanWord(false)}
                  className="flex items-center gap-1 self-start text-[12px] font-medium text-ink-200 transition-colors hover:text-foreground"
                >
                  <ArrowLeft size={13} /> {t('common.back')}
                </button>
                <p className="text-[13px] font-medium text-ink-100">{t('hangman.wordPrompt')}</p>
                <input
                  ref={wordInputRef}
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitWord(); }}
                  placeholder={t('hangman.wordPlaceholder')}
                  maxLength={20}
                  autoComplete="off"
                  className="w-full rounded-lg border border-ink-400/40 bg-ink-900 px-2.5 py-1.5 text-[14px] text-foreground outline-none focus:border-accent/60"
                />
                <p className="text-[11px] text-ink-200">{t('hangman.wordHint')}</p>
                <Button
                  isDisabled={busy || !word.trim()}
                  onPress={submitWord}
                  className="h-auto rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-foreground transition-[filter] hover:brightness-110"
                >
                  {t('hangman.sendInvite')}
                </Button>
              </div>
            ) : (
              GAMES.map(({ kind, icon: Icon }) => (
                <Button
                  key={kind}
                  variant="ghost"
                  isDisabled={busy}
                  onPress={() => handlePick(kind)}
                  className="flex h-auto w-full items-center justify-start gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-ink-50 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon size={16} className="shrink-0" />
                  {t(`game.kind.${kind}`)}
                </Button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
