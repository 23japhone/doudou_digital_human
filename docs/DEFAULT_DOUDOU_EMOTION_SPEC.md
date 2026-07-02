# 默认兜兜情绪规格

Status: Stage A runtime-only vertical slice
Date: 2026-07-03

## Scope

默认桌宠的中文品牌名固定为“兜兜”。Stage A 只建立默认二次元数字人的情绪资产语义和 runtime 验证闭环，不引入真实 Live2D SDK、LLM、VLM、云端模型调用或新的 `pet bundle v0.1` schema 字段。

当前实现模式是 `v0.1_runtime_overlay`:

- 情绪规格保存在 runtime 代码中，作为默认兜兜的可测试契约。
- renderer 将 runtime 状态映射到默认兜兜情绪，并在 smoke 结果中输出观测到的 emotion ids 和 scenarios。
- `pet bundle v0.1` 仍只包含现有 sprite atlas、manifest 和 privacy-safe provenance，不写入源图、提示词、模型响应或情绪扩展字段。

## Persona

| Field | Value |
| --- | --- |
| displayName | 兜兜 |
| tone | 短句、温柔、轻量陪伴、不打扰工作 |
| nonGoals | 治疗或诊断、恋爱化依赖、主动读取屏幕或摄像头、替代现实关系 |
| forbiddenTone | 危机时继续角色扮演、过度迎合、道德绑架、暗示用户只能依赖兜兜 |

## Emotion Catalog

| ID | 中文名 | Stage A 用途 | 视觉 QA 要点 |
| --- | --- | --- | --- |
| `calm_idle` | 兜兜安静陪伴 | 默认 idle 和 quiet 后的稳定陪伴 | 柔和眨眼、轻微呼吸、128px 下仍读作安静 |
| `happy_smile` | 兜兜轻快微笑 | 运动停住、成功反馈或轻量正向回应 | 眼睛上扬、嘴角弯、身体有轻微弹性 |
| `delighted` | 兜兜开心发光 | 未来用于强正反馈和庆祝，不作为当前主动打扰态 | 高光更亮、笑口更大、动作比普通开心更有弹性 |
| `shy_blush` | 兜兜害羞脸红 | 未来用于被夸和亲近反馈 | 脸红可见、视线略低、动作收敛不过度亲密 |
| `curious_tilt` | 兜兜好奇歪头 | 鼠标靠近或用户重新关注桌宠时的轻量响应 | 头部有方向感、眉眼不对称、不遮挡工作区 |
| `comfort_soft` | 兜兜温柔恢复 | 重复戳后的安静恢复和未来非临床安慰 | 眉眼放软、动作慢下来、不夸张卖惨 |
| `sad_soft` | 兜兜轻轻共情 | 未来用于用户低落文本的轻量共情 | 眉心轻压、嘴角小幅下垂、不呈现绝望感 |
| `teary` | 兜兜委屈观察 | 连续戳后从躲开切到观察停顿 | 泪光或委屈感可读、短暂停顿、安静后能恢复 |
| `surprised` | 兜兜被戳惊讶 | tap、核心碰触或突然靠近时的即时反馈 | 瞳孔/眼型变化明显、嘴小圆、身体有短弹跳 |
| `annoyed_pout` | 兜兜鼓脸躲开 | 重复戳后短期 wariness 的躲避表达 | 鼓脸或半月眼、后退方向明确、不表达攻击性 |
| `sleepy` | 兜兜困困打盹 | 未来用于长时间无互动或休息时段 | 眼皮半闭、呼吸变慢、不影响用户继续工作 |
| `focused_working` | 兜兜认真陪伴 | 拖拽、缩放和未来工作陪伴态 | 认真眼、动作克制、少干扰 |

## Runtime Scenario Mapping

| Scenario | Emotion ID | 触发来源 |
| --- | --- | --- |
| `idle` | `calm_idle` | 普通 `waiting` |
| `tap` | `surprised` | `poked` |
| `cursor_approach` | `curious_tilt` | `approaching` |
| `cursor_dodge` | `surprised` | `dodging` |
| `motion_stop` | `happy_smile` | `stopped` |
| `repeat_poke_retreat` | `annoyed_pout` | 连续戳后的 `retreating` |
| `repeat_poke_watch` | `teary` | 连续戳后的 `watching` |
| `quiet_recovery` | `comfort_soft` | `retreating` 或 `watching` 之后回到 `waiting` |
| `working` | `focused_working` | 拖拽、缩放或未来工作陪伴态 |

## Research Direction

Stage A 不接真实模型，但后续研究可沿三个边界推进：

- Live2D: 将上述 emotion ids 映射到 Cubism 参数、表情文件和动作组，保持 runtime 行为语义不依赖具体 SDK。
- LLM: 只输出安全的意图、语气和低频主动陪伴建议，不直接生成不可控动作。
- VLM: 仅在用户显式授权的输入上做角色资产质量判断或表情建议，不读取桌面、摄像头或私有窗口。

任何模型输出都必须先通过 safety 和 privacy 边界，再映射到本文件的稳定情绪 ID。

## Verification

Stage A 的自动证据来自：

- `tests/runtime/default-doudou-emotions.test.ts`: 校验 12 个情绪、中文命名、persona、安全边界和 runtime-only 映射。
- `npm run smoke:runtime`: fixture bundle 和 generated bundle 都必须观测到 `idle`、`tap`、`repeat_poke_retreat`、`repeat_poke_watch`、`quiet_recovery`、`working` scenarios，以及对应的核心 emotion ids。

这些检查证明默认兜兜情绪语义已经进入 runtime 行为闭环，同时不改变 bundle schema。
