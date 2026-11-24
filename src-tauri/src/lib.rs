mod ai;
mod lan_drop;
mod ledger;
mod ocr;
mod storage;

pub mod ocr_pub {
    //! 供集成测试使用的公开入口
    pub use crate::ocr::{ocr_image_file, OcrResult, SensitiveRegion};
}

use ai::{call_cloud_ai, test_cloud_ai};
use lan_drop::{LanDropItem, LanDropState, LanDropStatus};
use ledger::{LedgerSnapshotInfo, LedgerVersion};
use ocr::OcrResult;
use storage::{
    base64_decode, base64_encode, get_storage_info as fetch_storage_info, open_folder_in_os,
    read_blob_bytes, resolve_data_dir, save_blob_bytes, scan_watch_folder as run_watch_scan,
    IngestedFile, StorageInfo, StoredBlobResult,
};use tauri::{AppHandle, State};

#[tauri::command]
fn save_blob_base64(app: AppHandle, data_base64: String) -> Result<StoredBlobResult, String> {
    let bytes = base64_decode(&data_base64)?;
    save_blob_bytes(&app, &bytes)
}

#[tauri::command]
fn read_blob_base64(app: AppHandle, sha256: String) -> Result<String, String> {
    let bytes = read_blob_bytes(&app, &sha256)?;
    Ok(base64_encode(&bytes))
}

#[tauri::command]
fn get_storage_info(app: AppHandle) -> Result<StorageInfo, String> {
    fetch_storage_info(&app)
}

#[tauri::command]
fn open_data_dir(app: AppHandle) -> Result<(), String> {
    let dir = resolve_data_dir(&app)?;
    open_folder_in_os(&dir)
}

#[tauri::command]
fn scan_watch_folder(
    app: AppHandle,
    folder_path: String,
    known_sha256s: Vec<String>,
) -> Result<Vec<IngestedFile>, String> {
    run_watch_scan(&app, &folder_path, known_sha256s)
}

#[tauri::command]
fn start_lan_drop(app: AppHandle, state: State<'_, LanDropState>) -> Result<LanDropStatus, String> {
    state.start(app)
}

#[tauri::command]
fn stop_lan_drop(state: State<'_, LanDropState>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
fn get_lan_drop_status(state: State<'_, LanDropState>) -> LanDropStatus {
    state.status()
}

#[tauri::command]
fn poll_lan_drop_inbox(state: State<'_, LanDropState>) -> Vec<LanDropItem> {
    state.drain_inbox()
}

/// 对本地原件执行 Windows 内置离线 OCR，并同时给出敏感信息坐标。
#[tauri::command]
fn ocr_blob_windows(app: AppHandle, sha256: String, lang: Option<String>) -> Result<OcrResult, String> {
    let bytes = read_blob_bytes(&app, &sha256)?;
    let ext = guess_image_ext(&bytes).ok_or("该原件不是可识别的图片格式")?;
    let dir = std::env::temp_dir().join("recallsoro-ocr");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建临时目录失败: {e}"))?;
    let path = dir.join(format!("{}.{}", sha256, ext));
    std::fs::write(&path, &bytes).map_err(|e| format!("写入临时图片失败: {e}"))?;
    let result = ocr::ocr_image_file(&path, &lang.unwrap_or_else(|| "zh-Hans-CN".to_string()));
    let _ = std::fs::remove_file(&path);
    result
}

/// 由图片字节判断扩展名（OCR 解码器按文件后缀选择解码器）。
fn guess_image_ext(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() < 12 {
        return None;
    }
    if bytes[0] == 0xFF && bytes[1] == 0xD8 {
        Some("jpg")
    } else if bytes[0] == 0x89 && bytes[1] == b'P' && bytes[2] == b'N' && bytes[3] == b'G' {
        Some("png")
    } else if bytes.len() > 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("webp")
    } else if bytes.len() > 12 && &bytes[4..8] == b"ftyp" {
        Some("heic")
    } else {
        None
    }
}

/// 把台账元数据写入 ledger.json（与 blobs/ 同目录，便于网盘同步）。
#[tauri::command]
fn write_ledger_snapshot(app: AppHandle, json_text: String) -> Result<LedgerSnapshotInfo, String> {
    ledger::write_ledger_snapshot(&app, &json_text)
}

/// 读取磁盘上的 ledger.json
#[tauri::command]
fn read_ledger_snapshot(app: AppHandle) -> Result<String, String> {
    ledger::read_ledger_snapshot(&app)
}

/// 列出历史版本（新的在前）
#[tauri::command]
fn list_ledger_versions(app: AppHandle) -> Result<Vec<LedgerVersion>, String> {
    ledger::list_ledger_versions(&app)
}

/// 回滚到指定历史版本
#[tauri::command]
fn restore_ledger_version(app: AppHandle, version_path: String) -> Result<LedgerSnapshotInfo, String> {
    ledger::restore_ledger_version(&app, &version_path)
}

/// 返回可用于 PDF 嵌入的中文字体字节（base64）
#[tauri::command]
fn read_cjk_font_base64() -> Result<String, String> {
    let path = storage::resolve_cjk_font_path().ok_or("未找到可嵌入的中文字体")?;
    let bytes = std::fs::read(&path).map_err(|e| format!("读取字体失败: {e}"))?;
    Ok(base64_encode(&bytes))
}

/// 返回数据目录中 ledger.json 与 blobs/ 的同目录信息，供设置页展示。
#[tauri::command]
fn get_ledger_dir_info(app: AppHandle) -> Result<String, String> {
    Ok(storage::resolve_data_dir(&app)?.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(LanDropState::default())
        .invoke_handler(tauri::generate_handler![
            save_blob_base64,
            read_blob_base64,
            get_storage_info,
            open_data_dir,
            scan_watch_folder,
            start_lan_drop,
            stop_lan_drop,
            get_lan_drop_status,
            poll_lan_drop_inbox,
            ocr_blob_windows,
            write_ledger_snapshot,
            read_ledger_snapshot,
            list_ledger_versions,
            restore_ledger_version,
            read_cjk_font_base64,
            get_ledger_dir_info,
            call_cloud_ai,
            test_cloud_ai
        ])
        .run(tauri::generate_context!())
        .expect("error while running RecallSoro");
}
