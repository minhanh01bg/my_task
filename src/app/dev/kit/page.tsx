"use client";

import { notFound } from "next/navigation";
import { Check, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";

import {
  ChipToggle,
  CollapsibleFormCard,
  DataTableShell,
  DateField,
  DropdownField,
  EmptyState,
  ImagePicker,
  Money,
  PageHeader,
  ProductImage,
  ProductTile,
  ResultList,
  ResultRow,
  SearchField,
  StatTile,
  StockBadge,
  TouchButton,
} from "@/components/kit";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ToastProvider, useToast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function isGalleryEnabled(nodeEnv: string): boolean {
  return nodeEnv !== "production";
}

const SAMPLE = [
  { name: "Bugi Wave", price: 15000, unit: "cái", stock: 50, imageUrl: null },
  {
    name: "Nhớt Castrol 4T",
    price: 95000,
    unit: "chai",
    stock: 3,
    imageUrl: null,
  },
  { name: "Dây điện", price: 12000, unit: "mét", stock: 0, imageUrl: null },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="border-border border-b pb-1 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ToastDemo() {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() =>
          toast.add({
            title: "Đã lưu sản phẩm",
            description: "Bugi Wave",
            type: "success",
          })
        }
      >
        Toast thành công
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.add({
            title: "Không lưu được",
            description: "Mất kết nối, thử lại sau.",
            type: "error",
          })
        }
      >
        Toast lỗi
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.add({ title: "Đang đồng bộ đơn…", type: "info" })}
      >
        Toast thông tin
      </Button>
    </div>
  );
}

/**
 * Trang xem toan bo kit. Khong phai giao dien nguoi dung — day la cho de
 * kiem mat moi component o ca hai theme truoc khi tin vao chung.
 *
 * La Client Component vi gallery phai truyen callback gia (onToggle, onSelect)
 * xuong tung component; Server Component khong serialize duoc ham.
 */
export default function KitGalleryPage() {
  if (!isGalleryEnabled(process.env.NODE_ENV)) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-8">
      <PageHeader
        title="UI Kit"
        description="Đổi theme của trình duyệt để xem cả light lẫn dark."
        action={<TouchButton>Hành động chính</TouchButton>}
      />

      <Section title="Money">
        <div className="flex items-baseline gap-6">
          <Money amount={15000} size="sm" />
          <Money amount={150000} />
          <Money amount={1500000} size="display" />
        </div>
      </Section>

      <Section title="StockBadge">
        <div className="flex flex-wrap gap-2">
          <StockBadge stock={50} unit="cái" />
          <StockBadge stock={2.5} unit="mét" />
          <StockBadge stock={0} unit="cái" />
          <StockBadge stock={-3} unit="cái" />
        </div>
      </Section>

      <Section title="ChipToggle">
        <div className="flex flex-wrap gap-2">
          <ChipToggle label="Tạp hoá" selected onToggle={() => {}} />
          <ChipToggle label="Phụ tùng" selected={false} onToggle={() => {}} />
          <ChipToggle label="Nước ngọt" selected={false} onToggle={() => {}} />
        </div>
      </Section>

      <Section title="ProductImage">
        <div className="flex items-end gap-3">
          <ProductImage src={null} name="Bugi Wave" size={40} />
          <ProductImage src={null} name="Nhớt Castrol" size={64} />
          <ProductImage src={null} name="Dây điện" size={96} />
        </div>
      </Section>

      <Section title="ProductTile">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SAMPLE.map((product) => (
            <ProductTile key={product.name} {...product} onSelect={() => {}} />
          ))}
        </div>
      </Section>

      <Section title="SearchField">
        <div className="space-y-3">
          <SearchField
            value=""
            readOnly
            placeholder="Tìm sản phẩm... (F2)"
            onChange={() => {}}
          />
          <SearchField
            value="bugi"
            readOnly
            onChange={() => {}}
            onClear={() => {}}
          />
        </div>
      </Section>

      <Section title="DropdownField">
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <DropdownField
            aria-label="Trạng thái mẫu"
            defaultValue="paid"
            options={[
              { value: "all", label: "Tất cả trạng thái" },
              {
                value: "paid",
                label: "Đã thanh toán",
                description: "Đơn đã thu đủ tiền",
              },
              {
                value: "debt",
                label: "Ghi nợ",
                description: "Khách sẽ thanh toán sau",
              },
            ]}
          />
          <DropdownField
            aria-label="Dropdown bị vô hiệu hóa"
            placeholder="Không thể chọn"
            options={[]}
            disabled
          />
        </div>
      </Section>

      <Section title="DateField">
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <DateField aria-label="Ngày bắt đầu mẫu" defaultValue="2026-09-06" />
          <DateField aria-label="Ngày kết thúc mẫu" placeholder="Chọn ngày" />
        </div>
      </Section>

      <Section title="ResultList">
        <ResultList>
          {SAMPLE.map((product, index) => (
            <ResultRow
              key={product.name}
              {...product}
              active={index === 0}
              onSelect={() => {}}
            />
          ))}
        </ResultList>
      </Section>

      <Section title="ImagePicker">
        <ImagePicker name="demo-image" productName="Bugi Wave" />
      </Section>

      <Section title="StatTile">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Doanh thu" value={4250000} format="money" />
          <StatTile label="Số đơn" value={37} hint="Hôm nay" />
        </div>
      </Section>

      <Section title="EmptyState">
        <EmptyState
          title="Chưa có sản phẩm nào"
          description="Thêm sản phẩm đầu tiên để bắt đầu bán hàng."
          action={<TouchButton>Thêm sản phẩm</TouchButton>}
        />
      </Section>

      <Section title="DataTableShell">
        <DataTableShell
          title="Danh sách"
          count={0}
          isEmpty
          empty={<EmptyState title="Chưa có sản phẩm nào" />}
        >
          <table />
        </DataTableShell>
      </Section>

      <Section title="Sheet">
        <div className="flex flex-wrap gap-2">
          {(["right", "bottom"] as const).map((side) => (
            <Sheet key={side}>
              <SheetTrigger render={<Button variant="outline" />}>
                Mở sheet ({side})
              </SheetTrigger>
              <SheetContent side={side}>
                <SheetHeader>
                  <SheetTitle>Giỏ hàng</SheetTitle>
                  <SheetDescription>
                    Sheet {side === "right" ? "trượt từ phải" : "trượt từ dưới"}
                    ; Escape hoặc bấm nền để đóng.
                  </SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          ))}
        </div>
      </Section>

      <Section title="Tooltip">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>
              Giữ đơn
            </TooltipTrigger>
            <TooltipContent>Giữ đơn hiện tại (F8)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Section>

      <Section title="Popover">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>
            Bộ lọc
          </PopoverTrigger>
          <PopoverContent align="start">
            <PopoverHeader>
              <PopoverTitle>Lọc đơn hàng</PopoverTitle>
              <PopoverDescription>Chọn trạng thái cần xem.</PopoverDescription>
            </PopoverHeader>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox defaultChecked /> Đã thanh toán
            </label>
          </PopoverContent>
        </Popover>
      </Section>

      <Section title="DropdownMenu">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon-lg" />}
            aria-label="Thao tác sản phẩm"
          >
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Sản phẩm</DropdownMenuLabel>
              <DropdownMenuItem>
                <Pencil aria-hidden="true" /> Sửa
                <DropdownMenuShortcut>E</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <Trash2 aria-hidden="true" /> Xoá
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      <Section title="Switch">
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch defaultChecked /> Bán online
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch size="sm" /> Nhỏ
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch disabled /> Vô hiệu hoá
          </label>
        </div>
      </Section>

      <Section title="Checkbox">
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox defaultChecked /> Đã chọn
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox indeterminate /> Chọn một phần
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox disabled /> Vô hiệu hoá
          </label>
        </div>
      </Section>

      <Section title="Alert">
        <div className="grid gap-3">
          <Alert variant="success" role="status">
            <Check aria-hidden="true" />
            <AlertTitle>Đã lưu cài đặt</AlertTitle>
            <AlertDescription>
              Thông tin cửa hàng đã được cập nhật.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <X aria-hidden="true" />
            <AlertTitle>Lưu thất bại</AlertTitle>
            <AlertDescription>
              Vui lòng kiểm tra lại số tài khoản.
            </AlertDescription>
          </Alert>
          <Alert variant="warning">
            <AlertTitle>Danh mục đã cũ</AlertTitle>
            <AlertDescription>
              Tải lại để cập nhật giá mới nhất.
            </AlertDescription>
          </Alert>
          <Alert variant="info">
            <AlertDescription>Đơn sẽ đồng bộ khi có mạng.</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title="Toast">
        <ToastProvider>
          <ToastDemo />
        </ToastProvider>
      </Section>

      <Section title="CollapsibleFormCard">
        <CollapsibleFormCard title="Thêm sản phẩm" triggerLabel="Thêm sản phẩm">
          <p className="text-muted-foreground text-sm">Nội dung form ở đây.</p>
        </CollapsibleFormCard>
      </Section>
    </div>
  );
}
