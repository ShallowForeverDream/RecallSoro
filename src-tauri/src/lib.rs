mod lan_drop;
mod storage;

use lan_drop::{LanDropItem, LanDropState, LanDropStatus};
use storage::{
    base64_decode, base64_encode, get_storage_info as fetch_storage_info, open_folder_in_os,
    read_blob_bytes, resolve_data_dir, save_blob_bytes, scan_watch_folder as run_watch_scan,
    IngestedFile, StorageInfo, StoredBlobResult,
};
use tauri::{AppHandle, State};

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
            poll_lan_drop_inbox
        ])
        .run(tauri::generate_context!())
        .expect("error while running RecallSoro");
}
