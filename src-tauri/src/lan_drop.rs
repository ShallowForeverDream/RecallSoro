use crate::storage::{guess_mime_from_ext, save_blob_bytes};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

const MOBILE_HTML: &str = include_str!("lan_drop.html");
const MAX_UPLOAD_BYTES: usize = 60 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanDropStatus {
    pub running: bool,
    pub url: String,
    pub ip: String,
    pub port: u16,
    pub token: String,
    pub received_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanDropItem {
    pub sha256: String,
    pub original_name: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub slot: String,
    pub note: String,
    pub deduplicated: bool,
    pub received_at_ms: u64,
}

pub struct LanDropState {
    inner: Mutex<Option<RunningServer>>,
    inbox: Arc<Mutex<Vec<LanDropItem>>>,
    total_received: Arc<Mutex<usize>>,
}

struct RunningServer {
    stop_flag: Arc<AtomicBool>,
    ip: String,
    port: u16,
    token: String,
}

impl Default for LanDropState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
            inbox: Arc::new(Mutex::new(Vec::new())),
            total_received: Arc::new(Mutex::new(0)),
        }
    }
}

fn detect_lan_ip() -> String {
    if let Ok(sock) = UdpSocket::bind("0.0.0.0:0") {
        if sock.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = sock.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}

fn generate_token() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(123456789);
    format!("{:x}", nanos & 0xffff_ffff_ffff)
}

fn url_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                let hex = &input[i + 1..i + 3];
                if let Ok(v) = u8::from_str_radix(hex, 16) {
                    out.push(v);
                    i += 3;
                } else {
                    out.push(b'%');
                    i += 1;
                }
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_string()
}

fn parse_query(qs: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for pair in qs.split('&') {
        if pair.is_empty() {
            continue;
        }
        let mut parts = pair.splitn(2, '=');
        let k = url_decode(parts.next().unwrap_or(""));
        let v = url_decode(parts.next().unwrap_or(""));
        map.insert(k, v);
    }
    map
}

fn write_response(stream: &mut TcpStream, status: &str, content_type: &str, body: &[u8]) {
    let header = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

fn handle_client(
    mut stream: TcpStream,
    app: &AppHandle,
    token: &str,
    inbox: &Arc<Mutex<Vec<LanDropItem>>>,
    total_received: &Arc<Mutex<usize>>,
) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(30)));

    // 逐步读取 HTTP 请求头直到 \r\n\r\n
    let mut buf = Vec::with_capacity(4096);
    let mut tmp = [0u8; 4096];
    let header_end;
    loop {
        match stream.read(&mut tmp) {
            Ok(0) => return,
            Ok(n) => {
                buf.extend_from_slice(&tmp[..n]);
                if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                    header_end = pos + 4;
                    break;
                }
                if buf.len() > 64 * 1024 {
                    write_response(&mut stream, "431 Request Header Fields Too Large", "text/plain", b"Header too large");
                    return;
                }
            }
            Err(_) => return,
        }
    }

    let header_str = String::from_utf8_lossy(&buf[..header_end]).to_string();
    let mut lines = header_str.lines();
    let req_line = lines.next().unwrap_or("");
    let mut req_parts = req_line.split_whitespace();
    let method = req_parts.next().unwrap_or("");
    let target = req_parts.next().unwrap_or("/");

    let mut content_length: usize = 0;
    for line in lines {
        if let Some((k, v)) = line.split_once(':') {
            if k.trim().eq_ignore_ascii_case("content-length") {
                content_length = v.trim().parse().unwrap_or(0);
            }
        }
    }

    let (path, qs) = target.split_once('?').unwrap_or((target, ""));
    let query = parse_query(qs);

    if method == "GET" && path == "/ping" {
        write_response(&mut stream, "200 OK", "application/json", br#"{"ok":true}"#);
        return;
    }

    let provided_token = query.get("token").map(String::as_str).unwrap_or("");
    if provided_token != token {
        write_response(
            &mut stream,
            "403 Forbidden",
            "application/json",
            r#"{"ok":false,"error":"Token 无效或已过期，请重新扫码"}"#.as_bytes(),
        );
        return;
    }

    if method == "GET" && (path == "/" || path == "/index.html") {
        write_response(
            &mut stream,
            "200 OK",
            "text/html; charset=utf-8",
            MOBILE_HTML.as_bytes(),
        );
        return;
    }

    if method == "POST" && path == "/upload" {
        if content_length == 0 || content_length > MAX_UPLOAD_BYTES {
            write_response(
                &mut stream,
                "400 Bad Request",
                "application/json",
                r#"{"ok":false,"error":"文件为空或超过 60MB 限制"}"#.as_bytes(),
            );
            return;
        }

        let mut body = Vec::with_capacity(content_length);
        body.extend_from_slice(&buf[header_end..]);
        while body.len() < content_length {
            let need = (content_length - body.len()).min(65536);
            let mut chunk = vec![0u8; need];
            match stream.read(&mut chunk) {
                Ok(0) => break,
                Ok(n) => body.extend_from_slice(&chunk[..n]),
                Err(_) => break,
            }
        }
        body.truncate(content_length);

        let original_name = query
            .get("name")
            .cloned()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "手机照片.jpg".to_string());
        let ext = original_name.rsplit('.').next().unwrap_or("jpg");
        let mime_type = query
            .get("mime")
            .cloned()
            .filter(|s| !s.trim().is_empty() && s != "application/octet-stream")
            .unwrap_or_else(|| guess_mime_from_ext(ext).to_string());
        let slot = query
            .get("slot")
            .cloned()
            .unwrap_or_else(|| "随手资料".to_string());
        let note = query.get("note").cloned().unwrap_or_default();

        match save_blob_bytes(app, &body) {
            Ok(stored) => {
                let received_at_ms = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                let item = LanDropItem {
                    sha256: stored.sha256.clone(),
                    original_name,
                    mime_type,
                    size_bytes: stored.size_bytes,
                    slot,
                    note,
                    deduplicated: stored.deduplicated,
                    received_at_ms,
                };
                if let Ok(mut q) = inbox.lock() {
                    q.push(item);
                }
                if let Ok(mut cnt) = total_received.lock() {
                    *cnt += 1;
                }
                let resp = format!(
                    r#"{{"ok":true,"sha256":"{}","deduplicated":{}}}"#,
                    stored.sha256, stored.deduplicated
                );
                write_response(&mut stream, "200 OK", "application/json", resp.as_bytes());
            }
            Err(e) => {
                let resp = format!(r#"{{"ok":false,"error":"{}"}}"#, e.replace('"', "'"));
                write_response(
                    &mut stream,
                    "500 Internal Server Error",
                    "application/json",
                    resp.as_bytes(),
                );
            }
        }
        return;
    }

    write_response(&mut stream, "404 Not Found", "text/plain", b"Not Found");
}

impl LanDropState {
    pub fn start(&self, app: AppHandle) -> Result<LanDropStatus, String> {
        let mut guard = self.inner.lock().map_err(|_| "锁异常".to_string())?;
        if let Some(ref srv) = *guard {
            let received_count = self.total_received.lock().map(|c| *c).unwrap_or(0);
            return Ok(LanDropStatus {
                running: true,
                url: format!("http://{}:{}/?token={}", srv.ip, srv.port, srv.token),
                ip: srv.ip.clone(),
                port: srv.port,
                token: srv.token.clone(),
                received_count,
            });
        }

        let listener = TcpListener::bind("0.0.0.0:18923")
            .or_else(|_| TcpListener::bind("0.0.0.0:0"))
            .map_err(|e| format!("启动局域网接收服务失败: {e}"))?;
        let port = listener
            .local_addr()
            .map_err(|e| format!("获取监听端口失败: {e}"))?
            .port();
        let _ = listener.set_nonblocking(true);

        let ip = detect_lan_ip();
        let token = generate_token();
        let stop_flag = Arc::new(AtomicBool::new(false));
        let stop_clone = Arc::clone(&stop_flag);
        let inbox_clone = Arc::clone(&self.inbox);
        let count_clone = Arc::clone(&self.total_received);
        let token_clone = token.clone();

        thread::spawn(move || {
            while !stop_clone.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((stream, _addr)) => {
                        let _ = stream.set_nonblocking(false);
                        let app_c = app.clone();
                        let tok_c = token_clone.clone();
                        let inb_c = Arc::clone(&inbox_clone);
                        let cnt_c = Arc::clone(&count_clone);
                        thread::spawn(move || {
                            handle_client(stream, &app_c, &tok_c, &inb_c, &cnt_c);
                        });
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(80));
                    }
                    Err(_) => {
                        thread::sleep(Duration::from_millis(120));
                    }
                }
            }
        });

        let status = LanDropStatus {
            running: true,
            url: format!("http://{}:{}/?token={}", ip, port, token),
            ip: ip.clone(),
            port,
            token: token.clone(),
            received_count: self.total_received.lock().map(|c| *c).unwrap_or(0),
        };

        *guard = Some(RunningServer {
            stop_flag,
            ip,
            port,
            token,
        });

        Ok(status)
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut guard = self.inner.lock().map_err(|_| "锁异常".to_string())?;
        if let Some(srv) = guard.take() {
            srv.stop_flag.store(true, Ordering::Relaxed);
        }
        Ok(())
    }

    pub fn status(&self) -> LanDropStatus {
        let received_count = self.total_received.lock().map(|c| *c).unwrap_or(0);
        if let Ok(guard) = self.inner.lock() {
            if let Some(ref srv) = *guard {
                return LanDropStatus {
                    running: true,
                    url: format!("http://{}:{}/?token={}", srv.ip, srv.port, srv.token),
                    ip: srv.ip.clone(),
                    port: srv.port,
                    token: srv.token.clone(),
                    received_count,
                };
            }
        }
        {
            LanDropStatus {
                running: false,
                url: String::new(),
                ip: String::new(),
                port: 0,
                token: String::new(),
                received_count,
            }
        }
    }

    pub fn drain_inbox(&self) -> Vec<LanDropItem> {
        if let Ok(mut q) = self.inbox.lock() {
            std::mem::take(&mut *q)
        } else {
            Vec::new()
        }
    }
}
