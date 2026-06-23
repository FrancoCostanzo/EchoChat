import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Spinner } from '@heroui/react';
import { AlertTriangle, RotateCcw, ZoomOut } from 'lucide-react';
import { Chart } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import LineChart from './LineChart.jsx';
import monitoreoServices from '@/services/monitoring/monitoring.service';
import { MONITOREO_TOOLTIPS as T } from './monitoreo.helpers.js';
import { LabelWithTooltip } from './monitoreo.ui.jsx';

/**
 * Plugin que marca eventos sobre el gráfico:
 *  - cortes (huecos sin datos): banda ámbar con bordes punteados cuyo ANCHO es
 *    proporcional a la duración del corte (con tope), leyendo
 *    options.plugins.gapHighlight.gaps = [{ start, end, label }] donde start/end
 *    son los índices de los slots nulos. La etiqueta muestra la duración.
 *  - reinicios del proceso: línea vertical violeta punteada con un marcador
 *    triangular arriba, leyendo options.plugins.gapHighlight.restarts.
 * No hace nada si no recibe nada, así no afecta a otros gráficos.
 */
const gapHighlightPlugin = {
    id: 'gapHighlight',
    beforeDatasetsDraw(chart, _args, opts) {
        const gaps = opts?.gaps ?? [];
        const restarts = opts?.restarts ?? [];
        if (!gaps.length && !restarts.length) return;

        const { ctx, chartArea: { top, bottom } } = chart;
        const points = chart.getDatasetMeta(0)?.data;
        if (!points) return;

        ctx.save();

        // Cortes (bandas de ancho proporcional a la duración)
        gaps.forEach(({ start, end, label }) => {
            const xPrev = points[start - 1]?.x;
            const xNext = points[end + 1]?.x;
            if (xPrev == null || xNext == null) return;

            const left = Math.min(xPrev, xNext);
            const width = Math.abs(xNext - xPrev);

            ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
            ctx.fillRect(left, top, width, bottom - top);

            ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            [xPrev, xNext].forEach((xp) => {
                ctx.beginPath();
                ctx.moveTo(xp, top);
                ctx.lineTo(xp, bottom);
                ctx.stroke();
            });

            if (label) {
                ctx.setLineDash([]);
                ctx.fillStyle = 'rgba(180, 83, 9, 0.95)';
                ctx.font = '600 9px sans-serif';
                const cx = left + width / 2;
                if (width > 22) {
                    // Banda ancha: etiqueta horizontal arriba.
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(label, cx, top + 3);
                } else {
                    // Banda angosta: etiqueta rotada para que siempre se lea.
                    ctx.save();
                    ctx.translate(cx, (top + bottom) / 2);
                    ctx.rotate(-Math.PI / 2);
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(label, 0, 0);
                    ctx.restore();
                }
            }
        });

        // Reinicios (líneas verticales con la hora rotada al lado)
        restarts.forEach((ri) => {
            const index = typeof ri === 'number' ? ri : ri.index;
            const label = typeof ri === 'number' ? null : ri.label;
            const x = points[index]?.x;
            if (x == null) return;

            ctx.strokeStyle = 'rgba(109, 40, 217, 0.7)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(109, 40, 217, 0.9)';
            ctx.beginPath();
            ctx.moveTo(x - 4, top);
            ctx.lineTo(x + 4, top);
            ctx.lineTo(x, top + 6);
            ctx.closePath();
            ctx.fill();

            if (label) {
                ctx.save();
                ctx.fillStyle = 'rgba(109, 40, 217, 0.95)';
                ctx.font = '600 9px sans-serif';
                ctx.translate(x + 4, top + (bottom - top) * 0.28);
                ctx.rotate(-Math.PI / 2);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`⟲ ${label}`, 0, 0);
                ctx.restore();
            }
        });

        ctx.restore();
    }
};

Chart.register(gapHighlightPlugin, zoomPlugin);

const RANGES = [
    { key: '1h', label: '1h' },
    { key: '6h', label: '6h' },
    { key: '24h', label: '24h' },
    { key: '7d', label: '7d' }
];

const CHART_HEIGHT = 224;

/** Cadencia esperada del collector (snapshot cada ~5 min). */
const EXPECTED_INTERVAL_MS = 5 * 60 * 1000;
/** Se considera "corte" si el hueco supera la cadencia esperada por este factor… */
const GAP_FACTOR = 3;
/** …y además dura al menos este mínimo absoluto. */
const GAP_MIN_MS = 15 * 60 * 1000;
/** Tope de slots vacíos por corte: el ancho es proporcional a la duración,
 *  pero acotado para que un corte de muchas horas no domine el gráfico. */
const MAX_GAP_SLOTS = 14;

const METRIC_KEYS = [
    'heap_pct', 'mem_sistema_pct', 'cpu_proceso_pct',
    'latencia_db_ms', 'qps', 'requests_por_min', 'error_rate_pct'
];

/** Paleta alineada con los informes de producción (Chart.js) */
const METRICS = [
    { key: 'heap_pct', label: 'Heap %', color: '#0074BD', tooltip: T.heapPct },
    { key: 'mem_sistema_pct', label: 'Mem SO %', color: '#7C3AED', tooltip: T.memSistemaPct },
    { key: 'cpu_proceso_pct', label: 'CPU %', color: '#F59E0B', tooltip: T.cpuProcesoPct },
    { key: 'latencia_db_ms', label: 'Latencia DB (ms)', color: '#16A34A', tooltip: T.latenciaDbMs },
    { key: 'qps', label: 'QPS', color: '#EF4444', tooltip: T.qps },
    { key: 'requests_por_min', label: 'Req/min', color: '#374151', tooltip: T.requestsPorMin },
    { key: 'error_rate_pct', label: 'Error rate %', color: '#DC2626', tooltip: T.errorRatePct }
];

const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const fmtFull = (d) => `${fmtDate(d)} ${fmtTime(d)}`;

const formatDuration = (ms) => {
    const totalMin = Math.round(ms / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const minutes = totalMin % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

const fmtRelative = (d) => {
    const diff = Date.now() - d.getTime();
    if (diff < 0) return 'programado';
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'hace instantes';
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} d`;
};

const toRow = (row) => {
    const ts = new Date(row.fecha_registro);
    const numeric = {};
    METRIC_KEYS.forEach((k) => { numeric[k] = Number(row[k]); });
    // Instante de arranque del proceso (ms) — null si la fila es vieja sin la columna.
    const procesoInicio = row.proceso_inicio ? new Date(row.proceso_inicio).getTime() : null;
    return { ...row, ts, procesoInicio, ...numeric };
};

const emptyMetrics = () => Object.fromEntries(METRIC_KEYS.map((k) => [k, null]));

/**
 * ¿Hubo un reinicio entre dos snapshots consecutivos?
 * Autoritativo: si proceso_inicio cambió, el proceso se reinició. Si falta el
 * dato (filas viejas previas a la columna), cae a la heurística del heap
 * (caída brusca a casi 0 = heap recién arrancado).
 */
const detectRestart = (prev, row) => {
    if (prev.procesoInicio != null && row.procesoInicio != null) {
        return prev.procesoInicio !== row.procesoInicio;
    }
    return Number.isFinite(prev.heap_pct) && Number.isFinite(row.heap_pct)
        && prev.heap_pct - row.heap_pct >= 40 && row.heap_pct <= 15;
};

/**
 * Ordena los snapshots y detecta los cortes (huecos sin datos). Por cada corte
 * inserta N slots nulos —proporcionales a su duración, acotados a MAX_GAP_SLOTS—
 * para que la línea se rompa y la banda tenga un ancho que refleje cuánto duró.
 * También marca reinicios del proceso (ver detectRestart).
 */
const buildSeries = (rawRows) => {
    const rows = rawRows.map(toRow).sort((a, b) => a.ts - b.ts);
    const series = [];
    const gaps = [];
    const gapSpans = [];
    const restarts = [];
    const restartIndices = [];
    let prevDay = null;

    rows.forEach((row, i) => {
        if (i > 0) {
            const prev = rows[i - 1];
            const delta = row.ts - prev.ts;
            if (delta >= GAP_MIN_MS && delta > EXPECTED_INTERVAL_MS * GAP_FACTOR) {
                gaps.push({ from: prev.ts, to: row.ts, ms: delta });
                // Slots faltantes ≈ duración / cadencia, acotado para no dominar.
                const missing = Math.round(delta / EXPECTED_INTERVAL_MS) - 1;
                const slots = Math.min(Math.max(missing, 1), MAX_GAP_SLOTS);
                const start = series.length;
                for (let s = 0; s < slots; s += 1) {
                    series.push({ gap: true, axisLabel: '', fullLabel: null, ...emptyMetrics() });
                }
                gapSpans.push({ start, end: series.length - 1, ms: delta, label: formatDuration(delta) });
            }

            // Reinicio: independiente del corte (un reinicio suele coincidir con
            // un hueco — el server estuvo caído y volvió como proceso nuevo).
            if (detectRestart(prev, row)) {
                restarts.push({
                    at: row.ts,
                    startedAt: row.procesoInicio ? new Date(row.procesoInicio) : null
                });
                restartIndices.push(series.length);
            }
        }

        const day = row.ts.toDateString();
        const showDate = day !== prevDay;
        prevDay = day;

        series.push({
            ...row,
            axisLabel: showDate ? fmtFull(row.ts) : fmtTime(row.ts),
            fullLabel: fmtFull(row.ts)
        });
    });

    // Marcadores para el gráfico: índice + hora a dibujar junto a la línea.
    const restartMarkers = restarts.map((rs, i) => ({
        index: restartIndices[i],
        label: fmtTime(rs.startedAt ?? new Date(rs.at))
    }));

    return { series, gaps, gapSpans, restarts, restartIndices, restartMarkers };
};

const buildChartJsData = (metric, series) => ({
    labels: series.map((row) => row.axisLabel),
    datasets: [{
        label: metric.label,
        data: series.map((row) => row[metric.key]),
        borderColor: metric.color,
        backgroundColor: metric.color,
        tension: 0.3,
        fill: false,
        spanGaps: false,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2
    }]
});

const buildChartOptions = (metric, fullLabels, gapSpans, restartMarkers) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        datalabels: { display: false },
        title: { display: false },
        gapHighlight: { gaps: gapSpans, restarts: restartMarkers },
        tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
                title: (items) => fullLabels[items[0]?.dataIndex] ?? ''
            }
        },
        zoom: {
            // Arrastrar = zoom de caja · rueda = zoom · Shift+arrastrar = desplazar.
            pan: { enabled: true, mode: 'x', modifierKey: 'shift' },
            zoom: {
                wheel: { enabled: true, speed: 0.1 },
                drag: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 116, 189, 0.15)',
                    borderColor: 'rgba(0, 116, 189, 0.6)',
                    borderWidth: 1
                },
                pinch: { enabled: true },
                mode: 'x'
            }
        }
    },
    scales: {
        x: {
            ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
            grid: { display: false }
        },
        y: {
            beginAtZero: true,
            ticks: { font: { size: 10 } },
            title: { display: true, text: metric.label, font: { size: 11 } }
        }
    }
});

const MetricChart = ({ metric, series, fullLabels, gapSpans, restartMarkers }) => {
    const chartRef = useRef(null);
    const chartData = useMemo(() => buildChartJsData(metric, series), [metric, series]);
    const chartOptions = useMemo(
        () => buildChartOptions(metric, fullLabels, gapSpans, restartMarkers),
        [metric, fullLabels, gapSpans, restartMarkers]
    );

    const resetZoom = () => chartRef.current?.resetZoom?.();

    return (
        <Card>
            <Card.Header className="pb-0 flex items-center justify-between gap-2">
                <LabelWithTooltip label={metric.label} tooltip={metric.tooltip} className="text-sm font-semibold" />
                <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={resetZoom}
                    aria-label="Restablecer zoom"
                    title="Restablecer zoom (o doble clic en el gráfico)"
                >
                    <ZoomOut className="w-4 h-4 text-default-500" />
                </Button>
            </Card.Header>
            <hr className="border-divider" />
            <Card.Content className="p-2">
                <div
                    className="w-full min-w-0"
                    style={{ height: CHART_HEIGHT }}
                    onDoubleClick={resetZoom}
                >
                    <LineChart ref={chartRef} data={chartData} options={chartOptions} height={CHART_HEIGHT} />
                </div>
            </Card.Content>
        </Card>
    );
};

const UNKNOWN_HOST = 'Sin host';
const hostOf = (row) => row.host || UNKNOWN_HOST;

const VistaTendencias = ({ initialData = [], isActive = true }) => {
    const [range, setRange] = useState('24h');
    const [rows, setRows] = useState(initialData);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedHost, setSelectedHost] = useState(null);

    // Hosts/instancias presentes en los datos. Si hay más de uno, significa que
    // dos servicios escribieron snapshots en el mismo período.
    const hosts = useMemo(() => [...new Set(rows.map(hostOf))], [rows]);

    // Al cambiar los datos, si el host elegido ya no existe, default al de la
    // fila más reciente para no mezclar series de instancias distintas.
    useEffect(() => {
        if (hosts.length === 0) return;
        if (selectedHost && hosts.includes(selectedHost)) return;
        const latest = rows.reduce(
            (acc, row) => (acc && new Date(acc.fecha_registro) >= new Date(row.fecha_registro) ? acc : row),
            null
        );
        setSelectedHost(latest ? hostOf(latest) : hosts[0]);
    }, [hosts, rows, selectedHost]);

    // Con un solo host no filtramos; con varios, mostramos el seleccionado.
    const filteredRows = useMemo(() => {
        if (hosts.length <= 1) return rows;
        return rows.filter((row) => hostOf(row) === selectedHost);
    }, [rows, hosts, selectedHost]);

    const { series, gaps, gapSpans, restarts, restartMarkers } = useMemo(
        () => buildSeries(filteredRows),
        [filteredRows]
    );
    const fullLabels = useMemo(() => series.map((row) => row.fullLabel), [series]);

    const loadHistory = useCallback(async (selectedRange) => {
        setLoading(true);
        setError(null);
        try {
            const response = await monitoreoServices.getHistory(selectedRange);
            setRows(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            setError('No se pudo cargar el historial. ¿Existe la tabla MonitoringSnapshots?');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isActive) return;
        loadHistory(range);
    }, [range, loadHistory, isActive]);

    if (!isActive) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
                <LabelWithTooltip
                    label="Rango histórico"
                    tooltip="Snapshots guardados en SQL cada ~5 minutos. Los gráficos muestran la evolución en el período seleccionado. Si el backend estuvo caído, verás la línea cortada en ese tramo."
                    className="text-sm text-default-600 mr-2"
                />
                {RANGES.map((r) => (
                    <Button
                        key={r.key}
                        size="sm"
                        variant={range === r.key ? 'solid' : 'flat'}
                        color={range === r.key ? 'primary' : 'default'}
                        onPress={() => setRange(r.key)}
                    >
                        {r.label}
                    </Button>
                ))}
                {hosts.length === 1 && rows.length > 0 && (
                    <span className="text-xs text-default-400 ml-auto">
                        Host: <span className="font-mono">{hosts[0]}</span>
                    </span>
                )}
            </div>

            {hosts.length > 1 && (
                <div className="flex flex-wrap gap-2 items-center">
                    <LabelWithTooltip
                        label="Instancia / Host"
                        tooltip="Se detectó más de un host escribiendo snapshots en este período. Elegí cuál ver; cada instancia se grafica por separado para no mezclar series."
                        className="text-sm text-default-600 mr-2"
                    />
                    {hosts.map((h) => (
                        <Button
                            key={h}
                            size="sm"
                            variant={selectedHost === h ? 'solid' : 'flat'}
                            color={selectedHost === h ? 'secondary' : 'default'}
                            onPress={() => setSelectedHost(h)}
                            className="font-mono"
                        >
                            {h}
                        </Button>
                    ))}
                </div>
            )}

            {loading && (
                <div className="flex justify-center py-12">
                    <Spinner label="Cargando historial..." />
                </div>
            )}

            {error && !loading && (
                <Card className="border-warning">
                    <Card.Content className="text-warning text-sm">{error}</Card.Content>
                </Card>
            )}

            {!loading && !error && series.length === 0 && (
                <Card>
                    <Card.Content className="text-center text-default-500 py-8">
                        Sin snapshots aún. El collector guarda datos cada 5 minutos por defecto.
                    </Card.Content>
                </Card>
            )}

            {!loading && !error && (gaps.length > 0 || restarts.length > 0) && (
                <Card className="border-l-4 border-warning bg-warning-50/40 dark:bg-warning-900/10">
                    <Card.Content className="py-3 gap-2">
                        {gaps.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 text-warning-700 dark:text-warning text-sm font-semibold mb-1">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    {gaps.length === 1 ? 'Corte detectado' : `${gaps.length} cortes detectados`}
                                    <span className="font-normal text-default-500">— el backend no registró datos en estos tramos</span>
                                </div>
                                <ul className="text-xs text-default-600 space-y-0.5 pl-6">
                                    {gaps.map((gap, i) => (
                                        <li key={`gap-${i}`}>
                                            <span className="font-mono">{fmtFull(gap.from)}</span>
                                            {' → '}
                                            <span className="font-mono">{fmtFull(gap.to)}</span>
                                            {' · '}
                                            <span className="font-semibold text-warning-700 dark:text-warning">
                                                {formatDuration(gap.ms)} sin datos
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {restarts.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400 text-sm font-semibold mb-1">
                                    <RotateCcw className="w-4 h-4 shrink-0" />
                                    {restarts.length === 1 ? 'Reinicio del proceso' : `${restarts.length} reinicios del proceso`}
                                    <span className="font-normal text-default-500">— el proceso Node arrancó de nuevo</span>
                                </div>
                                <ul className="text-xs text-default-600 space-y-0.5 pl-6">
                                    {restarts.map((rs, i) => {
                                        const d = rs.startedAt ?? new Date(rs.at);
                                        return (
                                            <li key={`rs-${i}`} className="flex items-center gap-2">
                                                <span className="font-mono">{fmtFull(d)}</span>
                                                <span className="text-default-400">· {fmtRelative(d)}</span>
                                                <span className="text-default-400">
                                                    {rs.startedAt ? '(arranque del proceso)' : '(estimado)'}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                    </Card.Content>
                </Card>
            )}

            {!loading && series.length > 0 && (
                <p className="text-xs text-default-400">
                    Rueda o arrastrá sobre un gráfico para hacer zoom · Shift + arrastrar para desplazar · doble clic o
                    {' '}
                    <ZoomOut className="inline w-3 h-3 align-text-bottom" /> para restablecer.
                </p>
            )}

            {!loading && series.length > 0 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {METRICS.map((metric) => (
                        <MetricChart
                            key={metric.key}
                            metric={metric}
                            series={series}
                            fullLabels={fullLabels}
                            gapSpans={gapSpans}
                            restartMarkers={restartMarkers}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default VistaTendencias;
