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

// Own messages sit on an accent-gradient bubble (`echo-on-accent`, meant for
// plain text that inherits its color) — Tailwind `text-*` utilities on our
// own elements would override that inherited color and can end up low-
// contrast against the gradient. Giving the whole game its own opaque dark
// card (same trick as CodeMessage) sidesteps that: every text color below
// is chosen against this fixed dark surface, regardless of bubble variant.
function GameCard({ variant, className = '', children }) {
  const isOwn = variant === 'own';
  return (
    <div className={[
      'w-fit min-w-56 rounded-lg border p-3',
      isOwn ? 'border-white/15 bg-black/30' : 'border-ink-400/40 bg-ink-900/80',
      className,
    ].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

function ResultBanner({ game, currentUserId }) {
  const { t } = useTranslation();
  if (game.status !== 'finished') return null;
  const text = game.result === 'draw'
    ? t('game.draw')
    : game.winner_id === currentUserId ? t('game.youWon') : t('game.youLost');
  return (
    <p className={[
      'text-sm font-semibold',
      game.result === 'draw' ? 'text-ink-100' : game.winner_id === currentUserId ? 'text-echo-online' : 'text-ink-200',
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
      {statusText && <p className="text-sm font-medium text-ink-100">{statusText}</p>}
      <ResultBanner game={game} currentUserId={currentUserId} />
      <div className="grid w-44 grid-cols-3 gap-1.5">
        {game.board.map((cell, i) => (
          <button
            key={i}
            type="button"
            disabled={busy || !isMyTurn || !!cell}
            onClick={() => move({ cell: i })}
            className={[
              'flex aspect-square items-center justify-center rounded-lg border text-xl font-bold transition-colors',
              cell ? 'border-black/20 bg-ink-800' : 'border-black/20 bg-ink-800 hover:border-accent/50',
              cell === 'X' ? 'text-accent' : cell === 'O' ? 'text-echo-accent-energy' : 'text-transparent',
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
          <span className="text-sm text-ink-200">{t('rps.vs')}</span>
          <span>{emojiFor(game.choices.player2)}</span>
        </div>
        <ResultBanner game={game} currentUserId={currentUserId} />
      </GameCard>
    );
  }

  if (myChoice) {
    return (
      <GameCard variant={variant} className="flex flex-col items-center gap-2 text-center">
        <span className="text-3xl">{emojiFor(myChoice)}</span>
        <p className="text-sm text-ink-100">
          {opponentChoice ? t('rps.resolving') : t('rps.waiting')}
        </p>
      </GameCard>
    );
  }

  return (
    <GameCard variant={variant} className="flex flex-col gap-2">
      <p className="text-sm font-medium text-ink-100">{t('rps.chooseYours')}</p>
      <div className="flex gap-2">
        {RPS_CHOICES.map(({ id, emoji }) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            onClick={() => move({ choice: id })}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-black/20 bg-ink-800 py-2.5 text-2xl transition-colors hover:border-accent/50 disabled:opacity-60"
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
      <p className="text-sm font-medium text-ink-100">
        {isGuesser ? t('hangman.guesserPrompt') : t('hangman.spectatorPrompt')}
      </p>
      <p className="select-none font-mono text-2xl tracking-[0.3em] text-ink-0">
        {displayWord.split('').map((c) => c === ' ' ? '  ' : c).join(' ')}
      </p>
      {game.status === 'active' && (
        <p className="text-[12px] text-ink-200">
          {t('hangman.attemptsLeft', { count: remaining })}
          {game.wrong.length > 0 && ` · ${t('hangman.wrongLetters')}: ${game.wrong.join(', ')}`}
        </p>
      )}
      <ResultBanner game={game} currentUserId={currentUserId} />
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
                  used ? 'bg-ink-950 text-ink-300' : 'bg-ink-800 text-ink-50 hover:bg-accent hover:text-accent-foreground',
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
