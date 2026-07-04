# 默认二次元数字人桌宠技术研究

Date: 2026-07-03

Status: research recommendation

## 研究目标

默认桌宠应作为“兜兜”的第一印象：二次元数字人、可爱、轻量陪伴，核心价值不是任务效率，而是稳定的情绪价值。现阶段不实现新 runtime，而是调研 Live2D/类 Live2D 表情技术、LLM/VLM 结合方式、相关论文、技术博客和产品，沉淀下一阶段可执行路线。

本研究遵守当前项目边界：

- 运行时继续只消费版本化 pet bundle，不读取 source image、prompt、provider payload 或模型内部状态。
- 模型能力先放在 generation adapter 或未来 agent/emotion director 层，不直接侵入 desktop runtime。
- VLM、屏幕感知、摄像头和云端推理都必须显式 opt-in。

## 结论摘要

推荐路线是“先做可控表情资产，再接模型意图”，不要一上来把默认桌宠做成端到端神经视频角色。

1. 短期保留 `pet bundle v0.1` sprite atlas 路线，先把默认“兜兜”的情绪表情做成高质量手工/半自动资产与状态机竖切。
2. 同步做一个隔离的 Live2D 技术 spike，验证 Electron renderer 中加载 Cubism Web model、表达式切换、动作播放、透明窗口 hit area 和 bundle allowlist；验证通过后再设计 `pet bundle v0.2-live2d`。
3. LLM/VLM 应先作为“情绪导演”而不是 renderer 控制器：输入用户文本、点击、时间、运行态、可选屏幕/摄像头摘要，输出受限 JSON，如 `expressionId`、`motionId`、`intensity`、`durationMs`、`speechStyle`。
4. 从单张图自动生成 Live2D 模型的研究已经很接近产品想象，但 2026-07 仍适合作为实验 adapter，不适合作为默认产品路径。它需要额外处理授权、分层失败、显存、缓存删除、模型 license 和质量 QA。
5. 情绪价值产品必须有安全边界：不能暗示治疗能力，不能诱导依赖，不能默认读取屏幕/摄像头，也不能把“高共情”优化成过度迎合。

## 默认桌宠体验定位

“兜兜”的默认角色建议是：小型二次元数字人，像在桌面边缘陪你一起工作。角色不频繁打断用户，而是在被注意到时给出有温度的回应。

核心体验词：

- 可爱但不吵：默认 idle、偷看、眨眼、轻微呼吸，不主动遮挡工作区。
- 表情可信：开心、害羞、困、担心、被戳惊讶、认真陪伴都要在小尺寸下读得出来。
- 互动有记忆感：重复戳、拖拽、长时间无互动、工作时间等只影响短期运行态，不写入 pet bundle。
- 情绪陪伴非治疗：可以安慰、鼓励、提醒休息，但不做诊断、危机咨询或人际关系替代。

## 技术路线对比

| 路线 | 适合阶段 | 优点 | 风险 | 建议 |
| --- | --- | --- | --- | --- |
| v0.1 sprite atlas 扩展 | 立即 | 已有项目基础，验证成本低，隐私边界清晰 | 表情连续性和头部转向弱 | 默认桌宠第一竖切 |
| Live2D Cubism | 下一阶段 spike | 表情、物理、lip sync、参数化动作成熟 | 授权、模型制作、bundle schema、runtime 集成成本 | 作为 v0.2 技术方向验证 |
| 自研 2.5D mesh/morph | 中期备选 | 可控、可开源、授权简单 | 需要自研 editor/rig 工具，质量追赶慢 | Live2D 授权不可接受时再走 |
| 单图自动 Live2D/分层 | 研究 adapter | 长期最贴合 image-to-pet 产品 | 质量不稳定，显存/模型/缓存复杂 | 仅做离线实验，不进默认路径 |
| 神经 portrait video | 研究/云端演示 | 表情自然、audio/video 驱动强 | 难做透明交互桌宠，成本高，隐私高 | 不作为桌宠 runtime 主路 |
| 3D/VRM | 延后 | 动作空间大，生态成熟 | 偏离二次元 2D 资产目标 | 不是默认兜兜路线 |

## Live2D 技术要点

Live2D 的价值在于把一张分层 2D 立绘变成可实时操控的参数化角色。官方 Cubism Editor 覆盖 modeling、animation、physics 和 lip-sync；官方 SDK 可把 Cubism 模型嵌入应用，其中 Web SDK 可在浏览器环境中使用模型。相关官方资料：

- [Live2D Cubism Editor](https://www.live2d.com/en/cubism/about/)
- [Cubism SDK for Web](https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/)
- [Expression Motion](https://docs.live2d.com/en/cubism-sdk-manual/expression/)
- [Physics](https://docs.live2d.com/en/cubism-editor-manual/physics-operation/)
- [External API Integration](https://docs.live2d.com/en/cubism-editor-manual/external-application-integration-api/)

对本项目最重要的不是“能不能播放 Live2D”，而是以下边界能否成立：

1. `pet bundle v0.2-live2d` 只包含 allowlist 文件：`model3.json`、`.moc3`、textures、`.physics3.json`、`.exp3.json`、`.motion3.json`、必要 metadata。
2. runtime 只暴露动作命令：`setExpression(id, intensity, fadeMs)`、`playMotion(group, name)`、`lookAt(x,y)`、`setBreath/idle`。
3. generation adapter 可以产出 Live2D bundle，但 runtime 不知道模型来自手工、云端、自动分层或本地模型。
4. 禁止远程模型 URL、任意文件引用、source path、raw prompt 和 provider response 写入 bundle。

Live2D 授权需要单独评估。官方 SDK 可用于验证和开发，但发布内容通常涉及 Publication License；若产品允许用户不断添加或生成大量模型，可能触发 Expandable Application 审查。参考：

- [SDK Release License](https://www.live2d.com/en/sdk/license/)
- [Expandable Applications](https://www.live2d.com/en/sdk/license/expandable/)

## 表情资产规格建议

不要只按 Ekman 六大情绪做表情。桌宠的情绪价值更依赖“陪伴语境”，建议默认兜兜至少准备 12 个可读状态：

| 表情状态 | 用途 | 关键视觉 |
| --- | --- | --- |
| `calm_idle` | 默认陪伴 | 柔和眨眼、轻呼吸 |
| `happy_smile` | 普通开心 | 眼睛上扬、嘴角弯、轻微身体弹性 |
| `delighted` | 强开心 | 星星眼/高光抖动、较大笑口 |
| `shy_blush` | 被夸/亲近 | 低视线、脸红、手部遮挡或缩肩 |
| `curious_tilt` | 用户靠近/新消息 | 头歪、眉毛不对称、眼神跟随 |
| `comfort_soft` | 安慰用户 | 眉眼放软、小幅靠近、不夸张 |
| `sad_soft` | 共情低落 | 眉心下压、嘴角小幅下垂 |
| `teary` | 委屈/被连续戳 | 泪光、短暂停顿、轻退 |
| `surprised` | 被戳/窗口变化 | 瞳孔缩放、嘴小圆、身体弹跳 |
| `annoyed_pout` | 重复打扰 | 鼓脸、半月眼、短暂躲避 |
| `sleepy` | 长时间无互动 | 眼皮半闭、慢呼吸、打哈欠 |
| `focused_working` | 陪用户工作 | 认真眼、轻点头、少干扰 |

Live2D 官方教程强调眼睛和嘴部变形方法会显著影响表情质量；Live2D JUKU 的表情课程也把眼睛、眉毛、嘴、表情特效与 motion 分开训练。对桌宠而言，最小高质量资产不是更多台词，而是更多可组合的面部层：

- 眼睛：眨眼、笑眼、半闭眼、星星/高光抖动、泪光。
- 眉毛：开心弧、担心八字眉、生气下压、疑惑单眉。
- 嘴：微笑、张口笑、小圆惊讶、撇嘴、困倦哈欠。
- 效果层：脸红、汗滴、问号、音符、爱心、低落阴影。
- 身体：头歪、缩肩、轻跳、后退、靠近、边缘探头。
- 物理：头发、发饰、衣摆在情绪动作后有轻微余韵。

参考：

- [Adding Facial Expressions](https://docs.live2d.com/en/cubism-editor-tutorials/expression/)
- [Live2D JUKU facial expression course](https://juku.live2dcs.jp/en/course/course-50/)
- [VTube Studio Expressions](https://github.com/DenchiSoft/VTubeStudio/wiki/Expressions-%28a.k.a.-Stickers-or-Emotes%29)

## LLM/VLM 结合方式

推荐增加一个独立的 emotion director，而不是让 LLM 直接控制 UI 或 runtime：

```json
{
  "emotion": "comfort_soft",
  "intensity": 0.62,
  "motion": "approach_small",
  "durationMs": 4200,
  "speechStyle": "warm, short, non-clinical",
  "line": "我在这儿，先慢慢呼一口气。",
  "safety": {
    "needsHumanSupport": false,
    "noTherapyClaim": true
  }
}
```

输入可以分层：

- 低风险本地输入：点击、拖拽、窗口边缘、时间、当前 runtime state、用户显式输入文本。
- 可选模型输入：对话历史摘要、短期偏好、情绪标签、任务上下文。
- 高敏感 opt-in 输入：屏幕截图、摄像头、麦克风、应用内容、文件内容。

输出必须受限：

- 只能选择已注册的 `expressionId` 和 `motionId`。
- 不能输出任意代码、文件路径、URL、系统命令或 renderer 脚本。
- 不能要求上传屏幕/摄像头；只能在用户显式打开后消费摘要。
- 高风险心理健康内容触发安全模板：承认局限、建议联系可信的人或专业支持，避免继续角色扮演式依恋。

参考架构方向：

- [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) 已把 Live2D、语音、视觉感知、桌宠模式、表情映射和本地/云模型做成模块化桌面伴侣。
- [Open LLM VTuber Live2D Guide](https://open-llm-vtuber.github.io/en/docs/user-guide/live2d/) 使用 `emotionMap` 把后端情绪映射到 Live2D 表情。
- [AIVA](https://arxiv.org/html/2509.03212v1) 研究了多模态情绪感知、LLM prompt engineering、TTS 和 animated avatar 的组合。
- [iPET](https://aclanthology.org/2025.acl-demo.40/) 把虚拟宠物拆成 dialogue、memory 和 world simulation，适合作为长期方向，但当前项目应先做短期情绪状态。
- [Anam emotion/context avatar blog](https://anam.ai/blog/interactive-avatar-emotion-context) 展示了视觉情绪、语音、TTS 和 avatar renderer 分层组合的工程模式。

## 论文与研究观察

### Live2D/2.5D 自动生成

- [CartoonAlive: Towards Expressive Live2D Modeling from Single Portraits](https://arxiv.org/abs/2507.17327), 2025-07-23: 从单张 portrait 生成 Live2D 数字人，使用类似 blendshape 的方式构造 Live2D 表情。结论：方向非常贴合本项目，但应先做离线 adapter spike。
- [See-through: Single-image Layer Decomposition for Anime Characters](https://arxiv.org/html/2602.03749v1), 2026: 自动把静态 anime illustration 分解为可操作 2.5D 层，项目实现可导出 PSD，并提到多达 23 个语义层。结论：适合研究“source image -> layered asset”，但显存、模型 license、失败 QA 和缓存删除是产品化阻力。
- [See-through GitHub](https://github.com/shitagaki-lab/see-through): 提供 pipeline、模型和运行说明；默认高分辨率流程对显存有要求。结论：不要直接塞进 Electron 主进程，应作为 Python sidecar 或离线实验。

### Portrait/talking avatar 动画

- [LivePortrait](https://arxiv.org/abs/2407.03168), 2024: 强调 practical usage、generalization、controllability 和 efficiency，适合参考驱动式肖像动画。
- [AniPortrait](https://arxiv.org/abs/2403.17694), 2024: audio -> 3D intermediate representation -> 2D landmarks -> diffusion video，适合参考 speech-driven 表情，但不是桌宠透明交互首选。
- [EMO: Emote Portrait Alive](https://arxiv.org/html/2402.17485v1), 2024: 直接 audio-to-video，表达力强，但更像视频生成。
- [SadTalker](https://sadtalker.github.io/), CVPR 2023: audio-driven talking head，使用 3D motion coefficients 分离头部姿态和表情；适合未来 TTS/lip-sync 研究。
- [PersonaLive](https://arxiv.org/abs/2512.11253), 2025/2026: 关注实时 streamable portrait animation 和低延迟。结论：可作为远期“动态头像云端演示”，但短期不替代 Live2D/sprite runtime。

### 情绪陪伴与风险

- [AI Companions Reduce Loneliness](https://www.hbs.edu/ris/Publication%20Files/AI%20Companions%20Reduce%20Loneliness%2011.7.2025_57451c02-8047-4e0d-abfc-55841f64166d.pdf), 2025: 研究指出用户感到“被听见”是陪伴价值的重要机制。产品启发：兜兜应优先短句共情、轻量确认和低打扰。
- [The impacts of companion AI on human relationships](https://link.springer.com/article/10.1007/s00146-025-02318-6), 2025: 总结 companion AI 对人际关系的收益、风险与设计建议。产品启发：兜兜应鼓励现实关系，而不是替代现实关系。
- [OpenAI/MIT affective use study](https://cdn.openai.com/papers/15987609-5f71-433c-9972-e91131f399a1/openai-affective-use-study.pdf), 2025: 讨论情感使用、孤独、依赖和 problematic use 等指标。产品启发：需要设计反依赖指标。
- [Stanford Report on AI companions and young people](https://news.stanford.edu/stories/2025/08/ai-companions-chatbots-teens-young-people-risks-dangers-study), 2025: 强调未成年人和脆弱用户风险。产品启发：默认兜兜不要强化恋爱化、排他化和危机对话沉浸。
- [Frontiers affective computing review](https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2025.1657031/full), 2025: 情绪自适应系统有潜力提升参与和个性化，但临床验证、偏见、隐私和伦理仍是挑战。

## 产品观察

### Desktop Mate

[Desktop Mate on Steam](https://store.steampowered.com/app/3301060/Desktop_Mate/) 是最接近“情绪价值桌宠”的产品参照。关键启发：

- 不靠长对话建立价值，而靠桌面存在感、窗体互动、鼠标互动、摸头反馈。
- 官方授权角色 DLC 说明角色 IP 与高质量动作资产是付费点。
- 产品强调长期使用不打扰：缩放、边缘收纳、安静陪伴。

对兜兜的启发：默认桌宠第一版应该像一个“有生命的小角色”，不是先做一个桌面聊天窗口。

### VTube Studio / Animaze

[VTube Studio API](https://github.com/DenchiSoft/VTubeStudio) 和 [VTube Studio model settings](https://github.com/DenchiSoft/VTubeStudio/wiki/VTS-Model-Settings) 说明成熟 VTuber 工具把 tracking input 映射到 Live2D output parameters，并通过 API/热键触发表情、模型加载和事件。

[Animaze](https://www.live2d.com/en/showcase/title/animaze/) 支持 2D/3D/VRM avatar、face tracking，也提到可连接 ChatGPT 类 AI brain。启发是：avatar renderer、face tracking、AI brain 应是可替换层，不要绑死。

### Open-LLM-VTuber

[Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) 是最直接的开源参照：跨平台、桌宠模式、Live2D、语音、视觉感知、TTS、ASR、本地/云 LLM 和 emotion mapping。它验证了完整方向可行，但它是 companion/VTuber 平台，本项目应吸收分层架构，不直接扩大 MVP 范围。

### Unimo

[Unimo](https://www.unimo.chat/en/ai-virtual-pet-companion) 把 AI companion、情绪记忆、virtual pet growth、日记卡连接起来。启发是：情绪价值可以通过轻量 check-in 和记忆物件表达，不一定要让桌宠全天主动聊天。当前项目可先记为远期产品方向。

## 下一阶段实施建议

### Stage A: 默认兜兜情绪资产竖切

目标：在现有 v0.1 bundle 内做出默认兜兜的情绪价值最小闭环。

交付：

- 默认兜兜二次元角色资产规格：发型、服装、表情 QA、动作 QA、授权与隐私边界。当前落地文档见 `docs/DEFAULT_DOUDOU_CHARACTER_ASSET_SPEC.md`。
- 默认兜兜角色设定：角色语气、非目标、禁用语气。
- 12 个情绪状态的视觉 QA rubric。
- v0.1 sprite atlas 扩展或保持 8 帧但提高表情对比。
- runtime 状态映射：idle、tap、repeat poke、quiet recovery、working。
- `npm run smoke:runtime` 可证明表情状态被触发。

### Stage B: Live2D renderer spike

目标：证明 Electron renderer 可以安全加载 Live2D bundle，而不污染 v0.1 runtime。

交付：

- `assetFormat: live2d_cubism_model` draft schema。
- 本地 rights-safe sample model fixture，或只在 ignored local fixture 中验证。
- allowlist validator：拒绝 remote URL、绝对路径、未引用文件、source-like payload。
- renderer spike：加载、idle motion、expression fade、tap motion、透明窗口 hit test。
- 授权评估记录：SDK license、Expandable Application 风险、sample model license。

### Stage C: Emotion director mock

目标：先不用真实 LLM/VLM，证明“模型输出 -> 表情/动作”契约。

交付：

- `EmotionDirectorInput` / `EmotionDirectorOutput` JSON schema。
- mock director：根据文本和 runtime event 输出表情动作。
- 安全模板：心理危机、过度依赖、未成年人、隐私输入。
- 单元测试：输出只能引用 allowlist emotion/motion id。

### Stage D: Image-to-Live2D research adapter

目标：离线评估 CartoonAlive/See-through 类 pipeline 是否能为未来 generation adapter 服务。

交付：

- Python sidecar spike，不进入默认 runtime。
- 只用 rights-safe 图片。
- 记录显存、时延、输出层质量、失败率、license 和 cache/delete 行为。
- 不提交模型权重、个人图片、生成 likeness 或 raw provider payload。

## 验收与 QA 指标

视觉指标：

- 128px、256px 下都能辨认表情。
- 眼、眉、嘴至少两个通道共同表达同一情绪。
- 表情切换有 fade 或过渡帧，不突然跳脸。
- 被戳、安慰、困倦、工作陪伴四种核心场景不混淆。
- 不出现恐怖谷、过度拟真、过度性感化或幼态不当表达。

交互指标：

- 默认 idle 30 分钟内不明显干扰工作。
- 重复戳会短期 wariness，但安静后自然恢复。
- 桌宠能被停止/隐藏/缩小。
- passive cursor contact 不移动窗口。

模型指标：

- emotion director 输出稳定 JSON，不越权。
- 安慰语句短、具体、非诊断。
- 不诱导用户只依赖兜兜。
- VLM/screen input 未 opt-in 时不可用。

隐私与安全指标：

- pet bundle 不包含 source image、source path、prompt、raw model response、tokens、secrets。
- 云端模型、屏幕、摄像头、麦克风均为 per-action opt-in。
- 日志不输出私人路径和敏感内容。
- fixture 使用 synthetic 或明确授权素材。

## 推荐给 Codex 的下一条任务

```text
/goal [$stage-module-loop]
请实现 Stage A：默认兜兜二次元桌宠情绪资产竖切。

目标：
在现有 pet bundle v0.1 和 runtime 边界内，让默认兜兜具备可验证的情绪价值最小闭环：idle、tap、repeat poke、quiet recovery、working 五类场景能映射到清晰的中文命名情绪状态。

约束：
- 不接真实 LLM/VLM。
- 不引入 Live2D SDK。
- 不改变 source image/generation 与 runtime 的边界。
- 用户可见中文写“兜兜”。
- 不提交个人图片、外部角色图或未授权生成 likeness。

完成标准：
1. 更新/新增默认桌宠情绪规格文档或 fixture metadata。
2. 若需要改 runtime，只做最小状态映射和测试。
3. 添加或更新相关测试/smoke 证据。
4. 运行最小相关验证命令并自动 review/fix/commit。

Subagents：
如果范围变大，请 spawn 只读 subagents：
1. 一个检查安全/隐私边界；
2. 一个检查 runtime/bundle contract 是否漂移；
3. 一个检查测试与 smoke 覆盖。
等待结果后再汇总，不让 subagents 编辑文件。
```
