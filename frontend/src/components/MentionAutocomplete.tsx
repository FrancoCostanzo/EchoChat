import { useCallback, useMemo, useState, type KeyboardEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import type { TextInputHandle } from '@/lib/formatText';
import type { MemberResponse } from '@/types/conversation';

/* ─────────────────────────────────────────────────────────
   Autocompletado de @menciones para el composer.

   El popup sólo sugiere; quién queda realmente mencionado lo
   decide el backend al resolver el texto contra los miembros
   (backend/src/utils/mentions.util.ts). Por eso insertamos el
   nombre tal cual está en el perfil: es lo que el servidor
   sabe reconocer después.
   ───────────────────────────────────────────────────────── */

const MAX_SUGERENCIAS = 6;
/** Un display_name largo entra; más que esto ya no es una mención en curso. */
const MAX_LARGO_CONSULTA = 30;
/** "@ana maria garcia" todavía busca; con más palabras asumimos que fue una arroba suelta. */
const MAX_PALABRAS_CONSULTA = 3;

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function etiquetaDe(miembro: MemberResponse): string {
  return (miembro.display_name || miembro.username || '').trim();
}

interface OpcionesHook {
  value: string;
  onChange: (nuevo: string) => void;
  inputRef: RefObject<TextInputHandle | null>;
  members: MemberResponse[];
  /** Mencionarse a uno mismo no tiene sentido. */
  excludeUserId?: string | null;
}

export function useMentionAutocomplete({ value, onChange, inputRef, members, excludeUserId }: OpcionesHook) {
  // `desde` = índice de la arroba que abrió el token que se está escribiendo.
  const [estado, setEstado] = useState<{ desde: number; consulta: string } | null>(null);
  const [indice, setIndice] = useState(0);

  const cerrar = useCallback(() => { setEstado(null); setIndice(0); }, []);

  const sugerencias = useMemo(() => {
    if (!estado) return [];
    const consulta = normalizar(estado.consulta);
    const candidatos = members.filter((m) => m.user_id !== excludeUserId && etiquetaDe(m));
    if (!consulta) return candidatos.slice(0, MAX_SUGERENCIAS);
    return candidatos
      .map((m) => {
        const nombre = normalizar(m.display_name ?? '');
        const usuario = normalizar(m.username ?? '');
        if (nombre.startsWith(consulta) || usuario.startsWith(consulta)) return { m, peso: 0 };
        if (nombre.includes(consulta) || usuario.includes(consulta)) return { m, peso: 1 };
        return null;
      })
      .filter((x): x is { m: MemberResponse; peso: number } => x !== null)
      .sort((a, b) => a.peso - b.peso)
      .slice(0, MAX_SUGERENCIAS)
      .map((x) => x.m);
  }, [estado, members, excludeUserId]);

  const activo = !!estado && sugerencias.length > 0;
  const indiceSeguro = Math.min(indice, Math.max(sugerencias.length - 1, 0));

  /**
   * Se llama desde el onChange del composer. El caret sale del input porque el
   * texto por sí solo no dice dónde está parado el usuario.
   */
  const detectar = useCallback((texto: string) => {
    if (members.length === 0) { cerrar(); return; }
    const caret = inputRef.current?.selectionStart ?? texto.length;

    let arroba = -1;
    for (let i = caret - 1; i >= 0 && caret - i <= MAX_LARGO_CONSULTA + 1; i--) {
      const char = texto[i];
      if (char === '\n') break;
      if (char === '@') { arroba = i; break; }
    }
    if (arroba === -1) { cerrar(); return; }
    // `juan@empresa.com` no abre mención (mismo criterio que el backend).
    if (arroba > 0 && /[\p{L}\p{N}]/u.test(texto[arroba - 1])) { cerrar(); return; }

    const consulta = texto.slice(arroba + 1, caret);
    if (consulta.trim().split(/\s+/).filter(Boolean).length > MAX_PALABRAS_CONSULTA) { cerrar(); return; }

    setEstado({ desde: arroba, consulta });
    setIndice(0);
  }, [cerrar, inputRef, members.length]);

  const seleccionar = useCallback((miembro: MemberResponse) => {
    if (!estado) return;
    const etiqueta = etiquetaDe(miembro);
    if (!etiqueta) return;
    const caret = inputRef.current?.selectionStart ?? value.length;
    const antes = value.slice(0, estado.desde);
    const insertado = `@${etiqueta} `;
    onChange(antes + insertado + value.slice(caret));
    cerrar();

    // DynamicMessageInput reposiciona el caret al final cuando `value` cambia
    // desde afuera; lo volvemos a poner después de ese re-render para no
    // saltar al final cuando se menciona en medio de un mensaje ya escrito.
    const posicion = antes.length + insertado.length;
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(posicion, posicion);
    }, 0);
  }, [estado, inputRef, onChange, value, cerrar]);

  /** Devuelve true si consumió la tecla (el composer no debe seguir procesándola). */
  const onKeyDown = useCallback((e: KeyboardEvent<HTMLElement>): boolean => {
    if (!activo) return false;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIndice((i) => (i + 1) % sugerencias.length);
        return true;
      case 'ArrowUp':
        e.preventDefault();
        setIndice((i) => (i - 1 + sugerencias.length) % sugerencias.length);
        return true;
      case 'Tab':
        e.preventDefault();
        seleccionar(sugerencias[indiceSeguro]);
        return true;
      case 'Enter':
        // Shift+Enter sigue siendo salto de línea.
        if (e.shiftKey) return false;
        e.preventDefault();
        seleccionar(sugerencias[indiceSeguro]);
        return true;
      case 'Escape':
        e.preventDefault();
        cerrar();
        return true;
      default:
        return false;
    }
  }, [activo, sugerencias, indiceSeguro, seleccionar, cerrar]);

  return { activo, sugerencias, indice: indiceSeguro, setIndice, detectar, seleccionar, cerrar, onKeyDown };
}

interface MentionAutocompleteProps {
  open: boolean;
  options: MemberResponse[];
  activeIndex: number;
  onSelect: (miembro: MemberResponse) => void;
  onHover: (indice: number) => void;
}

export default function MentionAutocomplete({ open, options, activeIndex, onSelect, onHover }: MentionAutocompleteProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      role="listbox"
      aria-label={t('chat.mentionSuggestions')}
      // Fondo 100% opaco (no `echo-glass` ni `echo-panel-solid`, que dejan pasar
      // el wallpaper): es un menú que hay que leer rápido mientras se escribe.
      className="echo-e3 absolute bottom-full left-0 z-50 mb-2 max-h-60 w-72 max-w-[85vw] overflow-y-auto rounded-xl border border-(--panel-border) bg-ink-850 p-1"
    >
      {options.map((miembro, i) => (
        <button
          key={miembro.user_id}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          // El composer mantiene el foco: con onMouseDown evitamos el blur que
          // cerraría el popup antes de que llegue el click.
          onMouseDown={(e) => { e.preventDefault(); onSelect(miembro); }}
          onMouseEnter={() => onHover(i)}
          className={[
            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
            // Selección con fondo lleno: sobre el panel del composer, un
            // resaltado translúcido casi no se distingue de la fila de al lado.
            i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-ink-600',
          ].join(' ')}
        >
          <UserAvatar user={miembro} size="xs" />
          <span className="min-w-0 flex-1 truncate text-[14px]">
            {miembro.display_name || miembro.username}
          </span>
          {miembro.username && miembro.display_name && (
            <span className={['shrink-0 text-[12px]', i === activeIndex ? 'opacity-80' : 'text-ink-200'].join(' ')}>
              @{miembro.username}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
