# 默认兜兜 Live2D 与模型仲裁规格

Status: Stage D preview adapter spike
Date: 2026-07-03

## Scope

Stage B 把 Stage A 的 12 个默认 emotion ids 映射成可落地的 Live2D Cubism 表情规格，并定义 LLM/VLM 的安全仲裁边界。Stage C 把这些规格导出为真实 `.exp3.json` fixture，并提供生成/校验 CLI，方便后续接 Live2D SDK 前保持表情资产可复现。Stage D 增加最小 preview adapter spike：读取这 12 个 `.exp3.json`，形成未来 Cubism SDK 可消费的 expression load request，并验证直接切换和模型仲裁后的切换接口。当前仍不接入真实 Live2D SDK、LLM、VLM、屏幕读取、摄像头、麦克风或新的 `pet bundle v0.1` schema 字段。

代码契约位于 `src/runtime/default-doudou-live2d.ts`，`.exp3.json` 导出/校验位于 `src/runtime/default-doudou-exp3.ts` 和 `src/cli/doudou-live2d-exp3.ts`，preview adapter spike 位于 `src/runtime/default-doudou-live2d-preview.ts` 和 `src/cli/doudou-live2d-preview.ts`。自动测试位于 `tests/runtime/default-doudou-live2d.test.ts`、`tests/runtime/default-doudou-exp3.test.ts` 和 `tests/runtime/default-doudou-live2d-preview.test.ts`。

## Research Sources

- Live2D Cubism Standard Parameter List: 标准参数 ID、默认范围和语义。
  `https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/`
- Live2D Expression Settings and Export: 从 `motion3.json` 导入/导出 `exp3.json`，默认 fade 为 500ms，可调整参数值。
  `https://docs.live2d.com/en/cubism-editor-manual/setting-and-exporting-facial-expressions/`
- Live2D SDK Expression Motion: Expression 可按 Add、Multiply、Overwrite 应用参数；Expression 不随时间改变值，也不能影响 parts。
  `https://docs.live2d.com/en/cubism-sdk-manual/expression/`
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

## Future Integration Notes

- Live2D SDK 接入时，优先复用 `DEFAULT_DOUDOU_LIVE2D_EXPRESSION_SPECS` 和 `.exp3.json` 生成/校验器，而不是手写散落参数。
- 真实 SDK adapter 应消费 Stage D load request 和 transition payload，而不是重新解析模型建议或绕过安全仲裁。
- VLM 只用于用户显式选择的源图、生成资产或 QA 截图，不用于默认桌面环境理解。
- LLM 只做低频、可忽略的陪伴意图建议；用户直接互动和安全状态永远优先。
- 真实模型接入必须继续经过 cloud opt-in、moderation、安全标识、日志脱敏和 source-image retention 检查。

## Verification

- `tests/runtime/default-doudou-live2d.test.ts` 校验 12 个 emotion ids 都有唯一 `.exp3.json` 文件、每个表情都有左右眼 Multiply、所有参数值在声明范围内。
- 同一测试校验 LLM/VLM JSON schema 只允许安全意图和 emotion id，不暴露 Live2D 参数或自由文本。
- `tests/runtime/default-doudou-exp3.test.ts` 校验 Stage B 规格能序列化为真实 Cubism expression JSON、提交的 fixture 与序列化结果一致、CLI 可生成/校验默认目录并对损坏文件返回脱敏错误。
- `tests/runtime/default-doudou-live2d-preview.test.ts` 校验 Stage D 能加载 12 个 `.exp3.json` fixture、生成未来 SDK 需要的 load request、直接切换到目标表情、在现有安全仲裁通过后切换，并通过 CLI 输出脱敏的 preview report。
