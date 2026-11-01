# EduPortfolio – Cấu trúc module & mã nguồn (Modules Structure)

> Phiên bản 2.1 · 07/10/2026 · Node.js 22 LTS + TypeScript (NestJS 11 / React 19 + Vite 6) · mục **[v2.1]** là phần đối chiếu với tài liệu dự án và giao diện
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
├── .nvmrc                        # 22 (Node.js LTS) [v2.1]
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
├── schemas/            # Zod: auth, profile, assignment, group, topic, submission, grade, enterprise, ...
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
│   │   ├── google-drive/         # DriveClientFactory, DriveService, drive-errors.ts
│   │   └── realtime/             # RealtimeGateway (Socket.IO), RealtimeEmitter (cho worker)
│   └── modules/                  # mỗi module: *.module.ts, controllers/, services/, dto/, policies/, processors/
│       ├── auth/
│       ├── users/                # GV, SV, PH, DN (góc nhìn Admin) + import
│       ├── catalog/              # khoa, ngành, khóa, lớp SH, phòng, lĩnh vực, tags (quản trị)
│       ├── academic/             # học kỳ, môn học, LHP, lịch học, xếp SV
│       ├── profile/              # hồ sơ SV, đồng bộ PH
│       ├── drive-link/           # liên kết Drive của GV
│       ├── assignments/
│       ├── groups/
│       ├── topics/               # đề tài + tags (phía SV), duyệt đề tài (GV) [v2.1]
│       ├── uploads/              # tus server
│       ├── submissions/          # nộp, nộp lại, xóa tệp, lịch sử, xem, tìm, đồng bộ
│       ├── files/                # stream nội dung, thumbnail, download
│       ├── grading/              # chấm bài, rubric [v2.1], điểm học phần, công bố, yêu cầu sửa điểm, GPA
│       ├── appeals/              # phúc khảo [v2.1]
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
| `users` | UC02.1–2.5, 2.7 | CRUD tài khoản theo vai trò, khóa/mở, đặt lại mật khẩu, import SV, đổi SĐT PH, duyệt DN | profile (sync PH), notifications |
| `catalog` | UC02.6 | Danh mục; gộp/ẩn tag | – |
| `academic` | UC02.8–2.11, UC04.9 | Học kỳ, môn, LHP, lịch, kiểm tra trùng lịch, xếp SV, "LHP của tôi" | – |
| `profile` | UC03 | Khai báo/cập nhật hồ sơ, `ParentLinkSyncService`, công tắc discoverable, ảnh đại diện | audit |
| `drive-link` | UC04.1, UC04.4 | Lưu/kiểm tra thư mục gốc của GV; **OAuth Google (connect/callback/revoke)** | google-drive |
| `assignments` | UC04.2–4.8, **4.10** | CRUD bài tập, **giao nhiều LHP (`batch_id`)**, cấu hình chốt nhóm/phần cá nhân/duyệt đề tài/rubric, tạo thư mục, đổi thư mục (migrate), đóng/mở/hủy giao, điều chỉnh min/max | google-drive, groups, notifications |
| `groups` | UC05.1–5.6, 5.9–5.11, UC04.7 | Nhóm, thành viên, lời mời, mã mời, làm cá nhân, khóa/chốt nhóm, **`GroupAutoAssignService` (tự ghép / chuyển cá nhân)**, GV điều chỉnh + lịch sử | google-drive (job), notifications, realtime |
| `topics` | UC05.7–5.8, **5.12** | Đề tài, tags, gợi ý, cảnh báo trùng, lịch sử, **duyệt / yêu cầu sửa** | notifications |
| `uploads` | UC06.1–2 | tus endpoint, bảng `uploads`, dọn tệp hết hạn | storage |
| `submissions` | UC06 | Nộp/nộp lại/xóa tệp, lịch sử, chi tiết bài, tìm kiếm, đồng bộ Drive (processor), trạng thái đồng bộ | uploads, topics, google-drive, notifications, realtime |
| `files` | UC06.7, UC09.5 | `/files/:id/content|thumbnail|download`, `SubmissionAccessPolicy` | storage, google-drive, enterprise (log) |
| `grading` | UC07.1–7.10, UC08.2 | Chấm bài (**rubric, phần chung/cá nhân**), ghi đè điểm, trả bài, công bố điểm bài tập, điểm học phần, import Excel, công bố, yêu cầu sửa điểm, `GpaService`, cảnh báo học tập | notifications |
| `appeals` **[v2.1]** | UC07.11–7.12 | Phúc khảo: gửi, rút, GV phản hồi, tạo yêu cầu sửa điểm khi học phần đã khóa | grading, notifications |
| `parent-portal` | UC08 | API chỉ đọc cho PH (dùng service của grading/submissions qua policy) | grading, submissions |
| `enterprise` | UC09.1–9.6, 9.11 | Tìm SV, hồ sơ công khai, gửi/hủy yêu cầu, bài của SV được cấp quyền, log truy cập, "DN đã xem tôi" | submissions, notifications |
| `access-control` | UC09.8–9.10 | Admin duyệt/từ chối/thu hồi; job hết hạn và sắp hết hạn | notifications |
| `statistics` | UC10 | Truy vấn thống kê, cache, xuất Excel/PDF; **phân tích đề tài, bản đồ năng lực, `topic_trend_snapshots`** | – |
| `notifications` | UC11 | `NotificationService.notify`, API chuông, processor email, **cài đặt + bản tin tổng hợp** | mail, realtime |
| `audit` | UC02.12 | `AuditService.log`, API tra cứu | – |
| `settings` | UC02.13 | Đọc/ghi `system_settings` + cache | redis |
| `scheduler` | Bộ hẹn giờ | Đăng ký job lặp BullMQ (xem ModuleFlows §8) | các module trên |

### 3.3. Hàng đợi BullMQ

| Queue | Job | Đồng thời | Thử lại |
|---|---|---|---|
| `drive` | `ensure-folder`, `upload-file`, `trash-file`, `rename-folder`, `migrate-assignment`, `verify-files` | 4 + limiter 8/s | 8 lần, mũ từ 30 s |
| `mail` | `send`, `digest` **[v2.1]** | 5 | 5 lần, mũ từ 1' |
| `notify` | `fanout` (gửi thông báo cho nhiều người: mở bài tập, công bố điểm) | 2 | 3 |
| `grading` | `recompute-gpa`, `academic-warning-check` | 2 | 3 |
| `groups` **[v2.1]** | `lock-and-assign` (chốt nhóm một bài tập, gồm tự ghép) | 1 | 3 |
| `stats` **[v2.1]** | `topic-trends` | 1 | 2 |
| `reports` | `export` | 1 | 1 |
| `maintenance` | `cleanup-uploads`, `cleanup-cache`, `purge-logs` | 1 | 1 |
| `scheduler` | Job lặp (cron) gọi các service tương ứng | 1 | – |

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

### 4.4. Đào tạo & bài tập
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| GET | `/sections/mine?semesterId=` | L, S | 04.9 |
| GET | `/sections/:id` · `/sections/:id/students` | L (của mình), S (đang học) | 04.9 |
| GET/PUT | `/lecturer/drive-link` · POST `/lecturer/drive-link/verify` | L | 04.1, 04.4 |
| GET | `/lecturer/drive-link/oauth/start` · `/drive-link/oauth/callback` · POST `/lecturer/drive-link/oauth/revoke` **[v2.1]** | L | 04.1 |
| GET | `/drive/service-account` | L | 04.1 |
| POST | `/sections/:id/assignments` (form cố định LHP) | L | 04.2 |
| POST | `/assignments/batch` `{common, sections:[{sectionId, openAt, groupLockAt?, dueAt}]}` **[v2.1]** | L | 04.10 |
| POST | `/assignments/:id/unpublish` (hủy giao bài) **[v2.1]** | L | 04.5 |
| GET | `/sections/:id/assignments` | L, S | 04.9 |
| GET/PATCH/DELETE | `/assignments/:id` | L (sửa/xóa), S (xem) | 04.5, 04.8 |
| POST | `/assignments/:id/close` · `/reopen` `{dueAt}` | L | 04.5 |
| POST | `/assignments/:id/change-folder` `{folderUrl}` | L | 04.6 |
| PATCH | `/assignments/:id/group-settings` `{minMembers, maxMembers, groupLockAt?, unassignedPolicy?}` | L | 04.7 |
| GET/PUT | `/assignments/:id/rubric` `{criteria:[{name, maxScore, appliesTo}]}` **[v2.1]** | L | 07.10 |
| GET | `/assignments/:id/sync-status` · POST `/assignments/:id/sync/retry` | L | 06.9 |

### 4.5. Nhóm & đề tài
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| GET | `/assignments/:id/my-work` (hình thức, nhóm, đề tài, bài nộp của tôi) | S | 04.9 |
| POST | `/assignments/:id/individual` · DELETE `/assignments/:id/individual` | S | 05.1 |
| POST | `/assignments/:id/groups` `{name}` | S | 05.1 |
| GET | `/assignments/:id/groups` (bảng nhóm, đề tài, trạng thái) · `/assignments/:id/ungrouped` | L | 05.9 |
| GET/PATCH | `/groups/:id` (`{name}`) | S (thành viên), L | – |
| POST | `/groups/:id/invitations` `{studentCode}` · DELETE `/invitations/:id` | S (trưởng nhóm) | 05.2 |
| POST | `/groups/:id/invite-code/regenerate` | S (trưởng nhóm) | 05.2 |
| GET | `/me/invitations` · POST `/invitations/:id/accept` · `/decline` | S | 05.3 |
| POST | `/groups/join` `{code}` | S | 05.3 |
| DELETE | `/groups/:id/members/:studentId` | S (trưởng nhóm), L | 05.4, 04.7 |
| POST | `/groups/:id/transfer-leader` `{studentId}` | S (trưởng nhóm), L | 05.5 |
| POST | `/groups/:id/leave` | S | 05.6 |
| POST | `/groups/:id/members` `{studentId, force?, reason}` · `/groups/:id/move-member` `{studentId, toGroupId, reason}` | L | 04.7 |
| GET | `/assignments/:id/member-changes` **[v2.1]** | L | 04.7 |
| POST | `/assignments/:id/groups/lock-now` (chốt nhóm ngay, chạy UC05.11) **[v2.1]** | L | 05.10–5.11 |
| POST | `/groups/:id/lock` · `/unlock` · `/assignments/:id/groups/lock-all` | L | 05.10 |
| PUT | `/assignments/:id/topic` `{title, description, technologies, tags[]}` (tự xác định nhóm/cá nhân) | S, L | 05.7–5.8 |
| GET | `/topics/similar?assignmentId&title` | S | 05.7 |
| GET | `/topics/:id/history` | S (thành viên), L | 05.7 |
| GET | `/tags?q=` | * | 05.8 |
| GET | `/assignments/:id/topics?approval=PENDING` · POST `/topics/review` `{topicIds[], decision: APPROVE|REQUEST_REVISION, note?}` **[v2.1]** | L | 05.12 |

### 4.6. Nộp bài, xem, tìm
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| POST/PATCH/HEAD/DELETE | `/uploads[/:id]` (giao thức tus) | S | 06.1–2 |
| POST | `/assignments/:id/submissions` `{kind, uploadIds[], figmaUrl?, gitUrl?, note?, order[]}` | S | 06.1, 06.2, 06.4 |
| PATCH | `/submissions/:id` `{figmaUrl?, gitUrl?, note?, order[]?}` (không đổi tệp) | S | 06.1–2 |
| DELETE | `/submissions/:id/files` `{fileIds[]}` | S | 06.5 |
| GET | `/submissions/:id` | theo policy | 06.7 |
| GET | `/assignments/:id/submissions` (danh sách cho GV) | L | 06.7 |
| GET | `/submissions/:id/events` · `/assignments/:id/my-events` | S, L | 06.6 |
| GET | `/submissions/search?q&by=topic|name|code|cohort&cohortId&...` | A, L, E | 06.8 |
| GET | `/files/:id/content` (Range) · `/files/:id/thumbnail?w=` · `/files/:id/download` | theo policy | 06.7 |

### 4.7. Điểm
| Method | Endpoint | Vai trò | UC |
|---|---|---|---|
| PUT | `/submissions/:id/grade` `{score?, rubricScores?[], feedback, memberOverrides?[], individualScores?[]}` | L | 07.1, 07.3, 07.10 |
| POST | `/assignments/:id/grades/publish` (công bố điểm bài tập) **[v2.1]** | L | 07.1 |
| GET | `/lecturer/gradebooks?year=` (LHP theo năm/khóa) **[v2.1]** | L | 07.5 |
| POST | `/submissions/:id/return` `{reason, resubmitDueAt}` | L | 07.2 |
| GET | `/sections/:id/grades` | L, A | 07.4–7.5 |
| PATCH | `/sections/:id/grades/:studentId` `{attendance?, assignment?, midterm?, final?}` | L | 07.4 |
| POST | `/sections/:id/grades/fill-assignment` | L | 07.4 |
| GET | `/sections/:id/grades/export` · POST `/sections/:id/grades/import/preview` · `/import/:jobId/commit` | L | 07.4 |
| POST | `/sections/:id/grades/publish` `{allowIncomplete?}` | L | 07.6 |
| POST | `/grade-change-requests` · GET `/grade-change-requests/mine` · DELETE `/grade-change-requests/:id` | L | 07.7 |
| GET | `/admin/grade-change-requests` · POST `/admin/grade-change-requests/:id/approve` · `/reject` | A | 07.8 |
| GET | `/me/grades` · `/me/assignment-grades` | S | 07.9 |
| POST | `/appeals` `{target, assignmentId?, sectionGradeId?, content}` · GET `/appeals/mine` · DELETE `/appeals/:id` **[v2.1]** | S | 07.11 |
| GET | `/lecturer/appeals?status=&assignmentId=` · POST `/appeals/:id/resolve` `{decision: KEEP|CHANGE, newScore?, response}` **[v2.1]** | L | 07.12 |

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
| GET | `/stats/topics?semesterFrom&semesterTo&majorId&cohortId` (xu hướng, DN quan tâm, cung – cầu) **[v2.1]** | A, L (LHP của mình) | 10.7 |
| GET | `/stats/talent-map?dimension=major|cohort|cpa` **[v2.1]** | E, A | 10.8 |
| POST | `/reports/export` `{type, format, filters, chartImages?}` · GET `/reports/:id` · `/reports/:id/download` | A (L với LHP của mình) | 10.6 |
| GET | `/notifications?cursor&unread` · `/notifications/unread-count` | * | 11.1 |
| POST | `/notifications/:id/read` · `/notifications/read-all` | * | 11.1 |
| GET/PUT | `/me/notification-settings` `{emailEnabled, digestEnabled, digestTime, mutedTypes[]}` **[v2.1]** | * | 11.4 |
| GET | `/health` | Pub | – |

## 5. Frontend `apps/web`

### 5.1. Cây thư mục

```
apps/web/src/
├── main.tsx
├── app/
│   ├── router.tsx                # cây route theo vai trò, lazy load
│   ├── providers.tsx             # QueryClient, AntD ConfigProvider (vi_VN, theme), Socket
│   └── layouts/                  # AuthLayout, AppLayout (sidebar theo vai trò, header, chuông, menu đổi con)
├── lib/
│   ├── api.ts                    # ky instance: prefix /api/v1, tự refresh khi 401, ánh xạ ErrorCode → message
│   ├── socket.ts                 # socket.io-client + hook useSocketEvent
│   ├── query-keys.ts
│   ├── format.ts                 # ngày giờ VN, điểm, dung lượng
│   └── guards.tsx                # RequireAuth, RequireRole, RequireProfile, RequireChild
├── stores/session.store.ts       # Zustand: user, role, selectedChild
├── components/                   # dùng chung
│   ├── media/                    # ImageSlideshow, VideoPlayer, FigmaEmbed, FileList, SyncBadge
│   ├── upload/                   # SubmissionUploader (Uppy + tus), SortableImageGrid
│   ├── tables/                   # DataTable (AntD Table + lọc qua URL)
│   ├── charts/                   # LineChart, BarChart, PieChart, Histogram (Recharts)
│   ├── TagInput.tsx · StatusTag.tsx · Countdown.tsx · ConfirmDanger.tsx · EmptyState.tsx
├── features/                     # theo use case, mỗi thư mục: api.ts (hooks TanStack Query), components/, pages/
│   ├── auth/                     # Login, ForgotPassword, ResetPassword, ChangePassword, RegisterEnterprise, ChooseChild
│   ├── admin/
│   │   ├── dashboard/  users/  parents/  enterprises/  catalog/  academic/
│   │   ├── view-requests/  grade-requests/  audit/  settings/  stats/
│   ├── lecturer/
│   │   ├── sections/  assignments/ (tạo 1 LHP / nhiều LHP, trang theo trạng thái)  groups/  topic-review/
│   │   ├── grading/ (rubric, phần cá nhân)  appeals/  gradebook/  grade-requests/  drive-link/  stats/  notifications/
│   ├── student/
│   │   ├── profile/  sections/  assignment-work/ (đề bài + 5 bước: hình thức, nhóm, đề tài, nộp bài, chấm điểm)  invitations/  appeals/
│   │   ├── grades/  stats/  enterprise-views/
│   ├── parent/                   # overview, grades, submissions, warnings
│   ├── enterprise/               # search, student-profile, view-requests, student-submissions, stats, talent-map [v2.1]
│   ├── submissions/              # SubmissionViewer, SubmissionSearch (dùng chung A/L/E)
│   └── notifications/            # Bell, NotificationList
└── styles/
```

### 5.2. Cây route

```
/login  /forgot-password  /reset-password  /register-enterprise  /join/:code
/change-password                                  (bắt buộc khi must_change_password)
/admin/{dashboard, lecturers, students, students/import, parents, enterprises, catalog/*, semesters,
        courses, sections, sections/:id, view-requests, grade-requests, submissions/search,
        stats/enterprises, stats/sections, stats/topics, drive-sync, audit-logs, settings}
/lecturer/{dashboard, sections, sections/:id (tabs: SV | Bài tập | Bảng điểm | Thống kê),
           assignments/new (nhiều LHP), sections/:id/assignments/new (cố định LHP), assignments/:id/edit,
           assignments/:id (trang theo trạng thái: mới giao | đang lập nhóm | chờ duyệt đề tài | đang nộp | đang chấm | đã chấm),
           assignments/:id/groups, assignments/:id/grading, submissions/:id/grade, assignments/:id/results,
           gradebook, gradebook/:sectionId, grade-requests, submissions/search, stats, notifications, drive-link}
/student/{dashboard, profile/setup, profile, sections, sections/:id,
          assignments/:id (đề bài + bước: mode | group | topic | submit | result), assignments/:id/history,
          invitations, grades, stats, enterprise-views}
/parent/{choose-child, overview, grades, submissions, submissions/:id, warnings}
/enterprise/{dashboard, search, students/:id, students/:id/submissions, submissions/:id, view-requests, submissions/search, talent-map, stats}
/notifications  /submissions/:id (trình xem dùng chung)
```

## 6. Quy ước mã nguồn

| Chủ đề | Quy ước |
|---|---|
| Đặt tên | File `kebab-case`; class `PascalCase`; hằng `UPPER_SNAKE`; route API số nhiều, `kebab-case` |
| DTO | Định nghĩa bằng Zod trong `shared`, BE dùng qua `createZodDto` (nestjs-zod) để sinh Swagger |
| Phản hồi | Danh sách: `{ items, total, page, pageSize }` hoặc `{ items, nextCursor }`; lỗi: `{ statusCode, code, message, details? }` |
| Transaction | Mọi thao tác ghi nhiều bảng dùng `prisma.$transaction`; job đưa vào queue bằng `afterCommit()` |
| Quyền | Controller khai báo `@Roles`; service gọi Policy cho quyền sở hữu; repository luôn nhận `scope` người dùng |
| Thời gian | Lưu UTC; FE format bằng `dayjs` + `Asia/Ho_Chi_Minh` |
| Test | Mỗi service nghiệp vụ có unit test; mỗi UC P1 có ít nhất 1 e2e "happy path" + 1 ngoại lệ chính |
| Commit | Conventional Commits (`feat(groups): ...`); nhánh `feature/<uc>-<mô-tả>` |
