import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Server,
  Database,
  BarChart3,
  Wifi,
  XCircle,
  MemoryStick,
} from 'lucide-react';
import {
  Button, Card, Chip, ListBox, Select, Spinner, Tabs,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';
import monitoreoServices from '@/services/monitoring/monitoring.service';
import { getStatusColor, MONITOREO_TOOLTIPS as T } from './monitoreo.helpers';
import { QuickStatCard, LabelWithTooltip } from './monitoreo.ui';
import VistaServidor from './VistaServidor';
import VistaBaseDatos from './VistaBaseDatos';
import VistaHttp from './VistaHttp';
import VistaCronSocket from './VistaCronSocket';
import VistaTendencias from './VistaTendencias';

const REFRESH_OPTIONS = [
  { id: '0', ms: 0, labelKey: 'monitoring.refresh.manual' },
  { id: '10000', ms: 10000, labelKey: 'monitoring.refresh.10s' },
  { id: '30000', ms: 30000, labelKey: 'monitoring.refresh.30s' },
  { id: '60000', ms: 60000, labelKey: 'monitoring.refresh.60s' },
];

const MONITOREO_TABS = [
  { key: 'servidor', labelKey: 'monitoring.tabs.server', icon: Server },
  { key: 'database', labelKey: 'monitoring.tabs.database', icon: Database },
  { key: 'http', labelKey: 'monitoring.tabs.http', icon: BarChart3 },
  { key: 'cron', labelKey: 'monitoring.tabs.cron', icon: Wifi },
  { key: 'tendencias', labelKey: 'monitoring.tabs.trends', icon: BarChart3 },
];

const MOBILE_BREAKPOINT = 768;

const STATUS_ICON_CLASSES = {
  healthy: 'text-success',
  degraded: 'text-warning',
  unhealthy: 'text-danger',
  default: 'text-default-500',
};

const STATUS_SOFT_BG = {
  healthy: 'bg-success/10',
  degraded: 'bg-warning/10',
  unhealthy: 'bg-danger/10',
  default: 'bg-default-100',
};

const STATUS_BORDER = {
  healthy: 'border-success',
  degraded: 'border-warning',
  unhealthy: 'border-danger',
  default: 'border-default-300',
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'healthy': return CheckCircle;
    case 'degraded': return AlertTriangle;
    case 'unhealthy': return XCircle;
    default: return Activity;
  }
};

function StatusIndicator({ title, status, icon }) {
  const IconEl = icon;
  const StatusIconComponent = getStatusIcon(status);
  const textClass = STATUS_ICON_CLASSES[status] || STATUS_ICON_CLASSES.default;
  const softBg = STATUS_SOFT_BG[status] || STATUS_SOFT_BG.default;
  const borderClass = STATUS_BORDER[status] || STATUS_BORDER.default;

  return (
    <Card className={`shadow-sm hover:shadow-md transition-all border-l-4 ${borderClass}`}>
      <Card.Content className="flex flex-row items-center gap-3 p-3 sm:p-4">
        <div className={`p-2 rounded-large shrink-0 ${softBg}`}>
          <IconEl className={`w-5 h-5 ${textClass}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-default-500 leading-tight truncate">{title}</p>
          <p className={`text-sm sm:text-base font-semibold leading-tight ${textClass}`}>
            {monitoreoServices.getStatusLabel(status)}
          </p>
        </div>
        <StatusIconComponent className={`w-5 h-5 shrink-0 ${textClass}`} />
      </Card.Content>
    </Card>
  );
}

function renderMonitoreoTabContent(activeTab, dashboard) {
  switch (activeTab) {
    case 'servidor':
      return <VistaServidor dashboard={dashboard} />;
    case 'database':
      return <VistaBaseDatos dashboard={dashboard} />;
    case 'http':
      return <VistaHttp dashboard={dashboard} />;
    case 'cron':
      return <VistaCronSocket dashboard={dashboard} />;
    case 'tendencias':
      return (
        <VistaTendencias
          initialData={dashboard?.recentHistory || []}
          isActive={activeTab === 'tendencias'}
        />
      );
    default:
      return null;
  }
}

export default function MonitoreoDashboard() {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshMs, setRefreshMs] = useState(30000);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('servidor');
  const [isMobileView, setIsMobileView] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  );

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!refreshMs) return undefined;
    const interval = setInterval(() => loadData(), refreshMs);
    return () => clearInterval(interval);
  }, [refreshMs, loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="text-default-600 mt-4">{t('monitoring.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6">
          <Card.Content className="text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-danger" />
            <p className="text-danger mb-4">{error}</p>
            <Button onPress={() => loadData(true)} color="primary" variant="solid">
              {t('monitoring.retry')}
            </Button>
          </Card.Content>
        </Card>
      </div>
    );
  }

  const overallStatus = dashboard?.overallStatus;
  const server = dashboard?.components?.server || {};
  const db = dashboard?.components?.database || {};

  const statusChipLabel = overallStatus === 'healthy'
    ? t('monitoring.statusChip.ok')
    : overallStatus === 'degraded'
      ? t('monitoring.statusChip.attention')
      : t('monitoring.statusChip.critical');

  return (
    <div className="p-3 sm:p-4 lg:p-6 mx-auto max-w-[1920px]">
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
              {t('monitoring.title')}
            </h1>
            <p className="text-sm sm:text-base text-default-600 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              {t('monitoring.subtitle')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Select
              aria-label={t('monitoring.refreshInterval')}
              value={String(refreshMs)}
              onChange={(v) => setRefreshMs(Number(v))}
              className="w-36"
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
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
              onPress={() => loadData(true)}
              isLoading={refreshing}
              color="primary"
              variant="solid"
            >
              <RefreshCw className="w-4 h-4" />
              {t('monitoring.refreshBtn')}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 lg:mb-6">
        <Card className={`shadow-lg border-2 ${
          overallStatus === 'healthy' ? 'border-success-200'
            : overallStatus === 'degraded' ? 'border-warning-200' : 'border-danger-200'
        }`}>
          <Card.Content className="flex flex-row items-center justify-between p-3 sm:p-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2.5 rounded-large shrink-0 ${STATUS_SOFT_BG[overallStatus] || STATUS_SOFT_BG.default}`}>
                {React.createElement(getStatusIcon(overallStatus), {
                  className: `w-7 h-7 ${STATUS_ICON_CLASSES[overallStatus] || STATUS_ICON_CLASSES.default}`,
                })}
              </div>
              <div className="flex flex-col min-w-0">
                <LabelWithTooltip
                  label={t('monitoring.overallStatus')}
                  tooltip={T.estadoGeneral}
                  className="text-xs text-default-500 leading-tight"
                />
                <span className={`text-base sm:text-lg font-bold leading-tight ${STATUS_ICON_CLASSES[overallStatus] || 'text-foreground'}`}>
                  {monitoreoServices.getStatusLabel(overallStatus)}
                </span>
                {dashboard?.reasons?.length > 0 && (
                  <p className="text-xs text-default-400 mt-1 truncate" title={dashboard.reasons.join(', ')}>
                    {dashboard.reasons.join(', ')}
                  </p>
                )}
              </div>
            </div>
            <Chip
              color={getStatusColor(overallStatus)}
              variant="flat"
              size="sm"
              className="shrink-0"
            >
              {statusChipLabel}
            </Chip>
          </Card.Content>
        </Card>
        <StatusIndicator title={t('monitoring.tabs.server')} status={server?.status} icon={Server} />
        <StatusIndicator title={t('monitoring.tabs.database')} status={db?.status} icon={Database} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 lg:mb-6">
        <Card className="shadow-sm">
          <Card.Content className="p-3">
            <QuickStatCard label={t('monitoring.stats.uptime')} icon={Clock} tooltip={T.uptime} />
            <p className="text-base font-bold tabular-nums">{server?.info?.uptimeFormatted || 'N/A'}</p>
          </Card.Content>
        </Card>
        <Card className="shadow-sm">
          <Card.Content className="p-3">
            <QuickStatCard label={t('monitoring.stats.pool')} icon={Database} tooltip={T.poolDb} />
            <p className="text-base font-bold tabular-nums">
              {db?.pool?.busyConnections ?? 0}/{db?.pool?.totalConnections ?? 0}
            </p>
          </Card.Content>
        </Card>
        <Card className="shadow-sm">
          <Card.Content className="p-3">
            <QuickStatCard label={t('monitoring.stats.heap')} icon={MemoryStick} tooltip={T.heap} />
            <p className="text-base font-bold tabular-nums">{server?.process?.memory?.heapLimitPercentage ?? 0}%</p>
          </Card.Content>
        </Card>
        <Card className="shadow-sm">
          <Card.Content className="p-3">
            <QuickStatCard label={t('monitoring.stats.updated')} icon={Activity} tooltip={T.actualizacion} />
            <p className="text-base font-bold tabular-nums">
              {lastUpdate ? lastUpdate.toLocaleTimeString() : 'N/A'}
            </p>
          </Card.Content>
        </Card>
      </div>

      {isMobileView ? (
        <div className="space-y-4">
          <Select
            aria-label={t('monitoring.section')}
            value={activeTab}
            onChange={(v) => setActiveTab(String(v))}
            className="w-full"
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {MONITOREO_TABS.map((tab) => (
                  <ListBox.Item key={tab.key} id={tab.key} textValue={t(tab.labelKey)}>
                    <span className="flex items-center gap-2">
                      {React.createElement(tab.icon, { className: 'w-4 h-4' })}
                      {t(tab.labelKey)}
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          {renderMonitoreoTabContent(activeTab, dashboard)}
        </div>
      ) : (
        <div className="space-y-4">
          <Tabs selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(String(k))}>
            <Tabs.List aria-label={t('monitoring.sections')}>
              {MONITOREO_TABS.map((tab) => (
                <Tabs.Tab key={tab.key} id={tab.key}>
                  <span className="flex items-center gap-1">
                    {React.createElement(tab.icon, { className: 'w-4 h-4' })}
                    {t(tab.labelKey)}
                  </span>
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
          <div className="pt-2">
            {renderMonitoreoTabContent(activeTab, dashboard)}
          </div>
        </div>
      )}
    </div>
  );
}
