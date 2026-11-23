//! 桌面端命令自检：确认 OCR / 账本 / 字体命令在真实 Tauri 环境下可用。
//! 用法：cargo test --release --target x86_64-pc-windows-msvc --test desktop -- --nocapture

use std::path::PathBuf;

#[test]
fn ocr_on_realistic_certificate() {
    let img = PathBuf::from(r"D:\0tools\cert-test.png");
    if !img.exists() {
        eprintln!("跳过：缺少测试图片 {}", img.display());
        return;
    }

    let result = recallsoro_lib::ocr_pub::ocr_image_file(&img, "zh-Hans-CN")
        .expect("Windows OCR 应可用");

    eprintln!("引擎: {}", result.engine);
    eprintln!("识别文本: {}", result.text);
    eprintln!(
        "敏感区域: {:?}",
        result
            .sensitive
            .iter()
            .map(|r| (r.kind.clone(), r.label.clone(), r.x, r.y, r.w, r.h))
            .collect::<Vec<_>>()
    );

    assert!(!result.text.is_empty(), "应识别出文字");
    assert!(
        result.sensitive.iter().any(|r| r.kind == "id_card"),
        "应识别出身份证号"
    );
    assert!(
        result.sensitive.iter().any(|r| r.kind == "student_id"),
        "应识别出学号"
    );
    // 不应把同一段号码重复标成银行卡
    assert!(
        !result.sensitive.iter().any(|r| r.kind == "bank_card"),
        "不应误报银行卡号"
    );
}

#[test]
fn cjk_font_available_for_pdf() {
    let path = PathBuf::from("C:\\Windows\\Fonts\\simhei.ttf");
    assert!(path.exists(), "系统中文字体缺失，PDF 嵌入会失败");
    assert!(path.metadata().unwrap().len() > 100_000);
}
