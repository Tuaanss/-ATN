# EduPortfolio – Đặc tả chức năng (Specification)

> Phiên bản 2.0 · 07/10/2026
> Đặc tả từng use case trong [Requirement.md](Requirement.md). Tên bảng/cột theo [DatabaseDesign.md](DatabaseDesign.md), endpoint theo [ModulesStructure.md](ModulesStructure.md).

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
| Liên kết Drive, tạo / sửa / xóa bài tập | – | ◐ LHP mình dạy | – | – | – |
| Tạo nhóm, mời, phản hồi, rời nhóm | – | – | ✔ | – | – |
| Điều chỉnh thành viên, khóa nhóm | – | ◐ LHP mình dạy | – | – | – |
| Đăng ký / sửa đề tài | – | ◐ sau hạn | ◐ nhóm mình, trước hạn | – | – |
| Nộp / nộp lại / xóa tệp | – | – | ◐ trước hạn, chưa chấm | – | – |
| Xem bài chung nhóm | ✔ | ◐ LHP mình dạy | ◐ thành viên | ◐ của con | ◐ quyền còn hạn |
| Xem bài cá nhân | ✔ | ◐ LHP mình dạy | ◐ của mình | ◐ của con | ◐ quyền còn hạn |
| Tải tệp gốc | ✔ | ◐ LHP mình dạy | ◐ bài của mình/nhóm mình | – | – |
| Tìm kiếm bài nộp | ✔ | ◐ theo `lecturer_search_scope` | – | – | ◐ SV đang có quyền |
| Chấm, nhập, công bố điểm | – | ◐ LHP mình dạy | – | – | – |
| Yêu cầu sửa điểm sau khóa | – | ◐ LHP mình dạy | – | – | – |
| Xử lý yêu cầu sửa điểm | ✔ | – | – | – | – |
| Xem điểm chi tiết | ✔ | ◐ LHP mình dạy | ◐ của mình, đã công bố | ◐ của con, đã công bố | – (chỉ CPA) |
| Tìm SV theo CPA, gửi yêu cầu xem bài | – | – | – | – | ✔ |
| Duyệt / thu hồi quyền xem bài, duyệt DN | ✔ | – | – | – | – |
| Xem DN đã xem mình | – | – | ✔ | – | – |
| Nhật ký hệ thống, cấu hình | ✔ | – | – | – | – |
| Dashboard, thống kê DN, xuất báo cáo | ✔ | – | – | – | – |
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
DRAFT ──công bố / tới open_at──► OPEN ──GV đóng / Bộ hẹn giờ quá hạn cuối──► CLOSED
                                  ▲                                        │
                                  └──────────── GV mở lại (gia hạn) ───────┘
```
Hạn cuối = `late_due_at` nếu `allow_late`, ngược lại là `due_at`. Bài tập lưu ở `DRAFT` chưa hiện với SV; chọn "Giao ngay" thì `open_at = now`.

### 4.3. Bài nộp `submissions.status`

```
(không có bản ghi) = CHƯA NỘP
        │ nộp
        ▼
   SUBMITTED / LATE ──chấm──► GRADED ──yêu cầu làm lại──► RETURNED ──nộp lại──► SUBMITTED/LATE
        │ xóa hết tệp và không còn link
        ▼
     (xóa bản ghi → CHƯA NỘP)
```
`sync_status` của bài nộp tổng hợp từ các tệp: `PENDING` (còn tệp chưa lên Drive) · `SYNCED` · `ERROR` (có tệp `FAILED`/`MISSING`).

### 4.4. Tệp `submission_files.sync_status`

```
PENDING ──worker nhận──► UPLOADING ──ok──► SYNCED ──phát hiện mất──► MISSING
                            │lỗi
                            ▼
                         FAILED ──Bộ hẹn giờ/GV thử lại──► PENDING
```

### 4.5. Lời mời `group_invitations.status`

`PENDING → ACCEPTED | DECLINED | CANCELLED (trưởng nhóm hủy/nhóm đủ người) | EXPIRED (72h hoặc quá hạn nộp)`

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

| Mã `type` | Sự kiện | Người nhận | Email |
|---|---|---|---|
| `ASSIGNMENT_OPENED` | Bài tập được mở | SV trong LHP | ✔ |
| `DEADLINE_REMINDER` | Còn 24h / 2h, chưa nộp | SV / thành viên nhóm chưa nộp | ✔ (24h) |
| `GROUP_INVITED` | Được mời vào nhóm | SV được mời | ✔ |
| `GROUP_INVITE_RESPONDED` | Lời mời được chấp nhận/từ chối | Trưởng nhóm | – |
| `GROUP_MEMBER_CHANGED` | Thêm/xóa/rời/chuyển trưởng nhóm | Thành viên nhóm | – |
| `GROUP_LOCKED` | Nhóm bị khóa | Thành viên nhóm | – |
| `SUBMISSION_UPDATED` | Thành viên nộp/nộp lại/xóa tệp bài chung | Thành viên khác | – |
| `SUBMISSION_SYNC_FAILED` | Tệp lỗi sau khi hết số lần thử | GV phụ trách (+ SV nộp) | ✔ (GV) |
| `SUBMISSION_GRADED` | Bài được chấm | Chủ bài / thành viên | ✔ |
| `SUBMISSION_RETURNED` | Yêu cầu làm lại | Chủ bài / thành viên | ✔ |
| `GRADES_PUBLISHED` | Công bố điểm học phần | SV trong LHP + PH | ✔ |
| `GRADE_CHANGE_REQUESTED` | GV gửi yêu cầu sửa điểm | Admin | – |
| `GRADE_CHANGE_PROCESSED` | Admin duyệt/từ chối | GV (+ SV nếu duyệt) | ✔ |
| `ACADEMIC_WARNING` | Quá hạn chưa nộp / điểm < 4 / GPA thấp | PH của SV (+ SV) | ✔ |
| `ENTERPRISE_REGISTERED` | DN mới đăng ký | Admin | – |
| `ENTERPRISE_REVIEWED` | DN được duyệt/từ chối | DN | ✔ |
| `VIEW_REQUEST_CREATED` | DN gửi yêu cầu | Admin | – |
| `VIEW_REQUEST_PROCESSED` | Duyệt/từ chối/thu hồi | DN; SV (khi duyệt) | ✔ |
| `VIEW_REQUEST_EXPIRING` | Còn 2 ngày | DN | ✔ |
| `VIEW_REQUEST_EXPIRED` | Hết hạn | DN | – |
| `DRIVE_FOLDER_PROBLEM` | Mất quyền/thư mục bị xóa/hết dung lượng | GV | ✔ |

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
| `viewRequest.minDays` / `maxDays` | 14 / 28 |
| `warning.lowScore` / `lowGpa` / `gpaDrop` | 4.0 / 2.0 / 0.5 |
| `lecturer.searchScope` | `OWN_SECTIONS` |
| `invitation.ttlHours` | 72 |
| `reminder.hoursBefore` | [24, 2] |

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

#### UC04.1 Liên kết tài khoản Google Drive (Service Account)
- **Tác nhân:** GV, Google Drive.
- **Luồng:**
  1. Trang hiển thị email Service Account (có nút sao chép) và hướng dẫn 3 bước: (a) tạo/chọn một thư mục trong **Shared Drive** của trường; (b) thêm email SA làm thành viên *Content manager*; (c) dán link thư mục.
  2. GV dán link → hệ thống tách `folderId` từ URL dạng `drive.google.com/drive/folders/<id>` (hoặc `?id=`).
  3. **Include UC04.4.**
  4. Đạt: lưu `lecturer_drive_links(root_folder_id, url, name, shared_drive_id, status=OK, checked_at)`.
- **Ngoại lệ:** xem bảng lỗi ở UC04.4.
- GV có thể liên kết lại (đổi thư mục gốc) bất kỳ lúc nào; bài tập đã tạo không bị ảnh hưởng.

#### UC04.2 Tạo bài tập
- **TĐK:** GV phụ trách LHP; LHP thuộc học kỳ chưa kết thúc; GV đã liên kết Drive (hoặc nhập link thư mục riêng cho bài).
- **Luồng:**
  1. GV nhập: tiêu đề*, mô tả (rich text), ngày mở*, hạn nộp*, hình thức*, min–max thành viên (nếu có nhóm), loại sản phẩm (gợi ý theo loại môn), nộp muộn (bật/tắt, hạn muộn, % trừ), trọng số trong cột bài tập, thư mục nhận bài (mặc định thư mục gốc đã liên kết).
  2. Kiểm tra BR-04.
  3. **Include UC04.4** trên thư mục cha.
  4. **Include UC04.3**: tạo thư mục `<MaLHP>_<TenBaiTap>`, lưu `drive_folder_id`.
  5. Lưu `assignments` (`OPEN` nếu `open_at ≤ now`, ngược lại `DRAFT`).
  6. Khi chuyển sang `OPEN`: thông báo `ASSIGNMENT_OPENED` cho SV trong LHP.
- **Ngoại lệ:** Drive lỗi → không lưu, hiện hướng dẫn; tạo thư mục thành công nhưng ghi CSDL lỗi → xóa thư mục vừa tạo (bù trừ).

#### UC04.3 Tạo thư mục trên Drive
- `files.create(mimeType=folder, parents=[parentId], supportsAllDrives=true)`, tên đã được làm sạch (bỏ `/\:*?"<>|`, rút gọn ≤ 100 ký tự, thay khoảng trắng bằng `_`).
- Cấu trúc tạo dần:
```
<Thư mục nhận bài>/
└── <MaLHP>_<TenBaiTap>/                    ← UC04.2
    ├── Nhom01_<TenNhom>/                   ← khi nhóm được tạo (job)
    │   ├── Bai_chung/
    │   └── <MSSV>_<HoTen>/                 ← khi thành viên tham gia (job)
    └── CaNhan_<MSSV>_<HoTen>/              ← khi SV chọn làm cá nhân / lần nộp đầu
```
- Thư mục nhóm/cá nhân được tạo **lười** bằng job `drive.ensure-folder` (idempotent: kiểm tra `folder_id` trong CSDL trước).

#### UC04.4 Kiểm tra quyền ghi thư mục trên Drive
1. `files.get(folderId, fields=id,name,mimeType,driveId,trashed,capabilities, supportsAllDrives=true)`.
2. Kiểm tra: tồn tại, không ở thùng rác, `mimeType = folder`, `capabilities.canAddChildren = true`.
3. **Ghi thử**: tạo tệp `.eduportfolio_check.txt` (1 byte) rồi xóa vĩnh viễn ngay.

| Lỗi Google | Mã lỗi hệ thống | Hướng dẫn hiển thị |
|---|---|---|
| 404 / không thấy | `DRIVE_FOLDER_NOT_FOUND` | Link sai hoặc chưa chia sẻ cho SA |
| `mimeType` không phải folder | `DRIVE_NOT_A_FOLDER` | Hãy dán link thư mục, không phải tệp |
| `canAddChildren=false` / 403 | `DRIVE_NO_WRITE_PERMISSION` | Thêm SA với quyền Content manager |
| `storageQuotaExceeded` khi ghi thử | `DRIVE_NOT_SHARED_DRIVE` | Thư mục đang ở My Drive; chuyển sang Shared Drive |
| Shared Drive hết dung lượng | `DRIVE_QUOTA_EXCEEDED` | Liên hệ quản trị Workspace |

#### UC04.5 Sửa / Đóng bài tập
- Sửa: tiêu đề, mô tả, hạn nộp (gia hạn hay rút ngắn đều phải ≥ now), nộp muộn, loại sản phẩm (không bỏ được loại đã có tệp nộp), trọng số.
- Đổi tiêu đề → job đổi tên thư mục Drive (không bắt buộc thành công).
- **Đóng**: `status = CLOSED`, khóa mọi nhóm, không nhận bài. **Mở lại**: phải đặt hạn nộp mới > now.
- Gia hạn thì mở khóa các nhóm đã bị Bộ hẹn giờ khóa (nhóm do GV khóa tay thì giữ nguyên).
- Extend: UC04.6, UC04.7. Ghi log.

#### UC04.6 Đổi thư mục nhận bài
- GV dán link thư mục cha mới → **include UC04.4**.
  - Chưa có bài nộp: tạo thư mục bài tập mới trong thư mục mới, chuyển thư mục cũ (trống) vào thùng rác, cập nhật id.
  - Đã có bài nộp: xác nhận "Toàn bộ tệp sẽ được sao chép sang thư mục mới" → tạo cấu trúc mới, đánh dấu `assignments.drive_migration_status = RUNNING`, đưa job `drive.migrate-assignment` vào hàng đợi (dùng `files.copy` cho từng tệp, cập nhật `drive_file_id`, xong thì đưa thư mục cũ vào thùng rác). Trong lúc chạy, SV vẫn nộp được (tệp mới ghi vào thư mục mới).
- Báo GV khi xong hoặc lỗi.

#### UC04.7 Điều chỉnh thành viên nhóm
- **Sửa min/max:** đảm bảo `1 ≤ min ≤ max`. Giảm `max` dưới sĩ số một số nhóm → cảnh báo, liệt kê nhóm; các nhóm đó giữ người hiện có, không nhận thêm.
- **Điều chỉnh người:** GV xem danh sách SV chưa có nhóm; thêm SV vào nhóm, chuyển SV giữa nhóm, xóa SV khỏi nhóm, chỉ định trưởng nhóm. GV được làm kể cả khi nhóm khóa hoặc đã nộp (quyền ghi đè), nhưng vẫn không vượt `max` trừ khi tick "Vượt giới hạn" (ghi log).
- Thay đổi → job tạo/dọn thư mục cá nhân, thông báo `GROUP_MEMBER_CHANGED`.

#### UC04.8 Xóa bài tập
- **TĐK:** chưa có bài nộp nào. Xác nhận → xóa mềm (`deleted_at`), xóa nhóm, đề tài, lời mời liên quan; job đưa thư mục Drive vào thùng rác. Có bài nộp → `ASSIGNMENT_HAS_SUBMISSIONS`, gợi ý "Đóng bài tập".

#### UC04.9 Xem LHP & bài tập được giao (SV)
- Danh sách LHP kỳ hiện tại (đổi kỳ được): mã, môn, GV, lịch học.
- Chi tiết LHP: bài tập `OPEN`/`CLOSED` gồm tiêu đề, hạn (đếm ngược), hình thức, trạng thái của SV (*Chưa chọn hình thức / Chưa có đề tài / Chưa nộp / Đã nộp / Nộp muộn / Đã chấm (điểm) / Bị trả lại*).

---

### UC05 – Quản lý nhóm & đề tài

Điều kiện chung cho mọi thao tác SV: bài tập `OPEN`, chưa quá hạn cuối, SV thuộc LHP, hồ sơ đã hoàn thiện, nhóm chưa khóa.

#### UC05.1 Tạo nhóm
- **TĐK:** hình thức `GROUP` hoặc `CHOICE`; SV chưa thuộc nhóm nào của bài tập; chưa nộp bài cá nhân dạng làm cá nhân (với `CHOICE`).
- **Luồng:** nhập tên nhóm (3–50 ký tự, duy nhất trong bài tập) → tạo `groups` (số thứ tự `seq` tăng dần, `invite_code` 8 ký tự `A-Z2-9` bỏ ký tự dễ nhầm), thêm `group_members(role=LEADER)` → job tạo thư mục `NhomNN_<Ten>/Bai_chung` và thư mục cá nhân.
- **Chọn làm cá nhân (`CHOICE`)**: tạo `individual_works(assignment, student)`; đổi sang nhóm khi chưa nộp thì xóa bản ghi này.

#### UC05.2 Mời thành viên
- **Tác nhân:** Trưởng nhóm.
- **Cách 1 – MSSV:** nhập MSSV → kiểm tra BR-07 (cùng LHP, chưa có nhóm, chưa làm cá nhân đã nộp, nhóm chưa đủ tính cả lời mời đang chờ) → tạo `group_invitations(PENDING, expires_at = min(now+72h, hạn nộp))` → thông báo `GROUP_INVITED`.
- **Cách 2 – Mã mời:** hiển thị mã + nút sao chép link `/join/<code>`; "Làm mới mã" sinh mã mới, mã cũ hết hiệu lực.
- Trưởng nhóm hủy được lời mời đang chờ.

#### UC05.3 Phản hồi lời mời tham gia nhóm
- **Chấp nhận:** kiểm tra lại BR-07 trong transaction (khóa dòng nhóm `FOR UPDATE`) → thêm thành viên → hủy mọi lời mời đang chờ khác của SV trong bài tập này → thông báo trưởng nhóm → job tạo thư mục cá nhân. Nhóm đủ `max` thì hủy các lời mời còn lại.
- **Từ chối:** `DECLINED`, thông báo trưởng nhóm.
- **Nhập mã:** như chấp nhận, không cần lời mời. Mã sai → `GROUP_INVALID_CODE` (rate limit 10 lần/phút).

#### UC05.4 Xóa thành viên
- **TĐK:** trưởng nhóm; nhóm chưa có bài chung; chưa khóa; không xóa chính mình.
- Xóa `group_members`; job xóa thư mục cá nhân **nếu trống**; thông báo SV bị xóa.

#### UC05.5 Chuyển quyền trưởng nhóm
- Chọn thành viên → đổi `groups.leader_id` và vai trò → thông báo cả nhóm. Không cần nhóm chưa khóa.

#### UC05.6 Rời nhóm
- **TĐK:** nhóm chưa có bài chung, chưa khóa.
- Trưởng nhóm còn thành viên khác → `GROUP_LEADER_MUST_TRANSFER`. Nhóm còn 1 người → giải tán: xóa nhóm, đề tài, lời mời; job dọn thư mục nếu trống.
- Nhóm đã có bài chung → `GROUP_HAS_SUBMISSION`: "Liên hệ GV để được điều chỉnh" (UC04.7).

#### UC05.7 Đăng ký đề tài
- **Tác nhân:** bất kỳ thành viên nhóm / SV làm cá nhân.
- **Luồng:**
  1. Nhập tên (5–200), mô tả (≤ 1000), công nghệ/công cụ (≤ 200).
  2. Gõ tên → gọi `GET /topics/similar?assignmentId&title` → hiển thị cảnh báo nếu `similarity(normalize(title)) ≥ 0.6` với đề tài khác trong cùng LHP.
  3. **Include UC05.8.**
  4. Lưu `topics` (tạo hoặc sửa), ghi `topic_histories` (dữ liệu cũ/mới, người sửa); thông báo thành viên nhóm.
- Sau hạn cuối: SV không sửa được; GV sửa được.

#### UC05.8 Gắn từ khóa đề tài
- Ô tag có autocomplete (`GET /tags?q=` trả 10 tag gần nhất theo trigram, bỏ tag ẩn; tag đã gộp thì trả tag đích).
- Chuẩn hóa: trim, gộp khoảng trắng, `normalized = lower(unaccent(name))`. Trùng `normalized` thì dùng tag có sẵn; chưa có thì tạo mới.
- 1–5 tag, mỗi tag ≤ 50 ký tự.

#### UC05.9 Xem danh sách nhóm & đề tài (GV)
- Bảng theo bài tập: STT nhóm, tên nhóm, trưởng nhóm, thành viên, đề tài, từ khóa, trạng thái nhóm, trạng thái nộp, thời điểm nộp, điểm. Tab "SV làm cá nhân" và "SV chưa có nhóm/chưa chọn".
- Nút "Mở trên Google Drive" (link thư mục bài tập/nhóm). Xuất Excel.

#### UC05.10 Khóa nhóm
- **GV:** khóa/mở khóa từng nhóm hoặc tất cả (`locked_by = GV`).
- **Bộ hẹn giờ (mỗi phút):** bài tập có hạn cuối ≤ now và chưa xử lý → khóa mọi nhóm (`locked_by = null`, `lock_reason = DEADLINE`), hủy lời mời đang chờ, vô hiệu mã mời; nhóm có số thành viên < min → thông báo GV; đặt `assignments.deadline_processed_at`.
- Nhóm khóa: không thêm/bớt/rời, không sửa đề tài. Việc nộp bài do hạn nộp quyết định, không do khóa nhóm.

---

### UC06 – Nộp bài, xem & tìm kiếm bài nộp

#### UC06.1 Nộp bài nhóm / UC06.2 Nộp bài cá nhân
- **TĐK:** SV thuộc nhóm (UC06.1) hoặc thuộc LHP (UC06.2); đã có đề tài; bài tập `OPEN`; `now ≤ due_at` (hoặc `≤ late_due_at` nếu cho nộp muộn); bài chưa ở `GRADED` (trừ `RETURNED`).
- **Luồng:**
  1. Màn hình nộp: tab **Bài chung** / **Bài cá nhân** (bài tập nhóm), hoặc chỉ một khu vực (làm cá nhân). Hiển thị các ô theo loại sản phẩm đã cấu hình.
  2. SV kéo thả tệp → client kiểm tra sơ bộ (đuôi, dung lượng, số lượng) → upload từng tệp qua giao thức **tus** (chunk 5 MB, tải tiếp được, có tiến trình và nút hủy) vào `/api/v1/uploads`.
  3. SV nhập link Figma/Git, ghi chú, sắp xếp thứ tự ảnh (kéo thả) → bấm **Nộp bài**.
  4. Server `POST /submissions` với `{assignmentId, kind, uploadIds[], figmaUrl, gitUrl, note}`:
     - kiểm tra quyền và TĐK; kiểm tra magic bytes, dung lượng, số lượng (BR-13); kiểm tra domain link;
     - transaction: `SELECT ... FOR UPDATE` bài nộp hiện có; chưa có thì tạo, có rồi thì **UC06.4**; chuyển tệp tạm vào `storage/pending/<submissionId>/`; tạo `submission_files(sync_status=PENDING)`; `submitted_at = now`, `is_late = now > due_at`; trạng thái `SUBMITTED`/`LATE`; ghi `submission_events(SUBMIT)`;
     - sau commit: đẩy job `drive.upload-file` cho từng tệp (**include UC06.3**); phát socket `submission:updated` tới phòng `group:<id>`; thông báo `SUBMISSION_UPDATED`.
  5. Trả "Nộp bài thành công – đang đồng bộ lên Drive"; giao diện hiện trạng thái đồng bộ từng tệp.
- **Ngoại lệ:** quá hạn → `SUBMISSION_DEADLINE_PASSED`; sai định dạng thực → `FILE_INVALID_TYPE` (kèm tên tệp); vượt dung lượng/số lượng → `FILE_TOO_LARGE`/`FILE_TOO_MANY`; chưa có đề tài → `TOPIC_REQUIRED`; đã chấm → `SUBMISSION_ALREADY_GRADED`.
- Nộp muộn trừ điểm: lúc chấm, điểm hiệu lực = điểm × (1 − `late_penalty_percent`/100); hiển thị cả hai.

#### UC06.3 Ghi tệp lên Drive
- **Worker `drive.upload-file(fileId)`** (đồng thời tối đa 4, giới hạn 8 request/giây toàn hệ thống):
  1. Đặt `UPLOADING`. Bảo đảm thư mục đích tồn tại (job `ensure-folder` chạy nội tuyến): bài chung → `Nhom/Bai_chung`; bài cá nhân trong nhóm → `Nhom/<MSSV>_<HoTen>`; làm cá nhân → `CaNhan_<MSSV>_<HoTen>`.
  2. Upload **resumable** (`uploadType=resumable`, chunk 8 MB) với tên `NN_<tên gốc đã làm sạch>`; lấy `id`, `thumbnailLink`, `md5Checksum`; so md5 với tệp cục bộ.
  3. `SYNCED`, lưu `drive_file_id`; đặt `local_path` sang thư mục cache (giữ 7 ngày để xem nhanh, rồi dọn).
  4. Khi mọi tệp của bài đã `SYNCED`: ghi/ghi đè `thong_tin_bai_nop.txt` (đề tài, từ khóa, link Figma/Git, người nộp, thời gian) và đặt `submissions.sync_status = SYNCED`.
- **Lỗi:** lỗi tạm thời (429, 5xx, mạng) → BullMQ thử lại với backoff mũ (30 s, 1', 2', 4'… tối đa 8 lần). Lỗi vĩnh viễn (403 mất quyền, 404 thư mục bị xóa, quota) → `FAILED`, `last_error`, thông báo `SUBMISSION_SYNC_FAILED` + `DRIVE_FOLDER_PROBLEM` cho GV (gộp tối đa 1 email/bài tập/giờ). Tệp tạm vẫn giữ.

#### UC06.4 Nộp lại bài
- **Extend** UC06.1/06.2 khi đã có bài nộp. Client hiện hộp thoại "Bản nộp trước sẽ bị xóa vĩnh viễn. Tiếp tục?".
- Server trong transaction: tăng `version`, đánh dấu mọi tệp cũ `deleted_at = now` (ẩn ngay), tạo tệp mới, cập nhật link/ghi chú/`submitted_at`, nếu đang `RETURNED` thì về `SUBMITTED`/`LATE`; ghi `submission_events(RESUBMIT, {removed:[tên], added:[tên]})`.
- Sau commit: job `drive.trash-file` cho từng tệp cũ đã có `drive_file_id`; xóa tệp cục bộ.
- Hai thành viên nộp cùng lúc: khóa dòng làm cho các yêu cầu chạy tuần tự; yêu cầu sau ghi đè yêu cầu trước (BR-12); cả hai nhận `SUBMISSION_UPDATED`.

#### UC06.5 Xóa nhiều ảnh/tệp
- **TĐK:** như nộp bài (trước hạn cuối, chưa chấm).
- **Luồng:** ở chế độ "Chọn", SV tick nhiều tệp (có "Chọn tất cả") → "Xóa (n)" → xác nhận → `DELETE /submissions/:id/files` với `{fileIds[]}` → đánh dấu xóa, ghi `submission_events(DELETE_FILES)`, job đưa vào thùng rác Drive, đánh lại `sort_order`.
- Xóa hết tệp và không còn link → xóa bài nộp (trạng thái *Chưa nộp*); sự kiện vẫn được giữ (gắn `assignment_id` + chủ bài).

#### UC06.6 Xem lịch sử nộp bài
- Dòng thời gian từ `submission_events` của bài chung (mọi thành viên thấy) và bài cá nhân (chỉ chủ bài): thời gian, người thao tác, hành động, danh sách tệp thêm/xóa, phiên bản. GV xem được mọi lịch sử trong LHP.

#### UC06.7 Xem bài nộp
- **Kiểm tra:** `canViewSubmission` (§3.1). Với DN: **include UC09.6**.
- **Hiển thị:** đề tài + từ khóa, người nộp, thời gian, phiên bản, trạng thái, điểm/nhận xét (nếu người xem được xem điểm).
  - Ảnh: lưới thumbnail → bấm mở trình chiếu (Next/Prev, "3/12", dải thumbnail, phím ←/→/Esc, vuốt, zoom, toàn màn hình).
  - Video: thẻ `<video>` nguồn `/api/v1/files/:id/content`, hỗ trợ `Range` để tua.
  - Figma: nhúng `https://www.figma.com/embed?embed_host=eduportfolio&url=<url>` + nút mở tab.
  - Mã nguồn: tên, dung lượng, nút tải (nếu `canDownload`); link Git mở tab mới.
- **Tệp đang đồng bộ:** phục vụ từ bản cục bộ. **Tệp `MISSING`:** nhãn "Tệp không còn trên Drive".
- **Truy cập tệp:** `GET /files/:id/content` (stream, `Range`), `GET /files/:id/thumbnail?w=400` (sinh bằng sharp từ bản gốc, cache đĩa), `GET /files/:id/download` (header `Content-Disposition: attachment`, chỉ khi `canDownload`). Ảnh/video đặt `Cache-Control: private, max-age=3600`.

#### UC06.8 Tìm kiếm bài nộp
- **Tác nhân:** GV, DN, Admin.
- **Đầu vào:** từ khóa `q` (khớp tên đề tài, mô tả, tên tag, tên/MSSV SV), bộ lọc (học kỳ, môn, LHP, bài tập, loại môn, tag, khoảng điểm, trạng thái, nộp muộn), sắp xếp (độ liên quan, mới nhất, điểm).
- **Xử lý:** `unaccent(lower(q))` so với cột `search_text` đã chuẩn hóa của `topics` bằng `pg_trgm` (`%` và `word_similarity`) + `ILIKE` → giới hạn phạm vi theo vai trò (FR-06.13) → phân trang 20.
- **Kết quả:** thẻ bài: ảnh đại diện (thumbnail ảnh đầu), đề tài, tag, SV/nhóm, LHP, thời gian, điểm (không hiện với DN). Bấm → UC06.7. DN tìm thì ghi `enterprise_search_logs(scope=SUBMISSION)`.

#### UC06.9 Đồng bộ lại tệp lỗi
- **Bộ hẹn giờ (mỗi 10 phút):** chọn tệp `FAILED` có `retry_count < 20` và `next_retry_at ≤ now`; kiểm tra nhanh thư mục bài tập (UC04.4 không ghi thử); vẫn lỗi → `next_retry_at` tăng dần (10', 30', 1h, 3h, 6h…); hết lỗi → đưa lại `drive.upload-file`.
- **Kiểm tra định kỳ (03:00 hằng ngày):** với tệp `SYNCED` trong các bài tập còn mở hoặc đóng < 30 ngày, gọi `files.get` theo lô; tệp bị xóa/ở thùng rác → `MISSING`, báo GV.
- **GV thủ công:** trang "Tình trạng đồng bộ" của bài tập liệt kê tệp lỗi kèm nguyên nhân, nút "Thử lại tất cả".

#### UC06.10 Gửi nhắc hạn nộp bài
- **Bộ hẹn giờ (mỗi 15 phút):** với mỗi bài tập `OPEN` có `due_at - now ∈ (0, 24h]` (và `(0, 2h]`): tìm SV chưa nộp (làm cá nhân không có bài; nhóm không có bài chung → mọi thành viên; SV chưa chọn hình thức/chưa vào nhóm) → tạo `DEADLINE_REMINDER` với `dedupe_key = reminder:<assignmentId>:<studentId>:<24|2>`.
- **Khi qua hạn:** SV chưa nộp → `ACADEMIC_WARNING` cho PH (`dedupe_key = overdue:<assignmentId>:<studentId>`).

---

### UC07 – Quản lý & xem điểm

#### UC07.1 Chấm điểm bài tập
- **TĐK:** GV phụ trách; bài ở `SUBMITTED`/`LATE`/`GRADED`; bảng điểm học phần chưa công bố.
- **Luồng:** màn hình chấm 2 cột (trái: trình xem bài; phải: form) → nhập điểm 0–10 (bước 0,1), nhận xét → lưu: `submissions.score/feedback/graded_*`, `status = GRADED`; điểm hiệu lực sau trừ muộn; tạo/cập nhật `assignment_grades` cho **mỗi thành viên** (bài chung) hoặc chủ bài (bài cá nhân, làm cá nhân), trừ dòng đã ghi đè; thông báo `SUBMISSION_GRADED`.
- Nút "Bài tiếp theo" để chấm liên tục; chấm lại được (ghi log).
- Bài cá nhân trong bài tập nhóm: GV xem để tham khảo; nếu chấm thì điểm đó dùng làm điểm ghi đè cho SV (UC07.3).

#### UC07.2 Yêu cầu làm lại
- **Extend** UC07.1: nhập lý do* và hạn nộp lại* (> now) → `status = RETURNED`, `resubmit_due_at`; SV nộp lại được đến hạn này (bỏ qua hạn chung); thông báo `SUBMISSION_RETURNED`. Nhóm bị khóa vẫn giữ khóa (chỉ mở quyền nộp).

#### UC07.3 Cho điểm riêng từng thành viên
- **Extend** UC07.1 với bài chung: bảng thành viên, mỗi dòng có điểm mặc định = điểm nhóm, GV sửa điểm + ghi chú → `assignment_grades.is_override = true`. Có nút "Đặt lại theo điểm nhóm".

#### UC07.4 Nhập điểm học phần
- Bảng: MSSV, họ tên, chuyên cần, bài tập, giữa kỳ, cuối kỳ, tổng kết, điểm chữ, hệ 4 (3 cột cuối tự tính).
- **Cột bài tập:** nút "Tính từ bài tập" = Σ(điểm hiệu lực × trọng số bài tập)/Σ trọng số, chỉ tính bài đã chấm; SV không nộp bài nào tính 0. GV vẫn sửa tay được.
- Tổng kết = Σ(điểm thành phần × trọng số môn)/100, làm tròn 1 chữ số (BR-14); quy đổi theo BR-15. Thiếu thành phần thì để trống tổng kết.
- Lưu nháp tự động (debounce 1 s, `PATCH` theo ô). Import Excel (mẫu xuất từ chính bảng) có xem trước lỗi. Chặn khi đã công bố.

#### UC07.5 Xem bảng điểm lớp học phần
- Như UC07.4 ở chế độ chỉ đọc + điểm từng bài tập; lọc, sắp xếp, tô đỏ < 4,0; xuất Excel. Hiện nhãn "Đã công bố lúc …" nếu đã khóa.

#### UC07.6 Công bố điểm
- **TĐK:** mọi SV có đủ 4 thành phần (hoặc GV tick "Công bố cả SV thiếu điểm" → tổng kết thiếu thì để trống, không tính GPA).
- Xác nhận → `course_sections.grades_published_at = now`; `section_grades.status = PUBLISHED`; job `grades.recompute` tính lại `student_term_results` và `students.cpa` cho các SV liên quan; job `academic-warning.check`; thông báo `GRADES_PUBLISHED` cho SV và PH. Ghi log.

#### UC07.7 Yêu cầu sửa điểm sau khi khóa
- GV chọn SV trong bảng đã công bố → form: thành phần muốn sửa, giá trị mới, lý do* (≥ 10 ký tự), minh chứng (tùy chọn, tệp ≤ 5 MB, lưu cục bộ) → `grade_change_requests(PENDING, old_values, new_values)` → thông báo Admin.
- Mỗi SV/LHP chỉ có 1 yêu cầu `PENDING`; GV hủy được khi còn chờ.

#### UC07.8 Xử lý yêu cầu sửa điểm của GV
- Admin xem danh sách chờ: GV, LHP, SV, điểm cũ → mới (tổng kết dự kiến), lý do, minh chứng.
- **Duyệt:** transaction áp dụng giá trị mới vào `section_grades`, tính lại tổng kết, ghi `audit_logs(GRADE_CHANGED)` với dữ liệu cũ/mới, `status = APPROVED` → job `grades.recompute` cho SV → thông báo GV và SV.
- **Từ chối:** lý do bắt buộc → thông báo GV.

#### UC07.9 Xem điểm của bản thân (SV)
- Tab "Theo học kỳ": từng học phần đã công bố (thành phần, tổng kết, chữ, hệ 4, tín chỉ), GPA kỳ, tín chỉ kỳ.
- Tab "Bài tập": điểm và nhận xét từng bài đã chấm (kể cả khi học phần chưa công bố).
- Thẻ tổng: CPA, tổng tín chỉ tích lũy, xếp loại (Xuất sắc ≥ 3,6 · Giỏi ≥ 3,2 · Khá ≥ 2,5 · TB ≥ 2,0 · Yếu < 2,0).

---

### UC08 – Xem kết quả học tập của con (PH)

Mọi API của PH đi qua `ParentChildGuard`: lấy `selectedStudentId` từ token, kiểm tra liên kết còn hiệu lực.

#### UC08.1 Chọn con cần xem
- Giống UC01.3; hiển thị ở header mọi trang.

#### UC08.2 Xem điểm, GPA, CPA của con
- Giống UC07.9 nhưng chỉ đọc; thêm biểu đồ đường GPA theo kỳ và cột tín chỉ. Không thấy điểm chưa công bố, nhưng thấy điểm bài tập đã chấm.

#### UC08.3 Xem bài nộp của con
- Danh sách theo kỳ → LHP → bài tập: trạng thái, thời gian nộp, đề tài, điểm. Bấm vào thì mở UC06.7 (chế độ PH: không tải). Bài cá nhân của con và bài chung của nhóm con tham gia.

#### UC08.4 Xem thông báo, cảnh báo học tập của con
- Tab "Cảnh báo": danh sách `academic_warnings` của con (loại, nội dung, thời gian, đối tượng liên quan), lọc theo loại.
- Tab "Thông báo": thông báo gửi tới tài khoản PH.
- **Sinh cảnh báo** (job `academic-warning.check`, chạy sau khi công bố điểm và khi qua hạn nộp):

| Loại | Điều kiện |
|---|---|
| `OVERDUE_SUBMISSION` | Qua hạn cuối mà SV chưa có bài |
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
- Thẻ: tổng SV/GV/PH/DN (active), LHP kỳ này, bài tập đang mở, bài nộp tuần này, tệp chờ/lỗi đồng bộ, DN chờ duyệt, yêu cầu xem bài chờ, yêu cầu sửa điểm chờ (bấm để đi tới trang xử lý).
- Biểu đồ: bài nộp theo ngày (30 ngày), người dùng đăng nhập theo ngày, phân bố CPA toàn trường.

#### UC10.2 Xem thống kê doanh nghiệp (Admin)
- Bộ lọc: khoảng thời gian, lĩnh vực DN, ngành SV.
- Chỉ số: DN theo trạng thái; DN mới theo tháng; DN theo lĩnh vực (tròn); DN hoạt động 30 ngày; yêu cầu theo trạng thái; tỉ lệ duyệt; thời gian xử lý trung bình (`approved_at - created_at`); quyền còn hiệu lực; yêu cầu theo tháng; lượt tìm kiếm theo ngày; tiêu chí lọc dùng nhiều; tag được tìm nhiều; top 10 SV được yêu cầu/xem; phân bố ngành/khóa/CPA của SV được yêu cầu; top 10 DN hoạt động.

#### UC10.3 Xem thống kê lớp học phần (Admin, GV)
- Chọn học kỳ → LHP. Chỉ số: sĩ số; mỗi bài tập: % đúng hạn / muộn / chưa nộp (cột chồng), danh sách SV chưa nộp; điểm TB từng bài; phổ điểm tổng kết (histogram bước 1,0); phân bố điểm chữ; top tag đề tài; số SV được DN quan tâm.
- Admin xem được mọi LHP và so sánh giữa các LHP cùng môn.

#### UC10.4 Xem thống kê cá nhân sinh viên
- GPA theo kỳ (đường), CPA, tín chỉ tích lũy, tiến độ nộp bài kỳ hiện tại (đã nộp/tổng, đúng hạn/muộn), điểm TB bài tập theo môn, số DN đã xem, số lượt xem.

#### UC10.5 Xem thống kê của doanh nghiệp mình
- Yêu cầu theo trạng thái; quyền còn hạn kèm số ngày còn lại; số SV đã xem bài; số lượt xem theo ngày; 20 lần tìm kiếm gần nhất (tiêu chí, số kết quả, bấm để tìm lại).

#### UC10.6 Xuất báo cáo
- **Extend** UC10.1/10.2/10.3: nút "Xuất Excel" / "Xuất PDF" với bộ lọc đang chọn.
- Excel (ExcelJS): mỗi chỉ số một sheet, có tiêu đề, bộ lọc, ngày xuất. PDF (pdfmake, font Roboto hỗ trợ tiếng Việt): bảng + biểu đồ (ảnh PNG chụp từ client gửi lên kèm yêu cầu).
- Báo cáo lớn (> 5.000 dòng) chạy job nền; xong thì thông báo kèm link tải (hết hạn sau 24h).

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

## 7. Mã lỗi chuẩn

Định dạng phản hồi lỗi:

```json
{ "statusCode": 409, "code": "GROUP_FULL", "message": "Nhóm đã đủ 5 thành viên", "details": { "max": 5 } }
```

| Nhóm | Mã |
|---|---|
| Chung | `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500) |
| Auth | `AUTH_INVALID_CREDENTIALS`, `AUTH_TEMP_LOCKED`, `AUTH_ACCOUNT_LOCKED`, `AUTH_PENDING_APPROVAL`, `AUTH_REJECTED`, `AUTH_MUST_CHANGE_PASSWORD`, `AUTH_PROFILE_INCOMPLETE`, `AUTH_TOKEN_INVALID`, `PARENT_NO_CHILD` |
| Admin | `CATALOG_IN_USE`, `SCHEDULE_CONFLICT`, `SECTION_FULL`, `IMPORT_INVALID_FILE`, `ENTERPRISE_DUPLICATE` |
| Drive | `DRIVE_FOLDER_NOT_FOUND`, `DRIVE_NOT_A_FOLDER`, `DRIVE_NO_WRITE_PERMISSION`, `DRIVE_NOT_SHARED_DRIVE`, `DRIVE_QUOTA_EXCEEDED`, `DRIVE_NOT_LINKED` |
| Bài tập | `ASSIGNMENT_INVALID_DATES`, `ASSIGNMENT_HAS_SUBMISSIONS`, `ASSIGNMENT_CLOSED` |
| Nhóm | `GROUP_FULL`, `GROUP_LOCKED`, `GROUP_ALREADY_MEMBER`, `GROUP_NOT_SAME_SECTION`, `GROUP_INVALID_CODE`, `GROUP_LEADER_MUST_TRANSFER`, `GROUP_HAS_SUBMISSION`, `INVITATION_EXPIRED` |
| Đề tài | `TOPIC_REQUIRED`, `TOPIC_TAG_LIMIT`, `TOPIC_EDIT_CLOSED` |
| Nộp bài | `SUBMISSION_DEADLINE_PASSED`, `SUBMISSION_ALREADY_GRADED`, `FILE_INVALID_TYPE`, `FILE_TOO_LARGE`, `FILE_TOO_MANY`, `LINK_INVALID_DOMAIN`, `UPLOAD_NOT_FOUND` |
| Điểm | `GRADES_LOCKED`, `GRADE_WEIGHTS_INVALID`, `GRADE_REQUEST_PENDING_EXISTS` |
| DN | `VIEW_REQUEST_DUPLICATE`, `VIEW_ACCESS_EXPIRED`, `VIEW_DAYS_OUT_OF_RANGE` |

## 8. Danh sách màn hình

| Vai trò | Màn hình |
|---|---|
| Chung | Đăng nhập (2 tab), Quên/Đặt lại mật khẩu, Đổi mật khẩu (lần đầu và thường), Đăng ký DN, Thông báo, 403/404 |
| Admin | Dashboard; GV; SV (+ import); PH (+ đổi SĐT); DN (duyệt); Danh mục (khoa, ngành, khóa, lớp, phòng, lĩnh vực, từ khóa); Học kỳ; Môn học; LHP (+ lịch, xếp SV); Yêu cầu xem bài; Quyền đang hiệu lực; Yêu cầu sửa điểm; Tìm bài nộp; Thống kê DN; Thống kê LHP; Nhật ký; Cấu hình |
| GV | LHP của tôi; Chi tiết LHP (SV, bài tập, bảng điểm, thống kê); Tạo/Sửa bài tập; Chi tiết bài tập (nhóm & đề tài, bài nộp, tình trạng đồng bộ); Chấm bài; Bảng điểm học phần; Yêu cầu sửa điểm của tôi; Tìm bài nộp; Liên kết Google Drive; Hồ sơ cá nhân |
| SV | Khai báo hồ sơ; LHP của tôi; Chi tiết bài tập (hình thức, nhóm, đề tài, nộp bài, lịch sử); Lời mời của tôi; Tham gia bằng mã; Điểm của tôi; Thống kê cá nhân; DN đã xem tôi; Hồ sơ & quyền riêng tư |
| PH | Chọn con; Tổng quan; Điểm; Bài nộp; Cảnh báo & thông báo |
| DN | Tìm SV; Hồ sơ SV; Yêu cầu của tôi; Bài nộp của SV; Tìm bài nộp; Thống kê; Hồ sơ DN |
