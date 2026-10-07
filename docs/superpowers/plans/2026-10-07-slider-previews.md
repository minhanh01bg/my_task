# Ba phương án slider để duyệt bằng preview

Người dùng yêu cầu ghi lại ba hướng và làm từng bản để xem trước khi duyệt. Các bản xuất hiện ở trang preview riêng; slider `/shop` đang dùng được giữ trong lúc duyệt. Không lưu lựa chọn hay tự kích hoạt một phương án.

## Phương án và tham khảo

1. **Spectra** — [GetLayers Slider Spectra](https://www.getlayers.ai/layer/slider-spectra). Nền xanh rừng sâu, ảnh giữa nổi lớn, ảnh hai bên xếp lớp theo phối cảnh; ánh sáng mềm đổi theo sản phẩm. Hướng ưu tiên cho điểm nhấn bán hàng.
2. **Spotlight** — [GetLayers Carousel Spotlight](https://www.getlayers.ai/layer/carousel-spotlight). Nền kem sáng, tiêu đề thanh lịch, hàng ảnh cong nhẹ có khoảng thở; thông tin sản phẩm và giá đồng bộ với ảnh giữa.
3. **Under The Radar** — [GetLayers Carousel Under The Radar](https://www.getlayers.ai/layer/carousel-under-the-radar). Chữ lớn, bố cục biên tập, ảnh xòe như quạt, màu nổi bật; hướng quảng cáo táo bạo nhất.

Tham khảo phần preview công khai và tự viết bố cục/chuyển động cho cửa hàng; không tải source/prompt Premium hay sao chép nội dung thương mại của mẫu. Dùng cùng sản phẩm, giá, ảnh và tên cửa hàng thật để so sánh. Không đưa cam kết giảm giá/giao hàng giả vào bản mẫu.

## Triển khai và kiểm chứng

1. Viết test dữ liệu: chọn sản phẩm có ảnh, đa dạng danh mục, giới hạn số ảnh, giữ URL/giá thật, danh mục rỗng xử lý được. Viết test tương tác chung: chuyển slide, bàn phím, vuốt, nút tự chạy/dừng, pause khi focus/hover, reduced motion.
2. Tạo feature `src/features/slider-preview`: dữ liệu tối thiểu, bộ điều khiển dùng chung, mỗi phương án có bố cục CSS riêng. Làm lần lượt Spectra, Spotlight rồi Under The Radar.
3. Tạo trang ISR `/shop/slider-preview/[variant]` với ba đường dẫn riêng, chuyển phương án bằng liên kết. Không đọc cookie/header; dùng catalog/profile tag-cache; metadata noindex/nofollow. Trang index chuyển tới Spectra; variant lạ trả 404.
4. Preview có tên phương án, chuyển nhanh ba bản, liên kết về cửa hàng, ảnh thật và CTA tới sản phẩm/danh mục thật. Tự chạy mặc định tắt để thuận tiện so sánh; có hỗ trợ vuốt và bàn phím.
5. Chạy test riêng, lint/typecheck và full gate. Build mới có distDir riêng; fixture production E2E dùng bản build sao chép và DB riêng. Kiểm tra cả ba phương án ở desktop và điện thoại, không tràn ngang, ảnh tải được, CTA đúng, giảm chuyển động và `/shop` giữ slider hiện tại.
6. Triển khai các trang preview để người dùng mở link và duyệt. Commit các phần được kiểm chứng riêng, push nhánh hiện tại. Chỉ thay slider cửa hàng sau khi người dùng chọn/duyệt.
