"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { LayoutDashboard, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomerNotificationButton } from "@/features/customer-notifications/notification-button";
import type { StorefrontSession } from "@/types/storefront";

import {
  GUEST_STOREFRONT_SESSION,
  getStorefrontSessionSnapshot,
  loadStorefrontSession,
  subscribeStorefrontSession,
} from "./storefront-session";

function getServerSnapshot(): StorefrontSession {
  return GUEST_STOREFRONT_SESSION;
}

/**
 * HTML server luôn là trạng thái khách (trang cache được); sau hydrate mới hỏi
 * `/api/storefront/session` rồi đổi nút.
 */
export function useStorefrontSession(): StorefrontSession {
  const session = useSyncExternalStore(
    subscribeStorefrontSession,
    getStorefrontSessionSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    void loadStorefrontSession();
  }, []);

  return session;
}

/** Giữ đúng khung của `CustomerNotificationButton` để không layout shift. */
function NotificationSlotPlaceholder() {
  return (
    <div
      aria-hidden="true"
      data-testid="customer-notification-placeholder"
      className="relative inline-block"
    >
      <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-transparent px-3 font-bold">
        <span className="size-5" />
      </span>
    </div>
  );
}

export function SessionAwareActions() {
  const { isAdmin, isCustomer } = useStorefrontSession();

  if (isAdmin) {
    return (
      <Button
        variant="outline"
        className="min-h-11 font-bold"
        nativeButton={false}
        aria-label="Quay lại trang quản trị"
        render={<Link href="/admin/orders" />}
      >
        <LayoutDashboard aria-hidden="true" className="size-5" />
        <span className="ml-1.5 hidden sm:inline">Quản trị</span>
      </Button>
    );
  }

  return (
    <>
      {isCustomer ? (
        <CustomerNotificationButton enabled />
      ) : (
        <NotificationSlotPlaceholder />
      )}
      <Button
        variant="outline"
        className="min-h-11 font-bold"
        nativeButton={false}
        aria-label="Tài khoản khách hàng"
        render={<Link href="/account/orders" />}
      >
        <UserRound aria-hidden="true" className="size-5" />
        <span className="ml-1.5 hidden sm:inline">Tài khoản</span>
      </Button>
    </>
  );
}
