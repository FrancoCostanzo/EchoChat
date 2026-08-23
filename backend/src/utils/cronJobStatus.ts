/** In-memory tracker of background cron job execution results. */

import config from '../config';

export interface JobRun {
  descripcion: string;
  ultimaEjecucion: string;
  resultado: string;
  origen: string;
  /**
   * Con varias instancias cada corrida la ejecuta una sola: saber cuál ayuda a
   * leer el panel, porque este Map sigue siendo local a cada proceso.
   */
  instancia: string;
}

const jobRuns = new Map<string, JobRun>();

export function recordJobRun(
  name: string,
  { descripcion, resultado = 'success', origen = 'automatica' }: {
    descripcion?: string;
    resultado?: string;
    origen?: string;
  } = {},
): void {
  jobRuns.set(name, {
    descripcion: descripcion || name,
    ultimaEjecucion: new Date().toISOString(),
    resultado,
    origen,
    instancia: config.instanceId,
  });
}

export function getJobRuns(): Record<string, JobRun> {
  return Object.fromEntries(jobRuns);
}

export function getCronWorkerStatus() {
  const enabled = config.env === 'production';
  return {
    enabled,
    running: config.jobs.enabled,
    ready: true,
    instancia: config.instanceId,
    note: config.jobs.enabled
      ? 'Los jobs cron corren en el hilo principal del proceso Node.js. Con varias instancias, cada corrida la toma una sola (lock en Redis).'
      : 'RUN_JOBS=false: esta instancia no ejecuta jobs, sólo atiende tráfico.',
  };
}
