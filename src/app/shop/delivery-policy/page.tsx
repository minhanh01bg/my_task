import { PolicyLayout } from "@/features/online-store/policy-layout";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getOptionalCustomerSession } from "@/server/customer-auth/session";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chính sách giao hàng",
  description:
    "Thông tin về phương thức, thời gian và quy trình giao nhận hàng",
};

export default async function DeliveryPolicyPage() {
  const [storeProfile, isAdmin, customerSession] = await Promise.all([
    getPublicStoreProfile(),
    hasAdminSession(),
    getOptionalCustomerSession(),
  ]);

  return (
    <PolicyLayout
      storeProfile={storeProfile}
      isAdmin={isAdmin}
      isCustomer={Boolean(customerSession)}
      title="Chính sách giao hàng"
      description="Quy định và hướng dẫn chi tiết về phương thức, thời gian giao hàng và đồng kiểm khi nhận hàng."
    >
      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          1. Phương thức giao hàng
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Chúng tôi hỗ trợ 2 hình thức nhận hàng thuận tiện cho quý khách:
        </p>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
          <li>
            <strong className="text-foreground">Giao hàng tận nơi: </strong>
            Đơn hàng được vận chuyển trực tiếp đến địa chỉ giao nhận mà quý
            khách đã cung cấp qua các đơn vị bưu tá đối tác uy tín.
          </li>
          <li>
            <strong className="text-foreground">
              Nhận tại cửa hàng (Store Pickup):{" "}
            </strong>
            Quý khách có thể lựa chọn nhận hàng trực tiếp tại địa chỉ cửa hàng
            trong khung giờ mở cửa để tiết kiệm chi phí và chủ động thời gian.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          2. Thời gian giao hàng dự kiến
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Thời gian xử lý và giao hàng tiêu chuẩn được tính từ khi đơn hàng được
          xác nhận thành công:
        </p>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
          <li>
            <strong className="text-foreground">Khu vực nội thành: </strong>
            Giao trong vòng 1-2 ngày làm việc (hoặc thỏa thuận giờ giao linh
            hoạt).
          </li>
          <li>
            <strong className="text-foreground">
              Khu vực ngoại thành & liên tỉnh:{" "}
            </strong>
            Giao trong vòng 2-4 ngày làm việc tùy thuộc vào đơn vị bưu tá.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          3. Cước phí vận chuyển
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Cước phí giao hàng được hiển thị minh bạch tại màn hình thanh toán
          hoặc được nhân viên xác nhận trước khi gửi hàng. Cửa hàng cam kết
          không phát sinh phụ phí ngoài bảng giá được thông báo.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          4. Quy trình đồng kiểm khi nhận hàng
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Để đảm bảo quyền lợi tối đa, quý khách được quyền{" "}
          <strong className="text-foreground">
            đồng kiểm ngoại quan kiện hàng
          </strong>{" "}
          cùng nhân viên bưu tá trước khi thanh toán hoặc ký nhận:
        </p>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
          <li>
            Kiểm tra bao bì bên ngoài còn nguyên vẹn, không bị rách, ướt hay móp
            méo nặng.
          </li>
          <li>
            Kiểm tra số lượng và quy cách phân loại sản phẩm đúng với thông tin
            đơn hàng.
          </li>
          <li>
            Nếu phát hiện dấu hiệu bất thường, quý khách có quyền từ chối nhận
            hàng và liên hệ ngay hotline cửa hàng để được hỗ trợ gửi lại kiện
            mới.
          </li>
        </ul>
      </section>
    </PolicyLayout>
  );
}
