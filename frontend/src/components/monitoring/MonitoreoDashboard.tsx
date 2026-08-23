import React, { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Server,
  Database,
  BarChart3,
  Wifi,
  XCircle,
} from 'lucide-react';
import {
  Button, Chip, ListBox, Select, Spinner, Tabs,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';
import monitoreoServices from '@/services/monitoring/monitoring.service';
import { getStatusColor, MONITOREO_TOOLTIPS as T } from './monitoreo.helpers';
import { StatBlock, InfoTooltip } from './monitoreo.ui';
import VistaServidor from './VistaServidor';
import VistaBaseDatos from './VistaBaseDatos';
import VistaHttp from './VistaHttp';
import VistaCronSocket from './VistaCronSocket';
import VistaTendencias from './VistaTendencias';
import type { DashboardData } from '@/types/monitoring';

type IconType = ComponentType<{ className?: string }>;

const REFRESH_OPTIONS = [
  { id: '0', ms: 0, labelKey: 'monitoring.refresh.manual' },
  { id: '10000', ms: 10000, labelKey: 'monitoring.refresh.10s' },
  { id: '30000', ms: 30000, labelKey: 'monitoring.refresh.30s' },
  { id: '60000', ms: 60000, labelKey: 'monitoring.refresh.60s' },
];

const MONITOREO_TABS: { key: string; labelKey: string; icon: IconType }[] = [
  { key: 'servidor', labelKey: 'monitoring.tabs.server', icon: Server },
  { key: 'database', labelKey: 'monitoring.tabs.database', icon: Database },
  { key: 'http', labelKey: 'monitoring.tabs.http', icon: BarChart3 },
  { key: 'cron', labelKey: 'monitoring.tabs.cron', icon: Wifi },
  { key: 'tendencias', labelKey: 'monitoring.tabs.trends', icon: BarChart3 },
];

const STATUS_ICON_MAP: Record<string, IconType> = {
  healthy: CheckCircle,
  degraded: AlertTriangle,
  unhealthy: XCircle,
};

function renderTabContent(activeTab: string, dashboard: DashboardData | null) {
  switch (activeTab) {
    case 'servidor': return <VistaServidor dashboard={dashboard} />;
    case 'database': return <VistaBaseDatos dashboard={dashboard} />;
    case 'http': return <VistaHttp dashboard={dashboard} />;
    case 'cron': return <VistaCronSocket dashboard={dashboard} />;
    case 'tendencias':
      return (
        <VistaTendencias
          initialData={dashboard?.recentHistory || []}
          isActive={activeTab === 'tendencias'}
        />
      );
    default: return null;
  }
}

export default function MonitoreoDashboard() {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshMs, setRefreshMs] = useState(30000);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('servidor');

  const loadData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      setError(null);
      const response = await monitoreoServices.getDashboard();
      setDashboard(response.data);
      setLastUpdate(new Date());
    } catch (err) {
      setError(t('monitoring.loadError'));
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!refreshMs) return undefined;
    const interval = setInterval(() => loadData(), refreshMs);
    return () => clearInterval(interval);
  }, [refreshMs, loadData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <Spinner size="lg" />
        <p className="text-sm text-default-500">{t('monitoring.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <AlertTriangle className="w-10 h-10 text-danger" />
        <p className="text-sm text-danger">{error}</p>
        <Button size="sm" onPress={() => loadData(true)}>{t('monitoring.retry')}</Button>
      </div>
    );
  }

  const overallStatus = dashboard?.overallStatus;
  const server = dashboard?.components?.server;
  const db = dashboard?.components?.database;

  const statusChipLabel = overallStatus === 'healthy'
    ? t('monitoring.statusChip.ok')
    : overallStatus === 'degraded'
      ? t('monitoring.statusChip.attention')
      : t('monitoring.statusChip.critical');

  const OverallIcon = STATUS_ICON_MAP[overallStatus || ''] || Activity;

  return (
    <div className="space-y-5">
      {/* ── Barra de estado + controles ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip color={getStatusColor(overallStatus)} variant="soft" size="sm">
            <OverallIcon className="w-3 h-3" />
            <Chip.Label>{statusChipLabel}</Chip.Label>
          </Chip>
          {dashboard?.reasons && dashboard.reasons.length > 0 && (
            <InfoTooltip content={dashboard.reasons.join('\n')} />
          )}
          <Chip size="sm" variant="soft" color={getStatusColor(server?.status)}>
            {t('monitoring.tabs.server')}
          </Chip>
          <Chip size="sm" variant="soft" color={getStatusColor(db?.status)}>
            {t('monitoring.tabs.database')}
          </Chip>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-default-400">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <Select
            aria-label={t('monitoring.refreshInterval')}
            value={String(refreshMs)}
            onChange={(v) => setRefreshMs(Number(v))}
            className="w-32"
          >
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                {REFRESH_OPTIONS.map((opt) => (
                  <ListBox.Item key={opt.id} id={opt.id} textValue={t(opt.labelKey)}>
                    {t(opt.labelKey)}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <Button
            size="sm"
            variant="secondary"
            isPending={refreshing}
            onPress={() => loadData(true)}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('monitoring.refreshBtn')}
          </Button>
        </div>
      </div>

      {/* ── Métricas rápidas ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBlock
          label={t('monitoring.stats.uptime')}
          value={server?.info?.uptimeFormatted || 'N/A'}
          tooltip={T.uptime}
        />
        <StatBlock
          label={t('monitoring.stats.pool')}
          value={`${db?.pool?.busyConnections ?? 0}/${db?.pool?.totalConnections ?? 0}`}
          tooltip={T.poolDb}
        />
        <StatBlock
          label={t('monitoring.stats.heap')}
          value={server?.process?.memory?.heapLimitPercentage ?? 0}
          unit="%"
          tooltip={T.heap}
        />
        <StatBlock
          label={t('monitoring.stats.updated')}
          value={lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}
          tooltip={T.actualizacion}
        />
      </div>

      {/* ── Secciones detalladas ── */}
      <div className="space-y-4">
        <Tabs selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(String(k))}>
          <Tabs.ListContainer>
            <Tabs.List aria-label={t('monitoring.sections')}>
              {MONITOREO_TABS.map((tab) => (
                <Tabs.Tab key={tab.key} id={tab.key}>
                  <span className="flex items-center gap-1.5">
                    {React.createElement(tab.icon, { className: 'w-3.5 h-3.5' })}
                    {t(tab.labelKey)}
                  </span>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <div>{renderTabContent(activeTab, dashboard)}</div>
      </div>
    </div>
  );
}
