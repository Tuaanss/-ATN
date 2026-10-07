# EduPortfolio – Danh sách công việc kỹ thuật (Tech Tasks)

> Phiên bản 2.0 · 07/10/2026
> Chia nhỏ công việc theo sprint ở [Plan_project](Plan_project.md). Ước lượng tính bằng **giờ** cho 1 người, khoảng 30 giờ/tuần (60 giờ/sprint).
> Ưu tiên: P1 = MVP, P2 = nên có. Trạng thái cập nhật ở cột cuối: ☐ chưa làm · ◐ đang làm · ☑ xong.

---

## Definition of Done (áp dụng cho mọi task)

1. Code qua `lint` + `typecheck`, có unit test cho logic nghiệp vụ; endpoint mới có ít nhất 1 e2e test (Supertest).
2. Quyền truy cập được kiểm tra ở server (Roles + Policy) và có test cho trường hợp bị từ chối.
3. Lỗi trả đúng `ErrorCode` ở [Specification §7](Specification.md#7-mã-lỗi-chuẩn); thông điệp tiếng Việt.
4. Swagger hiển thị đúng request/response.
5. Giao diện có trạng thái đang tải / trống / lỗi; dùng được ở chiều rộng 375 px.
6. Migration Prisma (nếu có) chạy được trên DB trống và DB có dữ liệu seed.

---

## Sprint 0 – Nền tảng (12/10 – 18/10/2026) · 30h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-001 | Khởi tạo monorepo | pnpm workspaces, `tsconfig.base`, ESLint, Prettier, Husky + lint-staged, `.editorconfig`, `.env.example` | – | – | 3 | ☐ |
| T-002 | Gói `shared` | `enums.ts`, `errors.ts`, `constants.ts`, `grading.ts` (kèm test BR-14/15), cấu hình build | – | T-001 | 3 | ☐ |
| T-003 | Docker dev | `compose.dev.yml`: postgres 16 (bật extension), redis 7, mailpit | – | – | 2 | ☐ |
| T-004 | Khung NestJS | Config đọc env qua Zod, nestjs-pino, Swagger `/api/docs`, `/api/health`, entry `main.ts` + `worker.ts` | – | T-001 | 4 | ☐ |
| T-005 | Prisma schema v1 | Toàn bộ 46 bảng theo DatabaseDesign; migration SQL thủ công cho extension, `f_unaccent`, partial unique, CHECK, GIN index | – | T-003 | 9 | ☐ |
| T-006 | Common BE | `AppException`, `AllExceptionsFilter`, `ZodValidationPipe`, pagination helper, `afterCommit()`, Redis lock helper | – | T-004 | 4 | ☐ |
| T-007 | Khung React | Vite + TS, AntD `vi_VN` + theme, React Router, TanStack Query, `ky` có tự refresh, AppLayout/AuthLayout, trang 403/404 | – | T-001 | 5 | ☐ |

**Mốc:** `pnpm dev` chạy được cả web lẫn api; `pnpm db:migrate` tạo xong schema; CI xanh (CI được làm trong T-008, sprint 1).

## Sprint 1 – Xác thực & Quản trị cơ bản (19/10 – 01/11) · 62h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-008 | CI GitHub Actions | install → lint → typecheck → test (Testcontainers) → build | – | T-005 | 2 | ☐ |
| T-101 | Đăng nhập & token | Argon2id, `POST /auth/login` (2 kiểu), cookie access/refresh, rotation + phát hiện dùng lại, khóa 5 lần/15', `/auth/me`, `/auth/logout` | 01.1, 01.2, 01.7 | T-005 | 8 | ☐ |
| T-102 | Chuỗi guard | JwtAuth, MustChangePassword, ProfileComplete, Roles, decorator `@Public`, `@Roles`, `@CurrentUser` | 01.4 | T-101 | 4 | ☐ |
| T-103 | Đổi mật khẩu | Lần đầu + thông thường; chính sách mật khẩu; thu hồi phiên khác | 01.4, 01.6 | T-102 | 3 | ☐ |
| T-104 | Quên mật khẩu | Token hash 30', MailService cơ bản (gửi trực tiếp), rate limit 3/h | 01.5 | T-101 | 4 | ☐ |
| T-105 | Đăng ký DN | Form + Turnstile, `users(PENDING)` + `enterprises`, thông báo Admin (tạm ghi log, nối thông báo ở T-204) | 01.8 | T-101 | 3 | ☐ |
| T-106 | FE xác thực | Login 2 tab, đổi mật khẩu bắt buộc, quên/đặt lại, đăng ký DN, `RequireAuth/RequireRole`, session store | 01.x | T-007, T-101 | 6 | ☐ |
| T-107 | Danh mục | BE CRUD 6 danh mục (generic service) + chặn xóa khi đang dùng; FE trang danh mục dạng tab, dùng chung `DataTable` + form modal | 02.6 | T-102 | 8 | ☐ |
| T-108 | Học kỳ & môn học | CRUD; ràng buộc kỳ không chồng lấn, chỉ một kỳ hiện tại; trọng số tổng 100 | 02.8 | T-107 | 5 | ☐ |
| T-109 | Lớp học phần + kiểm tra trùng lịch | CRUD LHP kèm `schedules[]`; `ScheduleConflictService` (truy vấn §6.1) + test; FE form có bảng buổi học và hiển thị xung đột | 02.9, 02.11 | T-108 | 7 | ☐ |
| T-110 | Tài khoản GV & SV | CRUD, lọc, khóa/mở (thu hồi phiên), đặt lại mật khẩu; FE 2 trang | 02.1, 02.2 | T-107 | 6 | ☐ |
| T-111 | Import SV Excel | File mẫu, preview (lỗi từng ô), commit transaction, `import_jobs`, file kết quả; FE wizard 3 bước | 02.3 | T-110 | 6 | ☐ |

**Mốc:** Admin đăng nhập, tạo danh mục, học kỳ, môn, LHP (có kiểm tra trùng lịch), tạo/import SV và GV; SV/GV đăng nhập lần đầu được buộc đổi mật khẩu.

## Sprint 2 – Hồ sơ, phụ huynh, thông báo, Drive (02/11 – 15/11) · 60h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-201 | Xếp SV vào LHP | Chọn tay + import MSSV; cảnh báo vượt sĩ số, trùng lịch SV; gỡ SV (chặn khi có dữ liệu) | 02.10 | T-109, T-111 | 5 | ☐ |
| T-202 | Audit | `AuditService`, `@Audit` interceptor, ghi cho auth/admin | 02.12 | T-102 | 3 | ☐ |
| T-203 | Cấu hình hệ thống | `settings` module + cache Redis + giá trị mặc định (seed) | 02.13 | T-006 | 3 | ☐ |
| T-204 | Thông báo lõi | `NotificationService.notify` (dedupe), API danh sách/đếm/đọc; FE chuông + trang thông báo | 11.1, 11.3 | T-102 | 6 | ☐ |
| T-205 | Hàng đợi mail | BullMQ `mail.send`, template HTML, nối các sự kiện cần email; Mailpit để kiểm tra | 11.2 | T-204 | 3 | ☐ |
| T-206 | Khai báo hồ sơ + đồng bộ PH | `PUT /me/profile`, BR-01, `ParentLinkSyncService` (tạo/liên kết/gỡ/vô hiệu) trong transaction; unit test đủ các nhánh (anh chị em, đổi số, bỏ số, cả bố mẹ cùng số) | 03.1–3.3 | T-102 | 8 | ☐ |
| T-207 | FE hồ sơ SV | Màn hình khai báo bắt buộc (đoạn thông báo NĐ 13), cập nhật hồ sơ, công tắc discoverable, avatar | 03.1–3.4 | T-206 | 5 | ☐ |
| T-208 | Quản lý PH & đổi SĐT | Danh sách PH + con, khóa, đặt lại mật khẩu; `change-phone` có gộp tài khoản; FE | 02.4, 02.5 | T-206 | 5 | ☐ |
| T-209 | Duyệt DN | Danh sách theo trạng thái, duyệt/từ chối/khóa (thu hồi quyền xem), thông báo; FE | 02.7 | T-204 | 4 | ☐ |
| T-210 | Hạ tầng Google Drive | `DriveClientFactory` (SA), `DriveService` (get, createFolder, upload resumable, trash, copy, stream Range), ánh xạ lỗi → ErrorCode, `FakeDriveService` cho test; tài liệu tạo SA + Shared Drive | 04.3, 04.4 | T-006 | 7 | ☐ |
| T-211 | Liên kết Drive (GV) | `verifyWritable` (ghi thử), `lecturer_drive_links`, FE trang hướng dẫn 3 bước + kết quả kiểm tra | 04.1, 04.4 | T-210 | 4 | ☐ |
| T-212 | Tạo bài tập (BE) | Kiểm tra BR-04, xác minh thư mục, tạo thư mục, bù trừ khi lỗi, `DRAFT/OPEN`, thông báo mở bài | 04.2–4.4 | T-211, T-204 | 4 | ☐ |

**Mốc:** SV khai báo hồ sơ thì PH đăng nhập được bằng SĐT; GV liên kết Shared Drive thật và tạo bài tập thì thư mục xuất hiện trên Drive.

## Sprint 3 – Bài tập, nhóm, đề tài, nộp bài (16/11 – 29/11) · 62h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-301 | FE bài tập (GV) + sửa/đóng/xóa | Form tạo/sửa (loại sản phẩm gợi ý theo loại môn), đóng/mở lại, xóa (chặn nếu có bài), chi tiết bài tập dạng tab | 04.2, 04.5, 04.8 | T-212 | 6 | ☐ |
| T-302 | Hạ tầng scheduler | Đăng ký repeatable jobs trong worker, Bull Board cho Admin, job `assignments.open-due` | 04.2 | T-205 | 4 | ☐ |
| T-303 | SV xem LHP & bài tập | `/sections/mine`, chi tiết LHP, `/assignments/:id/my-work`, trạng thái tổng hợp; FE | 04.9 | T-212 | 4 | ☐ |
| T-304 | Nhóm (BE) | Tạo nhóm/làm cá nhân, mời MSSV, mã mời + làm mới, chấp nhận/từ chối/nhập mã (khóa dòng), xóa TV, chuyển trưởng nhóm, rời/giải tán; job `ensure-folder`; test cạnh tranh (2 người cùng nhận chỗ cuối) | 05.1–5.6 | T-303, T-210 | 10 | ☐ |
| T-305 | Nhóm (FE SV) | Chọn hình thức, tạo nhóm, mời, danh sách lời mời, trang `/join/:code`, quản lý thành viên | 05.1–5.6 | T-304 | 6 | ☐ |
| T-306 | Đề tài & từ khóa | `PUT /assignments/:id/topic`, chuẩn hóa tag, autocomplete trigram, cảnh báo trùng (§6.3), lịch sử; FE form + TagInput | 05.7, 05.8 | T-304 | 7 | ☐ |
| T-307 | GV quản lý nhóm | Bảng nhóm & đề tài, SV chưa có nhóm, thêm/chuyển/xóa TV, sửa min/max (cảnh báo), khóa/mở khóa, xuất Excel | 04.7, 05.9, 05.10 | T-304 | 6 | ☐ |
| T-308 | Upload tus | `@tus/server` gắn vào Nest, xác thực, giới hạn kích thước theo cấu hình, bảng `uploads`, job dọn tệp | 06.1–6.2 | T-203 | 5 | ☐ |
| T-309 | Nộp / nộp lại / xóa tệp (BE) | Theo ModuleFlows §5: policy, magic bytes, transaction + `FOR UPDATE`, versions, events, `afterCommit` enqueue | 06.1, 06.2, 06.4, 06.5 | T-306, T-308 | 8 | ☐ |
| T-310 | Processor Drive | `upload-file` (resumable, md5), `trash-file`, `ensure-folder` (khóa Redis), phân loại lỗi, backoff, cập nhật `sync_status`, `thong_tin_bai_nop.txt` | 06.3 | T-309, T-210 | 6 | ☐ |

**Mốc:** Một vòng hoàn chỉnh trên Drive thật: GV giao bài → SV lập nhóm, đăng ký đề tài → nộp ảnh/video → tệp xuất hiện đúng thư mục nhóm.

## Sprint 4 – Trình xem, tìm kiếm, chấm & nhập điểm (30/11 – 13/12) · 60h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-401 | FE nộp bài | Uppy (tus, tiến trình, hủy, tải tiếp), lưới ảnh kéo thả sắp xếp, chế độ chọn nhiều để xóa, hộp xác nhận nộp lại, huy hiệu đồng bộ từng tệp, tab Bài chung / Bài cá nhân | 06.1–6.5 | T-309 | 8 | ☐ |
| T-402 | Realtime | Gateway Socket.IO (cookie auth, phòng user/group), Redis adapter + emitter cho worker; FE `useSocketEvent` → invalidate query; toast thông báo | 06.1, 11.1 | T-204 | 4 | ☐ |
| T-403 | Stream tệp & policy | `SubmissionAccessPolicy` (đủ 5 vai trò, test bảng chân trị), `/files/:id/content` (Range, cục bộ hoặc Drive), thumbnail sharp + cache, download | 06.7 | T-310 | 6 | ☐ |
| T-404 | Trình xem đa phương tiện | `ImageSlideshow` (lightbox: thumbnails, counter, zoom, fullscreen, phím, vuốt), `VideoPlayer`, `FigmaEmbed`, `FileList`; trang `/submissions/:id` | 06.7 | T-403 | 6 | ☐ |
| T-405 | Lịch sử nộp bài | API events (lọc theo quyền), FE dòng thời gian | 06.6 | T-309 | 3 | ☐ |
| T-406 | Tìm kiếm bài nộp | Truy vấn trigram + bộ lọc + phạm vi theo vai trò (Admin/GV/DN), cập nhật `topics.search_text`; FE trang tìm (dùng chung) | 06.8 | T-403 | 6 | ☐ |
| T-407 | Job hạn nộp | `groups.lock-at-deadline`, `invitations.expire`, `reminders.deadline` (dedupe 24h/2h) + test với đồng hồ giả | 05.10, 06.10 | T-302 | 4 | ☐ |
| T-408 | Chấm bài | Chấm + trừ muộn, `assignment_grades` cho thành viên, ghi đè từng người, yêu cầu làm lại (`resubmit_due_at` vượt hạn chung); FE màn hình chấm 2 cột + "bài tiếp theo" | 07.1–7.3 | T-404 | 6 | ☐ |
| T-409 | Bảng điểm học phần | Lưới nhập (AntD editable table, lưu theo ô), "Tính từ bài tập", tính tổng/chữ/hệ 4 bằng `shared/grading`, xuất/nhập Excel có preview | 07.4, 07.5 | T-408 | 9 | ☐ |
| T-410 | Công bố & GPA | Publish (khóa), job `recompute-gpa` (§6.5), `student_term_results`, `students.cpa`; FE "Điểm của tôi" (theo kỳ, bài tập, thẻ CPA) | 07.6, 07.9 | T-409 | 6 | ☐ |

**Mốc:** GV xem bài bằng trình chiếu và video, chấm, nhập điểm, công bố; SV thấy điểm và CPA.

## Sprint 5 – Phụ huynh, doanh nghiệp, quyền xem, độ bền Drive (14/12 – 27/12) · 58h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-501 | Yêu cầu sửa điểm | GV tạo/hủy, Admin duyệt (kiểm tra lệch dữ liệu, áp dụng, audit, recompute) / từ chối; FE 2 phía | 07.7, 07.8 | T-410 | 5 | ☐ |
| T-502 | Cảnh báo học tập | Job `academic-warning-check` (4 loại, ngưỡng từ settings, dedupe), nối vào lock-at-deadline và publish | 08.4 | T-410, T-407 | 4 | ☐ |
| T-503 | Cổng phụ huynh | Chọn/đổi con (claim token), `ParentChildGuard`, tổng quan, điểm + biểu đồ GPA, bài nộp (xem, không tải), cảnh báo | 01.3, 08.1–8.4 | T-502, T-404 | 8 | ☐ |
| T-504 | Tìm SV (DN) | Truy vấn §6.2, cập nhật `students.search_text/topic_count` khi nộp/sửa đề tài, log tìm kiếm, rate limit; FE bộ lọc + bảng kết quả + nhãn trạng thái quyền | 09.1 | T-406 | 10 | ☐ |
| T-505 | Hồ sơ công khai & gửi yêu cầu | DTO `StudentPublicProfile` (test snapshot không lộ trường nhạy cảm), log VIEW_PROFILE, tạo yêu cầu nhiều SV (bỏ trùng), hủy; FE hồ sơ + modal yêu cầu + trang "Yêu cầu của tôi" | 09.2–9.4 | T-504 | 6 | ☐ |
| T-506 | Admin xử lý quyền xem | Duyệt/từ chối hàng loạt, thu hồi, danh sách quyền đang hiệu lực; job `view-requests.expire` + `expiring` | 09.8–9.10 | T-505 | 5 | ☐ |
| T-507 | DN xem bài + nhật ký truy cập | `/enterprise/students/:id/submissions`, policy DN trong T-403, ghi log bất đồng bộ (gộp 10') | 09.5, 09.6 | T-506, T-403 | 4 | ☐ |
| T-508 | SV xem DN đã xem mình | API + FE danh sách DN, thời hạn, lượt xem chi tiết | 09.11 | T-507 | 3 | ☐ |
| T-509 | Độ bền đồng bộ Drive | Jobs `drive.retry-failed`, `verify-files`, `health-check`; trang "Tình trạng đồng bộ" cho GV + nút thử lại; gộp email lỗi | 06.9 | T-310 | 6 | ☐ |
| T-510 | Đổi thư mục nhận bài | `change-folder` 2 nhánh, job `migrate-assignment` (files.copy), trạng thái + thông báo; FE modal | 04.6 | T-509 | 5 | ☐ |
| T-511 | Đổi tên thư mục | Job `rename-folder` khi đổi tiêu đề bài/tên nhóm (best-effort) | 04.5 | T-310 | 2 | ☐ |

**Mốc:** Đủ mọi use case P1 (bản MVP), chạy end-to-end trên staging.

## Sprint 6 – Thống kê, báo cáo, hoàn thiện (28/12/2026 – 10/01/2027) · 58h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-601 | Dashboard Admin | Truy vấn thẻ + 3 biểu đồ, cache 5', job warmup; FE với liên kết nhanh | 10.1 | T-506 | 6 | ☐ |
| T-602 | Thống kê DN | 14 chỉ số theo FR-10.02 + bộ lọc; FE nhiều biểu đồ | 10.2 | T-507 | 6 | ☐ |
| T-603 | Thống kê LHP | Tỉ lệ nộp, SV chưa nộp, phổ điểm, điểm chữ, top tag; Admin so sánh LHP | 10.3 | T-410 | 6 | ☐ |
| T-604 | Thống kê SV & DN mình | 2 trang thống kê theo FR-10.04, FR-10.05 | 10.4, 10.5 | T-508 | 5 | ☐ |
| T-605 | Xuất báo cáo | ExcelJS (sheet/chỉ số), pdfmake (font Roboto, nhúng ảnh biểu đồ từ client), queue `reports` cho báo cáo lớn, link tải 24h | 10.6 | T-601–T-603 | 8 | ☐ |
| T-606 | Nhật ký & cấu hình (FE) | Trang tra cứu audit (diff JSON), trang cấu hình theo nhóm; gộp/ẩn tag | 02.12, 02.13, 02.6 | T-202, T-203 | 5 | ☐ |
| T-607 | Bảo mật | Throttler Redis theo bảng Architecture §7, helmet + CSP, kiểm tra `Origin`, rà soát quyền mọi controller (checklist) | NFR | – | 4 | ☐ |
| T-608 | Hoàn thiện UI/UX | Responsive (375/768/1280), trạng thái trống/lỗi, thông điệp lỗi tiếng Việt cho mọi ErrorCode, a11y cơ bản, đếm ngược hạn nộp | NFR-10, 11 | – | 8 | ☐ |
| T-609 | Dữ liệu seed demo | Script seed theo DatabaseDesign §7, tệp media mẫu, kịch bản tài khoản demo cho mỗi vai trò | – | – | 5 | ☐ |
| T-610 | Hiệu năng | Sinh 10.000 SV/100.000 bài giả, `EXPLAIN ANALYZE` các truy vấn nóng, bổ sung index; k6 thử 500 người dùng ảo trên luồng xem/nộp | NFR-01, 02 | T-609 | 5 | ☐ |

**Mốc:** Đủ toàn bộ 11 nhóm use case; đóng băng tính năng (feature freeze).

## Sprint 7 – Kiểm thử, triển khai, báo cáo (11/01 – 24/01/2027) · 60h

| ID | Task | Chi tiết / Tiêu chí hoàn thành | UC | Phụ thuộc | Giờ | TT |
|---|---|---|---|---|---|---|
| T-701 | E2E Playwright | 8 kịch bản: đăng nhập + đổi MK; khai báo hồ sơ → PH đăng nhập; giao bài → nhóm → nộp; nộp lại + xóa ảnh; chấm → công bố → PH xem; DN tìm → yêu cầu → duyệt → xem → hết hạn; sửa điểm sau khóa; xuất báo cáo | Tất cả | – | 10 | ☐ |
| T-702 | Bổ sung test API | Lấp chỗ thiếu, đạt ≥ 70% coverage ở service lõi (auth, groups, submissions, grading, enterprise, access-control) | – | – | 6 | ☐ |
| T-703 | Triển khai production | Dockerfile multi-stage, `compose.prod.yml`, Caddy (HTTPS), backup, Uptime Kuma, tên miền; Shared Drive demo; `prisma migrate deploy` | – | – | 8 | ☐ |
| T-704 | UAT & sửa lỗi | 3–5 người dùng thật (SV/GV) chạy kịch bản; ghi nhận và sửa lỗi; dự phòng thời gian | – | T-703 | 12 | ☐ |
| T-705 | Tài liệu sử dụng | Hướng dẫn theo vai trò (có ảnh), hướng dẫn tạo SA/Shared Drive cho GV, README cài đặt | – | – | 4 | ☐ |
| T-706 | Báo cáo đồ án | Viết các chương theo khung ở Plan_project §10 | – | – | 14 | ☐ |
| T-707 | Slide & kịch bản demo | Slide bảo vệ, kịch bản demo 15 phút, video demo dự phòng | – | T-704 | 6 | ☐ |

## Tổng hợp

| Sprint | Thời gian | Giờ | Nội dung |
|---|---|---|---|
| S0 | 12/10 – 18/10/2026 | 30 | Nền tảng |
| S1 | 19/10 – 01/11 | 62 | Xác thực, quản trị cơ bản |
| S2 | 02/11 – 15/11 | 57 | Hồ sơ, PH, thông báo, Drive, tạo bài tập |
| S3 | 16/11 – 29/11 | 62 | Bài tập, nhóm, đề tài, nộp bài |
| S4 | 30/11 – 13/12 | 58 | Trình xem, tìm kiếm, chấm/nhập điểm |
| S5 | 14/12 – 27/12 | 58 | PH, DN, quyền xem, độ bền Drive |
| S6 | 28/12 – 10/01/2027 | 58 | Thống kê, báo cáo, hoàn thiện |
| S7 | 11/01 – 24/01/2027 | 60 | Kiểm thử, triển khai, báo cáo đồ án |
| **Tổng** | **15 tuần** | **445** | |

## Ma trận truy vết Use case → Task

| UC | Task |
|---|---|
| UC01 Xác thực | T-101 – T-106, T-503 (chọn con) |
| UC02 Quản trị | T-107 – T-111, T-201 – T-203, T-208, T-209, T-606 |
| UC03 Hồ sơ SV | T-206, T-207 |
| UC04 Bài tập | T-210 – T-212, T-301 – T-303, T-307, T-510, T-511 |
| UC05 Nhóm & đề tài | T-304 – T-307, T-407 |
| UC06 Nộp/xem/tìm | T-308 – T-310, T-401 – T-407, T-509 |
| UC07 Điểm | T-408 – T-410, T-501 |
| UC08 Phụ huynh | T-502, T-503 |
| UC09 DN & quyền xem | T-504 – T-508 |
| UC10 Thống kê | T-601 – T-605 |
| UC11 Thông báo | T-204, T-205, T-402 |
