# Omawrite Reader (Omarchy Edition)

Ứng dụng cá nhân kết hợp giữa **Soạn thảo Markdown tối giản (kế thừa Omawrite)**, **Quản lý thư viện Ebook (thay thế Calibre)** và **Đồng bộ không dây 1-Click sang KOReader trên Kindle (qua Wi-Fi SFTP)**.

---

## 🌟 Tính năng chính

1. **Quản lý sách & tài liệu (Calibre-Lite):**
   - Hỗ trợ định dạng: `.epub`, `.pdf`, `.mobi`, `.cbz`, `.md`, `.txt`.
   - Trích xuất ảnh bìa chất lượng cao từ file EPUB tự động bằng Rust backend.
   - Hiển thị thông tin tác giả, tiêu đề, dung lượng sách.
   - Tìm kiếm nhanh theo tên sách, tác giả hoặc lọc theo định dạng.

2. **Đồng bộ 1-Click sang KOReader (Bảo vệ cổng Micro-USB):**
   - **100% qua mạng Wi-Fi:** Tận dụng Dropbear SSH server có sẵn trên KOReader (Port `2222`).
   - Chỉ cần cắm sạc khi hết pin, tuyệt đối không cần cắm rút cáp Micro-USB để chép sách.
   - Bấm nút *"Gửi sang Kindle"* trên bất kỳ cuốn sách nào -> Sách tự động bay vào `/mnt/us/documents/Books/` trên Kindle trong 2–3 giây.

3. **Soạn thảo Markdown & Xuất bản Ebook:**
   - Soạn thảo tài liệu, ghi chép với giao diện không xao nhãng (Distraction-free).
   - Nút **"Xuất EPUB"**: Đóng gói nội dung Markdown thành file EPUB chuẩn có định dạng sách điện tử.
   - Nút **"Bắn sang Kindle"**: Vừa đóng gói thành EPUB vừa chuyển thẳng qua Kindle KOReader để đọc ngay lập tức!

4. **Đồng bộ hệ sinh thái Omarchy:**
   - Tự động nhận diện bảng màu hệ thống từ `~/.local/state/omarchy/current/theme/colors.toml`.
   - Font chữ chuẩn `IBM Plex Mono`.

---

## 🚀 Hướng dẫn khởi chạy

### Chế độ phát triển (Dev mode):
```bash
cd /home/ka/Repos/github.com/trongnghiango/omawrite-reader

# Chạy cả Vite UI và Tauri Desktop:
pnpm run tauri:dev
```

### Build bản đóng gói Desktop (Binary / AppImage):
```bash
pnpm run tauri:build
```

---

## 📖 Hướng dẫn kết nối với KOReader trên Kindle

1. **Trên máy đọc sách Kindle:**
   - Mở **KOReader**.
   - Chạm vào menu trên cùng > Chọn biểu tượng **Mạng (Network)** hoặc Bánh răng.
   - Bật **SSH Server**. KOReader sẽ hiển thị địa chỉ IP, ví dụ: `192.168.1.50:2222`.
2. **Trên Omawrite Reader:**
   - Bấm vào biểu tượng **Bánh răng (Settings)** ở góc phải trên.
   - Nhập IP của Kindle (ví dụ: `192.168.1.50`).
   - Bấm **"Test KOReader Connection"** -> Đèn báo màu xanh lá cây kết nối thành công.
   - Bấm **Save Settings**.
3. **Thư mục sách trên máy tính:**
   - Mặc định là `~/Books` (bạn có thể đổi trong Settings). Bất kỳ cuốn sách nào bạn bỏ vào đây sẽ xuất hiện trên giao diện app.
