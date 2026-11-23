use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfo {
    pub data_dir: String,
    pub blobs_dir: String,
    pub blob_count: usize,
    pub total_bytes: u64,
    /// 是否已有 ledger.json 落盘
    pub has_snapshot: bool,
    /// ledger.json 字节数
    pub snapshot_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredBlobResult {
    pub sha256: String,
    pub size_bytes: u64,
    pub deduplicated: bool,
    pub relative_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestedFile {
    pub sha256: String,
    pub original_name: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub modified_ms: u64,
    pub deduplicated: bool,
}

/// 纯 Rust FIPS 180-4 SHA-256 实现，零外部依赖
pub fn sha256_hex(data: &[u8]) -> String {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];

    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];

    let bit_len = (data.len() as u64) * 8;
    let mut padded = data.to_vec();
    padded.push(0x80);
    while (padded.len() % 64) != 56 {
        padded.push(0);
    }
    padded.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in padded.chunks_exact(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }

        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    let mut out = String::with_capacity(64);
    for word in h {
        out.push_str(&format!("{:08x}", word));
    }
    out
}

const B64_CHARS: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn base64_encode(input: &[u8]) -> String {
    let mut out = String::with_capacity(((input.len() + 2) / 3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(B64_CHARS[((n >> 18) & 63) as usize] as char);
        out.push(B64_CHARS[((n >> 12) & 63) as usize] as char);
        if chunk.len() > 1 {
            out.push(B64_CHARS[((n >> 6) & 63) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(B64_CHARS[(n & 63) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

pub fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    let mut table = [255u8; 256];
    for (i, &c) in B64_CHARS.iter().enumerate() {
        table[c as usize] = i as u8;
    }
    let bytes: Vec<u8> = input
        .bytes()
        .filter(|b| !b.is_ascii_whitespace())
        .collect();
    if bytes.len() % 4 != 0 {
        return Err("无效的 Base64 长度".to_string());
    }
    let mut out = Vec::with_capacity((bytes.len() / 4) * 3);
    for chunk in bytes.chunks_exact(4) {
        let v0 = table[chunk[0] as usize];
        let v1 = table[chunk[1] as usize];
        if v0 == 255 || v1 == 255 {
            return Err("无效的 Base64 字符".to_string());
        }
        let v2 = if chunk[2] == b'=' { 0 } else { table[chunk[2] as usize] };
        let v3 = if chunk[3] == b'=' { 0 } else { table[chunk[3] as usize] };
        if (chunk[2] != b'=' && v2 == 255) || (chunk[3] != b'=' && v3 == 255) {
            return Err("无效的 Base64 字符".to_string());
        }
        let n = ((v0 as u32) << 18) | ((v1 as u32) << 12) | ((v2 as u32) << 6) | (v3 as u32);
        out.push(((n >> 16) & 0xff) as u8);
        if chunk[2] != b'=' {
            out.push(((n >> 8) & 0xff) as u8);
        }
        if chunk[3] != b'=' {
            out.push((n & 0xff) as u8);
        }
    }
    Ok(out)
}

pub fn resolve_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {e}"))?;
    fs::create_dir_all(&base).map_err(|e| format!("创建数据目录失败: {e}"))?;
    Ok(base)
}

pub fn resolve_blobs_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = resolve_data_dir(app)?.join("blobs");
    fs::create_dir_all(&dir).map_err(|e| format!("创建原件目录失败: {e}"))?;
    Ok(dir)
}

fn is_valid_sha256(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())
}

pub fn save_blob_bytes(app: &AppHandle, bytes: &[u8]) -> Result<StoredBlobResult, String> {
    let hash = sha256_hex(bytes);
    let prefix = &hash[0..2];
    let blobs_dir = resolve_blobs_dir(app)?;
    let shard_dir = blobs_dir.join(prefix);
    fs::create_dir_all(&shard_dir).map_err(|e| format!("创建分片目录失败: {e}"))?;
    let target = shard_dir.join(&hash);
    let deduplicated = target.exists();
    if !deduplicated {
        fs::write(&target, bytes).map_err(|e| format!("写入原件失败: {e}"))?;
    }
    Ok(StoredBlobResult {
        relative_path: format!("blobs/{}/{}", prefix, hash),
        sha256: hash,
        size_bytes: bytes.len() as u64,
        deduplicated,
    })
}

pub fn read_blob_bytes(app: &AppHandle, sha256: &str) -> Result<Vec<u8>, String> {
    if !is_valid_sha256(sha256) {
        return Err("无效的 SHA-256 哈希".to_string());
    }
    let path = resolve_blobs_dir(app)?.join(&sha256[0..2]).join(sha256);
    fs::read(&path).map_err(|e| format!("读取本地原件失败: {e}"))
}

pub fn get_storage_info(app: &AppHandle) -> Result<StorageInfo, String> {
    let data_dir = resolve_data_dir(app)?;
    let blobs_dir = resolve_blobs_dir(app)?;
    let ledger_path = data_dir.join("ledger").join("ledger.json");
    let mut blob_count = 0usize;
    let mut total_bytes = 0u64;

    if let Ok(shards) = fs::read_dir(&blobs_dir) {
        for shard in shards.flatten() {
            if let Ok(entries) = fs::read_dir(shard.path()) {
                for entry in entries.flatten() {
                    if let Ok(meta) = entry.metadata() {
                        if meta.is_file() {
                            blob_count += 1;
                            total_bytes += meta.len();
                        }
                    }
                }
            }
        }
    }

    let has_snapshot = ledger_path.exists();
    let snapshot_bytes = if has_snapshot {
        fs::metadata(&ledger_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    Ok(StorageInfo {
        data_dir: data_dir.to_string_lossy().to_string(),
        blobs_dir: blobs_dir.to_string_lossy().to_string(),
        blob_count,
        total_bytes,
        has_snapshot,
        snapshot_bytes,
    })
}

pub fn open_folder_in_os(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开资源管理器失败: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开 Finder 失败: {e}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开文件管理器失败: {e}"))?;
    }
    Ok(())
}

/// 找到一份可用于 PDF 嵌入的中文字体（TTF 格式优先，TTC 不支持嵌入）。
///
/// 依次尝试黑体（simhei.ttf）、等线（Deng.ttf）、微软雅黑（msyh.ttc 不可用则跳过）。
pub fn resolve_cjk_font_path() -> Option<PathBuf> {
    let fonts = PathBuf::from("C:\\Windows\\Fonts");
    for name in ["simhei.ttf", "Deng.ttf", "simkai.ttf", "simfang.ttf"] {
        let p = fonts.join(name);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

pub fn guess_mime_from_ext(ext: &str) -> &'static str {    match ext.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "heic" => "image/heic",
        "pdf" => "application/pdf",
        "mp4" => "video/mp4",
        "mov" => "video/quicktime",
        "txt" | "md" => "text/plain",
        _ => "application/octet-stream",
    }
}

pub fn scan_watch_folder(
    app: &AppHandle,
    folder_path: &str,
    known_sha256s: Vec<String>,
) -> Result<Vec<IngestedFile>, String> {
    let dir = PathBuf::from(folder_path.trim());
    if !dir.exists() || !dir.is_dir() {
        return Err("指定的同步目录不存在或不是文件夹".to_string());
    }
    let known: HashSet<String> = known_sha256s.into_iter().collect();
    let allowed = ["jpg", "jpeg", "png", "webp", "gif", "heic", "pdf", "mp4", "mov"];
    let mut results = Vec::new();

    let entries = fs::read_dir(&dir).map_err(|e| format!("读取目录失败: {e}"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !allowed.contains(&ext.as_str()) {
            continue;
        }
        let bytes = match fs::read(&path) {
            Ok(b) if !b.is_empty() && b.len() <= 80 * 1024 * 1024 => b,
            _ => continue,
        };
        let hash = sha256_hex(&bytes);
        if known.contains(&hash) {
            continue;
        }
        let stored = save_blob_bytes(app, &bytes)?;
        let modified_ms = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let original_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("未命名文件")
            .to_string();

        results.push(IngestedFile {
            sha256: stored.sha256,
            original_name,
            mime_type: guess_mime_from_ext(&ext).to_string(),
            size_bytes: stored.size_bytes,
            modified_ms,
            deduplicated: stored.deduplicated,
        });
    }

    Ok(results)
}
