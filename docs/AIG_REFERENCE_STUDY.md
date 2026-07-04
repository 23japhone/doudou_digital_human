# AiG / Koharu Assistant 项目研究与兜兜借鉴建议

Date: 2026-07-04

Status: research recommendation

Source reviewed: `/Users/zhipenghou/Public/code/agent/AiG`

Source snapshot: `c755725 archive: preserve koharu before airi baseline`

Implementation note: 本轮已将 AIG 角色方向落到兜兜默认桌宠资产链路：`src/generation/doudou-sprite.ts` 定义授权 AIG 默认角色 profile，默认 sprite 呈现棕色长发、红色发饰、黄色开衫和深色水手服；`fixtures/pet_bundles/valid_minimal_atlas_pet` 已更新为可运行 8 帧 bundle。实现没有拷贝 AiG 的 optional Live2D assets，也没有提交用户上传原图、source path、raw prompt 或 provider payload。

## 研究目标

本研究阅读本地 AiG 项目的文档和代表性代码，提炼对兜兜数字人桌宠有价值的架构、模块边界、评测方法和后续研究方向。

AiG 的产品形态不是“图片转桌宠资产生成器”，而是一个以 Koharu 为角色名的二次元互动助理原型。它的核心价值不在于图像生成，而在于把数字人前台体验拆成可演进的运行时：

- 情感连续性与短时反应
- 前端角色表现与 Live2D 执行层
- 语音 turn-taking 与 listener-state
- 分层记忆与关系状态
- 对话编排、工具调用和多通道回复
- replay / eval 回归体系

这正好补足兜兜当前项目的下一阶段问题：在 `pet bundle v0.1`、本地生成、预览 QA 和桌面 runtime 已经有边界后，下一步需要决定“兜兜如何更像一个长期陪伴角色”，以及如何验证这种体验没有变乱。

## 阅读范围

总体文档：

- `README.md`
- `AGENTS.md`
- `docs/architecture.md`
- `docs/repository-layering.md`
- `docs/module-upgrade-strategy.md`
- `docs/implementation-plan.md`
- `docs/2026-04-18-koharu-roadmap-index.md`

专项计划和研究：

- `docs/2026-04-18-affect-reaction-embodiment-plan.md`
- `docs/2026-04-18-dialogue-speech-rhythm-plan.md`
- `docs/2026-04-18-memory-relationship-agent-plan.md`
- `docs/2026-04-18-eval-and-subagent-playbook.md`
- `docs/2026-04-14-emotion-motion-readability-design.md`
- `docs/live2d-integration-design.md`
- `docs/research-notes.md`
- `docs/paper-tech-catalog.md`
- `docs/reference-repos.md`

代表性代码：

- `shared/affect/contracts.ts`
- `server/src/modules/affect/`
- `server/src/modules/emotion/`
- `server/src/modules/agent/`
- `server/src/modules/memory/`
- `server/src/modules/eval/`
- `src/App.tsx`
- `src/components/AvatarStage.tsx`
- `src/modules/avatar/presentation/`
- `src/modules/avatar/live2d/`
- `src/modules/avatar/performance/`
- `src/modules/avatar/readability/`
- `src/modules/speech/`
- `tests/fixtures/eval/replay/`

AiG 本地未安装 `node_modules`，本次没有运行 AiG 的测试命令，也没有修改 AiG 仓库。

## 总体结论

AiG 最值得兜兜借鉴的不是具体 UI、角色名、Live2D 参数或某条 prompt，而是六个工程模式。

1. 把角色体验拆成慢状态和快反应。
   AiG 用 `Affect Core` 维护稳定情感锚点，用 `Reaction Act Planner` 表达本轮短时反应。这样既能让角色有连续性，又能在用户夸奖、安慰、摸头、共同思考等高价值场景里产生可爱的即时反馈。

2. 用共享合同保护前后端边界。
   `shared/affect/contracts.ts` 定义 mood、expression neighborhood、reaction act、relationship state、presentation envelope、speech hints 和 governor plan。前端不从自然语言里猜情绪，后端也不直接操纵 renderer 参数。

3. reply 不只是文本。
   AiG 的 `AssistantReply` 同时包含 `displayText`、`speechText`、`speechSegments`、`presentation`、`avatarDirective`、`toolSummary`、`memoryWriteIntent` 和 state。这对兜兜未来加入模型驱动互动很重要：桌宠 runtime 应消费结构化意图，而不是解析一段回复。

4. 角色表现需要中间治理层。
   AiG 的 Live2D 链路不是“模型输出情绪 -> 直接写参数”，而是 `presentation envelope -> stage semantics -> performance governor -> readability catalog -> presence/transition/body solver`。这说明越是追求可爱和生动，越需要明确谁拥有“当前表现所有权”。

5. 记忆要服务角色连续性，而不是先堆信息。
   AiG 将 memory 分成 `session / episodic / semantic / procedural / relationship / summary`，并用 relationship drift gate 避免关系状态每轮乱写。兜兜后续如果做长期陪伴，应先定义“哪些记忆会改变互动边界”，而不是直接上向量库。

6. 可爱感必须可回放。
   AiG 把日常低反应、高价值可爱场景、共谋/安慰、语音节奏、关系连续性、stream affect 稳定性都做成 fixture 和 unified eval。兜兜后续每次增强互动，都应该配套一个小 replay，而不是只看手感。

## 模块研究

### 1. 仓库分层与协作方式

AiG 在 `docs/repository-layering.md` 中把仓库分成：

| 层 | 内容 | 价值 |
| --- | --- | --- |
| Core | `src/`、`server/`、`shared/`、`tests/`、`scripts/`、`docs/` | 默认协作和评审面 |
| Local-only | `research/`、本地状态、输出目录 | 允许个人研究，不污染主线 |
| Optional-assets | `public/live2d/` | 可跑演示，但资源授权需单独检查 |

对兜兜的启发：

- 继续坚持当前 `docs/` 作为研究和路线记录入口。
- Live2D SDK、样例模型、真实用户图像、生成输出和本地缓存应保持在 ignored local storage。
- 如果后续引入更多研究仓库或模型实验，建议明确 `research/` 或 `local_*` 目录边界，不把实验资产变成主线隐式依赖。

### 2. Affect / Reaction / Embodiment

核心代码：

- `shared/affect/contracts.ts`
- `server/src/modules/emotion/state-machine.ts`
- `server/src/modules/emotion/runtime.ts`
- `server/src/modules/affect/reaction-planner.ts`
- `server/src/modules/affect/presentation-planner.ts`
- `server/src/modules/affect/governor-plan.ts`

AiG 的情感链路大致是：

```text
用户输入
-> Affect Observation
-> Companion Affect Core
-> Reaction Act Planner
-> Anchor / Accent / Governor / Embodiment / SpeechHints
-> EmotionPresentationEnvelope
-> 前端 presentation runtime
```

关键设计：

- `state-machine.ts` 通过 dwell、candidate、anchor evidence 和迟滞阈值维护稳定情感锚点。
- `reaction-planner.ts` 只处理本轮短时反应，例如 `shy-fluster`、`comfort`、`celebrate`、`think-with-you`、`touch-reciprocate`。
- `presentation-planner.ts` 把慢状态、短时 reaction、动作预算、语音 hints、touch response 收敛成 `EmotionPresentationEnvelope`。
- 模型输出只是 soft proposal，不能直接夺走长期 anchor 所有权。

对兜兜的借鉴：

- 可以设计一个轻量 `DoudouInteractionEnvelope`，先服务桌宠行为，不急着接完整聊天 agent。
- 兜兜已有 `idle`、`tap`、`repeat_poke_retreat`、`repeat_poke_watch`、`quiet_recovery`、`working` 这些 runtime emotion scenarios，可以映射为稳定 core + 短时 reaction。
- 先把 repeated poke、quiet recovery、working companion 等状态结构化，再考虑让 LLM/VLM 参与。

建议研究方向：

- `PetAffectCore`: 低频状态，如 `calm`、`watching`、`wary`、`focused`。
- `PetReactionAct`: 短时动作，如 `poke_pop`、`retreat_watch`、`delight_bounce`、`comfort_lean`。
- `PetEmbodimentPolicy`: 控制 motion budget、hit reaction、cursor-follow 强度、恢复速度。
- `PetPresentationEnvelope`: runtime/debug/smoke 都消费这个结构，而不是散落的状态字符串。

### 3. Avatar Presentation 与 Live2D 表现栈

核心代码：

- `src/components/AvatarStage.tsx`
- `src/modules/avatar/presentation/runtime.ts`
- `src/modules/avatar/presentation/stage-semantics.ts`
- `src/modules/avatar/presentation/stream-affect-runtime.ts`
- `src/modules/avatar/presentation/expression-lifecycle-runtime.ts`
- `src/modules/avatar/live2d/live2d-stage.tsx`
- `src/modules/avatar/live2d/live2d-driver.ts`
- `src/modules/avatar/live2d/live2d-presence.ts`
- `src/modules/avatar/performance/avatar-performance-governor-runtime.ts`
- `src/modules/avatar/readability/emotion-motion-readability-catalog.ts`

AiG 的表现层有几个关键分割：

- `AvatarStage` 是适配层，负责把 presentation、speech state、touch event、debug override 转成 stage-level plan。
- `stage-semantics.ts` 定义 renderer-neutral 语义，Live2D、SVG、chibi-theater 都不需要理解后端细节。
- `stream-affect-runtime.ts` 处理 SSE 流式阶段的 burst 合并和跨 family 最短驻留，避免前台表情抖动。
- `performance governor` 做 family / band / energy 的迟滞和 corridor。
- `readability catalog` 用声明式 profile 约束不同情绪家族的动作词汇、幅度和对称性。
- `Live2D presence` 再组织 idle grammar、phase runtime、body intent、body solver 和 transition runtime。

对兜兜的借鉴：

- 兜兜当前 `pet bundle v0.1` 仍是 sprite atlas，不需要照搬 Live2D 复杂栈。
- 但 `stage semantics` 的思想可以提前吸收：sprite runtime、未来 Live2D runtime、预览 QA 和 smoke 都消费同一组状态语义。
- 运行时调试面板应展示“当前稳定状态、短时 reaction、动作预算、恢复计时”，而不仅是 frame index。
- 如果继续推进 Live2D spike，应保持 doudou 已有边界：Live2D 是 bundle asset/runtime adapter，不是生成逻辑或模型 provider 直接侵入 runtime。

不建议照搬：

- 不要现在把 AiG 的 Live2D 参数栈整体搬进兜兜。兜兜的首要目标仍是 image-to-pet asset bundle 和桌面 overlay。
- 不要让桌面 runtime 读取 prompt、provider payload、source image path 或模型内部状态。

### 4. Speech Runtime 与 Listener State

核心代码：

- `src/modules/speech/speech-runtime-types.ts`
- `src/modules/speech/browser-speech-runtime.ts`
- `src/modules/speech/headless-speech-runtime.ts`
- `src/modules/speech/speech-runtime-factory.ts`
- `server/src/modules/speech/speech-text-composer.ts`

AiG 的语音层已经把浏览器 Web Speech API 包成 `SpeechRuntimeController`，状态包括：

- `idle-listen`
- `active-listen`
- `soft-check-in`
- `anticipating-reply`
- `speaking`
- `interrupted`
- `re-engage`
- `afterglow`

它同时输出 metrics、trace 和 `SpeechEmbodimentSnapshot`，让 avatar 能知道当前是 listening、soft-backchannel、speaking、afterglow 还是 repair。

对兜兜的借鉴：

- 兜兜短期不一定要做语音，但可以借鉴这个状态模型设计“桌宠交互 runtime snapshot”。
- 例如 cursor approach、drag、poke、repeat poke、working、quiet recovery 都应有 trace 和可回放状态。
- 如果以后加语音或聊天，先接 runtime abstraction 和 trace，不要把 Web Speech、TTS、UI 动画写成一团。

### 5. Memory / Relationship / Agent

核心代码：

- `server/src/modules/memory/types.ts`
- `server/src/modules/memory/runtime.ts`
- `server/src/modules/memory/policy.ts`
- `server/src/modules/agent/dialogue-orchestrator.ts`
- `server/src/modules/agent/response-composer.ts`
- `server/src/tools.ts`

AiG 的 memory schema 分为：

- `session`: 最近会话回合
- `episodic`: 发生过的事件
- `semantic`: 偏好、事实、目标
- `procedural`: 以后如何更好帮助用户
- `relationship`: 关系状态快照
- `summary`: 对话摘要

`ResponseComposer` 会把工具结果变成 `toolSummary`，并从 `remember_user_fact` 等工具结果里派生 `memoryWriteIntent`。`MemoryRuntime` 再负责去重、过滤低信号回合、cadence summary 和 relationship drift gate。

对兜兜的借鉴：

- 兜兜的 pet bundle 不能存关系记忆；关系和互动偏好应属于本地 runtime/app storage。
- 如果做长期陪伴，先从很小的 local relationship state 开始，例如 `touchComfort`、`playfulnessAllowance`、`boundaryGuard`、`workingPreference`。
- 记忆写回要慢，尤其不要因为一次 poke 或一句情绪化输入永久改变角色边界。
- 工具型 agent 不应抢走桌宠前台体验。兜兜当前应继续以资产生成、预览、运行和低打扰陪伴为主。

### 6. Dialogue Orchestration 与多通道输出

核心代码：

- `server/src/llm.ts`
- `server/src/modules/agent/dialogue-orchestrator.ts`
- `server/src/modules/agent/response-composer.ts`
- `server/src/modules/agent/reply-stream.ts`
- `src/lib/assistant-stream.ts`
- `src/App.tsx`

AiG 的 SSE 链路是：

```text
turn-start
-> affect
-> reply-delta*
-> final-reply
```

前端先收到 affect 预热，再流式显示文字，最后用 final reply 收口完整真值。流式阶段的 control header 会被消费成前台表现信号，而不是直接展示给用户。

对兜兜的借鉴：

- 后续如果兜兜加模型互动，事件流可以先发 `interaction-affect` 或 `pet-action-preview`，再发文本/语音，最后用 final state 收口。
- 模型建议应是受限命令，例如 `set_expression`、`play_motion`、`adjust_motion_budget`，不能直接进入 renderer。
- UI 和 runtime 都应消费结构化事件，而不是从中文回复里正则提取状态。

### 7. Eval / Replay

核心代码和 fixture：

- `server/src/modules/eval/unified-eval.ts`
- `server/src/modules/eval/affect-replay.ts`
- `server/src/modules/eval/speech-rhythm-replay.ts`
- `server/src/modules/eval/stream-affect-replay.ts`
- `server/src/modules/eval/memory-replay.ts`
- `tests/fixtures/eval/replay/*.json`

AiG 的 replay 覆盖：

- 日常轻对话：防止低信号 turn 过度反应。
- 高价值可爱场景：害羞、庆祝、惊喜。
- 共谋/安慰：comfort 和 think-with-you 的区别。
- 语音节奏：soft-check-in、afterglow、barge-in、overlap guard。
- 关系连续性：同类夸奖场景的稳定 shy reaction。
- stream affect：burst 合并、同 family 即时放行、跨 family 最短驻留。
- memory relationship：互动偏好写回、关系快照 drift gate。

对兜兜的借鉴：

- 兜兜应尽快建立自己的小型 replay，而不是等功能复杂后再补。
- 最小 replay 不需要 LLM，可先覆盖 runtime 和 bundle 行为。

建议新增的兜兜 replay 方向：

| Replay | 目标 |
| --- | --- |
| `pet-interaction-replay` | 回放 poke、repeat poke、quiet recovery、working、drag、scale 等桌宠状态 |
| `emotion-readability-replay` | 验证默认兜兜各情绪在小尺寸下可区分，不靠过度动作 |
| `bundle-contract-replay` | 验证生成端输出只通过 pet bundle 合同进入 runtime |
| `privacy-replay` | 验证 source path、prompt、provider payload、raw response 不进入 bundle、日志、review artifact |
| `stream-action-replay` | 若未来接模型流式互动，验证动作建议不会抖动或抢占最终状态 |

## 兜兜最值得顺着研究的方向

### P0: 先定义桌宠交互状态总线

目标：让兜兜 runtime 的“可爱互动”不再只是若干散落状态字符串。

建议输出一份设计文档，定义：

- `PetAffectCore`
- `PetReactionAct`
- `PetEmbodimentPolicy`
- `PetPresentationEnvelope`
- `PetInteractionTrace`

落地时先不接模型，只把现有 cursor/poke/working/recovery 状态纳入合同。

### P0: 建立小型 replay/eval

目标：把桌宠体验的“稳定、可爱、不打扰”变成可回归测试。

优先样本：

- 普通 idle 不乱动。
- 第一次 poke 是可爱反馈。
- 连续 poke 进入短暂退避/观察。
- 安静一段时间后恢复。
- working 状态不抢前台。
- 拖拽/缩放不污染情绪记忆。

### P1: 把默认兜兜的情绪动作做成 readability catalog

目标：先为 sprite atlas 建立轻量动作可读性规范，未来可迁移到 Live2D。

建议从现有默认兜兜状态出发，定义：

- 每个 emotion id 的视觉关键词。
- 允许的 motion vocabulary。
- 最大动作幅度。
- 是否允许短时 reaction。
- 恢复 idle 的时间和方式。

这可以先是文档 + QA gate，不必一开始就是复杂 runtime。

### P1: Live2D spike 只借鉴边界，不照搬实现

AiG 证明 Live2D adapter 路线可行，但兜兜的 Live2D spike 应继续遵守现有项目约束：

- Live2D 作为 `pet bundle` 的 asset format 或 future adapter。
- validator 拒绝 remote URL、绝对路径、source-like payload、未引用文件。
- runtime 只暴露 allowlisted commands。
- SDK、Core、模型资产保持本地 ignored。
- sprite runtime 继续是安全 fallback。

### P2: 关系记忆只做本地、慢速、低权限

目标：让兜兜长期更像认识用户，但不制造依赖或隐私风险。

可以研究：

- `touchComfort`
- `workingSilencePreference`
- `encouragementPreference`
- `playfulnessAllowance`
- `boundaryGuard`

不建议现在做：

- 自动记录所有对话。
- 默认上传屏幕/摄像头/音频。
- 把关系状态写入可分享 pet bundle。
- 让角色长期主动索取亲密互动。

## 不建议直接借鉴的地方

- 不建议复制 AiG 的角色设定、名字、小春 UI 或 prompt。
- 不建议把 AiG 的 Web assistant 架构直接替换兜兜的 Electron 桌宠架构。
- 不建议在兜兜当前阶段引入完整语音链、完整 agent tool loop 或大型 Live2D 参数栈。
- 不建议把默认模型配置、远端模型地址或本地状态文件设计照搬到兜兜。
- 不建议把 optional Live2D assets 当成长期可分发资产；兜兜已有更严格的 bundle/fixture/授权边界，应继续保持。

## 建议的下一步文档/模块

1. 已采纳：`docs/DOUDOU_INTERACTION_STATE_BUS.md` 与 `src/runtime/presentation.ts`
   已把桌宠交互状态总线、runtime-only affect core、reaction act、embodiment policy 和 `PetPresentationEnvelope` 落到兜兜 runtime/replay/smoke。

2. 新增 `docs/DOUDOU_INTERACTION_REPLAY_PLAN.md`
   定义最小 replay fixtures 和验收指标，先覆盖 poke/repeat poke/quiet recovery/working。

3. 更新 `docs/DEFAULT_DOUDOU_EMOTION_SPEC.md`
   补充 emotion readability catalog：每个 emotion id 的动作词汇、幅度、恢复规则和 QA 标准。

4. 后续如果继续 Live2D，扩展 `docs/DEFAULT_DOUDOU_LIVE2D_AND_MODEL_ARBITRATION.md`
   把 AiG 的 `presentation envelope -> governor -> renderer adapter` 思想映射到兜兜的 allowlisted command 模型。

## 一句话结论

AiG 最值得兜兜沿着研究的方向，是把“可爱数字人”从素材播放升级成可验证的角色运行时：稳定状态慢变、短时反应可爱、表现层有治理、记忆层不污染、所有体验都有 replay 保护。
