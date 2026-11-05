"use client";

import { useEffect, useRef } from "react";

const DEFAULT_SRC = "/alertsound.mp3";

/**
 * Toca o áudio uma vez quando o tempo restante entra no último minuto (≤ 60 s),
 * com o cronómetro em marcha. Repete só se o tempo voltar a mais de 60 s (ex.: mesa
 * adiciona minutos), mudar o orador ou desativar `enabled`.
 */
export function useOratoriaLastMinuteAlert(opts: {
  enabled: boolean;
  tempoSec: number;
  isRunning: boolean;
  semLimiteTempo: boolean;
  speakerSolicitacaoId?: string | null;
  src?: string;
}) {
  const { enabled, tempoSec, isRunning, semLimiteTempo, speakerSolicitacaoId, src = DEFAULT_SRC } = opts;
  const playedRef = useRef(false);
  const lastSidRef = useRef<string>("");

  useEffect(() => {
    if (!enabled || semLimiteTempo) {
      playedRef.current = false;
      if (!enabled) lastSidRef.current = "";
      return;
    }

    const sid = speakerSolicitacaoId ? String(speakerSolicitacaoId) : "";
    if (!sid) {
      playedRef.current = false;
      return;
    }

    if (lastSidRef.current !== sid) {
      lastSidRef.current = sid;
      playedRef.current = false;
    }

    if (tempoSec > 60) {
      playedRef.current = false;
      return;
    }

    if (!isRunning || tempoSec <= 0) return;
    if (playedRef.current) return;

    playedRef.current = true;
    const audio = new Audio(src);
    audio.volume = 0.88;
    void audio.play().catch(() => {
      // Autoplay bloqueado ou ficheiro em falta: ignorar.
    });
  }, [enabled, semLimiteTempo, tempoSec, isRunning, speakerSolicitacaoId, src]);
}
