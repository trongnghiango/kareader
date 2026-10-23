# BÁO CÁO THIẾT KẾ KIẾN TRÚC HỆ THỐNG (ARCHITECTURE DESIGN DOCUMENT - ADD)
# DỰ ÁN: OMAWRITE READER & KOReader HUB (INDUSTRIAL GRADE)

> **Mục tiêu tối thượng**: Xây dựng một ứng dụng Desktop tối giản (Minimalist Omarchy Aesthetic), hiệu năng tuyệt đối ($O(1)$ Memory & Render overhead bất kể máy yếu hay sách 10.000 trang), kháng 100% lỗi bộ gõ tiếng Việt Fcitx5/Unikey đa nền tảng, và tích hợp đồng bộ KOReader không dây 1-Click.

---

## 1. PHÂN TÍCH NGUYÊN NHÂN CỐT LÕI (ROOT CAUSE ANALYSIS)

### 1.1. Lỗi nuốt chữ, đảo lộn ký tự tiếng Việt (Vietnamese IME Glitch)
- **Cơ chế hoạt động của IME (Fcitx5-Bamboo / Unikey / ibus)**:
  - Khi gõ tiếng Việt theo kiểu Telex/VNI, bộ gõ không phát ra ký tự hoàn chỉnh ngay mà gửi các sự kiện `compositionstart`, `compositionupdate`. Bộ gõ giữ một chuỗi đệm tạm thời (**pre-edit buffer**) và liên tục thay thế đoạn văn bản chưa hoàn chỉnh tại con trỏ.
- **Lỗi ở kiến trúc Controlled Component React cũ**:
  - Dùng thẻ `<textarea value={content} onChange={...}>` khiến mỗi phím gõ kích hoạt React state update -> re-render component cha -> gán đè lại thuộc tính `value` của thẻ DOM.
  - Thao tác gán đè DOM ép buộc con trỏ nhảy vị trí và làm đứt đoạn chuỗi composition của WebKitGTK. Kết quả là Fcitx5 mất ngữ cảnh và nuốt sạch các nguyên âm, sinh ra văn bản méo mó như ảnh chụp: `Gi ép ới`, `nguên nhân`, `kêt ợp`.
- **Giải pháp dứt điểm**:
  - Tách hoàn toàn tầng Text Input ra khỏi vòng lặp state của React.
  - Sử dụng Editor Engine chuyên biệt có bộ xử lý **Composition Transaction** độc lập (như CodeMirror 6 hoặc TextBuffer tách rời) lắng nghe chuẩn xác `compositionend` trước khi commit dữ liệu vào state.

### 1.2. Vấn đề "Nút thắt cổ chai" khi mở tài liệu lớn (Document Scalability Bottleneck)
- **Lỗi ở kiến trúc String liền khối (Flat String Buffer)**:
  - Một file Markdown 500 trang chứa ~500.000 ký tự. Với kiểu dữ liệu `String`, mỗi lần gõ thêm hoặc xóa một ký tự ở giữa, CPU phải cấp phát lại bộ nhớ và dịch chuyển hàng trăm nghìn bytes phía sau (độ phức tạp $O(N)$). Trên máy yếu, CPU bị quá tải và gây giật lag (frame drop).
- **Lỗi ở cây DOM trình duyệt (DOM Bloat)**:
  - Nếu render toàn bộ 500 trang lên DOM, trình duyệt phải tính toán bố cục (reflow/layout) cho hàng chục nghìn node cùng lúc.

---

## 2. KIẾN TRÚC MỤC TIÊU ĐẠT CHUẨN CÔNG NGHIỆP (TARGET ARCHITECTURE)

```
+-----------------------------------------------------------------------------------+
|                            OMARWRITE READER DESKTOP                               |
+-----------------------------------------------------------------------------------+
|  [PRESENTATION LAYER] (React 19 Shell - Strict Minimalist & Viewport Router)      |
|  - Layout Orchestrator: Quản lý độc quyền Viewport (Editor vs Reader vs Library) |
|  - Zero Double-Header: Chỉ duy nhất 1 thanh Topbar ngữ cảnh theo chế độ hiện tại |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|  [EDITOR CORE ENGINE] (CodeMirror 6 / Virtualized Rope Buffer)                    |
|  - Data Structure: B-Tree Rope (Khối lá 512-2048 chars, chèn/xóa O(log N))        |
|  - Virtual Viewport: Chỉ render đúng ~40 dòng hiển thị trong tầm mắt              |
|  - IME Transaction Manager: Cách ly tuyệt đối Composition khỏi React re-render    |
|  - Decoration Layer: Render đẹp như Reader Mode (#, ## to đậm, căn lề 760px)     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|  [ASSET & MEDIA PIPELINE] (Zero-Base64 Architecture)                              |
|  - Markdown chỉ lưu link: ![Alt](assets/img.png)                                  |
|  - Binary assets lưu tại thư mục cục bộ (Lazy load qua Tauri Asset Protocol)      |
|  - Lúc Sync sang KOReader: Backend Rust tự nén và chuyển hóa thành EPUB/CBZ       |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|  [BACKEND & PLATFORM LAYER] (Rust 2021 + Tauri v2)                                |
|  - True Cross-Platform: Tuyệt đối không hardcode biến môi trường Linux fcitx      |
|  - Chunked File Streaming: Ghi file nguyên tử (Atomic Write via temp swap)       |
|  - Dropbear SSH/SFTP Engine: Truyền file trực tiếp qua Wi-Fi tới KOReader         |
+-----------------------------------------------------------------------------------+
```

---

## 3. CHI TIẾT CÁC CƠ CHẾ CỐT LÕI (CORE MECHANISMS)

### 3.1. Cấu trúc dữ liệu Rope (B-Tree Text Rope)
- **Nguyên lý**: 
  - Thay vì lưu một chuỗi dài 10 triệu ký tự, CodeMirror 6 chia văn bản thành các nút lá (Leaf nodes) có kích thước từ 512 đến 2048 ký tự kết nối qua một cây nhị phân cân bằng (B-Tree).
  - Thao tác chèn/xóa tại bất kỳ vị trí nào chỉ tốn $O(log N)$ bước tính toán.
  - Thao tác lấy một dòng (Line indexing) đạt tốc độ gần như tức thì.

### 3.2. Ảo hóa Viewport (DOM Virtualization)
- Trình duyệt chỉ tạo các node HTML `<div class="cm-line">` cho khoảng 30 - 50 dòng nằm trong khung hình của người dùng.
- Khi người dùng cuộn chuột, một bộ đo chiều cao dòng động (Height Oracle) tính toán thanh cuộn ảo mà không cần vẽ toàn bộ văn bản ra thật.
- **Kết quả**: Mở một ghi chú 1 trang hay cuốn bách khoa toàn thư 10.000 trang tốn đúng lượng RAM và CPU như nhau ($O(1)$ footprint).

### 3.3. Xử lý IME Tiếng Việt chuẩn xác (Fcitx5 / Unikey / ibus / Windows IME)
- Không can thiệp vào DOM text khi sự kiện `compositionstart` đang kích hoạt.
- Khi người dùng đang bỏ dấu (ví dụ gõ `s` sau chữ `a` để thành `á`), Editor State chỉ ghi nhận một Transaction tạm thời (Uncommitted Transaction).
- Khi nhận sự kiện `compositionend`, Transaction mới được đóng dấu và lưu vào cây Rope.
- Không phụ thuộc vào bất kỳ biến môi trường nào của hệ điều hành, đảm bảo chạy ổn định trên cả Arch Linux (Omarchy), Ubuntu, Windows 10/11 và macOS.

### 3.4. Kiến trúc Asset Pipeline tách rời (Zero-Base64 in Markdown)
- **Tuyệt đối cấm**: Nhúng chuỗi Data URL Base64 (`data:image/png;base64,...`) trực tiếp vào file `.md`. Chuỗi này sẽ làm phình to văn bản gấp hàng trăm lần, phá vỡ bộ nhớ đệm CPU cache.
- **Giải pháp**:
  - Khi kéo thả ảnh vào Editor, app lưu ảnh vào thư mục `<document_dir>/assets/<hash>.<ext>`.
  - Trong Markdown chỉ ghi: `![](assets/<hash>.<ext>)`.
  - Khi render, sử dụng custom scheme `asset://` của Tauri để stream trực tiếp từ ổ cứng vào card đồ họa (GPU).
  - Khi đồng bộ sang Kindle, Backend Rust tự động gom các tệp ảnh này để đóng gói thành `.epub` hoặc `.cbz` hoàn chỉnh.

### 3.5. Kiến trúc Layout & Navigation duy nhất (Zero Double-Header)
- Header chính của App và Header của Reader/Editor được điều phối qua một **Layout State Machine**:
  - Chế độ **Soạn thảo (Editor)**: Hiển thị thanh Header Soạn thảo tối giản (Tên file, Nút Save, Nút Chuyển chế độ đọc, Nút Gửi Kindle).
  - Chế độ **Đọc sách (Reader)**: Ẩn hoàn toàn Header của App, chỉ hiển thị Header điều hướng của Reader (Nút quay lại Thư viện, Nút Soạn thảo, Mục lục, Đổi Font/Cỡ chữ, Gửi Kindle).
  - Chế độ **Thư viện (Library)**: Hiển thị Header thiết bị (Máy tính vs Máy đọc sách, Nút Import, Nút Cài đặt).
- Triệt tiêu 100% tình trạng hai thanh Header đè bẹp lên nhau.

---

## 4. LỘ TRÌNH TRIỂN KHAI VÀ XÁC MINH (VERIFICATION ROADMAP)

1. **Giai đoạn 1: Core Engine Integration (CodeMirror 6 Clean Room)**
   - Triển khai `EditorView` thuần túy bằng CodeMirror 6 với theme Omarchy chuẩn.
   - Kiểm tra gõ tiếng Việt với Fcitx5-Bamboo trên Linux và Unikey trên Windows: Xác nhận không mất dấu, không nuốt chữ.
2. **Giai đoạn 2: Stress-test với tài liệu siêu lớn**
   - Sinh tệp Markdown kiểm thử dung lượng 5MB (tương đương 1.500 trang sách).
   - Kiểm tra mức sử dụng RAM và độ mượt của con trỏ chuột khi cuộn và gõ phím.
3. **Giai đoạn 3: Layout & KOReader Wireless Pipeline**
   - Hoàn thiện luồng đồng bộ 1-Click sang KOReader qua SFTP.
   - Đóng gói file chạy độc lập (AppImage / Binary) sạch sẽ.
