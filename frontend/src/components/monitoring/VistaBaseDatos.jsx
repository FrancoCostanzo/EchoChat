import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, List, Zap, Database, Network } from 'lucide-react';
import { Card, Chip, Table } from '@heroui/react';
import { StatusCard, MetricItem, LabelWithTooltip } from './monitoreo.ui';
import { MONITOREO_TOOLTIPS as T, sortItems } from './monitoreo.helpers';

const VistaBaseDatos = ({ dashboard }) => {
  const db = dashboard?.components?.database || {};
  const dbDetails = dashboard?.databaseDetails || {};
  const qps = dashboard?.performance?.queriesPerSecond ?? 0;
  const pool = dbDetails?.poolStatus || db?.pool || {};

  const [sortCol, setSortCol] = useState('session_id');
  const [sortDir, setSortDir] = useState('ascending');

  const connectionRows = useMemo(() => {
    const rows = (dbDetails?.connectionCount?.connection_details || []).map((conn, id) => ({
      id,
      session_id: conn.session_id ?? 0,
      program_name: conn.program_name ?? '',
      host_name: conn.host_name ?? '',
      status: conn.status ?? '',
      database_name: conn.database_name ?? '',
    }));
    return sortItems(rows, { column: sortCol, direction: sortDir }, (item, col) => item[col]);
  }, [dbDetails?.connectionCount?.connection_details, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'ascending' ? 'descending' : 'ascending'));
    } else {
      setSortCol(col);
      setSortDir('ascending');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <StatusCard title="Base de Datos" status={db?.status} icon={Database}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-default-500 uppercase tracking-wider">Estado del Pool</h4>
            <MetricItem
              label="Conexiones Totales"
              value={pool?.totalConnections}
              unit={pool?.maxConnections ? `/ ${pool.maxConnections} max` : ''}
              progress={pool?.maxConnections ? (pool.totalConnections / pool.maxConnections) * 100 : null}
              icon={Network}
              tooltip={T.conexionesTotales}
            />
            <MetricItem label="Conexiones Ocupadas" value={pool?.busyConnections} icon={AlertCircle} tooltip={T.conexionesOcupadas} />
            <MetricItem label="Conexiones Libres" value={pool?.idleConnections} icon={CheckCircle} tooltip={T.conexionesLibres} />
            <MetricItem label="Peticiones en Espera" value={pool?.pendingRequests ?? 0} icon={Clock} tooltip={T.peticionesEspera} />
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-default-500 uppercase tracking-wider">Rendimiento</h4>
            <MetricItem
              label="Tiempo de Respuesta"
              value={db?.connection?.responseTime?.toFixed(2)}
              unit="ms"
              icon={Clock}
              tooltip={T.tiempoRespuestaDb}
            />
            <MetricItem
              label="Tamaño BD"
              value={dbDetails?.databaseSize?.size_mb}
              unit="MB"
              icon={Database}
              tooltip={T.tamanoBd}
            />
            <MetricItem label="Consultas/seg (real)" value={qps?.toFixed(2)} icon={Zap} tooltip={T.consultasSeg} />
          </div>
        </div>

        {dbDetails?.waitStats?.cumulativeSinceServerStart?.length > 0 && (
          <>
            <hr className="border-divider my-4" />
            <p className="text-xs text-default-400 mb-2">{dbDetails.waitStats.note}</p>
            <LabelWithTooltip
              label="Wait Stats (Top 5)"
              tooltip={T.waitStatsAcum}
              className="text-sm font-semibold text-default-500 uppercase tracking-wider mb-3 block"
            />
            <div className="space-y-3">
              {dbDetails.waitStats.cumulativeSinceServerStart.slice(0, 5).map((stat, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{stat.wait_type}</span>
                    <span className="text-default-400">{stat.waiting_tasks_count} tareas</span>
                  </div>
                  <span className="font-bold">{parseInt(stat.wait_time_ms, 10).toLocaleString()} ms</span>
                </div>
              ))}
            </div>
          </>
        )}

        {Array.isArray(dbDetails?.currentWaits) && dbDetails.currentWaits.length > 0 && (
          <>
            <hr className="border-divider my-4" />
            <LabelWithTooltip
              label="Waits Actuales (tiempo real)"
              tooltip={T.waitsActuales}
              className="text-sm font-semibold text-default-500 uppercase tracking-wider mb-3 block"
            />
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {dbDetails.currentWaits.map((w, idx) => (
                <div key={idx} className="flex justify-between text-xs border-b border-divider pb-1">
                  <span className="font-mono">{w.session_id} · {w.wait_type}</span>
                  <span>{w.wait_time} ms</span>
                </div>
              ))}
            </div>
          </>
        )}
      </StatusCard>

      <Card className="h-full">
        <Card.Header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <List className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Conexiones Activas</h3>
          </div>
          <Chip size="sm" variant="flat">
            {dbDetails?.connectionCount?.active_connections || 0} activas
          </Chip>
        </Card.Header>
        <hr className="border-divider" />
        <Card.Content className="p-0">
          {connectionRows.length > 0 ? (
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Conexiones activas" className="min-w-[520px]">
                  <Table.Header>
                    {['session_id', 'program_name', 'host_name', 'status', 'database_name'].map((col) => (
                      <Table.Column key={col} isRowHeader={col === 'session_id'}>
                        <button type="button" className="text-xs font-semibold uppercase" onClick={() => toggleSort(col)}>
                          {col === 'session_id' ? 'ID' : col === 'program_name' ? 'Programa' : col === 'host_name' ? 'Host' : col === 'status' ? 'Estado' : 'BD'}
                          {sortCol === col ? (sortDir === 'ascending' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </Table.Column>
                    ))}
                  </Table.Header>
                  <Table.Body>
                    {connectionRows.map((item) => (
                      <Table.Row key={item.id} id={String(item.id)}>
                        <Table.Cell><span className="font-mono">{item.session_id}</span></Table.Cell>
                        <Table.Cell>
                          <span className="block truncate max-w-[150px]" title={item.program_name}>{item.program_name}</span>
                        </Table.Cell>
                        <Table.Cell>{item.host_name}</Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" color={item.status === 'active' ? 'success' : 'default'} variant="dot">
                            {item.status}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>{item.database_name}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : (
            <div className="p-8 text-center text-sm text-default-500">No hay detalles de conexión disponibles</div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};

export default VistaBaseDatos;
