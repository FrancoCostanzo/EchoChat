import { useMemo, type ComponentType } from 'react';
import {
  Activity, Bot, CheckCircle2, Clock, Hand, Package, Power, Radio, Timer, Users, Wifi, XCircle,
} from 'lucide-react';
import { Card, Chip, Table } from '@heroui/react';
import { LabelWithTooltip, StatBlock, TableColumnHeader } from './monitoreo.ui';
import { MONITOREO_TOOLTIPS as T, sortItems } from './monitoreo.helpers';
import type { DashboardData } from '@/types/monitoring';

type ChipColor = 'default' | 'accent' | 'success' | 'warning' | 'danger';
type IconType = ComponentType<{ className?: string }>;

const RESULTADO_ORDEN: Record<string, number> = { success: 1, error: 2, pendiente: 3 };
const RESULTADO_ICON: Record<string, IconType> = { success: CheckCircle2, error: XCircle, pendiente: Clock };
const RESULTADO_LABEL: Record<string, string> = { success: 'success', error: 'error', pendiente: 'pendiente' };

const getResultadoColor = (resultado: string): ChipColor => {
  if (resultado === 'success') return 'success';
  if (resultado === 'error') return 'danger';
  return 'default';
};

interface CronRow {
  id: number;
  key: string;
  descripcion: string;
  ultimaEjecucionTs: number;
  ultimaEjecucionLabel: string;
  origen: string;
  resultado: string;
}

const getCronSortValue = (item: CronRow, column: string): unknown => {
  switch (column) {
    case 'ultimaEjecucion':
      return item.ultimaEjecucionTs;
    case 'resultado':
      return RESULTADO_ORDEN[item.resultado] ?? 99;
    default:
      return item[column as keyof CronRow];
  }
};

interface SocketStatProps {
  icon: IconType;
  label: string;
  value: number;
  tooltip?: string;
  boxClass: string;
  iconClass: string;
  live?: boolean;
}

function SocketStat({ icon, label, value, tooltip, boxClass, iconClass, live = false }: SocketStatProps) {
  const IconEl = icon;
  return (
    <div className="flex items-center gap-3 rounded-large bg-default-50 dark:bg-default-100/5 p-4">
      <div className={`relative p-2.5 rounded-large shrink-0 ${boxClass}`}>
        <IconEl className={`w-5 h-5 ${iconClass}`} />
        {live && value > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
          </span>
        )}
      </div>
      <div className="flex flex-col min-w-0">
        <LabelWithTooltip label={label} tooltip={tooltip} className="text-xs font-medium text-default-500 uppercase tracking-wide" />
        <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
      </div>
    </div>
  );
}

interface WorkerStateRowProps {
  icon: IconType;
  label: string;
  color: ChipColor;
  text: string;
}

function WorkerStateRow({ icon, label, color, text }: WorkerStateRowProps) {
  const IconEl = icon;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="flex items-center gap-2 text-sm text-default-600">
        <IconEl className="w-4 h-4 text-default-400" />
        {label}
      </span>
      <Chip color={color} variant="soft" size="sm">{text}</Chip>
    </div>
  );
}

const VistaCronSocket = ({ dashboard }: { dashboard?: DashboardData | null }) => {
  const socket = dashboard?.socket;
  const cronWorker = dashboard?.cronWorker;
  const build = dashboard?.build;

  const cronRows = useMemo(() => {
    const jobs = dashboard?.cronJobs || {};
    const rows: CronRow[] = Object.entries(jobs).map(([key, job], id) => ({
      id,
      key,
      descripcion: job.descripcion || key,
      ultimaEjecucionTs: job.ultimaEjecucion ? new Date(job.ultimaEjecucion).getTime() : 0,
      ultimaEjecucionLabel: job.ultimaEjecucion ? new Date(job.ultimaEjecucion).toLocaleString() : 'Nunca',
      origen: job.origen || '-',
      resultado: job.resultado || 'pendiente',
    }));
    return sortItems(rows, { column: 'ultimaEjecucion', direction: 'descending' }, getCronSortValue);
  }, [dashboard?.cronJobs]);

  const successCount = cronRows.filter((r) => r.resultado === 'success').length;
  const errorCount = cronRows.filter((r) => r.resultado === 'error').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <Card.Header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Socket.IO</h3>
            </div>
            <Chip size="sm" variant="soft" color={(socket?.activeSockets ?? 0) > 0 ? 'success' : 'default'}>
              {(socket?.activeSockets ?? 0) > 0 ? 'En vivo' : 'Sin conexiones'}
            </Chip>
          </Card.Header>
          <hr className="border-divider" />
          <Card.Content className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SocketStat icon={Radio} label="Sockets activos" value={socket?.activeSockets ?? 0} tooltip={T.socketsActivos} boxClass="bg-primary/10" iconClass="text-primary" live />
              <SocketStat icon={Users} label="Usuarios únicos" value={socket?.uniqueUsers ?? 0} tooltip={T.usuariosUnicos} boxClass="bg-secondary/10" iconClass="text-secondary" />
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-secondary" />
              <LabelWithTooltip label="Cron Jobs" tooltip={T.cronWorker} className="text-lg font-semibold" />
            </div>
          </Card.Header>
          <hr className="border-divider" />
          <Card.Content className="p-4 space-y-1 divide-y divide-divider">
            <WorkerStateRow icon={Power} label="Modo" color={cronWorker?.enabled ? 'accent' : 'default'} text={cronWorker?.enabled ? 'Producción' : 'Todos los entornos'} />
            <WorkerStateRow icon={Activity} label="Proceso" color={cronWorker?.running ? 'success' : 'danger'} text={cronWorker?.running ? 'Corriendo' : 'Detenido'} />
            <WorkerStateRow icon={CheckCircle2} label="Inicialización" color={cronWorker?.ready ? 'success' : 'warning'} text={cronWorker?.ready ? 'Listo' : 'No listo'} />
            {cronWorker?.note && <p className="text-xs text-default-400 pt-3">{cronWorker?.note}</p>}
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header className="flex items-center justify-between">
          <LabelWithTooltip label="Tareas Programadas" tooltip={T.tareasProgramadas} className="text-lg font-semibold" />
          {cronRows.length > 0 && (
            <div className="flex items-center gap-2">
              <Chip size="sm" variant="soft" color="success">{successCount} ok</Chip>
              {errorCount > 0 && <Chip size="sm" variant="soft" color="danger">{errorCount} con error</Chip>}
            </div>
          )}
        </Card.Header>
        <hr className="border-divider" />
        <Card.Content className="p-0">
          {cronRows.length > 0 ? (
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Tareas cron" className="min-w-[560px]">
                  <Table.Header>
                    <Table.Column isRowHeader>Tarea</Table.Column>
                    <Table.Column>Última ejecución</Table.Column>
                    <Table.Column><TableColumnHeader label="Origen" tooltip={T.cronOrigen} /></Table.Column>
                    <Table.Column className="text-center"><TableColumnHeader label="Resultado" tooltip={T.cronResultado} /></Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {cronRows.map((item) => {
                      const Icon = RESULTADO_ICON[item.resultado] || Clock;
                      return (
                        <Table.Row key={item.id} id={String(item.id)}>
                          <Table.Cell className="font-medium">{item.descripcion}</Table.Cell>
                          <Table.Cell className="text-xs tabular-nums">{item.ultimaEjecucionLabel}</Table.Cell>
                          <Table.Cell>
                            {item.origen === 'manual' ? (
                              <Chip size="sm" variant="soft" color="default"><Hand className="w-3 h-3 inline" /> Manual</Chip>
                            ) : item.origen === 'automatica' ? (
                              <Chip size="sm" variant="soft" color="accent"><Bot className="w-3 h-3 inline" /> Automática</Chip>
                            ) : '—'}
                          </Table.Cell>
                          <Table.Cell className="text-center">
                            <Chip size="sm" color={getResultadoColor(item.resultado)} variant="soft">
                              <Icon className="w-3 h-3 inline" /> {RESULTADO_LABEL[item.resultado] || item.resultado}
                            </Chip>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : (
            <div className="p-8 text-center text-sm text-default-500">Sin tareas cron registradas</div>
          )}
        </Card.Content>
      </Card>

      {build && Object.keys(build).length > 0 && (
        <Card className="bg-default-50">
          <Card.Header className="flex items-center gap-2 pb-0">
            <Package className="w-4 h-4 text-default-500" />
            <h3 className="text-sm font-semibold text-default-600 uppercase tracking-wide">Build</h3>
          </Card.Header>
          <Card.Content className="p-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBlock label="Versión" value={build?.version} unit="" />
              <StatBlock label="Entorno" value={build?.environment} unit="" />
              <StatBlock label="Rama" value={build?.gitBranch || 'N/A'} unit="" />
              <StatBlock label="Git SHA" value={build?.gitSha || 'N/A'} unit="" tooltip={build?.gitShaFull} className="font-mono" />
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
};

export default VistaCronSocket;
