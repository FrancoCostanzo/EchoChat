import { monitoringApi } from '@/lib/endpoints';

const STATUS_LABELS: Record<string, string> = {
  healthy: 'Saludable',
  degraded: 'Degradado',
  unhealthy: 'Crítico',
};

type ChipColor = 'default' | 'accent' | 'success' | 'warning' | 'danger';

const STATUS_COLORS: Record<string, ChipColor> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'danger',
};

function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

const monitoreoServices = {
  getDashboard: () => monitoringApi.getDashboard(),
  getHistory: (range: string) => monitoringApi.getHistory(range),
  getStatusLabel: (status: string | null | undefined) => STATUS_LABELS[status || ''] || status || 'Desconocido',
  getStatusColor: (status: string | null | undefined): ChipColor => STATUS_COLORS[status || ''] || 'default',
  formatUptime,
};

export default monitoreoServices;
