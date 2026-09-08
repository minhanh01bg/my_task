import Link from "next/link";

import type { PublicStoreProfile } from "@/types/storefront";

export interface StoreFooterProps {
  profile: PublicStoreProfile;
}

export function StoreFooter({ profile }: StoreFooterProps) {
  const isMapUrlValid = profile.mapUrl && profile.mapUrl.startsWith("https://");

  return (
    <footer className="border-border bg-card/60 text-card-foreground mt-16 border-t py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Cột 1: Thông tin cửa hàng */}
          <div className="space-y-3">
            <h2 className="font-heading text-lg font-bold">{profile.name}</h2>
            {profile.address ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                <strong className="text-foreground">Địa chỉ: </strong>
                {profile.address}
              </p>
            ) : null}
            {profile.openingHours ? (
              <p className="text-muted-foreground text-sm">
                <strong className="text-foreground">Giờ mở cửa: </strong>
                {profile.openingHours}
              </p>
            ) : null}
          </div>

          {/* Cột 2: Liên hệ & Hỗ trợ */}
          <div className="space-y-3">
            <h3 className="font-heading text-base font-bold">
              Liên hệ & Hỗ trợ
            </h3>
            <div className="space-y-2 text-sm">
              {profile.hotline ? (
                <p>
                  <span className="text-muted-foreground">Hotline: </span>
                  <a
                    href={`tel:${profile.hotline.replace(/\s+/g, "")}`}
                    className="text-primary font-semibold hover:underline"
                  >
                    {profile.hotline}
                  </a>
                </p>
              ) : null}

              {isMapUrlValid ? (
                <p>
                  <a
                    href={profile.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    <span>Xem bản đồ & chỉ đường</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </p>
              ) : null}
            </div>
          </div>

          {/* Cột 3: Chính sách */}
          <div className="space-y-3">
            <h3 className="font-heading text-base font-bold">
              Chính sách cửa hàng
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/shop/delivery-policy"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Chính sách giao hàng
                </Link>
              </li>
              <li>
                <Link
                  href="/shop/payment-policy"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Chính sách thanh toán
                </Link>
              </li>
              <li>
                <Link
                  href="/shop/return-policy"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Chính sách đổi trả
                </Link>
              </li>
              <li>
                <Link
                  href="/shop/privacy"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Chính sách bảo mật
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-border text-muted-foreground mt-10 border-t pt-6 text-center text-xs">
          © {new Date().getFullYear()} {profile.name}. Tất cả các quyền được bảo
          lưu.
        </div>
      </div>
    </footer>
  );
}
