import {
  doudouEmotionForRuntimeScenario,
  doudouEmotionScenarioForRuntimeState,
  type DefaultDoudouEmotionId,
  type DefaultDoudouEmotionScenario
} from "./default-doudou-emotions.js";
import type { RuntimeMotionDirection } from "./motion.js";
import {
  createPetPresentationEnvelope,
  type PetEmbodimentPolicy,
  type PetInteractionTarget,
  type PetPresentationEnvelope,
  type PetPresentationEventType,
  type PetReactionAct
} from "./presentation.js";
import {
  classifyRuntimeEmotionMotionPhase,
  createRuntimeEmotionMemory,
  decayRuntimeEmotionMemory,
  recordRuntimePokeEmotion,
  type RuntimeEmotionMemory,
  type RuntimeEmotionMotionPhase
} from "./reaction.js";
import {
  RUNTIME_PET_STATES,
  createRuntimePetStateMachine,
  type RuntimeMotionPetState,
  type RuntimePetMotionCue,
  type RuntimePetState
} from "./state.js";

export const PET_INTERACTION_REPLAY_SCHEMA_VERSION = "doudou.interaction-replay.v0.1" as const;

export type { PetReactionAct } from "./presentation.js";

export const RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS = [
  "single-poke",
  "repeat-poke-retreat-watch",
  "quiet-recovery",
  "working-drag",
  "working-scale",
  "working-session",
  "privacy-trace"
] as const;

export type PetInteractionReplayFixtureId = typeof RUNTIME_INTERACTION_REPLAY_FIXTURE_IDS[number];

export type PetInteractionReplaySyntheticEventType = "advance_time" | "assert_trace" | "motion_cue";

export type PetInteractionReplayEventType = PetPresentationEventType;

export type PetInteractionReplayTarget = PetInteractionTarget;

export type PetInteractionReplayFailureCode =
  | "missing_state"
  | "missing_scenario"
  | "missing_emotion_id"
  | "missing_reaction_act"
  | "missing_motion_phase"
  | "wariness_too_low"
  | "wariness_not_recovered"
  | "state_stolen_during_working"
  | "passive_cursor_moved_window"
  | "trace_privacy_leak"
  | "invalid_fixture_schema";

export interface PetInteractionReplayInitialState {
  atMs: number;
  state: RuntimePetState;
  wariness: number;
}

export interface PetInteractionReplayEvent {
  atMs: number;
  direction?: RuntimeMotionDirection;
  motionIntensity?: number;
  point?: {
    canvasX: number;
    canvasY: number;
  };
  state?: RuntimeMotionPetState;
  target: PetInteractionReplayTarget;
  type: PetInteractionReplayEventType;
}

export interface PetInteractionReplayExpect {
  emotionIdsInclude?: DefaultDoudouEmotionId[];
  finalEmotionId?: DefaultDoudouEmotionId;
  finalState?: RuntimePetState;
  finalWarinessLessThan?: number;
  maxWarinessAtLeast?: number;
  maxWarinessAtMost?: number;
  maxWarinessGreaterThan?: number;
  maxWarinessLessThan?: number;
  motionPhasesInclude?: RuntimeEmotionMotionPhase[];
  passiveCursorMovedWindow?: boolean;
  privacySanitized?: boolean;
  reactionActsExclude?: PetReactionAct[];
  reactionActsInclude?: PetReactionAct[];
  scenariosExclude?: DefaultDoudouEmotionScenario[];
  scenariosInclude?: DefaultDoudouEmotionScenario[];
  stateStolenDuringWorking?: boolean;
  statesExclude?: RuntimePetState[];
  statesInclude?: RuntimePetState[];
  tapReactFrameObserved?: boolean;
}

export interface PetInteractionReplayFixture {
  events: PetInteractionReplayEvent[];
  expect: PetInteractionReplayExpect;
  id: string;
  initial: PetInteractionReplayInitialState;
  schemaVersion: typeof PET_INTERACTION_REPLAY_SCHEMA_VERSION;
  titleZh: string;
}

export interface PetInteractionTraceEntry {
  atMs: number;
  emotionId: DefaultDoudouEmotionId;
  eventType: PetInteractionReplayEventType;
  motionPhase: RuntimeEmotionMotionPhase;
  policy: PetEmbodimentPolicy;
  presentation: PetPresentationEnvelope;
  reactionAct: PetReactionAct;
  scenario: DefaultDoudouEmotionScenario;
  state: RuntimePetState;
  wariness: number;
}

export interface PetInteractionReplayResult {
  failedChecks: PetInteractionReplayFailureCode[];
  final: {
    emotionId: DefaultDoudouEmotionId;
    scenario: DefaultDoudouEmotionScenario;
    state: RuntimePetState;
    wariness: number;
  };
  id: string;
  observed: {
    emotionIds: DefaultDoudouEmotionId[];
    maxWariness: number;
    motionPhases: RuntimeEmotionMotionPhase[];
    passiveCursorMovedWindow: boolean;
    reactionActs: PetReactionAct[];
    scenarios: DefaultDoudouEmotionScenario[];
    states: RuntimePetState[];
    stateStolenDuringWorking: boolean;
    tapReactFrameObserved: boolean;
  };
  ok: boolean;
  trace: PetInteractionTraceEntry[];
}

const REPLAY_EVENT_TYPES: readonly PetInteractionReplayEventType[] = [
  "runtime_started",
  "cursor_alpha_entered",
  "cursor_alpha_left",
  "poke",
  "drag_started",
  "drag_ended",
  "scale_started",
  "scale_changed",
  "scale_ended",
  "quiet_tick",
  "work_started",
  "work_ended",
  "advance_time",
  "assert_trace",
  "motion_cue"
];

const REPLAY_TARGETS: readonly PetInteractionReplayTarget[] = [
  "interaction_frame",
  "runtime",
  "unknown",
  "visible_alpha"
];

const MOTION_PET_STATES: readonly RuntimeMotionPetState[] = [
  "approaching",
  "dodging",
  "retreating",
  "stopped",
  "watching"
];

const MOTION_DIRECTIONS: readonly RuntimeMotionDirection[] = ["down", "left", "none", "right", "up"];

const TRACE_PRIVACY_PATTERNS: readonly RegExp[] = [
  /\/Users\//,
  /[A-Za-z]:\\/,
  /file:\/\//i,
  /https?:\/\//i,
  /source\s*(image|path)/i,
  /raw\s*(prompt|model\s*response|provider\s*response)/i,
  /provider\s*(endpoint|payload)/i,
  /api[_-]?key/i,
  /token/i,
  /secret/i,
  /password/i,
  /screen\s*text/i,
  /window\s*title/i
];

export function runPetInteractionReplay(fixture: PetInteractionReplayFixture): PetInteractionReplayResult {
  const schemaFailures = validateFixtureSchema(fixture);
  const machine = createRuntimePetStateMachine();
  let memory: RuntimeEmotionMemory = {
    ...createRuntimeEmotionMemory(),
    updatedAtMs: fixture.initial?.atMs ?? 0,
    wariness: clamp01(fixture.initial?.wariness ?? 0)
  };
  let nowMs = fixture.initial?.atMs ?? 0;
  let lastRecordedState: RuntimePetState = machine.current();
  const trace: PetInteractionTraceEntry[] = [];
  const observedStates: RuntimePetState[] = [machine.current()];
  const observedScenarios: DefaultDoudouEmotionScenario[] = [];
  const observedEmotionIds: DefaultDoudouEmotionId[] = [];
  const observedReactionActs: PetReactionAct[] = [];
  const observedMotionPhases: RuntimeEmotionMotionPhase[] = [];
  let maxWariness = clamp01(memory.wariness);
  let tapReactFrameObserved = false;
  let stateStolenDuringWorking = false;

  function recordTrace(
    event: Pick<PetInteractionReplayEvent, "atMs" | "target" | "type">,
    reactionAct: PetReactionAct,
    motionPhase: RuntimeEmotionMotionPhase
  ): void {
    const state = machine.current();
    const presentation = createPetPresentationEnvelope({
      event: {
        source: "replay",
        target: event.target,
        type: event.type
      },
      memory,
      motionPhase,
      nowMs: event.atMs,
      pose: machine.pose(),
      previousState: lastRecordedState,
      state
    });
    const entry: PetInteractionTraceEntry = {
      atMs: event.atMs,
      emotionId: presentation.emotionId,
      eventType: event.type,
      motionPhase,
      policy: presentation.policy,
      presentation,
      reactionAct: presentation.reactionAct,
      scenario: presentation.scenario,
      state,
      wariness: clamp01(memory.wariness)
    };
    trace.push(entry);
    pushUnique(observedStates, state);
    pushUnique(observedScenarios, presentation.scenario);
    pushUnique(observedEmotionIds, presentation.emotionId);
    pushUnique(observedReactionActs, presentation.reactionAct);
    pushUnique(observedMotionPhases, motionPhase);
    maxWariness = Math.max(maxWariness, entry.wariness);
    tapReactFrameObserved ||= machine.pose().clickExpression === "tap_react" || reactionAct === "poke_pop";
    lastRecordedState = state;
  }

  if (schemaFailures.length === 0) {
    for (const event of fixture.events) {
      machine.advance(Math.max(0, event.atMs - nowMs), event.atMs);
      nowMs = event.atMs;

      if (event.type === "runtime_started") {
        recordTrace(event, "none", classifyRuntimeEmotionMotionPhase(memory, event.atMs));
        continue;
      }

      if (event.type === "poke") {
        memory = recordRuntimePokeEmotion(memory, event.atMs);
        machine.tap(event.atMs);
        recordTrace(event, "poke_pop", classifyRuntimeEmotionMotionPhase(memory, event.atMs));
        continue;
      }

      if (event.type === "quiet_tick") {
        memory = decayRuntimeEmotionMemory(memory, event.atMs);
        const motionPhase = applyMotionPhase(memory, event.atMs, event.direction ?? "right");
        recordTrace(event, reactionActForMotionPhase(motionPhase, machine.current()), motionPhase);
        continue;
      }

      if (
        event.type === "drag_started" ||
        event.type === "scale_started" ||
        event.type === "scale_changed" ||
        event.type === "work_started"
      ) {
        machine.working(event.atMs);
        recordTrace(event, "work_hold", classifyRuntimeEmotionMotionPhase(memory, event.atMs));
        continue;
      }

      if (event.type === "work_ended") {
        machine.endWorking(event.atMs);
        recordTrace(event, reactionActForState(machine.current()), classifyRuntimeEmotionMotionPhase(memory, event.atMs));
        continue;
      }

      if (event.type === "motion_cue") {
        const beforeState = machine.current();
        const cue = motionCueFromEvent(event);
        if (cue) {
          machine.motion(cue, event.atMs);
        }
        stateStolenDuringWorking ||= beforeState === "working" && machine.current() !== "working";
        recordTrace(event, reactionActForState(machine.current()), classifyRuntimeEmotionMotionPhase(memory, event.atMs));
        continue;
      }

      if (event.type === "advance_time" || event.type === "assert_trace") {
        const motionPhase = applyMotionPhase(memory, event.atMs, event.direction ?? "right");
        recordTrace(event, reactionActForMotionPhase(motionPhase, machine.current()), motionPhase);
        continue;
      }

      recordTrace(event, reactionActForState(machine.current()), classifyRuntimeEmotionMotionPhase(memory, event.atMs));
    }
  }

  const finalState = machine.current();
  const finalScenario = doudouEmotionScenarioForRuntimeState(finalState);
  const finalEmotionId = doudouEmotionForRuntimeScenario(finalScenario).id;
  const observed = {
    emotionIds: observedEmotionIds,
    maxWariness,
    motionPhases: observedMotionPhases,
    passiveCursorMovedWindow: false,
    reactionActs: observedReactionActs,
    scenarios: observedScenarios,
    states: observedStates,
    stateStolenDuringWorking,
    tapReactFrameObserved
  };
  const failedChecks = uniqueFailureCodes([
    ...schemaFailures,
    ...evaluateExpectations(fixture.expect ?? {}, observed, {
      emotionId: finalEmotionId,
      scenario: finalScenario,
      state: finalState,
      wariness: clamp01(memory.wariness)
    }, trace, fixture)
  ]);

  const result: PetInteractionReplayResult = {
    failedChecks,
    final: {
      emotionId: finalEmotionId,
      scenario: finalScenario,
      state: finalState,
      wariness: clamp01(memory.wariness)
    },
    id: typeof fixture.id === "string" ? fixture.id : "invalid-fixture",
    observed,
    ok: failedChecks.length === 0,
    trace
  };

  if (hasPetInteractionReplayPrivacyLeak(result) && !result.failedChecks.includes("trace_privacy_leak")) {
    result.failedChecks.push("trace_privacy_leak");
    result.ok = false;
  }

  return result;

  function applyMotionPhase(
    phaseMemory: RuntimeEmotionMemory,
    atMs: number,
    direction: RuntimeMotionDirection
  ): RuntimeEmotionMotionPhase {
    const motionPhase = classifyRuntimeEmotionMotionPhase(phaseMemory, atMs);
    if (motionPhase === "retreating") {
      machine.motion({ direction, motionIntensity: Math.max(0.75, phaseMemory.wariness), state: "retreating" }, atMs);
    } else if (motionPhase === "watching") {
      machine.motion({ direction, motionIntensity: Math.max(0.42, phaseMemory.wariness), state: "watching" }, atMs);
    }
    return motionPhase;
  }
}

export function hasPetInteractionReplayPrivacyLeak(value: unknown): boolean {
  const text = JSON.stringify(value);
  if (typeof text !== "string") {
    return false;
  }
  return TRACE_PRIVACY_PATTERNS.some((pattern) => pattern.test(text));
}

function validateFixtureSchema(fixture: PetInteractionReplayFixture): PetInteractionReplayFailureCode[] {
  const failures: PetInteractionReplayFailureCode[] = [];
  if (!fixture || typeof fixture !== "object") {
    return ["invalid_fixture_schema"];
  }
  if (fixture.schemaVersion !== PET_INTERACTION_REPLAY_SCHEMA_VERSION) {
    failures.push("invalid_fixture_schema");
  }
  if (typeof fixture.id !== "string" || fixture.id.length === 0 || typeof fixture.titleZh !== "string") {
    failures.push("invalid_fixture_schema");
  }
  if (
    !fixture.initial ||
    fixture.initial.state !== "waiting" ||
    !isRuntimePetState(fixture.initial.state) ||
    !isFiniteNumber(fixture.initial.atMs)
  ) {
    failures.push("invalid_fixture_schema");
  }
  if (!isWariness(fixture.initial?.wariness)) {
    failures.push("invalid_fixture_schema");
  }
  if (!Array.isArray(fixture.events) || fixture.events.length === 0) {
    failures.push("invalid_fixture_schema");
  } else {
    let previousAtMs = Number.NEGATIVE_INFINITY;
    for (const event of fixture.events) {
      if (
        !isFiniteNumber(event.atMs) ||
        event.atMs <= previousAtMs ||
        !isReplayEventType(event.type) ||
        !isReplayTarget(event.target)
      ) {
        failures.push("invalid_fixture_schema");
        break;
      }
      if (event.type === "motion_cue" && (
        !event.state ||
        !isRuntimeMotionPetState(event.state) ||
        !isMotionDirection(event.direction) ||
        !isFiniteNumber(event.motionIntensity)
      )) {
        failures.push("invalid_fixture_schema");
        break;
      }
      previousAtMs = event.atMs;
    }
  }
  if (!fixture.expect || typeof fixture.expect !== "object") {
    failures.push("invalid_fixture_schema");
  }
  if (hasPetInteractionReplayPrivacyLeak(fixture)) {
    failures.push("trace_privacy_leak");
  }
  return uniqueFailureCodes(failures);
}

function evaluateExpectations(
  expect: PetInteractionReplayExpect,
  observed: PetInteractionReplayResult["observed"],
  final: PetInteractionReplayResult["final"],
  trace: PetInteractionTraceEntry[],
  fixture: PetInteractionReplayFixture
): PetInteractionReplayFailureCode[] {
  const failures: PetInteractionReplayFailureCode[] = [];
  if (expect.statesInclude?.some((state) => !observed.states.includes(state))) {
    failures.push("missing_state");
  }
  if (expect.statesExclude?.some((state) => observed.states.includes(state))) {
    failures.push("missing_state");
  }
  if (expect.scenariosInclude?.some((scenario) => !observed.scenarios.includes(scenario))) {
    failures.push("missing_scenario");
  }
  if (expect.scenariosExclude?.some((scenario) => observed.scenarios.includes(scenario))) {
    failures.push("missing_scenario");
  }
  if (expect.emotionIdsInclude?.some((emotionId) => !observed.emotionIds.includes(emotionId))) {
    failures.push("missing_emotion_id");
  }
  if (expect.reactionActsInclude?.some((reactionAct) => !observed.reactionActs.includes(reactionAct))) {
    failures.push("missing_reaction_act");
  }
  if (expect.reactionActsExclude?.some((reactionAct) => observed.reactionActs.includes(reactionAct))) {
    failures.push("missing_reaction_act");
  }
  if (expect.motionPhasesInclude?.some((motionPhase) => !observed.motionPhases.includes(motionPhase))) {
    failures.push("missing_motion_phase");
  }
  if (expect.finalState && final.state !== expect.finalState) {
    failures.push("missing_state");
  }
  if (expect.finalEmotionId && final.emotionId !== expect.finalEmotionId) {
    failures.push("missing_emotion_id");
  }
  if (expect.maxWarinessGreaterThan !== undefined && observed.maxWariness <= expect.maxWarinessGreaterThan) {
    failures.push("wariness_too_low");
  }
  if (expect.maxWarinessAtLeast !== undefined && observed.maxWariness < expect.maxWarinessAtLeast) {
    failures.push("wariness_too_low");
  }
  if (expect.maxWarinessLessThan !== undefined && observed.maxWariness >= expect.maxWarinessLessThan) {
    failures.push("wariness_too_low");
  }
  if (expect.maxWarinessAtMost !== undefined && observed.maxWariness > expect.maxWarinessAtMost) {
    failures.push("wariness_too_low");
  }
  if (expect.finalWarinessLessThan !== undefined && final.wariness >= expect.finalWarinessLessThan) {
    failures.push("wariness_not_recovered");
  }
  if (expect.tapReactFrameObserved !== undefined && observed.tapReactFrameObserved !== expect.tapReactFrameObserved) {
    failures.push("missing_reaction_act");
  }
  if (
    expect.stateStolenDuringWorking !== undefined &&
    observed.stateStolenDuringWorking !== expect.stateStolenDuringWorking
  ) {
    failures.push("state_stolen_during_working");
  }
  if (
    expect.passiveCursorMovedWindow !== undefined &&
    observed.passiveCursorMovedWindow !== expect.passiveCursorMovedWindow
  ) {
    failures.push("passive_cursor_moved_window");
  }
  if (expect.privacySanitized && (hasPetInteractionReplayPrivacyLeak(trace) || hasPetInteractionReplayPrivacyLeak(fixture))) {
    failures.push("trace_privacy_leak");
  }
  return failures;
}

function reactionActForMotionPhase(
  motionPhase: RuntimeEmotionMotionPhase,
  state: RuntimePetState
): PetReactionAct {
  if (motionPhase === "retreating") {
    return "repeat_poke_retreat";
  }
  if (motionPhase === "watching") {
    return "repeat_poke_watch";
  }
  if (motionPhase === "recovering") {
    return "quiet_recovery";
  }
  return reactionActForState(state);
}

function reactionActForState(state: RuntimePetState): PetReactionAct {
  if (state === "approaching") {
    return "look_toward_cursor";
  }
  if (state === "dodging") {
    return "cursor_dodge";
  }
  if (state === "poked") {
    return "poke_pop";
  }
  if (state === "retreating") {
    return "repeat_poke_retreat";
  }
  if (state === "watching") {
    return "repeat_poke_watch";
  }
  if (state === "stopped") {
    return "motion_stop_rebound";
  }
  if (state === "working") {
    return "work_hold";
  }
  return "none";
}

function motionCueFromEvent(event: PetInteractionReplayEvent): RuntimePetMotionCue | null {
  if (!event.state || !isRuntimeMotionPetState(event.state)) {
    return null;
  }
  return {
    direction: isMotionDirection(event.direction) ? event.direction : "none",
    motionIntensity: clamp01(event.motionIntensity ?? 0),
    state: event.state
  };
}

function pushUnique<T>(items: T[], item: T): void {
  if (!items.includes(item)) {
    items.push(item);
  }
}

function uniqueFailureCodes(failures: PetInteractionReplayFailureCode[]): PetInteractionReplayFailureCode[] {
  return [...new Set(failures)];
}

function isReplayEventType(value: unknown): value is PetInteractionReplayEventType {
  return typeof value === "string" && REPLAY_EVENT_TYPES.includes(value as PetInteractionReplayEventType);
}

function isReplayTarget(value: unknown): value is PetInteractionReplayTarget {
  return typeof value === "string" && REPLAY_TARGETS.includes(value as PetInteractionReplayTarget);
}

function isRuntimePetState(value: unknown): value is RuntimePetState {
  return typeof value === "string" && RUNTIME_PET_STATES.includes(value as RuntimePetState);
}

function isRuntimeMotionPetState(value: unknown): value is RuntimeMotionPetState {
  return typeof value === "string" && MOTION_PET_STATES.includes(value as RuntimeMotionPetState);
}

function isMotionDirection(value: unknown): value is RuntimeMotionDirection {
  return typeof value === "string" && MOTION_DIRECTIONS.includes(value as RuntimeMotionDirection);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isWariness(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
