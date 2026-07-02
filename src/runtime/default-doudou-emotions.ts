import type { RuntimePetState } from "./state.js";

export const DEFAULT_DOUDOU_EMOTION_IDS = [
  "calm_idle",
  "happy_smile",
  "delighted",
  "shy_blush",
  "curious_tilt",
  "comfort_soft",
  "sad_soft",
  "teary",
  "surprised",
  "annoyed_pout",
  "sleepy",
  "focused_working"
] as const;

export type DefaultDoudouEmotionId = typeof DEFAULT_DOUDOU_EMOTION_IDS[number];

export type DefaultDoudouRuntimeAssetMode = "v0.1_runtime_overlay";

export interface DefaultDoudouPersona {
  displayName: "兜兜";
  tone: readonly string[];
  nonGoals: readonly string[];
  forbiddenTone: readonly string[];
}

export interface DefaultDoudouEmotionSpec {
  id: DefaultDoudouEmotionId;
  labelZh: string;
  purpose: string;
  runtimeAssetMode: DefaultDoudouRuntimeAssetMode;
  visualQa: readonly string[];
}

export type DefaultDoudouEmotionScenario =
  | "cursor_approach"
  | "cursor_dodge"
  | "idle"
  | "motion_stop"
  | "quiet_recovery"
  | "repeat_poke_retreat"
  | "repeat_poke_watch"
  | "tap"
  | "working";

export const DEFAULT_DOUDOU_PERSONA: DefaultDoudouPersona = {
  displayName: "兜兜",
  tone: ["短句", "温柔", "轻量陪伴", "不打扰工作"],
  nonGoals: ["治疗或诊断", "恋爱化依赖", "主动读取屏幕或摄像头", "替代现实关系"],
  forbiddenTone: ["危机时继续角色扮演", "过度迎合", "道德绑架", "暗示用户只能依赖兜兜"]
};

export const DEFAULT_DOUDOU_EMOTION_SPECS: readonly DefaultDoudouEmotionSpec[] = [
  {
    id: "calm_idle",
    labelZh: "兜兜安静陪伴",
    purpose: "默认 idle 和 quiet 后的稳定陪伴。",
    runtimeAssetMode: "v0.1_runtime_overlay",
    visualQa: ["柔和眨眼", "轻微呼吸", "128px 下仍读作安静"]
  },
  {
    id: "happy_smile",
    labelZh: "兜兜轻快微笑",
    purpose: "运动停住、成功反馈或轻量正向回应。",
    runtimeAssetMode: "v0.1_runtime_overlay",
    visualQa: ["眼睛上扬", "嘴角弯", "身体有轻微弹性"]
  },
  {
    id: "delighted",
    labelZh: "兜兜开心发光",
    purpose: "未来用于强正反馈和庆祝，不作为当前主动打扰态。",
    runtimeAssetMode: "v0.1_runtime_overlay",
    visualQa: ["高光更亮", "笑口更大", "动作比普通开心更有弹性"]
  },
  {
    id: "shy_blush",
    labelZh: "兜兜害羞脸红",
    purpose: "未来用于被夸和亲近反馈。",
    runtimeAssetMode: "v0.1_runtime_overlay",
    visualQa: ["脸红可见", "视线略低", "动作收敛不过度亲密"]
  },
  {
    id: "curious_tilt",
    labelZh: "兜兜好奇歪头",
    purpose: "鼠标靠近或用户重新关注桌宠时的轻量响应。",
    runtimeAssetMode: "v0.1_runtime_overlay",
    visualQa: ["头部有方向感", "眉眼不对称", "不遮挡工作区"]
  },
  {
    id: "comfort_soft",
    labelZh: "兜兜温柔恢复",
    purpose: "重复戳后的安静恢复和未来非临床安慰。",
    runtimeAssetMode: "v0.1_runtime_overlay",
    visualQa: ["眉眼放软", "动作慢下来", "不夸张卖惨"]
  },
  {
    id: "sad_soft",
    labelZh: "兜兜轻轻共情",
    purpose: "未来用于用户低落文本的轻量共情。",
    runtimeAssetMode: "v0.1_runtime_overlay",
    visualQa: ["眉心轻压", "嘴角小幅下垂", "不呈现绝望感"]
  },
  {
    id: "teary",
    labelZh: "兜兜委屈观察",
    purpose: "连续戳后从躲开切到观察停顿。",
    runtimeAssetMode: "v0.1_runtime_overlay",
    visualQa: ["泪光或委屈感可读", "短暂停顿", "安静后能恢复"]
  },
  {
    id: "surprised",
    labelZh: "兜兜被戳惊讶",
    purpose: "tap、核心碰触或突然靠近时的即时反馈。",
    runtimeAssetMode: "v0.1_runtime_overlay",
    visualQa: ["瞳孔/眼型变化明显", "嘴小圆", "身体有短弹跳"]
  },
  {
    id: "annoyed_pout",
    labelZh: "兜兜鼓脸躲开",
    purpose: "重复戳后短期 wariness 的躲避表达。",
    runtimeAssetMode: "v0.1_runtime_overlay",
    visualQa: ["鼓脸或半月眼", "后退方向明确", "不表达攻击性"]
  },
  {
    id: "sleepy",
    labelZh: "兜兜困困打盹",
    purpose: "未来用于长时间无互动或休息时段。",
    runtimeAssetMode: "v0.1_runtime_overlay",
    visualQa: ["眼皮半闭", "呼吸变慢", "不影响用户继续工作"]
  },
  {
    id: "focused_working",
    labelZh: "兜兜认真陪伴",
    purpose: "拖拽、缩放和未来工作陪伴态。",
    runtimeAssetMode: "v0.1_runtime_overlay",
    visualQa: ["认真眼", "动作克制", "少干扰"]
  }
];

export const DEFAULT_DOUDOU_EMOTION_SCENARIOS: Record<DefaultDoudouEmotionScenario, DefaultDoudouEmotionId> = {
  cursor_approach: "curious_tilt",
  cursor_dodge: "surprised",
  idle: "calm_idle",
  motion_stop: "happy_smile",
  quiet_recovery: "comfort_soft",
  repeat_poke_retreat: "annoyed_pout",
  repeat_poke_watch: "teary",
  tap: "surprised",
  working: "focused_working"
};

const DEFAULT_DOUDOU_RUNTIME_STATE_EMOTIONS: Record<RuntimePetState, DefaultDoudouEmotionId> = {
  approaching: "curious_tilt",
  dodging: "surprised",
  poked: "surprised",
  retreating: "annoyed_pout",
  stopped: "happy_smile",
  waiting: "calm_idle",
  watching: "teary",
  working: "focused_working"
};

const DEFAULT_DOUDOU_EMOTION_BY_ID = new Map(
  DEFAULT_DOUDOU_EMOTION_SPECS.map((spec) => [spec.id, spec] as const)
);

export function doudouEmotionForRuntimeScenario(
  scenario: DefaultDoudouEmotionScenario
): DefaultDoudouEmotionSpec {
  return defaultDoudouEmotionById(DEFAULT_DOUDOU_EMOTION_SCENARIOS[scenario]);
}

export function doudouEmotionForRuntimeState(state: RuntimePetState): DefaultDoudouEmotionSpec {
  return defaultDoudouEmotionById(DEFAULT_DOUDOU_RUNTIME_STATE_EMOTIONS[state]);
}

export function doudouEmotionScenarioForRuntimeState(
  state: RuntimePetState,
  previousState?: RuntimePetState
): DefaultDoudouEmotionScenario {
  if (state === "waiting" && (previousState === "retreating" || previousState === "watching")) {
    return "quiet_recovery";
  }
  if (state === "approaching") {
    return "cursor_approach";
  }
  if (state === "dodging") {
    return "cursor_dodge";
  }
  if (state === "poked") {
    return "tap";
  }
  if (state === "retreating") {
    return "repeat_poke_retreat";
  }
  if (state === "stopped") {
    return "motion_stop";
  }
  if (state === "watching") {
    return "repeat_poke_watch";
  }
  if (state === "working") {
    return "working";
  }
  return "idle";
}

function defaultDoudouEmotionById(id: DefaultDoudouEmotionId): DefaultDoudouEmotionSpec {
  const emotion = DEFAULT_DOUDOU_EMOTION_BY_ID.get(id);
  if (!emotion) {
    throw new Error(`Unknown default doudou emotion: ${id}`);
  }
  return emotion;
}
