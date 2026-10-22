use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Seek, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use epub::doc::EpubDoc;
use epub_builder::{EpubBuilder, EpubContent, ReferenceType, ZipLibrary};
use pulldown_cmark::{html, Event, Options, Parser};
use regex::Regex;
use ssh2::Session;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OmarchyTheme {
    pub background: String,
    pub foreground: String,
    pub accent: String,
    pub muted: String,
    pub dark_background: String,
    pub lighter_background: String,
    pub mode: String,
}

impl Default for OmarchyTheme {
    fn default() -> Self {
        Self {
            background: "#111c18".to_string(),
            foreground: "#C1C497".to_string(),
            accent: "#509475".to_string(),
            muted: "#53685B".to_string(),
            dark_background: "#0c1512".to_string(),
            lighter_background: "#23372B".to_string(),
            mode: "dark".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub kindle_ip: String,
    pub kindle_port: u16,
    pub kindle_user: String,
    #[serde(default)]
    pub kindle_password: String,
    pub remote_books_dir: String,
    pub local_library_dir: String,
    #[serde(default = "default_editor_font")]
    pub editor_font: String,
}

fn default_editor_font() -> String {
    "IBM Plex Mono".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/home/ka"));
        let default_lib = home.join("Books");
        Self {
            kindle_ip: "192.168.1.15".to_string(),
            kindle_port: 2222,
            kindle_user: "root".to_string(),
            kindle_password: String::new(),
            remote_books_dir: "/mnt/us/documents/Books".to_string(),
            local_library_dir: default_lib.to_string_lossy().to_string(),
            editor_font: default_editor_font(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BookMetadata {
    pub id: String,
    pub path: String,
    pub filename: String,
    pub title: String,
    pub author: String,
    pub description: String,
    pub format: String,
    pub size_bytes: u64,
    pub cover_data_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransferResult {
    pub success: bool,
    pub filename: String,
    pub bytes_sent: u64,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReaderTocItem {
    pub title: String,
    pub chapter_index: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReaderSession {
    pub path: String,
    pub filename: String,
    pub title: String,
    pub author: String,
    pub format: String,
    pub total_chapters: usize,
    pub current_chapter: usize,
    pub toc: Vec<ReaderTocItem>,
    pub chapter_html: String,
    pub raw_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReaderChapter {
    pub chapter_index: usize,
    pub title: String,
    pub html: String,
}

fn get_config_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("/home/ka/.config"));
    base.join("omawrite-reader")
}

fn authenticate_session(sess: &mut Session, username: &str, password: &str) -> Result<(), String> {
    let clean_user = if username.trim().is_empty() {
        "root"
    } else {
        username.trim()
    };

    let _ = sess.auth_methods(clean_user);
    if sess.authenticated() {
        return Ok(());
    }

    let clean_pw = password.trim();
    if let Ok(_) = sess.userauth_password(clean_user, clean_pw) {
        if sess.authenticated() {
            return Ok(());
        }
    }

    if !clean_pw.is_empty() {
        if let Ok(_) = sess.userauth_password(clean_user, "") {
            if sess.authenticated() {
                return Ok(());
            }
        }
    }

    for fallback in ["", "koreader", "root", "mario"] {
        if let Ok(_) = sess.userauth_password(clean_user, fallback) {
            if sess.authenticated() {
                return Ok(());
            }
        }
    }

    if !sess.authenticated() {
        return Err(format!(
            "Không thể xác thực SSH với user '{}'. Vui lòng kiểm tra lại cấu hình.",
            clean_user
        ));
    }

    Ok(())
}

#[tauri::command]
fn get_system_fonts() -> Vec<String> {
    if let Ok(output) = Command::new("fc-list").args([":", "family"]).output() {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            let mut fonts: Vec<String> = text
                .lines()
                .flat_map(|line| line.split(','))
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty() && !s.starts_with('.'))
                .collect();
            fonts.sort();
            fonts.dedup();
            if !fonts.is_empty() {
                return fonts;
            }
        }
    }
    vec![
        "IBM Plex Mono".to_string(),
        "iA Writer Duo S".to_string(),
        "iA Writer Duospace".to_string(),
        "iA Writer Mono S".to_string(),
        "iA Writer Quattro S".to_string(),
        "JetBrainsMono Nerd Font".to_string(),
        "Adwaita Mono".to_string(),
        "Liberation Mono".to_string(),
        "monospace".to_string(),
    ]
}

#[tauri::command]
fn load_omarchy_theme() -> OmarchyTheme {
    let mut theme = OmarchyTheme::default();
    if let Some(home) = dirs::home_dir() {
        let theme_file = home.join(".local/state/omarchy/current/theme/colors.toml");
        if theme_file.exists() {
            if let Ok(content) = fs::read_to_string(theme_file) {
                for line in content.lines() {
                    let parts: Vec<&str> = line.split('=').map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        let key = parts[0];
                        let val = parts[1].trim_matches('"');
                        match key {
                            "background" => theme.background = val.to_string(),
                            "foreground" => theme.foreground = val.to_string(),
                            "accent" => theme.accent = val.to_string(),
                            "muted" => theme.muted = val.to_string(),
                            "dark_background" => theme.dark_background = val.to_string(),
                            "lighter_background" => theme.lighter_background = val.to_string(),
                            "mode" => theme.mode = val.to_string(),
                            _ => {}
                        }
                    }
                }
            }
        }
    }
    theme
}

#[tauri::command]
fn load_settings() -> AppSettings {
    let config_path = get_config_dir().join("settings.json");
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(mut settings) = serde_json::from_str::<AppSettings>(&content) {
                if settings.kindle_user.trim().is_empty() {
                    settings.kindle_user = "root".to_string();
                }
                if settings.editor_font.trim().is_empty() {
                    settings.editor_font = default_editor_font();
                }
                return settings;
            }
        }
    }
    AppSettings::default()
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<String, String> {
    let dir = get_config_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let config_path = dir.join("settings.json");
    let mut clean_settings = settings;
    if clean_settings.kindle_user.trim().is_empty() {
        clean_settings.kindle_user = "root".to_string();
    }
    let json = serde_json::to_string_pretty(&clean_settings).map_err(|e| e.to_string())?;
    fs::write(&config_path, json).map_err(|e| e.to_string())?;
    Ok("Settings saved successfully".to_string())
}

#[tauri::command]
fn test_kindle_connection(
    ip: String,
    port: u16,
    user: Option<String>,
    password: Option<String>,
) -> Result<String, String> {
    let addr = format!("{}:{}", ip, port);
    let socket = TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("Địa chỉ IP không hợp lệ: {}", e))?,
        Duration::from_secs(4),
    ).map_err(|e| format!("Không thể kết nối tới KOReader tại {}: {}", addr, e))?;

    let mut sess = Session::new().map_err(|e| e.to_string())?;
    sess.set_tcp_stream(socket);
    sess.handshake().map_err(|e| format!("SSH Handshake thất bại: {}", e))?;
    
    let username = user.unwrap_or_else(|| "root".to_string());
    let pw = password.unwrap_or_default();
    authenticate_session(&mut sess, &username, &pw)?;

    Ok(format!("Đã kết nối và xác thực thành công tới KOReader ({})!", addr))
}

#[tauri::command]
fn send_book_to_kindle(
    ip: String,
    port: u16,
    user: Option<String>,
    password: Option<String>,
    remote_dir: String,
    local_path: String,
) -> Result<TransferResult, String> {
    let path = Path::new(&local_path);
    if !path.exists() {
        return Err(format!("File không tồn tại: {}", local_path));
    }

    let filename = path.file_name()
        .ok_or_else(|| "Tên file không hợp lệ".to_string())?
        .to_string_lossy()
        .to_string();

    let addr = format!("{}:{}", ip, port);
    let socket = TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("Địa chỉ Kindle không hợp lệ: {}", e))?,
        Duration::from_secs(5),
    ).map_err(|e| format!("Không kết nối được tới Kindle tại {}: {}", addr, e))?;

    let mut sess = Session::new().map_err(|e| e.to_string())?;
    sess.set_tcp_stream(socket);
    sess.handshake().map_err(|e| format!("SSH handshake thất bại: {}", e))?;

    let username = user.unwrap_or_else(|| "root".to_string());
    let pw = password.unwrap_or_default();
    authenticate_session(&mut sess, &username, &pw)?;

    let sftp = sess.sftp().map_err(|e| format!("Không mở được SFTP channel: {}", e))?;

    let clean_remote_dir = if remote_dir.ends_with('/') {
        remote_dir.trim_end_matches('/').to_string()
    } else {
        remote_dir
    };
    let _ = sftp.mkdir(Path::new(&clean_remote_dir), 0o755);

    let remote_file_path = format!("{}/{}", clean_remote_dir, filename);
    let mut remote_file = sftp.create(Path::new(&remote_file_path))
        .map_err(|e| format!("Không thể tạo file trên Kindle: {}", e))?;

    let mut local_file = File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = [0u8; 64 * 1024];
    let mut total_written = 0u64;

    loop {
        let bytes_read = local_file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }
        remote_file.write_all(&buffer[..bytes_read]).map_err(|e| e.to_string())?;
        total_written += bytes_read as u64;
    }

    Ok(TransferResult {
        success: true,
        filename,
        bytes_sent: total_written,
        message: format!("Đã đồng bộ {} bytes sang Kindle ({})", total_written, remote_file_path),
    })
}

#[tauri::command]
fn send_markdown_to_kindle(
    ip: String,
    port: u16,
    user: Option<String>,
    password: Option<String>,
    remote_dir: String,
    title: String,
    author: String,
    content: String,
    as_epub: bool,
) -> Result<TransferResult, String> {
    let settings = load_settings();
    let library_dir = PathBuf::from(&settings.local_library_dir);
    let _ = fs::create_dir_all(&library_dir);

    let clean_title = if title.trim().is_empty() { "Untitled" } else { title.trim() };
    let safe_title = clean_title.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");

    let local_file_path = if as_epub {
        // Compile to EPUB
        export_markdown_to_epub(clean_title.to_string(), author, content, None)?
    } else {
        // Save as .md directly
        let md_path = library_dir.join(format!("{}.md", safe_title));
        fs::write(&md_path, &content).map_err(|e| e.to_string())?;
        md_path.to_string_lossy().to_string()
    };

    send_book_to_kindle(ip, port, user, password, remote_dir, local_file_path)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Tệp không tồn tại: {}", path));
    }
    fs::read_to_string(p).map_err(|e| format!("Lỗi đọc file {}: {}", path, e))
}

#[tauri::command]
fn save_markdown_file(path: String, content: String) -> Result<String, String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(p, content).map_err(|e| format!("Lỗi lưu file: {}", e))?;
    Ok(path)
}

#[tauri::command]
fn import_file_to_library(source_path: String) -> Result<String, String> {
    let settings = load_settings();
    let library_dir = PathBuf::from(&settings.local_library_dir);
    let _ = fs::create_dir_all(&library_dir);

    let src = Path::new(&source_path);
    if !src.exists() {
        return Err("File nguồn không tồn tại".to_string());
    }

    let filename = src.file_name().ok_or_else(|| "Tên file không hợp lệ".to_string())?;
    let dest = library_dir.join(filename);
    fs::copy(src, &dest).map_err(|e| format!("Lỗi sao chép file: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_library(custom_dir: Option<String>) -> Result<Vec<BookMetadata>, String> {
    let settings = load_settings();
    let dir_str = custom_dir.unwrap_or(settings.local_library_dir);
    let dir = Path::new(&dir_str);

    if !dir.exists() {
        let _ = fs::create_dir_all(dir);
        return Ok(Vec::new());
    }

    let mut books = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_file() {
            let ext = p.extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();

            if ["epub", "pdf", "mobi", "md", "txt", "cbz"].contains(&ext.as_str()) {
                let filename = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                let mut title = filename.clone();
                let mut author = "Unknown".to_string();
                let mut description = String::new();
                let mut cover_data_url = None;

                if ext == "epub" {
                    if let Ok(mut doc) = EpubDoc::new(&p) {
                        if let Some(t) = doc.get_title() {
                            title = t;
                        }
                        if let Some(item) = doc.mdata("creator") {
                            author = item.value.clone();
                        }
                        if let Some(item) = doc.mdata("description") {
                            description = item.value.clone();
                        }
                        if let Some((cover_bytes, mime)) = doc.get_cover() {
                            let b64 = BASE64.encode(&cover_bytes);
                            cover_data_url = Some(format!("data:{};base64,{}", mime, b64));
                        }
                    }
                } else if ext == "cbz" {
                    if let Ok(file) = File::open(&p) {
                        if let Ok(mut archive) = zip::ZipArchive::new(file) {
                            let mut image_names: Vec<String> = archive
                                .file_names()
                                .filter(|name| {
                                    let lower = name.to_lowercase();
                                    lower.ends_with(".jpg") || lower.ends_with(".jpeg") || lower.ends_with(".png") || lower.ends_with(".webp")
                                })
                                .map(|s| s.to_string())
                                .collect();
                            image_names.sort();
                            if let Some(first_img) = image_names.first() {
                                if let Ok(mut zfile) = archive.by_name(first_img) {
                                    let mut buf = Vec::new();
                                    if zfile.read_to_end(&mut buf).is_ok() {
                                        let mime = if first_img.to_lowercase().ends_with(".png") {
                                            "image/png"
                                        } else if first_img.to_lowercase().ends_with(".webp") {
                                            "image/webp"
                                        } else {
                                            "image/jpeg"
                                        };
                                        cover_data_url = Some(format!("data:{};base64,{}", mime, BASE64.encode(&buf)));
                                    }
                                }
                            }
                            author = "Truyện tranh / Manga".to_string();
                            description = format!("Tệp truyện tranh CBZ chứa {} trang ảnh", image_names.len());
                        }
                    }
                } else if ext == "md" || ext == "txt" {
                    if let Ok(content) = fs::read_to_string(&p) {
                        for line in content.lines().take(5) {
                            let trimmed = line.trim();
                            if trimmed.starts_with("# ") {
                                title = trimmed.trim_start_matches("# ").trim().to_string();
                                break;
                            }
                        }
                        description = content.chars().take(200).collect();
                    }
                }

                books.push(BookMetadata {
                    id: format!("{}:{}", filename, file_size),
                    path: p.to_string_lossy().to_string(),
                    filename,
                    title,
                    author,
                    description,
                    format: ext,
                    size_bytes: file_size,
                    cover_data_url,
                });
            }
        }
    }

    books.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok(books)
}

#[tauri::command]
fn export_markdown_to_epub(
    title: String,
    author: String,
    markdown_content: String,
    save_path: Option<String>,
) -> Result<String, String> {
    let settings = load_settings();
    let library_dir = PathBuf::from(settings.local_library_dir);
    let _ = fs::create_dir_all(&library_dir);

    let clean_title = if title.trim().is_empty() { "Untitled" } else { title.trim() };
    let clean_author = if author.trim().is_empty() { "Ka" } else { author.trim() };

    let output_file = match save_path {
        Some(p) => PathBuf::from(p),
        None => {
            let safe_title = clean_title.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");
            library_dir.join(format!("{}.epub", safe_title))
        }
    };

    let zip = ZipLibrary::new().map_err(|e| format!("{:?}", e))?;
    let mut builder = EpubBuilder::new(zip)
        .map_err(|e| format!("Failed to create epub builder: {:?}", e))?;

    builder.metadata("author", clean_author).map_err(|e| e.to_string())?;
    builder.metadata("title", clean_title).map_err(|e| e.to_string())?;

    // Parse Markdown to standard XHTML with pulldown-cmark
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);

    // Convert soft line breaks into hard line breaks (<br/>) so single newlines are preserved
    let parser = Parser::new_ext(&markdown_content, options).map(|event| match event {
        Event::SoftBreak => Event::HardBreak,
        _ => event,
    });

    let mut body_html = String::new();
    html::push_html(&mut body_html, parser);

    let full_xhtml = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>{}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
            line-height: 1.7;
            margin: 4% 5%;
            color: #111;
        }}
        h1, h2, h3, h4, h5, h6 {{
            line-height: 1.3;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: bold;
        }}
        h1 {{ font-size: 1.8em; border-bottom: 1px solid #ddd; padding-bottom: 0.3em; }}
        h2 {{ font-size: 1.4em; border-bottom: 1px solid #eee; padding-bottom: 0.2em; }}
        h3 {{ font-size: 1.2em; }}
        p {{
            margin: 0.8em 0;
            text-align: justify;
        }}
        ul, ol {{
            margin: 0.8em 0;
            padding-left: 1.8em;
        }}
        li {{
            margin: 0.3em 0;
        }}
        blockquote {{
            margin: 1.2em 0;
            padding: 0.6em 1.2em;
            border-left: 4px solid #509475;
            background-color: #f7f9f8;
            color: #444;
            font-style: italic;
        }}
        pre {{
            background-color: #f4f4f4;
            padding: 0.8em;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 0.9em;
        }}
        code {{
            font-family: monospace;
            background-color: #f0f0f0;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-size: 0.9em;
        }}
        pre code {{
            background-color: transparent;
            padding: 0;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }}
        th {{
            background-color: #f2f2f2;
        }}
        hr {{
            border: none;
            border-top: 1px solid #ddd;
            margin: 2em 0;
        }}
    </style>
</head>
<body>
    {}
</body>
</html>"#,
        clean_title, body_html
    );

    builder.add_content(
        EpubContent::new("chapter_1.xhtml", full_xhtml.as_bytes())
            .title(clean_title)
            .reftype(ReferenceType::Text),
    ).map_err(|e| e.to_string())?;

    let mut out_file = File::create(&output_file).map_err(|e| e.to_string())?;
    builder.generate(&mut out_file).map_err(|e| format!("Failed to generate EPUB: {:?}", e))?;

    Ok(output_file.to_string_lossy().to_string())
}

fn inline_epub_resources<R: Read + Seek>(html: &str, doc: &mut EpubDoc<R>) -> String {
    let re_img = Regex::new(r#"(?i)<imgs+[^>]*src=["']([^"']+)["'][^>]*>"#).unwrap();
    let mut replacements: Vec<(String, String)> = Vec::new();

    for cap in re_img.captures_iter(html) {
        if let Some(m) = cap.get(1) {
            let src = m.as_str();
            if !src.starts_with("data:") && !src.starts_with("http:") && !src.starts_with("https:") {
                let filename = Path::new(src).file_name().and_then(|f| f.to_str()).unwrap_or("");
                let found = doc.resources.iter().find(|(_k, v)| {
                    v.path.ends_with(src) || v.path.file_name().and_then(|f| f.to_str()) == Some(filename)
                });

                if let Some((_id, res_item)) = found {
                    let path = res_item.path.clone();
                    let mime = res_item.mime.clone();
                    if let Some(bytes) = doc.get_resource_by_path(&path) {
                        let b64 = BASE64.encode(&bytes);
                        let data_url = format!("data:{};base64,{}", mime, b64);
                        replacements.push((src.to_string(), data_url));
                    }
                }
            }
        }
    }

    let mut result = html.to_string();
    for (old_src, new_data) in replacements {
        result = result.replace(&format!(r#"src="{}""#, old_src), &format!(r#"src="{}""#, new_data));
        result = result.replace(&format!(r#"src='{}'"#, old_src), &format!(r#"src='{}'"#, new_data));
    }

    result
}

fn flatten_toc<R: Read + Seek>(doc: &EpubDoc<R>, points: &[epub::doc::NavPoint], list: &mut Vec<ReaderTocItem>) {
    for p in points {
        let chapter_idx = doc.resource_uri_to_chapter(&p.content).unwrap_or(0);
        list.push(ReaderTocItem {
            title: if p.label.trim().is_empty() {
                format!("Chương {}", chapter_idx + 1)
            } else {
                p.label.clone()
            },
            chapter_index: chapter_idx,
        });
        if !p.children.is_empty() {
            flatten_toc(doc, &p.children, list);
        }
    }
}

#[tauri::command]
fn open_book_reader(path: String) -> Result<ReaderSession, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Tệp không tồn tại: {}", path));
    }
    let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    let filename = p.file_name().unwrap_or_default().to_string_lossy().to_string();
    let mut title = filename.clone();
    let mut author = "Chưa rõ tác giả".to_string();

    if ext == "epub" {
        let mut doc = EpubDoc::new(p).map_err(|e| format!("Không thể mở sách EPUB: {:?}", e))?;
        if let Some(t) = doc.get_title() {
            title = t;
        }
        if let Some(item) = doc.mdata("creator") {
            author = item.value.clone();
        }
        let total_chapters = doc.get_num_chapters();
        let mut toc = Vec::new();
        flatten_toc(&doc, &doc.toc.clone(), &mut toc);

        if toc.is_empty() {
            for i in 0..total_chapters {
                toc.push(ReaderTocItem {
                    title: format!("Chương {}", i + 1),
                    chapter_index: i,
                });
            }
        }

        doc.set_current_chapter(0);
        let (raw_html, _) = doc.get_current_str().unwrap_or_else(|| (
            "<p>Không có nội dung cho chương này.</p>".to_string(),
            String::new(),
        ));
        let chapter_html = inline_epub_resources(&raw_html, &mut doc);

        Ok(ReaderSession {
            path,
            filename,
            title,
            author,
            format: ext,
            total_chapters,
            current_chapter: 0,
            toc,
            chapter_html,
            raw_text: None,
        })
    } else if ext == "md" {
        let content = fs::read_to_string(p).map_err(|e| e.to_string())?;
        let mut toc = Vec::new();
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("# ") {
                title = trimmed.trim_start_matches("# ").trim().to_string();
                toc.push(ReaderTocItem {
                    title: title.clone(),
                    chapter_index: 0,
                });
            } else if trimmed.starts_with("## ") {
                toc.push(ReaderTocItem {
                    title: format!("• {}", trimmed.trim_start_matches("## ").trim()),
                    chapter_index: 0,
                });
            } else if trimmed.starts_with("### ") {
                toc.push(ReaderTocItem {
                    title: format!("  – {}", trimmed.trim_start_matches("### ").trim()),
                    chapter_index: 0,
                });
            }
        }
        if toc.is_empty() {
            toc.push(ReaderTocItem {
                title: title.clone(),
                chapter_index: 0,
            });
        }

        let mut options = Options::empty();
        options.insert(Options::ENABLE_TABLES);
        options.insert(Options::ENABLE_FOOTNOTES);
        options.insert(Options::ENABLE_STRIKETHROUGH);
        options.insert(Options::ENABLE_TASKLISTS);
        let parser = Parser::new_ext(&content, options).map(|event| match event {
            Event::SoftBreak => Event::HardBreak,
            _ => event,
        });
        let mut chapter_html = String::new();
        html::push_html(&mut chapter_html, parser);

        Ok(ReaderSession {
            path,
            filename,
            title,
            author: "Tài liệu Markdown".to_string(),
            format: ext,
            total_chapters: 1,
            current_chapter: 0,
            toc,
            chapter_html,
            raw_text: Some(content),
        })
    } else if ext == "cbz" {
        let file = File::open(p).map_err(|e| format!("Không thể mở file CBZ: {}", e))?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Lỗi đọc file nén: {}", e))?;
        let mut image_names: Vec<String> = archive
            .file_names()
            .filter(|name| {
                let lower = name.to_lowercase();
                lower.ends_with(".jpg") || lower.ends_with(".jpeg") || lower.ends_with(".png") || lower.ends_with(".webp") || lower.ends_with(".gif")
            })
            .map(|s| s.to_string())
            .collect();
        image_names.sort();

        let total_pages = image_names.len();
        if total_pages == 0 {
            return Err("File CBZ không chứa bất kỳ ảnh nào hợp lệ".to_string());
        }

        let mut toc = Vec::new();
        for i in 0..total_pages {
            toc.push(ReaderTocItem {
                title: format!("Trang {}", i + 1),
                chapter_index: i,
            });
        }

        let first_name = &image_names[0];
        let mut zfile = archive.by_name(first_name).map_err(|e| e.to_string())?;
        let mut buf = Vec::new();
        zfile.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        let mime = if first_name.to_lowercase().ends_with(".png") {
            "image/png"
        } else if first_name.to_lowercase().ends_with(".webp") {
            "image/webp"
        } else if first_name.to_lowercase().ends_with(".gif") {
            "image/gif"
        } else {
            "image/jpeg"
        };
        let data_url = format!("data:{};base64,{}", mime, BASE64.encode(&buf));
        let chapter_html = format!(
            r#"<div style="text-align: center; margin: 0 auto; max-width: 100%;"><img src="{}" style="max-height: 85vh; max-width: 100%; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); margin: 0 auto;" /></div>"#,
            data_url
        );

        Ok(ReaderSession {
            path,
            filename,
            title,
            author: "Manga / Truyện tranh".to_string(),
            format: ext,
            total_chapters: total_pages,
            current_chapter: 0,
            toc,
            chapter_html,
            raw_text: None,
        })
    } else {
        let content = fs::read_to_string(p).map_err(|e| e.to_string())?;
        let paragraphs: Vec<String> = content
            .split("\n\n")
            .map(|para| {
                let escaped = para.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
                format!("<p style='margin-bottom: 1.2em;'>{}</p>", escaped.replace('\n', "<br/>"))
            })
            .collect();

        Ok(ReaderSession {
            path,
            filename,
            title,
            author: "Tài liệu văn bản".to_string(),
            format: ext,
            total_chapters: 1,
            current_chapter: 0,
            toc: vec![ReaderTocItem {
                title: "Toàn bộ tài liệu".to_string(),
                chapter_index: 0,
            }],
            chapter_html: paragraphs.join(""),
            raw_text: Some(content),
        })
    }
}

#[tauri::command]
fn get_book_chapter(path: String, chapter_index: usize) -> Result<ReaderChapter, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Tệp không tồn tại: {}", path));
    }
    let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();

    if ext == "epub" {
        let mut doc = EpubDoc::new(p).map_err(|e| format!("Không thể mở sách EPUB: {:?}", e))?;
        let num_chapters = doc.get_num_chapters();
        let target_idx = if chapter_index < num_chapters {
            chapter_index
        } else {
            0
        };
        doc.set_current_chapter(target_idx);

        let (raw_html, _) = doc.get_current_str().unwrap_or_else(|| (
            "<p>Không có nội dung cho chương này.</p>".to_string(),
            String::new(),
        ));
        let clean_html = inline_epub_resources(&raw_html, &mut doc);

        Ok(ReaderChapter {
            chapter_index: target_idx,
            title: format!("Chương {}/{}", target_idx + 1, num_chapters),
            html: clean_html,
        })
    } else if ext == "cbz" {
        let file = File::open(p).map_err(|e| format!("Không thể mở file CBZ: {}", e))?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Lỗi đọc file nén: {}", e))?;
        let mut image_names: Vec<String> = archive
            .file_names()
            .filter(|name| {
                let lower = name.to_lowercase();
                lower.ends_with(".jpg") || lower.ends_with(".jpeg") || lower.ends_with(".png") || lower.ends_with(".webp") || lower.ends_with(".gif")
            })
            .map(|s| s.to_string())
            .collect();
        image_names.sort();

        let target_idx = if chapter_index < image_names.len() {
            chapter_index
        } else {
            0
        };

        if let Some(target_name) = image_names.get(target_idx) {
            let mut zfile = archive.by_name(target_name).map_err(|e| e.to_string())?;
            let mut buf = Vec::new();
            zfile.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            let mime = if target_name.to_lowercase().ends_with(".png") {
                "image/png"
            } else if target_name.to_lowercase().ends_with(".webp") {
                "image/webp"
            } else if target_name.to_lowercase().ends_with(".gif") {
                "image/gif"
            } else {
                "image/jpeg"
            };
            let data_url = format!("data:{};base64,{}", mime, BASE64.encode(&buf));
            let html = format!(
                r#"<div style="text-align: center; margin: 0 auto; max-width: 100%;"><img src="{}" style="max-height: 85vh; max-width: 100%; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); margin: 0 auto;" /></div>"#,
                data_url
            );

            Ok(ReaderChapter {
                chapter_index: target_idx,
                title: format!("Trang {}/{}", target_idx + 1, image_names.len()),
                html,
            })
        } else {
            Err("Không tìm thấy trang ảnh yêu cầu".to_string())
        }
    } else {
        open_book_reader(path).map(|s| ReaderChapter {
            chapter_index: 0,
            title: s.title,
            html: s.chapter_html,
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            load_omarchy_theme,
            load_settings,
            save_settings,
            get_system_fonts,
            test_kindle_connection,
            send_book_to_kindle,
            send_markdown_to_kindle,
            read_text_file,
            save_markdown_file,
            import_file_to_library,
            scan_library,
            export_markdown_to_epub,
            open_book_reader,
            get_book_chapter
        ])
        .run(tauri::generate_context!())
        .expect("error while running omawrite-reader application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_epub_reader() {
        let path = "/home/ka/Books/Ghi chép mới.epub".to_string();
        if Path::new(&path).exists() {
            let res = open_book_reader(path);
            assert!(res.is_ok(), "Failed to open epub: {:?}", res.err());
            let session = res.unwrap();
            println!("Title: {}", session.title);
            println!("Chapters: {}", session.total_chapters);
            println!("TOC: {:?}", session.toc);
        }
    }

    #[test]
    fn test_txt_reader() {
        let path = "/home/ka/Books/chat-Nguyên Nhân Sâu Xa Của Tai Biến Theo Các Góc Nhìn.txt".to_string();
        if Path::new(&path).exists() {
            let res = open_book_reader(path);
            assert!(res.is_ok(), "Failed to open txt: {:?}", res.err());
            let session = res.unwrap();
            println!("Title: {}", session.title);
            println!("HTML len: {}", session.chapter_html.len());
        }
    }

    #[test]
    fn test_cbz_reader() {
        let test_cbz_path = "/tmp/test_comic.cbz";
        {
            let file = File::create(test_cbz_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options = zip::write::FileOptions::default();

            // Page 1 (valid 1x1 transparent png)
            zip.start_file("001.png", options).unwrap();
            let png_bytes = [
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
                0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
                0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78,
                0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
                0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
            ];
            zip.write_all(&png_bytes).unwrap();

            // Page 2
            zip.start_file("002.png", options).unwrap();
            zip.write_all(&png_bytes).unwrap();

            zip.finish().unwrap();
        }

        let session = open_book_reader(test_cbz_path.to_string()).unwrap();
        assert_eq!(session.total_chapters, 2);
        assert_eq!(session.format, "cbz");

        let ch2 = get_book_chapter(test_cbz_path.to_string(), 1).unwrap();
        assert_eq!(ch2.chapter_index, 1);
        assert!(ch2.html.contains(r#"<img src="data:image/png;base64,"#));

        let _ = fs::remove_file(test_cbz_path);
    }
}
