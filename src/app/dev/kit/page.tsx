import { notFound } from "next/navigation";

import {
  ChipToggle,
  CollapsibleFormCard,
  DataTableShell,
  EmptyState,
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

/**
 * Trang xem toan bo kit. Khong phai giao dien nguoi dung — day la cho de
 * kiem mat moi component o ca hai theme truoc khi tin vao chung.
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

      <Section title="CollapsibleFormCard">
        <CollapsibleFormCard title="Thêm sản phẩm" triggerLabel="Thêm sản phẩm">
          <p className="text-muted-foreground text-sm">Nội dung form ở đây.</p>
        </CollapsibleFormCard>
      </Section>
    </div>
  );
}
