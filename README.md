# RecallSoro

个人电子经历总台账。把照片、文件、文字、链接和经历全部放进一个统一的本地应用，先收集，后整理，按需回看。

## 第一版已实现

- **统一收件箱**：拖拽上传图片、视频、PDF 和任意文件；快速文字记录；添加链接；文件夹批量导入。
- **只存一份**：用 SHA-256 判定重复内容，相同文件只保存一次，重复导入只增加来源提示。
- **时间轴**：按年月回看经历与未整理资料，支持按年份筛选。
- **经历编辑器**：补充标题、时间、地点、描述、标签；从收件箱关联资料；解除关联不删除原件。
- **模板视图**：内置竞赛、旅行、项目、课程和通用经历模板；集合字段自定义；资料与经历按时间穿插展示。
- **全文搜索**：搜索标题、文件名、备注、文字、链接、标签和系统提取线索。
- **备份与迁移**：一键导出 ZIP（元数据 JSON + 全部原件），支持从备份恢复。
- **本地优先**：不需要服务器、数据库进程或云服务；OCR 与云端 AI 默认关闭，保留开关。

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

数据保存在应用自身的 IndexedDB 中（数据库名 `recallsoro`），原件以 Blob 存在同一数据库。没有外部数据库文件，也没有后台服务进程。

卸载应用前请在「设置与备份」中导出 ZIP。恢复备份会覆盖当前数据。

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
  pages/          收件箱、时间轴、经历、模板集合、搜索、设置
  components/     布局与通用组件
  lib/utils.ts    哈希、线索提取、导入导出
  db.ts           Dexie 表结构与系统模板
src-tauri/        Rust 桌面壳与打包配置
docs/             产品蓝图、实现规格、调研复用说明
```

## 发布到 GitHub

本地仓库已初始化，`origin` 指向 `https://github.com/ShallowForeverDream/RecallSoro.git`。当前 GitHub CLI 的 keyring token 已失效，请在终端先重新登录：

```bash
gh auth login -h github.com
gh repo create RecallSoro --private --source=. --remote=origin --push
```

如果仓库已存在，只需执行 `git push -u origin main`。

## 路线

- v0.1 桌面端：收件箱、时间轴、经历、模板、搜索、备份 ✅
- v0.2 本地 OCR 与图片线索提取
- v0.3 云端 AI 候选归类（默认关闭，需确认）
- v0.4 手机端与跨设备同步
