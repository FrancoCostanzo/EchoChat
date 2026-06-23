import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Gauge, ShieldAlert, Timer, Zap } from 'lucide-react';
import {
  Card, Chip, ListBox, Select, Table, Tooltip,
} from '@heroui/react';
import {
  MONITOREO_TOOLTIPS as T,
  sortItems,
  STATUS_BG_CLASSES,
  STATUS_TEXT_CLASSES,
} from './monitoreo.helpers';
import { LabelWithTooltip, HttpRouteLabel, TableColumnHeader } from './monitoreo.ui';

const ACCENT_BG = { ...STATUS_BG_CLASSES, primary: 'bg-primary-50 dark:bg-primary-900/20' };
const ACCENT_TEXT = { ...STATUS_TEXT_CLASSES, primary: 'text-primary' };
const BAR_BG = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  primary: 'bg-primary',
  default: 'bg-default-300',
};

const latencyColor = (ms) => {
  if (ms == null) return 'default';
  if (ms < 300) return 'success';
  if (ms < 1000) return 'warning';
  return 'danger';
};

const errorRateColor = (pct) => {
  if (pct == null) return 'default';
  if (pct < 1) return 'success';
  if (pct < 5) return 'warning';
  return 'danger';
};

function KpiCard({ icon, label, tooltip, value, unit, accent = 'primary', colorValue = false, footer }) {
  const IconEl = icon;
  return (
    <Card className="border border-default-100 shadow-sm">
      <Card.Content className="p-4 gap-2">
        <div className="flex items-start justify-between gap-2">
          <LabelWithTooltip label={label} tooltip={tooltip} className="text-xs font-medium text-default-500" />
          <div className={`p-1.5 rounded-medium shrink-0 ${ACCENT_BG[accent]}`}>
            <IconEl className={`w-4 h-4 ${ACCENT_TEXT[accent]}`} />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold tabular-nums ${colorValue ? ACCENT_TEXT[accent] : 'text-foreground'}`}>
            {value}
          </span>
          {unit && <span className="text-sm font-medium text-default-400">{unit}</span>}
        </div>
        {footer && <div className="text-xs text-default-400">{footer}</div>}
      </Card.Content>
    </Card>
  );
}

function LatencyBar({ label, caption, value, tooltip, max }) {
  const color = latencyColor(value);
  const pct = max > 0 ? Math.min(100, ((value ?? 0) / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <LabelWithTooltip label={label} tooltip={tooltip} className="text-xs font-semibold text-default-600 uppercase tracking-wide" />
          <span className="text-[11px] text-default-400">{caption}</span>
        </div>
        <span className={`text-lg font-bold tabular-nums ${STATUS_TEXT_CLASSES[color]}`}>
          {value ?? 'N/A'}
          <span className="text-xs font-normal text-default-400 ml-0.5">ms</span>
        </span>
      </div>
      <div className="w-full h-2 bg-default-100 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full ${BAR_BG[color]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const VistaHttp = ({ dashboard }) => {
  const http = dashboard?.http || {};
  const [routeLimit, setRouteLimit] = useState('10');

  const allRoutes = http.routes || http.topRoutes || [];

  const routeRows = useMemo(() => {
    const limited = routeLimit === 'all' ? allRoutes : allRoutes.slice(0, 10);
    return sortItems(
      limited.map((r, id) => ({
        id,
        route: r.route,
        count: r.count ?? 0,
        avgMs: r.avgMs ?? 0,
        p95Ms: r.p95Ms ?? 0,
      })),
      { column: 'p95Ms', direction: 'descending' },
      (item, col) => item[col],
    );
  }, [allRoutes, routeLimit]);

  const errorRows = useMemo(() => (
    (http.recentErrors5xx || []).map((err, id) => ({
      id,
      route: err.route,
      statusCode: err.statusCode ?? 0,
      message: err.message || null,
      timestampLabel: err.timestamp ? new Date(err.timestamp).toLocaleTimeString() : '—',
    }))
  ), [http.recentErrors5xx]);

  const latencyMax = Math.max(http.latency?.p99 ?? 0, 1);
  const errorAccent = errorRateColor(http.errorRatePct);
  const has5xx = (http.error5xx ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Activity} label="Total Requests" tooltip={T.totalRequests} accent="primary" value={http.totalRequests?.toLocaleString() ?? 0} footer="desde el arranque" />
        <KpiCard icon={Gauge} label="Req/min" tooltip={T.reqPorMin} accent="primary" value={http.requestsPerMinute ?? 0} footer="ventana de 60 s" />
        <KpiCard icon={AlertTriangle} label="Error Rate" tooltip={T.errorRate} accent={errorAccent} colorValue value={(http.errorRatePct ?? 0).toFixed(2)} unit="%" footer={`4xx: ${http.error4xx ?? 0} · 5xx: ${http.error5xx ?? 0}`} />
        <KpiCard icon={ShieldAlert} label="Errores 5xx" tooltip={T.errores5xx} accent={has5xx ? 'danger' : 'success'} colorValue value={http.error5xx ?? 0} footer={has5xx ? 'requieren atención' : 'sin errores internos'} />
      </div>

      <Card>
        <Card.Header className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-primary" />
          <LabelWithTooltip label="Latencia HTTP" tooltip={T.latenciaHttp} className="text-lg font-semibold" />
        </Card.Header>
        <hr className="border-divider" />
        <Card.Content className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <LatencyBar label="p50" caption="experiencia típica" value={http.latency?.p50} tooltip={T.p50} max={latencyMax} />
            <LatencyBar label="p95" caption="picos habituales" value={http.latency?.p95} tooltip={T.p95} max={latencyMax} />
            <LatencyBar label="p99" caption="peor escenario" value={http.latency?.p99} tooltip={T.p99} max={latencyMax} />
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning" />
            <LabelWithTooltip label="Rutas más lentas (p95)" tooltip={T.rutasLentas} className="text-lg font-semibold" />
          </div>
          <Select value={routeLimit} onChange={(v) => setRouteLimit(String(v))} className="w-28" aria-label="Cantidad de rutas">
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="10" textValue="Top 10">Top 10<ListBox.ItemIndicator /></ListBox.Item>
                <ListBox.Item id="all" textValue="Todas">Todas<ListBox.ItemIndicator /></ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </Card.Header>
        <hr className="border-divider" />
        <Card.Content className="p-0">
          {routeRows.length > 0 ? (
            <Table.ScrollContainer>
              <Table.Content aria-label="Rutas HTTP más lentas" className="min-w-[520px]">
                <Table.Header>
                  <Table.Column isRowHeader><TableColumnHeader label="Ruta" tooltip={T.rutasLentas} /></Table.Column>
                  <Table.Column className="text-end"><TableColumnHeader label="Muestras" tooltip={T.muestras} /></Table.Column>
                  <Table.Column className="text-end"><TableColumnHeader label="Avg" tooltip={T.avg} /></Table.Column>
                  <Table.Column className="text-end"><TableColumnHeader label="p95" tooltip={T.p95} /></Table.Column>
                </Table.Header>
                <Table.Body>
                  {routeRows.map((item) => (
                    <Table.Row key={item.id} id={String(item.id)}>
                      <Table.Cell><HttpRouteLabel route={item.route} /></Table.Cell>
                      <Table.Cell className="text-right tabular-nums">{item.count}</Table.Cell>
                      <Table.Cell className="text-right tabular-nums">{item.avgMs} ms</Table.Cell>
                      <Table.Cell className={`text-right font-semibold tabular-nums ${STATUS_TEXT_CLASSES[latencyColor(item.p95Ms)]}`}>
                        {item.p95Ms} ms
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          ) : (
            <div className="p-8 text-center text-default-500">Sin datos de rutas aún</div>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 ${errorRows.length ? 'text-danger' : 'text-default-400'}`} />
          <LabelWithTooltip label="Últimos errores 5xx" tooltip={T.errores5xx} className="text-lg font-semibold" />
        </Card.Header>
        <hr className="border-divider" />
        <Card.Content className="p-0">
          {errorRows.length > 0 ? (
            <Table.ScrollContainer>
              <Table.Content aria-label="Errores 5xx" className="min-w-[480px]">
                <Table.Header>
                  <Table.Column isRowHeader>Ruta</Table.Column>
                  <Table.Column className="text-center">Código</Table.Column>
                  <Table.Column className="text-end">Hora</Table.Column>
                </Table.Header>
                <Table.Body>
                  {errorRows.map((item) => (
                    <Table.Row key={item.id} id={String(item.id)}>
                      <Table.Cell><HttpRouteLabel route={item.route} /></Table.Cell>
                      <Table.Cell className="text-center">
                        <Tooltip content={item.message || `HTTP ${item.statusCode}`} placement="top">
                          <Chip size="sm" color="danger" variant="flat">{item.statusCode}</Chip>
                        </Tooltip>
                      </Table.Cell>
                      <Table.Cell className="text-right tabular-nums">{item.timestampLabel}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          ) : (
            <div className="p-8 text-center text-default-500">Sin errores 5xx registrados</div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};

export default VistaHttp;
