import { PolicyLayout } from "@/features/online-store/policy-layout";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getOptionalCustomerSession } from "@/server/customer-auth/session";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chính sách đổi trả & hoàn tiền",
  description: "Quy định đổi trả hàng và điều kiện hoàn tiền minh bạch",
};

export default async function ReturnPolicyPage() {
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
      title="Chính sách đổi trả & hoàn tiền"
      description="Quy định rõ ràng, trung thực nhằm bảo vệ quyền lợi của quý khách khi mua sắm trực tuyến."
    >
      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          1. Thời hạn tiếp nhận yêu cầu
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Chúng tôi tiếp nhận yêu cầu đổi trả hoặc khiếu nại trong vòng{" "}
          <strong className="text-foreground">48 giờ</strong> kể từ thời điểm
          quý khách nhận hàng thành công theo biên bản bàn giao của đơn vị vận
          chuyển.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          2. Điều kiện đổi trả
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Sản phẩm được áp dụng chính sách đổi trả khi thỏa mãn một trong các
          trường hợp sau:
        </p>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
          <li>
            Sản phẩm bị lỗi kỹ thuật, hết hạn sử dụng hoặc lỗi bao bì từ nhà sản
            xuất.
          </li>
          <li>
            Sản phẩm bị bể vỡ, móp méo, hư hỏng trong quá trình vận chuyển.
          </li>
          <li>
            Sản phẩm được giao không đúng chủng loại, quy cách hoặc số lượng so
            với đơn đặt hàng.
          </li>
          <li>
            Sản phẩm còn nguyên tem mác, nhãn niêm phong và chưa qua sử dụng
            (trừ trường hợp phát hiện lỗi chất lượng bên trong).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          3. Quy trình xử lý đổi trả
        </h2>
        <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            <strong className="text-foreground">Bước 1: </strong>
            Liên hệ ngay với hotline cửa hàng hoặc gửi yêu cầu hỗ trợ kèm theo
            mã đơn hàng và hình ảnh/video mở gói hàng chứng minh tình trạng sản
            phẩm.
          </li>
          <li>
            <strong className="text-foreground">Bước 2: </strong>
            Đội ngũ chăm sóc khách hàng sẽ tiếp nhận, đối soát thông tin đơn
            hàng và phản hồi giải pháp xử lý trong vòng 24 giờ làm việc.
          </li>
          <li>
            <strong className="text-foreground">Bước 3: </strong>
            Nếu yêu cầu hợp lệ, cửa hàng sẽ tiến hành gửi đổi sản phẩm mới miễn
            phí vận chuyển, hoặc thực hiện hoàn tiền theo thỏa thuận trực tiếp
            với khách hàng qua tài khoản ngân hàng (không cam kết tự động hoàn
            tiền ngay lập tức).
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          4. Các trường hợp không hỗ trợ đổi trả
        </h2>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>
            Quá thời hạn 48 giờ kể từ khi nhận hàng mà không có thông báo trước.
          </li>
          <li>
            Sản phẩm bị hư hại hoặc biến dạng do lỗi bảo quản hoặc sử dụng sai
            hướng dẫn từ phía người nhận.
          </li>
          <li>
            Sản phẩm quà tặng kèm, hàng xả kho giảm giá thanh lý đặc biệt có ghi
            chú không đổi trả.
          </li>
        </ul>
      </section>
    </PolicyLayout>
  );
}
