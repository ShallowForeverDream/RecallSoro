# RecallSoro

个人电子经历总台账。把照片、文件、文字、链接和经历全部放进一个统一的本地应用，先收集，后整理，按需回看。

## 已实现能力

### 采集与整理

- **统一收件箱**：拖拽上传图片、视频、PDF 和任意文件；快速文字记录；添加链接；文件夹批量导入。
- **只存一份**：用 SHA-256 判定重复内容，相同文件只保存一次，重复导入只增加来源提示。
- **时间轴**：按年月回看经历与未整理资料，支持按年份筛选。
- **经历编辑器**：补充标题、时间、地点、描述、标签；从收件箱关联资料；解除关联不删除原件。
- **模板视图**：内置竞赛、证件与资质、STAR 项目、旅行、游记和通用经历模板；集合字段自定义；资料与经历按时间穿插展示。
- **档案总览**：年度经历分布、待补齐证书统计、智能归属建议、证件到期提醒。
- **全文搜索**：搜索标题、文件名、备注、文字、链接、标签和系统提取线索。
- **命令面板**：`Ctrl + K` / `⌘ + K` 快速跳转与执行操作。

### 本地优先与数据安全

- **本地原件落盘**：原件写入应用数据目录的 `blobs/`，不再依赖浏览器缓存。
- **元数据同目录落盘**：每次修改自动把台账数据写成 `ledger/ledger.json`，与 `blobs/` 并列。注意：正在使用的整个数据目录**不要**直接放进网盘同步；跨机同步需按可变性分层，详见下方「数据放在哪里」。
- **版本回滚**：每次落盘保留一份带时间戳的版本快照（最近 30 份），设置页可一键回滚，回滚前自动保留当前状态。
- **局域网传图**：手机与电脑同一 Wi-Fi 下扫码即可把照片直接传进收件箱。
- **备份与迁移**：一键导出 ZIP（元数据 JSON + 全部原件），支持增量合并或覆盖恢复。

### 交表与隐私

- **PDF 证明册**：直接生成真正的 PDF 文件（pdf-lib，非打印窗口），含封面、目录表与佐证附页，中文字体自动嵌入。
- **Windows 离线 OCR**：调用系统自带 `Windows.Media.Ocr`，零模型体积；同时返回**词级坐标**，用于自动定位敏感信息。
- **无损脱敏**：在 Capture 上只存遮罩矩形坐标，原图永不修改；导出脱敏副本或生成证明 PDF 时自动打码。
- **自动检测敏感信息**：识别身份证号、学号、手机号、银行卡号并一键预置遮罩框，可再手动微调。
- **导出不自动脱敏**：外发前请自行确认脱敏选项。

### 本地优先原则

不需要服务器、数据库进程或云服务；云端 AI 默认关闭，保留开关。

## 技术选型

| 层 | 方案 | 理由 |
| --- | --- | --- |
| 桌面壳 | Tauri 2（Rust） | 使用系统 WebView2，不打包 Chromium，安装包小、内存占用低 |
| 前端 | React 18 + TypeScript + Vite | 一套代码可同时用于桌面和后续手机端 |
| 数据 | Dexie / IndexedDB | 无需数据库服务，随应用本地运行 |
| 文件 | 浏览器 Blob 存于 IndexedDB | 原件不上传、不被外部服务读取 |
| 备份 | fflate ZIP | 轻量压缩库，导出 JSON + 原件 |

生产构建产物约 335 KB JS（gzip 110 KB）+ 12 KB CSS（gzip 3 KB）。

## 开发

```bash
# 安装依赖
pnpm install

# 只跑网页前端（调试 UI 用）
pnpm dev

# 启动桌面应用（会同时启动 Vite）
pnpm tauri dev

# 构建桌面安装包
pnpm tauri build
```

桌面安装包输出在 `src-tauri/target/<target>/release/bundle/`。

> 本机 PATH 默认先命中独立的 `x86_64-pc-windows-gnullvm` Rust 工具链，它缺少配套链接器。已验证可用的构建方式是显式使用 rustup 的 MSVC 工具链：
>
> ```bash
> export PATH="/c/Users/25478/.cargo/bin:$PATH"
> export LIB='C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.41.34120\lib\x64;D:\Windows Kits\10\Lib\10.0.22621.0\um\x64;D:\Windows Kits\10\Lib\10.0.22621.0\ucrt\x64'
> export INCLUDE='C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.41.34120\include;D:\Windows Kits\10\Include\10.0.22621.0\um;D:\Windows Kits\10\Include\10.0.22621.0\ucrt;D:\Windows Kits\10\Include\10.0.22621.0\shared'
> pnpm tauri build --target x86_64-pc-windows-msvc
> ```
>
> 输出示例：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/RecallSoro_0.1.0_x64-setup.exe`（约 1.9 MB）和同名 `.msi`（约 2.9 MB）。

## 数据放在哪里

桌面端数据目录：`%APPDATA%\com.recallsoro.desktop\`（Windows）。

```
com.recallsoro.desktop/
├── blobs/                 原始文件，按 SHA-256 前两位分片
│   └── 79/79b9c5...       文件内容即文件名，天然去重
└── ledger/
    ├── ledger.json        台账元数据，每次修改自动落盘
    └── versions/          历史版本快照，保留最近 30 份
```

`blobs/` 内容寻址、不可变；`ledger/ledger.json` 每次修改都会重写，属高频可变文件。

**跨机同步不要直接同步整个目录**。SQLite/文件锁类应用（Anytype 等）的官方警告：云同步工具持续监控并锁定文件，会破坏数据库文件锁导致不可逆损坏。正确做法是按可变性分层：

- `blobs/` 不可变、内容寻址——可安全用 Syncthing/网盘同步，接收端校验 SHA-256。
- `ledger.json` 高频可变——不要作为同步主体；后续版本会改为按实体拆分 + 追加操作日志，`ledger.json` 降级为本地派生物化缓存。
- 索引/缩略图/FTS——永不同步，从权威层本地重建（未加密索引可能泄露元数据）。
- 需要云端备份时，只备份**应用关闭后的静态快照**，不要实时同步活跃目录。

详见 `docs/research/requirements-2026-11.md` 第六节。网页端（`pnpm dev`）仍使用 IndexedDB。

卸载应用前请在「设置与备份」中导出 ZIP。恢复备份会覆盖当前数据。

## 系统要求

- Windows 10/11 + WebView2 运行时
- **Windows 离线 OCR 需要系统语言包**：设置 → 时间和语言 → 语言 → 添加中文（简体），并在「语言选项」里勾选"光学字符识别"。可用下面的 PowerShell 自检：

```powershell
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag }
```

输出里应能看到 `zh-Hans-CN`。没有该语言包时，OCR 会返回"系统 OCR 执行失败"，其余功能不受影响。

## 从旧项目复用的设计原则

详见 `docs/research/reused-from-previous-session.md`：

- 不根据文件名或赛事名猜日期，时间不确定的记录保留为空并排在最后。
- SHA-256 去重，原件只读，不自动回写源文件。
- 本地处理优先，归档优先于删除。
- 搜索覆盖名称、备注、附件名和文字内容。
- 导出不自动脱敏，原件可能含个人敏感信息。

## 后续手机端

Tauri 2 支持同一套前端构建 Android 和 iOS。等桌面版稳定后：

```bash
pnpm tauri android init
pnpm tauri android dev

pnpm tauri ios init
pnpm tauri ios dev
```

需要的 Rust 侧代码和前端路由无需重写，只需补充移动端的文件分享入口和相册导入权限。

## 目录

```
src/
  pages/          收件箱、时间轴、经历、台账集合、总览、搜索、设置
  components/     布局、命令面板、脱敏画板、局域网传图、二维码
  lib/
    utils.ts      哈希、线索提取、导入导出
    pdfExport.ts  PDF 证明册生成（pdf-lib 动态加载）
    redaction.ts  无损脱敏渲染
    intelligence.ts EXIF 解析与归属建议
    competition.ts 竞赛字段别名与审计
    tauriBridge.ts  Rust 命令封装
  db.ts           Dexie 表结构与系统模板
src-tauri/
  src/ocr.rs      Windows 离线 OCR 与敏感信息坐标检测
  src/ledger.rs   元数据落盘、版本快照与回滚
  src/storage.rs  原件落盘、SHA-256、Base64
  src/lan_drop.rs 局域网扫码传图服务
docs/             产品蓝图、实现规格、调研复用说明、竞赛台账
```

## GitHub

公开仓库：`https://github.com/ShallowForeverDream/RecallSoro`。

后续更新直接执行：

```bash
git add -A
git commit -m "feat: 说明改动"
git push
```

## 测试

### Rust 单元与集成测试

```bash
cd src-tauri
cargo test --release --target x86_64-pc-windows-msvc
```

- `ocr::tests::*`：敏感信息识别（身份证号 / 学号 / 不误报普通年份 / 遮罩只覆盖号码本身）
- `tests/e2e.rs`：对真实图片跑完整 OCR 管线
- `tests/desktop.rs`：真实证书图的端到端识别 + 中文字体可用性

### 桌面端命令自检（CDP）

用 WebView2 远程调试端口直接调用真实 Tauri 命令：

```bash
# 启动应用时带上调试端口
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333 recallsoro.exe
node scripts/cdp-desktop-commands.mjs   # OCR / 账本 / 版本 / 字体命令
node scripts/cdp-pdf-export.mjs          # 真实 UI 点击导出 PDF 并校验字节
node scripts/cdp-import-verify.mjs       # 导入台账包并核验数据库字段
node scripts/cdp-redaction-e2e.mjs        # 脱敏闭环，产出脱敏图
```

`scripts/capture-window.ps1` 可以在不抢占前台的情况下抓取 RecallSoro 窗口截图。

## 路线

- v0.1 桌面端：收件箱、时间轴、经历、模板、搜索、备份 ✅
- v0.2 台账视图、增量导入、缺项体检、快速补图 ✅
- v0.3 本地原件落盘、局域网扫码传图、命令面板、主题切换、快编抽屉 ✅
- v0.4 档案总览、证件与资质模板、STAR 项目模板、历史版本抽屉 ✅
- v0.4.1 Windows 离线 OCR、真 PDF 证明册、自动脱敏、元数据同目录落盘与回滚 ✅
- v0.5 云端 AI 候选归类（默认关闭，需确认）
- v0.6 手机端与跨设备同步
