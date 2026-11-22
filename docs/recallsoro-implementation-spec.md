# RecallSoro 实现规格 v0.1

## 目标

RecallSoro 是一个个人电子经历总台账。任何照片、文件、文字、链接或外部导入资料先进入统一收件箱，再逐步整理成事实、经历和展示视图。

第一版已经确定：

- 部署在本机或家庭服务器。
- 支持网页拖拽上传、手机分享、快速文字记录、文件夹或相册导入。
- 所有资料先接收，不要求上传时选择竞赛、旅行或其他类型。
- 采用混合 AI。确定性提取优先本地完成，云端识别可关闭。
- 使用时间轴、全文搜索、模板卡片和自动回顾四种回看方式。

## 数据模型

### captures

保存用户导入的原始资料。

- `id`
- `kind`: image、video、file、text、link、audio
- `storage_key`: 原文件在对象存储中的路径
- `original_name`
- `mime_type`
- `size_bytes`
- `sha256`
- `source`: web、mobile_share、folder_import、album_import、quick_note
- `captured_at`: 用户认为资料产生的时间，可为空
- `imported_at`
- `status`: inbox、processing、ready、archived、deleted
- `created_at`
- `updated_at`

同一 `sha256` 的二进制文件只保存一份。再次导入时创建来源记录，不重复存储文件。

### facts

保存从原始资料中提取或由用户确认的事实。

- `id`
- `capture_id`
- `type`: exif、ocr、filename、location、person、keyword、summary
- `value_json`
- `confidence`
- `source`: local_extractor、cloud_model、user
- `model_version`
- `confirmed_at`
- `created_at`

原始内容和事实分开保存。重新识别时可以新增事实版本，不覆盖原始资料。

### experiences

保存一段真实经历。

- `id`
- `title`
- `description`
- `start_at`
- `end_at`
- `time_precision`: exact、day、month、year、range、unknown
- `location_json`
- `status`: draft、active、archived
- `created_by`: user、suggestion
- `created_at`
- `updated_at`

一段经历可以是一次旅行、一次竞赛、一个项目、一门课程、一次活动，或者暂时无法归类的生活记录。

### collections

保存模板化集合，例如“2026 杭州旅行”或“全国大学生竞赛经历”。

- `id`
- `template_id`
- `title`
- `description`
- `cover_capture_id`
- `field_values_json`
- `created_at`
- `updated_at`

### templates

保存展示和补充字段定义。

- `id`
- `name`
- `slug`
- `schema_json`
- `layout_json`
- `is_system`
- `created_at`
- `updated_at`

系统预置竞赛模板、旅行模板和通用经历模板，用户可以复制后修改。

### relations

保存所有对象之间的关系，不复制素材。

- `id`
- `from_type`
- `from_id`
- `to_type`
- `to_id`
- `relation_type`: belongs_to、contains、mentions、located_at、same_as、ordered_before、cover_of
- `position`
- `metadata_json`
- `created_by`: user、suggestion
- `confirmed_at`
- `created_at`

建议为 `from_type + from_id + to_type + to_id + relation_type` 建唯一约束，避免重复关系。

### suggestions

保存 AI 或规则引擎生成的候选结果。

- `id`
- `kind`: duplicate、experience_match、location、person、template_match
- `target_ids`
- `reason_json`
- `confidence`
- `status`: pending、accepted、edited、dismissed
- `engine`
- `model_version`
- `created_at`
- `resolved_at`

任何 suggestion 都不能自动写入事实层或关系层，必须经过用户确认。

## 资料进入流程

### 上传流程

1. 客户端创建上传会话。
2. 文件直接上传到对象存储的临时路径。
3. API 计算或校验 SHA-256。
4. 创建 `capture`，状态设为 `processing`。
5. 投递缩略图、文本提取、EXIF、OCR 和索引任务。
6. 任务完成后状态变成 `ready`，并把候选建议放入智能收件箱。

### 快速文字流程

用户只输入一句话也可以创建 `capture(kind=text)`。例如“2026 年 3 月参加了学校创新创业比赛”。系统保存原句，再提取可能的时间、活动和地点。用户之后可以把它升级为 `experience`。

### 文件夹或相册导入

导入源需要保存一个 `source_config`，包括本地目录、扫描频率和是否自动导入。导入器只负责发现和上传新文件。文件归类仍然走统一收件箱，避免导入路径决定事实归属。

## 核心 API

### 收件箱

- `POST /api/captures/upload-session`
- `POST /api/captures/complete`
- `POST /api/captures/text`
- `GET /api/captures?status=inbox`
- `GET /api/captures/:id`
- `DELETE /api/captures/:id/relations`

### 经历

- `POST /api/experiences`
- `PATCH /api/experiences/:id`
- `GET /api/experiences/:id`
- `POST /api/experiences/:id/relations`
- `DELETE /api/experiences/:id/relations/:relationId`

### 模板和集合

- `GET /api/templates`
- `POST /api/templates`
- `POST /api/templates/:id/duplicate`
- `POST /api/collections`
- `GET /api/collections/:id`
- `PATCH /api/collections/:id`

### 建议和搜索

- `GET /api/suggestions`
- `POST /api/suggestions/:id/accept`
- `POST /api/suggestions/:id/edit`
- `POST /api/suggestions/:id/dismiss`
- `GET /api/search?q=&from=&to=&tags=&kind=`

### 导出和备份

- `POST /api/exports`
- `GET /api/exports/:id`
- `POST /api/backups/check`
- `POST /api/backups/restore-dry-run`

## 前端第一版页面

### 收件箱

- 大面积拖拽上传区。
- 快速文字记录输入框。
- 最近导入资料。
- 处理状态和失败重试。
- 建议归类的批量确认。

### 时间轴

- 年、月、日三级导航。
- 已确认经历和未整理资料同时出现。
- 支持按地点、人物、标签、资料类型筛选。
- 点击节点进入经历工作台。

### 经历工作台

- 左侧原始资料。
- 中间标题、时间、地点、描述。
- 右侧候选事实和关系。
- 支持拖拽素材排序。
- 支持“时间不确定”和“稍后补充”。

### 模板详情

- 顶部集合信息和封面。
- 卡片字段区。
- 穿插式时间线。
- 图片、文件和文字统一排列。
- 显示每条内容的原始来源。

## 部署方案

第一版使用 Docker Compose：

- `web`
- `api`
- `worker`
- `postgres`
- `redis`
- `object-storage`

生产数据目录集中挂载到独立磁盘。至少保留三类备份：

1. PostgreSQL 数据库备份。
2. 对象存储原始文件备份。
3. JSON 清单和应用配置备份。

每次版本升级前生成一个带版本号的全量导出。恢复测试需要在另一台设备或临时目录中验证数据库、原文件、关系和缩略图都能读取。

## 开发顺序

1. Docker Compose、登录、数据库迁移和对象存储。
2. Capture 上传、快速文字、预览和收件箱。
3. 时间轴和 Experience 编辑器。
4. Relation 管理和竞赛、旅行模板。
5. 本地 EXIF、哈希、缩略图和文本提取。
6. 搜索、导出和备份恢复检查。
7. 可关闭的云端 OCR、图像理解和候选归类。

## 当前不做

- 多用户协作。
- 公开分享链接。
- 自动替用户写成完整人生故事。
- 未经确认的自动归档。
- 不可迁移的专有数据格式。
