export type ConcluirFalaTimerState = {
  durationSec: number;
  remainingSec: number;
  isRunning: boolean;
  startedAtMs: number | null;
  speakerSolicitacaoId: string | null;
  pausedRemainingBySolicitacaoId: Record<string, number>;
  pausedSpeakerStack: string[];
  speakerSemLimiteTempo: boolean;
};

export type ConcluirFalaParams = {
  currentSpeakerId: string | null;
  currentSpeakerTipo: string | null;
  defaultOradorSec: number;
  timer: ConcluirFalaTimerState;
};

export type ConcluirFalaResult =
  | {
      mode: "CLEAR_ALL";
      timer: ConcluirFalaTimerState;
      resumedSpeakerId: null;
    }
  | {
      mode: "RESUME_PAUSED";
      timer: ConcluirFalaTimerState;
      resumedSpeakerId: string;
    };

export function resolveConclusaoFalaAtual({
  currentSpeakerId,
  currentSpeakerTipo,
  defaultOradorSec,
  timer,
}: ConcluirFalaParams): ConcluirFalaResult {
  const tipoAtual = String(currentSpeakerTipo ?? "").toUpperCase();
  const isAparteOuQuestao = tipoAtual === "APARTE" || tipoAtual === "QUESTAO_ORDEM";
  const pausedSpeakerStack = Array.isArray(timer.pausedSpeakerStack) ? [...timer.pausedSpeakerStack] : [];
  const pausedRemainingBySolicitacaoId = { ...timer.pausedRemainingBySolicitacaoId };
  const resumedSpeakerId = pausedSpeakerStack.length > 0 ? pausedSpeakerStack[pausedSpeakerStack.length - 1] : null;

  if (isAparteOuQuestao && currentSpeakerId && resumedSpeakerId) {
    const remainingSec = pausedRemainingBySolicitacaoId[resumedSpeakerId] ?? defaultOradorSec;
    delete pausedRemainingBySolicitacaoId[resumedSpeakerId];
    const nextStack = pausedSpeakerStack.filter((sid) => sid !== resumedSpeakerId);

    return {
      mode: "RESUME_PAUSED",
      resumedSpeakerId,
      timer: {
        ...timer,
        durationSec: defaultOradorSec,
        remainingSec,
        isRunning: false,
        startedAtMs: null,
        speakerSolicitacaoId: resumedSpeakerId,
        pausedRemainingBySolicitacaoId,
        pausedSpeakerStack: nextStack,
        speakerSemLimiteTempo: false,
      },
    };
  }

  return {
    mode: "CLEAR_ALL",
    resumedSpeakerId: null,
    timer: {
      ...timer,
      speakerSolicitacaoId: null,
      isRunning: false,
      startedAtMs: null,
      durationSec: defaultOradorSec,
      remainingSec: defaultOradorSec,
      pausedRemainingBySolicitacaoId: {},
      pausedSpeakerStack: [],
      speakerSemLimiteTempo: false,
    },
  };
}
