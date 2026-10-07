# Sơ đồ use case – EduPortfolio

- `src/*.puml` – mã nguồn PlantUML (sửa ở đây), `src/style.iuml` – style dùng chung.
- `out/*.png` – ảnh đã xuất.
- Use case viền **nét đứt** = chức năng mức P2 (nên có); viền liền = P1 (MVP).

| Tệp | Use case tổng quát | Tác nhân |
|---|---|---|
| 00_tong_quat | Toàn hệ thống (UC01–UC12) | tất cả |
| 01_xac_thuc | UC01 Xác thực & quản lý tài khoản | Khách, Người dùng, Phụ huynh, Dịch vụ Email/SMS |
| 02_quan_tri | UC02 Quản trị hệ thống | Admin |
| 03_ho_so | UC03 Quản lý hồ sơ sinh viên | Sinh viên |
| 04_bai_tap | UC04 Quản lý bài tập | Giảng viên, Sinh viên, Google Drive |
| 05_nhom_de_tai | UC05 Quản lý nhóm & đề tài | Sinh viên, Trưởng nhóm, Giảng viên, Bộ hẹn giờ |
| 06_07_nop_xem_tim_bai | UC06 Nộp & xem bài nộp, UC07 Tìm kiếm bài nộp | SV, GV, Admin, DN, Google Drive, Bộ hẹn giờ |
| 08_diem | UC08 Quản lý & xem điểm | Giảng viên, Sinh viên, Admin |
| 09_phu_huynh | UC09 Xem kết quả học tập của con | Phụ huynh |
| 10_quyen_xem_bai | UC10 Tìm kiếm SV & quản lý quyền xem bài | DN, SV, Admin, Bộ hẹn giờ |
| 11_thong_ke | UC11 Thống kê – báo cáo | Admin, GV, SV, DN |
| 12_thong_bao | UC12 Thông báo | Người dùng, Bộ hẹn giờ, Dịch vụ Email/SMS |

## Xuất lại ảnh

```bash
export GRAPHVIZ_DOT="D:/DATN/usecase/tools/gv/Graphviz-12.2.1-win64/bin/dot.exe"
cd src && java -jar ../tools/plantuml.jar -charset UTF-8 -tpng -o ../out *.puml
```
Dùng `-tsvg` để xuất SVG (chèn vào Word/báo cáo nét hơn).
