/** Umbrales para evaluación de salud del sistema (healthy / degraded / unhealthy). */

export const monitoringThresholds = {
  heapDegradedPct: 75,
  heapUnhealthyPct: 90,
  sysMemDegradedPct: 85,
  sysMemUnhealthyPct: 95,
  cpuDegradedPct: 70,
  cpuUnhealthyPct: 90,
  dbLatencyDegradedMs: 100,
  dbLatencyUnhealthyMs: 500,
  poolSaturationPct: 80,
  snapshotRetentionDays: 30,
};
