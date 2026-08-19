import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@heroui/react';
import { gamesApi } from '@/lib/endpoints';
import { useChatStore } from '@/stores/chatStore';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const RPS_CHOICES = [
  { id: 'rock', emoji: '✊' },
  { id: 'paper', emoji: '✋' },
  { id: 'scissors', emoji: '✌️' },
];

function useGameMove(game) {
  const applyGameUpdate = useChatStore((s) => s.applyGameUpdate);
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const move = useCallback(async (payload) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await gamesApi.move(game.id, payload);
      applyGameUpdate(game.message_id, data);
    } catch (err) {
      toast.danger(err?.message || t('game.moveError'));
    } finally {
      setBusy(false);
    }
  }, [busy, game.id, game.message_id, applyGameUpdate, t]);

  return { move, busy };
}

// Both variants render on a fixed-dark "console" card (see --color-console-*
// in index.css): own tints the accent gradient dark enough for white text at
// every accent choice (verified against all 7), other is a literal slate,
// never the theme-flipping ink-* scale. That's what lets every piece of text
// below use one invariant white-based palette regardless of variant or site
// theme, instead of ink-* classes that read fine in dark mode by accident and
// go unreadable in light mode.
function GameCard({ variant, className = '', children }) {
  const isOwn = variant === 'own';
  return (
    <div className={[
      'w-fit min-w-56 rounded-lg border p-3',
      isOwn ? 'border-white/15 bg-black/55' : 'border-white/10 bg-console-900',
      className,
    ].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

function ResultBanner({ game, currentUserId, variant }) {
  const { t } = useTranslation();
  if (game.status !== 'finished') return null;
  const won = game.winner_id === currentUserId;
  const text = game.result === 'draw'
    ? t('game.draw')
    : won ? t('game.youWon') : t('game.youLost');
  // echo-online (semantic success green) only contrasts reliably against the
  // neutral "other" card — against "own"'s accent-tinted card it measures as
  // low as 2.37:1 for brighter accents, so own falls back to white like the
  // rest of its text.
  const wonClass = variant === 'own' ? 'text-white/95' : 'text-echo-online';
  return (
    <p className={[
      'text-sm font-semibold',
      game.result === 'draw' ? 'text-white/75' : won ? wonClass : 'text-white/55',
    ].join(' ')}>
      {text}
    </p>
  );
}

/* ── Tic-Tac-Toe ── */
function TicTacToeBoard({ game, currentUserId, variant }) {
  const { t } = useTranslation();
  const { move, busy } = useGameMove(game);
  const isMyTurn = game.status === 'active' && game.turn === game.your_role;

  const statusText = game.status === 'finished'
    ? null
    : isMyTurn ? t('game.yourTurn') : t('game.opponentTurn');

  return (
    <GameCard variant={variant} className="flex flex-col gap-2">
      {statusText && <p className="text-sm font-medium text-white/85">{statusText}</p>}
      <ResultBanner game={game} currentUserId={currentUserId} variant={variant} />
      <div className="grid w-44 grid-cols-3 gap-1.5">
        {game.board.map((cell, i) => (
          <button
            key={i}
            type="button"
            disabled={busy || !isMyTurn || !!cell}
            onClick={() => move({ cell: i })}
            className={[
              'flex aspect-square items-center justify-center rounded-lg border text-xl font-bold transition-colors',
              'border-white/10 bg-console-800',
              !cell ? 'hover:border-accent/50' : '',
              cell === 'X' ? 'echo-accent-on-dark' : cell === 'O' ? 'text-echo-accent-energy' : 'text-transparent',
              (busy || !isMyTurn) && !cell ? 'cursor-default' : '',
            ].join(' ')}
          >
            {cell || '·'}
          </button>
        ))}
      </div>
    </GameCard>
  );
}

/* ── Rock-Paper-Scissors ── */
function RockPaperScissors({ game, currentUserId, variant }) {
  const { t } = useTranslation();
  const { move, busy } = useGameMove(game);
  const myChoice = game.choices[game.your_role];
  const opponentRole = game.your_role === 'player1' ? 'player2' : 'player1';
  const opponentChoice = game.choices[opponentRole];

  const emojiFor = (id) => RPS_CHOICES.find((c) => c.id === id)?.emoji;

  if (game.status === 'finished') {
    return (
      <GameCard variant={variant} className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3 text-3xl">
          <span>{emojiFor(game.choices.player1)}</span>
          <span className="text-sm text-white/70">{t('rps.vs')}</span>
          <span>{emojiFor(game.choices.player2)}</span>
        </div>
        <ResultBanner game={game} currentUserId={currentUserId} variant={variant} />
      </GameCard>
    );
  }

  if (myChoice) {
    return (
      <GameCard variant={variant} className="flex flex-col items-center gap-2 text-center">
        <span className="text-3xl">{emojiFor(myChoice)}</span>
        <p className="text-sm text-white/85">
          {opponentChoice ? t('rps.resolving') : t('rps.waiting')}
        </p>
      </GameCard>
    );
  }

  return (
    <GameCard variant={variant} className="flex flex-col gap-2">
      <p className="text-sm font-medium text-white/85">{t('rps.chooseYours')}</p>
      <div className="flex gap-2">
        {RPS_CHOICES.map(({ id, emoji }) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            onClick={() => move({ choice: id })}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-white/10 bg-console-800 py-2.5 text-2xl transition-colors hover:border-accent/50 disabled:opacity-60"
          >
            {emoji}
          </button>
        ))}
      </div>
    </GameCard>
  );
}

/* ── Hangman ── */
function Hangman({ game, currentUserId, variant }) {
  const { t } = useTranslation();
  const { move, busy } = useGameMove(game);
  const isGuesser = game.your_role === 'player2';
  const canGuess = isGuesser && game.status === 'active';
  const displayWord = game.status === 'finished' ? game.word : game.masked_word;
  const remaining = game.max_wrong - game.wrong.length;

  return (
    <GameCard variant={variant} className="flex flex-col gap-2">
      <p className="text-sm font-medium text-white/85">
        {isGuesser ? t('hangman.guesserPrompt') : t('hangman.spectatorPrompt')}
      </p>
      <p className="select-none font-mono text-2xl tracking-[0.3em] text-white">
        {displayWord.split('').map((c) => c === ' ' ? '  ' : c).join(' ')}
      </p>
      {game.status === 'active' && (
        <p className="text-[12px] text-white/70">
          {t('hangman.attemptsLeft', { count: remaining })}
          {game.wrong.length > 0 && ` · ${t('hangman.wrongLetters')}: ${game.wrong.join(', ')}`}
        </p>
      )}
      <ResultBanner game={game} currentUserId={currentUserId} variant={variant} />
      {canGuess && (
        <div className="grid grid-cols-9 gap-1">
          {LETTERS.map((l) => {
            const used = game.guessed.includes(l) || game.wrong.includes(l);
            return (
              <button
                key={l}
                type="button"
                disabled={busy || used}
                onClick={() => move({ letter: l })}
                className={[
                  'flex h-6 items-center justify-center rounded text-[11px] font-semibold uppercase transition-colors',
                  // Deliberately dim: an already-tried letter is a disabled,
                  // non-interactive marker, not information someone needs to
                  // read at full contrast.
                  used ? 'bg-black/25 text-white/35' : 'bg-console-800 text-white/90 hover:bg-accent hover:text-accent-foreground',
                ].join(' ')}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}
    </GameCard>
  );
}

export default function GameMessage({ message, currentUserId, variant = 'other' }) {
  const game = message.game;
  if (!game) return null;

  if (game.kind === 'tictactoe') return <TicTacToeBoard game={game} currentUserId={currentUserId} variant={variant} />;
  if (game.kind === 'rps') return <RockPaperScissors game={game} currentUserId={currentUserId} variant={variant} />;
  if (game.kind === 'hangman') return <Hangman game={game} currentUserId={currentUserId} variant={variant} />;
  return null;
}
