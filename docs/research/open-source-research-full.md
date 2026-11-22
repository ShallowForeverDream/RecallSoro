# 历史会话完整调研结论

来源：`session-20a49658-23b8-4caa-94c4-cecfee67f99c`。

以下 7 路调研结果由该会话的子代理通过 `gh api` 逐库核实，原样沉淀，供 RecallSoro 后续版本参考。

## 子代理：scout-pkm

已完成 `gh api` 检索与逐仓库核实。以下为结果（star 为 2026-11-22 检索快照；Joplin/Foam 许可证另经 LICENSE 文件核验）。

## PKM / 第二大脑 / 自托管笔记 开源项目调研

| 项目 (repo full_name) | star | 语言 | 许可证 | 核心功能一句话 | 部署形态 | 对"个人台账/经历整理"的可用点 | 主要局限 |
|---|---|---|---|---|---|---|---|
| siyuan-note/siyuan | 47,336 | TypeScript | AGPL-3.0 | 隐私优先知识工作空间，块级双链+关系图+数据库视图 | 本地桌面 + 自托管 | 数据库块直接当结构化台账（日记/账目/资料卡），块引用+反链+全局搜索串成网 | 功能面广、上手较陡；AGPL 分发约束 |
| TriliumNext/Trilium | 39,047 | TypeScript | AGPL-3.0 | 层级式知识库，笔记即节点，支持属性、关系、脚本与图谱 | 本地桌面 + 自托管 | 用"属性+关系"给每条经历打结构化字段，配合关系图和内置 SQL/搜索做交叉检索，台账建模最强 | UI 偏极客、移动端一般；AGPL |
| logseq/logseq | 45,686 | Clojure | AGPL-3.0 | 本地优先大纲式双链笔记，自带每日日志与结构化查询 | 本地优先（纯文件） | 日记流天然记录日常经历，块引用+Datatalog 查询可按标签/属性捞出"某年某类事件" | Clojure/EDN 生态与迁移成本；大库需调优 |
| usememos/memos | 64,627 | Go | MIT | 极简自托管闪念时间线笔记 | 自托管（单二进制/Docker） | 按时间线记流水账与片段经历，标签+全文搜索+可分享链接，部署最轻 | 偏短记录；长文档、双链与复杂关联弱 |
| AppFlowy-IO/AppFlowy | 79,339 | Dart | AGPL-3.0 | 开源 Notion 替代，数据库/看板/文档一体 | 本地优先 + 自托管 | 数据库视图做多表台账（联系人/账目/资料索引），关联字段跨表引用 | 资源占用重；自托管文档较复杂；AGPL |
| foambubble/foam | 17,498 | TypeScript | MIT（LICENSE 核验） | VSCode 内的纯 Markdown PKM，双链/回链/图谱/模板 | 本地（文件自有） | 内容全是可 git 管理的 .md，双链+标签+检索，最适合完全掌控原始文件的长期记录 | 依赖 VSCode；无内置同步；API 元数据写 NOASSERTION |
| laurent22/joplin | 57,288 | TypeScript | AGPL-3.0（LICENSE 核验） | 成熟跨平台笔记，多端同步+端到端加密+强搜索 | 本地优先 + 可选自托管同步 | 笔记本/标签/全文检索 + WebDAV/Nextcloud 同步，适合长期大量经历归档 | 双链/图谱弱于 SiYuan、Logseq；API 元数据写 NOASSERTION |
| iwe-org/iwe | 1,833 | Rust | Apache-2.0 | Markdown 知识图谱工具，LSP + CLI + MCP 记忆 | 本地（编辑器/CLI） | 把散落 .md 变成带反链与图谱的知识网，还能当 AI agent 记忆层 | 无图形化服务端/移动端；面向开发者 |
| dullage/flatnotes | 3,285 | Vue | MIT | 无数据库的自托管笔记，直接读写一个 Markdown 文件夹 | 自托管（Docker） | 文件透明、零迁移成本，标签+搜索可用，纯文本台账很省心 | 功能极简，无双链/图谱/结构化字段 |
| reorproject/reor | 8,526 | JavaScript | AGPL-3.0 | 本地 AI 笔记，自动关联并做语义搜索/问答 | 本地桌面 | 本地向量检索能"按意思"找回经历片段并自动连出关联，弥补关键词检索 | ⚠️ 仓库已归档（2025-05 停更），不建议新项目直接采用 |
| dendronhq/dendron | 7,473 | TypeScript | Apache-2.0 | 层级化 Markdown PKM，支持链接/图谱/发布 | 本地（VSCode 扩展为主） | 把"经历→项目→资料"编成可导航的树，纯 md 便于长期保存 | 最后推送 2025-11，生态活跃度下降 |
| revezone/revezone | 2,656 | TypeScript | AGPL-3.0 | 本地优先图形化第二大脑，白板+类 Notion 笔记 | 本地优先 + 自托管 | 用无限画布把经历、截图、资料按空间关系摆放，适合视觉化事件梳理 | 偏灵感草稿，结构化台账与查询较弱 |

## 官方 repo URL

- https://github.com/siyuan-note/siyuan
- https://github.com/TriliumNext/Trilium
- https://github.com/logseq/logseq
- https://github.com/usememos/memos
- https://github.com/AppFlowy-IO/AppFlowy
- https://github.com/foambubble/foam
- https://github.com/laurent22/joplin
- https://github.com/iwe-org/iwe
- https://github.com/dullage/flatnotes
- https://github.com/reorproject/reor
- https://github.com/dendronhq/dendron
- https://github.com/revezone/revezone

## 总结

这条方向最值得借鉴的是 **SiYuan**（块级双链+数据库视图+自托管，把"记录—关联—台账"收进一个隐私优先空间，是该需求的最直接答案）、**Trilium**（属性/关系建模让笔记变成可查询的结构化知识库，台账自由度最高）和 **Logseq**（日记流+块引用+查询，天然贴合"长期记经历再关联检索"）。若更看重极简与低部署成本，可用 Memos 记流水、Foam/纯 Markdown 做长期底座；reor 的本地语义关联思路值得学习，但仓库已归档，不建议直接依赖。

**取证说明**：所有 star、语言、许可证、archived/pushed_at 状态均来自 `gh api search/repositories` 与 `gh api repos/{owner}/{repo}` 的真实返回；Joplin 与 Foam 的许可证因 API 返回 NOASSERTION，另读取其 LICENSE 文件确认为 AGPL-3.0-or-later 与 MIT。搜索过程中出现的 `personal wiki self hosted` 一组结果混入大量无关 README 文本与低星噪声，已剔除，未纳入表格。

## 子代理：scout-photo

数据已收集充分（GitHub 搜索 API 后续触发限流，但所需项目详情均已取得）。以下是最终调研结果。

---

# GitHub 个人图片 / DAM 开源项目调研（面向"获奖证书图片 → 网页台账"场景）

检索方式：`gh api` 调用 GitHub 仓库搜索 API（多组关键词：self hosted photo management / digital asset management / photo gallery / photo metadata tagging 等），star 与元数据均为实际返回值。下表按**对本场景的相关度**排序（非纯 star 排序）。

| 项目 (repo full_name) | star | 语言 | 许可证 | 核心功能一句话 | 部署形态 | 对"证书图片分类整理/浏览"的可用点 | 主要局限 |
|---|---|---|---|---|---|---|---|
| [immich-app/immich](https://github.com/immich-app/immich) | 119810 | TypeScript | AGPL-3.0 | 高性能自托管照片/视频管理，时间线、相册、标签、人脸、OCR 全文搜索 | Docker Compose（server/web/ml/DB），NAS 社区包成熟 | 批量导入证书图后按**时间线/相册/标签**浏览，OCR 可搜证书上的文字，生态与文档最成熟 | 偏"个人生活照片云"，缺证书编号/获奖人/等级等结构化字段，需自定义元数据 |
| [photoprism/photoprism](https://github.com/photoprism/photoprism) | 40469 | Go | AGPL-3.0（GitHub 标 NOASSERTION） | AI 驱动的照片库，按时间/地点/主题自动分组，标签+文字识别检索 | Docker Compose / docker run | **最贴合"批量整理+自动分类"**：AI 自动按时间/主题归类，OCR/文字识别可检索证书内容，Web UI 直接当台账 | 同样缺乏业务字段建模；AI 分组结果需人工校验 |
| [photoview/photoview](https://github.com/photoview/photoview) | 6577 | Go | AGPL-3.0 | 自托管个人服务器照片库，按目录/相册/时间浏览，元数据+多用户 | Docker Compose | 轻量，按文件夹/日期组织证书图，多用户权限适合分享给评审查看 | 功能较基础，标签/检索能力弱于 Immich/PhotoPrism |
| [LycheeOrg/Lychee](https://github.com/LycheeOrg/Lychee) | 4333 | PHP | MIT | 优雅易用的自托管照片管理，相册+标签+分享链接 | Docker 一键 / LAMP | 把每类证书做成一个相册，网页相册台账**最直观**，分享链接便于交付 | 偏"展示"，批量元数据编辑与结构化字段弱 |
| [LibrePhotos/librephotos](https://github.com/LibrePhotos/librephotos) | 8182 | Python | MIT | 自托管照片管理，语义搜索、人脸识别、自动相册、标签 | Docker Compose | MIT 许可**最易二次开发**成定制证书台账；语义搜索可按"一等奖"等描述找图 | 部署较重（依赖 ML 服务），社区规模小于 Immich |
| [Piwigo/Piwigo](https://github.com/Piwigo/Piwigo) | 3890 | PHP | GPL-2.0 | 老牌 Web 图库，分类/标签/相册+200 余插件与主题 | LAMP / Docker | 分类+标签体系成熟，插件可扩展成带权限的证书台账门户 | 架构偏传统，界面与现代相册有差距 |
| [HoshinoSuzumi/chronoframe](https://github.com/HoshinoSuzumi/chronoframe) | 1988 | TypeScript | AGPL-3.0 | 个人画廊，相册管理、Live/Motion、EXIF 解析、地理位置与探索地图 | Docker Compose（Web+后端） | **时间轴画廊**视觉化呈现证书获得历程，EXIF 解析取拍摄时间，界面现代 | 较新、生态小；地理/动态照片特性对证书场景冗余 |
| [xemle/home-gallery](https://github.com/xemle/home-gallery) | 1216 | JavaScript | MIT | 自托管 Web 图库，手机友好，标签+AI 图片发现 | Docker / npm | 标签检索友好、移动端适配好，适合快速搭建可搜索的证书墙 | 功能聚焦浏览，档案级元数据能力有限 |
| [ArchiveHeritageGroup/heratio](https://github.com/ArchiveHeritageGroup/heratio) | 7 | PHP | AGPL-3.0 | 面向 GLAM 的档案/藏品/DAM/记录管理平台，RiC/ISAD(G)、IIIF、OAIS/OCFL 长期保存 | Laravel 12 自托管 | **档案语义最贴合**：证书=一条档案记录，天然支持描述字段、规范著录与长期保存 | 极新、星少，成熟度与文档待验证 |
| [dolag233/Serpent](https://github.com/dolag233/Serpent) | 736 | TypeScript | MIT | 跨平台数字资产与媒体管理，组织图片/视频/音频/3D，AI 搜索 | 跨平台桌面/服务端 | 面向创作者的资产管理，元数据+AI 搜索思路可借鉴 | 定位设计师/艺术家，非纯 Web 台账 |
| [division1/workgrid](https://github.com/division1/workgrid) | 0 | JavaScript | MIT | 纯本地浏览器媒体库，EXIF/元数据、手动+本地 AI 标签、评分、mood board | 纯前端本地运行，无需服务器 | 轻量网页台账的**极简参考**：EXIF、标签、评分一应俱全，零云端依赖 | 近乎实验项目，无服务端/多用户，不可直接用 |
| [unopim/unopim](https://github.com/unopim/unopim) | 11077 | PHP | MIT | 开源 PIM+DAM 平台（Laravel），管理海量产品数据与数字资产 | Docker / Laravel 自托管 | **结构化属性建模参考**：证书编号/获奖人/等级/日期可作属性字段管理 | 偏电商产品领域，非图片台账，需大量改造 |

**官方 repo URL 汇总**（均已在表格项目列超链接）：
- https://github.com/immich-app/immich
- https://github.com/photoprism/photoprism
- https://github.com/photoview/photoview
- https://github.com/LycheeOrg/Lychee
- https://github.com/LibrePhotos/librephotos
- https://github.com/Piwigo/Piwigo
- https://github.com/HoshinoSuzumi/chronoframe
- https://github.com/xemle/home-gallery
- https://github.com/ArchiveHeritageGroup/heratio
- https://github.com/dolag233/Serpent
- https://github.com/division1/workgrid
- https://github.com/unopim/unopim

**总结（最值得借鉴的 3 个）**：对"获奖证书图片分类整理成网页台账"这一场景，**Immich**（功能最全、OCR+时间线+相册标签、部署生态最成熟，可作整体框架）、**PhotoPrism**（AI 自动按时间/主题分组 + 文字识别检索，最贴合"批量整理"核心诉求）、**Lychee**（MIT、Docker 一键、相册即台账最直观，最快落地）最贴近，三者组合可覆盖"自动分类—搜索—展示"全链路；若强调证书的**档案属性**，可额外参考 heratio 的著录字段与长期保存设计。需注意的是，上述工具均为通用照片/DAM 系统，缺少"证书编号/获奖人/奖项等级"等业务字段，实际台账大概率需在 MIT 许可项目（LibrePhotos / Lychee / home-gallery）上做二次开发或外接结构化数据库。

## 子代理：scout-memory

调研完成。数据全部来自本机 `gh api`（`search/repositories` 多组关键词 + `repos/{owner}/{repo}` 详情 + README），采样时间 2026-11-22。搜索 API 中途耗尽配额，已用 core API 补齐经典项目，**未编造任何 star 数或 URL**。

## 1. 最相关的 12 个开源项目（按相关度排序）

| 项目 (repo full_name) | star | 语言 | 许可证 | 核心功能一句话 | 部署形态 | 对"个人记忆/经历台账"的可用点 | 主要局限 |
|---|---|---|---|---|---|---|---|
| [mem0ai/mem0](https://github.com/mem0ai/mem0) | 69,320 | Python | Apache-2.0 | 面向 AI Agent 的"记忆层"，即插即用的持久化上下文基础设施，生产级 | Python/TS SDK + 托管云(mem0.ai) + 开源自托管 | 事实-standard 的记忆抽取/更新/检索流水线，可作经历台账底座，支持用户级/会话级分层 | 偏"事实与偏好"记忆，非叙事型经历时间线；自托管需自配向量/图谱后端 |
| [volcengine/OpenViking](https://github.com/volcengine/OpenViking) | 42,573 | Python | AGPL-3.0 | 自进化上下文数据库，统一 Agent Memory、Knowledge RAG 与 Skills | Python 服务，本地/自托管 | 把对话、文档、技能统一成可演进上下文，适合做个人知识/经历的统一底座，火山引擎背书 | AGPL-3.0 对闭源商用不友好；较新，社区案例仍在积累 |
| [topoteretes/cognee](https://github.com/topoteretes/cognee) | 33,452 | Python | Apache-2.0 | 开源 AI 记忆平台，知识图谱+向量检索给 Agent 长期记忆，主打小模型免费 | Python 库(pip)，本地优先，可选云 | KG+向量混合，把散落经历结构化成可查询实体关系网，对模型成本低，适合个人自建 | 需自己编排数据摄入流水线；图谱质量依赖 LLM 抽取，可能有噪声实体 |
| [getzep/graphiti](https://github.com/getzep/graphiti) | 32,983 | Python | Apache-2.0 | 为 AI Agent 构建实时知识图谱，支持带时序/双时态的记忆 | Python 库，需外接图数据库(Neo4j 等)+LLM/embedder | 时序知识图谱天然契合"经历台账"：事件带时间戳、可追溯演变，避免把旧状态当成当前事实 | 需图数据库与 LLM/embedding 调用，运维与 API 成本高 |
| [letta-ai/letta](https://github.com/letta-ai/letta) | 25,510 | —(GitHub 元数据为空) | Apache-2.0 | 有状态 Agent 平台(MemGPT 后继)，分层记忆 + 自我改进 | Python 服务 + 托管云，可本地运行 | 分层记忆(核心/归档/召回)设计经典，适合构建"会记住并主动回顾经历"的长期伴侣 Agent | 偏 Agent 运行时平台，记忆只是其中一层；单独做纯台账系统偏重 |
| [EverMind-AI/EverOS](https://github.com/EverMind-AI/EverOS) | 13,963 | Python | Apache-2.0 | 可移植记忆层，local-first、Markdown 原生、用户自有，跨 app 自进化 | `pip install everos`，本地 SQLite+LanceDB 索引，零 API key/服务器，可选 `everos server` | **最贴近"个人经历云台账"理念**：记忆以可读 Markdown 为源、本地索引、用户完全拥有且可迁移 | 项目较新，生态/集成有限；主打 local-first，"云"同步需自己搭建 |
| [MemoriLabs/Memori](https://github.com/MemoriLabs/Memori) | 17,601 | Python | NOASSERTION(README 标称 Apache-2.0) | Agent 原生记忆基础设施，LLM 无关，把执行与对话转成结构化持久状态，面向企业 | pip/npm SDK + Memori Cloud(需 API key)，支持 VPC/on-prem | 结构化持久状态 + 多部署形态，适合把经历沉淀为可复用记忆资产 | 许可证 GitHub 标 NOASSERTION，合规需核实；快速上手依赖托管云与 API key |
| [memvid/memvid](https://github.com/memvid/memvid) | 17,433 | Rust | Apache-2.0 | 无服务器单文件记忆层，用编码式存储替代复杂 RAG 管线，离线亚 5ms 检索 | Rust 核心 + npm CLI + Node/Python SDK，单文件纯离线 | 单文件便携 + 完全离线，是"个人本地经历账本"理想的备份友好载体，无云锁定 | 更偏存储/检索加速，缺遗忘、矛盾消解、图谱关系等记忆治理语义 |
| [TencentCloud/TencentDB-Agent-Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory) | 31,089 | TypeScript | NOASSERTION | 团队级 Agent 记忆中心，把对话/文档/代码转成 Chat Memory、Skill、LLM-Wiki、Code-Graph 四类资产并治理共享 | 结合 TencentDB 的托管服务 | 四类记忆资产划分对"经历台账"分类建模有借鉴意义，含治理/共享/跨 Agent 装配 | 主打团队/企业而非纯个人；NOASSERTION 许可证需核实；与腾讯云绑定较深 |
| [tigerless-labs/agent-memory](https://github.com/tigerless-labs/agent-memory) | 4,325 | Python | MIT | Agent 长期记忆运行时，纯 Markdown 为唯一真相源，本地排序检索 + 独立 sleep-time 管理层，Claude Code/Codex 共享 store | 源码安装(未上 PyPI)，本地文件 + 可选 stdio MCP server，零 API key | **几乎是"个人经历台账"的直译**：Markdown 文件即账本、链接表关系、本地索引、零密钥零费用、跨 Agent 共享 | 需从源码安装，无一键部署；无内置 GUI；规模取决于本地索引能力 |
| [OSU-NLP-Group/HippoRAG](https://github.com/OSU-NLP-Group/HippoRAG) | 4,138 | Python | MIT | NeurIPS'24 研究框架，仿人长期记忆 RAG，知识图谱 + Personalized PageRank 跨文档整合 | Python 研究库(PyPI)，本地运行 | 学术上验证"类海马体"记忆整合机制，是经历关联检索的算法参考 | 研究性质，非开箱即用生产台账系统；缺用户管理、隐私控制等工程能力 |
| [doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) | 2,138 | Python | Apache-2.0 | MCP 持久记忆服务，REST API + 知识图谱 + 自主整合，本地 ONNX embedding | `pip install "mcp-memory-service[sqlite]"` / Docker 自托管，MCP+REST+OAuth+CLI+dashboard | 知识图谱 + 自主整合 + embedding 不出内网，数据隐私好，适合做私有经历台账后端 | 偏 MCP 工具链生态；社区规模中等；需自己跑服务进程 |

## 2. 官方 repo URL 清单

1. https://github.com/mem0ai/mem0
2. https://github.com/volcengine/OpenViking
3. https://github.com/topoteretes/cognee
4. https://github.com/getzep/graphiti
5. https://github.com/letta-ai/letta
6. https://github.com/EverMind-AI/EverOS
7. https://github.com/MemoriLabs/Memori
8. https://github.com/memvid/memvid
9. https://github.com/TencentCloud/TencentDB-Agent-Memory
10. https://github.com/tigerless-labs/agent-memory
11. https://github.com/OSU-NLP-Group/HippoRAG
12. https://github.com/doobidoo/mcp-memory-service

## 3. 总结

最值得关注的是 **mem0ai/mem0**（生态与工程成熟度的事实标准，适合做底座）、**getzep/graphiti**（时序知识图谱，最贴合"经历"的时间线与状态演变语义）、以及 **EverMind-AI/EverOS / tigerless-labs/agent-memory**（Markdown 为真相源、local-first、用户自有，几乎就是"个人经历台账"的开源形态）。用户说的"个人记忆经历云台账"在开源界主要对应**给 AI Agent 用的持久化记忆层 / 记忆服务（Memory Layer / Memory-as-a-Service）**这一类——细分有知识图谱记忆、情景/语义/程序记忆、local-first 个人知识库；而纯个人经历记录（日记/人生日志）在开源界多是笔记类 second-brain 工具，目前正与 Agent 记忆层融合。

**证据与口径说明**：所有 star / 语言 / 许可证取自 `gh api search/repositories` 与 `gh api repos/{owner}/{repo}` 的真实返回（2026-11-22 采样，数字随时间变化）；部署形态对 EverOS、tigerless、mcp-memory-service、memvid、Memori 取自其 README 安装段落，其余依据项目描述/官网谨慎推断。Memori 与 TencentDB-Agent-Memory 的 GitHub 许可证元数据为 `NOASSERTION`，前者 README 标称 Apache-2.0，引用前建议核实 LICENSE 文件。搜索 API 配额中途耗尽，未能单独跑 "lifelong memory"、"conversation memory" 等组，但已覆盖上述主流项目且未因此遗漏头部项目。

## 子代理：scout-ledger

已完成调研。数据来自 GitHub Search API 与 repos 详情接口（采集于 2026-11-22），star 为查询时快照；许可证列取 GitHub `spdx_id`，`NOASSERTION` 表示 GitHub 未自动归类（多为 AGPL/自定义条款），未擅自改写。

## 开源台账 / 个人数据库 / 低代码表格项目（按相关度排序）

| 项目 (repo full_name) | star | 语言 | 许可证 | 核心功能一句话 | 部署形态 | 对"个人台账/资料管理"的可用点 | 主要局限 |
|---|---:|---|---|---|---|---|---|
| [nocodb/nocodb](https://github.com/nocodb/nocodb) | 65599 | TypeScript | NOASSERTION | 自托管 Airtable 替代，把数据库表变成表格/看板/表单/画廊视图，带 REST API | Docker Compose / NPM / 源码；可挂 SQLite、MySQL、Postgres | 近乎"网页版资料管理器"成品，字段类型、视图、筛选、表单录入开箱即用，可直接替代自研 CRUD | 偏团队协作，单人略重；SQLite 支持弱于 MySQL/PG；许可商用需注意 |
| [teableio/teable](https://github.com/teableio/teable) | 22009 | TypeScript | NOASSERTION | AI 时代 Airtable 替代，基于 Postgres 的表格、视图、仪表盘与自动化 | Docker Compose（应用 + Postgres + Redis） | 现代 UI，表格+仪表盘+自动化，适合做结构化资料库底座 | 依赖 Postgres/Redis，比 SQLite 自建重；生态不如 NocoDB 成熟 |
| [apitable/apitable](https://github.com/apitable/apitable) | 15672 | TypeScript | AGPL-3.0 | API 导向低代码协作平台，多维表格与自动化 | Docker Compose 多服务 | "表格即数据库"能力强，API 优先便于对接脚本 | 组件多、运维较重；AGPL 传染性；个人单机偏重 |
| [baserow/baserow](https://github.com/baserow/baserow) | 6376 | Python | NOASSERTION | Python/Django 编写的 Airtable 替代，无代码建库、表单、自动化 | Docker Compose（Django + Postgres + Redis） | **Python 栈与自研最贴近**，便于读源码二次开发；表格/表单/视图齐备 | 必须配 Postgres/Redis，非 SQLite；资源占用较大 |
| [mathesar-foundation/mathesar](https://github.com/mathesar-foundation/mathesar) | 5184 | Svelte | GPL-3.0 | 给 Postgres 套类电子表格界面，直接查看/编辑/查询，不改数据库 | Docker / pip，直连现有 Postgres | 若愿从 SQLite 迁 Postgres，可把现有库直接变成网页台账，无中间层 | **只支持 Postgres**；GPL-3.0；偏数据库浏览而非表单化记录 |
| [sqlpage/SQLPage](https://github.com/sqlpage/SQLPage) | 2586 | Rust | MIT | SQL-only 数据应用构建器，写 SQL 查询即自动生成网页 UI | 单二进制，连现有 SQLite/Postgres/MySQL 等 | **与"SQLite + 网页"架构最同构**，页面层可用 SQL 文件替换，极轻量 | 复杂交互需自行扩展；UI 表现力受模板限制 |
| [monicahq/monica](https://github.com/monicahq/monica) | 25824 | PHP | AGPL-3.0 | 老牌自托管个人 CRM，记录朋友/家人/商务关系的笔记、互动、纪念日、礼物 | Docker Compose / PHP 自托管 | 个人"关系台账"成熟范本，字段模板、提醒、时间线可直接借鉴 | 领域固定在人际 CRM，非通用资料库；PHP 栈 |
| [workhold/doca](https://github.com/workhold/doca) | 673 | TypeScript | MIT | 中文开源文档管理与知识库，协同编辑、Markdown、表格、幻灯片、画布、AI 助手 | 自托管（Node.js / Docker） | 中文友好，文档+表格+知识库一体，适合"资料+笔记"混合管理 | 偏文档协同而非结构化台账；单人多用的协同能力冗余 |
| [sneg55/pingcrm](https://github.com/sneg55/pingcrm) | 133 | Python | AGPL-3.0 | AI 驱动个人人脉 CRM，自托管，同步 Gmail/Telegram/X/LinkedIn | 自托管（Python） | 展示"自动采集 + 关系评分 + 跟进提醒"的个人记录自动化思路 | 依赖第三方账号与 AI 服务；较新（133 star） |
| [arvarik/contrack](https://github.com/arvarik/contrack) | 119 | TypeScript | AGPL-3.0 | 自托管联系人管理与追踪，带在线信息增强 | 自托管（TypeScript/Next.js） | 轻量个人联系人台账，可借鉴"联系人 + 互动记录"数据模型 | 场景窄；需外部增强服务；AGPL |
| [CasualOffice/sheets](https://github.com/CasualOffice/sheets) | 72 | TypeScript | NOASSERTION | 自托管 Web 电子表格，`.xlsx` 往返与实时协同编辑 | 自托管 Web 服务（Node.js） | 若数据本质是 Excel，可直接在线化并兼容导入导出 | 仅 72 star、近期活跃度一般；偏表格计算而非数据库记录 |
| [pike00/Kindred](https://github.com/pike00/Kindred) | 11 | Python | NOASSERTION | 自托管个人 CRM，管联系人、互动、提醒、礼物、债务、日记，CardDAV 同步+全文搜索 | 自托管（Python） | 覆盖"生活台账"多种记录类型，Python 实现便于借鉴数据模型 | 早期项目（11 star）；偏个人关系而非通用资料库 |

**官方 repo URL 清单**
```
https://github.com/nocodb/nocodb
https://github.com/teableio/teable
https://github.com/apitable/apitable
https://github.com/baserow/baserow
https://github.com/mathesar-foundation/mathesar
https://github.com/sqlpage/SQLPage
https://github.com/monicahq/monica
https://github.com/workhold/doca
https://github.com/sneg55/pingcrm
https://github.com/arvarik/contrack
https://github.com/CasualOffice/sheets
https://github.com/pike00/Kindred
```

**总结**：最值得看的三个是 **SQLPage**（与自研的"SQL + SQLite + 网页"架构最同构，单二进制、零中间层，页面层几乎可直接用 SQL 文件替换，借鉴价值最高）、**NocoDB**（65k+ star 的成熟自托管 Airtable 替代，表格/视图/表单/API 齐全，可作为通用资料管理器的成品底座）和 **Baserow**（Python/Django 栈与用户技术背景最匹配，便于读源码做二次开发；若追求更现代的 UI 可换 Teable）。若数据偏"人际/生活关系记录"，Monica 与 Kindred 的数据模型也值得直接抄。

## 子代理：scout-awards

已完成调研。以下为结果（数据来自 `gh api search/repositories` 与 `gh api repos/{owner}/{repo}`，查询时间 2026-11-22；star 与归档状态均为 API 当时返回值，已过滤描述超长的无关搜索噪声）。

## 开源项目调研表（按与"奖项/证书/图片台账"相关度排序）

| 项目(repo full_name) | star | 语言 | 许可证 | 核心功能一句话 | 部署形态 | 对"奖项/证书/图片台账"的可用点 | 主要局限 |
|---|---|---|---|---|---|---|---|
| [mozilla/openbadges-backpack](https://github.com/mozilla/openbadges-backpack) | 862 | JavaScript | NOASSERTION | 收集、展示、分享跨站点获得的开放徽章（数字成就） | Web（backpack.openbadges.org，已归档） | 徽章＝发行方＋证据图片＋断言＋校验，最接近"奖项＋图片＋核对状态"的数据模型与徽章墙展示 | 已 archived；面向数字徽章而非纸质奖状；无自定义核对状态字段 |
| [ryjones/learner-credential-wallet](https://github.com/ryjones/learner-credential-wallet) | 91 | TypeScript | MIT | 跨 iOS/Android 存储与分享可验证的学习证书 | 移动 App + 项目主页 | 把证书作为可验证凭证存档/分享，含颁发方与验真思路 | 移动端为主；VC/DID 栈重；无批量图片整理与台账视图 |
| [academicpages/academicpages.github.io](https://github.com/academicpages/academicpages.github.io) | 17840 | SCSS | MIT | 学者个人主页/作品集模板（含荣誉、经历栏目） | 静态 GitHub Pages（Jekyll） | 最易落地：Markdown/YAML 数据文件列奖项＋图片＋状态，零后端、免费自托管 | 通用模板，需自行加图片墙/核对状态；非专用台账应用 |
| [fedora-infra/tahrir](https://github.com/fedora-infra/tahrir) | 85 | JavaScript | NOASSERTION | 自建 Open Badges 颁发 Web 应用 | Web（badges.fedoraproject.org） | 完整"徽章定义＋图片＋颁发记录＋验证"模型，可映射奖项/图片/状态 | 颁发方视角；需数据库部署；与纸质奖状场景有距离 |
| [mmistakes/minimal-mistakes](https://github.com/mmistakes/minimal-mistakes) | 13601 | HTML | MIT | 通用 Jekyll 个人站点/作品集主题（支持集合与图库） | 静态 GitHub Pages | 用 collection 建模"奖项条目"＋图片＋front-matter 状态，生态成熟 | 是主题不是应用；需自行设计字段与批量导入 |
| [xan105/Achievement-Watcher](https://github.com/xan105/Achievement-Watcher) | 993 | JavaScript | LGPL-3.0 | 解析游戏成就文件，实时通知＋自动截图＋已获成就总览 | 桌面端（Windows/Node） | "成就达成→自动截图→已获得列表"链路，可借鉴自动留存获奖图片与状态标记 | 游戏/Steam 专属；桌面程序；已 archived |
| [omn7/Vura](https://github.com/omn7/Vura) | 20 | TypeScript | MIT | 活动方批量生成并验证证书，带真实性与可追溯 | Web（vurakit.in） | 批量证书生成＋验证/追溯，直接对应"核对状态"与真伪校验 | 主办方视角；项目新、star 少；非个人收藏台账 |
| [Schroedinger-Hat/certo](https://github.com/Schroedinger-Hat/certo) | 65 | TypeScript | AGPL-3.0 | 课程/会议主办方用 Open Badges 3.0 生成认证 | Web（certo.schroedinger-hat.org） | OB 3.0 证书模板化生成，图片与元数据绑定方式可参考 | 颁发方工具；AGPL 许可；不做个人汇总展示 |
| [1EdTech/openbadges-validator-core](https://github.com/1EdTech/openbadges-validator-core) | 61 | Python | Apache-2.0 | Open Badges 数据/断言校验库 | Python 库/CLI | 可借鉴实现"核对状态"的校验逻辑（字段、签名、颁发方） | 只有库，无 UI/存储；不处理批量图片 |
| [wwWallet/wallet-frontend](https://github.com/wwWallet/wallet-frontend) | 47 | TypeScript | BSD-2-Clause | Web 优先的数字凭证钱包，支持签发/存储/出示 | Web（demo.wwwallet.org） | Web 端凭证"存档—查看—验证"交互范式，可参照证书详情页 | OpenID4VCI/VP 标准栈复杂；偏数字身份；非轻量台账 |
| [TheVicky1/GitVerse](https://github.com/TheVicky1/GitVerse) | 18 | Go | MIT | GitHub 成就追踪器：徽章目录/等级进度追踪 | Web（Vercel）+ Go CLI | "徽章清单＋进度/等级状态"栏目组织方式与台账相似 | 仅 GitHub 成就；star 少；无图片佐证管理 |
| [Hazrat-Ali9/Hazrat-Achievements](https://github.com/Hazrat-Ali9/Hazrat-Achievements) | 66 | — | MIT | 用仓库集中展示个人学业与职业成就 | GitHub 仓库（Markdown） | 最直白的"个人成就展示"信息组织参考，可与简历/作品集联动 | 静态仓库展示；无图片台账/核对状态等应用能力 |

## 官方 repo URL

1. https://github.com/mozilla/openbadges-backpack
2. https://github.com/ryjones/learner-credential-wallet
3. https://github.com/academicpages/academicpages.github.io
4. https://github.com/fedora-infra/tahrir
5. https://github.com/mmistakes/minimal-mistakes
6. https://github.com/xan105/Achievement-Watcher
7. https://github.com/omn7/Vura
8. https://github.com/Schroedinger-Hat/certo
9. https://github.com/1EdTech/openbadges-validator-core
10. https://github.com/wwWallet/wallet-frontend
11. https://github.com/TheVicky1/GitVerse
12. https://github.com/Hazrat-Ali9/Hazrat-Achievements

## 总结

最贴近你那个"竞赛奖状＋获奖图片＋核对状态网页台账"的是 **academicpages/academicpages.github.io**（静态 GitHub Pages 零后端，最容易直接照着做台账页面）、**mozilla/openbadges-backpack**（"奖项＝发行方＋图片＋断言＋校验"的数据结构几乎就是你的字段设计）和 **ryjones/learner-credential-wallet**（证书验真与分享的交互范式）。最值得借鉴的三点：用 Open Badges 的"声明＋图片＋验证"结构定义奖项条目，用 academicpages 的 Markdown/YAML＋Pages 做免运维部署，用 Vura / openbadges-validator-core 的校验思路实现你的"核对状态"字段。

## 子代理：scout-timeline

已完成检索（GitHub Search API + 核心 API 交叉核验 star/许可证/归档状态，并抽查 README 确认导出与时间线能力）。以下为结果。

## 开源项目调研表（简历 / 时间线 / 日记 lifelog / 个人档案）

| 项目(repo full_name) | star | 语言 | 许可证 | 核心功能一句话 | 部署形态 | 对"经历整理/时间线展示"的可用点 | 主要局限 |
|---|---:|---|---|---|---|---|---|
| [reactive-resume/reactive-resume](https://github.com/reactive-resume/reactive-resume) | 45,970 | TypeScript | MIT | 隐私优先的开源简历生成器，可视化编辑+多模板 | Web 应用，Docker 自托管或官方托管 rxresu.me | 兼容 JSON Resume 标准，奖项/荣誉作为结构化条目按时间排布；可导出 PDF/Word/Markdown/JSON 并生成公开链接 | 面向求职简历而非纯时间轴；全功能需自建后端，无独立"获奖时间轴"视图 |
| [usememos/memos](https://github.com/usememos/memos) | 64,627 | Go | MIT | 自托管轻量笔记，所有记录汇入个人时间线 | 自托管 Web，Docker 一行命令/Compose | 每条 memo 绑定日期形成时间轴，标签跨时间串联，Markdown 撰写——最适合逐条沉淀获奖记录 | 是笔记流不是结构化履历；无奖项字段/简历模板，不适合直接出正式 PDF |
| [rendercv/rendercv](https://github.com/rendercv/rendercv) | 17,989 | Python | MIT | 用 YAML 写学术/工程简历，自动生成专业排版 PDF | Python CLI / PyPI，本地生成，无服务端 | 支持任意自定义 section，示例 YAML 原生含 `selected_honors`、Experience、Education 等 9 类条目，竞赛获奖可直接套用 | 纯命令行，无 Web UI 与可视化时间线；需手工维护 YAML |
| [academicpages/academicpages.github.io](https://github.com/academicpages/academicpages.github.io) | 17,840 | SCSS | MIT | GitHub Pages 学术个人主页模板 | 静态站（GitHub Pages 免费），亦可 Docker 本地预览 | Publications/Talks/Teaching 等按年份分组展示，附 TSV→Markdown 生成器，适合做公开"获奖与经历档案页" | 静态站，需 Git/GitHub 基础；无数据库和在线编辑，时间线排版需自行调整 |
| [xitanggg/open-resume](https://github.com/xitanggg/open-resume) | 8,994 | TypeScript | AGPL-3.0 | 开源简历生成器 + PDF 简历解析器 | 纯前端 Web / Docker 自建，PDF 浏览器端生成 | 表单实时生成 PDF，可导入已有 PDF 反向解析；适合快速产出单页"竞赛获奖简历" | 单页美式简历、设计单一；无多条目时间轴视图 |
| [AienTech/dossier](https://github.com/AienTech/dossier) | 5,352 | TypeScript | AGPL-3.0 | 自托管求职与简历工作台，由统一 Profile 生成定制简历 | 自托管 Web（Docker / Node / Ubuntu / CapRover） | 以一份 Profile 为事实源生成多版本简历，12 套主题、服务端 PDF 打印，全量数据可导入导出 | 偏求职申请场景，带申请追踪等额外复杂度；AGPL 许可需留意 |
| [ZhuJHua/moodiary](https://github.com/ZhuJHua/moodiary) | 2,086 | Dart | AGPL-3.0 | 全开源跨平台日记 App（Flutter + Rust） | 桌面/移动端 App，本地存储 + WebDAV/S3 同步 | 时间线性日记视图，可导出 Markdown/Word/PDF/长图，适合把获奖流水账导出归档 | 定位情绪与生活日记，非奖项结构化；移动端为主 |
| [Yu-Core/SwashbucklerDiary](https://github.com/Yu-Core/SwashbucklerDiary) | 1,641 | C# | AGPL-3.0 | 侠客日记：开源跨平台本地日记 | 本地 App（Android/Windows/macOS/Web/Linux） | 按日期沉淀记录，Markdown 即时渲染，可作为长期经历档案 | 日记而非履历，无简历式 PDF 排版导出；中文社区项目 |
| [Demizo/Daily_You](https://github.com/Demizo/Daily_You) | 1,432 | Dart | GPL-3.0 | 私密日记与心情记录 App | Android 移动 App，本地 + 加密备份/同步 | 支持 Markdown 富文本、多格式导出与导入，长期记录成长轨迹 | 以心情/日记为核心，缺奖项分类字段；移动端为主 |
| [journiv/journiv-app](https://github.com/journiv/journiv-app) | 1,262 | JavaScript | NOASSERTION | 自托管私密日志（Journal） | 自托管 Web，Docker / Compose | 可自建获奖记录库，支持导入导出任务（需启用 worker） | 明确标注 pre-1.0、可能破坏性变更，需定期备份；许可证 NOASSERTION 需自行确认 |
| [Renovamen/oh-my-cv](https://github.com/Renovamen/oh-my-cv) | 1,106 | TypeScript | GPL-3.0 | 浏览器内、本地优先的 Markdown 简历生成器 | 纯前端（无后端），数据留在本机 | Markdown 写简历 + 实时预览，导出 A4/US Letter PDF，适合完全离线整理 | 单份简历、无时间轴视图；云备份尚未提供，需手动导出备份 |
| [theachoem/storypad](https://github.com/theachoem/storypad) | 1,046 | Dart | GPL-3.0 | 时间线式日记 App（10 万+ 下载） | 移动端 App（iOS/Android），本地 + Google Drive 同步 | Timeline journaling 无文件夹的自然时间流，可置顶重要条目，Markdown/文本/完整备份导出 | 移动端为主，导出不含 PDF 排版；同步依赖 Google Drive |

## 总结

最值得借鉴的三个是 **reactive-resume**（JSON 结构化数据 + PDF/Word/Markdown 多格式导出 + 可自托管，最完整覆盖"整理—展示—导出"闭环）、**rendercv**（YAML 原生支持 `selected_honors` 等获奖章节与学术排版，竞赛奖项条目可直接套用）和 **usememos**（日期绑定时间轴 + 标签 + Markdown，最适合日常逐条沉淀获奖记录后再汇总导出）。若目标只是做一页公开档案而非正式简历，`academicpages` 是零成本静态托管的最优补充。

证据口径：star/许可证/归档状态取自 `gh api repos/{owner}/{repo}`（抓取时间 2026-11-22 UTC）；时间线与导出能力取自各仓库 README 原文（如 RenderCV 示例 YAML 含 `sections` 与 `selected_honors`，Memos 描述为 "personal timeline"，Storypad README 含 "Timeline journaling"/"Markdown Export"）。未列入 star 极低或已归档项目（如 `facebookresearch/personal-timeline` 370 star 但 archived）。

## 子代理：scout-inventory

已完成调研。数据全部通过 `gh api` 实时检索获得（搜索 API 受限流影响，改用核心 API 逐仓核查精确 star/license/topics），原始元数据留存在 `repo_data.json`。

## 个人台账方向开源自托管项目清单（按与"个人台账"的相关度排序）

| 项目 (repo full_name) | Star | 语言 | 许可证 | 核心功能一句话 | 部署形态 | 对"个人台账"的可用点 | 主要局限 |
|---|--:|---|---|---|---|---|---|
| [karakeep-app/karakeep](https://github.com/karakeep-app/karakeep) | 30753 | TypeScript | AGPL-3.0 | "书签一切"：链接/笔记/图片统一收录，AI 自动打标 + 全文检索 | Docker Compose 自托管 + 移动客户端 | 最接近"通用个人台账"：多类型条目、标签、全文搜索一体 | 由 Hoarder 改名而来；AI 能力需配置模型；较新 |
| [monicahq/monica](https://github.com/monicahq/monica) | 25824 | PHP | AGPL-3.0 | 个人 CRM：记录亲友/同事的互动、纪念日、关系脉络 | Docker / Laravel 自托管 | 人脉台账的唯一强项目，可系统化记录"人"这类非结构化资产 | 社交关系维度为主，复用为通用资产台账需改造；Laravel 部署偏重 |
| [linkwarden/linkwarden](https://github.com/linkwarden/linkwarden) | 20502 | TypeScript | AGPL-3.0 | 协作式书签 + 网页完整存档 + 标注 + 稍后读 | Docker Compose 自托管（Next.js） | 链接台账 + 防链接失效的归档能力，适合"收藏即存档" | 协作功能对纯个人略冗余；依赖服务较多 |
| [wallabag/wallabag](https://github.com/wallabag/wallabag) | 13071 | PHP | MIT | 稍后读经典：保存网页、分类、打标、离线阅读 | Docker / Symfony PHP 自托管 | 文章型台账的成熟范式，标签+分类+全文检索可借鉴 | 仅面向网页文章；PHP/Symfony 栈较重 |
| [go-shiori/shiori](https://github.com/go-shiori/shiori) | 11880 | Go | MIT | 轻量书签 + 稍后读，Go 单文件实现 | 单二进制 / Docker | 极简部署的书签台账，适合做轻量自托管底座 | 无 AI/语义检索，功能相对朴素 |
| [grocy/grocy](https://github.com/grocy/grocy) | 9701 | Blade(PHP) | MIT | 家庭 ERP：食品/日用品库存、保质期、采购与家务管理 | Docker / PHP Web | 家庭实物资产台账标杆，库存+过期提醒思路可直接借用 | 偏食品/耗材，非通用物品；无强标签体系 |
| [inventree/InvenTree](https://github.com/inventree/InvenTree) | 7890 | Python | MIT | 通用库存管理系统，支持自定义字段、条码、位置层级 | Docker / Django Web | 结构化物品台账的经典模型（位置、分类、条码、附件） | 偏工业/零件场景，个人物品上手门槛偏高 |
| [hay-kot/homebox](https://github.com/hay-kot/homebox) | 2999 | Go | AGPL-3.0 | 面向家庭用户的物品库存与整理系统（位置、标签、保修、照片） | Docker / Go Web | 家庭物品台账最对口的参考实现 | **仓库已归档（archived=true）**，维护停滞，不宜直接依赖 |
| [TriliumNext/Trilium](https://github.com/TriliumNext/Trilium) | 39047 | TypeScript | AGPL-3.0 | 本地优先的个人知识库，层次笔记 + 知识图谱 + 脚本扩展 | Electron 桌面 / Docker 服务端 | 知识型台账的强范式：属性化笔记、关系图谱、自托管同步 | 学习曲线陡；Electron 客户端较重 |
| [siyuan-note/siyuan](https://github.com/siyuan-note/siyuan) | 47337 | TypeScript | AGPL-3.0 | 隐私优先、自托管的知识工作空间，Markdown + 块引用 + 本地优先 | Docker 服务端 / 桌面客户端 | 中文生态友好，块级结构化适合沉淀台账条目 | 偏笔记/文档，非表格化"账本"；生态相对自成体系 |
| [shaarli/Shaarli](https://github.com/shaarli/Shaarli) | 3924 | PHP | NOASSERTION | 极简、无数据库、超快的书签服务 | PHP 单目录部署，零数据库 | 部署成本最低的书签台账，适合资源受限环境 | 功能极简，无 AI/语义检索；许可证标注为 NOASSERTION |
| [Kovah/LinkAce](https://github.com/Kovah/LinkAce) | 3356 | PHP | GPL-3.0 | 自托管的链接归档库，收藏并长期保留喜欢的网页 | Docker / Laravel 自托管 | 链接归档型台账，topics 明确含 self-hosted/docker | 功能较基础，社区规模小 |

补充证据：搜索阶段还发现若干更细分的项目（如 `grokability/snipe-it` 15221★ IT 资产/许可证管理、`kenforthewin/atomic` 2014★ 语义关联个人知识库、`Part-DB/Part-DB-server` 1861★ 电子元件库存、`actualbudget/actual` 30394★ 本地优先个人理财），因篇幅未入主表，可作为资产/财务台账的补充方向。

**总结**：最值得借鉴的是 **Karakeep**（把链接、笔记、图片统一成"可检索的个人台账"，标签+全文检索的范式最通用）、**Monica**（唯一成熟的人脉台账模型，弥补"人"这类资产的系统化记录空白）和 **InvenTree/Grocy**（提供物品台账的结构化字段、位置层级、条码与到期提醒设计）。若要落地自托管，优先选 Karakeep + Monica 的组合，物品侧参考 InvenTree 的数据模型自建，避开已归档的 Homebox 与许可不透明的 Outline（NOASSERTION/BSL）。

## 会话后期结论摘录

### turn 8 step 1

第 6 路（简历 / 时间线 / 日记）已回收。这路补上了"整理完之后怎么用"的闭环——**reactive-resume**（JSON Resume + 多格式导出 + 自托管）、**rendercv**（YAML 原生 `selected_honors` 获奖章节，学术排版直接套用）、**academicpages**（免费静态主页做公开获奖档案）。

只剩最后 1 路（物品 / 人脉 / 书签台账）在跑。回来后立刻出总汇总。

### turn 9 step 3

7 路调研全部回收完毕。我把结果整理成一份完整报告存档，并在这里给你总览。

### turn 9 step 5

调研完成，7 路并行全部回收，约 80 个项目去重整理成[完整报告](个人台账开源项目调研.md)（含 star、许可证、部署形态、可用点、官方链接和落地建议）。

速查卡片和报告都指向同一个核心结论：**开源界没有"竞赛奖状＋图片＋核对状态"的成品台账**，但你自研的方向对，缺的都是可以抄的零件——

- **数据模型**抄 Open Badges（发行方＋图片＋断言＋校验＝你的奖项字段）；
- **图片粗分**借 PhotoPrism 的 AI 分组＋OCR，再进你的台账人工核对；
- **底座**想省事用 NocoDB，想保留现有 SQLite 就用 SQLPage（架构最同构）；
- **导出闭环**接 reactive-resume / RenderCV，一键出 PDF 档案。

另外三个已归档项目（reor、Homebox、Achievement-Watcher）和几个 `NOASSERTION` 许可的坑已在报告里标出。本轮只扫了 GitHub；要补 Gitee/GitLab 中文平台的话说一声。

