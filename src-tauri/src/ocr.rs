//! Windows 本地离线 OCR + 敏感信息坐标检测
//!
//! 通过 PowerShell 调用 Windows 内置的 Windows.Media.Ocr 引擎，
//! 零模型体积、零额外依赖，随系统语言包可用。
//!
//! 返回结果同时包含：
//! - 识别全文（用于智能归属建议）
//! - 词级坐标（用于自动脱敏：身份证号、学号、手机号、二维码定位）

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrWord {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrLine {
    pub text: String,
    pub words: Vec<OcrWord>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrResult {
    pub text: String,
    pub lines: Vec<OcrLine>,
    pub width: u32,
    pub height: u32,
    /// 敏感信息候选区域（归一化 0~1 坐标），供前端一键预置遮罩
    pub sensitive: Vec<SensitiveRegion>,
    /// 后端使用的 OCR 引擎说明
    pub engine: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SensitiveRegion {
    pub kind: String,
    pub label: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub confidence: f64,
}

/// OCR 脚本以资源文件形式随包分发，避免运行时依赖 PowerShell 执行策略。
const OCR_PS1: &str = include_str!("windows_ocr.ps1");

fn script_path() -> PathBuf {
    let dir = std::env::temp_dir().join("recallsoro-ocr");
    let _ = fs::create_dir_all(&dir);
    let path = dir.join("windows_ocr.ps1");
    if fs::read_to_string(&path).map(|s| s != OCR_PS1).unwrap_or(true) {
        let _ = fs::write(&path, OCR_PS1);
    }
    path
}

/// 从 OCR 词序列中按「标签 + 数字」模式切出敏感号码片段的坐标。
///
/// 中文 OCR 常把「身份证号 420102...」识别成「身 份 证 号」加数字串，
/// 因此先按行把词拼起来，再在行内做正则匹配，回溯到对应词的像素范围。
fn detect_sensitive_in_line(line: &OcrLine) -> Vec<SensitiveRegion> {
    let mut out: Vec<SensitiveRegion> = Vec::new();

    // 全程使用字符向量，避免中文被按字节切片截断
    let chars: Vec<char> = line.words.iter().flat_map(|w| w.text.chars()).collect();
    // 每个字符对应的词索引
    let char_to_word: Vec<usize> = line
        .words
        .iter()
        .enumerate()
        .flat_map(|(wi, w)| std::iter::repeat(wi).take(w.text.chars().count()))
        .collect();

    // 记录每个已识别区域的字符区间，避免同一段数字被重复标成多种类型
    let taken: std::cell::RefCell<Vec<(usize, usize)>> = std::cell::RefCell::new(Vec::new());

    let mut push_region = |kind: &str, label: &str, s: usize, e: usize, conf: f64| {
        let mut min_x = f64::MAX;
        let mut min_y = f64::MAX;
        let mut max_x = f64::MIN;
        let mut max_y = f64::MIN;
        let mut found = false;
        for ci in s..e.min(char_to_word.len()) {
            let wi = char_to_word[ci];
            let w = &line.words[wi];
            min_x = min_x.min(w.x);
            min_y = min_y.min(w.y);
            max_x = max_x.max(w.x + w.w);
            max_y = max_y.max(w.y + w.h);
            found = true;
        }
        if found && max_x > min_x && max_y > min_y {
            taken.borrow_mut().push((s, e));
            out.push(SensitiveRegion {
                kind: kind.to_string(),
                label: label.to_string(),
                x: min_x,
                y: min_y,
                w: max_x - min_x,
                h: max_y - min_y,
                confidence: conf,
            });
        }
    };

    // 中国大陆 18 位身份证号（含 X）
    for (start, len) in find_runs(&chars, 18, 18, |c| {
        c.is_ascii_digit() || c == 'X' || c == 'x'
    }) {
        // 前面紧邻的字符若全是数字或分隔符，说明这只是长数字串的一部分
        let prefix: Vec<char> = chars[..start].iter().rev().take(6).copied().rev().collect();
        if prefix
            .iter()
            .all(|c| c.is_ascii_digit() || *c == '-' || *c == ' ')
        {
            continue;
        }
        // 末位必须是数字或 X
        let last = chars[start + 17];
        if !(last.is_ascii_digit() || last == 'X' || last == 'x') {
            continue;
        }
        push_region("id_card", "身份证号", start, start + len, 0.92);
    }

    // 手机号（11 位，1 开头）
    for (start, len) in find_runs(&chars, 11, 11, |c| c.is_ascii_digit()) {
        if chars[start] != '1' {
            continue;
        }
        push_region("mobile", "手机号", start, start + len, 0.85);
    }

    // 学号：8~14 位数字，且前面若干字符内出现「学号 / 学籍」字样
    for (start, len) in find_runs(&chars, 8, 14, |c| c.is_ascii_digit()) {
        let prefix_start = start.saturating_sub(8);
        let prefix: String = chars[prefix_start..start].iter().collect();
        let has_label = prefix.contains("学号")
            || prefix.contains("学籍")
            || prefix.to_lowercase().contains("student");
        if has_label {
            push_region("student_id", "学号", start, start + len, 0.8);
        }
    }

    // 银行卡号：16~19 位数字（跳过已被识别为身份证 / 手机号的片段）
    for (start, len) in find_runs(&chars, 16, 19, |c| c.is_ascii_digit()) {
        let end = start + len;
        if taken.borrow().iter().any(|(ts, te)| start < *te && end > *ts) {
            continue;
        }
        push_region("bank_card", "银行卡号", start, end, 0.78);
    }

    out
}

/// 在字符串中找出所有「连续满足条件的字符段」，长度介于 min_len 与 max_len 之间。
fn find_runs(
    chars: &[char],
    min_len: usize,
    max_len: usize,
    pred: fn(char) -> bool,
) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    let mut i = 0usize;
    while i < chars.len() {
        if !pred(chars[i]) {
            i += 1;
            continue;
        }
        let start = i;
        while i < chars.len() && pred(chars[i]) {
            i += 1;
        }
        let len = i - start;
        if len >= min_len && len <= max_len {
            out.push((start, len));
        }
    }
    out
}


/// 对 Windows OCR 的 JSON 输出做最小解析（只取需要的字段），避免引入额外依赖。
#[derive(Debug, Deserialize)]
struct RawWord {
    #[serde(rename = "text")]
    text: String,
    #[serde(rename = "x")]
    x: f64,
    #[serde(rename = "y")]
    y: f64,
    #[serde(rename = "w")]
    w: f64,
    #[serde(rename = "h")]
    h: f64,
}

#[derive(Debug, Deserialize)]
struct RawLine {
    #[serde(rename = "text")]
    text: String,
    #[serde(rename = "words")]
    words: Vec<RawWord>,
}

#[derive(Debug, Deserialize)]
struct RawOcr {
    #[serde(rename = "text")]
    text: String,
    #[serde(rename = "lines")]
    lines: Vec<RawLine>,
    #[serde(rename = "width")]
    width: u32,
    #[serde(rename = "height")]
    height: u32,
}

/// 对本地图片执行离线 OCR，返回全文与敏感信息坐标。
pub fn ocr_image_file(path: &PathBuf, lang: &str) -> Result<OcrResult, String> {
    let script = script_path();
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            &script.to_string_lossy(),
            "-ImagePath",
            &path.to_string_lossy(),
            "-Lang",
            lang,
        ])
        .output()
        .map_err(|e| format!("启动系统 OCR 失败: {e}"))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("系统 OCR 执行失败: {err}").trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json_start = stdout.find('{').ok_or("系统 OCR 未返回有效结果")?;
    let raw: RawOcr =
        serde_json::from_str(&stdout[json_start..]).map_err(|e| format!("解析 OCR 结果失败: {e}"))?;

    let lines: Vec<OcrLine> = raw
        .lines
        .into_iter()
        .map(|l| OcrLine {
            text: l.text,
            words: l
                .words
                .into_iter()
                .map(|w| OcrWord {
                    text: w.text,
                    x: w.x,
                    y: w.y,
                    w: w.w,
                    h: w.h,
                })
                .collect(),
        })
        .collect();

    let mut sensitive: Vec<SensitiveRegion> = Vec::new();
    for line in &lines {
        sensitive.extend(detect_sensitive_in_line(line));
    }
    // 同一行可能重复命中同一种号码，按位置去重
    sensitive.sort_by(|a, b| {
        a.y.partial_cmp(&b.y)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.x.partial_cmp(&b.x).unwrap_or(std::cmp::Ordering::Equal))
    });
    sensitive.dedup_by(|a, b| {
        a.kind == b.kind
            && (a.x - b.x).abs() < 12.0
            && (a.y - b.y).abs() < 12.0
            && (a.w - b.w).abs() < 24.0
    });

    Ok(OcrResult {
        text: raw.text,
        lines,
        width: raw.width,
        height: raw.height,
        sensitive,
        engine: format!("Windows.Media.Ocr ({lang})"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word(text: &str, x: f64, y: f64, w: f64, h: f64) -> OcrWord {
        OcrWord {
            text: text.to_string(),
            x,
            y,
            w,
            h,
        }
    }

    #[test]
    fn detects_id_card_with_label() {
        let line = OcrLine {
            text: "身份证号 420102200305121234".to_string(),
            words: vec![
                word("身", 40.0, 100.0, 30.0, 30.0),
                word("份", 80.0, 100.0, 30.0, 30.0),
                word("证", 120.0, 100.0, 30.0, 30.0),
                word("号", 160.0, 100.0, 30.0, 30.0),
                word("420102200305121234", 200.0, 100.0, 300.0, 30.0),
            ],
        };
        let regions = detect_sensitive_in_line(&line);
        assert!(
            regions.iter().any(|r| r.kind == "id_card"),
            "应识别出身份证号，实际: {:?}",
            regions
        );
    }

    #[test]
    fn detects_student_id_with_label() {
        let line = OcrLine {
            text: "学号 2022113456".to_string(),
            words: vec![
                word("学", 40.0, 100.0, 30.0, 30.0),
                word("号", 80.0, 100.0, 30.0, 30.0),
                word("2022113456", 120.0, 100.0, 200.0, 30.0),
            ],
        };
        let regions = detect_sensitive_in_line(&line);
        assert!(
            regions.iter().any(|r| r.kind == "student_id"),
            "应识别出学号，实际: {:?}",
            regions
        );
    }

    #[test]
    fn ignores_plain_numbers_without_label() {
        let line = OcrLine {
            text: "2024年参加比赛".to_string(),
            words: vec![word("2024", 40.0, 100.0, 80.0, 30.0)],
        };
        let regions = detect_sensitive_in_line(&line);
        assert!(
            regions.is_empty(),
            "不应把普通年份当作敏感信息: {:?}",
            regions
        );
    }

    #[test]
    fn id_card_region_covers_the_number_only() {
        let line = OcrLine {
            text: "身份证号 420102200305121234".to_string(),
            words: vec![
                word("身", 40.0, 100.0, 30.0, 30.0),
                word("份", 80.0, 100.0, 30.0, 30.0),
                word("证", 120.0, 100.0, 30.0, 30.0),
                word("号", 160.0, 100.0, 30.0, 30.0),
                word("420102200305121234", 200.0, 100.0, 300.0, 30.0),
            ],
        };
        let regions = detect_sensitive_in_line(&line);
        let r = regions
            .iter()
            .find(|r| r.kind == "id_card")
            .expect("应识别出身份证号");
        assert!((r.x - 200.0).abs() < 1.0, "遮罩应覆盖号码本身而非标签");
        assert!((r.w - 300.0).abs() < 1.0, "遮罩宽度应等于号码宽度");
    }
}
