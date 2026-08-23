import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatMessageTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Ayer';
  return format(date, 'dd/MM/yy');
}

export function formatFullTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return format(date, "d 'de' MMMM, HH:mm", { locale: es });
}

// Etiqueta para el separador de día en la conversación: "Hoy", "Ayer" o la
// fecha completa (p. ej. "Lunes, 23 de junio de 2026").
export function formatDaySeparator(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  if (isToday(date)) return 'Hoy';
  if (isYesterday(date)) return 'Ayer';
  const full = format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  return full.charAt(0).toUpperCase() + full.slice(1);
}

export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}
