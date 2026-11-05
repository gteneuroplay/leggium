import assert from "node:assert/strict";
import { resolveConclusaoFalaAtual } from "../src/lib/painel/concluir-fala-state";

const defaultOradorSec = 600;

const resumed = resolveConclusaoFalaAtual({
  currentSpeakerId: "aparte-1",
  currentSpeakerTipo: "APARTE",
  defaultOradorSec,
  timer: {
    durationSec: 180,
    remainingSec: 120,
    isRunning: true,
    startedAtMs: 123,
    speakerSolicitacaoId: "aparte-1",
    pausedRemainingBySolicitacaoId: { "discurso-1": 347 },
    pausedSpeakerStack: ["discurso-1"],
    speakerSemLimiteTempo: false,
  },
});

assert.equal(
  resumed.mode,
  "RESUME_PAUSED",
  "ao concluir um aparte, o orador pausado anterior deve voltar à fala",
);
assert.equal(resumed.resumedSpeakerId, "discurso-1");
assert.equal(resumed.timer.speakerSolicitacaoId, "discurso-1");
assert.equal(resumed.timer.remainingSec, 347);
assert.deepEqual(resumed.timer.pausedSpeakerStack, []);
assert.deepEqual(resumed.timer.pausedRemainingBySolicitacaoId, {});

const cleared = resolveConclusaoFalaAtual({
  currentSpeakerId: "discurso-2",
  currentSpeakerTipo: "DISCURSO",
  defaultOradorSec,
  timer: {
    durationSec: 600,
    remainingSec: 420,
    isRunning: false,
    startedAtMs: null,
    speakerSolicitacaoId: "discurso-2",
    pausedRemainingBySolicitacaoId: {},
    pausedSpeakerStack: [],
    speakerSemLimiteTempo: false,
  },
});

assert.equal(cleared.mode, "CLEAR_ALL");
assert.equal(cleared.resumedSpeakerId, null);
assert.equal(cleared.timer.speakerSolicitacaoId, null);
assert.equal(cleared.timer.remainingSec, defaultOradorSec);

console.log("ok: concluir fala atual cobre retomada de aparte e limpeza normal");
