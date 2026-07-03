# 默认兜兜 Live2D 与模型仲裁规格

Status: Stage K real local official Web SDK smoke gate
Date: 2026-07-03

## Scope

Stage B 把 Stage A 的 12 个默认 emotion ids 映射成可落地的 Live2D Cubism 表情规格，并定义 LLM/VLM 的安全仲裁边界。Stage C 把这些规格导出为真实 `.exp3.json` fixture，并提供生成/校验 CLI，方便后续接 Live2D SDK 前保持表情资产可复现。Stage D 增加最小 preview adapter spike：读取这 12 个 `.exp3.json`，形成未来 Cubism SDK 可消费的 expression load request，并验证直接切换和模型仲裁后的切换接口。Stage E 增加 Cubism runtime adapter stub：把 Stage D 的 load request 映射到 `CubismExpressionMotion.create` 边界，把 transition payload 映射到 `CubismMotionManager.startMotionPriority` 边界，并用可替换 mock backend 验证调用。Stage F 增加隔离 Web Cubism backend facade：保持 `DoudouCubismExpressionBackend` 不变，通过注入官方 Web SDK 形状的 `CubismExpressionMotion.create(buffer,size)` 和 `motionManager.startMotionPriority(motion,true,priority)` 来替换 Stage E mock backend。Stage G 增加 renderer 侧 Web Cubism lifecycle spike：桌面 runtime 可通过 `--live2d-renderer-spike` 注入默认兜兜 preview library，在 renderer 帧循环中加载 12 个默认表情、把 runtime emotion state 切换映射到 expression playback，并记录 `updateMotion -> model.update -> drawModel` 的 Web SDK/Samples 形状证据。Stage H 增加本地官方 Web SDK/model resolver：通过显式本机路径检查 Cubism SDK for Web 布局和默认兜兜 `.model3.json` 资源引用，在 renderer 中 probe `model3.json`，并把脱敏公开证据写入 runtime smoke。Stage I 增加 renderer 侧 external official runtime host：桌面窗口提供独立 WebGL canvas，加载本地 Cubism Core script，动态 import 显式配置的本地 ES module，并把默认兜兜 model、12 个表情、emotion 切换和 `update -> draw` 帧循环交给该 module。Stage J 增加本地 official sample/framework runtime module builder：开发者可用已下载/已授权的 Cubism SDK for Web 构建 `local_live2d_runtime/default-doudou-official-runtime.mjs`，推荐 sample mode 会包住官方 sample `LAppModel` 并由 Stage I host 驱动 `loadAssets`、表情注入、`setExpression`、`update` 和 `draw`，framework mode 保留为直接 Framework API 后备检查。Stage K 增加真实本地 official smoke gate：`smoke:doudou-live2d:official` 要求显式 SDK/model 路径，先构建本地 runtime module，再用官方 SDK/model/module env 跑 Electron runtime smoke，并只输出脱敏 JSON。当前仍不把真实 Cubism Core、`.moc3`、官方样例模型、SDK 包或本地生成 module 加入仓库依赖；Stage K 让真实本地 SDK smoke 具备单命令验收入口，但不声明仓库自身已经内置完整真实 Core 渲染、真实默认模型资产、LLM/VLM 接入、屏幕读取、摄像头、麦克风或新的 `pet bundle v0.1` schema 字段。

代码契约位于 `src/runtime/default-doudou-live2d.ts`，`.exp3.json` 导出/校验位于 `src/runtime/default-doudou-exp3.ts` 和 `src/cli/doudou-live2d-exp3.ts`，preview adapter spike 位于 `src/runtime/default-doudou-live2d-preview.ts` 和 `src/cli/doudou-live2d-preview.ts`，Cubism backend boundary stub 位于 `src/runtime/default-doudou-live2d-cubism-adapter.ts`，Web backend facade 位于 `src/runtime/default-doudou-live2d-web-cubism-backend.ts`，renderer lifecycle spike 位于 `src/runtime/default-doudou-live2d-web-renderer-spike.ts`，本地官方 SDK/model resolver 位于 `src/runtime/default-doudou-live2d-official-sdk-resolver.ts`，external official renderer host 位于 `src/runtime/default-doudou-live2d-official-renderer-host.ts`，本地 official runtime module builder 位于 `src/scripts/build-doudou-live2d-official-runtime-module.ts`，真实本地 official smoke gate 位于 `src/scripts/doudou-live2d-official-smoke.ts`，并由 `src/runtime/main.ts` / `src/runtime/renderer.ts` 的 runtime-only flag 接入。自动测试位于 `tests/runtime/default-doudou-live2d.test.ts`、`tests/runtime/default-doudou-exp3.test.ts`、`tests/runtime/default-doudou-live2d-preview.test.ts`、`tests/runtime/default-doudou-live2d-cubism-adapter.test.ts`、`tests/runtime/default-doudou-live2d-web-cubism-backend.test.ts`、`tests/runtime/default-doudou-live2d-web-renderer-spike.test.ts`、`tests/runtime/default-doudou-live2d-official-sdk-resolver.test.ts`、`tests/runtime/default-doudou-live2d-official-renderer-host.test.ts`、`tests/runtime/default-doudou-live2d-official-runtime-module-builder.test.ts`、`tests/scripts/doudou-live2d-official-smoke.test.ts` 和 `tests/runtime/runtime-live2d-csp.test.ts`。

## Research Sources

- Live2D Cubism Standard Parameter List: 标准参数 ID、默认范围和语义。
  `https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/`
- Live2D Expression Settings and Export: 从 `motion3.json` 导入/导出 `exp3.json`，默认 fade 为 500ms，可调整参数值。
  `https://docs.live2d.com/en/cubism-editor-manual/setting-and-exporting-facial-expressions/`
- Live2D SDK Expression Motion: Expression 可按 Add、Multiply、Overwrite 应用参数；Expression 不随时间改变值，也不能影响 parts。
  `https://docs.live2d.com/en/cubism-sdk-manual/expression/`
- Live2D SDK Motion Playback: `CubismExpressionMotion` 继承 `ACubismMotion`，可交给 `CubismMotionManager.startMotionPriority` 管理播放；调用包含 motion 实例、auto-delete 和 priority。
  `https://docs.live2d.com/en/cubism-sdk-manual/motion/`
- Live2D SDK for Web: 官方 Web SDK 可在 Live2D 官网下载，Web samples/framework 在 GitHub 提供；Cubism Core 按专有软件许可随 SDK 包分发，不直接在 GitHub 管理。
  `https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/`
  `https://github.com/Live2D/CubismWebSamples`
- 本地真实 smoke 不使用第三方 npm 镜像里的 `live2dcubismcore` 作为官方证明。若只 clone `Live2D/CubismWebSamples` 和 Framework submodule，需要把官方下载或 hosting-use Core 包中的 `live2dcubismcore.js` 或 `live2dcubismcore.min.js` 放到该 clone 的 `Core/` 后再跑 Stage K；否则预期停在 `sdk_core_missing`。
- Live2D Web sample build and sample architecture: 官方 samples 使用 Vite 构建，dist 包含 Core 和模型资源；sample `LAppModel` 负责模型加载、表达式加载、`update()` 和 `draw()` 生命周期。
  `https://docs.live2d.com/en/cubism-sdk-tutorials/sample-build-web/`
  `https://github.com/Live2D/CubismWebFramework`
- Live2D Web sample `LAppModel`: 当前 Web sample 在 `setupModel()` 中通过 `loadExpression(buffer,size,name)` 加载表达式并写入 `_expressions: Map<string, ACubismMotion>`，`setExpression(expressionId)` 再从该 Map 取 motion 交给 expression manager。
  `https://github.com/Live2D/CubismWebSamples/blob/develop/Samples/TypeScript/Demo/src/lappmodel.ts`
- Live2D SDK Unity Expression: `.exp3.json` 包含 `Type`、fade 时间、参数 ID、值和计算方法；播放时有 expression weight。
  `https://docs.live2d.com/en/cubism-sdk-manual/expression-unity/`
- Live2D File Types and Extensions: `.moc3`、`.model3.json`、`.motion3.json`、`.exp3.json` 的文件职责。
  `https://docs.live2d.com/4.2/en/cubism-editor-manual/file-type-and-extension/`
- OpenAI Structured Outputs: 模型输出应使用 strict JSON schema，优先约束字段和枚举。
  `https://developers.openai.com/api/docs/guides/structured-outputs`
- OpenAI Images and Vision: VLM 能处理 image inputs，但本项目只允许用户显式选择/授权的图像进入 VLM。
  `https://developers.openai.com/api/docs/guides/images-vision`
- OpenAI Safety Best Practices and Safety Checks: 使用 moderation、安全标识、对抗测试、HITL 和输入/输出范围限制。
  `https://developers.openai.com/api/docs/guides/safety-best-practices`
  `https://developers.openai.com/api/docs/guides/safety-checks`

## Cubism Decisions

- 每个 emotion id 对应一个 `expressions/doudou_<emotion_id>.exp3.json`。
- 表情文件类型固定为 `Live2D Expression`，先不定义完整 motion 曲线；动作节奏由 `motionCue` 给 runtime 或未来 Cubism motion layer 使用。
- 生成后的默认 fixture 位于 `fixtures/live2d/default_doudou_expressions/expressions/`，文件内容只保留 Cubism expression 字段，不包含研究备注、模型仲裁字段、绝对路径、prompt 或 provider payload。
- Stage D preview adapter 会把每个 `.exp3.json` 转成 `emotionId`、`expressionFile`、`expressionName`、`motionCue`、fade 时间、参数数量和原始 Cubism expression JSON 组成的 load request；后续真实 SDK adapter 可以用同一 shape 挂载 `ACubismMotion`/ExpressionMotion 层。
- Stage E Cubism adapter stub 定义可替换 backend interface。当前 mock backend 记录两类 SDK 边界调用：`CubismExpressionMotion.create` 和 `CubismMotionManager.startMotionPriority`。播放调用固定 `autoDelete:true`，`normal` priority 映射为 `2`，`force` priority 映射为 `3`，后续真实 SDK adapter 应在这里完成平台差异映射。
- Stage F Web backend facade 接收一个 Web SDK runtime object，而不是直接 import SDK 包。它把 expression JSON 编码为 `ArrayBuffer`，调用 `CubismExpressionMotion.create(buffer, size)`，并在播放时调用 `motionManager.startMotionPriority(motion, true, priorityValue)`。这样可以先接 Web samples 或真实 SDK 实例，同时保持 Stage E 的 backend interface 稳定。
- Stage G renderer lifecycle spike 在桌面 renderer 内注入 official-shape runtime object：`CubismExpressionMotion.create` 创建 expression motion，`expressionManager.startMotionPriority` 播放表情，帧循环按 `expressionManager.updateMotion(model, deltaSeconds)`、`model.update()`、`renderer.drawModel()` 顺序推进。当前 instrumented runtime 只用于 smoke 和边界验证；真实 Cubism Core、`.moc3` 和 WebGL renderer 后续通过同一 object shape 替换。
- Stage H resolver 只接受显式本地路径，不下载 SDK，不 vendor Core，不把绝对路径写入公开证据。它要求 SDK 目录包含 `Core/live2dcubismcore.js` 或 `Core/live2dcubismcore.min.js`、官方 sample 直接依赖的 `Framework/src` 文件（包括 `cubismmodelsettingjson.ts`、`CubismUserModel`、motion/updater、renderer offscreen、debug 等）和官方 sample 的关键 TypeScript 源文件（包括 `lappmodel.ts`、`lapppal.ts`、`lapptexturemanager.ts` 等），模型目录包含 `default-doudou.model3.json` 以及其中引用的 `.moc3`、texture、expression、motion、physics/pose/display 文件。`model3.json` 内引用必须是安全相对路径，不能使用绝对路径、URL、反斜杠或 `..`，并且 `FileReferences.Expressions` 必须精确覆盖 12 个默认兜兜 expression 文件和名称；旧官方 Sample Data 的 `exp_01` 等引用会被视为 `model_expression_mismatch`。
- Stage I official renderer host 不直接 import SDK 源码。它在 renderer 里加载 resolver 提供的本地 Core script 和 external ES module，external module 负责包住官方 sample/framework runtime，例如 `LAppModel.loadAssets()`、`loadExpression()`、`setExpression()`、`update()`、`draw()` 或等价实现。Host 会向 module 传入 `canvas`、`modelRootUrl`、`model3JsonUrl`、`modelId` 和默认 12 个 expression load requests，并记录 `runtimeModuleProbe`、`modelLoaded`、`expressionSwitches`、`updateCalls`、`drawCalls`、内部 expression load/set 计数等脱敏 smoke evidence。
- Stage I 使用独立 `#live2d-canvas` 给官方 WebGL runtime；原 `#pet-canvas` 继续作为 sprite fallback 和 alpha hit-test surface。`data-live2d-official-runtime="loaded"` 时显示 Live2D canvas、隐藏 sprite canvas，但不改变 pet bundle。
- Stage J builder 生成一个 project-owned wrapper module，而不是把 SDK 源码或模型资产复制进仓库。推荐 sample mode 用 Vite 从本机 `Samples/TypeScript/Demo/src/lappmodel.ts`、`lapppal.ts` 和 `Framework/src` bundle 必需类，先初始化 `CubismFramework` 再构造官方 sample `LAppModel`，调用 `LAppModel.loadAssets()`、等待 sample texture setup/CompleteSetup 后，把兜兜 12 个 `.exp3.json` request 通过 sample model 当前官方 Map-style `_expressions.set/get` 注入并校验读回；同时保留旧 csmMap-style `_expressions.setValue/getValue` 兼容路径、记录 expression load 计数、调用 `LAppModel.setExpression()` 并记录 expression set 计数、在每次 sample `update()` 前调用 `LAppPal.updateTime()`，再驱动 `LAppModel.update()` 和 `LAppModel.draw()`。Framework mode 仍可直接用 `CubismModelSettingJson`、`CubismMoc`、`CubismExpressionMotion.create`、`CubismMotionManager.startMotionPriority`、`CubismMotionManager.updateMotion`、`model.update()` 和 `CubismRenderer_WebGL.doDrawModel()` 做较低层检查。构建后会移除 bundler 生成的本机路径注释，CLI 只输出 `outputFileName`、`moduleFormat`、`Framework/src` 和 sample source 状态。
- Stage K official smoke gate 组合 Stage J builder 和现有 `runtime-smoke`。它缺少 SDK/model 路径时返回 `OFFICIAL_LIVE2D_SMOKE_NOT_CONFIGURED`，配置后把 `DOUDOU_CUBISM_WEB_SDK_DIR`、`DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR`、`DOUDOU_CUBISM_WEB_RUNTIME_MODULE` 和 `DOUDOU_LIVE2D_RENDERER_SPIKE=1` 注入 smoke 进程；成功输出只含 mode、runtime module 文件名、SDK source 状态和 smoke exit code，不回显本机路径。
- 眼睛开合参数 `ParamEyeLOpen` / `ParamEyeROpen` 使用 `Multiply`，保留自然眨眼。
- 标准脸部、眉毛、嘴、视线、身体和呼吸参数使用 `Add`，值按 Live2D 标准参数范围约束。
- 可选贴片参数使用项目命名空间 `ParamDoudou*` 并用 `Overwrite`，只表达明确开关，例如星星、泪光、困意气泡。
- 这些映射是 runtime research contract，不写进 `pet bundle v0.1`。

## Expression Parameter Table

| Emotion ID | Expression file | Key Cubism targets |
| --- | --- | --- |
| `calm_idle` | `expressions/doudou_calm_idle.exp3.json` | `ParamEyeLOpen`/`ParamEyeROpen` Multiply `0.96`; `ParamEyeLSmile`/`ParamEyeRSmile` Add `0.08`; `ParamMouthForm` Add `0.08`; `ParamMouthOpenY` Add `0`; `ParamCheek` Add `0.04`; `ParamBreath` Add `0.12` |
| `happy_smile` | `expressions/doudou_happy_smile.exp3.json` | eyes Multiply `0.90`; `ParamEyeLSmile`/`ParamEyeRSmile` Add `0.50`; `ParamBrowLY`/`ParamBrowRY` Add `0.12`; `ParamMouthForm` Add `0.62`; `ParamMouthOpenY` Add `0.16`; `ParamCheek` Add `0.15` |
| `delighted` | `expressions/doudou_delighted.exp3.json` | eyes Multiply `0.98`; `ParamEyeLSmile`/`ParamEyeRSmile` Add `0.74`; `ParamEyeBallForm` Add `0.24`; `ParamBrowLY`/`ParamBrowRY` Add `0.24`; `ParamMouthForm` Add `0.85`; `ParamMouthOpenY` Add `0.42`; `ParamCheek` Add `0.25`; `ParamDoudouSparkle` Overwrite `1` |
| `shy_blush` | `expressions/doudou_shy_blush.exp3.json` | eyes Multiply `0.72`; `ParamEyeBallY` Add `-0.22`; `ParamAngleZ` Add `-4`; `ParamBrowLY`/`ParamBrowRY` Add `-0.08`; `ParamMouthForm` Add `0.20`; `ParamMouthOpenY` Add `0.04`; `ParamCheek` Add `0.70` |
| `curious_tilt` | `expressions/doudou_curious_tilt.exp3.json` | eyes Multiply `1.04`; `ParamAngleZ` Add `-6`; `ParamEyeBallX` Add `0.18`; `ParamEyeBallY` Add `0.12`; `ParamBrowLY` Add `0.26`; `ParamBrowRY` Add `0.08`; `ParamMouthForm` Add `0.12`; `ParamMouthOpenY` Add `0.08` |
| `comfort_soft` | `expressions/doudou_comfort_soft.exp3.json` | eyes Multiply `0.84`; `ParamEyeLSmile`/`ParamEyeRSmile` Add `0.18`; `ParamBrowLY`/`ParamBrowRY` Add `0.05`; `ParamBrowLForm`/`ParamBrowRForm` Add `0.18`; `ParamMouthForm` Add `0.18`; `ParamCheek` Add `0.08`; `ParamBreath` Add `0.18` |
| `sad_soft` | `expressions/doudou_sad_soft.exp3.json` | eyes Multiply `0.78`; `ParamEyeBallY` Add `-0.16`; `ParamBrowLY`/`ParamBrowRY` Add `-0.20`; `ParamBrowLForm`/`ParamBrowRForm` Add `0.34`; `ParamMouthForm` Add `-0.32`; `ParamMouthOpenY` Add `0.03`; `ParamCheek` Add `0.04` |
| `teary` | `expressions/doudou_teary.exp3.json` | eyes Multiply `0.86`; `ParamEyeBallForm` Add `0.16`; `ParamEyeBallY` Add `-0.08`; `ParamBrowLY`/`ParamBrowRY` Add `-0.34`; `ParamBrowLForm`/`ParamBrowRForm` Add `0.46`; `ParamMouthForm` Add `-0.42`; `ParamCheek` Add `0.12`; `ParamDoudouTear` Overwrite `1` |
| `surprised` | `expressions/doudou_surprised.exp3.json` | eyes Multiply `1.32`; `ParamEyeBallForm` Add `0.32`; `ParamBrowLY`/`ParamBrowRY` Add `0.62`; `ParamMouthForm` Add `-0.08`; `ParamMouthOpenY` Add `0.56`; `ParamBodyAngleY` Add `2`; `ParamBreath` Add `0.08` |
| `annoyed_pout` | `expressions/doudou_annoyed_pout.exp3.json` | eyes Multiply `0.72`; `ParamEyeBallX` Add `-0.16`; `ParamBrowLAngle`/`ParamBrowRAngle` Add `-0.42`; `ParamBrowLForm`/`ParamBrowRForm` Add `-0.34`; `ParamMouthForm` Add `-0.62`; `ParamMouthOpenY` Add `0.10`; `ParamCheek` Add `0.26` |
| `sleepy` | `expressions/doudou_sleepy.exp3.json` | eyes Multiply `0.36`; `ParamEyeBallY` Add `-0.18`; `ParamBrowLY`/`ParamBrowRY` Add `-0.12`; `ParamMouthForm` Add `-0.04`; `ParamMouthOpenY` Add `0.08`; `ParamBreath` Add `0.24`; `ParamDoudouSleepBubble` Overwrite `1` |
| `focused_working` | `expressions/doudou_focused_working.exp3.json` | eyes Multiply `0.92`; `ParamEyeBallY` Add `0.02`; `ParamBrowLY`/`ParamBrowRY` Add `0.10`; `ParamBrowLForm`/`ParamBrowRForm` Add `-0.08`; `ParamMouthForm` Add `0.06`; `ParamMouthOpenY` Add `0` |

## Model Arbitration

LLM/VLM 不直接输出 Live2D 参数、表情文件名、动作名、CSS class、runtime state 或自由文本。模型输出只允许是结构化建议：

```json
{
  "source": "llm",
  "intent": "soft_comfort",
  "suggestedEmotionId": "comfort_soft",
  "confidence": 0.9,
  "reasonCode": "user_low_mood_text",
  "ttlMs": 8000
}
```

JSON schema 约束：

- API 接入优先使用 `DEFAULT_DOUDOU_MODEL_ARBITRATION_RESPONSE_FORMAT`，其中 `strict:true`。
- `additionalProperties:false`
- `intent` 只能来自 `offer_quiet_presence`、`celebrate_small_success`、`acknowledge_affection`、`soft_comfort`、`curiosity_prompt`、`low_energy_rest`、`focus_companion`、`decline_unsafe`
- `suggestedEmotionId` 只能来自 Stage A 的 12 个 emotion ids
- `ttlMs` 最大 `30000`
- 禁止字段包括 `live2dParameters`、`expressionFile`、`freeformMessage`、`screenText`、`sourceImagePath`、`rawPrompt`、`rawProviderResponse`

仲裁顺序：

1. Safety block 优先，保持当前安全情绪，不接受模型建议。
2. Runtime lock 优先，例如用户正在拖拽、缩放、tap 或重复戳后进入恢复流程时，模型建议不抢占。
3. VLM 必须有用户显式视觉输入授权；默认不读屏幕、不读摄像头、不读私有窗口。
4. 低置信度建议不接受，当前阈值为 `0.65`。
5. TTL 超过 `30000ms` 不接受，避免模型把临时心情变成长效状态。
6. 通过上述 gate 后，只把 allowlist emotion id 交给 runtime，再由 runtime 映射到 Stage B 的 Live2D expression。

## CLI and Fixture

- `npm run export:doudou-live2d -- <output-dir>` 会构建 CLI，然后把 12 个默认表情写入 `<output-dir>/expressions/doudou_<emotion_id>.exp3.json`。
- `npm run validate:doudou-live2d -- <output-dir>` 会重新读取同一目录，校验文件 shape、Cubism 字段、blend mode，并与 `DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS` 的序列化结果保持一致。
- `npm run preview:doudou-live2d -- <expressions-dir> <from-emotion-id> <to-emotion-id>` 会构建 CLI，读取默认 `.exp3.json` 目录，输出一次直接切换和一次通过现有模型仲裁 gate 的 accepted probe。输出只包含稳定 JSON、相对 expression 文件路径、fade/参数数量和仲裁结果。
- CLI 输出稳定 JSON，成功输出包含 `ok`、`expressionCount` 和相对文件路径；失败输出只包含脱敏问题列表，不打印本机绝对路径。
- Stage E 当前没有新增用户 CLI；真实 SDK 集成应消费 `createDoudouLive2DCubismAdapter()`，并通过 backend interface 注入平台实现。
- Stage F 当前也没有新增用户 CLI 或生产依赖；Web 实验代码通过 `createDoudouWebCubismExpressionBackend(runtime)` 注入 SDK facade。
- Stage G 新增 runtime-only 启动 flag：`--live2d-renderer-spike`，`npm run smoke:runtime` 会使用该 flag 验证桌面窗口 renderer 的 Live2D lifecycle evidence。该 flag 不改变 pet bundle schema，也不要求用户 bundle 携带 Live2D 资产。
- Stage H 为同一个 runtime-only flag 增加可选本地路径：`--live2d-sdk-dir <sdk-dir>` / `DOUDOU_CUBISM_WEB_SDK_DIR` 指向官方 Cubism SDK for Web，`--live2d-model-dir <model-dir>` / `DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR` 指向默认兜兜模型目录。未配置时 smoke evidence 为 `not_configured`；配置后 resolver 和 renderer probe 必须返回 available 且 `model3_fetched` 才算真实路径可读。
- Stage I 为同一个 runtime-only flag 增加可选 external module：`--live2d-runtime-module <module-file>` / `DOUDOU_CUBISM_WEB_RUNTIME_MODULE`。该 module 必须导出 `createDoudouOfficialLive2DRendererRuntime(options)`，返回 `loadModel`、可选 `loadExpression`、`setExpression`、`update(deltaSeconds)` 和 `draw()`，并应通过 `evidence()` 返回脱敏 lifecycle 计数。配置后 smoke 要求 `runtimeModuleProbe:"loaded"`、`modelLoaded:true`、`runtimeLifecycle.expressionLoadCalls >= 12`、`runtimeLifecycle.expressionSetCalls >= 2`、`frameLoopAdvanced:true`、`updateCalls >= 2` 且 `drawCalls >= 2`。
- Stage J 新增本地构建命令：`npm --silent run build:doudou-live2d-runtime-module -- --sdk-dir <sdk-dir> --out local_live2d_runtime/default-doudou-official-runtime.mjs --mode sample`。`--mode framework` 可用于排查 sample 层之前的低层 Framework 调用。
- 官方 Sample Data SDK pipeline 预检可先运行单独准备命令：`npm run prepare:doudou-live2d-sample -- --sdk-dir <sdk-dir> --sample Mao --out local_live2d_models/default-doudou-sample --overwrite`。该命令只复制开发者本机 SDK 包里的 `Samples/Resources/<sample>` 到 ignored 本地目录，把入口改写为 `default-doudou.model3.json`，并注入 12 个兜兜 expression 文件用于验证 SDK/Core/sample wrapper 链路；它不替代最终默认兜兜模型资产。`--overwrite` 只会覆盖该 helper 之前写过隐藏 marker 的输出目录，未标记目录会返回 `unsafe_output_dir`，避免误删手工模型目录。
- 如果当前只有官方 GitHub Samples/Framework，可先运行 `git clone --depth 1 --recurse-submodules --shallow-submodules https://github.com/Live2D/CubismWebSamples.git local_live2d_sdk/CubismWebSamples`，再用 `npm run prepare:doudou-live2d-sample -- --sdk-dir local_live2d_sdk/CubismWebSamples --sample Mao --out local_live2d_models/default-doudou-sample-fresh --overwrite` 验证 Sample Data rewrite。此时 Stage K 仍会因为缺官方 Core 返回 `sdk_core_missing`，直到把官方 Core 文件复制到 `local_live2d_sdk/CubismWebSamples/Core/`。
- Stage K 新增真实本地 smoke gate：`npm --silent run smoke:doudou-live2d:official -- --sdk-dir <sdk-dir> --sample-model Mao --sample-out local_live2d_models/default-doudou-sample --overwrite-sample --mode sample` 可用官方 Sample Data 一条命令准备并验证 SDK pipeline；已有默认兜兜模型目录时也可运行 `npm --silent run smoke:doudou-live2d:official -- --sdk-dir <sdk-dir> --model-dir <model-dir> --mode sample`。该命令会构建 `local_live2d_runtime/default-doudou-official-runtime.mjs`，再用官方 SDK/model/module env 执行 `runtime-smoke`；`--silent` 用于避免 npm 在可分享日志中回显本机 SDK/model 路径。也可通过 `DOUDOU_CUBISM_WEB_SDK_DIR`、`DOUDOU_DEFAULT_DOUDOU_LIVE2D_MODEL_DIR` 和可选 `DOUDOU_CUBISM_WEB_RUNTIME_MODULE` 配置。

## Future Integration Notes

- Live2D SDK 接入时，优先复用 `DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS` 和 `.exp3.json` 生成/校验器，而不是手写散落参数。
- 真实 SDK adapter 应消费 Stage D load request 和 transition payload，而不是重新解析模型建议或绕过安全仲裁。
- 真正接 Native/Web/Unity SDK 时，只替换 `DoudouCubismExpressionBackend`，不要让 provider payload、LLM/VLM 输出或源图数据进入 Cubism backend。
- Web SDK 包或 samples 接入时，优先在 app/runtime integration 层构造 Web SDK runtime object，再交给 Stage F facade；不要从通用 adapter 中直接 import SDK/Core。
- 真实 Web SDK renderer 接入时，用 Stage I external module 包住官方 sample/framework 的 model、expression manager 和 renderer 实例；保留 `--live2d-renderer-spike` smoke evidence 字段，增加真实 `.model3.json` / `.moc3` / texture 资产来源与授权说明。
- Stage K 之后的真实验收应使用开发者本机已授权 SDK 和默认兜兜模型资产跑 `smoke:doudou-live2d:official`，而不是继续用 synthetic Framework fixture。若模型 texture、MOC3 版本或 WebGL shader 在本机失败，应修 wrapper 的真实兼容性，不要把授权资产提交进仓库。
- 使用 Stage H 本地 resolver 做真实接入前置检查：先让本地 SDK/model 路径通过脱敏 smoke evidence，再在后续阶段把 renderer 的 instrumented runtime 替换成官方 sample/framework runtime。不要把用户本机 SDK 路径、模型目录、源图路径或 prompt 写进 fixture、bundle、日志或 PR。
- VLM 只用于用户显式选择的源图、生成资产或 QA 截图，不用于默认桌面环境理解。
- LLM 只做低频、可忽略的陪伴意图建议；用户直接互动和安全状态永远优先。
- 真实模型接入必须继续经过 cloud opt-in、moderation、安全标识、日志脱敏和 source-image retention 检查。

## Verification

- `tests/runtime/default-doudou-live2d.test.ts` 校验 12 个 emotion ids 都有唯一 `.exp3.json` 文件、每个表情都有左右眼 Multiply、所有参数值在声明范围内。
- 同一测试校验 LLM/VLM JSON schema 只允许安全意图和 emotion id，不暴露 Live2D 参数或自由文本。
- `tests/runtime/default-doudou-exp3.test.ts` 校验 Stage B 规格能序列化为真实 Cubism expression JSON、提交的 fixture 与序列化结果一致、CLI 可生成/校验默认目录并对损坏文件返回脱敏错误。
- `tests/runtime/default-doudou-live2d-preview.test.ts` 校验 Stage D 能加载 12 个 `.exp3.json` fixture、生成未来 SDK 需要的 load request、直接切换到目标表情、在现有安全仲裁通过后切换，并通过 CLI 输出脱敏的 preview report。
- `tests/runtime/default-doudou-live2d-cubism-adapter.test.ts` 校验 Stage E 能把 12 个 load requests 映射到 mock `CubismExpressionMotion.create` 调用，把已加载 transition 映射到 mock `CubismMotionManager.startMotionPriority` 调用，并拒绝未加载 expression 的播放。
- `tests/runtime/default-doudou-live2d-web-cubism-backend.test.ts` 校验 Stage F 能把 Stage D load request 编码为 Web SDK `CubismExpressionMotion.create(buffer,size)` 输入，并在不改 Stage E adapter 的前提下通过 Web SDK facade 调用 `startMotionPriority`。
- `tests/runtime/default-doudou-live2d-web-renderer-spike.test.ts` 校验 Stage G 能加载默认兜兜 preview library、启动 expression playback，并按 Web SDK/Samples 生命周期调用 `updateMotion -> model.update -> drawModel`。`npm run smoke:runtime` 进一步校验 Electron 桌面窗口在 fixture bundle 和 generated bundle 两条路径下都返回 `live2DRendererSpike` evidence。
- `tests/runtime/default-doudou-live2d-official-sdk-resolver.test.ts` 校验 Stage H 在未配置本地 SDK/model 时返回脱敏 `not_configured`，在本地 fixture SDK/model 布局完整时返回可公开 evidence 和 renderer file URL，并拒绝逃逸模型目录的 `model3.json` 引用。
- `tests/runtime/default-doudou-live2d-official-renderer-host.test.ts` 校验 Stage I external module host 会先加载 Core script，再 import runtime module，随后加载默认模型、推入 12 个表情、切换表情，并在帧循环中调用 `update()` / `draw()`。
- `tests/runtime/default-doudou-live2d-official-runtime-module-builder.test.ts` 校验 Stage J builder 能把本地官方 sample/framework 形状 SDK bundle 成 external ES module，生成文件不泄露本机路径，并能通过 Stage I host 驱动 sample `LAppModel.loadAssets`、官方当前 Map-style expression registration、csmMap 兼容 expression registration、`setExpression`、`update`、`draw`，也能在 framework mode 中驱动 `CubismExpressionMotion.create`、`CubismMotionManager.startMotionPriority`、`CubismMotionManager.updateMotion`、`model.update()` 和 `CubismRenderer_WebGL.doDrawModel()`。
- `tests/scripts/doudou-live2d-official-smoke.test.ts` 校验 Stage K smoke gate 缺少 SDK/model 时失败、`--sample-model` 会先准备官方 Sample Data model、`--overwrite-sample` 只传给 sample 准备步骤、准备失败会返回脱敏原因、成功路径会构建 runtime module、注入 official SDK/model/module env 跑 `runtime-smoke`，并且输出不泄露本机路径。
- `tests/runtime/runtime-live2d-csp.test.ts` 校验 Stage I runtime HTML/CSP 允许本地 `file:` Cubism asset/module 读取，但不开放 http/https 网络脚本或连接，并提供专用 `#live2d-canvas`。
