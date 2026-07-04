# 默认兜兜二次元角色资产规格

Status: asset specification for default character production
Date: 2026-07-04

## Scope

本文件定义默认兜兜的 AIG 角色方向二次元数字人资产规格，用于当前 deterministic sprite atlas、后续 Live2D 建模、生成 adapter prompt 约束和 QA 评审。它补足 `docs/DEFAULT_DOUDOU_EMOTION_SPEC.md` 的情绪语义：情绪规格回答“兜兜表达什么”，本文回答“兜兜长什么样、怎么动、怎样算合格”。

边界：

- 当前仍不改变 `pet bundle v0.1` schema，不向 `pet.json` 写入角色扩展字段。
- 当前仍不引入真实 Live2D SDK、LLM、VLM、云端模型调用或授权模型资产。
- 默认兜兜当前采用用户授权的 AIG 角色参考方向重绘成项目内 deterministic sprite，不提交 source image、source path、raw prompt、provider payload 或 AIG optional Live2D 资产。
- 当前 `fixtures/pet_bundles/valid_minimal_atlas_pet` 是 AIG 默认角色方向的可运行 8 帧二次元人形桌宠 bundle，不再是旧紫发蓝衣占位。

## Character Identity

| Field | Asset Standard |
| --- | --- |
| displayName | 兜兜 |
| characterType | 小型二次元数字人桌宠 |
| role | 安静陪伴用户工作，在被注意到时给出轻量、温柔、可忽略的回应 |
| personality | 好奇、认真、柔软、不吵、不抢屏幕注意力 |
| visualAge | 泛年龄、非写实、非幼态化；避免把可爱表达做成儿童化身体或语气 |
| prohibitedRead | 不读作猫、兽耳角色、恋爱伴侣、治疗师、外部 IP 角色、AIG 可分发资产拷贝或真实人物 likeness |

兜兜的第一眼应该是“在桌面边缘陪你工作的小小二次元数字人”，不是宠物猫，也不是聊天窗口拟人头像。角色应让用户愿意靠近，但默认不主动制造压力。

## Visual Design Lock

默认轮廓：

- 头身比偏桌宠化：sprite 占位可接近 1.6-2.2 头身，Live2D/高质量立绘可接近 2.5-3 头身，但仍保持小型桌宠可读性。
- 透明背景、单角色、正面或轻微 3/4 朝向、全身可见；不能只画头像。
- 128px 下必须能分辨头发、脸、上衣和手部或身体姿态；256px 下必须能分辨眼、眉、嘴和关键情绪效果。
- 主色不做单一色块糊成一团：棕色头发、红色发饰、暖肤色、黄色开衫、深色水手领和短裙需要有清晰明暗分离。
- 禁止猫耳、禁止尾巴、禁止兽爪、禁止铃铛项圈等会把默认兜兜读成猫或兽耳角色的符号。
- 不性感化、不幼态化、不做恐怖谷写实皮肤、不过度暴露、不使用外部品牌 logo 或角色符号。

建议基础色：

| Token | Usage | Suggested Range |
| --- | --- | --- |
| hair.main | 主体头发 | 棕色、栗棕或深棕 |
| hair.highlight | 刘海/侧发高光 | 暖棕或浅棕，面积克制 |
| hair.ribbon | 发饰 | 红色发饰，形状必须读作蝴蝶结或发带，不可像动物耳朵 |
| skin.main | 脸和手 | 温暖肤色，避免强反光 |
| outfit.cardigan | 上衣 | 黄色开衫，和头发、裙装保持明度差 |
| outfit.sailor | 领口/短裙 | 深色水手领、深色裙装或深色蝴蝶结 |
| effect.accent | 星光、泪光、问号等 | 黄色、浅蓝、粉色，单帧面积小 |

## Hair Specification

默认发型是棕色长发，带侧分刘海、两侧自然垂落的长发束和红色发饰。

必备特征：

- 棕色或深棕主发色，头顶圆润，但不要画成圆耳或双球形附属物。
- 侧分刘海清楚压在额前，至少有一组尖角或弧形发片，能在 128px 下破除“光头圆形”感。
- 两侧长发束落到脸颊、肩部或身体两侧，帮助形成 AIG 角色参考图中的二次元人形轮廓。
- 红色发饰必须贴附在头发侧面，读作蝴蝶结或发带；禁止把发饰画成动物耳朵。
- 后发可以是一整块柔和形状，但需要和脸部有明暗边界。
- Live2D 或分层资产应拆出 `front_bangs`、`side_locks`、`back_hair`，便于眨眼、歪头、呼吸和轻跳时有轻微余韵。

发型 QA：

- 128px 缩略图中，用户能看到“刘海 + 侧发 + 脸”的结构。
- 所有表情下刘海不能遮住双眼核心形状。
- 动作中头发只做轻微跟随，不抢主表情；`surprised`、`delighted` 可以有更明显弹性。
- 禁止猫耳、禁止尾巴，禁止用红色发饰伪装成动物耳朵。

## Outfit Specification

默认服装是黄色开衫叠深色水手领和短裙，读作工作陪伴型桌宠而不是偶像舞台服。

必备特征：

- 黄色开衫是主体识别色，和棕色头发、暖肤色、深色水手领形成三段式层次。
- 深色水手领、深色裙装或小蝴蝶结用于保持 AIG 参考角色的服装轮廓；元素要小，不可遮住脸。
- 袖口和手部要可读，至少在 `tap`、`working`、`shy_blush` 或未来动作中能表达缩肩、轻抬手、认真陪伴。
- 下半身可简化为深色百褶短裙、深色袜子和棕色鞋；sprite v0.1 可以抽象，但 Live2D/正式资产必须有稳定重心。
- 不使用真实品牌 logo、学校校徽、外部角色服装、医疗制服或会暗示治疗/权威身份的服饰。

服装 QA：

- 128px 下能区分棕色头发、红色发饰、脸、黄色开衫和深色水手领。
- 256px 下衣领和手部不能和背景或身体糊在一起。
- 连续动作中服装轮廓不能穿帮、闪烁或遮挡 hit area 核心。
- 不性感化、不幼态化，避免过短、过紧、过暴露或儿童化比例。

## Expression Asset QA

每个默认 emotion id 都必须有明确的面部通道和小尺寸 QA。正式资产可用 sprite、Live2D expression 或后续格式实现，但语义必须和下表一致。

| Emotion ID | Face Channels | Effect / Body Cue | QA Standard |
| --- | --- | --- | --- |
| `calm_idle` | 柔和眼、轻微微笑、自然眉 | 轻呼吸、轻眨眼 | 128px 下读作安静陪伴，不呆滞 |
| `happy_smile` | 笑眼、嘴角上扬、眉略抬 | 小幅身体弹性 | 和 `delighted` 区分，不能过度庆祝 |
| `delighted` | 更亮眼睛、张口笑、眉上扬 | 星光或高光轻闪 | 小尺寸下比 `happy_smile` 更强，但不吵 |
| `shy_blush` | 低视线、脸红、嘴小 | 缩肩或手部靠近脸 | 表达亲近但不过度恋爱化 |
| `curious_tilt` | 眼神跟随、单眉或不对称眉 | 头歪、身体轻靠近 | 清楚表达好奇，不像惊吓 |
| `comfort_soft` | 眉眼放软、微笑很小 | 慢靠近或呼吸放缓 | 只能做非临床安慰，不卖惨 |
| `sad_soft` | 眉心轻压、嘴角小落 | 身体低一点 | 共情低落但不绝望 |
| `teary` | 泪光、委屈眉、嘴小 | 停顿或小后退 | 来自连续戳后的观察，不做崩溃哭泣 |
| `surprised` | 眼睛放大、小圆嘴 | 短弹跳 | 用于 `tap` 或突然靠近，必须瞬时可读 |
| `annoyed_pout` | 半月眼、鼓脸或撇嘴 | 明确躲避方向 | 不表达攻击性，只是短期 wariness |
| `sleepy` | 半闭眼、困倦嘴 | 慢呼吸或小气泡 | 不影响用户工作，不遮挡内容 |
| `focused_working` | 认真眼、嘴平或小微笑 | 少动、轻点头 | 陪用户工作，不能像生气或低落 |

表情 QA 通用标准：

- 眼、眉、嘴至少两个通道共同表达同一情绪。
- 128px 和 256px 下都能区分 `tap`、`repeat_poke_retreat`、`repeat_poke_watch`、`quiet_recovery`、`working` 五个核心场景。
- 表情切换需要过渡帧、fade 或 motion easing；禁止突然跳脸。
- 表情特效必须是原创简单几何或项目自有图层，不能使用外部贴纸包、emoji 图像或 provider payload。

## Motion Asset QA

默认动作先服务桌宠存在感，不追求复杂舞台动作。所有动作都应保持透明背景、稳定锚点和不干扰工作区。

| Runtime Scenario | Emotion ID | Motion Requirement | QA Standard |
| --- | --- | --- | --- |
| `idle` | `calm_idle` | 呼吸、眨眼、极轻微上下浮动 | 30 分钟内不明显打扰，循环无断点 |
| `tap` | `surprised` | 被戳短弹跳、眼嘴瞬时变化 | 120-400ms 内完成主反应，能回到 idle |
| `cursor_approach` | `curious_tilt` | 轻微探头或歪头看向指针 | 只做视觉响应，不移动窗口 |
| `cursor_dodge` | `surprised` | 小幅躲闪或身体后仰 | passive cursor contact 不能移动窗口 |
| `repeat_poke_retreat` | `annoyed_pout` | 明确后退、鼓脸或半月眼 | 短期 wariness 可读，不显得被伤害过重 |
| `repeat_poke_watch` | `teary` | 后退后停顿观察 | 安静后能自然恢复，不持续惩罚用户 |
| `quiet_recovery` | `comfort_soft` | 慢慢恢复靠近、眉眼放软 | 从 `teary` 或 `annoyed_pout` 过渡不突兀 |
| `motion_stop` | `happy_smile` | 停住后轻微回弹 | 结束动作清楚但不抢屏 |
| `working` | `focused_working` | 少动、轻点头、认真陪伴 | 拖拽/缩放或工作态下不遮挡、不乱跳 |

动作 QA 通用标准：

- sprite v0.1 至少保持 8 帧合同；高质量 sprite 可在未来 schema 中增加帧数，但不能破坏当前 `idle` / `tap_react` 验证。
- Live2D 或后续 rig 需要给头发、衣摆、手部留出轻微 follow-through，但不能让 hit area 随便漂移。
- 动作锚点以脚底或身体中心为稳定参考；缩放、拖拽和透明窗口边缘交互不应改变角色身份。
- 动作设计不得暗示兜兜拥有治疗能力、读取屏幕能力或未经授权的感知能力。

## Bundle And Privacy Boundaries

角色资产规格不得扩大数据边界：

- `pet bundle v0.1` 仍只包含 `pet.json`、`preview.png`、`atlases/main.png` 和 `source.meta.json` 等 allowlist 文件。
- bundle 不得包含 source image、source path、raw prompt、raw provider response、provider payload、tokens、secrets、绝对路径或远程 URL。
- 默认兜兜正式资产必须是项目自有或明确授权素材；AIG 方向只提交项目重绘后的 sprite，不提交用户上传原图、AIG optional Live2D assets、第三方模型、外部角色图、官方 SDK/Core、`.moc3`、texture 或本地生成 runtime module。
- 云端生成、VLM、屏幕、摄像头、麦克风都必须 per-action opt-in；默认角色资产不需要这些输入。
- QA 截图、contact sheet 和生成中间件若包含个人 likeness，不得提交进仓库。

## Acceptance Checklist

一次默认兜兜角色资产评审至少检查：

- 角色第一眼读作“兜兜二次元数字人”，不是猫、兽耳角色、外部 IP 或真实人物。
- 发型满足棕色长发、侧分刘海、侧发、红色发饰、无猫耳、无尾巴。
- 服装满足黄色开衫、深色水手领、深色短裙、小尺寸清楚、不性感化、不幼态化。
- 12 个 emotion ids 都有对应视觉方案，且 `calm_idle`、`surprised`、`annoyed_pout`、`teary`、`comfort_soft`、`focused_working` 已覆盖核心 runtime 场景。
- 9 个 runtime scenarios 都有动作方案，并证明 passive cursor contact 不移动窗口。
- 128px 与 256px 预览都能辨认发型、脸、服装和核心表情。
- 资产和 metadata 不包含 source image、raw prompt、provider payload、secret、绝对路径或外部素材痕迹。
- 任何 Live2D/SDK/model 资产仍通过本地 ignored 路径验证，不进入 `pet bundle v0.1` 或 git。

## Verification

自动检查：

- `tests/docs/default-doudou-character-asset-spec.test.ts` 校验本文覆盖发型、服装、表情 QA、动作 QA、安全隐私边界、12 个 emotion ids 和 9 个 runtime scenarios。
- `tests/runtime/default-doudou-emotions.test.ts` 校验 emotion ids、中文命名、persona 和 runtime-only 映射。
- `npm run validate:fixture` 校验当前 AIG 默认二次元人形 bundle 仍符合 `pet bundle v0.1`。

人工检查：

- 渲染或导出 128px、256px 和桌面实际尺寸预览，对照本文 Acceptance Checklist 打分。
- 对正式 Live2D 或更高质量 sprite 资产，额外检查 license、分层命名、表情切换、动作 easing、透明边缘和本地路径脱敏。
