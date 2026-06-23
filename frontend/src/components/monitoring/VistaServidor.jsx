import {
  Activity, TrendingUp, Server, Cpu, MemoryStick, HardDrive, Monitor, Terminal,
} from 'lucide-react';
import { StatusCard, MetricItem } from './monitoreo.ui';
import { formatMicroseconds, MONITOREO_TOOLTIPS as T } from './monitoreo.helpers';
import monitoreoServices from '@/services/monitoring/monitoring.service';

const VistaServidor = ({ dashboard }) => {
  const server = dashboard?.components?.server || {};
  const build = dashboard?.build || {};
  const processCpu = server?.process?.cpu?.process || {};
  const heapLimitPct = server?.process?.memory?.heapLimitPercentage || 0;
  const sysMemUsedPct = server?.system?.memory?.usedPercentage || 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <StatusCard title="Servidor y Sistema" status={server?.status} icon={Server}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-default-500 uppercase tracking-wider">Hardware</h4>
            <MetricItem label="CPU Modelo" value={server?.system?.cpus?.model} icon={Cpu} />
            <MetricItem label="Núcleos" value={server?.system?.cpus?.count} unit="cores" icon={Cpu} />
            <MetricItem label="Velocidad" value={server?.system?.cpus?.speed} unit="MHz" icon={Activity} />
            <MetricItem label="Memoria Total" value={server?.system?.memory?.total} icon={MemoryStick} />
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-default-500 uppercase tracking-wider">Software</h4>
            <MetricItem label="Hostname" value={server?.system?.hostname} icon={Monitor} />
            <MetricItem label="Plataforma" value={`${server?.info?.platform} (${server?.info?.arch})`} icon={Monitor} />
            <MetricItem label="Node Version" value={server?.info?.nodeVersion} icon={Terminal} />
            <MetricItem label="Versión App" value={build?.version} icon={Server} />
            <MetricItem label="PID" value={server?.process?.pid} icon={Activity} />
          </div>
        </div>
        <hr className="border-divider my-2" />
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-default-500 uppercase tracking-wider">Recursos del Sistema</h4>
          <MetricItem
            label="Uso de Memoria (Sistema)"
            value={server?.system?.memory?.used}
            unit={`/ ${server?.system?.memory?.total}`}
            progress={sysMemUsedPct}
            icon={HardDrive}
            tooltip={T.memoriaSistema}
          />
          <MetricItem
            label="Carga Promedio (1m, 5m, 15m)"
            value={
              server?.system?.loadAverageSupported === false
                ? 'No disponible en Windows'
                : server?.system?.loadAverage?.map((n) => n.toFixed(2)).join(', ')
            }
            icon={TrendingUp}
            tooltip={T.cargaPromedio}
          />
        </div>
      </StatusCard>

      <StatusCard title="Proceso Node.js" status={server?.status} icon={Terminal}>
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-default-500 uppercase tracking-wider">Memoria del Proceso</h4>
          <MetricItem
            label="Heap Usado"
            value={server?.process?.memory?.heapUsed}
            unit={`/ ${server?.process?.memory?.heapLimit ?? server?.process?.memory?.heapTotal} límite`}
            progress={heapLimitPct}
            icon={MemoryStick}
            subtext={`Segmento V8: ${server?.process?.memory?.heapUsed} / ${server?.process?.memory?.heapTotal} (${server?.process?.memory?.heapUsedPercentage ?? 0}% del segmento)`}
            tooltip={T.heapUsado}
          />
          <MetricItem label="RSS" value={server?.process?.memory?.rss} icon={HardDrive} tooltip={T.rss} />
          <MetricItem label="Memoria Externa" value={server?.process?.memory?.external} icon={MemoryStick} tooltip={T.memoriaExterna} />
        </div>
        <hr className="border-divider my-2" />
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-default-500 uppercase tracking-wider">CPU del Proceso</h4>
          <MetricItem
            label="Uso de CPU"
            value={processCpu?.usage?.toFixed(2)}
            unit="%"
            progress={processCpu?.usage}
            icon={Activity}
            tooltip={T.usoCpu}
          />
          <div className="grid grid-cols-2 gap-4">
            <MetricItem label="Tiempo Usuario" value={formatMicroseconds(processCpu?.user)} icon={Activity} />
            <MetricItem label="Tiempo Sistema" value={formatMicroseconds(processCpu?.system)} icon={Activity} />
          </div>
        </div>
        <hr className="border-divider my-2" />
        <MetricItem
          label="Uptime proceso"
          value={build?.processUptimeFormatted || monitoreoServices.formatUptime(build?.processUptime)}
          icon={Activity}
          tooltip={T.uptime}
        />
      </StatusCard>
    </div>
  );
};

export default VistaServidor;
