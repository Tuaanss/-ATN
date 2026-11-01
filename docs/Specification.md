# EduPortfolio – Đặc tả chức năng (Specification)

> Phiên bản 3.0 · 11/10/2026 · Backend Node.js 22 + NestJS 11 (TypeScript)
> **v3.0:** hệ thống chỉ lưu trữ kết quả học tập — GV lập nhóm và tải điểm bằng Excel, SV nhận bài/xem nhóm/nhập đề tài/nộp bài; không chấm trên web, không theo dõi tiến độ. Viết lại UC04–UC07 và các phần liên quan (xem [Requirement §10](Requirement.md#10-nhật-ký-thay-đổi-v30)).
> Danh sách use case trong [Requirement.md](Requirement.md). Tên bảng/cột theo [DatabaseDesign.md](DatabaseDesign.md), endpoint theo [ModulesStructure.md](ModulesStructure.md).

---

## 1. Quy ước

- **TĐK**: tiền điều kiện · **HĐK**: hậu điều kiện · **E***n*: luồng ngoại lệ/thay thế.
- Mọi thao tác ghi đều kiểm tra quyền ở server; mọi lỗi trả mã lỗi (`code`) + thông điệp tiếng Việt (§7).
- "Ghi log" nghĩa là thêm một dòng vào `audit_logs`.
- "Thông báo" nghĩa là tạo `notifications` (có thể kèm email), danh mục ở §5.
- Thời gian lưu UTC, hiển thị theo `Asia/Ho_Chi_Minh`.

## 2. Vai trò & điều hướng sau đăng nhập

| Vai trò | Trang mặc định | Chặn trước khi vào hệ thống |
|---|---|---|
| ADMIN | `/admin/dashboard` | – |
| LECTURER | `/lecturer/sections` | Đổi mật khẩu lần đầu |
| STUDENT | `/student/sections` | Đổi mật khẩu lần đầu → Khai báo hồ sơ |
| PARENT | `/parent/overview` | Đổi mật khẩu lần đầu → Chọn con (nếu > 1 con) |
| ENTERPRISE | `/enterprise/search` | Tài khoản phải `ACTIVE` (đã duyệt) |

## 3. Ma trận phân quyền

`✔` được phép · `◐` có điều kiện (ghi chú) · `–` không.

| Chức năng | Admin | GV | SV | PH | DN |
|---|---|---|---|---|---|
| Quản lý người dùng, danh mục, đào tạo | ✔ | – | – | – | – |
| Khai báo / sửa hồ sơ SV | ◐ sửa hộ | – | ◐ của mình | – | – |
| Liên kết Drive, giao / sửa / đóng / xóa bài tập | – | ◐ LHP mình dạy | – | – | – |
| Tải file nhóm (Excel), xem danh sách nhóm | – | ◐ LHP mình dạy | – | – | – |
| Xem nhóm của mình, báo nhóm chưa đúng | – | – | ◐ bài của LHP mình học | – | – |
| Nhập / sửa đề tài | – | ◐ sau hạn | ◐ nhóm mình, trước hạn cuối | – | – |
| Nộp / nộp lại / xóa tệp | – | – | ◐ trước hạn cuối, đã có nhóm + đề tài | – | – |
| Xem bài chung nhóm | ✔ | ◐ LHP mình dạy | ◐ thành viên | ◐ của con | ◐ quyền còn hạn |
| Xem bài cá nhân | ✔ | ◐ LHP mình dạy | ◐ của mình | ◐ của con | ◐ quyền còn hạn |
| Tải tệp gốc | ✔ | ◐ LHP mình dạy | ◐ bài của mình/nhóm mình | – | – |
| Tìm kiếm bài nộp | ✔ | ◐ theo `lecturer.searchScope` | – | – | ◐ SV đang có quyền |
| Tải lên điểm (Excel), công bố điểm | – | ◐ LHP mình dạy | – | – | – |
| Yêu cầu sửa điểm sau khóa | – | ◐ LHP mình dạy | – | – | – |
| Xử lý yêu cầu sửa điểm | ✔ | – | – | – | – |
| Xem điểm chi tiết | ✔ | ◐ LHP mình dạy | ◐ của mình, đã công bố | ◐ của con, đã công bố | – (chỉ CPA) |
| Tìm SV theo CPA, gửi yêu cầu xem bài | – | – | – | – | ✔ |
| Duyệt / thu hồi quyền xem bài, duyệt DN | ✔ | – | – | – | – |
| Xem DN đã xem mình | – | – | ✔ | – | – |
| Nhật ký hệ thống, cấu hình | ✔ | – | – | – | – |
| Dashboard, thống kê DN, xuất báo cáo | ✔ | – | – | – | – |
| Phân tích đề tài – nhu cầu DN | ✔ | ◐ LHP mình dạy | – | – | – |
| Bản đồ năng lực (ẩn danh) | ✔ | – | – | – | ✔ |
| Thống kê LHP | ✔ | ◐ LHP mình dạy | – | – | – |
| Thống kê cá nhân / của DN mình | – | – | ✔ | – | ✔ |

### 3.1. Hàm kiểm tra quyền xem bài nộp `canViewSubmission(user, submission)`

```
ADMIN       → true
LECTURER    → submission.assignment.section.lecturer_id = user.lecturer.id
              (hoặc cùng khoa nếu lecturer_search_scope = FACULTY)
STUDENT     → kind = GROUP_SHARED  : user là thành viên submission.group
              kind = PERSONAL      : submission.student_id = user.student.id
PARENT      → chủ bài (student_id, hoặc một thành viên group) thuộc parent_students của user
              và đúng đứa con đang chọn
ENTERPRISE  → tồn tại view_request status=APPROVED, expires_at > now(),
              student_id ∈ {chủ bài cá nhân | thành viên nhóm của bài chung}
```

`canDownload` = `canViewSubmission` và vai trò ∈ {ADMIN, LECTURER, STUDENT}.

## 4. Máy trạng thái

### 4.1. Tài khoản `users.status`

```
PENDING ──duyệt──► ACTIVE ◄──mở khóa── LOCKED
   │                 │ └──khóa──────────►┘
   └──từ chối──► REJECTED     ACTIVE ──vô hiệu (PH hết con)──► DISABLED
```
Chỉ DN đi qua `PENDING`/`REJECTED`. Khóa tạm do sai mật khẩu dùng `locked_until`, không đổi `status`.

### 4.2. Bài tập `assignments.status`

```
DRAFT ──GV giao ngay / tới open_at (auto_open)──► OPEN ──GV đóng / quá hạn cuối──► CLOSED
                                                    ▲                              │
                                                    └──── GV mở lại (gia hạn) ─────┘
```
Hạn cuối = `late_due_at` nếu `allow_late`, ngược lại là `due_at`. Bài `DRAFT` chưa hiện với SV; *Lưu nháp* đặt `auto_open = false`, *hẹn giờ* đặt `auto_open = true`.

Trên trang bài tập của GV **không có** các trạng thái theo dõi tiến độ (lập nhóm, duyệt đề tài, đang chấm…). Trang gồm các tab cố định: *Thông tin* · *Nhóm* (bài `GROUP`) · *Bài đã nộp* · *Điểm*.

### 4.3. Bài nộp `submissions.status`

```
(không có bản ghi) = CHƯA NỘP
        │ nộp (trước due_at → SUBMITTED, sau due_at trong hạn muộn → LATE)
        ▼
   SUBMITTED / LATE ──nộp lại (đến hạn cuối)──► SUBMITTED / LATE
        │ xóa hết tệp và không còn link
        ▼
     (xóa bản ghi → CHƯA NỘP)
```
Không có trạng thái chấm (`GRADED`, `RETURNED`). `sync_status` của bài nộp tổng hợp từ các tệp: `PENDING` (còn tệp chưa lên Drive) · `SYNCED` · `ERROR` (có tệp `FAILED`/`MISSING`).

### 4.4. Tệp `submission_files.sync_status`

```
PENDING ──hàng đợi nhận──► UPLOADING ──ok──► SYNCED ──phát hiện mất──► MISSING
                               │lỗi
                               ▼
                            FAILED ──Bộ hẹn giờ/GV thử lại──► PENDING
```

### 4.5. Lần tải lên Excel `import_jobs.status`

`PREVIEW (đã kiểm tra, chờ GV áp dụng) → COMPLETED | CANCELLED (GV hủy / tải file khác) | FAILED (lỗi file)`. Dùng chung cho danh sách nhóm, điểm bài tập, điểm học phần, import SV.

Phản hồi nhóm `group_reports.status`: `OPEN → RESOLVED`.

### 4.6. Yêu cầu xem bài `view_requests.status`

```
PENDING ──Admin duyệt──► APPROVED ──hết hạn──► EXPIRED
   │                         └──Admin thu hồi──► REVOKED
   ├──Admin từ chối──► REJECTED
   └──DN hủy──► CANCELLED
```

### 4.7. Yêu cầu sửa điểm `grade_change_requests.status`

`PENDING → APPROVED (áp dụng điểm mới) | REJECTED | CANCELLED (GV hủy)`

## 5. Danh mục thông báo

Cột **Khẩn**: ✔ = luôn gửi email ngay, kể cả khi người nhận bật bản tin tổng hợp; các loại còn lại được gộp vào bản tin (mặc định 20:00) nếu bật.

| Mã `type` | Sự kiện | Người nhận | Email | Khẩn |
|---|---|---|---|---|
| `ASSIGNMENT_OPENED` | Bài tập được mở | SV trong LHP | ✔ | – |
| `ASSIGNMENT_UPDATED` | GV gia hạn / sửa đề bài | SV trong LHP | ✔ | – |
| `DEADLINE_REMINDER` | Sắp hết hạn, chưa nộp | SV / thành viên nhóm chưa nộp | ✔ | – |
| `GROUP_ASSIGNED` | Được xếp vào nhóm / đổi nhóm (GV tải danh sách) | SV liên quan | ✔ | – |
| `GROUP_REMOVED` | Bị gỡ khỏi nhóm khi GV tải lại danh sách | SV liên quan | ✔ | – |
| `GROUP_REPORTED` | SV báo nhóm chưa đúng | GV phụ trách | – | – |
| `GROUP_REPORT_RESOLVED` | GV đã xử lý phản hồi nhóm | SV gửi phản hồi | – | – |
| `TOPIC_UPDATED` | Thành viên nhập/sửa đề tài | Thành viên khác của nhóm | – | – |
| `SUBMISSION_UPDATED` | Thành viên nộp/nộp lại/xóa tệp bài chung | Thành viên khác | – | – |
| `SUBMISSION_SYNC_FAILED` | Tệp lỗi sau khi hết số lần thử | GV phụ trách (+ SV nộp) | ✔ (GV) | – |
| `DRIVE_FOLDER_PROBLEM` | Mất quyền / chưa liên kết / thư mục bị xóa / hết dung lượng | GV | ✔ | ✔ |
| `ASSIGNMENT_GRADES_PUBLISHED` | GV công bố điểm bài tập | SV của bài tập (+ PH) | ✔ | – |
| `ASSIGNMENT_GRADE_UPDATED` | Điểm bài tập đã công bố bị thay đổi | SV liên quan | ✔ | – |
| `GRADES_PUBLISHED` | Công bố điểm học phần | SV trong LHP + PH | ✔ | – |
| `GRADE_CHANGE_REQUESTED` | GV gửi yêu cầu sửa điểm | Admin | – | – |
| `GRADE_CHANGE_PROCESSED` | Admin duyệt/từ chối | GV (+ SV nếu duyệt) | ✔ | – |
| `ACADEMIC_WARNING` | Điểm < 4 / GPA thấp / GPA giảm | PH của SV (+ SV) | ✔ | – |
| `ENTERPRISE_REGISTERED` | DN mới đăng ký | Admin | – | – |
| `ENTERPRISE_REVIEWED` | DN được duyệt/từ chối | DN | ✔ | ✔ |
| `VIEW_REQUEST_CREATED` | DN gửi yêu cầu | Admin | – | – |
| `VIEW_REQUEST_PROCESSED` | Duyệt/từ chối/thu hồi | DN; SV (khi duyệt) | ✔ | ✔ |
| `VIEW_REQUEST_EXPIRING` | Còn 2 ngày | DN | ✔ | – |
| `VIEW_REQUEST_EXPIRED` | Hết hạn | DN | – | – |
| `NOTIFICATION_DIGEST` | Bản tin tổng hợp hằng ngày | Người bật bản tin | ✔ | – |

## 6. Đặc tả use case

### UC01 – Xác thực & Quản lý tài khoản

#### UC01.1 Đăng nhập
- **Tác nhân:** Người dùng · **TĐK:** chưa đăng nhập.
- **Luồng chính:**
  1. Người dùng chọn tab "Tài khoản" (Admin/GV/SV/DN) và nhập tên đăng nhập + mật khẩu.
  2. Hệ thống tìm `users` theo `username` (không phân biệt hoa thường), so khớp Argon2.
  3. Đúng: reset `failed_login_count`, cấp access + refresh token (cookie), cập nhật `last_login_at`, ghi log `LOGIN`.
  4. Điều hướng theo §2.
- **Ngoại lệ:**
  - E1 Sai thông tin: tăng `failed_login_count`; lần thứ 5 thì đặt `locked_until = now + 15'` → `AUTH_INVALID_CREDENTIALS` (không nói sai tên hay sai mật khẩu).
  - E2 Đang bị khóa tạm → `AUTH_TEMP_LOCKED` kèm số phút còn lại.
  - E3 `status` = `LOCKED`/`DISABLED` → `AUTH_ACCOUNT_LOCKED`; `PENDING` → `AUTH_PENDING_APPROVAL`; `REJECTED` → `AUTH_REJECTED` kèm lý do.
  - E4 `must_change_password = true` → mở UC01.4.
- **HĐK:** có phiên hợp lệ.

#### UC01.2 Đăng nhập bằng SĐT (PH)
- Kế thừa UC01.1, khác ở chỗ: tab "Phụ huynh", ô nhập SĐT (kiểm tra BR-01), chỉ chấp nhận tài khoản `role = PARENT`.
- Sau bước 3: đếm số con liên kết `ACTIVE`. 0 con → `PARENT_NO_CHILD` (tài khoản bị vô hiệu); 1 con → tự chọn; > 1 con → UC01.3.

#### UC01.3 Chọn con cần xem
- **Luồng:** hiển thị thẻ từng con (họ tên, MSSV, lớp, ngành) → PH chọn → lưu `selectedStudentId` vào phiên (claim trong access token, đổi bằng `POST /auth/parent/select-child`).
- Header luôn có menu đổi con. Server kiểm tra con được chọn có thuộc `parent_students` của PH không.

#### UC01.4 Đổi mật khẩu lần đầu
- **TĐK:** `must_change_password = true`.
- **Luồng:** nhập mật khẩu mới + xác nhận → kiểm tra chính sách (≥ 8 ký tự, có chữ và số, khác mật khẩu cũ, khác tên đăng nhập) → lưu, đặt `must_change_password = false` → tiếp tục điều hướng §2.
- Khi cờ còn bật, mọi API khác trả `AUTH_MUST_CHANGE_PASSWORD` (403).

#### UC01.5 Quên mật khẩu
- **Luồng:** nhập tên đăng nhập hoặc email → nếu tài khoản có email, tạo token ngẫu nhiên 32 byte (lưu hash, hạn 30'), gửi link `/reset-password?token=...` → người dùng đặt mật khẩu mới → token bị đánh dấu đã dùng, thu hồi mọi refresh token.
- Luôn trả cùng một thông điệp "Nếu tài khoản tồn tại, email đã được gửi" để không lộ tài khoản.
- E1 PH không có email: thông điệp hướng dẫn liên hệ Admin (UC02.4).
- Rate limit: 3 yêu cầu/giờ/tài khoản.

#### UC01.6 Đổi mật khẩu
- Nhập mật khẩu cũ, mới, xác nhận → đúng mật khẩu cũ thì lưu, thu hồi mọi refresh token khác phiên hiện tại, ghi log.

#### UC01.7 Đăng xuất
- Thu hồi refresh token hiện tại, xóa cookie, ngắt socket.

#### UC01.8 Đăng ký tài khoản doanh nghiệp
- **Tác nhân:** Khách.
- **Luồng:** nhập tên DN, mã số thuế (10 hoặc 13 số), email (làm tên đăng nhập), mật khẩu, người liên hệ, SĐT, lĩnh vực (danh mục), website, địa chỉ; tick đồng ý điều khoản → tạo `users(role=ENTERPRISE, status=PENDING)` + `enterprises` → thông báo `ENTERPRISE_REGISTERED` cho Admin → màn hình "Đang chờ duyệt".
- **Ngoại lệ:** email hoặc mã số thuế đã tồn tại → `ENTERPRISE_DUPLICATE`. Có CAPTCHA đơn giản (Cloudflare Turnstile) và rate limit 5 lần/giờ/IP.

---

### UC02 – Quản trị hệ thống

#### UC02.1 Quản lý tài khoản giảng viên
- Danh sách lọc theo khoa, trạng thái, từ khóa. Thêm: mã GV, họ tên, khoa, email, SĐT → tạo user `username = mã GV`, mật khẩu tạm = mã GV, `must_change_password = true`.
- Sửa thông tin; khóa/mở khóa (khóa thì thu hồi mọi phiên); đặt lại mật khẩu (mật khẩu tạm mới, bật cờ đổi). Không xóa GV đang phụ trách LHP, chỉ khóa được. Mọi thao tác ghi log.

#### UC02.2 Quản lý tài khoản sinh viên
- Như UC02.1 với các trường: MSSV, họ tên, ngày sinh, giới tính, lớp sinh hoạt (suy ra ngành, khóa). Mật khẩu tạm = ngày sinh `ddmmyyyy`.
- Admin có thể sửa hộ hồ sơ (SĐT, email); sửa SĐT PH thì chạy UC03.3.

#### UC02.3 Import sinh viên từ Excel
1. Admin tải file mẫu `.xlsx` (cột: MSSV, Họ tên, Ngày sinh, Giới tính, Mã lớp SH, Email).
2. Upload → server đọc bằng ExcelJS, kiểm tra từng dòng (bắt buộc, định dạng, MSSV trùng trong file/CSDL, lớp tồn tại).
3. Màn hình xem trước: số dòng hợp lệ / lỗi, lỗi theo từng ô.
4. Admin bấm "Nhập" → ghi các dòng hợp lệ trong một transaction → lưu `import_jobs` → cho tải file kết quả có cột "Lỗi".
- Giới hạn 5.000 dòng/file.

#### UC02.4 Quản lý tài khoản phụ huynh
- Danh sách PH: SĐT, họ tên (nếu có), các con liên kết (quan hệ), trạng thái, lần đăng nhập cuối. Khóa/mở khóa, đặt lại mật khẩu (mật khẩu tạm = SĐT, bật cờ đổi).

#### UC02.5 Xử lý đổi SĐT phụ huynh
- **Tình huống:** PH đổi số và báo nhà trường.
- **Luồng:** Admin chọn tài khoản PH → nhập SĐT mới → hệ thống kiểm tra BR-01:
  - SĐT mới chưa có tài khoản: cập nhật `parents.phone`, `users.username`; cập nhật trường SĐT tương ứng (bố/mẹ/giám hộ) trong hồ sơ mọi SV liên kết.
  - SĐT mới đã thuộc PH khác: hỏi xác nhận **gộp**: chuyển mọi liên kết sang tài khoản đích, vô hiệu tài khoản cũ.
- Thu hồi phiên của PH, ghi log `PARENT_PHONE_CHANGED` với dữ liệu cũ/mới, thông báo cho các SV liên kết.

#### UC02.6 Quản lý danh mục
- CRUD: khoa, ngành (thuộc khoa), khóa (K65…), lớp sinh hoạt (ngành + khóa), phòng học (mã, sức chứa), lĩnh vực DN.
- Từ khóa đề tài: danh sách kèm số đề tài dùng; **gộp** A vào B (cập nhật `topic_tags`, đặt `tags.merged_into_id`); **ẩn** (không gợi ý, không hiển thị cho DN).
- Không xóa mục đang được tham chiếu (`CATALOG_IN_USE`), chỉ ẩn được.

#### UC02.7 Duyệt và quản lý tài khoản doanh nghiệp
- Tab "Chờ duyệt" / "Đã duyệt" / "Từ chối" / "Bị khóa". Xem chi tiết DN.
- Duyệt → `ACTIVE`, `approved_by/at`; từ chối → `REJECTED` + lý do bắt buộc; khóa DN đang hoạt động → thu hồi phiên và **thu hồi mọi quyền xem bài còn hiệu lực**. Gửi `ENTERPRISE_REVIEWED`.

#### UC02.8 Quản lý học kỳ, môn học
- Học kỳ: năm học (`2026-2027`), kỳ (1, 2, hè), ngày bắt đầu/kết thúc (không chồng lấn học kỳ khác); đánh dấu đúng một kỳ hiện tại.
- Môn học: mã, tên, tín chỉ (1–10), loại môn, khoa; trọng số chuyên cần/bài tập/giữa kỳ/cuối kỳ (tổng = 100). Sửa trọng số khi đã có LHP công bố điểm → chặn.

#### UC02.9 Quản lý lớp học phần
- Thêm/sửa: mã LHP (duy nhất), môn, học kỳ, GV, sĩ số tối đa, danh sách buổi học `{thứ, tiết bắt đầu, tiết kết thúc, phòng}`.
- Khi lưu: **include UC02.11**. Xóa LHP chỉ khi chưa có bài tập và chưa có SV.

#### UC02.10 Xếp sinh viên vào lớp học phần
- Cách 1: tìm và chọn SV (lọc theo lớp SH, ngành, khóa). Cách 2: upload Excel danh sách MSSV.
- Kiểm tra từng SV: tồn tại, chưa có trong LHP, LHP còn chỗ, **trùng lịch với LHP khác SV đang học cùng kỳ** (cảnh báo, Admin vẫn có thể xác nhận).
- Gỡ SV khỏi LHP: chặn khi SV đã có bài nộp hoặc điểm.

#### UC02.11 Kiểm tra trùng lịch
- **Đầu vào:** LHP (học kỳ, GV, các buổi học).
- **Quy tắc:** hai buổi xung đột khi cùng học kỳ, cùng `day_of_week` và `[period_start, period_end]` giao nhau, và (cùng GV **hoặc** cùng phòng).
- **Đầu ra:** danh sách xung đột `{lhp, thứ, tiết, lý do: GV|PHÒNG}` → chặn lưu (`SCHEDULE_CONFLICT`). Với SV (UC02.10): xung đột lịch SV chỉ cảnh báo.
- Truy vấn mẫu ở [DatabaseDesign §6](DatabaseDesign.md#6-truy-vấn-mẫu).

#### UC02.12 Xem nhật ký hệ thống
- Bảng log lọc theo người thực hiện, hành động, loại đối tượng, mã đối tượng, khoảng thời gian; xem chi tiết dữ liệu cũ/mới dạng diff JSON. Chỉ đọc, phân trang con trỏ.

#### UC02.13 Cấu hình hệ thống
- Form theo nhóm, lưu vào `system_settings`:

| Khóa | Mặc định |
|---|---|
| `upload.image.maxSizeMB` / `maxCount` / `mimeTypes` | 10 / 30 / jpg, png, webp |
| `upload.video.maxSizeMB` / `mimeTypes` | 500 / mp4, webm, mov |
| `upload.source.maxSizeMB` / `mimeTypes` | 100 / zip, rar, 7z |
| `upload.report.maxSizeMB` / `maxCount` / `mimeTypes` | 20 / 3 / pdf, doc, docx |
| `import.maxRows` / `maxSizeMB` | 2000 / 5 |
| `viewRequest.minDays` / `maxDays` | 14 / 28 |
| `warning.lowScore` / `lowGpa` / `gpaDrop` | 4.0 / 2.0 / 0.5 |
| `lecturer.searchScope` | `OWN_SECTIONS` |
| `reminder.hoursBefore` | 24 |

- Thay đổi ghi log; cache Redis bị xóa khi lưu.

---

### UC03 – Quản lý hồ sơ sinh viên

#### UC03.1 Khai báo hồ sơ
- **TĐK:** SV đăng nhập, `profile_completed_at IS NULL`.
- **Luồng:**
  1. Hiển thị đoạn thông báo mục đích thu thập dữ liệu (NĐ 13/2023).
  2. SV nhập SĐT bản thân*, email*, SĐT bố, SĐT mẹ, SĐT người giám hộ (≥ 1 số, hoặc tick "Không có" + lý do), công tắc UC03.4, thông tin tùy chọn.
  3. Kiểm tra BR-01; email/SĐT không trùng SV khác.
  4. Lưu hồ sơ trong transaction cùng **UC03.3**; đặt `profile_completed_at = now`.
- **HĐK:** SV dùng được mọi chức năng; tài khoản PH được tạo hoặc liên kết.

#### UC03.2 Cập nhật hồ sơ
- Như UC03.1 nhưng đã có dữ liệu. Có thay đổi SĐT PH thì hiện xác nhận "Tài khoản phụ huynh cũ sẽ bị gỡ liên kết" → **UC03.3**. Ghi log thay đổi SĐT.

#### UC03.3 Đồng bộ với tài khoản phụ huynh theo SĐT
- **Đầu vào:** tập SĐT cũ `{rel→phone}` và mới.
- Với mỗi quan hệ (FATHER/MOTHER/GUARDIAN):
  - Số **bị bỏ hoặc đổi**: xóa dòng `parent_students(parent_old, student, rel)`; nếu `parent_old` không còn dòng nào thì `users.status = DISABLED`.
  - Số **mới**: tìm `parents.phone`; chưa có thì tạo `users(username=phone, role=PARENT, password=hash(phone), must_change_password=true)` + `parents`; tài khoản đang `DISABLED` thì kích hoạt lại; thêm `parent_students`.
- Cả hai cha mẹ khai cùng một SĐT thì tạo một tài khoản với hai dòng quan hệ.
- Chạy trong cùng transaction với hồ sơ, ghi log `PARENT_LINK_SYNC`.

#### UC03.4 Bật/tắt cho DN tìm thấy hồ sơ
- Công tắc `students.discoverable`. Tắt thì SV biến mất khỏi kết quả UC09.1 ngay lập tức. **Quyền xem bài đã cấp vẫn còn đến hết hạn** (thông báo rõ cho SV). Ghi log.

---

### UC04 – Quản lý bài tập

#### UC04.1 Liên kết tài khoản Google Drive
- **Tác nhân:** GV, Google Drive. Trang *Kết nối Google Drive* (mẫu `GV_GoogleLink`).
- **Cách 1 – OAuth của GV (mặc định):**
  1. GV bấm **Liên kết tài khoản Google** → `GET /lecturer/drive/oauth/start` trả URL đồng ý của Google (scope `https://www.googleapis.com/auth/drive.file` + `userinfo.email`, `access_type=offline`, `prompt=consent`, `state` ngẫu nhiên hạn 10 phút).
  2. GV chọn tài khoản Google, đồng ý → Google chuyển về `GET /lecturer/drive/oauth/callback?code&state`.
  3. Hệ thống kiểm tra `state`, đổi `code` lấy refresh token, lấy email tài khoản, mã hóa token (AES-256-GCM) và lưu `lecturer_drive_links(auth_mode=OAUTH, google_email, refresh_token_enc, linked_at)`.
  4. Lần đầu liên kết: tạo thư mục gốc `EduPortfolio_<MãGV>` trong My Drive của GV, lưu `root_folder_id`. Liên kết lại cùng tài khoản thì giữ thư mục cũ.
  5. Quay về trang, hiện email, trạng thái *Đang hoạt động*, dung lượng Drive (`about.get storageQuota`), bảng *Thư mục nhận bài của các bài tập*.
- **Kiểm tra lại:** ghi thử vào thư mục gốc (UC04.4) → cập nhật `status`.
- **Hủy liên kết:** thu hồi token với Google, xóa liên kết; bài tập đang mở không ghi được Drive cho tới khi liên kết lại (tệp vẫn giữ tạm trên server, NFR-13).
- **Cách 2 – Service Account (khi có Shared Drive):** trang hiển thị email SA + hướng dẫn: tạo thư mục trong Shared Drive → thêm SA quyền *Người chỉnh sửa* → dán link thư mục khi giao bài. GV chưa liên kết OAuth thì mọi thao tác Drive dùng SA.
- **Ngoại lệ:** GV từ chối quyền → `?error=Bạn đã từ chối cấp quyền`; máy chủ chưa cấu hình OAuth → nút bị khóa kèm hướng dẫn; Google không trả refresh token → yêu cầu liên kết lại.
- **Lưu ý `drive.file`:** ứng dụng chỉ thấy thư mục/tệp do chính nó tạo, nên ở chế độ OAuth thư mục nhận bài phải là thư mục do EduPortfolio tạo (mặc định là thư mục gốc).

#### UC04.2 Giao bài tập
- **TĐK:** GV phụ trách LHP; LHP thuộc học kỳ chưa kết thúc; GV đã liên kết Drive (hoặc có Service Account).
- **Luồng:**
  1. GV nhập: tiêu đề*, mô tả, tệp đề bài (tùy chọn, ≤ 20 MB), ngày mở*, hạn nộp*, **hình thức*** (`INDIVIDUAL` / `GROUP`), *có phần cá nhân* (chỉ khi `GROUP`), loại sản phẩm (gợi ý theo loại môn), nộp muộn (bật/tắt, số ngày), trọng số trong cột điểm bài tập (%), đề tài gợi ý (tùy chọn), thư mục nhận bài (mặc định thư mục gốc đã liên kết).
  2. Kiểm tra BR-04.
  3. **Include UC04.4** trên thư mục cha.
  4. **Include UC04.3**: tạo thư mục `<MaLHP>_<TenBaiTap>`, lưu `drive_folder_id`.
  5. Lưu `assignments` (`OPEN` nếu `open_at ≤ now`, ngược lại `DRAFT` + `auto_open`); *Lưu nháp* thì `DRAFT` không tự mở.
  6. Khi chuyển sang `OPEN`: thông báo `ASSIGNMENT_OPENED` cho SV trong LHP.
  7. Tệp đề bài (nếu có) lưu trên server và chép một bản vào thư mục bài tập trên Drive (chạy nền).
- **Sau khi giao bài `GROUP`:** trang bài tập nhắc GV tải danh sách nhóm (UC05.2); SV chỉ thấy "Chưa được xếp nhóm" cho tới khi GV tải lên.
- **Ngoại lệ:** Drive lỗi → không lưu, hiện hướng dẫn; tạo thư mục thành công nhưng ghi CSDL lỗi → đưa thư mục vừa tạo vào thùng rác (bù trừ).
- **Hai lối vào:** (a) từ trang một LHP (*Lớp học phần → Môn → Tạo bài tập*): LHP cố định; (b) từ menu *Tạo bài tập*: chạy **UC04.8**.

#### UC04.8 Giao bài tập cho nhiều lớp học phần
- **Extend** UC04.2. **TĐK:** GV dạy ít nhất một LHP trong kỳ chưa kết thúc.
- **Luồng:** GV chọn một hoặc nhiều LHP mình dạy (tìm theo mã/tên môn, *Chọn tất cả lớp cùng môn*) → nhập thông tin chung → bảng *Hạn nộp riêng* cho từng LHP (mặc định giống nhau) → `POST /lecturer/assignments/batch` → với mỗi LHP: kiểm tra BR-04, BR-24 → include UC04.4, UC04.3 → tạo `assignments` cùng `batch_id`.
- Lỗi ở một LHP không làm hỏng LHP khác; trả kết quả từng LHP. Mỗi bài tập sau đó độc lập (danh sách nhóm và điểm tải riêng cho từng LHP).

#### UC04.3 Tạo thư mục trên Drive
- `files.create(mimeType=folder, parents=[parentId], supportsAllDrives=true)`, tên đã làm sạch (bỏ `/\:*?"<>|`, ≤ 100 ký tự, khoảng trắng → `_`).
- Cấu trúc tạo dần:
```
<Thư mục nhận bài>/                         (mặc định EduPortfolio_<MãGV>)
└── <MaLHP>_<TenBaiTap>/                    ← UC04.2
    ├── De_bai_<tên tệp>                    ← tệp đề bài (nếu có)
    ├── Nhom01_<TenNhom>/                   ← khi nhóm có bài nộp đầu tiên
    │   ├── Bai_chung/
    │   └── <MSSV>_<HoTen>/                 ← phần cá nhân trong nhóm
    └── CaNhan_<MSSV>_<HoTen>/              ← bài cá nhân, lần nộp đầu
```
- Thư mục nhóm/cá nhân tạo **lười** khi có tệp đầu tiên cần ghi (idempotent: kiểm tra `folder_id` trong CSDL, khóa theo khóa thư mục để hai tệp không tạo trùng).

#### UC04.4 Kiểm tra quyền ghi thư mục trên Drive
1. `files.get(folderId, fields=id,name,mimeType,driveId,trashed,capabilities, supportsAllDrives=true)` bằng client của GV (OAuth) hoặc SA.
2. Kiểm tra: tồn tại, không ở thùng rác, `mimeType = folder`, `capabilities.canAddChildren = true`.
3. **Ghi thử**: tạo tệp `.eduportfolio_check.txt` (1 byte) rồi xóa ngay.

| Lỗi Google | Mã lỗi hệ thống | Hướng dẫn hiển thị |
|---|---|---|
| Chưa liên kết / token bị thu hồi | `DRIVE_NOT_LINKED` | Vào *Kết nối Google Drive* để liên kết |
| 404 / không thấy | `DRIVE_FOLDER_NOT_FOUND` | Link sai, chưa chia sẻ cho SA, hoặc (OAuth) thư mục không do EduPortfolio tạo |
| `mimeType` không phải folder | `DRIVE_NOT_A_FOLDER` | Hãy dán link thư mục, không phải tệp |
| `canAddChildren=false` / 403 | `DRIVE_NO_WRITE_PERMISSION` | Thêm quyền *Người chỉnh sửa* / liên kết lại |
| `storageQuotaExceeded` (SA ghi vào My Drive) | `DRIVE_NOT_SHARED_DRIVE` | Chuyển thư mục sang Shared Drive hoặc dùng OAuth |
| Hết dung lượng | `DRIVE_QUOTA_EXCEEDED` | Giải phóng dung lượng Drive |

#### UC04.5 Sửa / Đóng bài tập
- Sửa: tiêu đề, mô tả, tệp đề bài, hạn nộp (gia hạn hay rút ngắn đều phải ≥ now), nộp muộn, loại sản phẩm (không bỏ được loại đã có tệp nộp), trọng số, đề tài gợi ý, có phần cá nhân (không tắt được khi đã có bài cá nhân). Không đổi được hình thức khi đã có nhóm hoặc bài nộp.
- **Đóng**: `status = CLOSED`, không nhận bài. **Mở lại**: đặt hạn nộp mới > now.
- **Giao ngay** bài đang `DRAFT`/hẹn giờ: `status = OPEN`, `open_at = now`.
- **Hủy giao bài**: khi chưa có nhóm và bài nộp → xóa (UC04.7); đã có dữ liệu thì chỉ *Đóng* được.
- Extend: UC04.6. Ghi log và lịch sử thay đổi (hiển thị ở khối *Lịch sử thay đổi*).

#### UC04.6 Đổi thư mục nhận bài
- GV dán link thư mục cha mới → **include UC04.4**.
  - Chưa có bài nộp: chuyển thư mục bài tập (trống) sang thư mục mới.
  - Đã có bài nộp: GV chọn *Di chuyển toàn bộ thư mục nhóm/cá nhân sang thư mục mới* (khuyến nghị, `files.update addParents/removeParents`) hoặc *Chỉ lưu bài nộp mới vào thư mục mới* (tạo thư mục bài tập mới, xóa `folder_id` nhóm/cá nhân trong CSDL để tạo lại).
- Báo GV khi xong hoặc lỗi.

#### UC04.7 Xóa bài tập
- **TĐK:** chưa có bài nộp và chưa có nhóm. Xác nhận → xóa mềm (`deleted_at`); thư mục Drive đưa vào thùng rác. Có dữ liệu → `ASSIGNMENT_HAS_SUBMISSIONS`, gợi ý "Đóng bài tập".

#### UC04.9 Nhận bài tập (SV)
- **Trang *Bài tập của tôi*:** danh sách LHP kỳ hiện tại (mã, môn, GV, lịch học, số bài đã nộp) và bảng mọi bài tập: tiêu đề, LHP, hình thức (cá nhân / tên nhóm), hạn nộp (đếm ngược), trạng thái của SV (*Chưa xếp nhóm / Chưa nhập đề tài / Chưa nộp / Đã nộp / Nộp muộn / Quá hạn – chưa nộp / Có điểm*), điểm nếu đã công bố. Lọc: tất cả / đang mở / sắp hạn / đã nộp / quá hạn.
- **Trang bài tập** (4 bước):
  1. **Đề bài & nhóm** — mô tả, tệp đề bài (tải), sản phẩm cần nộp, hạn nộp, đề tài gợi ý; khối *Nhóm của tôi* (UC05.5).
  2. **Đề tài** — UC05.7.
  3. **Nộp bài** — UC06.1/06.2, lịch sử nộp.
  4. **Kết quả** — điểm + nhận xét khi GV đã công bố điểm bài tập.
- Trang môn học của SV (*SV_Course*): bài tập của môn, nhóm của tôi trong môn, thông tin môn, cơ cấu điểm, tài liệu (tệp đề bài).

---

### UC05 – Quản lý nhóm & đề tài

#### UC05.1 Tải file mẫu danh sách nhóm
- **TĐK:** bài tập `GROUP`, GV phụ trách.
- `GET /lecturer/assignments/:id/groups/template` → `.xlsx` (ExcelJS) gồm sheet *Nhom*: cột **MSSV**, **Họ tên** (điền sẵn mọi SV của LHP, sắp theo MSSV, khóa không sửa), **Mã nhóm**, **Tên nhóm**, **Trưởng nhóm** (đánh `x`). Đã có nhóm thì điền sẵn nhóm hiện tại để GV sửa. Sheet *HuongDan* mô tả quy tắc.

#### UC05.2 Tải lên danh sách nhóm
1. GV chọn file → `POST /lecturer/assignments/:id/groups/import/preview` (multipart) → **include UC05.3** → lưu `import_jobs(type=ASSIGNMENT_GROUPS, status=PREVIEW)`.
2. Màn hình xem trước: tổng số nhóm, số SV có nhóm / chưa có nhóm; bảng từng nhóm (mã, tên, trưởng nhóm, thành viên) với nhãn *Mới / Sửa / Giữ nguyên / Xóa*; danh sách SV bị chuyển nhóm; lỗi theo dòng (ô bị lỗi tô đỏ).
3. GV bấm **Áp dụng** → `POST .../groups/import/:jobId/commit` → transaction:
   - tạo nhóm mới (`seq` tăng dần, `code`, `name`), sửa tên/trưởng nhóm nhóm cũ (khớp theo `code`);
   - thay `group_members` theo file; SV không có mã nhóm → không thuộc nhóm nào;
   - xóa nhóm không còn trong file (chỉ khi nhóm đó chưa có bài chung và đề tài);
   - `import_jobs.status = COMPLETED`, ghi log.
4. Sau commit: thông báo `GROUP_ASSIGNED` cho SV được xếp vào nhóm hoặc đổi nhóm; SV bị gỡ khỏi nhóm nhận `GROUP_REMOVED`.
- **Ngoại lệ:** file sai mẫu → `IMPORT_INVALID_FILE`; có lỗi dòng → chỉ cho *Áp dụng phần hợp lệ* hoặc tải file khác; nhóm đã có bài chung bị bỏ khỏi file → lỗi dòng `GROUP_HAS_SUBMISSION`.

#### UC05.3 Kiểm tra & xem trước danh sách nhóm
| Kiểm tra | Mức |
|---|---|
| Đủ các cột bắt buộc; ≤ 2.000 dòng; ≤ 5 MB | Lỗi file |
| MSSV tồn tại và thuộc LHP | Lỗi dòng |
| MSSV không lặp trong file | Lỗi dòng |
| Có *Tên nhóm* thì phải có *Mã nhóm* (≤ 20 ký tự); các dòng cùng mã nhóm phải cùng tên | Lỗi dòng |
| Mỗi nhóm tối đa 1 trưởng nhóm | Lỗi nhóm |
| Nhóm đã có bài chung / đề tài thì không được xóa | Lỗi nhóm |
| SV chuyển khỏi nhóm đã nộp bài chung (bài chung ở lại nhóm cũ, phần cá nhân đi theo SV) | Cảnh báo |
| SV của LHP không có trong file / để trống mã nhóm | Cảnh báo (*Chưa có nhóm*) |

#### UC05.4 Xem danh sách nhóm & đề tài (GV)
- Tab *Nhóm* trên trang bài tập: mã/tên nhóm, trưởng nhóm, thành viên, đề tài, từ khóa, bài chung (đã nộp lúc …/chưa), nút *Mở trên Google Drive*. Danh sách SV chưa có nhóm. Nút *Tải file mẫu*, *Tải lên danh sách nhóm*, *Xuất Excel*, lịch sử các lần tải lên.
- Khối *Phản hồi nhóm chưa đúng* (UC05.6): SV, nội dung, thời gian, nút *Đã xử lý* (kèm ghi chú).
- Bài `INDIVIDUAL`: tab *Đề tài* liệt kê SV – đề tài – từ khóa.

#### UC05.5 Xem nhóm của mình (SV)
- Khối *Nhóm của tôi* trên trang bài tập: mã/tên nhóm, trưởng nhóm, thành viên (họ tên, MSSV), đề tài hiện tại. Bài `GROUP` chưa được xếp nhóm → "Bạn chưa được xếp nhóm. Liên hệ giảng viên" + nút *Báo nhóm chưa đúng*; các bước Đề tài và Nộp bài bị khóa (`GROUP_NOT_ASSIGNED`).
- Trang môn học có bảng *Nhóm của tôi trong môn* (mỗi bài tập nhóm một dòng).

#### UC05.6 Báo nhóm chưa đúng
- **Extend** UC05.5. SV nhập nội dung (10–500 ký tự, VD "Em ở nhóm 03 chứ không phải nhóm 02") → `group_reports(OPEN)` → thông báo `GROUP_REPORTED` cho GV. Mỗi SV có tối đa 1 phản hồi `OPEN` cho 1 bài tập.
- GV đánh dấu *Đã xử lý* (ghi chú tùy chọn) → `RESOLVED`, thông báo `GROUP_REPORT_RESOLVED` cho SV.

#### UC05.7 Nhập đề tài
- **Tác nhân:** bất kỳ thành viên nhóm / SV làm cá nhân. **TĐK:** bài `OPEN`, chưa quá hạn cuối, SV thuộc LHP, (bài `GROUP`) đã có nhóm.
- **Luồng:**
  1. Nhập **tên đề tài** (5–200 ký tự); có thể bấm chọn một *đề tài gợi ý* của GV.
  2. Gõ tên → `GET /topics/similar?assignmentId&title` → cảnh báo nếu `similarity(normalize(title)) ≥ 0.6` với đề tài khác trong cùng LHP (không chặn).
  3. **Include UC05.8.**
  4. Lưu `topics` (tạo hoặc sửa), ghi `topic_histories` (cũ/mới, người sửa); thông báo `TOPIC_UPDATED` cho các thành viên khác của nhóm.
- Sau hạn cuối: SV không sửa được; GV sửa được.

#### UC05.8 Gắn từ khóa đề tài
- Ô tag có autocomplete (`GET /tags?q=` trả 10 tag gần nhất theo trigram, bỏ tag ẩn; tag đã gộp thì trả tag đích).
- Chuẩn hóa: trim, gộp khoảng trắng, `normalized = lower(unaccent(name))`. Trùng `normalized` thì dùng tag có sẵn; chưa có thì tạo mới.
- 1–5 tag, mỗi tag ≤ 50 ký tự.

---

### UC06 – Nộp bài, xem & tìm kiếm bài nộp

#### UC06.1 Nộp bài nhóm / UC06.2 Nộp bài cá nhân
- **TĐK:** (bài `GROUP`) SV thuộc nhóm hoặc (bài `INDIVIDUAL`) SV thuộc LHP; đã có đề tài; hồ sơ đã hoàn thiện; bài tập `OPEN`; `now ≤ due_at` (hoặc `≤ late_due_at` nếu cho nộp muộn).
- **Luồng:**
  1. Màn hình nộp: tab **Bài chung của nhóm** / **Bài cá nhân** (bài nhóm có `has_individual_part`; không bật thì chỉ có Bài chung), hoặc chỉ một khu vực (bài cá nhân). Hiển thị các ô theo loại sản phẩm đã cấu hình (ảnh, video, mã nguồn ZIP hoặc link Git, báo cáo, link Figma, ghi chú; phần cá nhân có thêm *mức đóng góp tự đánh giá %*).
  2. SV kéo thả tệp → client kiểm tra sơ bộ (đuôi, dung lượng, số lượng) → upload có tiến trình, hủy được.
  3. SV bấm **Nộp bài**.
  4. Server:
     - kiểm tra quyền và TĐK; kiểm tra magic bytes, dung lượng, số lượng (BR-13); kiểm tra domain link;
     - transaction có khóa theo chủ bài (`pg_advisory_xact_lock`): chưa có bài thì tạo, có rồi thì **UC06.4**; chuyển tệp tạm vào `pending/<submissionId>/`; tạo `submission_files(sync_status=PENDING)`; `submitted_at = now`, `is_late = now > due_at`; trạng thái `SUBMITTED`/`LATE`; ghi `submission_events(SUBMIT|RESUBMIT)`;
     - sau commit: đưa tệp vào hàng đợi ghi Drive (**include UC06.3**); thông báo `SUBMISSION_UPDATED` cho thành viên khác (bài chung).
  5. Trả "Nộp bài thành công – đang đồng bộ lên Drive"; giao diện hiện trạng thái đồng bộ từng tệp.
- **Ngoại lệ:** quá hạn → `SUBMISSION_DEADLINE_PASSED`; chưa có nhóm → `GROUP_NOT_ASSIGNED`; chưa có đề tài → `TOPIC_REQUIRED`; sai định dạng thực → `FILE_INVALID_TYPE` (kèm tên tệp); vượt dung lượng/số lượng → `FILE_TOO_LARGE`/`FILE_TOO_MANY`; bài yêu cầu báo cáo mà bài chung / bài cá nhân chính không có tệp PDF/DOC/DOCX (kể cả tệp đang giữ lại) → `REPORT_REQUIRED`; gửi phần cá nhân khi bài không bật → `PERSONAL_PART_DISABLED`.

#### UC06.3 Ghi tệp lên Drive
- **Hàng đợi ghi Drive** (đồng thời có giới hạn):
  1. Đặt `UPLOADING`. Bảo đảm thư mục đích (UC04.3): bài chung → `Nhom/Bai_chung`; phần cá nhân trong nhóm → `Nhom/<MSSV>_<HoTen>`; bài cá nhân → `CaNhan_<MSSV>_<HoTen>`. Dùng client Drive của **GV tạo bài tập**.
  2. Upload dạng stream (resumable với tệp lớn) tên `NN_<tên gốc đã làm sạch>`; lưu `drive_file_id`, `md5`.
  3. `SYNCED`; giữ bản cục bộ một thời gian để xem nhanh rồi dọn.
- **Lỗi:** tạm thời (429, 5xx, mạng) → thử lại với backoff tăng dần. Vĩnh viễn (403 mất quyền, 404 thư mục bị xóa, chưa liên kết, hết dung lượng) → `FAILED`, `last_error`, thông báo `SUBMISSION_SYNC_FAILED` + `DRIVE_FOLDER_PROBLEM` cho GV (gộp tối đa 1 email/bài tập/giờ). Tệp tạm vẫn giữ.

#### UC06.4 Nộp lại bài
- **Extend** UC06.1/06.2 khi đã có bài nộp, được làm đến hạn cuối.
- **Quy tắc thay thế:** với mỗi loại tệp (ảnh, video, mã nguồn, báo cáo), **nếu lần nộp này có tệp mới của loại đó thì toàn bộ tệp cũ cùng loại bị thay**; loại không có tệp mới **được giữ nguyên**. Link Figma/Git, ghi chú lấy theo lần nộp mới.
- Client: chỉ khi có tệp cũ bị thay mới hiện hộp xác nhận (mẫu `SV_ConfirmResubmit`): "Các tệp <danh sách> sẽ bị xóa vĩnh viễn, kể cả trên Drive · Bản mới: … · Giữ nguyên: …". Chỉ sửa link/ghi chú thì nộp luôn.
- Server trong transaction: tăng `version`, đánh dấu tệp cũ bị thay `deleted_at = now`, tạo tệp mới (số thứ tự nối tiếp tệp được giữ), cập nhật link/ghi chú/`submitted_at`/`is_late`; ghi `submission_events(RESUBMIT, {removed:[tên], added:[tên]})`.
- Sau commit: đưa tệp cũ đã có `drive_file_id` vào thùng rác Drive; xóa tệp cục bộ.
- Hai thành viên nộp cùng lúc: khóa theo chủ bài làm các yêu cầu chạy tuần tự (BR-12); cả hai nhận `SUBMISSION_UPDATED`.

#### UC06.5 Xóa nhiều ảnh/tệp
- **TĐK:** như nộp bài (trước hạn cuối).
- **Luồng:** chọn nhiều tệp (có "Chọn tất cả") → "Xóa (n)" → xác nhận → `DELETE /student/submissions/:id/files {fileIds[]}` → đánh dấu xóa, ghi `submission_events(DELETE_FILES)`, đưa vào thùng rác Drive, đánh lại `sort_order`.
- Xóa hết tệp và không còn link → xóa bài nộp (trạng thái *Chưa nộp*); sự kiện vẫn được giữ.

#### UC06.6 Xem lịch sử nộp bài
- Dòng thời gian từ `submission_events` của bài chung (mọi thành viên thấy) và bài cá nhân (chỉ chủ bài): thời gian, người thao tác, hành động, tệp thêm/xóa, phiên bản. GV xem được mọi lịch sử trong LHP.

#### UC06.7 Xem bài nộp
- **Kiểm tra:** `canViewSubmission` (§3.1). Với DN: **include UC09.6**.
- **GV:** tab *Bài đã nộp* của bài tập: danh sách nhóm/SV đã nộp (đề tài, người nộp, thời điểm, nộp muộn, sản phẩm, phần cá nhân, trạng thái Drive), tìm theo nhóm/đề tài/SV, xuất danh sách, nút *Xem* mở trình xem, *Mở trên Google Drive*. Danh sách chỉ phục vụ xem/lưu trữ, không có trạng thái chấm.
- **Trình xem** (mẫu `Media_Viewer`, nền tối): đề tài + từ khóa, người nộp, thời gian, phiên bản, đồng bộ Drive, điểm/nhận xét (nếu đã công bố và người xem được xem).
  - Ảnh: trình chiếu (Next/Prev, "3/12", dải thumbnail, phím ←/→/Esc, vuốt, zoom, toàn màn hình).
  - Video: `<video>` nguồn `/api/v1/files/:id/content`, hỗ trợ `Range` để tua.
  - Figma: nhúng `https://www.figma.com/embed?embed_host=share&url=<url>` + nút mở tab.
  - Mã nguồn: tên, dung lượng, nút tải (nếu `canDownload`); link Git mở tab mới.
  - Báo cáo: PDF xem trực tiếp; DOC/DOCX tải về.
- **Tệp đang đồng bộ:** phục vụ từ bản cục bộ. **Tệp `MISSING`:** nhãn "Tệp không còn trên Drive".

#### UC06.8 Tìm kiếm bài nộp
- **Tác nhân:** GV, DN, Admin.
- **Đầu vào:** từ khóa `q` (khớp tên đề tài, tên tag, tên/MSSV SV), bộ lọc (học kỳ, môn, LHP, bài tập, khóa, loại môn, tag, khoảng điểm, nộp muộn), sắp xếp (độ liên quan, mới nhất, điểm). Giao diện GV: ô tìm chung + chọn *Tìm theo* (Đề tài / Tên SV / MSSV / Khóa).
- **Xử lý:** `unaccent(lower(q))` so với `search_text` của `topics` bằng `pg_trgm` + `ILIKE` → giới hạn phạm vi theo vai trò (FR-06.13) → phân trang 20.
- **Kết quả:** thẻ bài: thumbnail ảnh đầu, đề tài, tag, SV/nhóm, LHP, thời gian, điểm (không hiện với DN). DN tìm thì ghi `enterprise_search_logs(scope=SUBMISSION)`.

#### UC06.9 Đồng bộ lại tệp lỗi
- **Bộ hẹn giờ:** chọn tệp `FAILED` đến hạn thử (`next_retry_at ≤ now`), giãn dần (10', 30', 1h, 3h, 6h…); hết lỗi → đưa lại hàng đợi.
- **Kiểm tra định kỳ (03:00):** tệp `SYNCED` của bài tập còn mở hoặc đóng < 30 ngày; tệp bị xóa/ở thùng rác → `MISSING`, báo GV.
- **GV thủ công:** trang *Kết nối Google Drive* liệt kê bài tập có tệp lỗi; nút "Thử lại".

#### UC06.10 Gửi nhắc hạn nộp bài
- **Bộ hẹn giờ (mỗi 15 phút):** bài tập `OPEN` có `due_at - now ∈ (0, reminder.hoursBefore]`: SV chưa nộp (bài cá nhân chưa có bài; bài nhóm chưa có bài chung → mọi thành viên) → `DEADLINE_REMINDER` với `dedupe_key = reminder:<assignmentId>:<studentId>`.
- Chỉ nhắc SV; không tạo báo cáo, cảnh báo hay thông báo đôn đốc cho GV/PH.

---

### UC07 – Quản lý & xem điểm

> GV chấm bài **ngoài hệ thống**. Hệ thống chỉ nhận điểm qua file Excel, lưu, tính tổng kết/GPA/CPA và công bố.

#### UC07.1 Tải file mẫu bảng điểm
- **Mẫu điểm bài tập** — `GET /lecturer/assignments/:id/grades/template`: cột **MSSV**, **Họ tên**, **Nhóm** (bài `GROUP`, để GV điền cùng điểm cho cả nhóm cho nhanh), **Đề tài**, **Điểm**, **Nhận xét**. Đã có điểm thì điền sẵn.
- **Mẫu điểm học phần** — `GET /lecturer/sections/:id/grades/template`: cột **MSSV**, **Họ tên**, **Chuyên cần**, **Bài tập**, **Giữa kỳ**, **Cuối kỳ**. Cột *Bài tập* điền sẵn = Σ(điểm bài tập × trọng số bài)/Σ trọng số của các bài đã có điểm; GV sửa được.

#### UC07.2 Tải lên điểm bài tập
1. GV chọn file trên tab *Điểm* của bài tập → `POST /lecturer/assignments/:id/grades/import/preview` → **include UC07.4**.
2. Xem trước: số SV có điểm / để trống, điểm cũ → mới, lỗi theo dòng.
3. **Áp dụng** → ghi `assignment_grades(score, note, import_job_id, updated_by)` cho từng SV (ghi đè điểm cũ); `import_jobs = COMPLETED`; ghi log.
4. Bài tập đã công bố điểm (`grades_published_at`) mà điểm thay đổi → thông báo `ASSIGNMENT_GRADE_UPDATED` cho SV bị đổi điểm.

#### UC07.3 Tải lên điểm học phần
- **TĐK:** bảng điểm học phần chưa công bố (`course_sections.grades_published_at IS NULL`), nếu đã công bố → `GRADES_LOCKED` (dùng UC07.7).
- Như UC07.2 trên trang *Bảng điểm* của LHP: ghi `section_grades(attendance, assignment, midterm, final)`, tính `total` = Σ(thành phần × trọng số môn)/100 làm tròn 1 chữ số (BR-14), `letter`, `gpa4` (BR-15); thiếu thành phần thì để trống tổng kết.

#### UC07.4 Kiểm tra & xem trước tệp điểm
| Kiểm tra | Mức |
|---|---|
| Đúng mẫu (tên cột), ≤ 2.000 dòng, ≤ 5 MB | Lỗi file (`IMPORT_INVALID_FILE`) |
| MSSV thuộc LHP, không lặp | Lỗi dòng |
| Điểm là số 0–10 (dấu phẩy hoặc chấm), làm tròn 1 chữ số; ô trống = chưa có điểm | Lỗi dòng |
| Nhận xét ≤ 1000 ký tự | Lỗi dòng |
| SV của LHP không có trong file | Cảnh báo (giữ điểm cũ) |
| Điểm thay đổi so với lần trước | Hiển thị cũ → mới |

#### UC07.5 Xem bảng điểm lớp học phần
- Trang đầu *Bảng điểm* (mẫu `GV_GradebookHome`): danh sách LHP GV phụ trách theo năm học (mã LHP, môn, sĩ số, trạng thái: chưa có điểm / đã tải / đã công bố). Chọn LHP → bảng điểm (mẫu `GV_Gradebook`; LHP chưa có điểm → `GV_GradebookEmpty`).
- Bảng: MSSV, họ tên, điểm từng bài tập, 4 thành phần, tổng kết, chữ, hệ 4; trọng số; biểu đồ phân bố; lọc, sắp xếp, tô đỏ < 4,0; nút *Tải file mẫu*, *Tải lên điểm*, *Xuất Excel*, *Công bố*; nhãn "Đã công bố lúc …" khi đã khóa.

#### UC07.6 Công bố điểm
- **Điểm bài tập:** nút *Công bố điểm* trên tab *Điểm* của bài tập → `assignments.grades_published_at = now` → SV (và PH) thấy điểm + nhận xét; thông báo `ASSIGNMENT_GRADES_PUBLISHED`. Sau công bố vẫn tải lên lại được (UC07.2).
- **Điểm học phần:** **TĐK:** mọi SV có đủ 4 thành phần (hoặc GV tick "Công bố cả SV thiếu điểm" → tổng kết để trống, không tính GPA). Xác nhận → `course_sections.grades_published_at = now`; `section_grades.status = PUBLISHED`; tính lại `student_term_results` và `students.cpa`; kiểm tra cảnh báo học tập; thông báo `GRADES_PUBLISHED` cho SV và PH. Ghi log.

#### UC07.7 Yêu cầu sửa điểm sau khi khóa
- GV chọn SV trong bảng đã công bố → form: thành phần muốn sửa, giá trị mới, lý do* (≥ 10 ký tự), minh chứng (tùy chọn, tệp ≤ 5 MB) → `grade_change_requests(PENDING, old_values, new_values)` → thông báo Admin.
- Mỗi SV/LHP chỉ có 1 yêu cầu `PENDING`; GV hủy được khi còn chờ.

#### UC07.8 Xử lý yêu cầu sửa điểm của GV
- Admin xem danh sách chờ: GV, LHP, SV, điểm cũ → mới (tổng kết dự kiến), lý do, minh chứng.
- **Duyệt:** transaction kiểm tra `old_values` vẫn khớp, áp dụng giá trị mới vào `section_grades`, tính lại tổng kết, ghi `audit_logs(GRADE_CHANGED)`, `status = APPROVED` → tính lại GPA/CPA → thông báo GV và SV.
- **Từ chối:** lý do bắt buộc → thông báo GV.

#### UC07.9 Xem điểm của bản thân (SV)
- Tab "Theo học kỳ": từng học phần đã công bố (thành phần, tổng kết, chữ, hệ 4, tín chỉ), GPA kỳ, tín chỉ kỳ.
- Tab "Bài tập": điểm + nhận xét từng bài tập đã công bố (kể cả khi học phần chưa công bố).
- Thẻ tổng: CPA, tổng tín chỉ tích lũy, xếp loại (Xuất sắc ≥ 3,6 · Giỏi ≥ 3,2 · Khá ≥ 2,5 · TB ≥ 2,0 · Yếu < 2,0).

---

### UC08 – Xem kết quả học tập của con (PH)

Mọi API của PH đi qua `ParentChildGuard`: lấy `selectedStudentId` từ token, kiểm tra liên kết còn hiệu lực.

#### UC08.1 Chọn con cần xem
- Giống UC01.3; hiển thị ở header mọi trang.

#### UC08.2 Xem điểm, GPA, CPA của con
- Giống UC07.9 nhưng chỉ đọc; thêm biểu đồ đường GPA theo kỳ và cột tín chỉ. Chỉ thấy điểm đã công bố (điểm bài tập và điểm học phần).

#### UC08.3 Xem bài nộp của con
- Danh sách theo kỳ → LHP → bài tập: thời gian nộp, đề tài, điểm (nếu đã công bố). Bấm vào thì mở UC06.7 (chế độ PH: không tải). Bài cá nhân của con và bài chung của nhóm con tham gia.

#### UC08.4 Xem thông báo, cảnh báo học tập của con
- Tab "Cảnh báo": danh sách `academic_warnings` của con (loại, nội dung, thời gian, đối tượng liên quan), lọc theo loại.
- Tab "Thông báo": thông báo gửi tới tài khoản PH.
- **Sinh cảnh báo** (chạy sau khi công bố điểm học phần):

| Loại | Điều kiện |
|---|---|
| `LOW_COURSE_SCORE` | Điểm tổng kết học phần < `warning.lowScore` |
| `LOW_GPA` | GPA kỳ < `warning.lowGpa` |
| `GPA_DROP` | GPA kỳ giảm ≥ `warning.gpaDrop` so với kỳ trước |

Mỗi cảnh báo tạo 1 dòng `academic_warnings` (duy nhất theo `dedupe_key`) + thông báo `ACADEMIC_WARNING` cho mọi PH liên kết và SV.

---

### UC09 – Tìm kiếm sinh viên & Quản lý quyền xem bài

#### UC09.1 Tìm kiếm sinh viên
- **TĐK:** DN `ACTIVE`.
- **Bộ lọc:** MSSV (khớp chính xác, nếu nhập thì bỏ các lọc khác), khóa (nhiều), ngành (nhiều), khoảng CPA, từ khóa đề tài (tag, nhiều, AND/OR), từ khóa tự do (khớp tên đề tài/kỹ năng), kỹ năng.
- **Xử lý:** chỉ SV `discoverable = true`, tài khoản `ACTIVE`; chỉ tính đề tài của bài **đã nộp** (BR); sắp `cpa DESC NULLS LAST, topic_count DESC, student_code ASC`; 20/trang.
- **Kết quả:** họ tên, khóa, ngành, CPA, số đề tài, 3 đề tài gần nhất (tên + tag), nhãn trạng thái quyền của DN với SV này (*Chưa yêu cầu / Đang chờ / Đang xem được đến dd/mm / Hết hạn*).
- Ghi `enterprise_search_logs(scope=STUDENT, criteria, result_count)`. Rate limit 30 lần/phút.

#### UC09.2 Xem tóm tắt hồ sơ sinh viên
- **Extend** UC09.1. Hiện: ảnh đại diện, họ tên, khóa, ngành, lớp, CPA, tín chỉ tích lũy, giới thiệu, kỹ năng, link GitHub/Behance/LinkedIn, **toàn bộ đề tài đã nộp** (tên, mô tả, tag, môn, học kỳ, cá nhân/nhóm).
- Ẩn: SĐT, email, thông tin PH, điểm chi tiết (BR-19).
- Ghi `enterprise_access_logs(action=VIEW_PROFILE)`.

#### UC09.3 Gửi yêu cầu xem bài nộp
- **Extend** UC09.2 (hoặc chọn nhiều SV từ danh sách kết quả).
- Nhập mục đích* (20–500 ký tự), số ngày mong muốn (14–28, mặc định 14).
- Với mỗi SV: bỏ qua (kèm lý do) nếu đã có yêu cầu `PENDING` hoặc `APPROVED` còn hạn (BR); còn lại tạo `view_requests(PENDING)`.
- Thông báo `VIEW_REQUEST_CREATED` cho Admin (gộp 1 thông báo cho cả lô).

#### UC09.4 Xem trạng thái cấp quyền
- Bảng yêu cầu của DN: SV, ngày gửi, trạng thái, số ngày được duyệt, ngày hết hạn, **số ngày còn lại**, lý do từ chối/thu hồi. Lọc theo trạng thái. Hủy được yêu cầu `PENDING`. Yêu cầu `APPROVED` có nút "Xem bài".

#### UC09.5 Xem bài nộp của SV được cấp quyền
- **TĐK:** có `view_request APPROVED` với `expires_at > now`.
- Danh sách bài của SV (bài cá nhân + bài chung của các nhóm SV tham gia), nhóm theo học kỳ/môn; chỉ hiển thị bài đã nộp. Mở bằng UC06.7 ở chế độ không tải, không hiện điểm.
- **Include UC09.6** cho mỗi lần mở bài và mỗi tệp (gộp: cùng DN + cùng tệp trong 10 phút chỉ ghi 1 lần).
- Hết hạn giữa chừng → API trả `VIEW_ACCESS_EXPIRED` (403), giao diện quay về danh sách.

#### UC09.6 Ghi nhật ký truy cập
- Ghi `enterprise_access_logs(enterprise_id, student_id, view_request_id, action ∈ {VIEW_PROFILE, VIEW_SUBMISSION, VIEW_FILE}, submission_id, file_id, ip, user_agent, created_at)`. Ghi không đồng bộ (job nhẹ), không làm chậm việc xem.

#### UC09.8 Xử lý yêu cầu xem bài (Admin)
- Danh sách `PENDING` (cũ nhất trước): DN (lĩnh vực, ngày duyệt DN), SV (ngành, khóa, CPA), mục đích, số ngày đề nghị; cảnh báo nếu DN gửi > 30 yêu cầu/24h.
- **Duyệt:** chọn số ngày 14–28 (mặc định = đề nghị) → `APPROVED`, `approved_at = now`, `expires_at = now + n ngày`, `processed_by`. Thông báo DN và SV.
- **Từ chối:** lý do bắt buộc → `REJECTED`. Thông báo DN.
- Chọn nhiều để duyệt/từ chối hàng loạt.

#### UC09.9 Thu hồi quyền xem bài (Admin)
- Danh sách `APPROVED` còn hạn → "Thu hồi" + lý do* → `REVOKED`, `revoked_at/by/reason`. Thông báo DN. Ghi log.

#### UC09.10 Thu hồi quyền khi hết hạn (tự động)
- **Bộ hẹn giờ (mỗi 5 phút):** `UPDATE view_requests SET status='EXPIRED' WHERE status='APPROVED' AND expires_at <= now() RETURNING *` → thông báo `VIEW_REQUEST_EXPIRED`.
- **Hằng ngày 08:00:** yêu cầu `APPROVED` có `expires_at` trong 48 giờ tới → `VIEW_REQUEST_EXPIRING` (dedupe).
- Kiểm tra quyền khi xem luôn so `expires_at > now()`, nên dù job chậm thì DN vẫn không xem được quá hạn.

#### UC09.11 Xem doanh nghiệp đã xem bài của mình (SV)
- Danh sách DN có yêu cầu `APPROVED`/`EXPIRED`/`REVOKED` liên quan đến SV: tên DN, lĩnh vực, website, thời hạn, trạng thái, số lượt xem, lần xem gần nhất; mở rộng ra thì thấy chi tiết từng lượt (bài nào, khi nào).

---

### UC10 – Thống kê & Báo cáo

Số liệu tính bằng truy vấn tổng hợp, cache Redis 5 phút (khóa theo vai trò + bộ lọc). Biểu đồ dùng Recharts.

#### UC10.1 Xem Dashboard tổng quan (Admin)
- Thẻ: tổng SV/GV/PH/DN (active), LHP kỳ này, bài tập kỳ này, bài nộp được lưu tuần này, tệp chờ/lỗi đồng bộ, DN chờ duyệt, yêu cầu xem bài chờ, yêu cầu sửa điểm chờ (bấm để đi tới trang xử lý).
- Biểu đồ: bài nộp theo ngày (30 ngày), người dùng đăng nhập theo ngày, phân bố CPA toàn trường.

#### UC10.2 Xem thống kê doanh nghiệp (Admin)
- Bộ lọc: khoảng thời gian, lĩnh vực DN, ngành SV.
- Chỉ số: DN theo trạng thái; DN mới theo tháng; DN theo lĩnh vực (tròn); DN hoạt động 30 ngày; yêu cầu theo trạng thái; tỉ lệ duyệt; thời gian xử lý trung bình (`approved_at - created_at`); quyền còn hiệu lực; yêu cầu theo tháng; lượt tìm kiếm theo ngày; tiêu chí lọc dùng nhiều; tag được tìm nhiều; top 10 SV được yêu cầu/xem; phân bố ngành/khóa/CPA của SV được yêu cầu; top 10 DN hoạt động.

#### UC10.3 Xem thống kê lớp học phần (Admin, GV)
- Chọn học kỳ → LHP. Chỉ số **về kết quả** (không theo dõi tiến độ): sĩ số; số bài tập; số bài nộp được lưu trữ; điểm TB từng bài tập (theo điểm đã tải lên); phổ điểm tổng kết (histogram bước 1,0); phân bố điểm chữ; top tag đề tài; số SV được DN quan tâm.
- Admin xem được mọi LHP và so sánh giữa các LHP cùng môn.

#### UC10.4 Xem thống kê cá nhân sinh viên
- GPA theo kỳ (đường), CPA, tín chỉ tích lũy, số bài nộp đã lưu, điểm TB bài tập theo môn, số DN đã xem, số lượt xem.

#### UC10.5 Xem thống kê của doanh nghiệp mình
- Yêu cầu theo trạng thái; quyền còn hạn kèm số ngày còn lại; số SV đã xem bài; số lượt xem theo ngày; 20 lần tìm kiếm gần nhất (tiêu chí, số kết quả, bấm để tìm lại).

#### UC10.6 Xuất báo cáo
- **Extend** UC10.1/10.2/10.3: nút "Xuất Excel" / "Xuất PDF" với bộ lọc đang chọn.
- Excel (ExcelJS): mỗi chỉ số một sheet, có tiêu đề, bộ lọc, ngày xuất. PDF (pdfmake, font Roboto hỗ trợ tiếng Việt): bảng + biểu đồ (ảnh PNG chụp từ client gửi lên kèm yêu cầu).
- Báo cáo lớn (> 5.000 dòng) chạy job nền; xong thì thông báo kèm link tải (hết hạn sau 24h).

#### UC10.7 Phân tích đề tài – nhu cầu DN
- **Tác nhân:** Admin (toàn trường), GV (LHP mình dạy, chỉ phần SV). Bộ lọc: học kỳ (một hoặc khoảng), ngành, khóa.
- **Xu hướng đề tài SV:** top từ khóa theo số đề tài đã nộp; đường số đề tài theo từ khóa qua các kỳ; nhãn *mới nổi* (lần đầu hoặc tăng > 50%), *ổn định*, *giảm dần*; phân bố theo ngành.
- **DN quan tâm:** từ khóa trong `enterprise_search_logs` và đề tài của bài DN đã xem (`enterprise_access_logs`); theo lĩnh vực DN; từ khóa tăng nhanh.
- **Cung – cầu:** bảng từ khóa với số đề tài, lượt DN quan tâm, `demand_index` (DatabaseDesign §6.6); tô *thiếu hụt* (> 1,2) và *dư thừa* (< 0,8).
- Số liệu lấy từ `topic_trend_snapshots` (job `stats.topic-trends` 01:30 hằng ngày) và truy vấn trực tiếp cho kỳ hiện tại; chỉ tính đề tài có bài đã nộp, từ khóa sau gộp. Xuất được (UC10.6).

#### UC10.8 Xem bản đồ năng lực SV (DN)
- Ma trận chủ đề × ngành/khóa/khoảng CPA: số SV đã làm đề tài về chủ đề đó; bấm một ô → chuyển sang UC09.1 với bộ lọc tương ứng. Chỉ tính SV `discoverable`; không hiển thị tên/MSSV; ô < 3 SV hiển thị "< 3".

---

### UC11 – Thông báo

#### UC11.1 Xem danh sách thông báo, đánh dấu đã đọc
- Chuông ở header với số chưa đọc (tối đa "99+"); dropdown 10 thông báo mới nhất; trang đầy đủ có lọc đã đọc/chưa đọc, phân trang con trỏ.
- Bấm thông báo → đánh dấu đã đọc, điều hướng tới `link`. "Đánh dấu tất cả đã đọc".
- Socket `notification:new` cập nhật số đếm và hiện toast.

#### UC11.2 Nhận thông báo qua email
- Sự kiện có cột Email = ✔ (§5) đưa job `mail.send` (thử lại 5 lần). Địa chỉ nhận: email hồ sơ SV, email GV, email DN, email PH (nếu có). Mẫu HTML đơn giản có nút đi tới hệ thống.

#### UC11.3 Phát thông báo tự động
- `NotificationService.notify(recipients[], type, payload, {email?, dedupeKey?})` → insert `notifications` (bỏ qua nếu trùng `dedupe_key`) → emit socket → (tùy chọn) đưa job email.
- Danh sách job định kỳ ở [ModuleFlows §8](ModuleFlows.md#8-lịch-tác-vụ-nền-bộ-hẹn-giờ).

#### UC11.4 Cài đặt nhận thông báo
- Mỗi vai trò có trang *Thông báo* riêng, lọc theo nhóm (GV: Bài nộp, Nhóm, Điểm, Drive; SV: Bài tập, Nhóm, Điểm, DN, Hệ thống; …) và hành động nhanh trên từng thông báo (VD: *Xem bài nộp*, *Xem phản hồi nhóm*).
- Khối *Cài đặt nhận thông báo*: bảng loại × kênh (*Ứng dụng*, *Email*); thông báo bảo mật và quyền xem của DN luôn bật; bật *bản tin tổng hợp* (mặc định 20:00) → lưu `users.notification_prefs`. Tắt kênh *Ứng dụng* của một loại thì không tạo thông báo loại đó cho người dùng.
- Job `notifications.digest` (mỗi 15 phút) gom thông báo chưa gửi email của người dùng có `digest_time` rơi vào khung hiện tại → 1 email `NOTIFICATION_DIGEST`.

## 7. Mã lỗi chuẩn

Định dạng phản hồi lỗi:

```json
{ "statusCode": 409, "code": "GROUP_NOT_ASSIGNED", "message": "Bạn chưa được xếp nhóm cho bài tập này" }
```

| Nhóm | Mã |
|---|---|
| Chung | `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500) |
| Auth | `AUTH_INVALID_CREDENTIALS`, `AUTH_TEMP_LOCKED`, `AUTH_ACCOUNT_LOCKED`, `AUTH_PENDING_APPROVAL`, `AUTH_REJECTED`, `AUTH_MUST_CHANGE_PASSWORD`, `AUTH_PROFILE_INCOMPLETE`, `AUTH_TOKEN_INVALID`, `PARENT_NO_CHILD` |
| Admin | `CATALOG_IN_USE`, `SCHEDULE_CONFLICT`, `SECTION_FULL`, `IMPORT_INVALID_FILE`, `ENTERPRISE_DUPLICATE` |
| Drive | `DRIVE_FOLDER_NOT_FOUND`, `DRIVE_NOT_A_FOLDER`, `DRIVE_NO_WRITE_PERMISSION`, `DRIVE_NOT_SHARED_DRIVE`, `DRIVE_QUOTA_EXCEEDED`, `DRIVE_NOT_LINKED` |
| Bài tập | `ASSIGNMENT_INVALID_DATES`, `ASSIGNMENT_HAS_SUBMISSIONS`, `ASSIGNMENT_CLOSED`, `ASSIGNMENT_SECTION_NOT_OWNED`, `WORK_MODE_LOCKED` |
| Nhóm | `GROUP_NOT_ASSIGNED`, `GROUP_HAS_SUBMISSION`, `GROUP_REPORT_PENDING_EXISTS` |
| Excel | `IMPORT_INVALID_FILE`, `IMPORT_TOO_LARGE`, `IMPORT_JOB_EXPIRED` (lỗi theo dòng trả trong `details.rows[]`) |
| Đề tài | `TOPIC_REQUIRED`, `TOPIC_TAG_LIMIT`, `TOPIC_EDIT_CLOSED` |
| Nộp bài | `REPORT_REQUIRED`, `SUBMISSION_DEADLINE_PASSED`, `SUBMISSION_EMPTY`, `FILE_INVALID_TYPE`, `FILE_TOO_LARGE`, `FILE_TOO_MANY`, `LINK_INVALID_DOMAIN`, `PERSONAL_PART_DISABLED` |
| Điểm | `GRADES_LOCKED`, `GRADE_WEIGHTS_INVALID`, `GRADE_REQUEST_PENDING_EXISTS` |
| DN | `VIEW_REQUEST_DUPLICATE`, `VIEW_ACCESS_EXPIRED`, `VIEW_DAYS_OUT_OF_RANGE` |

## 8. Danh sách màn hình

| Vai trò | Màn hình |
|---|---|
| Chung | Đăng nhập (tab Sinh viên / Giảng viên / Quản trị / Phụ huynh / Doanh nghiệp), Quên/Đặt lại mật khẩu, Đổi mật khẩu (lần đầu và thường), Đăng ký DN, Thông báo, Tài khoản, Trình xem bài nộp, 403/404, Quyền xem hết hạn, Tệp không còn trên Drive, Hết phiên |
| Admin | Dashboard; Người dùng (GV/SV/PH, import); DN (duyệt); Đào tạo (học kỳ, môn, LHP + lịch, xếp SV); Từ khóa; Yêu cầu xem bài & quyền đang hiệu lực; Yêu cầu sửa điểm; Tình trạng đồng bộ Drive; Thống kê DN; Phân tích đề tài; Nhật ký; Cấu hình |
| GV | Tổng quan; Lớp học phần → Môn → danh sách bài tập & SV; Tạo bài tập (nhiều LHP) / Tạo bài tập cho một LHP / Sửa bài tập; **Trang bài tập** (tab Thông tin · Nhóm: tải file mẫu, tải lên, xem trước, phản hồi nhóm · Bài đã nộp · Điểm: tải file mẫu, tải lên, xem trước, công bố); Bảng điểm (danh sách LHP theo năm → bảng điểm LHP / trống, tải lên điểm học phần, công bố, yêu cầu sửa điểm); Tìm bài nộp; Thống kê (kèm phân tích đề tài); Thông báo; Kết nối Google Drive (OAuth / Service Account) |
| SV | Khai báo hồ sơ; Tổng quan; Bài tập của tôi → Môn → **trang bài tập 4 bước**: Đề bài & nhóm → Đề tài → Nộp bài (bài chung / bài cá nhân / mã nguồn, xác nhận nộp lại) → Kết quả; Điểm của tôi; Quyền riêng tư & DN đã xem tôi |
| PH | Chọn con; Tổng quan; Điểm; Bài nộp; Cảnh báo & thông báo |
| DN | Tổng quan; Tìm SV; Hồ sơ SV; Bài nộp của SV; Bản đồ năng lực; Hồ sơ DN |

**Đối chiếu với bộ giao diện `project/` (v3.0):**

| Mẫu | Dùng trong v3.0 |
|---|---|
| `GV_Dashboard`, `GV_Classes`, `GV_CreateAssignment`, `GV_CreateAssignmentClass`, `GV_EditAssignment`, `GV_GoogleLink`, `GV_GradebookHome`, `GV_Gradebook`, `GV_GradebookEmpty`, `GV_Notifications` | Dùng, bỏ các khối liên quan đến chốt nhóm, duyệt đề tài, rubric, phúc khảo |
| `GV_AssignNew`, `GV_AssignmentDetail` | Gộp thành trang bài tập 4 tab (Thông tin · Nhóm · Bài đã nộp · Điểm); bỏ thanh 5 bước theo dõi tiến độ |
| `GV_AssignForming`, `GV_AssignTopics`, `GV_AssignGrading`, `GV_AssignGraded`, `GV_Grading`, `GV_GradeList`, `GV_GradeResult`, `GV_GroupManage`, `GV_GroupsForming` | **Không dùng** (thuộc phạm vi đã bỏ); tab *Nhóm* thay bằng khối tải file nhóm, tab *Điểm* thay bằng khối tải file điểm |
| `SV_Dashboard`, `SV_Assignments`, `SV_Course`, `SV_Submit`, `SV_SubmitPersonal`, `SV_SubmitCode`, `SV_ConfirmResubmit`, `SV_StepSubmit`, `SV_AssignmentDone`, `Media_Viewer`, `Shared_Notifications`, `Shared_ErrorForbidden` | Dùng; cột *Tiến độ* đổi thành 4 bước, bỏ trạng thái *Chờ duyệt đề tài / Chờ chấm / Bị trả lại* |
| `SV_AssignmentNew`, `SV_StepGroup`, `SV_StepTopic` | Dùng một phần: bỏ chọn hình thức, tạo/tham gia nhóm, mời thành viên, duyệt đề tài; thay bằng khối *Nhóm của tôi* (chỉ xem + *Báo nhóm chưa đúng*) và form *Tên đề tài + từ khóa* |
| `SV_StepGrading` | Không dùng (không có bước chấm trên web) |
| `phu-huynh/`, `doanh-nghiep/`, `admin/` | Dùng như cũ |
