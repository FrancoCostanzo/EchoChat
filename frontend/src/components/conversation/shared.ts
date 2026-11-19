import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type TFunc = ReturnType<typeof useTranslation>['t'];

export const SPRING_OUT = [0.34, 1.56, 0.64, 1] as const;

/** Payload guardado en `message.metadata.sticker` — ver handleStickerSend. */
export interface MessageSticker {
  source: 'custom' | 'giphy';
  kind: 'sticker' | 'gif';
  object_id?: string | null;
  url?: string | null;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
}

export const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export interface MenuAction {
  key: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export interface ContextMenuPos {
  messageId: string;
  x: number;
  y: number;
}

/** `message.metadata` cuando `type === 'system'` y `metadata.event === 'call'`. */
export interface CallEventMetadata {
  event?: string;
  call_type?: 'voice' | 'video';
  initiated_by?: string;
  outcome?: string;
  duration_seconds?: number;
}

/** Forma combinada de `message.metadata` para las variantes que arma esta página. */
export interface MessageMetadata extends CallEventMetadata {
  sticker?: MessageSticker;
  /** Lo pone el backend cuando el mensaje es la auto-respuesta de una ausencia. */
  auto_reply?: boolean;
  broadcast_msg_id?: string;
  broadcast_list_id?: string;
  broadcast_list_name?: string;
}
