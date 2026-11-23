//! 元数据同目录落盘：把 IndexedDB 里的台账数据写成 ledger.json，
//! 与 blobs/ 并列存放，方便用户把整个目录丢进网盘 / Syncthing 做跨机同步。
//!
//! 设计要点：
//! - 原子写入（先写 .tmp 再 rename），避免同步软件读到半截文件
//! - 每次写入生成一份带时间戳的历史快照，可回滚
//! - 不做任何自动脱敏：ledger.json 属于私人本地数据

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerSnapshotInfo {
    pub path: String,
    pub bytes: u64,
    pub updated_at: String,
    pub version_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerVersion {
    pub version: u64,
    pub saved_at: String,
    pub bytes: u64,
    pub path: String,
}

fn now_iso() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // 简单 UTC 格式化，避免额外依赖
    let days = now / 86400;
    let secs_of_day = now % 86400;
    let (y, m, d) = civil_from_days(days as i64);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y,
        m,
        d,
        secs_of_day / 3600,
        (secs_of_day % 3600) / 60,
        secs_of_day % 60
    )
}

/// Howard Hinnant 的 civil_from_days 算法
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

pub fn resolve_ledger_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {e}"))?;
    let dir = base.join("ledger");
    fs::create_dir_all(&dir).map_err(|e| format!("创建账本目录失败: {e}"))?;
    Ok(dir)
}

fn ledger_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_ledger_dir(app)?.join("ledger.json"))
}

fn versions_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = resolve_ledger_dir(app)?.join("versions");
    fs::create_dir_all(&dir).map_err(|e| format!("创建版本目录失败: {e}"))?;
    Ok(dir)
}

/// 原子写入：写临时文件后 rename，Windows 上 rename 会覆盖同名文件。
fn atomic_write(path: &Path, content: &str) -> Result<u64, String> {
    let tmp = path.with_extension(format!(
        "tmp-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));
    fs::write(&tmp, content).map_err(|e| format!("写入临时文件失败: {e}"))?;
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("提交账本文件失败: {e}")
    })?;
    Ok(content.len() as u64)
}

/// 把前端传来的整份台账数据写入 ledger.json，并留存一份版本快照。
pub fn write_ledger_snapshot(app: &AppHandle, json_text: &str) -> Result<LedgerSnapshotInfo, String> {
    // 先校验是合法 JSON，避免把损坏数据写进同步目录
    serde_json::from_str::<serde_json::Value>(json_text)
        .map_err(|e| format!("台账数据不是合法 JSON: {e}"))?;

    let path = ledger_path(app)?;
    let bytes = atomic_write(&path, json_text)?;

    // 版本快照：保留最近 30 份
    let vdir = versions_dir(app)?;
    let stamp = now_iso().replace(':', "-").replace('.', "-");
    let vfile = vdir.join(format!("ledger-{stamp}.json"));
    let _ = fs::write(&vfile, json_text);

    prune_old_versions(&vdir, 30);

    let version_count = fs::read_dir(&vdir)
        .map(|rd| rd.flatten().count())
        .unwrap_or(0);

    Ok(LedgerSnapshotInfo {
        path: path.to_string_lossy().to_string(),
        bytes,
        updated_at: now_iso(),
        version_count,
    })
}

/// 读取磁盘上的 ledger.json
pub fn read_ledger_snapshot(app: &AppHandle) -> Result<String, String> {
    let path = ledger_path(app)?;
    fs::read_to_string(&path).map_err(|e| format!("读取账本文件失败: {e}"))
}

/// 列出历史版本（新的在前）
pub fn list_ledger_versions(app: &AppHandle) -> Result<Vec<LedgerVersion>, String> {
    let vdir = versions_dir(app)?;
    let mut out: Vec<LedgerVersion> = Vec::new();
    if let Ok(entries) = fs::read_dir(&vdir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            let bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
            let modified = entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let (y, m, d) = civil_from_days((modified / 86400) as i64);
            let sod = modified % 86400;
            out.push(LedgerVersion {
                version: modified,
                saved_at: format!(
                    "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
                    y,
                    m,
                    d,
                    sod / 3600,
                    (sod % 3600) / 60,
                    sod % 60
                ),
                bytes,
                path: path.to_string_lossy().to_string(),
            });
        }
    }
    out.sort_by(|a, b| b.version.cmp(&a.version));
    Ok(out)
}

/// 回滚到某个历史版本：把该版本内容写回 ledger.json
pub fn restore_ledger_version(app: &AppHandle, version_path: &str) -> Result<LedgerSnapshotInfo, String> {
    let src = PathBuf::from(version_path);
    if !src.exists() {
        return Err("历史版本文件不存在".to_string());
    }
    let content = fs::read_to_string(&src).map_err(|e| format!("读取历史版本失败: {e}"))?;
    serde_json::from_str::<serde_json::Value>(&content)
        .map_err(|e| format!("历史版本内容损坏: {e}"))?;

    // 回滚前先把当前内容也存一份，避免误操作丢失
    let current = ledger_path(app)?;
    if current.exists() {
        if let Ok(cur) = fs::read_to_string(&current) {
            let stamp = now_iso().replace(':', "-").replace('.', "-");
            let _ = fs::write(versions_dir(app)?.join(format!("ledger-{stamp}.json")), cur);
        }
    }

    let path = ledger_path(app)?;
    let bytes = atomic_write(&path, &content)?;
    let version_count = fs::read_dir(versions_dir(app)?)
        .map(|rd| rd.flatten().count())
        .unwrap_or(0);

    Ok(LedgerSnapshotInfo {
        path: path.to_string_lossy().to_string(),
        bytes,
        updated_at: now_iso(),
        version_count,
    })
}

fn prune_old_versions(dir: &Path, keep: usize) {
    let mut files: Vec<_> = fs::read_dir(dir)
        .map(|rd| {
            rd.flatten()
                .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("json"))
                .map(|e| {
                    let m = e
                        .metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);
                    (m, e.path())
                })
                .collect()
        })
        .unwrap_or_default();
    files.sort_by(|a, b| b.0.cmp(&a.0));
    for (_, path) in files.into_iter().skip(keep) {
        let _ = fs::remove_file(path);
    }
}
