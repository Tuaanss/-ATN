# EduPortfolio – Tài liệu Yêu cầu (Requirement)

> Hệ thống quản lý kết quả học tập đa phương tiện của sinh viên
> Phiên bản: 2.0 · Ngày: 07/10/2026 · Nguồn: 11 sơ đồ use case + SRS v1.1 (`Requirements_v1.1.pdf`)
> Tài liệu liên quan: [Specification](Specification.md) · [Architecture](Architecture.md) · [DatabaseDesign](DatabaseDesign.md)

---

## 1. Mục tiêu

Kết quả học tập của sinh viên hiện chỉ được lưu dưới dạng điểm số, còn sản phẩm thực tế (bài thiết kế, mã nguồn, video demo) nằm rải rác ở nhiều nơi. EduPortfolio gom điểm số và sản phẩm về một chỗ:

1. Giảng viên giao bài; bài nộp được ghi thẳng vào **thư mục Google Drive của giảng viên**.
2. Sinh viên làm bài cá nhân hoặc theo nhóm, tự đăng ký đề tài và gắn từ khóa.
3. Bài nộp được xem dạng trình chiếu ảnh, phát video, mở link Figma/GitHub.
4. Giảng viên chấm điểm, nhập điểm học phần; hệ thống tính GPA (học kỳ) và CPA (tích lũy).
5. Phụ huynh theo dõi điểm và bài nộp của con (chỉ đọc).
6. Doanh nghiệp tìm sinh viên theo GPA và đề tài, xin quyền xem bài có thời hạn.
7. Có thống kê cho từng vai trò và hệ thống thông báo tự động.

## 2. Phạm vi

**Trong phạm vi:** toàn bộ chức năng trong 11 nhóm use case ở mục 4.

**Ngoài phạm vi (phiên bản này):** portfolio công khai, rubric chấm điểm, phúc khảo, duyệt đề tài, SV đồng ý trước khi DN xem bài, SMS/Zalo, xem cây mã nguồn trực tuyến, phát hiện đạo văn, tích hợp phần mềm đào tạo của trường. Các mục này được ghi ở [mục 9](#9-hướng-mở-rộng) để làm tiếp nếu còn thời gian.

## 3. Tác nhân

| # | Tác nhân | Mã vai trò | Mô tả | Cách có tài khoản |
|---|---|---|---|---|
| 1 | Khách | – | Người chưa đăng nhập | – |
| 2 | Người dùng | – | Tác nhân trừu tượng, cha của mọi vai trò đã đăng nhập | – |
| 3 | Admin | `ADMIN` | Quản trị người dùng, danh mục, đào tạo; duyệt DN và quyền xem bài; xử lý yêu cầu sửa điểm | Tạo bằng seed khi cài đặt |
| 4 | Giảng viên (GV) | `LECTURER` | Giao bài, quản lý nhóm, chấm và nhập điểm, xem và tìm bài | Admin tạo |
| 5 | Sinh viên (SV) | `STUDENT` | Khai báo hồ sơ, làm và nộp bài, xem điểm | Admin tạo hoặc import Excel |
| 6 | Trưởng nhóm | `STUDENT` + vai trò trong nhóm | SV là trưởng một nhóm; kế thừa mọi quyền của SV | Người tạo nhóm hoặc được chuyển quyền |
| 7 | Phụ huynh (PH) | `PARENT` | Xem điểm, bài nộp, cảnh báo của con (chỉ đọc) | Hệ thống tự sinh từ SĐT trong hồ sơ SV |
| 8 | Doanh nghiệp (DN) | `ENTERPRISE` | Tìm SV, xin quyền xem bài, xem thống kê của mình | Tự đăng ký, chờ Admin duyệt |
| 9 | Bộ hẹn giờ | – | Tác vụ nền định kỳ: khóa nhóm, nhắc hạn, đồng bộ lại tệp, thu hồi quyền hết hạn | – |
| 10 | Google Drive | – | Hệ thống ngoài lưu tệp bài nộp | – |

## 4. Danh sách use case

Mức ưu tiên: **P1** là bắt buộc (MVP), **P2** là nên có, **P3** là có thì tốt.

### UC01 – Xác thực & Quản lý tài khoản

| Mã | Use case | Tác nhân | Quan hệ | Ưu tiên |
|---|---|---|---|---|
| UC01.1 | Đăng nhập | Người dùng | – | P1 |
| UC01.2 | Đăng nhập bằng SĐT | Phụ huynh | Kế thừa UC01.1 | P1 |
| UC01.3 | Chọn con cần xem | Phụ huynh | «extend» UC01.2 | P1 |
| UC01.4 | Đổi mật khẩu lần đầu | Người dùng | «extend» UC01.1 | P1 |
| UC01.5 | Quên mật khẩu | Người dùng | – | P2 |
| UC01.6 | Đổi mật khẩu | Người dùng | – | P1 |
| UC01.7 | Đăng xuất | Người dùng | – | P1 |
| UC01.8 | Đăng ký tài khoản doanh nghiệp | Khách | – | P1 |

### UC02 – Quản trị hệ thống

| Mã | Use case | Tác nhân | Quan hệ | Ưu tiên |
|---|---|---|---|---|
| UC02.1 | Quản lý tài khoản giảng viên | Admin | – | P1 |
| UC02.2 | Quản lý tài khoản sinh viên | Admin | – | P1 |
| UC02.3 | Import sinh viên từ Excel | Admin | «extend» UC02.2 | P1 |
| UC02.4 | Quản lý tài khoản phụ huynh | Admin | – | P2 |
| UC02.5 | Xử lý đổi SĐT phụ huynh | Admin | «extend» UC02.4 | P2 |
| UC02.6 | Quản lý danh mục | Admin | – | P1 |
| UC02.7 | Duyệt và quản lý tài khoản doanh nghiệp | Admin | – | P1 |
| UC02.8 | Quản lý học kỳ, môn học | Admin | – | P1 |
| UC02.9 | Quản lý lớp học phần | Admin | – | P1 |
| UC02.10 | Xếp sinh viên vào lớp học phần | Admin | «extend» UC02.9 | P1 |
| UC02.11 | Kiểm tra trùng lịch | Hệ thống | «include» từ UC02.9 | P1 |
| UC02.12 | Xem nhật ký hệ thống | Admin | – | P2 |
| UC02.13 | Cấu hình hệ thống | Admin | – | P2 |

### UC03 – Quản lý hồ sơ sinh viên

| Mã | Use case | Tác nhân | Quan hệ | Ưu tiên |
|---|---|---|---|---|
| UC03.1 | Khai báo hồ sơ | SV | – | P1 |
| UC03.2 | Cập nhật hồ sơ | SV | – | P1 |
| UC03.3 | Đồng bộ với tài khoản phụ huynh theo SĐT | Hệ thống | «include» từ UC03.1, UC03.2 | P1 |
| UC03.4 | Bật/tắt cho doanh nghiệp tìm thấy hồ sơ | SV | – | P1 |

### UC04 – Quản lý bài tập

| Mã | Use case | Tác nhân | Quan hệ | Ưu tiên |
|---|---|---|---|---|
| UC04.1 | Liên kết tài khoản Google Drive (Service Account) | GV, Google Drive | – | P1 |
| UC04.2 | Tạo bài tập | GV | – | P1 |
| UC04.3 | Tạo thư mục trên Drive | Hệ thống, Google Drive | «include» từ UC04.2 | P1 |
| UC04.4 | Kiểm tra quyền ghi thư mục trên Drive | Hệ thống, Google Drive | «include» từ UC04.2, UC04.6 | P1 |
| UC04.5 | Sửa / Đóng bài tập | GV | – | P1 |
| UC04.6 | Đổi thư mục nhận bài | GV | «extend» UC04.5 | P2 |
| UC04.7 | Điều chỉnh thành viên nhóm | GV | «extend» UC04.5 | P1 |
| UC04.8 | Xóa bài tập | GV | – | P1 |
| UC04.9 | Xem lớp học phần & bài tập được giao | SV | – | P1 |

### UC05 – Quản lý nhóm & đề tài

| Mã | Use case | Tác nhân | Quan hệ | Ưu tiên |
|---|---|---|---|---|
| UC05.1 | Tạo nhóm | SV | – | P1 |
| UC05.2 | Mời thành viên | Trưởng nhóm | – | P1 |
| UC05.3 | Phản hồi lời mời tham gia nhóm | SV | – | P1 |
| UC05.4 | Xóa thành viên | Trưởng nhóm | – | P1 |
| UC05.5 | Chuyển quyền trưởng nhóm | Trưởng nhóm | – | P1 |
| UC05.6 | Rời nhóm | SV | – | P1 |
| UC05.7 | Đăng ký đề tài | SV | – | P1 |
| UC05.8 | Gắn từ khóa đề tài | SV | «include» từ UC05.7 | P1 |
| UC05.9 | Xem danh sách nhóm & đề tài | GV | – | P1 |
| UC05.10 | Khóa nhóm | GV, Bộ hẹn giờ | – | P1 |

### UC06 – Nộp bài, xem & tìm kiếm bài nộp

| Mã | Use case | Tác nhân | Quan hệ | Ưu tiên |
|---|---|---|---|---|
| UC06.1 | Nộp bài nhóm | SV | – | P1 |
| UC06.2 | Nộp bài cá nhân | SV | – | P1 |
| UC06.3 | Ghi tệp lên Drive | Hệ thống, Google Drive | «include» từ UC06.1, UC06.2 | P1 |
| UC06.4 | Nộp lại bài | SV | «extend» UC06.1, UC06.2 | P1 |
| UC06.5 | Xóa nhiều ảnh/tệp | SV, Google Drive | – | P1 |
| UC06.6 | Xem lịch sử nộp bài | SV | – | P2 |
| UC06.7 | Xem bài nộp | SV, GV, DN, Admin | – | P1 |
| UC06.8 | Tìm kiếm bài nộp | GV, DN, Admin | – | P1 |
| UC06.9 | Đồng bộ lại tệp lỗi | Bộ hẹn giờ, Google Drive | – | P1 |
| UC06.10 | Gửi nhắc hạn nộp bài | Bộ hẹn giờ | – | P1 |

### UC07 – Quản lý & xem điểm

| Mã | Use case | Tác nhân | Quan hệ | Ưu tiên |
|---|---|---|---|---|
| UC07.1 | Chấm điểm bài tập | GV | – | P1 |
| UC07.2 | Yêu cầu làm lại | GV | «extend» UC07.1 | P2 |
| UC07.3 | Cho điểm riêng từng thành viên | GV | «extend» UC07.1 | P1 |
| UC07.4 | Nhập điểm học phần | GV | – | P1 |
| UC07.5 | Xem bảng điểm lớp học phần | GV | – | P1 |
| UC07.6 | Công bố điểm | GV | – | P1 |
| UC07.7 | Yêu cầu sửa điểm sau khi khóa | GV | – | P1 |
| UC07.8 | Xử lý yêu cầu sửa điểm của GV | Admin | – | P1 |
| UC07.9 | Xem điểm của bản thân | SV | – | P1 |

### UC08 – Xem kết quả học tập của con

| Mã | Use case | Tác nhân | Ưu tiên |
|---|---|---|---|
| UC08.1 | Chọn con cần xem | PH | P1 |
| UC08.2 | Xem điểm, GPA, CPA của con | PH | P1 |
| UC08.3 | Xem bài nộp của con | PH | P1 |
| UC08.4 | Xem thông báo, cảnh báo học tập của con | PH | P2 |

### UC09 – Tìm kiếm sinh viên & Quản lý quyền xem bài

| Mã | Use case | Tác nhân | Quan hệ | Ưu tiên |
|---|---|---|---|---|
| UC09.1 | Tìm kiếm sinh viên | DN | – | P1 |
| UC09.2 | Xem tóm tắt hồ sơ sinh viên | DN | «extend» UC09.1 | P1 |
| UC09.3 | Gửi yêu cầu xem bài nộp | DN | «extend» UC09.2 | P1 |
| UC09.4 | Xem trạng thái cấp quyền | DN | – | P1 |
| UC09.5 | Xem bài nộp của SV được cấp quyền | DN | – | P1 |
| UC09.6 | Ghi nhật ký truy cập | Hệ thống | «include» từ UC09.5 | P1 |
| UC09.7 | Duyệt tài khoản doanh nghiệp | Admin | Trùng UC02.7 | P1 |
| UC09.8 | Xử lý yêu cầu xem bài | Admin | – | P1 |
| UC09.9 | Thu hồi quyền xem bài | Admin | – | P1 |
| UC09.10 | Thu hồi quyền khi hết hạn (tự động) | Bộ hẹn giờ | – | P1 |
| UC09.11 | Xem doanh nghiệp đã xem bài của mình | SV | – | P2 |

### UC10 – Thống kê & Báo cáo

| Mã | Use case | Tác nhân | Quan hệ | Ưu tiên |
|---|---|---|---|---|
| UC10.1 | Xem Dashboard tổng quan | Admin | – | P1 |
| UC10.2 | Xem thống kê doanh nghiệp | Admin | – | P2 |
| UC10.3 | Xem thống kê lớp học phần | Admin, GV | – | P1 |
| UC10.4 | Xem thống kê cá nhân sinh viên | SV | – | P2 |
| UC10.5 | Xem thống kê của doanh nghiệp mình | DN | – | P2 |
| UC10.6 | Xuất báo cáo (Excel/PDF) | Admin | «extend» UC10.1, UC10.2, UC10.3 | P2 |

### UC11 – Thông báo

| Mã | Use case | Tác nhân | Ưu tiên |
|---|---|---|---|
| UC11.1 | Xem danh sách thông báo, đánh dấu đã đọc | Người dùng | P1 |
| UC11.2 | Nhận thông báo qua email | Người dùng | P1 |
| UC11.3 | Phát thông báo tự động theo sự kiện / lịch | Bộ hẹn giờ, Hệ thống | P1 |

## 5. Yêu cầu chức năng

Mỗi yêu cầu gắn với một use case. Luồng chi tiết nằm trong [Specification.md](Specification.md).

### 5.1. Xác thực (UC01)

| Mã | Yêu cầu | UC |
|---|---|---|
| FR-01.01 | Đăng nhập bằng tên đăng nhập + mật khẩu. Tên đăng nhập: `admin` cho Admin, mã GV, MSSV, email cho DN, SĐT cho PH | UC01.1–2 |
| FR-01.02 | Sai mật khẩu 5 lần liên tiếp thì khóa đăng nhập 15 phút | UC01.1 |
| FR-01.03 | Tài khoản do hệ thống sinh ra (SV, PH, GV) phải đổi mật khẩu ở lần đăng nhập đầu; trước khi đổi thì chỉ gọi được API đổi mật khẩu và đăng xuất | UC01.4 |
| FR-01.04 | PH có nhiều con thì sau khi đăng nhập phải chọn con; có thể đổi con bất kỳ lúc nào | UC01.3 |
| FR-01.05 | Quên mật khẩu: gửi link đặt lại (hạn 30 phút, dùng một lần) tới email đã đăng ký. PH không có email thì liên hệ Admin đặt lại | UC01.5 |
| FR-01.06 | Đổi mật khẩu phải nhập mật khẩu cũ; xong thì thu hồi mọi phiên khác | UC01.6 |
| FR-01.07 | Đăng xuất thu hồi refresh token và xóa cookie | UC01.7 |
| FR-01.08 | DN đăng ký: tên DN, mã số thuế, email, người liên hệ, SĐT, lĩnh vực, website. Tài khoản ở trạng thái `PENDING` đến khi Admin duyệt | UC01.8 |

### 5.2. Quản trị (UC02)

| Mã | Yêu cầu | UC |
|---|---|---|
| FR-02.01 | CRUD GV; khóa/mở khóa; đặt lại mật khẩu | UC02.1 |
| FR-02.02 | CRUD SV; khóa/mở khóa; đặt lại mật khẩu; lọc theo khoa, ngành, khóa, lớp | UC02.2 |
| FR-02.03 | Import SV từ Excel theo mẫu: xem trước, báo lỗi từng dòng, chỉ ghi các dòng hợp lệ. Mật khẩu ban đầu = ngày sinh `ddmmyyyy` | UC02.3 |
| FR-02.04 | Xem danh sách PH cùng các SV được liên kết; khóa, đặt lại mật khẩu | UC02.4 |
| FR-02.05 | Đổi SĐT của một tài khoản PH: cập nhật tên đăng nhập và SĐT trong hồ sơ mọi SV liên kết; gộp tài khoản nếu SĐT mới đã tồn tại; ghi log | UC02.5 |
| FR-02.06 | Danh mục: khoa, ngành, khóa, lớp sinh hoạt, phòng học, lĩnh vực DN, từ khóa đề tài (gộp, ẩn) | UC02.6 |
| FR-02.07 | Duyệt / từ chối (bắt buộc lý do) / khóa / mở khóa DN | UC02.7 |
| FR-02.08 | Học kỳ (năm học, kỳ, ngày bắt đầu–kết thúc, kỳ hiện tại); môn học (mã, tên, tín chỉ, loại `DESIGN`/`PROGRAMMING`/`OTHER`, trọng số 4 thành phần điểm) | UC02.8 |
| FR-02.09 | Lớp học phần: môn + học kỳ + GV + sĩ số tối đa + lịch học (thứ, tiết bắt đầu–kết thúc, phòng) | UC02.9 |
| FR-02.10 | Xếp SV vào LHP: chọn tay hoặc import danh sách MSSV; cảnh báo vượt sĩ số và trùng lịch của SV | UC02.10 |
| FR-02.11 | Kiểm tra trùng lịch khi lưu LHP: cùng GV hoặc cùng phòng, cùng thứ, giao nhau về tiết, cùng học kỳ thì chặn và liệt kê các LHP xung đột | UC02.11 |
| FR-02.12 | Tra cứu audit log theo người dùng, hành động, đối tượng, khoảng thời gian | UC02.12 |
| FR-02.13 | Cấu hình: giới hạn dung lượng/số lượng tệp, định dạng cho phép, thời hạn quyền xem DN (min/max), ngưỡng cảnh báo học tập, phạm vi tìm bài của GV | UC02.13 |

### 5.3. Hồ sơ SV (UC03)

| Mã | Yêu cầu | UC |
|---|---|---|
| FR-03.01 | Lần đăng nhập đầu (sau khi đổi mật khẩu) SV bị chuyển tới màn hình khai báo hồ sơ; chưa xong thì không dùng được chức năng khác | UC03.1 |
| FR-03.02 | Hồ sơ bắt buộc: SĐT bản thân, email nhận thông báo, ít nhất 1 trong 3 SĐT bố/mẹ/người giám hộ (hoặc chọn lý do không có) | UC03.1 |
| FR-03.03 | Hồ sơ tùy chọn: ảnh đại diện, giới thiệu, kỹ năng, link GitHub/Behance/LinkedIn | UC03.2 |
| FR-03.04 | Mỗi SĐT phụ huynh hợp lệ: có tài khoản PH thì thêm liên kết; chưa có thì tạo mới (tên đăng nhập = SĐT, mật khẩu tạm = SĐT, bắt buộc đổi) | UC03.3 |
| FR-03.05 | Đổi hoặc xóa SĐT PH: gỡ liên kết cũ; tài khoản cũ không còn con nào thì vô hiệu hóa | UC03.3 |
| FR-03.06 | Công tắc "Cho doanh nghiệp tìm thấy hồ sơ", mặc định **tắt** (theo NĐ 13/2023) | UC03.4 |

### 5.4. Bài tập (UC04)

| Mã | Yêu cầu | UC |
|---|---|---|
| FR-04.01 | Trang "Liên kết Google Drive" hiển thị email Service Account và hướng dẫn; GV dán link thư mục gốc, hệ thống kiểm tra rồi lưu | UC04.1 |
| FR-04.02 | Tạo bài tập: tiêu đề, mô tả, LHP, ngày mở, hạn nộp, hình thức (`INDIVIDUAL`/`GROUP`/`CHOICE`), số thành viên min–max, loại sản phẩm (ảnh, Figma, video, mã nguồn, link Git), cho nộp muộn (hạn muộn, % trừ), trọng số trong cột điểm bài tập, thư mục Drive nhận bài | UC04.2 |
| FR-04.03 | Loại sản phẩm gợi ý theo loại môn: Thiết kế → ảnh + Figma; Lập trình → video + mã nguồn/Git; GV tùy chỉnh được | UC04.2 |
| FR-04.04 | Khi lưu: kiểm tra link là thư mục, tồn tại, ghi thử được. Đạt thì tạo thư mục `<MaLHP>_<TenBaiTap>`; không đạt thì không lưu và hiện hướng dẫn | UC04.3–4 |
| FR-04.05 | Sửa thông tin, gia hạn, đóng bài tập (`CLOSED`: không nhận bài nữa), mở lại | UC04.5 |
| FR-04.06 | Đổi thư mục nhận bài: chưa có bài nộp thì đổi ngay; đã có thì chạy tác vụ nền chép toàn bộ sang thư mục mới | UC04.6 |
| FR-04.07 | Điều chỉnh nhóm: sửa min/max (nhóm vượt max mới thì giữ nguyên nhưng không thêm được người), thêm/chuyển/xóa SV giữa các nhóm, xem SV chưa có nhóm | UC04.7 |
| FR-04.08 | Xóa bài tập chỉ khi chưa có bài nộp; thư mục Drive trống bị chuyển vào thùng rác | UC04.8 |
| FR-04.09 | SV xem các LHP đang học trong kỳ và bài tập của từng LHP kèm trạng thái nộp và hạn còn lại | UC04.9 |
| FR-04.10 | Khi bài tập được mở, gửi thông báo cho mọi SV trong LHP | UC04.2 |

### 5.5. Nhóm & đề tài (UC05)

| Mã | Yêu cầu | UC |
|---|---|---|
| FR-05.01 | Bài tập `CHOICE`: SV chọn "Làm cá nhân" hoặc "Tạo nhóm"; được đổi khi chưa nộp bài | UC05.1 |
| FR-05.02 | Tạo nhóm: đặt tên, người tạo thành trưởng nhóm, hệ thống sinh mã mời 8 ký tự | UC05.1 |
| FR-05.03 | Mời qua MSSV (lời mời hết hạn sau 72 giờ) hoặc chia sẻ mã mời; trưởng nhóm làm mới được mã | UC05.2 |
| FR-05.04 | Chấp nhận / từ chối lời mời; nhập mã để tham gia ngay | UC05.3 |
| FR-05.05 | Trưởng nhóm xóa thành viên khi nhóm chưa có bài nộp và chưa khóa | UC05.4 |
| FR-05.06 | Trưởng nhóm chuyển quyền cho thành viên khác | UC05.5 |
| FR-05.07 | Rời nhóm: trưởng nhóm phải chuyển quyền trước (nhóm còn 1 người thì giải tán); sau khi nhóm có bài nộp thì không tự rời được, phải nhờ GV | UC05.6 |
| FR-05.08 | Đăng ký đề tài: tên (5–200 ký tự), mô tả (≤1000), công nghệ; sửa được đến hạn nộp; lưu lịch sử sửa | UC05.7 |
| FR-05.09 | Gắn 1–5 từ khóa; ô nhập gợi ý từ khóa có sẵn, chuẩn hóa không dấu/không hoa để tránh trùng | UC05.8 |
| FR-05.10 | Cảnh báo (không chặn) khi tên đề tài giống đề tài khác trong cùng LHP (độ tương đồng ≥ 0,6) | UC05.7 |
| FR-05.11 | GV xem bảng nhóm/đề tài/từ khóa/thành viên/trạng thái nộp; lọc theo trạng thái; xem SV chưa có nhóm | UC05.9 |
| FR-05.12 | GV khóa/mở khóa nhóm thủ công; Bộ hẹn giờ tự khóa mọi nhóm khi qua hạn nộp (hoặc hạn nộp muộn) | UC05.10 |

### 5.6. Nộp, xem & tìm bài (UC06)

| Mã | Yêu cầu | UC |
|---|---|---|
| FR-06.01 | Bài tập nhóm có hai khu vực: **Bài chung** (mọi thành viên thấy, hiện người nộp và thời gian) và **Bài cá nhân** (chỉ SV đó và GV thấy) | UC06.1–2 |
| FR-06.02 | Phải đăng ký đề tài và hoàn thiện hồ sơ trước khi nộp | UC06.1–2 |
| FR-06.03 | Upload có thanh tiến trình, hủy được, tải tiếp khi mất mạng (video lớn) | UC06.1–2 |
| FR-06.04 | Kiểm tra định dạng thực (magic bytes), dung lượng, số lượng theo cấu hình | UC06.1–2 |
| FR-06.05 | Nộp thành công ngay khi server nhận đủ tệp; ghi lên Drive chạy nền. Thời điểm nộp là lúc server nhận | UC06.3 |
| FR-06.06 | Bài chung: một thành viên nộp thì các thành viên khác thấy ngay (real-time) và nhận thông báo | UC06.1 |
| FR-06.07 | Nộp lại: xác nhận "Bản trước sẽ bị xóa vĩnh viễn"; bản cũ bị xóa cả trên Drive (vào thùng rác); không nộp lại được sau khi đã chấm, trừ khi GV yêu cầu làm lại | UC06.4 |
| FR-06.08 | Chọn nhiều ảnh/tệp bằng checkbox để xóa cùng lúc; xóa hết thì bài về trạng thái chưa nộp | UC06.5 |
| FR-06.09 | Lịch sử nộp: ai, lúc nào, nộp/nộp lại/xóa những tệp nào; vẫn giữ sau khi tệp cũ bị xóa | UC06.6 |
| FR-06.10 | Trình xem: ảnh dạng trình chiếu (Next/Prev, "3/12", thumbnail, phím ←/→, vuốt, zoom, toàn màn hình); video phát dạng stream, tua được; Figma nhúng hoặc mở tab; link Git mở tab; tải ZIP mã nguồn (chỉ vai trò được phép tải) | UC06.7 |
| FR-06.11 | Quyền xem bài nộp theo ma trận ở [Specification §3](Specification.md#3-ma-trận-phân-quyền) | UC06.7 |
| FR-06.12 | Tìm bài theo tên đề tài, từ khóa, tên/MSSV SV; không phân biệt dấu và hoa thường, tìm gần đúng; lọc theo học kỳ, môn, LHP, loại môn, khoảng điểm, trạng thái | UC06.8 |
| FR-06.13 | Phạm vi tìm: Admin tìm toàn hệ thống; GV tìm trong LHP mình dạy (hoặc cả khoa, theo cấu hình); DN chỉ tìm trong bài của SV mà mình đang có quyền xem | UC06.8 |
| FR-06.14 | Tệp lỗi đồng bộ được thử lại theo backoff tăng dần (tối đa 8 lần), sau đó báo GV kèm nguyên nhân và nút "Thử lại" | UC06.9 |
| FR-06.15 | Nhắc hạn: trước 24 giờ và trước 2 giờ, gửi cho SV/nhóm chưa nộp (không gửi trùng) | UC06.10 |

### 5.7. Điểm (UC07)

| Mã | Yêu cầu | UC |
|---|---|---|
| FR-07.01 | Chấm bài nộp: điểm (0–10, 1 chữ số thập phân) + nhận xét. Bài chung nhóm: điểm áp dụng cho mọi thành viên | UC07.1 |
| FR-07.02 | Ghi đè điểm riêng cho từng thành viên, kèm ghi chú | UC07.3 |
| FR-07.03 | Yêu cầu làm lại: nhập lý do + hạn nộp lại; bài chuyển `RETURNED`, SV nộp lại được đến hạn mới | UC07.2 |
| FR-07.04 | Bảng nhập điểm học phần: chuyên cần, bài tập, giữa kỳ, cuối kỳ; cột bài tập lấy được tự động từ điểm các bài tập theo trọng số; import/export Excel | UC07.4 |
| FR-07.05 | Tự tính điểm tổng kết (thang 10), điểm chữ, thang 4 | UC07.4 |
| FR-07.06 | Bảng điểm LHP có lọc, sắp xếp, tô màu SV dưới ngưỡng | UC07.5 |
| FR-07.07 | Công bố điểm: khóa bảng điểm, SV/PH thấy điểm, tính lại GPA/CPA, gửi thông báo | UC07.6 |
| FR-07.08 | Sau khi khóa, GV gửi yêu cầu sửa điểm (SV, giá trị cũ/mới, lý do) | UC07.7 |
| FR-07.09 | Admin duyệt (hệ thống áp dụng giá trị mới, tính lại GPA/CPA, ghi log, báo GV và SV) hoặc từ chối kèm lý do | UC07.8 |
| FR-07.10 | SV xem điểm từng bài tập, điểm học phần đã công bố, GPA từng kỳ, CPA | UC07.9 |

### 5.8. Phụ huynh (UC08)

| Mã | Yêu cầu | UC |
|---|---|---|
| FR-08.01 | Chuyển đổi giữa các con được liên kết | UC08.1 |
| FR-08.02 | Xem bảng điểm theo học kỳ (chỉ điểm đã công bố), GPA từng kỳ, CPA, biểu đồ xu hướng | UC08.2 |
| FR-08.03 | Xem bài nộp của con (bài chung + bài cá nhân), chỉ đọc, không tải | UC08.3 |
| FR-08.04 | Xem cảnh báo học tập của con: quá hạn chưa nộp, điểm học phần < 4,0, GPA kỳ < 2,0 hoặc giảm ≥ 0,5 so với kỳ trước | UC08.4 |

### 5.9. Doanh nghiệp & quyền xem bài (UC09)

| Mã | Yêu cầu | UC |
|---|---|---|
| FR-09.01 | Tìm SV theo MSSV (khớp chính xác), khóa, ngành, từ khóa/chủ đề đề tài, kỹ năng, khoảng CPA. Chỉ trả về SV đã bật "cho DN tìm thấy" | UC09.1 |
| FR-09.02 | Kết quả sắp CPA giảm dần → số đề tài giảm dần → MSSV; 20 SV/trang; mỗi SV kèm danh sách đề tài (tên + từ khóa) của các bài đã nộp | UC09.1 |
| FR-09.03 | Hồ sơ tóm tắt: họ tên, khóa, ngành, CPA, kỹ năng, link mạng xã hội, danh sách đề tài. Không hiện SĐT, email, thông tin PH, điểm chi tiết | UC09.2 |
| FR-09.04 | Gửi yêu cầu xem bài: chọn một hoặc nhiều SV, mục đích, số ngày mong muốn (14–28). Không cho gửi trùng khi đã có yêu cầu đang chờ hoặc đang hiệu lực | UC09.3 |
| FR-09.05 | DN xem danh sách yêu cầu theo trạng thái, ngày hết hạn, số ngày còn lại | UC09.4 |
| FR-09.06 | Trong thời hạn, DN xem bài chung (của các nhóm SV đó là thành viên) và bài cá nhân của SV; chỉ xem, không tải | UC09.5 |
| FR-09.07 | Mỗi lần DN xem hồ sơ, bài nộp, tệp đều ghi `enterprise_access_logs` | UC09.6 |
| FR-09.08 | Admin duyệt (chọn 14–28 ngày, tính từ lúc duyệt) hoặc từ chối (bắt buộc lý do); xử lý được nhiều yêu cầu một lúc | UC09.8 |
| FR-09.09 | Admin thu hồi sớm kèm lý do | UC09.9 |
| FR-09.10 | Bộ hẹn giờ chuyển yêu cầu quá hạn sang `EXPIRED`; báo DN trước 2 ngày và khi hết hạn | UC09.10 |
| FR-09.11 | SV xem DN nào đã xem hồ sơ/bài của mình, thời điểm, thời hạn quyền | UC09.11 |

### 5.10. Thống kê (UC10)

| Mã | Yêu cầu | UC |
|---|---|---|
| FR-10.01 | Dashboard Admin: số người dùng theo vai trò; bài nộp theo tuần; tệp đang chờ/lỗi đồng bộ; DN chờ duyệt; yêu cầu xem bài chờ xử lý; yêu cầu sửa điểm chờ xử lý | UC10.1 |
| FR-10.02 | Thống kê DN: tổng số theo trạng thái, đăng ký mới theo tháng, theo lĩnh vực; yêu cầu xem bài theo trạng thái, tỉ lệ duyệt, thời gian xử lý trung bình; lượt tìm kiếm theo ngày; từ khóa được tìm nhiều; top SV được quan tâm; top DN hoạt động | UC10.2 |
| FR-10.03 | Thống kê LHP: tỉ lệ nộp đúng hạn/muộn/chưa nộp từng bài tập; danh sách SV chưa nộp; phổ điểm; phân bố điểm chữ; top từ khóa đề tài | UC10.3 |
| FR-10.04 | Thống kê SV: GPA từng kỳ, CPA, tín chỉ tích lũy, tiến độ nộp bài kỳ hiện tại, số DN đã xem mình | UC10.4 |
| FR-10.05 | Thống kê DN mình: yêu cầu theo trạng thái, quyền đang còn hạn (số ngày còn lại), số SV đã xem bài, lịch sử tìm kiếm gần đây | UC10.5 |
| FR-10.06 | Xuất các thống kê UC10.1–10.3 ra Excel (.xlsx) và PDF, có bộ lọc thời gian/học kỳ | UC10.6 |

### 5.11. Thông báo (UC11)

| Mã | Yêu cầu | UC |
|---|---|---|
| FR-11.01 | Chuông thông báo: số chưa đọc, danh sách phân trang, đánh dấu đã đọc từng cái hoặc tất cả, bấm để đi tới đối tượng | UC11.1 |
| FR-11.02 | Thông báo mới được đẩy real-time (WebSocket) | UC11.1 |
| FR-11.03 | Gửi email cho các sự kiện quan trọng (danh sách ở [Specification §5](Specification.md#5-danh-mục-thông-báo)) | UC11.2 |
| FR-11.04 | Không gửi trùng thông báo định kỳ (khóa chống trùng `dedupe_key`) | UC11.3 |

## 6. Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| BR-01 | SĐT Việt Nam: 10 chữ số, đầu số `03|05|07|08|09`. SĐT PH không được trùng SĐT của chính SV. SĐT và email của SV là duy nhất |
| BR-02 | Một SĐT ứng với đúng một tài khoản PH; anh chị em khai cùng SĐT thì dùng chung tài khoản. Bố, mẹ, người giám hộ có SĐT khác nhau là các tài khoản khác nhau, cùng quyền |
| BR-03 | PH chỉ đọc: không sửa, không tải tệp |
| BR-04 | Hạn nộp phải sau ngày mở và nằm trong học kỳ; `1 ≤ min ≤ max ≤ 10` |
| BR-05 | Chỉ GV phụ trách LHP mới giao, sửa, chấm bài tập và nhập điểm của LHP đó |
| BR-06 | Không xóa được bài tập đã có bài nộp, chỉ đóng được |
| BR-07 | Mỗi SV thuộc tối đa 1 nhóm trong 1 bài tập; chỉ mời SV cùng LHP; không vượt `max_members` |
| BR-08 | Mã mời duy nhất, không phân biệt hoa thường; hết hiệu lực khi nhóm đủ người, bị khóa hoặc qua hạn |
| BR-09 | Mỗi nhóm (hoặc SV làm cá nhân) có đúng 1 đề tài cho 1 bài tập; 1–5 từ khóa, mỗi từ ≤ 50 ký tự |
| BR-10 | Mỗi nhóm có tối đa 1 bài chung; mỗi SV có tối đa 1 bài cá nhân cho 1 bài tập; chỉ giữ bản mới nhất |
| BR-11 | Không nộp sau hạn, trừ khi bật nộp muộn (đánh dấu "Nộp muộn", trừ % điểm cấu hình) |
| BR-12 | Hai thành viên nộp bài chung gần như cùng lúc: bản đến sau được giữ, cả hai được thông báo |
| BR-13 | Môn Thiết kế: 1–30 ảnh, mỗi ảnh ≤ 10 MB (JPG/PNG/WEBP); link Figma thuộc `figma.com`. Môn Lập trình: video ≤ 500 MB (MP4/WEBM/MOV), mã nguồn ZIP/RAR/7Z ≤ 100 MB hoặc link GitHub/GitLab. Admin cấu hình được |
| BR-14 | Điểm thang 10, làm tròn 1 chữ số; tổng trọng số thành phần = 100% |
| BR-15 | Quy đổi: A 8,5–10 = 4,0 · B+ 8,0–8,4 = 3,5 · B 7,0–7,9 = 3,0 · C+ 6,5–6,9 = 2,5 · C 5,5–6,4 = 2,0 · D+ 5,0–5,4 = 1,5 · D 4,0–4,9 = 1,0 · F < 4,0 = 0 |
| BR-16 | GPA kỳ = Σ(điểm hệ 4 × tín chỉ) / Σ tín chỉ của các học phần đã công bố trong kỳ. CPA tương tự trên mọi kỳ; môn học lại lấy lần điểm cao nhất |
| BR-17 | Điểm đã công bố chỉ sửa được qua yêu cầu sửa điểm được Admin duyệt |
| BR-18 | DN chỉ dùng hệ thống sau khi được duyệt; chỉ xem bài khi có yêu cầu `APPROVED` còn hạn (14–28 ngày tính từ lúc duyệt) |
| BR-19 | DN không thấy SĐT, email, thông tin PH, điểm chi tiết; không tải tệp |
| BR-20 | SV, PH, DN không bao giờ được cấp quyền trực tiếp vào thư mục Drive; mọi truy cập tệp đi qua API |
| BR-21 | Thư mục Drive nhận diện bằng `folder_id`, không dựa vào tên; tên thư mục tự tạo bỏ ký tự đặc biệt |
| BR-22 | GV tự xóa tệp trên Drive thì lần kiểm tra kế tiếp đánh dấu tệp `MISSING` để GV biết |

## 7. Yêu cầu phi chức năng

| Mã | Nhóm | Yêu cầu |
|---|---|---|
| NFR-01 | Hiệu năng | API thông thường p95 < 500 ms; trang tải < 2 s; tìm kiếm < 3 s với 10.000 SV, 100.000 bài nộp |
| NFR-02 | Hiệu năng | ≥ 500 người dùng đồng thời lúc cao điểm hạn nộp |
| NFR-03 | Hiệu năng | Upload chia khối (chunk 5 MB), tải tiếp khi gián đoạn; ảnh hiển thị qua thumbnail + lazy-load; video stream bằng HTTP Range |
| NFR-04 | Bảo mật | Mật khẩu băm Argon2id; không lưu mật khẩu rõ |
| NFR-05 | Bảo mật | JWT access 15 phút + refresh 7 ngày xoay vòng, phát hiện dùng lại token; lưu trong cookie `httpOnly`, `Secure`, `SameSite=Lax` |
| NFR-06 | Bảo mật | RBAC + kiểm tra quyền sở hữu dữ liệu ở server cho mọi API |
| NFR-07 | Bảo mật | Chống SQL injection (ORM tham số hóa), XSS (escape, CSP), CSRF (SameSite + kiểm tra `Origin`); rate limit đăng nhập 5 lần/phút, tìm kiếm 30 lần/phút |
| NFR-08 | Bảo mật | HTTPS bắt buộc; khóa Service Account đặt ngoài mã nguồn, chỉ đọc qua biến môi trường/secret |
| NFR-09 | Pháp lý | Tuân thủ NĐ 13/2023/NĐ-CP: thông báo mục đích thu thập SĐT PH; SV chủ động bật chia sẻ với DN |
| NFR-10 | Khả dụng | Giao diện tiếng Việt, responsive (desktop, tablet, mobile); Chrome, Edge, Firefox, Safari bản mới |
| NFR-11 | Khả dụng | Thông báo lỗi tiếng Việt, nói rõ cách khắc phục |
| NFR-12 | Tin cậy | Sao lưu CSDL hằng ngày, giữ 30 ngày; uptime ≥ 99% trong học kỳ |
| NFR-13 | Tin cậy | Lỗi Drive không làm mất bài: tệp giữ tạm trên server đến khi đồng bộ xong |
| NFR-14 | Tin cậy | Tuân thủ quota Google Drive API: hàng đợi giới hạn đồng thời, exponential backoff |
| NFR-15 | Bảo trì | Mã nguồn theo module; tài liệu API OpenAPI tự sinh; test tự động cho nghiệp vụ lõi (≥ 70% coverage ở service lõi) |
| NFR-16 | Lưu trữ | Metadata bài nộp lưu ít nhất đến khi SV tốt nghiệp + 1 năm |

## 8. Giả định & quyết định thiết kế

Các điểm sơ đồ use case và SRS chưa nói rõ được chốt như sau. Muốn đổi thì cập nhật cả [Specification](Specification.md).

| # | Vấn đề | Quyết định |
|---|---|---|
| D1 | Mật khẩu PH | Mật khẩu tạm = SĐT, **bắt buộc đổi** ở lần đầu (UC01.4); khóa 15 phút sau 5 lần sai |
| D2 | Mật khẩu SV/GV ban đầu | Ngày sinh `ddmmyyyy` (SV) / mã GV (GV), bắt buộc đổi lần đầu |
| D3 | Cách ghi vào Drive | **Service Account** (đúng sơ đồ UC04). Thư mục gốc của GV phải nằm trong **Shared Drive** và thêm email SA quyền *Content manager*, vì SA không có dung lượng riêng nên không ghi được tệp vào My Drive cá nhân |
| D4 | Bài cá nhân trong bài tập nhóm | Giữ hai khu vực như SRS; bài cá nhân dùng để nộp phần việc riêng; GV chấm điểm chung trên bài chung và ghi đè điểm riêng khi cần (UC07.3) |
| D5 | Xóa bản nộp cũ | Xóa tệp (chuyển vào thùng rác Drive, Drive tự xóa sau 30 ngày); giữ lịch sử thao tác |
| D6 | DN xem bài nhóm | Có quyền xem SV A thì xem được bài chung của các nhóm có A |
| D7 | SV đồng ý trước khi DN xem | Không có trong use case → không làm; SV kiểm soát bằng công tắc UC03.4 và xem được ai đã xem (UC09.11) |
| D8 | GV tìm bài LHP khác | Cấu hình `lecturer_search_scope` = `OWN_SECTIONS` (mặc định) hoặc `FACULTY` |
| D9 | DN "Tìm kiếm bài nộp" | Chỉ tìm trong bài của SV mà DN đang có quyền xem |
| D10 | Điểm & GPA | Nhập tay trong hệ thống; không đồng bộ phần mềm đào tạo |
| D11 | Lịch học LHP | Theo tiết (1–15), thứ 2–CN, phòng; trùng lịch khi cùng GV/phòng/SV, cùng thứ, giao tiết, cùng học kỳ |
| D12 | Duyệt đề tài | Không duyệt; chỉ cảnh báo trùng |

## 9. Hướng mở rộng

| Tính năng | Ghi chú |
|---|---|
| OAuth Google của GV | Thay Service Account khi trường không có Google Workspace |
| SV đồng ý trước khi DN xem | Thêm trạng thái `WAITING_STUDENT` cho yêu cầu |
| Duyệt đề tài | Thêm `topics.status` |
| Rubric, phúc khảo | Bảng `rubric_criteria`, `appeals` |
| Portfolio công khai | Link chia sẻ có thời hạn |
| SMS/Zalo OA cho PH | Thêm kênh vào bộ gửi thông báo |
| Xem cây mã nguồn ZIP | Giải nén vào cache, highlight cú pháp |
