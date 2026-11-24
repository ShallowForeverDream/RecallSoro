# RecallSoro 需求调研与整理（2026-11-24）

## 目的

把 RecallSoro 接下来要做的各个需求调研清楚，形成一份可执行的清单。需求来源有四：

1. **产品蓝图** `docs/recallsoro-product-blueprint.md`（先收集后整理、四层数据、混合 AI、只提建议）
2. **实现规格** `docs/recallsoro-implementation-spec.md`（v0.1 定的 Four Capture/Fact/Experience 模型）
3. **竞品全景** `docs/research/competitor-landscape-2026-11.md`（100+ 项目，市场空白与差异化）
4. **项目 todo**（二维码识别、手机端、云端 AI）+ 数据待补（27 条缺日期、74 条缺证书）

调研方式：五路并行子代理，分别负责二维码识别、手机端、云端 AI、OCR 字段抽取、跨设备同步，全部一手查证（官方文档/API/本地真实数据），不确定处标「未核实」。

---

## 一、需求全景（按优先级）

| 优先级 | 需求 | 状态 | 价值 | 依据 |
|---|---|---|---|---|
| P0 | 证书字段自动抽取（赛事名/奖项/日期） | 本轮调研完成，待实现 | 直接消灭 98 条 × N 字段的手工录入 | 竞品调研：无任何现成工具能做；R03 冲突案例证明证书是权威源 |
| P0 | 二维码自动打码 | 本轮调研完成，待实现 | 外发脱敏闭环的最后一环 | 当前只能手动画框；rqrr 检测阶段即给四角坐标 |
| P1 | 数据补齐（27 缺日期、74 缺证书、负责人/指导老师） | 长期待办 | 让台账真实可用 | 体检已能准确报数 |
| P1 | 跨设备同步 | 本轮调研中 | 用户明确要"跨机可用" | Anytype 警告 SQLite 不能放云同步目录 |
| P2 | 云端 AI 候选归类 | 本轮调研完成，待实现 | 字段抽取/照片分类/文案 | 产品原则：默认关、只提建议 |
| P2 | 手机端 | 本轮调研中 | 用户原话"之后也要有手机应用" | Tauri 2 支持同一套前端 |
| P3 | 自动回顾文案 | 未调研 | 生成类，错了不污染事实 | 蓝图列为四种回看方式之一 |

---

## 二、证书字段自动抽取（P0）

### 关键发现

赛事名识别本质是**检索匹配**而非生成——候选集只有 98 条，这是 RecallSoro 相对通用 OCR 产品的最大优势。

**台账里已有真实系列结构**（同 base 名 + 届次/年份/阶段才是唯一键）：
- 蓝桥杯：R01/R02（十五届省赛/国赛）、R10/R11/R12（十六届）、R54/R59/R66（十七届）
- ICPC：R15/R18/R23/R27/R29/R38/R61/R68/R72/R73/R78/N12
- 天梯赛、百度之星、攀拓、信息安全竞赛/ISCC、黄鹤杯、铸剑杯、数学竞赛等同理

**R03 案例**：legacy_notes 记录"历程写一等奖，原始获奖证书为二等奖"——证书是权威来源，抽取结果应允许覆盖台账并留痕。

### 技术路径结论

没有单一路径能满足需求，走**混合方案**：规则归一化 → 台账检索 → 模板快通道 → LLM 兜底 → 人工确认。

| 路径 | 离线 | 成本 | 中文赛事名适配 |
|---|---|---|---|
| 规则/正则 | ★★★ | ★ | 弱，靠人工别名表 |
| NLP 实体识别 | ★★ | ★★★★ | 中，需领域标注数据 |
| LLM 结构化 | ★★ | ★★ | 强，但分级不可信 |
| 模板匹配 | ★★★ | ★★★ | 弱，模板爆炸 |
| **混合（推荐）** | ★★ | ★★★ | 强，分层兜底 |

### M0 最小方案（1–2 周，纯离线零新模型）

1. 复用现有 Windows OCR，不引入新引擎
2. `normalizeOcrText()`：去 CJK 间空格、标点/数字/届次归一
3. 从 98 条台账自动生成 alias 索引 + 约 20 个高频简称手工表
4. 规则抽取：奖项词表、日期正则（含中文数字）、落款单位取末行
5. 赛事名打分：`0.5×字符相似度 + 0.2×专名命中 + 0.15×年份 + 0.15×阶段`；≥0.85 自动匹配，0.60–0.85 给 top-2/3 点选，<0.60 手工录入。届次不参与身份判定（证书写十五届而台账十六届时靠年份+阶段区分）
6. `hubei_level` 一律从台账带入，不由 OCR/LLM 推断
7. UI 输出候选值+置信度+证据 bbox+备选，确认结果回流为标注

### 字段抽取数据结构

```json
{
  "field": "award",
  "value": "省一",
  "raw": "省 级 一 等 奖",
  "confidence": 0.92,
  "source": "ocr | ledger | inferred | manual",
  "needsConfirmation": false,
  "evidence": { "line": 3, "bbox": [x,y,w,h], "text": "…" },
  "alternatives": [{ "value": "一等奖", "score": 0.31 }]
}
```

**置信度注意**：Windows `OcrWord` 只有 Text 与 BoundingRect，**不提供置信度**（已核实 Microsoft Learn）；PaddleOCR 带识别分数。所以置信度应是复合分：规则匹配强度 + 台账交叉校验一致性，冲突强制降权。

**字段 source 分配**：
- `hubei_level`：ledger 带入，不确认
- `award`/`score`/`rank`/`award_time`：OCR，与台账冲突时确认
- `register_time`/`competition_time`：ledger 或 manual（证书通常不载）
- **个人/团队、负责人、指导老师**：台账当前无此字段（已核实 ledger.json 31 个键里没有），需新增，且必须 manual 确认（涉及姓名隐私）

### 演进

- M1：PaddleOCR 第二引擎交叉验证低置信结果
- M2：用 98 条台账 + 已确认证书反向生成训练样本，微调 PP-Structure KIE
- M3：PP-ChatOCRv4 端到端产线，建立"确认→标注回流"闭环

**证据**：本地 `docs/competitions/competition-ledger.json`、`src-tauri/src/ocr.rs`、`docs/research/raw/paddleocr_cn.md`；Microsoft Learn OcrWord/OcrResult 文档；PaddleOCR 官方 README/KIE/PP-ChatOCRv4 文档；LayoutXLM(arXiv:2104.08836)、Donut(arXiv:2111.15664)。未发现可直接使用の中文获奖证书抽取模型/数据集（已核实检索结果，但不能断言不存在）。

---

## 三、二维码自动打码（P0）

### 结论：rqrr 首选，quircs 备选

**关键验证**：rqrr 0.11.0 的 `detect_grids()` **在检测阶段就输出四角坐标**，不需要解码——这正符合打码需求（只需位置，不需二维码内容）。

证据链：
- `Grid.bounds: [Point;4]`，文档明确顺序 `[左上, 右上, 右下, 左下]`，值为原图坐标
- `Point { x: i32, y: i32 }` 整数像素
- 源码 `prepare.rs:243-257`：bounds 在网格拟合时由坐标变换计算，与 `decode()` 无关
- README 示例注释即写 `// Search for grids, without decoding`

### 方案对比

| 方案 | 纯 Rust | 四角坐标 | 许可证 | 集成难度 |
|---|---|---|---|---|
| **rqrr 0.11.0** | ✅ | ✅ 检测阶段 | (MIT OR Apache-2.0) AND ISC（两处表述不一，需确认） | 低 |
| quircs 0.10.3 | ✅ | ✅ `Code.corners` | MIT | 低 |
| rxing 0.9.4 | ✅ | ⚠️ `getPoints()` 不保证四角 | Apache-2.0 | 低-中 |
| OpenCV QRCodeDetector | ❌ 原生库 | ✅ | Apache-2.0 | 高（Windows 分发原生库） |
| ZBar 系 | ❌ C 库 | ⚠️ Rust wrapper 未暴露 location | LGPL | 中-高 |
| jsQR | JS | ✅ 但需解码成功 | Apache-2.0 | 低（前端，桥接复杂） |

### 函数签名草案

```rust
pub struct NormalizedRect { pub x: f32, pub y: f32, pub width: f32, pub height: f32 }
pub struct NormalizedQuad {
    pub corners: [(f32, f32); 4],
    pub bbox: NormalizedRect,       // 供现有矩形遮罩直接消费
}

pub fn locate_qr_codes(image_bytes: &[u8]) -> Result<Vec<NormalizedQuad>, QrLocateError> {
    let img = image::load_from_memory(image_bytes)?.into_luma8();
    let (w, h) = (img.width() as f32, img.height() as f32);
    let mut prepared = rqrr::PreparedImage::prepare(img);
    let grids = prepared.detect_grids();  // 只检测，不解码
    // ... 四角转归一化 + 取 bbox
}
```

打码时 bbox 外扩 5%–10% 或 1–2 模块宽，覆盖静区（bounds 是否含静区未核实）。检测到但无法解码的网格也能遮——破损二维码同样被盖住，正是打码所需。

---

## 四、云端 AI 候选归类（P2）

### 推荐：只传脱敏文本 + BYOK + 物理隔离候选表

**核心红线**：四类能力（字段抽取/照片分类/相似归并/文案生成）一律输出候选，写入事实表必须用户逐项确认。物理隔离——新增 `fact_candidates` 表，云端 AI **没有写事实表的代码路径**（不是靠 prompt 约束，是数据层无权限）。

### API 对比（每千张证书成本，官方标价推算）

| 方案 | 成本 | 中文赛事名 | 结构化输出 | 隐私 |
|---|---|---|---|---|
| DeepSeek deepseek-flash | ¥3 | 强（推断） | JSON Output（非 strict 约束） | 中，境内 |
| 智谱 GLM-5.3-Flash | ¥2，有免费档 | 强（推断） | json_object + 客户端校验 | 中低，境内 |
| Qwen4-Max | ¥24（Batch ¥12） | 强（推断） | JSON Schema + decision-model 带置信度 | 中低，境内 |
| gpt-4o-mini | ¥3 | 中（推断） | 强 strict | 高，出境 |
| Claude Haiku 5.5 | ¥2，Batch 5折 | 中（推断） | 强约束解码 + ZDR | 中，出境 |
| 本地 Ollama | ¥0 边际 | 取决于权重 | JSON Schema（仅本地） | 极低 |

**首发选 DeepSeek 或 GLM-Flash**（境内、便宜、中文强），保留 Ollama 作为零出端档。OpenAI/Anthropic 作为可选高阶档，默认不推荐。

### 隐私姿态

默认全本地；云端开关默认关；**首发只开放"只传脱敏文本"**——RecallSoro 已有 `redactions` 敏感坐标，可在本地先遮罩姓名/学号/手机/身份证再上传，这是竞品没有的结构性优势。传图需二次显式同意、仅单张裁剪证书图、去 EXIF、模糊人脸。不做自动续费、不代持 Key（BYOK）、不发后台批量请求。

### 候选数据结构（FactCandidate 要点）

```ts
interface FactCandidate {
  id, captureId;                        // 可回溯到来源 Capture
  sourceKind: 'cloud_ai'|'local_ai'|'local_rule';
  provider?, modelId?, modelVersion?, promptTemplateVersion?, schemaVersion?;
  payloadHash;                          // sha256(实际发出的脱敏文本)，去重/审计
  transportMode: 'none'|'text'|'image';
  targetType: 'fact'|'experience_field'|'relation'|'narrative'|'merge';
  fields: Record<string, ExtractedField>;  // 字段级置信度 + 证据片段
  overallConfidence;                    // 仅排序，不用于自动写入
  conflictWith?: string[];              // 与现有事实冲突
  status: 'pending'|'accepted'|'rejected'|'expired'|'conflict';  // 默认 pending
  expiresAt?;                           // 建议 30 天过期
}
```

落地规则：字段级确认（接受单个字段只写该字段）；本地官方目录复核闸门（AI 不得覆盖 A2/B1/B2）；日期三元组（date_raw + date + precision）；所有返回过 JSON Schema + 业务枚举校验；幂等去重；接受时 `Fact.source = 'cloud_ai:<provider>:<model>'` 并带 `derivedFromCandidateId`；不自动合并。

### 分阶段

- 阶段 0：升级 MatchSuggestion 为统一候选通道 + 建 fact_candidates 表 + 官方目录复核闸门。验收：云端返回在代码层无法写入 facts
- 阶段 1：只传脱敏文本，用户开开关+填自己 Key，单张手动触发，展示"将发送的脱敏文本预览 + payloadHash"
- 阶段 2：传图（可选，二次同意），与阶段 1 交叉校验
- 阶段 3：merge_candidate diff 预览 + 文案草稿（独立存储）

---

## 五、手机端（P2）

### 结论：A 为主线（Tauri 原生），C 零成本先行，B 过渡兜底

系统分享入口是唯一无法用 Web 替代的刚需；前端可 100% 复用；轻量目标由 Tauri WebView（不打包 Chromium）+ size profile 满足。

| 功能 | 必须原生？ | 理由 |
|---|---|---|
| 收件箱拍照上传（系统分享面板送入） | **必须原生** | Android ACTION_SEND / iOS Share Extension 普通网页拿不到；PWA Web Share Target 仅 Android Chrome 可用 |
| 相册批量导入 | 原生优先，Web 勉强 | `<input type=file multiple>` 可批量，但大批量原图+持久化+权限体验差 |
| 查看台账 | Web 够用 | 只读展示 |
| 扫码传图 | Web 够用 | 现有 LAN HTTP 已覆盖 |
| 离线缓存 | PWA 基础够，原生更稳 | 大量图片建议原生 FS 落盘 |

### 分享入口接入（已核实 Tauri 官方文档）

- **Android：官方原生支持，无需插件**。`bundle.fileAssociations[].androidIntentActionFilters` 枚举 `Send`/`SendMultiple`/`View`，默认三者全开，构建时自动生成 intent filter。接收用 `RunEvent::Opened { urls }`：应用未运行时 URL 存 Rust managed state，前端启动后 `invoke('opened_urls')` 取；运行中 `app.emit("opened", urls)` + 前端 `listen`。
- **iOS：无官方支持，需自建 Share Extension target + App Group + deep-link 回传**。社区可借模板：`IT-ess/tauri-plugin-mobile-sharetarget`（MIT，15★，图片需自行扩展）、`lindongchen/tauri-plugin-share`（20★，偏旧）。

### 已知坑（官方 issue 已核实）

1. **IndexedDB origin 变化**：Tauri 1→2 升级后目录从 `https_tauri.localhost_*` 变 `http_tauri.localhost_*`，对全量 IndexedDB 应用等同数据丢失（issue #11252）；PR #11477 加 `use_https_scheme`。→ **首次安装需固定 scheme，避免将来迁移**。
2. **后台节流**：WebView 最小化后 timer 被节流，官方无开关（#5250）→ 纯前端定时器不能做可靠后台上传，需原生 Kotlin 协程/Swift。
3. **移动 dev 代理不稳**：iOS 冷启动 Vite 并发打满 backlog（#16552），Android dev 加载 Vite 文件极慢（#14097）→ 用 release 构建验证。
4. **权限须手工声明**：iOS Info.plist 的 `NSCameraUsageDescription` 等；Android Manifest 的 `CAMERA`/`READ_EXTERNAL_STORAGE`；Android 原生 @Command 默认主线程，长 IO 必须 `Dispatchers.IO` 否则 ANR。
5. **官方 upload 插件**存在且支持 android/ios（Rust ≥1.90），发 **raw body 非 multipart**，后端需适配。官方无 share 插件，有 `deep-link`/`nfc`/`barcode-scanner`/`upload` 等。

### 分阶段

- **阶段 0（1–2 周，零风险）**：继续用 LAN 扫码传图；抽出收件箱/台账的数据结构与 Dexie schema 为多端共用；固定 `app://tauri.localhost` scheme 并验证 IndexedDB origin。
- **阶段 1（Android 优先，2–4 周）**：`pnpm tauri android init`；配 `Send/SendMultiple` 接系统分享；FS 插件把 `content://` 文件拷入 AppData；Dexie 原样跑；发内测 APK。真机验证 content:// 解析、后台上传、大批量相册导入。
- **阶段 2（iOS，需 macOS + Xcode + 开发者账号）**：`pnpm tauri ios init`；Info.plist 权限；Share Extension + deep-link；真机验证 WKWebView IndexedDB 持久性（未核实）。
- **阶段 3（可选 PWA 兜底）**：manifest + SW，免安装只读台账/离线缓存，不作分享入口。

真机待验证未决项：content:// 可读性、iOS IndexedDB 长期留存、Android 13+ 媒体权限、iOS 后台上传窗口。

---

## 六、跨设备同步（P1，含重要纠错）

### ⚠️ 纠正 README 当前错误建议

README 现写「整个目录可直接丢进网盘或 Syncthing 同步」——**这是错的**。Anytype 官方原文（已核实）明确：

> "Do not place your active Anytype data directory inside a third-party cloud-synced folder... **High Risk of Database Corruption**... Cloud sync tools constantly monitor and lock files... disrupts database file-locking... 备份只能是应用**未运行时**的静态快照。"

启示：不能整个目录同步，必须**按可变性拆分**——只同步不可变/可合并部分，索引层永不同步。

### 三类对象的同步策略

| 对象 | 可变性 | 策略 |
|---|---|---|
| `blobs/` | 不可变、内容寻址 | 当普通文件同步；接收校验 SHA-256；写临时文件→校验→原子 rename；增量天然成立 |
| `ledger.json` | 高频可变 | **不作为同步主体**，改为「按实体拆分 + 追加日志」的本地派生物化缓存 |
| `versions/` | 追加写、写完不可变 | 优先当作可从日志重建的派生数据；如直接同步需确定性轮换（参考 Syncthing Staggered） |

两个坑：blob GC 竞态（A 删 blob 时 B 的 ledger 可能还没同步到 → 悬空引用，需宽限期）；快照与台账不一致（只同步 ledger 不同步 versions 会错位）→ 「单一权威日志 + 本地重建」比「同步两份状态」更稳。

### ledger.json 单文件并发冲突的解决

| 办法 | 评价 |
|---|---|
| 文件级锁 | **不可作主方案**：与离线优先根本冲突，云同步工具会无视锁（Anytype 实证破坏文件锁→不可逆损坏） |
| 按实体拆分文件 | **近期最实用**：`ledger/<type>/<id>.json`，冲突粒度降到实体级，现有同步工具可直接用 |
| CRDT（Automerge/Yjs） | **中期可选**：字段级合并、确定性收敛；同一属性并发写按 LWW（基于 counter+actorId 操作 ID，非墙钟），败者存 `getConflicts()` 多值寄存器 |
| 操作日志 event sourcing | **推荐主方向**：每条变更追加不可变 op `{actorId, counter, payload, hash}`；合并=并集+确定性全序；回放生成 ledger.json 与 versions/；不信任任何同步工具的合并能力 |

### 分层同步架构

```
索引层（搜索索引/缩略图/FTS/派生视图）  ✗ 永不同步，本地重建（Anytype 实证未加密索引泄露元数据）
元数据层（实体台账/版本历史）          ✓ 权威=追加式 op log 或 per-entity JSON；ledger.json=回放缓存
原件层（blobs/ SHA-256 分片）          ✓ 内容寻址不可变，任意同步工具皆可；接收校验 hash；GC 加宽限期
```

层间规则：**上层可由下层重建；下层绝不依赖上层**。

### 方案选型

- **Syncthing**：开源 P2P、块级增量、conflict copy 行为可靠；Android 有客户端，**iOS 官方明确无计划**（替代 SyncTrain/MobiusSync）→ 适合原件层与近期双设备试点，不作手机端必需组件。
- **Couchbase Lite**：手机端最现成（Android/iOS 官方 SDK、内置 revision/conflict resolution），但引入完整服务端栈运维重 → P3 手机端元数据层候选。
- **Automerge**：字段级 CRDT、`getConflicts()` 多值展示、网络适配器可插拔；公共 sync server 无可靠性保证，生产需自托管 → 中期元数据层候选。
- **网盘（OneDrive/坚果云）**：非 Office 文件冲突自动保留两份（OneDrive 最多 5 个）→ **仅作静态快照备份通道，不作实时同步**。

### 分阶段

- P0 止血：修订 README 停止建议整目录同步；明确三类文件可变性契约；索引层加入同步排除（Syncthing `.stignore`）；blob 写入加 SHA-256 校验+原子 rename；记录 actorId。
- P1 拆分试点：按实体拆分元数据文件；ledger.json 改派生缓存；Syncthing 双设备 P2P 试点（只同步 blobs+实体文件）；并发编辑测试。
- P2 权威日志：append-only op log + `(counter, actorId)` 确定性合并 + 回放；versions/ 从日志重建；冲突可视化（参考 `getConflicts()` 多值展示）。
- P3 手机端：元数据层自写 op log 或 Couchbase Lite；blobs 移动本地内容寻址 + 后台增量上传；索引层端上重建。

---

## 七、数据补齐（长期待办）

| 项目 | 数量 | 来源 | 补齐方式 |
|---|---|---|---|
| 缺开始时间 | 27 条 | 体检 | 按证书 OCR 日期，用户确认 |
| 缺证书佐证 | 74 条 | 体检（已修正假 0） | 快编逐条补，自动定位缺失槽位 |
| 团队赛负责人、指导老师 | 全部待补 | 原 Word 无对应列 | 需用户人工提供，不猜 |
| 其他佐证图片 | 98 条 | 全部待挂 | 扫码传图 / 本地导入 |

---

## 八、待用户决策

1. 手机端路径：Tauri 原生 / PWA / 纯 Web 局域网（见第五节调研）
2. 云端 AI 是否启用、用哪家（需用户自己配 Key）
3. 分级字段是否要补 A1 类别（官方 2026 目录无 A1，当前设计无 A1）
4. 二维码打码后是否要保留解码内容作为线索（当前方案只定位不解码）
