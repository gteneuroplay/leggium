import { EventEmitter } from "node:events";

export type SessionRealtimeEvent = {
  eventId: string;
  sessionId: string;
  type:
    | "VOTACAO_INICIADA"
    | "VOTACAO_REINICIADA"
    | "VOTO_REGISTRADO"
    | "VOTACAO_ENCERRADA"
    | "PRESENCA_ATUALIZADA"
    | "PALAVRA_SOLICITADA"
    | "PAUTA_ATUALIZADA"
    | "SESSAO_ATUALIZADA";
  createdAt: string;
  payload?: Record<string, unknown>;
};

const bus = new EventEmitter();
bus.setMaxListeners(1000);

let eventCounter = 0;
const dedupeWindow = new Map<string, number>();

function nextEventId() {
  eventCounter += 1;
  return `${Date.now()}-${eventCounter}`;
}

function channel(sessionId: string) {
  return `sessao:${sessionId}`;
}

export function emitSessionEvent(
  sessionId: string,
  type: SessionRealtimeEvent["type"],
  payload?: Record<string, unknown>,
  options?: {
    dedupeKey?: string;
    dedupeMs?: number;
  }
) {
  if (options?.dedupeKey && options?.dedupeMs && options.dedupeMs > 0) {
    const now = Date.now();
    const key = `${sessionId}:${type}:${options.dedupeKey}`;
    const last = dedupeWindow.get(key) || 0;
    if (now - last < options.dedupeMs) {
      return null;
    }
    dedupeWindow.set(key, now);
  }

  const event: SessionRealtimeEvent = {
    eventId: nextEventId(),
    sessionId,
    type,
    createdAt: new Date().toISOString(),
    payload,
  };

  bus.emit(channel(sessionId), event);
  return event;
}

export function subscribeSessionEvents(
  sessionId: string,
  listener: (event: SessionRealtimeEvent) => void
) {
  const topic = channel(sessionId);
  bus.on(topic, listener);
  return () => {
    bus.off(topic, listener);
  };
}
