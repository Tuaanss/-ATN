# EduPortfolio – Danh sách công việc kỹ thuật (Tech Tasks)

> Phiên bản 2.1 · 07/10/2026 · Lịch mới: **demo xong 31/10** → **tháng 11 chạy thử trên server thật** → **cơ bản hoàn thiện 06/12** → bảo vệ cuối tháng 12
> Chia nhỏ công việc theo sprint ở [Plan_project](Plan_project.md). Ước lượng tính bằng **giờ làm thủ công** cho 1 người (xem cách quy đổi ở dưới).
> Ưu tiên: P1 = MVP, P2 = nên có. Trạng thái cập nhật ở cột cuối: ☐ chưa làm · ◐ đang làm · ☑ xong.

---

## Cách đọc ước lượng

- Tháng 10 có **274 giờ** việc trong khoảng 3,5 tuần, tức khoảng 78 giờ/tuần nếu tự viết toàn bộ. Làm một mình thì không đạt nhịp này.
- Kế hoạch giả định có **trợ lý AI viết code** (Claude Code) cho phần lặp lại (CRUD, form, bảng, DTO, test), và người thực hiện tập trung vào nghiệp vụ khó, review và chạy thử. Khi đó thời gian thực tế khoảng 55–60% ước lượng, tức **~45 giờ/tuần** trong tháng 10.
- Cuối mỗi sprint tháng 10 mà burndown chậm hơn 20% thì áp dụng ngay danh sách cắt giảm demo ([Plan_project §3.3](Plan_project.md#33-thứ-tự-cắt-giảm-khi-trễ)).

## Definition of Done

**Tháng 10 (giai đoạn demo), bản rút gọn:**
1. Code qua `lint` + `typecheck`.
2. Có unit test cho logic lõi: `shared/grading`, đồng bộ PH, trùng lịch, `SubmissionAccessPolicy`, ràng buộc nhóm.
3. Quyền được kiểm tra ở server (Roles + Policy).
4. Chạy được luồng thật trên giao diện, kể cả với Shared Drive thật.

**Từ tháng 11 trở đi, bản đầy đủ** (task tháng 10 phải đạt bản này trước 06/12):
1. Như trên, cộng thêm: endpoint có ít nhất 1 e2e test (Supertest), có test trường hợp bị từ chối quyền.
2. Lỗi trả đúng `ErrorCode` ([Specification §7](Specification.md#7-mã-lỗi-chuẩn)), thông điệp tiếng Việt; Swagger đúng.
3. Giao diện có trạng thái đang tải / trống / lỗi; dùng được ở chiều rộng 375 px.
4. Migration chạy được trên DB trống và DB trên server (không mất dữ liệu chạy thử).

---

# GIAI ĐOẠN 1 – XÂY DỰNG DEMO (08/10 – 31/10/2026)

## Sprint 0 – Nền tảng (08/10 – 11/10) · 33h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-000 | Spike Google Drive | Tạo GCP project, SA, Shared Drive; script tải 1 tệp 50 MB bằng resumable upload vào Shared Drive (mốc M0) | 04, 06 | – | 3 | ☐ |
| T-001 | Khởi tạo monorepo | pnpm workspaces, `tsconfig.base`, ESLint, Prettier, Husky + lint-staged, `.editorconfig`, `.env.example` | – | – | 3 | ☐ |
| T-002 | Gói `shared` | `enums.ts`, `errors.ts`, `constants.ts`, `grading.ts` (kèm test BR-14/15) | – | T-001 | 3 | ☐ |
| T-003 | Docker dev | `compose.dev.yml`: postgres 16 (bật extension), redis 7, mailpit | – | – | 2 | ☐ |
| T-004 | Khung NestJS | Config đọc env qua Zod, nestjs-pino, Swagger, `/api/health`, entry `main.ts` + `worker.ts` | – | T-001 | 4 | ☐ |
| T-005 | Prisma schema v1 | Đủ 46 bảng theo DatabaseDesign; migration SQL cho extension, `f_unaccent`, partial unique, CHECK, GIN index | – | T-003 | 9 | ☐ |
| T-006 | Common BE | `AppException`, `AllExceptionsFilter`, `ZodValidationPipe`, pagination, `afterCommit()`, Redis lock | – | T-004 | 4 | ☐ |
| T-007 | Khung React | Vite + TS, AntD `vi_VN`, React Router, TanStack Query, `ky` có tự refresh, layout, trang 403/404 | – | T-001 | 5 | ☐ |

**Mốc:** `pnpm dev` chạy cả web lẫn api; schema đủ bảng; SA ghi được tệp vào Shared Drive.

## Sprint 1 – Xác thực, quản trị, hồ sơ, hạ tầng Drive (12/10 – 18/10) · 80h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-101 | Đăng nhập & token | Argon2id, `POST /auth/login` (2 kiểu), cookie access/refresh, rotation + phát hiện dùng lại, khóa 5 lần/15', `/auth/me`, `/auth/logout` | 01.1, 01.2, 01.7 | T-005 | 8 | ☐ |
| T-102 | Chuỗi guard | JwtAuth, MustChangePassword, ProfileComplete, Roles, `@Public`, `@Roles`, `@CurrentUser` | 01.4 | T-101 | 4 | ☐ |
| T-103 | Đổi mật khẩu | Lần đầu + thông thường; chính sách mật khẩu; thu hồi phiên khác | 01.4, 01.6 | T-102 | 3 | ☐ |
| T-105 | Đăng ký DN | Form, `users(PENDING)` + `enterprises`, thông báo Admin (Turnstile để sang T-607) | 01.8 | T-101 | 3 | ☐ |
| T-106 | FE xác thực | Login 2 tab, đổi mật khẩu bắt buộc, đăng ký DN, `RequireAuth/RequireRole`, session store | 01.x | T-007, T-101 | 6 | ☐ |
| T-107 | Danh mục | BE CRUD 6 danh mục (generic) + chặn xóa khi đang dùng; FE dạng tab, `DataTable` + form modal | 02.6 | T-102 | 8 | ☐ |
| T-108 | Học kỳ & môn học | CRUD; kỳ không chồng lấn, một kỳ hiện tại; trọng số tổng 100 | 02.8 | T-107 | 5 | ☐ |
| T-109 | LHP + kiểm tra trùng lịch | CRUD LHP kèm `schedules[]`; `ScheduleConflictService` + test; FE hiển thị xung đột | 02.9, 02.11 | T-108 | 7 | ☐ |
| T-110 | Tài khoản GV & SV | CRUD, lọc, khóa/mở, đặt lại mật khẩu; FE 2 trang | 02.1, 02.2 | T-107 | 6 | ☐ |
| T-204 | Thông báo lõi | `NotificationService.notify` (dedupe), API danh sách/đếm/đọc; FE chuông (polling 30 s, socket làm ở T-402) | 11.1, 11.3 | T-102 | 6 | ☐ |
| T-206 | Khai báo hồ sơ + đồng bộ PH | `PUT /me/profile`, BR-01, `ParentLinkSyncService` trong transaction; unit test các nhánh | 03.1–3.3 | T-102 | 8 | ☐ |
| T-207 | FE hồ sơ SV | Màn hình khai báo bắt buộc (thông báo NĐ 13), cập nhật hồ sơ, công tắc discoverable, avatar | 03.1–3.4 | T-206 | 5 | ☐ |
| T-209 | Duyệt DN | Danh sách theo trạng thái, duyệt/từ chối/khóa, thông báo; FE | 02.7 | T-204 | 4 | ☐ |
| T-210 | Hạ tầng Google Drive | `DriveClientFactory` (SA), `DriveService` (get, createFolder, upload resumable, trash, copy, stream Range), ánh xạ lỗi, `FakeDriveService` | 04.3, 04.4 | T-000, T-006 | 7 | ☐ |

**Mốc:** mọi vai trò đăng nhập được; Admin dựng dữ liệu nền; SV khai báo hồ sơ thì PH đăng nhập được bằng SĐT.

## Sprint 2 – Bài tập, nhóm, đề tài, nộp bài, trình xem (19/10 – 25/10) · 84h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-211 | Liên kết Drive (GV) | `verifyWritable` (ghi thử), `lecturer_drive_links`, FE hướng dẫn 3 bước | 04.1, 04.4 | T-210 | 4 | ☐ |
| T-212 | Tạo bài tập (BE) | BR-04, xác minh thư mục, tạo thư mục, bù trừ khi lỗi, `DRAFT/OPEN`, thông báo mở bài | 04.2–4.4 | T-211, T-204 | 4 | ☐ |
| T-301 | FE bài tập (GV) + sửa/đóng/xóa | Form tạo/sửa (gợi ý loại sản phẩm), đóng/mở lại, xóa (chặn nếu có bài), chi tiết dạng tab | 04.2, 04.5, 04.8 | T-212 | 6 | ☐ |
| T-302 | Hạ tầng scheduler | Repeatable jobs trong worker, Bull Board, job `assignments.open-due` | 04.2 | T-006 | 4 | ☐ |
| T-303 | SV xem LHP & bài tập | `/sections/mine`, chi tiết LHP, `/assignments/:id/my-work`; FE | 04.9 | T-212 | 4 | ☐ |
| T-304 | Nhóm (BE) | Tạo nhóm/làm cá nhân, mời MSSV, mã mời, chấp nhận/từ chối/nhập mã (khóa dòng), xóa TV, chuyển trưởng nhóm, rời/giải tán; `ensure-folder`; test cạnh tranh | 05.1–5.6 | T-303, T-210 | 10 | ☐ |
| T-305 | Nhóm (FE SV) | Chọn hình thức, tạo nhóm, mời, lời mời, `/join/:code`, quản lý thành viên | 05.1–5.6 | T-304 | 6 | ☐ |
| T-306 | Đề tài & từ khóa | `PUT /assignments/:id/topic`, chuẩn hóa tag, autocomplete trigram, cảnh báo trùng, lịch sử; FE TagInput | 05.7, 05.8 | T-304 | 7 | ☐ |
| T-308 | Upload tus | `@tus/server` trong Nest, xác thực, giới hạn kích thước, bảng `uploads` | 06.1–6.2 | T-006 | 5 | ☐ |
| T-309 | Nộp / nộp lại / xóa tệp (BE) | Policy, magic bytes, transaction + `FOR UPDATE`, version, events, `afterCommit` enqueue | 06.1, 06.2, 06.4, 06.5 | T-306, T-308 | 8 | ☐ |
| T-310 | Processor Drive | `upload-file` (resumable, md5), `trash-file`, `ensure-folder` (khóa Redis), phân loại lỗi, backoff, `thong_tin_bai_nop.txt` | 06.3 | T-309 | 6 | ☐ |
| T-401 | FE nộp bài | Uppy (tus, tiến trình, hủy, tải tiếp), sắp xếp ảnh, chọn nhiều để xóa, xác nhận nộp lại, huy hiệu đồng bộ, tab Bài chung / Bài cá nhân | 06.1–6.5 | T-309 | 8 | ☐ |
| T-403 | Stream tệp & policy | `SubmissionAccessPolicy` (5 vai trò, test bảng chân trị), `/files/:id/content` (Range), thumbnail sharp + cache, download | 06.7 | T-310 | 6 | ☐ |
| T-404 | Trình xem đa phương tiện | `ImageSlideshow`, `VideoPlayer`, `FigmaEmbed`, `FileList`; trang `/submissions/:id` | 06.7 | T-403 | 6 | ☐ |

**Mốc M1 (25/10):** vòng lõi chạy trên Drive thật: GV giao bài → SV lập nhóm, đăng ký đề tài → nộp ảnh/video → tệp nằm đúng thư mục nhóm → GV xem trình chiếu, video.

## Sprint 3 – Điểm, phụ huynh, doanh nghiệp, thống kê, triển khai lên server (26/10 – 31/10) · 77h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-201a | Xếp SV vào LHP (chọn tay) | Chọn SV, cảnh báo vượt sĩ số và trùng lịch SV, gỡ SV | 02.10 | T-109 | 3 | ☐ |
| T-407 | Job hạn nộp | `groups.lock-at-deadline`, `invitations.expire`, `reminders.deadline` (dedupe) | 05.10, 06.10 | T-302 | 4 | ☐ |
| T-408 | Chấm bài | Chấm + trừ muộn, `assignment_grades`, ghi đè từng người, yêu cầu làm lại; FE màn hình chấm 2 cột | 07.1–7.3 | T-404 | 6 | ☐ |
| T-409a | Bảng điểm học phần | Lưới nhập lưu theo ô, "Tính từ bài tập", tính tổng/chữ/hệ 4 (chưa có Excel) | 07.4, 07.5 | T-408 | 6 | ☐ |
| T-410 | Công bố & GPA | Publish (khóa), `recompute-gpa`, `student_term_results`, `students.cpa`; FE "Điểm của tôi" | 07.6, 07.9 | T-409a | 6 | ☐ |
| T-503a | Cổng phụ huynh | Chọn/đổi con, `ParentChildGuard`, tổng quan, điểm + biểu đồ GPA, bài nộp (không tải) | 01.3, 08.1–8.3 | T-410, T-404 | 6 | ☐ |
| T-504 | Tìm SV (DN) | Truy vấn §6.2, cập nhật `search_text/topic_count`, log tìm kiếm; FE bộ lọc + kết quả + nhãn quyền | 09.1 | T-306 | 10 | ☐ |
| T-505 | Hồ sơ công khai & gửi yêu cầu | `StudentPublicProfile` (test không lộ trường nhạy cảm), log VIEW_PROFILE, yêu cầu nhiều SV, hủy; FE | 09.2–9.4 | T-504 | 6 | ☐ |
| T-506 | Admin xử lý quyền xem | Duyệt/từ chối hàng loạt, thu hồi, quyền đang hiệu lực; job `view-requests.expire` + `expiring` | 09.8–9.10 | T-505 | 5 | ☐ |
| T-507 | DN xem bài + nhật ký truy cập | `/enterprise/students/:id/submissions`, policy DN, ghi log (gộp 10') | 09.5, 09.6 | T-506, T-403 | 4 | ☐ |
| T-601 | Dashboard Admin | Thẻ số liệu + 3 biểu đồ, cache 5' | 10.1 | T-506 | 6 | ☐ |
| T-603 | Thống kê LHP | Tỉ lệ nộp, SV chưa nộp, phổ điểm, điểm chữ, top tag | 10.3 | T-410 | 6 | ☐ |
| T-609 | Dữ liệu seed demo | Seed theo DatabaseDesign §7, tệp media mẫu, tài khoản demo mỗi vai trò | – | – | 5 | ☐ |
| T-311 | Triển khai lên server | Dockerfile, `compose.prod.yml`, Caddy HTTPS trên VPS, Shared Drive demo, seed | – | T-609 | 4 | ☐ |

**Mốc M2 – DEMO (31/10):** đủ luồng chính của 11 nhóm use case trên server thật (URL HTTPS) (kịch bản ở Plan_project §11).

---

# GIAI ĐOẠN 2 – CHẠY THỬ TRÊN SERVER THẬT (01/11 – 06/12/2026)

## Sprint 4 – Hoàn thiện server & P1 còn lại (01/11 – 08/11) · 43h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-008 | CI GitHub Actions | install → lint → typecheck → test (Testcontainers) → build → push image | – | – | 2 | ☐ |
| T-703 | Hoàn thiện triển khai trên server | CI tự deploy lên VPS (SSH + `docker compose pull/up`), `prisma migrate deploy`, backup `pg_dump` hằng ngày, SMTP thật | – | T-311, T-008 | 4 | ☐ |
| T-111 | Import SV Excel | File mẫu, preview lỗi từng ô, commit, `import_jobs`, file kết quả; FE wizard | 02.3 | T-110 | 6 | ☐ |
| T-201b | Import danh sách LHP | Upload danh sách MSSV vào LHP | 02.10 | T-201a, T-111 | 2 | ☐ |
| T-205 | Hàng đợi mail | `mail.send`, template HTML, SMTP thật (Brevo, có SPF/DKIM) | 11.2 | T-204 | 3 | ☐ |
| T-104 | Quên mật khẩu | Token hash 30', gửi qua mail queue, rate limit | 01.5 | T-205 | 4 | ☐ |
| T-202 | Audit | `AuditService`, `@Audit` interceptor cho auth/admin/điểm/nộp bài/quyền DN | 02.12 | – | 3 | ☐ |
| T-203 | Cấu hình hệ thống (BE) | `settings` + cache + giá trị mặc định | 02.13 | – | 3 | ☐ |
| T-501 | Yêu cầu sửa điểm | GV tạo/hủy; Admin duyệt (kiểm tra lệch, áp dụng, audit, recompute) / từ chối; FE | 07.7, 07.8 | T-410, T-202 | 5 | ☐ |
| T-406 | Tìm kiếm bài nộp | Truy vấn trigram + bộ lọc + phạm vi theo vai trò (Admin/GV/DN), cập nhật `topics.search_text`; FE trang tìm dùng chung | 06.8 | T-403 | 6 | ☐ |
| T-712 | Chuẩn bị chạy thử | Seed bộ dữ liệu kiểm thử sát thực tế (2 học kỳ, ~120 SV, 6 GV, dữ liệu giả); checklist kịch bản theo Plan_project §14; mẫu biên bản chạy thử | – | T-703, T-111 | 5 | ☐ |

**Mốc M3 (08/11):** server tự deploy từ `main`, email thật hoạt động, dữ liệu và checklist chạy thử sẵn sàng.

## Sprint 5 – Chạy thử vòng 1 (GV–SV) & hoàn thiện P2 (09/11 – 22/11) · 61h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-402 | Realtime | Socket.IO (cookie auth, phòng user/group), Redis emitter cho worker; FE invalidate query + toast; bỏ polling | 06.1, 11.1 | T-204 | 4 | ☐ |
| T-405 | Lịch sử nộp bài | API events theo quyền, FE dòng thời gian | 06.6 | T-309 | 3 | ☐ |
| T-409b | Excel bảng điểm | Xuất/nhập Excel có preview | 07.4 | T-409a | 3 | ☐ |
| T-502 | Cảnh báo học tập | Job `academic-warning-check` (4 loại, ngưỡng từ settings, dedupe) | 08.4 | T-410, T-407 | 4 | ☐ |
| T-503b | Cảnh báo trong cổng PH | Tab cảnh báo & thông báo của con | 08.4 | T-502 | 2 | ☐ |
| T-208 | Quản lý PH & đổi SĐT | Danh sách PH + con, khóa, đặt lại mật khẩu, `change-phone` có gộp; FE | 02.4, 02.5 | T-206 | 5 | ☐ |
| T-508 | SV xem DN đã xem mình | API + FE | 09.11 | T-507 | 3 | ☐ |
| T-509 | Độ bền đồng bộ Drive | `drive.retry-failed`, `verify-files`, `health-check`; trang "Tình trạng đồng bộ" cho GV; gộp email lỗi | 06.9 | T-310 | 6 | ☐ |
| T-510 | Đổi thư mục nhận bài | `change-folder` 2 nhánh, `migrate-assignment` (files.copy); FE | 04.6 | T-509 | 5 | ☐ |
| T-511 | Đổi tên thư mục | `rename-folder` (best-effort) | 04.5 | T-310 | 2 | ☐ |
| T-307 | GV quản lý nhóm (đầy đủ) | Bảng nhóm & đề tài, SV chưa có nhóm, thêm/chuyển/xóa TV, sửa min/max, khóa/mở, xuất Excel | 04.7, 05.9, 05.10 | T-304 | 6 | ☐ |
| T-702 | Test API e2e | Bổ sung e2e cho các task tháng 10 theo DoD đầy đủ; ca TC-01 – TC-20 | – | T-008 | 6 | ☐ |
| T-713a | Chạy thử vòng 1 trên server | Chạy kịch bản vai GV/SV (gồm cố ý gây lỗi Drive), ghi kết quả và số liệu, sửa lỗi phát sinh | – | T-712 | 10 | ☐ |
| T-706a | Báo cáo: mở đầu, chương 1–2 | Cơ sở lý thuyết, khảo sát & phân tích (dựa trên Requirement, Specification) | – | – | 8 | ☐ |

> T-307 nằm trong demo ở mức tối thiểu (bảng nhóm & đề tài, khóa nhóm, làm trong T-304/T-305); sprint này làm bản đầy đủ.

## Sprint 6 – Chạy thử vòng 2 (PH–DN–Admin), hoàn thiện, đóng băng (23/11 – 06/12) · 73h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-602 | Thống kê DN | Các chỉ số FR-10.02 + bộ lọc | 10.2 | T-507 | 6 | ☐ |
| T-604 | Thống kê SV & DN mình | FR-10.04, FR-10.05 | 10.4, 10.5 | T-508 | 5 | ☐ |
| T-605 | Xuất báo cáo | ExcelJS, pdfmake (Roboto), queue `reports`, link tải 24h | 10.6 | T-601–T-603 | 8 | ☐ |
| T-606 | Nhật ký & cấu hình (FE) | Tra cứu audit (diff JSON), trang cấu hình, gộp/ẩn tag | 02.12, 02.13, 02.6 | T-202, T-203 | 5 | ☐ |
| T-607 | Bảo mật | Throttler Redis, helmet + CSP, kiểm tra `Origin`, Turnstile, rà soát quyền mọi controller; ZAP baseline | NFR | – | 4 | ☐ |
| T-608 | Hoàn thiện UI/UX | Responsive, trạng thái trống/lỗi, thông điệp mọi ErrorCode, sửa theo lỗi phát hiện khi chạy thử | NFR-10, 11 | – | 8 | ☐ |
| T-610 | Hiệu năng | Dữ liệu giả 10⁴ SV/10⁵ bài (DB riêng), `EXPLAIN ANALYZE`, k6 500 VU | NFR-01, 02 | – | 5 | ☐ |
| T-701 | E2E Playwright | 8 kịch bản chính (xem Plan_project §8) | Tất cả | – | 10 | ☐ |
| T-705 | Tài liệu sử dụng | Hướng dẫn theo vai trò, hướng dẫn SA/Shared Drive cho GV, README | – | – | 4 | ☐ |
| T-713b | Chạy thử vòng 2 trên server | Chạy kịch bản vai PH/DN/Admin, chạy lại toàn bộ E2E trên server; sửa lỗi; lập biên bản chạy thử và số liệu cho chương 5 | – | T-713a | 10 | ☐ |
| T-706b | Báo cáo: chương 3 | Thiết kế hệ thống (dựa trên Architecture, DatabaseDesign, ModuleFlows) | – | – | 8 | ☐ |

**Mốc M4 – CƠ BẢN HOÀN THIỆN (06/12):** đủ 11 nhóm use case, DoD đầy đủ, không còn lỗi mức Nghiêm trọng/Cao; tag `v1.0.0-rc`, **đóng băng tính năng**.

---

# GIAI ĐOẠN 3 – BÁO CÁO & BẢO VỆ (07/12 – cuối 12/2026)

## Sprint 7 – Báo cáo, slide, chỉ sửa lỗi (07/12 – bảo vệ) · 38h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|
| T-706c | Báo cáo: chương 4–5, kết luận | Cài đặt, kiểm thử & kết quả chạy thử trên server; chỉnh sửa toàn bộ theo góp ý GVHD; nộp bản cuối trước hạn khoa | T-706a, T-706b | 16 | ☐ |
| T-707 | Slide & kịch bản demo | Slide, kịch bản 15 phút, video demo dự phòng, bản chạy local dự phòng | M4 | 8 | ☐ |
| T-714 | Sửa lỗi & bảo trì | Chỉ sửa lỗi, không thêm tính năng; giữ server chạy ổn định đến ngày bảo vệ | M4 | 10 | ☐ |
| T-715 | Tổng duyệt | 2 lần chạy thử bảo vệ có hẹn giờ, rà câu hỏi hội đồng | T-707 | 4 | ☐ |

`v1.0.0` được tag sau buổi bảo vệ.

## Tổng hợp

| Sprint | Thời gian | Giờ (thủ công) | Nội dung |
|---|---|---|---|
| S0 | 08/10 – 11/10 | 33 | Nền tảng, spike Drive |
| S1 | 12/10 – 18/10 | 80 | Xác thực, quản trị, hồ sơ & PH, hạ tầng Drive |
| S2 | 19/10 – 25/10 | 84 | Bài tập, nhóm, đề tài, nộp bài, trình xem |
| S3 | 26/10 – 31/10 | 77 | Điểm, PH, DN, thống kê, lên server → **DEMO** |
| S4 | 01/11 – 08/11 | 43 | Hoàn thiện server, P1 còn lại, chuẩn bị chạy thử |
| S5 | 09/11 – 22/11 | 61 | Chạy thử vòng 1, P2, báo cáo chương 1–2 |
| S6 | 23/11 – 06/12 | 73 | Chạy thử vòng 2, hoàn thiện, báo cáo chương 3 → **ĐÓNG BĂNG** |
| S7 | 07/12 – bảo vệ | 38 | Báo cáo, slide, sửa lỗi |
| **Tổng** | **~12 tuần** | **489** | 08/10–31/10: 274h (~78h/tuần) · 01/11–06/12: 177h (~35h/tuần) · 07/12–bảo vệ: 38h |

## Ma trận truy vết Use case → Task

| UC | Task (tháng 10 in đậm) |
|---|---|
| UC01 Xác thực | **T-101 – T-103, T-105, T-106, T-503a**, T-104 |
| UC02 Quản trị | **T-107 – T-110, T-201a, T-209**, T-111, T-201b, T-202, T-203, T-208, T-606 |
| UC03 Hồ sơ SV | **T-206, T-207** |
| UC04 Bài tập | **T-210 – T-212, T-301 – T-303**, T-307, T-510, T-511 |
| UC05 Nhóm & đề tài | **T-304 – T-306, T-407**, T-307 |
| UC06 Nộp/xem/tìm | **T-308 – T-310, T-401, T-403, T-404, T-407**, T-405, T-406 (S4), T-509 |
| UC07 Điểm | **T-408, T-409a, T-410**, T-409b, T-501 |
| UC08 Phụ huynh | **T-503a**, T-502, T-503b |
| UC09 DN & quyền xem | **T-504 – T-507**, T-508 |
| UC10 Thống kê | **T-601, T-603**, T-602, T-604, T-605 |
| UC11 Thông báo | **T-204**, T-205, T-402 |

