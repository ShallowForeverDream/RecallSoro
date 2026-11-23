//! 端到端自检：对真实图片跑完整 OCR 管线，验证敏感信息坐标正确。
//! 用法：cargo test --release --target x86_64-pc-windows-msvc --test e2e -- --nocapture

use std::path::PathBuf;

#[test]
fn ocr_end_to_end_detects_sensitive_fields() {
    let img = PathBuf::from(r"D:\0tools\ocr-test.png");
    if !img.exists() {
        eprintln!("跳过：缺少测试图片 {}", img.display());
        return;
    }

    let result = recallsoro_lib::ocr_pub::ocr_image_file(&img, "zh-Hans-CN")
        .expect("Windows OCR 应可用");

    eprintln!("引擎: {}", result.engine);
    eprintln!("尺寸: {}x{}", result.width, result.height);
    eprintln!("识别文本: {}", result.text);
    eprintln!(
        "敏感区域: {:?}",
        result
            .sensitive
            .iter()
            .map(|r| (r.kind.clone(), r.x, r.y, r.w, r.h))
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
}
