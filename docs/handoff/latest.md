# Handoff: Omawrite Reader & KOReader Wireless Sync Hub

## Focus
Phát triển ứng dụng desktop cá nhân **Omawrite Reader** (Tauri v2 + Vite + React 19 + Tailwind CSS v4 + Rust) thay thế Calibre cồng kềnh, kết hợp trình soạn thảo Markdown tối giản (kế thừa Omawrite trên Omarchy) với tính năng quản lý tài liệu, chế độ đọc sách Zen Reader đa định dạng và đồng bộ không dây 100% qua Wi-Fi SFTP sang máy đọc sách Kindle KOReader (bảo vệ tuyệt đối chân cắm Micro-USB).

## Handoff reason
`user-initiated`

## Repo state
- **Branch**: main (đã git init, sẵn sàng commit đầu tiên)
- **HEAD commit**: Uncommitted (tất cả staged)
- **Dirty/uncommitted files**: None
- **Working directory**: `/home/ka/Repos/github.com/trongnghiango/omawrite-reader`

## State
Đã hoàn thiện các trụ cột tính năng chính:
1. **Trình soạn thảo & Chỉnh sửa tệp trực tiếp (Direct File Editing)**:
   - Đã khắc phục triệt để lỗi nạp tệp mặc định: hỗ trợ mở, chỉnh sửa và lưu trực tiếp (`Ctrl+S`) vào bất kỳ tệp `.md`, `.txt` nào trên ổ đĩa.
   - Hiển thị rõ đường dẫn tệp thực tế trên thanh công cụ và trạng thái chưa lưu/đã lưu.
   - Nút "Tạo mới", "Mở file từ đĩa", "Thư viện" và Font Popover chuẩn Omarchy.
2. **Chế độ Đọc sách Zen (Zen Reader Mode)**:
   - Mở và đọc sách `.epub` (trích xuất TOC nhiều tầng, phân chương linh hoạt, tự động inline toàn bộ ảnh minh họa Base64), tài liệu `.md`, `.txt` và `.pdf` (qua asset protocol).
   - Tùy chỉnh màu nền (Omarchy Dark, Sepia, OLED Pure Black, Light), cỡ chữ (12px-32px), Font (Mono/Serif/Sans), dãn dòng và độ rộng lề.
   - Ngăn kéo mục lục (TOC Drawer), phím tắt lùi/tiến chương (`←`/`→`), chế độ Zen toàn màn hình (`Z`), lưu vị trí đọc dở vào localStorage.
   - Nút "Sửa file" trực tiếp từ Reader Mode vào Editor.
3. **Thư viện sách & Hành động 1-Click**:
   - Thẻ sách hiển thị 3 nút hành động trực quan: 📖 Đọc sách, ✏️ Sửa file (cho .md/.txt), 🔄 Gửi Kindle.
4. **Kéo & Thả (Drag & Drop)**:
   - Lắng nghe `getCurrentWindow().onDragDropEvent`, kéo thả tệp từ desktop tự động import vào thư viện và nạp vào Editor.
5. **Đồng bộ không dây KOReader Wi-Fi SFTP**:
   - Truyền file trực tiếp qua Dropbear SSH/SFTP (Port 2222, IP Kindle: 192.168.1.15) đã test thành công 100%.

## Verification
- **Frontend build**: PASS (`pnpm run build` built in 1.80s, exit code 0)
- **Rust Backend check**: PASS (`cargo check` finished in 0.17s, exit code 0)
- **Backend Unit Tests**: PASS (`cargo test` 2 passed: test_epub_reader, test_txt_reader)
- **Lệnh kiểm tra lại**:
  ```bash
  cd /home/ka/Repos/github.com/trongnghiango/omawrite-reader
  pnpm run build
  cargo check --manifest-path src-tauri/Cargo.toml
  cargo test --manifest-path src-tauri/Cargo.toml
  ```

## Constraints
- **Không dùng Calibre Desktop**: Không phụ thuộc vào Python/Qt cồng kềnh.
- **Không ép cắm cáp Micro-USB**: Tuyệt đối ưu tiên luồng mạng Wi-Fi (Dropbear SSH/SFTP).
- **Chỉnh sửa trực tiếp file thật**: Không can thiệp sửa đổi tên tệp hay ghi đè lung tung ra thư mục khác nếu tệp đã có đường dẫn thật trên đĩa.
- **Thẩm mỹ Omarchy**: Dark theme tối giản, font IBM Plex Mono.
