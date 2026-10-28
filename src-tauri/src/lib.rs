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
use ssh2::{OpenFlags, OpenType, Session};

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
    "JetBrainsMono Nerd Font".to_string()
}

fn get_default_data_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/home/ka"));
        home.join(".local/share")
    });
    base.join("kareader").join("books")
}

impl Default for AppSettings {
    fn default() -> Self {
        let default_lib = get_default_data_dir();
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KualPackageInfo {
    pub name: String,
    pub version: String,
    pub author: String,
    pub id: String,
    pub folder_name: String,
    pub file_count: usize,
    pub total_size_bytes: u64,
    pub has_binary: bool,
    pub has_database: bool,
    pub zip_path: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KualInstallResult {
    pub success: bool,
    pub message: String,
    pub target_dir: String,
    pub preserved_db: bool,
    pub files_extracted: usize,
    pub duration_ms: u64,
}

fn get_config_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/home/ka"));
        home.join(".config")
    });
    base.join("kareader")
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
                .filter(|s| !s.is_empty() && !s.starts_with('.') && s.to_lowercase() != "omarchy")
                .collect();
            fonts.sort();
            fonts.dedup();
            if !fonts.is_empty() {
                return fonts;
            }
        }
    }
    vec![
        "JetBrainsMono Nerd Font".to_string(),
        "iA Writer Mono S".to_string(),
        "Adwaita Mono".to_string(),
        "IBM Plex Mono".to_string(),
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
    let dir = get_config_dir();
    let _ = fs::create_dir_all(&dir);

    // Ensure standard Unix/Linux data directory exists (~/.local/share/kareader/books)
    let default_data_dir = get_default_data_dir();
    let _ = fs::create_dir_all(&default_data_dir);

    // If default data dir is empty and legacy ~/Books exists, automatically seed/copy books across
    if let Ok(entries) = fs::read_dir(&default_data_dir) {
        if entries.count() == 0 {
            if let Some(home) = dirs::home_dir() {
                let old_books = home.join("Books");
                if old_books.exists() && old_books.is_dir() {
                    if let Ok(old_entries) = fs::read_dir(&old_books) {
                        for entry in old_entries.flatten() {
                            let src = entry.path();
                            if src.is_file() {
                                if let Some(fname) = src.file_name() {
                                    let dest = default_data_dir.join(fname);
                                    let _ = fs::copy(&src, &dest);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Standard Unix config: check config.json first, then settings.json
    let config_json = dir.join("config.json");
    let settings_json = dir.join("settings.json");

    let loaded_str = if config_json.exists() {
        fs::read_to_string(&config_json).ok()
    } else if settings_json.exists() {
        fs::read_to_string(&settings_json).ok()
    } else {
        // Fallback: check migration from legacy omawrite-reader if exists
        let old_config = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("/home/ka/.config"))
            .join("omawrite-reader")
            .join("settings.json");
        if old_config.exists() {
            fs::read_to_string(&old_config).ok()
        } else {
            None
        }
    };

    let mut settings = if let Some(content) = loaded_str {
        serde_json::from_str::<AppSettings>(&content).unwrap_or_default()
    } else {
        AppSettings::default()
    };

    if settings.kindle_user.trim().is_empty() {
        settings.kindle_user = "root".to_string();
    }
    if settings.editor_font.trim().is_empty() || settings.editor_font.to_lowercase() == "omarchy" {
        settings.editor_font = default_editor_font();
    }
    if settings.local_library_dir.trim().is_empty() {
        settings.local_library_dir = default_data_dir.to_string_lossy().to_string();
    }

    // Ensure config is persisted to .config/kareader/config.json
    let _ = save_settings(settings.clone());

    settings
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<String, String> {
    let dir = get_config_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let mut clean_settings = settings;
    if clean_settings.kindle_user.trim().is_empty() {
        clean_settings.kindle_user = "root".to_string();
    }
    if clean_settings.editor_font.trim().is_empty() || clean_settings.editor_font.to_lowercase() == "omarchy" {
        clean_settings.editor_font = default_editor_font();
    }
    if clean_settings.local_library_dir.trim().is_empty() {
        clean_settings.local_library_dir = get_default_data_dir().to_string_lossy().to_string();
    }

    // Ensure the data directory exists
    let _ = fs::create_dir_all(Path::new(&clean_settings.local_library_dir));

    let json = serde_json::to_string_pretty(&clean_settings).map_err(|e| e.to_string())?;

    // Standard Unix/Linux config file: ~/.config/kareader/config.json
    let config_path = dir.join("config.json");
    fs::write(&config_path, &json).map_err(|e| e.to_string())?;

    // Also write settings.json for backward compatibility
    let settings_path = dir.join("settings.json");
    let _ = fs::write(&settings_path, &json);

    Ok("Cấu hình Kareader đã được lưu thành công".to_string())
}

fn test_kindle_connection_blocking(
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

    let _ = socket.set_nodelay(true);
    let _ = socket.set_read_timeout(Some(Duration::from_secs(5)));
    let _ = socket.set_write_timeout(Some(Duration::from_secs(5)));

    let mut sess = Session::new().map_err(|e| e.to_string())?;
    sess.set_tcp_stream(socket);
    sess.set_timeout(5000);
    sess.handshake().map_err(|e| format!("SSH Handshake thất bại: {}", e))?;
    
    let username = user.unwrap_or_else(|| "root".to_string());
    let pw = password.unwrap_or_default();
    authenticate_session(&mut sess, &username, &pw)?;

    Ok(format!("Đã kết nối và xác thực thành công tới KOReader ({})!", addr))
}

#[tauri::command]
async fn test_kindle_connection(
    ip: String,
    port: u16,
    user: Option<String>,
    password: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        test_kindle_connection_blocking(ip, port, user, password)
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {}", e))?
}

fn sftp_mkdir_p(sftp: &ssh2::Sftp, remote_dir: &str) {
    let clean = remote_dir.trim_end_matches('/');
    let mut current = String::new();
    for part in clean.split('/') {
        if part.is_empty() {
            current.push('/');
            continue;
        }
        if !current.ends_with('/') {
            current.push('/');
        }
        current.push_str(part);
        let _ = sftp.mkdir(Path::new(&current), 0o755);
    }
}

fn send_book_to_kindle_blocking(
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
    ).map_err(|e| format!("Không kết nối được tới Kindle tại {}: {}. Vui lòng kiểm tra màn hình Kindle có sáng và đã bật SSH Server trong KOReader chưa.", addr, e))?;

    // Enable TCP_NODELAY and socket timeouts to prevent freeze while allowing Kindle flash writes
    let _ = socket.set_nodelay(true);
    let _ = socket.set_read_timeout(Some(Duration::from_secs(30)));
    let _ = socket.set_write_timeout(Some(Duration::from_secs(30)));

    let mut sess = Session::new().map_err(|e| e.to_string())?;
    sess.set_tcp_stream(socket);
    sess.set_timeout(30_000); // 30 seconds per SFTP packet operation
    sess.handshake().map_err(|e| format!("SSH handshake thất bại: {}", e))?;

    let username = user.unwrap_or_else(|| "root".to_string());
    let pw = password.unwrap_or_default();
    authenticate_session(&mut sess, &username, &pw)?;

    let sftp = sess.sftp().map_err(|e| format!("Không mở được SFTP channel: {}", e))?;

    // Recursively ensure all remote parent directories exist
    sftp_mkdir_p(&sftp, &remote_dir);

    let clean_remote_dir = remote_dir.trim_end_matches('/');
    let remote_file_path = format!("{}/{}", clean_remote_dir, filename);

    // Open remote file with WRITE | CREATE | TRUNCATE for clean overwrite
    let mut remote_file = sftp.open_mode(
        Path::new(&remote_file_path),
        OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE,
        0o644,
        OpenType::File,
    ).map_err(|e| format!("Không thể tạo/mở file trên Kindle ({}): {}", remote_file_path, e))?;

    let mut local_file = File::open(path).map_err(|e| e.to_string())?;
    // Use 16KB buffer chunks: guarantees compatibility with libssh2 SFTP packet maxlen (30KB) and Dropbear
    let mut buffer = [0u8; 16 * 1024];
    let mut total_written = 0u64;

    loop {
        let bytes_read = local_file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }
        let mut slice = &buffer[..bytes_read];
        while !slice.is_empty() {
            let written = remote_file.write(slice).map_err(|e| {
                format!("Lỗi ghi dữ liệu SFTP (đã truyền {} bytes): {}", total_written, e)
            })?;
            if written == 0 {
                return Err(format!("SFTP connection stalled sau khi truyền {} bytes", total_written));
            }
            slice = &slice[written..];
            total_written += written as u64;
        }
    }

    let _ = remote_file.flush();

    Ok(TransferResult {
        success: true,
        filename,
        bytes_sent: total_written,
        message: format!("Đã đồng bộ {} bytes sang Kindle ({})", total_written, remote_file_path),
    })
}

#[tauri::command]
async fn send_book_to_kindle(
    ip: String,
    port: u16,
    user: Option<String>,
    password: Option<String>,
    remote_dir: String,
    local_path: String,
) -> Result<TransferResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        send_book_to_kindle_blocking(ip, port, user, password, remote_dir, local_path)
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {}", e))?
}

fn send_markdown_to_kindle_blocking(
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

    send_book_to_kindle_blocking(ip, port, user, password, remote_dir, local_file_path)
}

#[tauri::command]
async fn send_markdown_to_kindle(
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
    tauri::async_runtime::spawn_blocking(move || {
        send_markdown_to_kindle_blocking(ip, port, user, password, remote_dir, title, author, content, as_epub)
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {}", e))?
}

fn extract_xml_tag(xml: &str, tag: &str) -> Option<String> {
    let pattern = format!(r"(?s)<{tag}[^>]*>(.*?)</{tag}>");
    if let Ok(re) = Regex::new(&pattern) {
        if let Some(caps) = re.captures(xml) {
            let val = caps.get(1)?.as_str().trim();
            let cleaned = if val.starts_with("<![CDATA[") && val.ends_with("]]>") {
                &val[9..val.len() - 3]
            } else {
                val
            };
            return Some(cleaned.trim().to_string());
        }
    }
    None
}

fn inspect_kual_zip_blocking(zip_path: String) -> Result<KualPackageInfo, String> {
    let path = Path::new(&zip_path);
    if !path.exists() {
        return Err(format!("File không tồn tại: {}", zip_path));
    }

    let file = File::open(path).map_err(|e| format!("Không thể mở file ZIP: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("File ZIP không hợp lệ: {}", e))?;

    let mut config_xml_content: Option<String> = None;
    let mut config_xml_path: Option<String> = None;
    let mut total_size_bytes = 0u64;
    let mut file_count = 0usize;
    let mut has_binary = false;
    let mut has_database = false;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| format!("Lỗi đọc mục trong file ZIP: {}", e))?;
        let entry_name = entry.name().to_string();

        if !entry.is_dir() {
            file_count += 1;
            total_size_bytes += entry.size();

            let lower = entry_name.to_lowercase();
            if lower.ends_with(".db") || lower.ends_with(".sqlite") || lower.ends_with(".sqlite3") {
                has_database = true;
            }
            if lower.contains("/bin/") || lower.starts_with("bin/") || lower.ends_with(".sh") {
                has_binary = true;
            }

            if entry_name.ends_with("config.xml") {
                let mut content = String::new();
                if entry.read_to_string(&mut content).is_ok() {
                    config_xml_content = Some(content);
                    config_xml_path = Some(entry_name.clone());
                }
            }
        }
    }

    let xml = config_xml_content.ok_or_else(|| {
        "Tệp ZIP không phải là KUAL Extension hợp lệ (không tìm thấy config.xml)".to_string()
    })?;

    let raw_folder = if let Some(ref c_path) = config_xml_path {
        let parts: Vec<&str> = c_path.split('/').filter(|s| !s.is_empty()).collect();
        if parts.len() >= 2 {
            if parts[0] == "extensions" && parts.len() >= 3 {
                parts[1].to_string()
            } else {
                parts[0].to_string()
            }
        } else {
            path.file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "kual_app".to_string())
                .replace("-kual", "")
                .replace("_kual", "")
        }
    } else {
        "kual_app".to_string()
    };

    let folder_name: String = raw_folder
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    let folder_name = if folder_name.is_empty() {
        "kual_app".to_string()
    } else {
        folder_name
    };

    let name = extract_xml_tag(&xml, "name").unwrap_or_else(|| folder_name.clone());
    let version = extract_xml_tag(&xml, "version").unwrap_or_else(|| "1.0.0".to_string());
    let author = extract_xml_tag(&xml, "author").unwrap_or_else(|| "Unknown".to_string());
    let id = extract_xml_tag(&xml, "id").unwrap_or_else(|| format!("kual.extension.{}", folder_name));
    let description = extract_xml_tag(&xml, "description");

    Ok(KualPackageInfo {
        name,
        version,
        author,
        id,
        folder_name,
        file_count,
        total_size_bytes,
        has_binary,
        has_database,
        zip_path,
        description,
    })
}

#[tauri::command]
async fn inspect_kual_zip(zip_path: String) -> Result<KualPackageInfo, String> {
    tauri::async_runtime::spawn_blocking(move || inspect_kual_zip_blocking(zip_path))
        .await
        .map_err(|e| format!("Lỗi tác vụ nền: {}", e))?
}

fn install_kual_extension_blocking(
    ip: String,
    port: u16,
    user: Option<String>,
    password: Option<String>,
    zip_path: String,
    preserve_db: bool,
) -> Result<KualInstallResult, String> {
    let start_time = std::time::Instant::now();

    // 1. Pre-flight inspect package locally
    let pkg_info = inspect_kual_zip_blocking(zip_path.clone())?;
    let folder_name = &pkg_info.folder_name;

    // Validate folder name against malicious characters
    if folder_name.is_empty() || !folder_name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err("Tên thư mục extension chứa ký tự không hợp lệ hoặc không an toàn".to_string());
    }

    let target_dir = format!("/mnt/us/extensions/{}", folder_name);

    // 2. Connect to Kindle SSH/SFTP
    let addr = format!("{}:{}", ip, port);
    let socket = TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("Địa chỉ Kindle không hợp lệ: {}", e))?,
        Duration::from_secs(5),
    ).map_err(|e| format!("Không kết nối được tới Kindle tại {}: {}. Vui lòng kiểm tra màn hình Kindle có sáng và đã bật SSH Server trong KOReader chưa.", addr, e))?;

    let _ = socket.set_nodelay(true);
    let _ = socket.set_read_timeout(Some(Duration::from_secs(60)));
    let _ = socket.set_write_timeout(Some(Duration::from_secs(60)));

    let mut sess = Session::new().map_err(|e| e.to_string())?;
    sess.set_tcp_stream(socket);
    sess.set_timeout(60_000);
    sess.handshake().map_err(|e| format!("SSH handshake thất bại: {}", e))?;

    let username = user.unwrap_or_else(|| "root".to_string());
    let pw = password.unwrap_or_default();
    authenticate_session(&mut sess, &username, &pw)?;

    // 3. SFTP Upload local zip to /tmp/kual_upload.zip
    {
        let sftp = sess.sftp().map_err(|e| format!("Không mở được SFTP channel: {}", e))?;
        sftp_mkdir_p(&sftp, "/tmp");
        sftp_mkdir_p(&sftp, "/mnt/us/extensions");

        let remote_zip = "/tmp/kual_upload.zip";
        let mut remote_file = sftp.open_mode(
            Path::new(remote_zip),
            OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE,
            0o644,
            OpenType::File,
        ).map_err(|e| format!("Không thể tạo file tạm trên Kindle ({}): {}", remote_zip, e))?;

        let mut local_file = File::open(&zip_path).map_err(|e| e.to_string())?;
        let mut buffer = [0u8; 16 * 1024];
        loop {
            let bytes_read = local_file.read(&mut buffer).map_err(|e| e.to_string())?;
            if bytes_read == 0 {
                break;
            }
            let mut slice = &buffer[..bytes_read];
            while !slice.is_empty() {
                let written = remote_file.write(slice).map_err(|e| format!("Lỗi ghi dữ liệu SFTP: {}", e))?;
                if written == 0 {
                    return Err("SFTP connection stalled khi truyền file ZIP".to_string());
                }
                slice = &slice[written..];
            }
        }
        let _ = remote_file.flush();
    }

    // 4. Remote execution via SSH exec channel
    let preserve_flag = if preserve_db { "1" } else { "0" };
    let script = format!(
        r#"sh -c '
set -e
EXTDIR="/mnt/us/extensions/{folder}"
BACKUP_DIR="/tmp/kual_backup_$$"
TEMP_UNPACK="/tmp/kual_unpack_$$"
ZIP_FILE="/tmp/kual_upload.zip"

cleanup() {{
    rm -rf "$TEMP_UNPACK" "$BACKUP_DIR" "$ZIP_FILE" 2>/dev/null || true
}}
trap cleanup EXIT

if [ "{preserve_flag}" = "1" ] && [ -d "$EXTDIR" ]; then
    mkdir -p "$BACKUP_DIR"
    if [ -d "$EXTDIR/data" ]; then
        mkdir -p "$BACKUP_DIR/data"
        cp -f "$EXTDIR"/data/*.db "$BACKUP_DIR/data/" 2>/dev/null || true
        cp -f "$EXTDIR"/data/*.sqlite* "$BACKUP_DIR/data/" 2>/dev/null || true
    fi
    cp -f "$EXTDIR"/*.db "$BACKUP_DIR/" 2>/dev/null || true
fi

mkdir -p "$TEMP_UNPACK"
unzip -o -q "$ZIP_FILE" -d "$TEMP_UNPACK"

# Clean old extension directory to purge obsolete/orphaned files
rm -rf "$EXTDIR"
mkdir -p "$EXTDIR"
if [ -d "$TEMP_UNPACK/extensions/{folder}" ]; then
    cp -rf "$TEMP_UNPACK/extensions/{folder}/." "$EXTDIR/"
elif [ -d "$TEMP_UNPACK/{folder}" ]; then
    cp -rf "$TEMP_UNPACK/{folder}/." "$EXTDIR/"
else
    cp -rf "$TEMP_UNPACK/." "$EXTDIR/"
fi

if [ "{preserve_flag}" = "1" ] && [ -d "$BACKUP_DIR" ]; then
    cp -rf "$BACKUP_DIR/." "$EXTDIR/" 2>/dev/null || true
fi

chmod -R 755 "$EXTDIR" 2>/dev/null || true
if [ -d "$EXTDIR/bin" ]; then
    chmod +x "$EXTDIR/bin/"* 2>/dev/null || true
fi

sync

echo "KUAL_INSTALL_SUCCESS"
'
"#,
        folder = folder_name,
        preserve_flag = preserve_flag
    );

    let mut channel = sess.channel_session().map_err(|e| format!("Không thể mở SSH channel: {}", e))?;
    channel.exec(&script).map_err(|e| format!("Không thể thực thi script cài đặt trên Kindle: {}", e))?;

    let mut stdout_str = String::new();
    channel.read_to_string(&mut stdout_str).map_err(|e| format!("Lỗi đọc kết quả cài đặt: {}", e))?;

    let mut stderr_str = String::new();
    let mut stderr_channel = channel.stderr();
    let _ = stderr_channel.read_to_string(&mut stderr_str);

    channel.wait_close().map_err(|e| format!("Lỗi hoàn tất SSH channel: {}", e))?;
    let exit_code = channel.exit_status().unwrap_or(0);

    if exit_code != 0 || !stdout_str.contains("KUAL_INSTALL_SUCCESS") {
        return Err(format!(
            "Lỗi cài đặt KUAL Extension trên Kindle (mã lỗi {}): {} {}",
            exit_code, stdout_str, stderr_str
        ));
    }

    let duration_ms = start_time.elapsed().as_millis() as u64;
    Ok(KualInstallResult {
        success: true,
        message: format!(
            "Đã cài đặt thành công extension '{}' ({}) vào {}!",
            pkg_info.name, pkg_info.version, target_dir
        ),
        target_dir,
        preserved_db: preserve_db && pkg_info.has_database,
        files_extracted: pkg_info.file_count,
        duration_ms,
    })
}

#[tauri::command]
async fn install_kual_extension(
    ip: String,
    port: u16,
    user: Option<String>,
    password: Option<String>,
    zip_path: String,
    preserve_db: bool,
) -> Result<KualInstallResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        install_kual_extension_blocking(ip, port, user, password, zip_path, preserve_db)
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {}", e))?
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
                    author = "Truyện tranh / Manga".to_string();
                    description = "Tệp truyện tranh CBZ".to_string();
                    cover_data_url = get_cbz_cover_data_url(&p);
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
                } else if ext == "pdf" {
                    let (pdf_t, pdf_a, pages) = get_pdf_info(&p);
                    if !pdf_t.is_empty() {
                        title = pdf_t;
                    }
                    if !pdf_a.is_empty() {
                        author = pdf_a;
                    }
                    description = format!("Tài liệu PDF gồm {} trang", pages);
                    cover_data_url = get_pdf_cover_data_url(&p);
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

fn get_pdf_info(path: &Path) -> (String, String, usize) {
    let mut title = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let mut author = "Tài liệu PDF".to_string();
    let mut total_pages = 1usize;

    if let Ok(output) = Command::new("pdfinfo").arg(path).output() {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                if line.starts_with("Pages:") {
                    if let Some(cnt) = line.split_whitespace().nth(1) {
                        if let Ok(n) = cnt.parse::<usize>() {
                            total_pages = n.max(1);
                        }
                    }
                } else if line.starts_with("Title:") {
                    let t = line.trim_start_matches("Title:").trim();
                    if !t.is_empty() {
                        title = t.to_string();
                    }
                } else if line.starts_with("Author:") {
                    let a = line.trim_start_matches("Author:").trim();
                    if !a.is_empty() {
                        author = a.to_string();
                    }
                }
            }
        }
    }
    (title, author, total_pages)
}

fn get_cache_dir() -> PathBuf {
    let base = dirs::cache_dir().unwrap_or_else(|| {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/home/ka"));
        home.join(".cache")
    });
    let dir = base.join("kareader").join("thumbs");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn get_file_cache_key(path: &Path) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    if let Ok(meta) = path.metadata() {
        meta.len().hash(&mut hasher);
        if let Ok(mtime) = meta.modified() {
            mtime.hash(&mut hasher);
        }
    }
    format!("{:016x}", hasher.finish())
}

fn get_pdf_cover_data_url(path: &Path) -> Option<String> {
    let cache_dir = get_cache_dir();
    let cache_key = get_file_cache_key(path);
    let cached_thumb = cache_dir.join(format!("{}.jpg", cache_key));

    if cached_thumb.exists() {
        if let Ok(bytes) = fs::read(&cached_thumb) {
            let b64 = BASE64.encode(&bytes);
            return Some(format!("data:image/jpeg;base64,{}", b64));
        }
    }

    let temp_prefix = format!("/tmp/kareader_thumb_{}", cache_key);
    let status = Command::new("pdftoppm")
        .args([
            "-jpeg",
            "-scale-to",
            "240",
            "-f",
            "1",
            "-l",
            "1",
            "-singlefile",
        ])
        .arg(path)
        .arg(&temp_prefix)
        .status()
        .ok()?;

    let out_jpg = format!("{}.jpg", temp_prefix);
    if status.success() && Path::new(&out_jpg).exists() {
        if let Ok(bytes) = fs::read(&out_jpg) {
            let _ = fs::write(&cached_thumb, &bytes);
            let _ = fs::remove_file(&out_jpg);
            let b64 = BASE64.encode(&bytes);
            return Some(format!("data:image/jpeg;base64,{}", b64));
        }
        let _ = fs::remove_file(&out_jpg);
    }
    None
}

fn get_cbz_cover_data_url(path: &Path) -> Option<String> {
    let cache_dir = get_cache_dir();
    let cache_key = get_file_cache_key(path);
    let cached_thumb = cache_dir.join(format!("{}.jpg", cache_key));

    if cached_thumb.exists() {
        if let Ok(bytes) = fs::read(&cached_thumb) {
            let b64 = BASE64.encode(&bytes);
            return Some(format!("data:image/jpeg;base64,{}", b64));
        }
    }

    let file = File::open(path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;
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
        let mut zfile = archive.by_name(first_img).ok()?;
        let mut buf = Vec::new();
        if zfile.read_to_end(&mut buf).is_ok() {
            let _ = fs::write(&cached_thumb, &buf);
            let mime = if first_img.to_lowercase().ends_with(".png") {
                "image/png"
            } else if first_img.to_lowercase().ends_with(".webp") {
                "image/webp"
            } else {
                "image/jpeg"
            };
            return Some(format!("data:{};base64,{}", mime, BASE64.encode(&buf)));
        }
    }
    None
}

fn render_pdf_page_to_html(path: &Path, page_1_based: usize, total_pages: usize) -> Result<String, String> {
    let temp_prefix = format!("/tmp/oma_pdf_pg_{}_{}", std::process::id(), page_1_based);
    let output = Command::new("pdftoppm")
        .args([
            "-png",
            "-r",
            "150",
            "-f",
            &page_1_based.to_string(),
            "-l",
            &page_1_based.to_string(),
            "-singlefile",
        ])
        .arg(path)
        .arg(&temp_prefix)
        .output()
        .map_err(|e| format!("Không thể chạy pdftoppm: {}", e))?;

    let out_png = format!("{}.png", temp_prefix);
    if !output.status.success() || !Path::new(&out_png).exists() {
        return Err("Lỗi kết xuất trang PDF sang hình ảnh".to_string());
    }

    let bytes = fs::read(&out_png).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&out_png);
    let b64 = BASE64.encode(&bytes);
    let data_url = format!("data:image/png;base64,{}", b64);

    Ok(format!(
        r#"<div style="text-align: center; margin: 0 auto; max-width: 100%;">
            <img src="{}" style="max-height: 85vh; max-width: 100%; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); margin: 0 auto;" />
            <div style="font-family: monospace; font-size: 11px; opacity: 0.6; margin-top: 12px;">Trang {} / {}</div>
        </div>"#,
        data_url, page_1_based, total_pages
    ))
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
    } else if ext == "pdf" {
        let (pdf_t, pdf_a, total_pages) = get_pdf_info(p);
        if !pdf_t.is_empty() {
            title = pdf_t;
        }
        if !pdf_a.is_empty() {
            author = pdf_a;
        }
        let mut toc = Vec::new();
        for i in 0..total_pages {
            toc.push(ReaderTocItem {
                title: format!("Trang {}", i + 1),
                chapter_index: i,
            });
        }
        let chapter_html = render_pdf_page_to_html(p, 1, total_pages)?;

        Ok(ReaderSession {
            path,
            filename,
            title,
            author,
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
    } else if ext == "pdf" {
        let (_, _, total_pages) = get_pdf_info(p);
        let target_page = (chapter_index + 1).min(total_pages).max(1);
        let html = render_pdf_page_to_html(p, target_page, total_pages)?;

        Ok(ReaderChapter {
            chapter_index,
            title: format!("Trang {}/{}", target_page, total_pages),
            html,
        })
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
        .setup(|_app| {
            // Ensure XDG config directory (~/.config/kareader) and data directory (~/.local/share/kareader/books)
            // are initialized and seeded on app startup
            let _ = load_settings();
            Ok(())
        })
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
            get_book_chapter,
            inspect_kual_zip,
            install_kual_extension
        ])
        .run(tauri::generate_context!())
        .expect("error while running kareader application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn resolve_test_file(filename: &str) -> Option<String> {
        let xdg_path = get_default_data_dir().join(filename);
        if xdg_path.exists() {
            return Some(xdg_path.to_string_lossy().to_string());
        }
        let legacy_path = PathBuf::from("/home/ka/Books").join(filename);
        if legacy_path.exists() {
            return Some(legacy_path.to_string_lossy().to_string());
        }
        None
    }

    #[test]
    fn test_load_and_save_kareader_config() {
        let settings = load_settings();
        let config_dir = get_config_dir();
        assert!(config_dir.ends_with("kareader"));
        assert!(config_dir.join("config.json").exists(), "config.json should exist in {:?}", config_dir);
        assert!(config_dir.join("settings.json").exists(), "settings.json should exist in {:?}", config_dir);

        let data_dir = PathBuf::from(&settings.local_library_dir);
        assert!(data_dir.exists(), "Data library dir should exist: {:?}", data_dir);
        assert!(data_dir.to_string_lossy().contains("kareader/books"));
        println!("Config dir verified: {:?}", config_dir);
        println!("Data dir verified: {:?}", data_dir);
    }

    #[test]
    fn test_bench_scan_library() {
        let t0 = std::time::Instant::now();
        let books = scan_library(None).unwrap();
        let elapsed = t0.elapsed();
        println!("scan_library took {:?} for {} books", elapsed, books.len());
        for b in &books {
            let cover_size = b.cover_data_url.as_ref().map(|s| s.len()).unwrap_or(0);
            println!("Book: {:<35} format: {:<5} cover_len: {} bytes", b.title, b.format, cover_size);
        }
    }

    #[test]
    fn test_epub_reader() {
        if let Some(path) = resolve_test_file("Ghi chép mới.epub") {
            let res = open_book_reader(path);
            assert!(res.is_ok(), "Failed to open epub: {:?}", res.err());
            let session = res.unwrap();
            println!("Title: {}", session.title);
            println!("Chapters: {}", session.total_chapters);
            println!("TOC: {:?}", session.toc);
        }
    }

    #[test]
    fn test_pdf_reader() {
        if let Some(path) = resolve_test_file("3D LAB_HOP DONG GIA CONG NGUYEN NGOC PHONG.pdf") {
            let res = open_book_reader(path.clone());
            assert!(res.is_ok(), "Failed to open pdf: {:?}", res.err());
            let session = res.unwrap();
            println!("PDF Title: {}", session.title);
            println!("PDF Total Pages: {}", session.total_chapters);
            assert!(session.total_chapters >= 1);
            assert_eq!(session.format, "pdf");
            assert!(session.chapter_html.contains("data:image/png;base64,"));

            let ch2 = get_book_chapter(path, 1).unwrap();
            assert_eq!(ch2.chapter_index, 1);
            assert!(ch2.html.contains("data:image/png;base64,"));
        }
    }

    #[test]
    fn test_txt_reader() {
        let path_opt = resolve_test_file("chat-Nguyên Nhân Sâu Xa Của Tai Biến Theo Các Góc Nhìn.txt");
        let path = path_opt.unwrap_or_else(|| "/home/ka/Books/chat-Nguyên Nhân Sâu Xa Của Tai Biến Theo Các Góc Nhìn.txt".to_string());
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

    #[test]
    fn test_inspect_kual_zip_with_gach() {
        let gach_zip = "/home/ka/Repos/github.com/trongnghiango/gach-kindle/gach-kual.zip";
        if Path::new(gach_zip).exists() {
            let res = inspect_kual_zip_blocking(gach_zip.to_string());
            assert!(res.is_ok(), "Failed to inspect gach-kual.zip: {:?}", res.err());
            let info = res.unwrap();
            println!("Inspected KUAL Package: {:?}", info);
            assert_eq!(info.name, "GACH");
            assert_eq!(info.version, "1.0.0");
            assert_eq!(info.folder_name, "gach");
            assert!(info.file_count >= 40);
            assert!(info.has_binary);
            assert!(info.has_database);
            assert_eq!(info.id, "com.trongnghiango.gach");
        }
    }

    #[test]
    fn test_inspect_kual_zip_mock() {
        let test_zip = "/tmp/test_kual_extension.zip";
        {
            let file = File::create(test_zip).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options = zip::write::FileOptions::default();

            zip.start_file("myextension/config.xml", options).unwrap();
            let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<extension>
  <information>
    <name>My Test Extension</name>
    <version>2.1.0</version>
    <author>Tester</author>
    <id>org.test.ext</id>
  </information>
</extension>"#;
            zip.write_all(xml.as_bytes()).unwrap();

            zip.start_file("myextension/bin/run.sh", options).unwrap();
            zip.write_all(b"#!/bin/sh
echo hello
").unwrap();

            zip.start_file("myextension/data/data.db", options).unwrap();
            zip.write_all(b"fake sqlite db bytes").unwrap();

            zip.finish().unwrap();
        }

        let res = inspect_kual_zip_blocking(test_zip.to_string());
        assert!(res.is_ok(), "Failed to inspect mock kual zip: {:?}", res.err());
        let info = res.unwrap();
        assert_eq!(info.name, "My Test Extension");
        assert_eq!(info.version, "2.1.0");
        assert_eq!(info.author, "Tester");
        assert_eq!(info.id, "org.test.ext");
        assert_eq!(info.folder_name, "myextension");
        assert_eq!(info.file_count, 3);
        assert!(info.has_binary);
        assert!(info.has_database);

        let _ = fs::remove_file(test_zip);
    }

    #[test]
    fn test_inspect_kual_zip_non_kual() {
        let test_zip = "/tmp/test_non_kual.zip";
        {
            let file = File::create(test_zip).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let options = zip::write::FileOptions::default();
            zip.start_file("hello.txt", options).unwrap();
            zip.write_all(b"hello world").unwrap();
            zip.finish().unwrap();
        }
        let res = inspect_kual_zip_blocking(test_zip.to_string());
        assert!(res.is_err(), "Non-kual zip should fail inspection");
        let _ = fs::remove_file(test_zip);
    }

    #[test]
    fn test_send_to_kindle_cbz() {
        if let Some(cbz_path) = resolve_test_file("Sam and Lucky 1 - The Perfect Pet.cbz") {
            if let Ok(addr) = "192.168.1.15:2222".parse() {
                if TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok() {
                    let res = send_book_to_kindle_blocking(
                        "192.168.1.15".to_string(),
                        2222,
                        Some("root".to_string()),
                        Some("".to_string()),
                        "/mnt/us/documents/Books".to_string(),
                        cbz_path.to_string(),
                    );
                    println!("CBZ Send Result: {:?}", res);
                    assert!(res.is_ok(), "Failed to send CBZ: {:?}", res.err());
                }
            }
        }
    }
}
