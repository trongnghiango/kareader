# Handoff: Omawrite Reader & KOReader Wireless Sync Hub

## Focus
Phát triển ứng dụng desktop cá nhân **Omawrite Reader** (Tauri v2 + Vite + React + Tailwind CSS v4) thay thế Calibre cồng kềnh, kết hợp trình soạn thảo Markdown tối giản (kế thừa Omawrite trên Omarchy) với tính năng quản lý tài liệu và đồng bộ không dây 100% qua Wi-Fi SFTP sang máy đọc sách Kindle KOReader (bảo vệ tuyệt đối chân cắm Micro-USB).

## Handoff reason
`user-initiated`

## Repo state
- **Branch**: N/A (thư mục dự án mới tạo, chưa khởi tạo git repo)
- **HEAD commit**: N/A
- **Dirty/uncommitted files**: N/A
- **Working directory**: `/home/ka/Repos/github.com/trongnghiango/omawrite-reader`

## State
Đã dựng hoàn chỉnh khung dự án Tauri v2 + React 19 + Vite 6 + Tailwind CSS v4. Rust backend đã triển khai thành công các module: đồng bộ bảng màu hệ thống Omarchy (`colors.toml`), quét thư viện sách địa phương (`.epub`, `.pdf`, `.md`, `.mobi`) kèm trích xuất metadata/ảnh bìa (Base64), bắt tay và truyền file trực tiếp qua SFTP tới Dropbear SSH Server trên Kindle KOReader (Port 2222, IP `192.168.1.15`), biên dịch Markdown sang EPUB chuẩn xác bằng `pulldown-cmark` (bảo toàn ngắt dòng `<br/>` và danh sách `<ul><li>`), và nạp danh sách font hệ thống (`fc-list`). Frontend đã có giao diện 2 thiết bị (Máy tính & Máy đọc sách), nút Sync, Import/Export file, thanh bottom toolbar Omawrite với Font Selector Popover. Cả Frontend và Backend đều biên dịch thành công 100% (exit code 0).

## Verification
- **Frontend build**: PASS (`pnpm run build` → `tsc -b && vite build` built in 16.83s, exit code 0)
- **Rust Backend check**: PASS (`cargo check --manifest-path src-tauri/Cargo.toml` finished in 0.21s, exit code 0)
- **Kiểm tra SFTP thực tế**: Đã test handshake và truyền file thành công tới Kindle KOReader tại `192.168.1.15:2222`.
- **Lệnh kiểm tra lại**:
  ```bash
  cd /home/ka/Repos/github.com/trongnghiango/omawrite-reader
  pnpm run build
  cargo check --manifest-path src-tauri/Cargo.toml
  ```

## Constraints
- **Không dùng Calibre Desktop**: Không phụ thuộc vào các thư viện Python/Qt cồng kềnh của Calibre.
- **Không ép cắm cáp Micro-USB**: Tuyệt đối ưu tiên luồng mạng Wi-Fi (Dropbear SSH/SFTP) để bảo vệ cổng cắm sạc phần cứng của Kindle.
- **Không ép buộc convert sang EPUB**: Mặc định cho phép đồng bộ trực tiếp file `.md` sang KOReader vì KOReader render Markdown rất tốt. Chỉ convert sang EPUB khi người dùng chủ động chọn `[.epub]`.
- **Thẩm mỹ Omarchy**: Giữ phong cách dark theme tối giản, không viền cồng kềnh, sử dụng font `IBM Plex Mono` / typography hệ thống.

## Risk context
- **Risk Tier**: Tier 1 (Low) - Dự án độc lập, không can thiệp vào các dịch vụ production hay cấu hình nhân OS.

## Artifacts
- Source code: `/home/ka/Repos/github.com/trongnghiango/omawrite-reader/`
  - Backend: `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
  - Frontend: `src/App.tsx`, `src/components/EditorView.tsx`, `src/components/LibraryView.tsx`, `src/components/Header.tsx`, `src/components/FontPicker.tsx`, `src/components/SettingsModal.tsx`
- Tài liệu hướng dẫn: `README.md`
- Cấu hình runtime cục bộ: `~/.config/omawrite-reader/settings.json` (IP `192.168.1.15`, port `2222`, user `root`)

## Decisions
1. **Giao thức đồng bộ**: Sử dụng SSH2/SFTP (Dropbear tích hợp sẵn trong KOReader) thay vì WebDAV hay OPDS HTTP server để thực hiện luồng PUSH 1-click từ máy tính sang Kindle mà không cần thao tác trên màn hình E-ink.
2. **Khắc phục lỗi xác thực Dropbear (-34)**: Dropbear yêu cầu client gửi `auth_methods` (SSH_USERAUTH_NONE) trước khi nhập mật khẩu, đồng thời username phải là `root`. Đã chuẩn hóa hàm `authenticate_session` tự động fallback `root` và thử lần lượt empty password / password tùy chỉnh.
3. **Bộ chuyển đổi Markdown sang EPUB**: Thay thế hoàn toàn bộ tách chuỗi `split("\n\n")` bằng crate chuyên dụng `pulldown-cmark` với bộ ánh xạ `Event::SoftBreak => Event::HardBreak`, giải quyết triệt để lỗi mất ngắt dòng và dính danh sách gạch đầu dòng khi convert sang EPUB.
4. **Font Selector Popover**: Lấy font hệ thống trực tiếp từ `fc-list` trên Arch Linux / Omarchy và hiển thị popover chuẩn theo mẫu nguyên bản của Omawrite.

## Next steps
1. **Khởi tạo Git repo và initial commit**: Chạy `git init`, tạo `.gitignore` chuẩn cho Tauri/Node/Rust, và tạo commit đầu tiên theo quy chuẩn an toàn của `git-guardian`.
2. **Hỗ trợ kéo thả file trực tiếp (Drag & Drop)**: Lắng nghe sự kiện kéo thả file `.epub` hoặc `.md` từ trình quản lý file ngoài màn hình vào cửa sổ app để tự động Import vào thư viện.
3. **Duyệt sách ngược từ Kindle về Máy tính (Pull Sync)**: Bổ sung tab/chế độ đọc danh sách các file đang có sẵn trong `/mnt/us/documents/Books` trên Kindle để tải ngược về máy tính khi cần.
4. **Đóng gói AppImage/Binary**: Chạy `pnpm run tauri:build` để tạo file chạy độc lập và thêm file `.desktop` vào `~/.local/share/applications/` giúp mở nhanh từ launcher Omarchy.

## Blockers
- N/A (Không có blocker nào, kết nối tới Kindle `192.168.1.15` đã hoạt động ổn định).

## Prior handoff
N/A

## Suggested skills
- `git-guardian`: Hướng dẫn an toàn khi khởi tạo git repository và tạo initial commit cho dự án omawrite-reader.
- `ka-fe`: Hướng dẫn tối ưu UX/UI React + Tailwind CSS cho các tính năng Drag & Drop và danh mục Ebook.
- `omarchy`: Tích hợp shortcut và window rules cho omawrite-reader trong Hyprland.
