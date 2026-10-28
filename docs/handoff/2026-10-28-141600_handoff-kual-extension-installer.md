# Handoff: Tích Hợp Tính Năng Cài Đặt Không Dây KUAL Extension (.zip) Vào Kareader (omawrite-reader)

## Focus
Đặc tả thiết kế kiến trúc và giải pháp tích hợp liền mạch (seamless integration) tính năng **"Cài đặt KUAL Extension từ file ZIP qua Wi-Fi sang Kindle PW3"** vào ứng dụng Desktop **Kareader** (`omawrite-reader`), tuân thủ chuẩn mực giao diện hiện đại **Omarchy Zen HUD / Dark Aesthetic**, tối ưu hiệu năng 60 FPS và an toàn tệp tin flash FAT32.

## Handoff reason
`user-initiated`

## Repo state
- **Thư mục dự án**: `/home/ka/Repos/github.com/trongnghiango/omawrite-reader`
- **Branch**: `main`
- **HEAD commit**: `c19070b2e409649150976c4ee6413d367e139752`
- **Trạng thái Git**: `git status --short` sạch (clean working tree).
- **Trạng thái Build/Test nền tảng**:
  - `pnpm run build` -> PASS 100% (Clean TypeScript, Vite 6, React 19).
  - `cargo test --manifest-path src-tauri/Cargo.toml` -> PASS 7/7 tests (100%).
  - Đã xuất bản thành công bản phân phối Linux AppImage / DEB / RPM tại `src-tauri/target/release/bundle/`.

## State
Người dùng muốn thay vì cắm cáp USB thủ công vào máy tính rồi mount ổ đĩa Kindle PW3 để cài đặt KUAL extension (như `gach-kual.zip`), ứng dụng Desktop **Kareader** sẽ trực tiếp nhận tệp ZIP (qua hộp thoại hoặc kéo-thả), truyền không dây qua Wi-Fi SFTP/SSH (tận dụng Dropbear SSH port 2222 đang chạy trên KOReader Kindle) và tự động giải nén, phân quyền thực thi vào `/mnt/us/extensions/` để mở được ngay trên KUAL.

Yêu cầu cốt tử từ người dùng: **"Dự án Kareader triển khai với UI rất hiện đại nên việc tích hợp tính năng này phải làm sao cho khớp, hòa quyện tự nhiên vào hệ sinh thái giao diện, tuyệt đối tránh chắp vá."**

## Verification
- Lệnh kiểm tra build TypeScript & Vite:
  ```bash
  cd /home/ka/Repos/github.com/trongnghiango/omawrite-reader
  pnpm run build
  ```
- Lệnh kiểm tra Rust Backend & SSH / SFTP suites:
  ```bash
  cargo test --manifest-path src-tauri/Cargo.toml
  ```

## Constraints
1. **Omarchy Aesthetic Non-negotiable**:
   - Bảng màu bắt buộc kế thừa từ hệ thống Omarchy (`~/.local/state/omarchy/current/theme/colors.toml`):
     - Canvas nền sâu: `#0c1512`, nền editor: `#111c18`, surface cards: `#13221c`.
     - Màu viền & điểm nhấn ngọc bích: `#509475` (accent), viền tinh tế `#509475/20`, `#509475/30`.
     - Màu chữ: `#F7E8B2` (tiêu đề warm highlight), `#C1C497` (body foreground), `#81B8A8` (secondary), `#53685B` (dim metadata).
   - Phông chữ: Chuẩn monospace `JetBrainsMono Nerd Font` hoặc `IBM Plex Mono`.
2. **Triệt để chống giật lag (Zero 2D Heavy Shadows / Zero Transform Translation)**:
   - Nghiêm cấm sử dụng `box-shadow` làm mờ Gaussian lớn (như `shadow-xl` blur 25px) trên WebKitGTK Linux CPU render.
   - Sử dụng viền vi mô sắc nét (`border border-[#509475]/30 hover:border-[#509475]`) và `transition-colors duration-100`.
3. **Triết lý Zen 4-Corner HUD**:
   - Khi ở chế độ Soạn thảo (Editor), toàn bộ màn hình là khung soạn thảo thuần khiết, 4 góc là 4 nút bấm HUD mini (`CornerHUD.tsx`). Không tạo thanh menu ngang hoặc sidebar vĩnh viễn phá vỡ trạng thái Zen.
4. **An toàn phần cứng & File System Kindle FAT32**:
   - Thư mục người dùng trên Kindle (`/mnt/us`) định dạng FAT32:
     - Chạy lệnh phân quyền `chmod +x /mnt/us/extensions/<app_name>/bin/*` qua SSH exec channel.
     - Bắt buộc thực thi lệnh `sync` qua SSH sau khi hoàn tất để xả sạch bộ đệm RAM xuống flash memory, chống lỗi dirty filesystem.
   - **Bảo toàn dữ liệu người dùng**: Tự động nhận diện và sao lưu cơ sở dữ liệu SQLite cũ (`story_engine.db`) ra `/tmp/` trước khi ghi đè, và khôi phục lại sau khi giải nén.

## Risk context
- **Risk Tier**: Tier 2 (State & Storage Changes). Tác động ghi đè tệp tin trên phân vùng `/mnt/us/extensions/` của thiết bị Kindle vật lý.
- **Biện pháp kiểm soát**: Pre-flight validation kiểm tra cấu trúc ZIP trước khi truyền, sao lưu database cũ trước khi ghi đè, rollback nếu giải nén lỗi.

## Artifacts
- Source code Kareader Desktop: `/home/ka/Repos/github.com/trongnghiango/omawrite-reader`
- File KUAL Extension mẫu kiểm thử: `/home/ka/Repos/github.com/trongnghiango/gach-kindle/gach-kual.zip`
- Backend SSH hiện có: `src-tauri/src/lib.rs` (các hàm `send_book_to_kindle_blocking`, `test_kindle_connection_blocking`)
- Giao diện HUD 4 góc: `src/components/CornerHUD.tsx`
- Quản lý sự kiện kéo thả & trạng thái: `src/App.tsx`
- Handoff tối ưu 60 FPS trước đó: `docs/handoff/2026-10-22-110700_handoff-architecture-failure-and-redesign.md`

## Decisions
- **D1: Phương thức truyền file**: Sử dụng SFTP channel truyền trực tiếp file zip sang `/tmp/kual_upload.zip` trên Kindle, sau đó dùng SSH exec channel gọi lệnh `unzip` gốc của BusyBox trên Kindle OS. Lý do: Nhanh gấp 10 lần so với việc giải nén từng file lẻ trên máy tính rồi upload hàng trăm file ảnh qua SFTP.
- **D2: Điểm chạm giao diện**: Tích hợp vào menu Top-Right của `CornerHUD.tsx` và cơ chế kéo-thả toàn màn hình (`onDragDropEvent`) trong `App.tsx`. Lý do: Giữ nguyên vẹn 100% trải nghiệm Zen distraction-free của Kareader, không thêm sidebar hay tab rườm rà.
- **D3: Tương tác xác nhận**: Sử dụng Zen Modal (`KualInstallModal.tsx`) hiển thị tóm tắt thông tin gói từ `config.xml` thay vì hộp thoại confirm thô thiển của hệ điều hành.

## Next steps
1. **Bước 1 (Backend Rust - `src-tauri/src/lib.rs`)**:
   - Khai báo `KualPackageInfo` và `KualInstallResult`.
   - Hiện thực command `inspect_kual_zip(zip_path: String) -> Result<KualPackageInfo, String>` sử dụng crate `zip::ZipArchive`.
   - Hiện thực command `install_kual_extension(ip, port, user, password, zip_path, preserve_db) -> Result<KualInstallResult, String>`.
   - Đăng ký handlers vào `tauri::generate_handler![...]`.
   - Viết test trong `mod tests` và chạy `cargo test`.
2. **Bước 2 (Contracts & Types - `src/types/index.ts`)**:
   - Thêm interface `KualPackageInfo` và `KualInstallResult`.
3. **Bước 3 (Zen Modal Component - `src/components/KualInstallModal.tsx`)**:
   - Thiết kế modal xác nhận chuẩn Omarchy: hiển thị tên extension, phiên bản, kích thước, checkbox bảo toàn database, nút Cài Đặt.
4. **Bước 4 (HUD & App Integration - `CornerHUD.tsx` & `App.tsx`)**:
   - Thêm nút *"Cài đặt KUAL Extension (.zip)..."* vào popover Top-Right.
   - Trong `App.tsx`: Bắt sự kiện kéo thả `.zip` -> gọi `inspect_kual_zip` -> mở modal.
   - Hiện thực hàm xử lý cài đặt và hiển thị live toast tiến trình.
5. **Bước 5 (Kiểm Thử & Đóng Gói)**:
   - Chạy `pnpm run build` kiểm tra TypeScript.
   - Thử nghiệm cài đặt gói `gach-kual.zip` qua Wi-Fi sang Kindle.

## Blockers
N/A

## Prior handoff
- `docs/handoff/2026-10-22-110700_handoff-architecture-failure-and-redesign.md`

## Suggested skills
- `ka-execute`: Thực thi chuyển đổi mã nguồn theo các bước Next Steps một cách tự hành.
- `ka-fe`: Hiện thực `KualInstallModal.tsx` và kết nối HUD/Drag-and-Drop.
- `ka-be`: Hiện thực hàm Rust trong `src-tauri/src/lib.rs`.
