import { PolicyLayout } from "@/features/online-store/policy-layout";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getOptionalCustomerSession } from "@/server/customer-auth/session";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chính sách bảo mật thông tin",
  description:
    "Quy định bảo vệ dữ liệu cá nhân khách hàng, cam kết quyền riêng tư và thời hạn lưu trữ",
};

export default async function PrivacyPolicyPage() {
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
      title="Chính sách bảo mật thông tin"
      description="Cam kết bảo vệ dữ liệu cá nhân, quyền riêng tư và tuân thủ các quy chuẩn bảo mật kỹ thuật số."
    >
      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          1. Dữ liệu cá nhân chúng tôi thu thập
        </h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
            <h3 className="text-foreground font-semibold">
              a. Đối với khách vãng lai (Guest Checkout)
            </h3>
            <p className="text-muted-foreground mt-1">
              Chúng tôi chỉ thu thập các thông tin tối thiểu cần thiết để xử lý
              và giao hàng: Họ và tên người nhận, số điện thoại liên hệ, địa chỉ
              nhận hàng và ghi chú đơn hàng. Quý khách có thể theo dõi đơn hàng
              bằng liên kết bảo mật có token định danh (nonce) mà không cần bắt
              buộc tạo tài khoản.
            </p>
          </div>

          <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
            <h3 className="text-foreground font-semibold">
              b. Đối với khách hàng có tài khoản thành viên
            </h3>
            <p className="text-muted-foreground mt-1">
              Bao gồm số điện thoại đã được xác thực qua mã OTP một lần, tên
              hiển thị, mật khẩu đăng nhập (được băm bảo mật bằng thuật toán
              Argon2id theo tiêu chuẩn công nghiệp và tuyệt đối không lưu văn
              bản thuần), lịch sử các đơn hàng và danh sách sổ địa chỉ nhận hàng
              đã lưu.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          2. Mục đích sử dụng dữ liệu
        </h2>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>
            Xử lý, đóng gói và phối hợp cùng đơn vị bưu tá giao hàng tới quý
            khách.
          </li>
          <li>
            Gửi thông báo cập nhật tiến độ đơn hàng qua giao diện tài khoản hoặc
            SMS/Zalo thông báo trạng thái.
          </li>
          <li>
            Hỗ trợ tra cứu lịch sử mua hàng, bảo hành hoặc xử lý khiếu nại đổi
            trả.
          </li>
          <li>
            Ngăn ngừa hành vi giả mạo, gian lận thanh toán hoặc tấn công bảo mật
            vào hệ thống.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          3. Thời gian lưu trữ dữ liệu (Retention Policy)
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Dữ liệu của quý khách được lưu trữ và bảo vệ theo chính sách kiểm soát
          vòng đời dữ liệu nghiêm ngặt:
        </p>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>
            Token đăng nhập và phiên làm việc tự động hết hạn định kỳ sau 30
            ngày hoặc bị thu hồi ngay lập tức khi quý khách đăng xuất.
          </li>
          <li>
            Mã định danh liên kết đơn hàng vãng lai (receipt nonce) tự động hết
            hạn theo chính sách lưu trữ bảo mật để tránh rò rỉ thông tin tra cứu
            công khai.
          </li>
          <li>
            Thông tin kế toán và hóa đơn bán hàng được lưu trữ theo quy định của
            pháp luật kế toán và thuế Việt Nam.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          4. Cam kết không chia sẻ dữ liệu cho bên thứ ba
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Chúng tôi cam đoan tuyệt đối không bán, cho thuê hay trao đổi thông
          tin cá nhân của quý khách cho bất kỳ bên thứ ba nào vì mục đích quảng
          cáo thương mại. Thông tin chỉ được chuyển giao giới hạn cho đơn vị vận
          chuyển nhằm phục vụ duy nhất mục đích giao hàng.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          5. Quyền của khách hàng đối với dữ liệu
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Quý khách luôn có toàn quyền tra cứu, cập nhật hoặc yêu cầu xóa dữ
          liệu cá nhân bằng cách quản lý trong mục thông tin tài khoản hoặc liên
          hệ trực tiếp với chúng tôi qua hotline để được bộ phận kỹ thuật hỗ
          trợ.
        </p>
      </section>
    </PolicyLayout>
  );
}
