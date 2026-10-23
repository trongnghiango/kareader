# Handoff: Phân Tích Sai Lầm Kiến Trúc, Khủng Hoảng IME & Định Hướng Tái Thiết omawrite-reader

## Focus
Dự án **Omawrite Reader**: Ứng dụng Desktop kết hợp trình soạn thảo Markdown tối giản (kế thừa thẩm mỹ Omawrite trên Omarchy), quản lý thư viện tài liệu, chế độ đọc Zen Reader và đồng bộ không dây 1-Click sang KOReader (Kindle qua Wi-Fi SFTP).
Phiên làm việc hiện tại dừng lại do thất bại nghiêm trọng trong việc thiết kế kiến trúc Editor: Cố tình chắp vá trên nền tảng DOM/Textarea yếu kém, can thiệp mã nguồn vội vã khi chưa thống nhất kiến trúc, dẫn đến lỗi gõ tiếng Việt Fcitx5 bị nuốt chữ/đảo ký tự và lỗi khởi động ứng dụng.

## Handoff reason
`user-initiated` (Dừng khẩn cấp mọi thao tác sửa mã nguồn để tổng kết bàn giao toàn diện hiện trạng, sai lầm và thiết kế kiến trúc cho phiên làm việc tiếp theo).

## Repo state
- **Branch**: `main`
- **HEAD commit**: `a7db883` (`docs: add project documentation, user guide and architectural handoff`)
- **Staged files**:
  - `package.json`, `pnpm-lock.yaml` (Đã thêm dependencies CodeMirror 6)
  - `src/App.tsx` (Layout Orchestrator điều phối Header và Editor/Reader)
  - `src/components/EditorView.tsx` (CodeMirror 6 canvas)
  - `src/components/ReaderView.tsx` (Thanh điều hướng đơn)
  - `src/index.css` (Selection style)
- **Unstaged / Untracked files**:
  - `docs/handoff/latest.md` (Được cập nhật)
  - `docs/architecture/ADD-INDUSTRIAL-GRADE-EDITOR.md` (Bản thiết kế kiến trúc ADD)
- **Working directory**: `/home/ka/Repos/github.com/trongnghiango/omawrite-reader`

## State

### 1. Những phần đã hoàn thiện ổn định và hoạt động tốt:
- **Rust Backend (Tauri v2)**:
  - Bắt tay và truyền file trực tiếp qua SFTP tới Dropbear SSH Server trên Kindle KOReader (`192.168.1.15:2222`, user `root`) hoạt động 100%.
  - Đóng gói Markdown sang EPUB bằng `pulldown-cmark` bảo toàn ngắt dòng và danh sách.
  - Quét thư viện, trích xuất ảnh bìa/metadata sách `.epub` và truyện tranh `.cbz` (đã có unit tests pass 100%).
  - Đọc/lưu file trực tiếp trên ổ đĩa (`read_text_file`, `save_markdown_file`).
- **Thư viện sách (LibraryView)**:
  - Hiển thị danh mục tài liệu kèm nút Đọc sách, Sửa file, Gửi Kindle.
- **Chế độ đọc sách (ReaderView)**:
  - Hỗ trợ xem EPUB, Markdown, TXT, CBZ, PDF với 4 theme màu, tùy chỉnh cỡ chữ, mục lục TOC.

### 2. Khủng hoảng & Sai lầm cốt lõi cần bàn giao:
- **Lỗi bộ gõ tiếng Việt Fcitx5 (IME Composition Drop)**:
  - Trên Linux (Wayland / WebKit2GTK), Fcitx5-bamboo giữ chuỗi đệm tạm thời (`pre-edit buffer`).
  - Ban đầu Agent dùng thẻ `<textarea value={content}>` của React khiến mỗi phím gõ kích hoạt re-render gán đè DOM làm mất buffer của Fcitx, sinh ra chữ cụt ngủn như ảnh người dùng phản ánh: `# Gi ép ới`, `nguên nhân`, `kết ợp`.
- **Thói quen chắp vá nguy hiểm**:
  - Khi thấy lỗi, Agent không dừng lại phân tích kiến trúc mà liên tục sửa đắp vá (chuyển sang uncontrolled, rồi chia chương thủ công, rồi ép cứng biến môi trường `GTK_IM_MODULE=fcitx` vào file Rust `main.rs`).
  - Việc ép cứng biến môi trường này đã phá hỏng tính đa nền tảng (chạy trên Windows dùng Unikey sẽ hỏng). Agent đã phải revert lại file `src-tauri/src/main.rs` về nguyên bản sạch.
- **Lỗi giao diện (Double Header)**:
  - Header của App và Header của Reader hiển thị đè lên nhau do thiếu Layout State Machine độc quyền. Đã sửa trong code staged nhưng chưa được người dùng nghiệm thu.
- **Tình trạng vội vã build khi chưa thống nhất kiến trúc**:
  - Agent vội vã cài đặt CodeMirror 6 và sửa file khi người dùng chưa đồng thuận phương án kiến trúc tổng thể, dẫn đến việc ứng dụng gặp trục trặc khi khởi động.

## Verification
- **Lệnh kiểm tra mã nguồn hiện tại**:
  ```bash
  cd /home/ka/Repos/github.com/trongnghiango/omawrite-reader
  git status
  pnpm run build
  cargo check --manifest-path src-tauri/Cargo.toml
  cargo test --manifest-path src-tauri/Cargo.toml
  ```
- **Kết quả**: Cả `pnpm run build` và `cargo test` đều pass (exit code 0), nhưng cần người dùng hoặc agent tiếp theo kiểm định kỹ lưỡng trên môi trường desktop thực tế.

## Constraints
- **Không bao giờ chắp vá đối phó**: Phải thống nhất kiến trúc với người dùng trước khi chạm vào mã nguồn.
- **Bảo toàn đa nền tảng**: Tuyệt đối không can thiệp hardcode các biến môi trường riêng của Linux vào mã nguồn tầng lõi của Rust/Tauri.
- **Hiệu suất O(1)**: Trình soạn thảo phải xử lý được tài liệu dài hàng nghìn trang mà không phụ thuộc vào chuỗi phẳng hay DOM bloat.
- **Thẩm mỹ Omarchy tối giản**: Kế thừa màu sắc và phong cách thanh thoát của bản gốc Omawrite trên Omarchy.

## Risk context
- **Risk Tier**: Tier 2 (Cần thận trọng tái cấu trúc toàn diện tầng Editor để không phá vỡ tính ổn định của hệ thống).

## Artifacts
- **Tài liệu phân tích kiến trúc chi tiết**: `docs/architecture/ADD-INDUSTRIAL-GRADE-EDITOR.md`
- **Tài liệu bàn giao**: `docs/handoff/latest.md` và `docs/handoff/2026-10-22-110700_handoff-architecture-failure-and-redesign.md`
- **Mã nguồn Editor hiện tại**: `src/components/EditorView.tsx`
- **Mã nguồn Reader**: `src/components/ReaderView.tsx`
- **Backend Rust**: `src-tauri/src/lib.rs`, `src-tauri/src/main.rs`

## Decisions
1. **Dừng toàn bộ hành vi sửa code tự phát**: Không tự ý sửa code khi chưa có sự đồng thuận kiến trúc từ người dùng.
2. **Revert sạch sẽ file `src-tauri/src/main.rs`**: Đã xóa bỏ đoạn code ép biến `GTK_IM_MODULE`, bảo đảm an toàn đa nền tảng.
3. **Lưu giữ toàn bộ bài học kinh nghiệm vào ADD**: Mọi chi tiết về Rope structure, Window Virtualization, IME Composition Transaction đã được ghi lại trong `docs/architecture/ADD-INDUSTRIAL-GRADE-EDITOR.md`.

## Next steps (Dành cho Agent hoặc Phiên tiếp theo)
1. **Lắng nghe và chốt kiến trúc với người dùng**:
   - Xác định rõ hướng đi công nghệ mong muốn: Tiếp tục với Tauri v2 + CodeMirror 6 hoàn chỉnh, hay chuyển hẳn sang Native Qt6/QML (như bản gốc `/usr/bin/omawrite`), hay giải pháp khác.
2. **Kiểm tra trạng thái khởi động của App**:
   - Chạy thử nghiệm và debug lỗi khởi động trên môi trường thật để làm rõ vì sao binary release hoặc dev server không mở được cửa sổ.
3. **Thực hiện bài kiểm thử Fcitx5 gõ tiếng Việt bài bản**:
   - Xác thực gõ đoạn văn bản tiếng Việt dài với tốc độ cao, bảo đảm không bị mất dấu hay rơi rụng phụ âm trước khi bàn giao.
