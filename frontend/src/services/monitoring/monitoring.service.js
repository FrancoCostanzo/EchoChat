import { monitoringApi } from '@/lib/endpoints';

const STATUS_LABELS = {
  healthy: 'Saludable',
  degraded: 'Degradado',
  unhealthy: 'Crítico',
};

const STATUS_COLORS = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'danger',
};

function formatUptime(seconds) {
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
  getHistory: (range) => monitoringApi.getHistory(range),
  getStatusLabel: (status) => STATUS_LABELS[status] || status || 'Desconocido',
  getStatusColor: (status) => STATUS_COLORS[status] || 'default',
  formatUptime,
};

export default monitoreoServices;
