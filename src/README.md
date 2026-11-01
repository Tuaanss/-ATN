# EduPortfolio

Hệ thống quản lý kết quả học tập đa phương tiện của sinh viên — mã nguồn.
Thiết kế chi tiết nằm ở [`../docs`](../docs) (Requirement, Specification, Architecture, DatabaseDesign…).

Bản hiện tại triển khai hai chức năng lõi:

| Vai trò | Chức năng |
|---|---|
| **Giảng viên** | Dashboard · Lớp học phần · **Giao bài tập** cho một hoặc nhiều lớp (hạn riêng từng lớp), hình thức cá nhân/nhóm/SV tự chọn, hạn chốt nhóm, phần cá nhân trong bài nhóm (trọng số), duyệt đề tài, nộp muộn · Xem bài nộp (ảnh, video, Figma, mã nguồn) · Đóng / hủy giao bài |
| **Sinh viên** | Dashboard · Bài tập của tôi theo môn · Trang bài tập 5 bước (hình thức → nhóm → đề tài → nộp bài → chấm điểm) · Tạo nhóm / vào nhóm bằng mã · Đăng ký đề tài + từ khóa · **Nộp bài** chung / phần cá nhân kèm **tệp báo cáo PDF/DOC/DOCX**, nộp lại, xóa nhiều tệp |

Bài nộp được ghi lên **Google Drive của giảng viên** chạy nền (thử lại khi lỗi, giữ tạm tệp trên máy chủ đến khi đồng bộ xong).

## Công nghệ

- **Node.js 22 LTS + TypeScript** cho toàn bộ dự án
- Backend: NestJS 11, Prisma 6, **MySQL 8**, Zod, argon2, JWT (cookie httpOnly), googleapis
- Frontend: React 19, Vite 6, React Router 7, TanStack Query 5 – giao diện viết bằng CSS của bộ mẫu `project/` (styles/kit.css), không dùng thư viện UI

## Cấu trúc thư mục

```
src/
├── backend/                      # API NestJS
│   ├── prisma/
│   │   ├── schema.prisma         # lược đồ CSDL (theo docs/DatabaseDesign.md)
│   │   ├── migrations/           # migration SQL
│   │   └── seed.ts               # dữ liệu mẫu
│   └── src/
│       ├── main.ts · app.module.ts · load-env.ts
│       ├── config/               # đọc & kiểm tra biến môi trường
│       ├── common/               # auth guard, mã lỗi, Zod pipe, tiện ích tệp
│       ├── infra/                # DriveService (Google Drive / mô phỏng), StorageService (đĩa)
│       └── modules/
│           ├── auth/             # đăng nhập, đăng xuất, /auth/me
│           ├── assignments/      # giao bài tập (GV)
│           ├── submissions/      # nhóm, đề tài, nộp bài, đồng bộ Drive, xem tệp (SV)
│           ├── dashboard/        # tổng quan GV / SV
│           └── notifications/    # thông báo trong ứng dụng
├── frontend/                     # SPA React
│   └── src/
│       ├── api/                  # axios client, kiểu dữ liệu
│       ├── auth/                 # phiên đăng nhập, chặn route theo vai trò
│       ├── layouts/              # khung trang (menu, chuông thông báo)
│       ├── components/           # thẻ số liệu, nhãn trạng thái, thư viện tệp
│       ├── pages/lecturer/       # trang giảng viên
│       ├── pages/student/        # trang sinh viên
│       └── utils/
├── docker/compose.dev.yml        # MySQL bằng Docker (tùy chọn, khi chưa cài MySQL)
├── package.json                  # npm workspaces: backend, frontend
└── .gitignore
```

## Chạy trên máy

Yêu cầu: **Node.js ≥ 22** và **MySQL 8** (MySQL Installer, XAMPP/Laragon có MySQL 8, hoặc Docker).

**Tạo CSDL và tài khoản cho hệ thống** – chạy một lần trong MySQL Workbench / MySQL Command Line Client bằng tài khoản `root`:

```sql
CREATE DATABASE eduportfolio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'edu'@'localhost' IDENTIFIED BY 'edu';
GRANT ALL PRIVILEGES ON eduportfolio.* TO 'edu'@'localhost';
FLUSH PRIVILEGES;
```

(Dùng tài khoản / mật khẩu / cổng khác thì sửa `DATABASE_URL` trong `backend/.env`, dạng `mysql://<user>:<mật khẩu>@localhost:3306/eduportfolio`.
Có Docker mà chưa cài MySQL: `docker compose -f docker/compose.dev.yml up -d` – đã tạo sẵn CSDL và tài khoản `edu`.)

```bash
# 1. Cài thư viện (một lần, ở thư mục src/)
npm install

# 2. Tạo file cấu hình
cp backend/.env.example backend/.env

# 3. Tạo bảng + dữ liệu mẫu (một lần; chạy lại để làm mới dữ liệu)
npm run db:setup

# 5. Chạy API và web (hai terminal)
npm run dev:api        # http://localhost:3000/api/v1
npm run dev:web        # http://localhost:5173
```

Mở <http://localhost:5173>.

### Tài khoản chạy thử

`npm run db:seed` xóa sạch dữ liệu (kể cả tệp đã tải lên) và tạo các tài khoản dưới đây, cùng lớp **MH01_01 · Môn học 1**, chưa có bài tập nào:

| Vai trò (tab khi đăng nhập) | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Quản trị | `admin` | `Admin@123` |
| Giảng viên 1 | `GV001` | `GV001` |
| Sinh viên 1 | `SV0001` | `01012005` |
| Sinh viên 2 | `SV0002` | `02022005` |
| Phụ huynh (bố của SV0001 và SV0002) | `0912345678` | `Phuhuynh@123` |
| Doanh nghiệp (đã duyệt) | `hr@doanhnghiepa.vn` | `Doanhnghiep@123` |

SV0001 đã bật “cho doanh nghiệp tìm thấy” để chạy thử tìm kiếm của doanh nghiệp. Doanh nghiệp không tự đăng ký: doanh nghiệp liên hệ khoa, Quản trị viên tạo tài khoản ở trang Doanh nghiệp (mật khẩu tạm gửi qua email, bắt đổi ở lần đăng nhập đầu).

Mật khẩu SV là ngày sinh `ddmmyyyy` (Requirement D2). Sai mật khẩu 5 lần sẽ bị khóa 15 phút.

## Google Drive

| `DRIVE_MODE` | Cách hoạt động |
|---|---|
| `local` (mặc định) | Mô phỏng Drive bằng thư mục `backend/data/drive/` |
| `google` | Ghi thật lên Google Drive. Mỗi giảng viên bấm **Liên kết tài khoản Google** ở trang *Kết nối Google Drive* (OAuth, quyền `drive.file`); hệ thống tự tạo thư mục `EduPortfolio_<MãGV>` trong My Drive của GV và ghi bài nộp vào đó |

Bật Drive thật (OAuth – dùng được với Gmail cá nhân):

1. <https://console.cloud.google.com> → tạo project → **APIs & Services → Library** → bật **Google Drive API**.
2. **OAuth consent screen**: loại *External*, điền tên ứng dụng + email; ở *Test users* thêm Gmail sẽ dùng để liên kết.
3. **Credentials → Create credentials → OAuth client ID** → loại *Web application* → *Authorized redirect URIs* thêm đúng:
   `http://localhost:5173/api/v1/lecturer/drive/oauth/callback`
4. Trong `backend/.env`:
   ```
   DRIVE_MODE=google
   GOOGLE_OAUTH_CLIENT_ID=<Client ID>
   GOOGLE_OAUTH_CLIENT_SECRET=<Client secret>
   ```
5. Khởi động lại API → đăng nhập `GV001` → **Kết nối Google Drive** → *Liên kết tài khoản Google* → đồng ý. Sau đó GV giao bài và SV nộp bài; tệp xuất hiện trong `EduPortfolio_GV001/<MaLHP>_<TenBaiTap>/…` trên Drive.

Lưu ý: ứng dụng ở trạng thái *Testing* thì Google cho refresh token sống 7 ngày – hết hạn thì bấm liên kết lại. Refresh token được mã hóa AES-256-GCM trong CSDL.

Cách thay thế (Shared Drive của trường): dùng **Service Account** – đặt `GOOGLE_SA_KEY_BASE64=<khóa JSON mã hóa base64>`, chia sẻ thư mục trong Shared Drive cho email Service Account (quyền *Người chỉnh sửa*) rồi dán link thư mục khi tạo bài tập.

## API chính (`/api/v1`)

| Method | Endpoint | Vai trò |
|---|---|---|
| POST | `/auth/login` · `/auth/logout` · GET `/auth/me` | – |
| GET | `/dashboard/lecturer` · `/dashboard/student` | GV · SV |
| GET | `/lecturer/sections` · `/lecturer/sections/:id/assignments` | GV |
| POST | `/lecturer/assignments/batch` (nhiều lớp) · `/lecturer/sections/:id/assignments` (một lớp) | GV |
| GET / DELETE | `/lecturer/assignments/:id` · POST `/lecturer/assignments/:id/close` | GV |
| GET / PUT | `/lecturer/drive-link` | GV |
| GET | `/student/sections` · `/student/sections/:id/assignments` · `/student/assignments/:id` | SV |
| POST | `/student/assignments/:id/individual` · `/groups` · `/groups/join` | SV |
| PUT | `/student/assignments/:id/topic` | SV |
| POST | `/student/assignments/:id/submissions` (multipart `files[]`, `kind`, `figmaUrl`, `gitUrl`, `note`) | SV |
| DELETE | `/student/submissions/:id/files` | SV |
| GET | `/files/:id/content` (hỗ trợ `Range`, `?download=1`) | theo quyền |
| GET | `/notifications` · POST `/notifications/read-all` | mọi người |

## Ghi chú triển khai

So với thiết kế đầy đủ trong `docs/`, bản này đơn giản hóa một số điểm (sẽ bổ sung theo [TechTasks](../docs/TechTasks.md)):

- Upload qua multipart (multer) thay cho tus tải tiếp; hàng đợi đồng bộ Drive chạy trong tiến trình API, trạng thái lưu trong CSDL, thay cho BullMQ + Redis + worker riêng.
- Chưa có refresh token (access token 8 giờ), đổi mật khẩu lần đầu, khai báo hồ sơ.
- Từ khóa đề tài lưu trong cột `topics.keywords text[]`; bảng `tags` dùng chung sẽ thêm cùng chức năng gộp từ khóa của Admin.
- Chưa có chấm điểm, duyệt đề tài phía GV (SV đã gửi được đề tài chờ duyệt), chốt nhóm tự động.

## Đẩy lên GitHub

```bash
cd src
git init
git add .
git commit -m "feat: giao bài tập, nộp bài, dashboard GV/SV"
git branch -M main
git remote add origin https://github.com/<tai-khoan>/eduportfolio.git
git push -u origin main
```

`.gitignore` đã loại `node_modules/`, `dist/`, `.env`, khóa Service Account, dữ liệu cục bộ (`backend/data/`).
