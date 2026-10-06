# Danh mục hành chính

`vietnam-administrative.json` là snapshot [Danh mục đơn vị hành chính của Cục Thống kê](https://danhmuchanhchinh.nso.gov.vn/) lấy ngày 06/10/2026, chọn cấp Xã, đến ngày hiện hành, export “Danh sách cấp xã \_\_\_06_10_2026.xls”. Đối chiếu 34 mã cấp tỉnh và 3.321 mã xã/phường/đặc khu duy nhất; mỗi xã có mã tỉnh tồn tại và tên tỉnh trùng danh mục cấp tỉnh. JSON giữ nguyên mã có số 0 đầu và tên đơn vị; không sinh phường giả hoặc suy ra mã từ tên.

SHA-256 export XLS: `d4a8ece8c02334bd428b661d835357c6736ad2646ac32f473707b0842fe6895a`.

Nền danh mục theo [Quyết định 19/2025/QĐ-TTg](https://baochinhphu.vn/bang-danh-muc-va-ma-so-cua-34-tinh-thanh-moi-3321-don-vi-hanh-chinh-cap-xa-moi-102250704153652947.htm). Snapshot Cục Thống kê gồm thay đổi sau đó, ví dụ [Nghị quyết 39/2026/QH16 về thành lập thành phố Bắc Ninh](https://vanban.chinhphu.vn/?docid=219328&pageid=27160), hiệu lực 20/09/2026, và cập nhật xã/phường năm 2026. Không dùng bản 2025 để ghi đè các tên hiện hành.

Ứng dụng đọc snapshot cục bộ để checkout không phụ thuộc dịch vụ bên ngoài. Khi cập nhật, lấy lại danh mục từ nguồn chính thức, kiểm tra mã/quan hệ/count theo thời điểm mới, chạy test hợp đồng và E2E. Địa chỉ đã lưu trong đơn hàng là lịch sử và không tự đổi theo snapshot.
