/** Snapshot do cronómetro de oratória (servidor + eco nos clientes). */
export type OratoriaTimerLike = {
  durationSec?: unknown;
  remainingSec?: unknown;
  isRunning?: unknown;
  startedAtMs?: unknown;
  semLimiteTempo?: unknown;
  /** Horário do servidor no momento do snapshot (ms); alinha clientes ao relógio da VPS. */
  serverNowMs?: unknown;
};

/**
 * Segundos restantes exibidos no cronómetro, alinhados ao servidor quando `serverNowMs` existe.
 */
export function computeTempoRestanteOratoriaSec(
  oratoriaTimer: OratoriaTimerLike | null | undefined,
  clientNowMs: number,
  clockSkewMs = 0,
): number {
  if (!oratoriaTimer || oratoriaTimer.semLimiteTempo) return 0;
  const durationSec = Number(oratoriaTimer.durationSec ?? 600);
  const baseRemaining = Number(oratoriaTimer.remainingSec ?? durationSec);
  const isRunning = Boolean(oratoriaTimer.isRunning);
  const startedAtMs = Number(oratoriaTimer.startedAtMs ?? 0);
  const now = clientNowMs + clockSkewMs;
  const elapsedRunning =
    isRunning && startedAtMs > 0 ? Math.max(0, Math.floor((now - startedAtMs) / 1000)) : 0;
  return Math.max(0, baseRemaining - elapsedRunning);
}
