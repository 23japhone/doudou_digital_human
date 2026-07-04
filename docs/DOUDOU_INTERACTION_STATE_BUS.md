# 兜兜桌宠交互状态总线合同

Date: 2026-07-04

Status: draft contract for next runtime slice

Owning domain: `src/runtime/`, `tests/runtime/`, `docs/DEFAULT_DOUDOU_CHARACTER_ASSET_SPEC.md`

## 目标

本文定义兜兜桌宠交互状态总线的第一版合同。它把已经存在的 runtime 行为整理成可测试、可回放、可扩展的结构化边界，优先覆盖：

- `poke`: 单次可见 alpha 点击或戳戳。
- `repeat_poke`: 连续戳后进入短期 wariness、后退和观察。
- `quiet_recovery`: 用户安静一段时间后，兜兜从委屈或鼓脸自然恢复。
- `working`: 拖拽、缩放、未来工作陪伴等不应被可爱反应打断的低干扰状态。

这个合同的作用不是立刻新增一套复杂 agent，而是让现有 Electron runtime 的状态、表现、调试证据和未来 replay fixture 有同一套词表。

## 非目标

- 不修改 `pet bundle v0.1` schema。
- 不把 source image、source path、prompt、provider payload、raw model response、API key、屏幕内容或摄像头/麦克风输入放进 runtime 状态。
- 不要求当前 sprite atlas 增加帧数。现阶段仍使用 `idle` 和 `tap_react` 动画，通过 runtime-only visual treatment 表达更多状态。
- 不引入长期关系记忆、聊天人格记忆或云端同步。
- 不让 LLM/VLM 直接控制 renderer 参数。模型未来只能给 allowlisted runtime intent，再经仲裁进入本合同。

## 现有事实

当前代码已经有一组实际运行中的状态和验证点：

- `src/runtime/state.ts` 定义 `RuntimePetState`：`approaching`、`dodging`、`poked`、`retreating`、`stopped`、`waiting`、`watching`、`working`。
- `src/runtime/reaction.ts` 定义短期 `wariness`、alpha hit reaction、`retreating` / `watching` / `recovering` motion phase。
- `src/runtime/default-doudou-emotions.ts` 把 runtime scenario 映射到默认兜兜 emotion id。
- `tests/runtime/state.test.ts`、`tests/runtime/reaction.test.ts`、`tests/runtime/default-doudou-emotions.test.ts` 已覆盖状态机、wariness 和默认兜兜场景映射。
- `npm run smoke:runtime` 要求观察到 `idle`、`tap`、`repeat_poke_retreat`、`repeat_poke_watch`、`quiet_recovery`、`working` 场景，以及全部 runtime states。

本文把这些事实提升为下一步实现和评审应遵守的合同。

## 总线边界

状态总线只存在于 runtime 和 app/runtime workflow state 中。生成、预览、review 和 bundle validator 不应读取或写入这条总线。

```text
Desktop/App events
-> PetInteractionEvent
-> PetAffectCore
-> PetReactionAct
-> PetEmbodimentPolicy
-> PetPresentationEnvelope
-> Renderer adapter
-> PetInteractionTrace
```

边界规则：

- Manager app 可以启动或停止 runtime，但 runtime launch 只接收 accepted bundle path。
- Runtime 可以读取 pet bundle manifest、atlas、hit area 和本地 runtime tuning。
- Runtime 不知道 source image、generation adapter internals、provider endpoint、prompt 或 raw response。
- Renderer 只消费 `PetPresentationEnvelope` 或现有等价 motion/state cue，不直接消费模型 payload。
- Smoke、debug panel 和 future replay 只记录 sanitized trace，不记录本地私密路径或用户内容。

## 合同对象

以下 TypeScript sketch 是目标形状，不要求在本次文档变更中新增代码文件。未来实现时应尽量保持字段小而稳定。

```ts
export type PetInteractionEventType =
  | "runtime_started"
  | "cursor_alpha_entered"
  | "cursor_alpha_left"
  | "poke"
  | "drag_started"
  | "drag_ended"
  | "scale_started"
  | "scale_changed"
  | "scale_ended"
  | "quiet_tick"
  | "work_started"
  | "work_ended";

export interface PetInteractionEvent {
  type: PetInteractionEventType;
  atMs: number;
  target: "visible_alpha" | "interaction_frame" | "runtime" | "unknown";
  pointer?: {
    canvasX?: number;
    canvasY?: number;
    direction?: RuntimeMotionDirection;
  };
  source: "main" | "renderer" | "manager" | "smoke" | "replay";
}
```

事件约束：

- `poke` 只能来自 visible alpha hit 或 smoke/replay 合成的等价事件。
- `drag_started`、`scale_started` 和 `scale_changed` 进入 `working`，但不增加 `wariness`。
- `quiet_tick` 只能衰减短期 runtime memory，不能写 pet bundle 或长期关系记忆。
- 事件 payload 不包含 source image path、screen text、window title、raw pointer history 或 provider data。

### PetAffectCore

`PetAffectCore` 是 runtime-only 的慢状态。第一版只需要短期、可衰减的状态，不做长期人格记忆。

```ts
export interface PetAffectCore {
  stableState: "calm" | "curious" | "wary" | "focused";
  wariness: number;
  lastInteractionAtMs: number | null;
  updatedAtMs: number | null;
}
```

规则：

- `stableState:"calm"` 对应默认 `waiting` / `idle`。
- `stableState:"curious"` 对应轻量 cursor approach。
- `stableState:"wary"` 只能由 repeat poke 或高风险 alpha contact 短时触发。
- `stableState:"focused"` 对应 `working`，优先保护工作和窗口操作。
- `wariness` 必须随 quiet time 衰减，不能永久存储。

### PetReactionAct

`PetReactionAct` 是短时反应，描述这一瞬间兜兜要做什么。

```ts
export type PetReactionAct =
  | "none"
  | "look_toward_cursor"
  | "cursor_dodge"
  | "poke_pop"
  | "repeat_poke_retreat"
  | "repeat_poke_watch"
  | "quiet_recovery"
  | "work_hold"
  | "motion_stop_rebound";
```

选择规则：

- 单次 `poke` 触发 `poke_pop`。
- 可见 alpha 靠近核心区域或高 `wariness` 的 cursor contact 触发 `cursor_dodge`。
- 连续 `poke` 使 `wariness` 到达阈值后，优先触发 `repeat_poke_retreat`。
- `repeat_poke_retreat` 到时后进入 `repeat_poke_watch`。
- 用户安静且 `wariness` 衰减后进入 `quiet_recovery`，再回到 `none` / idle。
- `working` 期间忽略 passive cursor motion 和普通 motion cue，只保留必要的拖拽/缩放反馈。

### PetEmbodimentPolicy

`PetEmbodimentPolicy` 控制动作预算和打扰程度。

```ts
export interface PetEmbodimentPolicy {
  motionBudget: "none" | "low" | "medium";
  canMoveWindow: boolean;
  canUseTapReactFrames: boolean;
  canShowResizeFrame: boolean;
  recoverySpeed: "normal" | "slow";
  holdMs: number;
}
```

硬性规则：

- Passive cursor contact 的 `canMoveWindow` 必须为 `false`。
- 只有 primary-button drag 可以移动 overlay window。
- `poke_pop` 可以使用 `tap_react` frames。
- `repeat_poke_retreat` 和 `repeat_poke_watch` 可用 CSS transform 或 future renderer adapter 表达，不要求 bundle 增加动画名。
- `working` 的 `motionBudget` 为 `low`，避免乱跳和遮挡工作。

### PetPresentationEnvelope

`PetPresentationEnvelope` 是 renderer 应消费的稳定输出。

```ts
export interface PetPresentationEnvelope {
  state: RuntimePetState;
  scenario: DefaultDoudouEmotionScenario;
  emotionId: DefaultDoudouEmotionId;
  reactionAct: PetReactionAct;
  policy: PetEmbodimentPolicy;
  pose: {
    direction: RuntimeMotionDirection;
    motionIntensity: number;
    clickExpression: "none" | "tap_react";
    stopRebound: number;
  };
  ttlMs: number;
}
```

映射规则：

| Runtime State | Scenario | Emotion ID | Reaction Act |
| --- | --- | --- | --- |
| `waiting` | `idle` | `calm_idle` | `none` |
| `approaching` | `cursor_approach` | `curious_tilt` | `look_toward_cursor` |
| `dodging` | `cursor_dodge` | `surprised` | `cursor_dodge` |
| `poked` | `tap` | `surprised` | `poke_pop` |
| `retreating` | `repeat_poke_retreat` | `annoyed_pout` | `repeat_poke_retreat` |
| `watching` | `repeat_poke_watch` | `teary` | `repeat_poke_watch` |
| `waiting` after `retreating` / `watching` | `quiet_recovery` | `comfort_soft` | `quiet_recovery` |
| `stopped` | `motion_stop` | `happy_smile` | `motion_stop_rebound` |
| `working` | `working` | `focused_working` | `work_hold` |

`quiet_recovery` 是由 transition context 产生的 scenario，不是新的长期 state。当前 `doudouEmotionScenarioForRuntimeState("waiting", previousState)` 已体现这个规则。

## 四个核心流程

### 1. 单次 poke

```text
pointerdown on interaction frame
-> alpha hit confirmed
-> PetInteractionEvent("poke")
-> recordRuntimePokeEmotion
-> PetReactionAct("poke_pop")
-> RuntimePetState("poked")
-> Scenario("tap")
-> Emotion("surprised")
-> clickExpression("tap_react")
-> state returns to waiting after pokedMs
```

验收点：

- 只在 visible alpha 命中时触发 `poke`。
- `poked` 保持短时间后返回 `waiting`。
- `tap_react` frame 被观察到。
- 单次 poke 不应进入 `retreating` 或长期惩罚。

### 2. repeat poke

```text
poke
-> poke again before wariness recovered
-> wariness >= waryDodgeThreshold
-> EmotionMotionPhase("retreating")
-> RuntimePetState("retreating")
-> Scenario("repeat_poke_retreat")
-> Emotion("annoyed_pout")
-> then RuntimePetState("watching")
-> Scenario("repeat_poke_watch")
-> Emotion("teary")
```

验收点：

- 连续 poke 提升 `wariness`，但值必须 clamp 到 `0..1`。
- 高 `wariness` 期间 alpha reaction 优先 `dodge`。
- `retreating`、`watching` 都应进入 smoke/replay evidence。
- 表现上是短期委屈或鼓脸，不表达攻击性或受伤过重。

### 3. quiet recovery

```text
no new poke
-> quiet_tick
-> decayRuntimeEmotionMemory
-> EmotionMotionPhase("recovering")
-> slower approach cue
-> RuntimePetState("waiting") with previous retreat/watch context
-> Scenario("quiet_recovery")
-> Emotion("comfort_soft")
-> idle
```

验收点：

- `wariness` 在 quiet time 后下降。
- 恢复速度比普通 approach 更慢、更柔和。
- `quiet_recovery` 与普通 `idle` 可区分，但结束后必须回到 `calm_idle`。
- 安静恢复不能写入长期 memory，也不能持续惩罚用户。

### 4. working

```text
drag_started / scale_started / scale_changed / future work_started
-> PetReactionAct("work_hold")
-> RuntimePetState("working")
-> Scenario("working")
-> Emotion("focused_working")
-> low motion budget
-> ignore ordinary motion cue until working hold expires or work_ended
```

验收点：

- 拖拽和缩放进入 `working`。
- `working` 不增加 `wariness`。
- `working` 期间普通 cursor motion 不抢占状态。
- 动作克制，不遮挡、不乱跳。
- 结束后回到 `waiting`，不污染 pet bundle 或长期记忆。

## Trace 合同

`PetInteractionTrace` 是未来 replay 和 smoke 的证据格式。它应该小、稳定、可脱敏。

```ts
export interface PetInteractionTraceEntry {
  atMs: number;
  eventType: PetInteractionEventType;
  state: RuntimePetState;
  scenario: DefaultDoudouEmotionScenario;
  emotionId: DefaultDoudouEmotionId;
  reactionAct: PetReactionAct;
  wariness: number;
  motionPhase: "settled" | "retreating" | "watching" | "recovering";
  policy: Pick<PetEmbodimentPolicy, "motionBudget" | "canMoveWindow" | "recoverySpeed">;
}
```

Trace 禁止字段：

- 绝对路径、本地用户名、source image path。
- raw prompt、raw model response、provider endpoint、provider payload、API key。
- screen text、window title、摄像头/麦克风内容。
- 未经授权的用户文本或个人照片派生内容。

Trace 推荐保留：

- fixed enum、布尔值、有限数值、relative fixture id。
- `maxWariness`、observed states、observed scenarios、observed emotion ids。
- passive cursor contact 是否移动窗口的布尔证据。

## Replay fixture 建议

下一份 `docs/DOUDOU_INTERACTION_REPLAY_PLAN.md` 可以把本文合同落成 fixture。最小 replay 应覆盖：

| Replay | 输入事件 | 必须观察到 |
| --- | --- | --- |
| `single-poke` | one visible-alpha `poke` | `poked`、`tap`、`surprised`、`tap_react` |
| `repeat-poke-retreat-watch` | two or more `poke` before recovery | `wariness > threshold`、`retreating`、`watching`、`annoyed_pout`、`teary` |
| `quiet-recovery` | repeat poke then quiet ticks | `recovering`、`quiet_recovery`、`comfort_soft`、wariness decay |
| `working-drag` | `drag_started`、motion cues、`drag_ended` | `working` holds, ordinary motion cue does not steal state |
| `working-scale` | `scale_started`、`scale_changed`、`scale_ended` | `focused_working`、low motion budget、no wariness increase |
| `privacy-trace` | any above replay | trace contains no path, prompt, provider, secret or source payload |

## 测试要求

实现本文合同时，至少需要以下检查：

- Unit tests:
  - state machine 覆盖 `poked -> waiting`、`retreating -> watching -> waiting`、`working -> waiting`。
  - reaction tests 覆盖 `wariness` 累积、衰减、阈值 dodge 和 motion phase。
  - default 兜兜 emotion tests 覆盖 runtime scenario 到 emotion id 的映射。
- Smoke:
  - `npm run smoke:runtime` 继续观察全部 runtime states、核心 scenarios 和 emotion ids。
  - passive cursor contact 不移动窗口。
  - repeated poke 观察到最大 `wariness` 超过阈值。
- Future replay:
  - replay 结果应使用 `PetInteractionTraceEntry` 或等价 sanitized evidence。
  - replay fixture 必须是 rights-safe synthetic input，不依赖个人图像。

文档变更本身只需要 lint/format 级别检查；实现代码时应按 `docs/TESTING.md` 的 runtime behavior changes 要求补齐 unit 和 smoke 覆盖。

## 隐私和安全要求

- 状态总线是 runtime-local，默认不上传、不同步、不写入 bundle。
- `wariness` 是短期情绪记忆，必须可衰减，不得作为长期用户画像。
- `working` 不代表兜兜读取了用户屏幕或知道用户正在做什么，只表示用户正在操作桌宠窗口或显式进入低干扰模式。
- 未来若接入模型，模型输入必须经过 Stage B/Stage L 现有仲裁边界，且没有明确同意时不能读取视觉输入。
- 所有调试输出和 smoke evidence 都必须使用固定枚举和 sanitized JSON。

## 评审清单

交互状态总线实现或修改时，review 至少检查：

- 是否保持 `pet bundle v0.1` 不变。
- 是否覆盖 `poke`、`repeat_poke_retreat`、`repeat_poke_watch`、`quiet_recovery`、`working`。
- 是否明确区分 state、scenario、emotion id、reaction act 和 renderer pose。
- 是否证明 passive cursor contact 不移动窗口。
- 是否证明 `working` 不被普通 motion cue 抢占。
- 是否证明 `wariness` 能恢复，且不写入长期记忆。
- 是否没有 source path、prompt、provider payload、secret、screen text 或本地绝对路径泄漏。
- 是否更新了对应 unit test、smoke 或 replay fixture。

## 推荐下一步

1. 新增 `docs/DOUDOU_INTERACTION_REPLAY_PLAN.md`，把本文的 trace 合同转成最小 replay fixture 和验收指标。
2. 将现有 `src/runtime/state.ts`、`src/runtime/reaction.ts`、`src/runtime/default-doudou-emotions.ts` 的隐式组合整理成显式 `PetPresentationEnvelope` 生成函数。
3. 在 smoke 输出中保留当前 evidence，同时逐步补充 `reactionAct` 和 sanitized trace summary，方便未来做回放对比。
