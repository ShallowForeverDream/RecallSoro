//! 用户自配的云端 AI 调用（BYOK）。
//!
//! 设计红线：
//! - 只把「脱敏后的 OCR 文本」发到用户自己配置的 endpoint；
//! - 本模块只返回文本响应，绝不写任何台账/事实表；
//! - 所有网络错误、超时、HTTP 错误都明确返回给上层，不静默吞掉。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRequest {
    /// 完整 chat 端点
    pub endpoint: String,
    pub api_key: String,
    /// POST / GET
    pub method: String,
    pub model: String,
    /// OpenAI 兼容 messages
    pub messages: Vec<AiMessage>,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiResponse {
    /// 模型返回的文本
    pub text: String,
    /// 实际使用的模型（响应里可能带）
    pub model: Option<String>,
    /// 端点返回的原始状态描述，便于排错
    pub status: String,
}

/// 从 OpenAI 兼容的响应里提取文本。
/// 兼容两种常见形状：
///   {"choices":[{"message":{"content":"..."}}]}
///   {"choices":[{"text":"..."}]}   （某些 completion 风格端点）
fn extract_text(value: &serde_json::Value) -> Option<(String, Option<String>)> {
    let model = value
        .get("model")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let choices = value.get("choices")?.as_array()?;
    let first = choices.first()?;

    let text = first
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .or_else(|| first.get("text").and_then(|t| t.as_str()))?
        .to_string();

    Some((text, model))
}

#[tauri::command]
pub async fn call_cloud_ai(req: AiRequest) -> Result<AiResponse, String> {
    let endpoint = req.endpoint.trim();
    if endpoint.is_empty() {
        return Err("未配置云端 AI 的 Endpoint URL".to_string());
    }
    if req.api_key.trim().is_empty() {
        return Err("未配置 API Key".to_string());
    }
    if req.model.trim().is_empty() {
        return Err("未配置模型名".to_string());
    }
    if !endpoint.starts_with("http://") && !endpoint.starts_with("https://") {
        return Err("Endpoint URL 必须以 http:// 或 https:// 开头".to_string());
    }

    let timeout = std::time::Duration::from_millis(req.timeout_ms.clamp(3000, 180000));
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))?;

    // 请求体统一用 OpenAI chat/completions 形状，绝大多数国产模型（DeepSeek/智谱/通义）
    // 都兼容这一格式，用户只需改 endpoint 与 model 即可。
    let body = serde_json::json!({
        "model": req.model,
        "messages": req.messages,
        "temperature": 0.1,
        "stream": false,
    });

    let method = req.method.trim().to_uppercase();
    let http_method = if method == "GET" {
        reqwest::Method::GET
    } else {
        reqwest::Method::POST
    };

    let mut request = client
        .request(http_method, endpoint)
        .bearer_auth(req.api_key.trim())
        .header("Content-Type", "application/json");

    if method == "GET" {
        // GET 场景把参数放在 query 里（少数网关需要），正文仍带一份以兼容
        request = request.query(&[("model", &req.model)]);
    }

    let response = request
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求云端 AI 失败: {e}"))?;

    let status = response.status();
    let status_text = format!("{} {}", status.as_u16(), status.canonical_reason().unwrap_or(""));

    let raw = response
        .text()
        .await
        .map_err(|e| format!("读取云端 AI 响应失败: {e}"))?;

    if !status.is_success() {
        // 截断错误响应，避免把整个 HTML 错误页塞给用户
        let snippet: String = raw.chars().take(500).collect();
        return Err(format!("云端 AI 返回 {status_text}: {snippet}"));
    }

    let value: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("云端 AI 响应不是合法 JSON: {e}"))?;

    let (text, model) = extract_text(&value).ok_or_else(|| {
        let snippet: String = raw.chars().take(500).collect();
        format!("无法从云端 AI 响应中提取文本（需要 OpenAI chat/completions 格式）: {snippet}")
    })?;

    Ok(AiResponse {
        text,
        model,
        status: status_text,
    })
}

/// 连接测试：发一条最短的 messages，验证 endpoint/key/model 配置是否可用。
#[tauri::command]
pub async fn test_cloud_ai(req: AiRequest) -> Result<AiResponse, String> {
    let mut test_req = req;
    test_req.messages = vec![AiMessage {
        role: "user".to_string(),
        content: "请只回复 OK 两个字母，不要输出其他内容。".to_string(),
    }];
    test_req.timeout_ms = test_req.timeout_ms.clamp(3000, 30000);
    call_cloud_ai(test_req).await
}
