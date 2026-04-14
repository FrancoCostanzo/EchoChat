import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatMessageTime(dateStr) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Ayer';
  return format(date, 'dd/MM/yy');
}

export function formatFullTime(dateStr) {
  const date = new Date(dateStr);
  return format(date, "d 'de' MMMM, HH:mm", { locale: es });
}

export function formatRelative(dateStr) {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
}
