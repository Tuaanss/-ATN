# EduPortfolio – Cấu trúc module & mã nguồn (Modules Structure)

> Phiên bản 3.0 · 11/10/2026 · Node.js 22 LTS + TypeScript (NestJS 11 / React 19 + Vite 6)
> **v3.0:** bỏ module `appeals`, phần chấm bài, lời mời/chốt nhóm, duyệt đề tài; thêm `imports` (Excel nhóm/điểm), `group_reports`; Drive OAuth của GV là mặc định.
> Tài liệu liên quan: [Architecture](Architecture.md) · [ModuleFlows](ModuleFlows.md) · [TechTasks](TechTasks.md)

---

## 1. Cấu trúc monorepo

```
eduportfolio/
├── apps/
│   ├── api/                      # NestJS – chạy 2 entry: main.ts (api) và worker.ts (worker)
│   └── web/                      # React + Vite SPA
├── packages/
│   └── shared/                   # Zod schema, enum, hằng số, kiểu DTO, mã lỗi – dùng chung FE/BE
├── docker/
│   ├── compose.dev.yml           # postgres, redis, mailpit
│   ├── compose.prod.yml          # caddy, api, worker, postgres, redis, backup
│   ├── Caddyfile
│   └── api.Dockerfile
├── docs/                         # Tài liệu này
├── .github/workflows/ci.yml
├── .nvmrc                        # 22 (Node.js LTS)
├── pnpm-workspace.yaml
├── package.json                  # scripts gốc: dev, build, lint, test, db:*; "engines": { "node": ">=22" }
└── tsconfig.base.json
```

## 2. Gói `packages/shared`

```
packages/shared/src/
├── enums.ts            # UserRole, WorkMode, ProductType, SubmissionStatus, ViewRequestStatus... (khớp enum Prisma)
├── errors.ts           # ErrorCode + thông điệp tiếng Việt mặc định
├── constants.ts        # GRADE_SCALE (BR-15), PHONE_REGEX, giới hạn mặc định
├── grading.ts          # computeTotal(), toLetter(), toGpa4() – hàm thuần, dùng ở cả FE (xem trước) và BE
├── schemas/            # Zod: auth, profile, assignment, group-import, topic, submission, grade-import, enterprise, ...
│   └── *.schema.ts
└── index.ts
```

Quy tắc: không phụ thuộc Node hay DOM; mọi schema export cả kiểu `z.infer`.

## 3. Backend `apps/api`

### 3.1. Cây thư mục

```
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/                     # seed.ts + dữ liệu mẫu, tệp ảnh/video mẫu nhỏ
├── src/
│   ├── main.ts                   # bootstrap HTTP + WS
│   ├── worker.ts                 # bootstrap worker (không mở cổng HTTP)
│   ├── app.module.ts
│   ├── worker.module.ts
│   ├── config/                   # cấu hình typed (zod-validated env)
│   ├── common/
│   │   ├── guards/               # jwt-auth, must-change-password, profile-complete, roles, parent-child
│   │   ├── decorators/           # @CurrentUser, @Roles, @Public, @Audit, @AllowIncompleteProfile
│   │   ├── interceptors/         # audit.interceptor, logging
│   │   ├── filters/              # all-exceptions.filter → { code, message }
│   │   ├── pipes/                # ZodValidationPipe
│   │   ├── errors/               # AppException(code, status, details)
│   │   ├── pagination/           # offset & cursor helpers
│   │   └── utils/                # vn-normalize, sanitize-filename, phone, date-tz
│   ├── infra/
│   │   ├── prisma/               # PrismaService, transaction helper, afterCommit()
│   │   ├── redis/                # RedisModule, lock helper (SET NX PX)
│   │   ├── queue/                # đăng ký queue BullMQ, tên queue, Bull Board
│   │   ├── storage/              # StorageService: đường dẫn /data, move, cleanup, stream Range
│   │   ├── mail/                 # MailService (nodemailer) + templates/
│   │   ├── google-drive/         # DriveService (client theo GV: OAuth / Service Account), mã hóa token, drive-errors.ts
│   │   ├── excel/                # ExcelService: sinh file mẫu, đọc & chuẩn hóa ô, xuất Excel
│   │   └── realtime/             # RealtimeGateway (Socket.IO), RealtimeEmitter (cho worker)
│   └── modules/                  # mỗi module: *.module.ts, controllers/, services/, dto/, policies/, processors/
│       ├── auth/
│       ├── users/                # GV, SV, PH, DN (góc nhìn Admin) + import
│       ├── catalog/              # khoa, ngành, khóa, lớp SH, phòng, lĩnh vực, tags (quản trị)
│       ├── academic/             # học kỳ, môn học, LHP, lịch học, xếp SV
│       ├── profile/              # hồ sơ SV, đồng bộ PH
│       ├── drive-link/           # liên kết Drive của GV (OAuth connect/callback/revoke, kiểm tra lại)
│       ├── assignments/
│       ├── groups/               # tải danh sách nhóm (Excel), xem nhóm, phản hồi nhóm chưa đúng
│       ├── topics/               # đề tài (tên + từ khóa), tags, cảnh báo trùng
│       ├── uploads/              # tus server
│       ├── submissions/          # nộp, nộp lại, xóa tệp, lịch sử, xem, tìm, đồng bộ
│       ├── files/                # stream nội dung, thumbnail, download
│       ├── grades/               # tải điểm bài tập & học phần (Excel), công bố, yêu cầu sửa điểm, GPA
│       ├── imports/              # import_jobs: xem trước / áp dụng / hết hạn (dùng chung cho SV, nhóm, điểm)
│       ├── parent-portal/
│       ├── enterprise/           # tìm SV, hồ sơ, yêu cầu xem bài, nhật ký truy cập
│       ├── access-control/       # Admin xử lý yêu cầu xem bài, thu hồi, job hết hạn
│       ├── statistics/           # thống kê + xuất báo cáo
│       ├── notifications/
│       ├── audit/
│       ├── settings/
│       └── scheduler/            # đăng ký job lặp (chỉ nạp trong worker)
└── test/
    ├── e2e/                      # *.e2e-spec.ts theo use case
    └── utils/                    # testcontainers, factory dữ liệu, FakeDriveService
```

### 3.2. Bảng module

| Module | Use case | Trách nhiệm chính | Phụ thuộc |
|---|---|---|---|
| `auth` | UC01 | Đăng nhập (2 kiểu), refresh, đăng xuất, đổi/quên mật khẩu, chọn con, đăng ký DN | users, mail, audit |
| `users` | UC02.1–2.5, 2.7 | CRUD tài khoản theo vai trò, khóa/mở, đặt lại mật khẩu, import SV, đổi SĐT PH, duyệt DN | profile (sync PH), imports, notifications |
| `catalog` | UC02.6 | Danh mục; gộp/ẩn tag | – |
| `academic` | UC02.8–2.11, UC04.9 | Học kỳ, môn, LHP, lịch, kiểm tra trùng lịch, xếp SV, "LHP của tôi" | – |
| `profile` | UC03 | Khai báo/cập nhật hồ sơ, `ParentLinkSyncService`, công tắc discoverable, ảnh đại diện | audit |
| `drive-link` | UC04.1, UC04.4 | OAuth Google của GV (start/callback/revoke, tạo thư mục gốc), kiểm tra lại, dung lượng, trạng thái thư mục từng bài tập; Service Account | google-drive |
| `assignments` | UC04.2–4.8 | Giao bài (1 hoặc nhiều LHP, `batch_id`), tệp đề bài, tạo thư mục, sửa/đóng/mở lại/giao ngay/xóa, đổi thư mục, lịch sử thay đổi | google-drive, notifications |
| `groups` | UC05.1–5.6 | File mẫu nhóm, xem trước + áp dụng danh sách nhóm, bảng nhóm cho GV, nhóm của tôi cho SV, phản hồi nhóm chưa đúng | imports, excel, notifications |
| `topics` | UC05.7–5.8 | Đề tài (tên + từ khóa), tags, gợi ý, cảnh báo trùng, lịch sử | notifications |
| `uploads` | UC06.1–2 | Nhận tệp tải lên, bảng `uploads`, dọn tệp hết hạn | storage |
| `submissions` | UC06 | Nộp/nộp lại (thay theo loại tệp)/xóa tệp, lịch sử, chi tiết bài, danh sách bài đã nộp cho GV, tìm kiếm, đồng bộ Drive (processor), nhắc hạn | uploads, topics, google-drive, notifications |
| `files` | UC06.7, UC09.5 | `/files/:id/content|thumbnail|download`, tệp đề bài, `SubmissionAccessPolicy` | storage, google-drive, enterprise (log) |
| `grades` | UC07, UC08.2 | File mẫu điểm, xem trước + áp dụng điểm bài tập / điểm học phần, công bố, bảng điểm, yêu cầu sửa điểm, `GpaService`, cảnh báo học tập | imports, excel, notifications |
| `imports` | UC02.3, UC05.2, UC07.2–7.4 | `import_jobs`: lưu bản xem trước, áp dụng, hết hạn, lịch sử tải lên | excel |
| `parent-portal` | UC08 | API chỉ đọc cho PH | grades, submissions |
| `enterprise` | UC09.1–9.6, 9.11 | Tìm SV, hồ sơ công khai, gửi/hủy yêu cầu, bài của SV được cấp quyền, log truy cập, "DN đã xem tôi" | submissions, notifications |
| `access-control` | UC09.8–9.10 | Admin duyệt/từ chối/thu hồi; job hết hạn và sắp hết hạn | notifications |
| `statistics` | UC10 | Thống kê kết quả (không theo dõi tiến độ), cache, xuất Excel/PDF; phân tích đề tài, bản đồ năng lực | – |
| `notifications` | UC11 | `NotificationService.notify` (tôn trọng cài đặt), API chuông, email, cài đặt + bản tin | mail |
| `audit` | UC02.12 | `AuditService.log`, API tra cứu | – |
| `settings` | UC02.13 | Đọc/ghi `system_settings` + cache | – |
| `scheduler` | Bộ hẹn giờ | Đăng ký job lặp (xem ModuleFlows §8) | các module trên |

### 3.3. Hàng đợi

| Queue | Job | Đồng thời | Thử lại |
|---|---|---|---|
| `drive` | `ensure-folder`, `upload-file`, `trash-file`, `move-folder`, `verify-files` | 4, có giới hạn tốc độ | backoff tăng dần |
| `mail` | `send`, `digest` | 5 | 5 lần |
| `notify` | `fanout` (mở bài tập, công bố điểm, áp dụng danh sách nhóm) | 2 | 3 |
| `grades` | `recompute-gpa`, `academic-warning-check` | 2 | 3 |
| `stats` | `topic-trends` | 1 | 2 |
| `reports` | `export` | 1 | 1 |
| `maintenance` | `cleanup-uploads`, `cleanup-cache`, `purge-logs`, `imports-expire` | 1 | 1 |
| `scheduler` | Job lặp (cron) gọi các service tương ứng | 1 | – |

> Bản cài đặt hiện tại chạy hàng đợi trong tiến trình API (không Redis) với trạng thái lưu trong CSDL; khi cần mở rộng thì chuyển sang BullMQ + Redis theo bảng trên.

## 4. Danh sách API (REST `/api/v1`)

Ký hiệu vai trò: A = Admin, L = GV, S = SV, P = PH, E = DN, * = mọi người đã đăng nhập, Pub = công khai.

### 4.1. Auth
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| POST | `/auth/login` `{username, password, type: ACCOUNT|PARENT}` | Pub | 01.1–2 |
| POST | `/auth/refresh` | Pub (cookie) | – |
| POST | `/auth/logout` | * | 01.7 |
| GET | `/auth/me` | * | – |
| POST | `/auth/change-password` | * | 01.4, 01.6 |
| POST | `/auth/forgot-password` · `/auth/reset-password` | Pub | 01.5 |
| GET | `/auth/parent/children` · POST `/auth/parent/select-child` | P | 01.3 |
| POST | `/auth/register-enterprise` | Pub | 01.8 |

### 4.2. Quản trị
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| GET/POST/PATCH | `/admin/lecturers[/:id]` | A | 02.1 |
| POST | `/admin/users/:id/lock` · `/unlock` · `/reset-password` | A | 02.1–2.4 |
| GET/POST/PATCH | `/admin/students[/:id]` | A | 02.2 |
| GET | `/admin/students/import-template` | A | 02.3 |
| POST | `/admin/students/import/preview` (multipart) · `/admin/students/import/:jobId/commit` | A | 02.3 |
| GET | `/admin/parents` · `/admin/parents/:id` | A | 02.4 |
| POST | `/admin/parents/:id/change-phone` `{newPhone, merge?}` | A | 02.5 |
| GET/POST/PATCH/DELETE | `/admin/catalog/{faculties|majors|cohorts|classes|rooms|enterprise-fields}[/:id]` | A | 02.6 |
| GET | `/admin/tags` · POST `/admin/tags/:id/merge` `{targetId}` · PATCH `/admin/tags/:id` `{isHidden}` | A | 02.6 |
| GET | `/admin/enterprises?status=` · POST `/admin/enterprises/:id/approve` · `/reject` · `/lock` · `/unlock` | A | 02.7 |
| GET/POST/PATCH | `/admin/semesters[/:id]` · `/admin/courses[/:id]` | A | 02.8 |
| GET/POST/PATCH/DELETE | `/admin/sections[/:id]` (kèm `schedules[]`) | A | 02.9, 02.11 |
| POST | `/admin/sections/check-schedule` | A | 02.11 |
| GET/POST/DELETE | `/admin/sections/:id/students` · POST `/admin/sections/:id/students/import` | A | 02.10 |
| GET | `/admin/audit-logs` | A | 02.12 |
| GET/PUT | `/admin/settings` | A | 02.13 |

### 4.3. Hồ sơ SV
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| GET/PUT | `/me/profile` | S | 03.1–3.2 |
| PATCH | `/me/profile/discoverable` `{value}` | S | 03.4 |
| POST | `/me/avatar` | S | 03.2 |

### 4.4. Đào tạo, Drive & bài tập
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| GET | `/lecturer/sections` · `/lecturer/sections/:id/assignments` · `/lecturer/sections/:id/students` · `/lecturer/sections/:id/groups` | L | 04.9, 05.4 |
| GET | `/student/sections` · `/student/sections/:id` · `/student/assignments` | S | 04.9 |
| GET | `/lecturer/drive-link` (liên kết, dung lượng, thư mục từng bài tập) | L | 04.1 |
| GET | `/lecturer/drive/oauth/start` · `/lecturer/drive/oauth/callback?code&state` · DELETE `/lecturer/drive/oauth` | L | 04.1 |
| POST | `/lecturer/drive/recheck` · `/lecturer/drive/check` `{folderUrl}` | L | 04.1, 04.4 |
| PUT | `/lecturer/drive-link` `{folderUrl}` (chế độ Service Account) | L | 04.1 |
| POST | `/lecturer/sections/:id/assignments` `{common, schedule}` (cố định LHP) | L | 04.2 |
| POST | `/lecturer/assignments/batch` `{common, sections:[{sectionId, openAt, dueAt}]}` | L | 04.8 |
| GET | `/lecturer/assignments/:id` (thông tin + nhóm + bài đã nộp + điểm) · `/lecturer/assignments/:id/edit` | L | 04.5 |
| PATCH/DELETE | `/lecturer/assignments/:id` `{common, schedule, folderMode?}` | L | 04.5, 04.6, 04.7 |
| POST | `/lecturer/assignments/:id/publish` (giao ngay) · `/close` · `/reopen` `{dueAt}` | L | 04.5 |
| POST | `/lecturer/assignments/:id/brief` (multipart tệp đề bài) | L | 04.2 |
| GET | `/student/assignments/:id` (đề bài, nhóm của tôi, đề tài, bài nộp, điểm đã công bố) | S | 04.9 |

### 4.5. Nhóm & đề tài
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| GET | `/lecturer/assignments/:id/groups/template` (.xlsx) | L | 05.1 |
| POST | `/lecturer/assignments/:id/groups/import/preview` (multipart) → `{jobId, groups[], moved[], ungrouped[], errors[]}` | L | 05.2, 05.3 |
| POST | `/lecturer/assignments/:id/groups/import/:jobId/commit` `{onlyValid?}` · DELETE `.../import/:jobId` | L | 05.2 |
| GET | `/lecturer/assignments/:id/groups` · `/lecturer/assignments/:id/groups/export` · `/lecturer/assignments/:id/imports?type=ASSIGNMENT_GROUPS` | L | 05.4 |
| GET | `/lecturer/assignments/:id/group-reports` · POST `/lecturer/group-reports/:id/resolve` `{note?}` | L | 05.6 |
| POST | `/student/assignments/:id/group-report` `{content}` | S | 05.6 |
| PUT | `/student/assignments/:id/topic` `{title, keywords[]}` (tự xác định nhóm/cá nhân) | S (L sửa sau hạn) | 05.7–5.8 |
| GET | `/topics/similar?assignmentId&title` · `/topics/:id/history` | S, L | 05.7 |
| GET | `/tags?q=` | * | 05.8 |

### 4.6. Nộp bài, xem, tìm
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| POST | `/student/assignments/:id/submissions` (multipart `files[]` + `kind, figmaUrl?, gitUrl?, note?, contributionPercent?`) | S | 06.1, 06.2, 06.4 |
| DELETE | `/student/submissions/:id/files` `{fileIds[]}` | S | 06.5 |
| GET | `/files/submission/:id` (dữ liệu trình xem) | theo policy | 06.7 |
| GET | `/lecturer/assignments/:id/submissions` (danh sách bài đã nộp) · `.../submissions/export` | L | 06.7 |
| GET | `/submissions/:id/events` | S, L | 06.6 |
| GET | `/submissions/search?q&by=topic|name|code|cohort&...` | A, L, E | 06.8 |
| GET | `/files/:id/content` (Range) · `/files/:id/thumbnail?w=` · `/files/:id/content?download=1` · `/files/brief/:assignmentId` | theo policy | 06.7 |
| POST | `/lecturer/assignments/:id/sync/retry` | L | 06.9 |

### 4.7. Điểm
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| GET | `/lecturer/assignments/:id/grades/template` · `/lecturer/sections/:id/grades/template` | L | 07.1 |
| POST | `/lecturer/assignments/:id/grades/import/preview` · `.../import/:jobId/commit` | L | 07.2, 07.4 |
| POST | `/lecturer/sections/:id/grades/import/preview` · `.../import/:jobId/commit` | L | 07.3, 07.4 |
| POST | `/lecturer/assignments/:id/grades/publish` | L | 07.6 |
| GET | `/lecturer/gradebooks?year=` · `/lecturer/sections/:id/grades` · `.../grades/export` | L, A | 07.5 |
| POST | `/lecturer/sections/:id/grades/publish` `{allowIncomplete?}` | L | 07.6 |
| POST | `/grade-change-requests` · GET `/grade-change-requests/mine` · DELETE `/grade-change-requests/:id` | L | 07.7 |
| GET | `/admin/grade-change-requests` · POST `/admin/grade-change-requests/:id/approve` · `/reject` | A | 07.8 |
| GET | `/me/grades` · `/me/assignment-grades` | S | 07.9 |

### 4.8. Phụ huynh
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| GET | `/parent/child/overview` · `/parent/child/grades` | P | 08.2 |
| GET | `/parent/child/submissions` (+ dùng `/submissions/:id`, `/files/:id/*`) | P | 08.3 |
| GET | `/parent/child/warnings` | P | 08.4 |

### 4.9. Doanh nghiệp & quyền xem
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| GET | `/enterprise/students/search` | E | 09.1 |
| GET | `/enterprise/students/:id` | E | 09.2 |
| POST | `/enterprise/view-requests` `{studentIds[], purpose, days}` | E | 09.3 |
| GET | `/enterprise/view-requests?status=` · DELETE `/enterprise/view-requests/:id` | E | 09.4 |
| GET | `/enterprise/students/:id/submissions` | E (có quyền) | 09.5 |
| GET | `/admin/view-requests?status=` · POST `/admin/view-requests/approve` `{ids[], days}` · `/reject` `{ids[], reason}` | A | 09.8 |
| POST | `/admin/view-requests/:id/revoke` `{reason}` | A | 09.9 |
| GET | `/me/enterprise-views` | S | 09.11 |

### 4.10. Thống kê & thông báo
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| GET | `/stats/admin/dashboard` | A | 10.1 |
| GET | `/stats/admin/enterprises?from&to&fieldId&majorId` | A | 10.2 |
| GET | `/stats/sections/:id` | A, L | 10.3 |
| GET | `/stats/me` | S | 10.4 |
| GET | `/stats/enterprise/me` | E | 10.5 |
| GET | `/stats/topics?semesterFrom&semesterTo&majorId&cohortId` (xu hướng, DN quan tâm, cung – cầu) | A, L (LHP của mình) | 10.7 |
| GET | `/stats/talent-map?dimension=major|cohort|cpa` | E, A | 10.8 |
| POST | `/reports/export` `{type, format, filters, chartImages?}` · GET `/reports/:id` · `/reports/:id/download` | A (L với LHP của mình) | 10.6 |
| GET | `/notifications?cursor&unread` · `/notifications/unread-count` | * | 11.1 |
| POST | `/notifications/:id/read` · `/notifications/read-all` | * | 11.1 |
| GET/PUT | `/notifications/settings` `{channels: {<loại>: {app, email}}, digest}` | * | 11.4 |
| GET | `/health` | Pub | – |

## 5. Frontend `apps/web`

Giao diện dựng theo bộ mẫu HTML `project/` (CSS của mẫu chép thành `styles/kit.css`, component tự viết: thẻ, bảng, badge, tab, thanh bước, modal, toast), **không dùng thư viện UI**. Màn hình rộng tự phóng to theo bậc (`zoom`) để giữ bố cục ~1440 px của mẫu.

### 5.1. Cây thư mục

```
apps/web/src/
├── main.tsx · router.tsx
├── layouts/AppLayout.tsx         # aside 248 px + topbar (breadcrumb, tìm kiếm, chuông, avatar) theo mẫu
├── api/                          # axios instance /api/v1 (cookie), kiểu dữ liệu, ánh xạ ErrorCode → thông điệp
├── auth/                         # AuthProvider, RequireRole, homeOf
├── components/                   # ui.tsx (Card, Stat, Badge, Note, Tabs, Seg, Stepper, Modal, Toast…),
│                                 # Icon.tsx (icon lấy từ mẫu), work.tsx (đề bài, lưới ảnh, DropZone),
│                                 # ExcelImport.tsx (tải mẫu → tải lên → bảng xem trước + lỗi dòng → áp dụng)
├── pages/
│   ├── LoginPage · NotificationsPage · MediaViewer · NotFound
│   ├── lecturer/                 # Dashboard, Classes (LHP), AssignmentForm (giao 1/nhiều LHP, sửa),
│   │                             # AssignmentDetail (tab Thông tin · Nhóm · Bài đã nộp · Điểm),
│   │                             # Gradebook (danh sách LHP → bảng điểm), DrivePage, Search, Stats
│   ├── student/                  # Dashboard, Assignments, Course, AssignmentWork (4 bước), SubmitPage, Grades
│   ├── parent/  enterprise/  admin/
├── utils/                        # format ngày giờ VN, điểm, dung lượng; html sanitize
└── styles/kit.css
```

### 5.2. Cây route

```
/login  /forgot-password  /reset-password  /register-enterprise  /change-password
/view/:submissionId                                (trình xem dùng chung, ngoài khung)
/admin/{dashboard, lecturers, students, students/import, parents, enterprises, catalog/*, semesters,
        courses, sections, sections/:id, view-requests, grade-requests, submissions/search,
        stats/enterprises, stats/sections, stats/topics, drive-sync, audit-logs, settings}
/lecturer/{ (tổng quan), sections, sections/:sectionId, sections/:sectionId/assignments/new,
           assignments/new (nhiều LHP), assignments/:id (tab ?tab=info|groups|submissions|grades),
           assignments/:id/edit, gradebook, gradebook/:sectionId, search, stats, notifications, drive}
/student/{ (tổng quan), profile/setup, profile, assignments, courses/:sectionId,
          assignments/:id (4 bước), assignments/:id/submit[?part=personal], grades, privacy, notifications}
/parent/{choose-child, overview, grades, submissions, warnings}
/enterprise/{dashboard, search, students/:id, students/:id/submissions, view-requests, submissions/search, talent-map, stats}
```

## 6. Quy ước mã nguồn

| Chủ đề | Quy ước |
|---|---|
| Đặt tên | File `kebab-case`; class `PascalCase`; hằng `UPPER_SNAKE`; route API số nhiều, `kebab-case` |
| DTO | Định nghĩa bằng Zod trong `shared`, BE dùng qua `createZodDto` (nestjs-zod) để sinh Swagger |
| Phản hồi | Danh sách: `{ items, total, page, pageSize }` hoặc `{ items, nextCursor }`; lỗi: `{ statusCode, code, message, details? }` |
| Transaction | Mọi thao tác ghi nhiều bảng dùng `prisma.$transaction`; job đưa vào queue bằng `afterCommit()` |
| Quyền | Controller khai báo `@Roles`; service gọi Policy cho quyền sở hữu; repository luôn nhận `scope` người dùng |
| Thời gian | Lưu UTC; FE format theo `Asia/Ho_Chi_Minh` (hàm trong `utils/format.ts`) |
| Test | Mỗi service nghiệp vụ có unit test; mỗi UC P1 có ít nhất 1 e2e "happy path" + 1 ngoại lệ chính |
| Excel | Mọi file tải lên đi qua `imports`: luôn có bước xem trước, lỗi trả theo dòng/ô, chỉ ghi khi người dùng bấm *Áp dụng* |
| Commit | Conventional Commits (`feat(groups): ...`); nhánh `feature/<uc>-<mô-tả>` |
