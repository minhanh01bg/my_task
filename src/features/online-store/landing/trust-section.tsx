import { CheckCircle2, DollarSign, Headphones, Store } from "lucide-react";

export interface TrustSectionProps {
  storeName?: string;
  hotline?: string;
}

export function TrustSection({
  storeName = "Cửa hàng",
  hotline,
}: TrustSectionProps) {
  const features = [
    {
      icon: CheckCircle2,
      title: "Cam kết chất lượng",
      description:
        "Hàng hóa thiết yếu, nguồn gốc rõ ràng, kiểm duyệt kỹ lưỡng.",
    },
    {
      icon: DollarSign,
      title: "Giá niêm yết rõ ràng",
      description: "Đúng giá từ quầy POS, không phụ phí ẩn hay nâng giá ảo.",
    },
    {
      icon: Store,
      title: "Nhận hàng linh hoạt",
      description:
        "Tùy chọn giao hàng tận nơi hoặc đến nhận trực tiếp tại cửa hàng.",
    },
    {
      icon: Headphones,
      title: "Hỗ trợ trực tiếp",
      description: hotline
        ? `Đội ngũ ${storeName} luôn sẵn sàng hỗ trợ qua hotline ${hotline}.`
        : `Đội ngũ ${storeName} luôn sẵn sàng hỗ trợ quý khách chu đáo.`,
    },
  ];

  return (
    <section className="bg-muted/30 border-border border-y py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Mua sắm an tâm cùng {storeName}
          </h2>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Mang đến trải nghiệm đặt hàng thuận tiện, chính xác và đáng tin cậy.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="border-border bg-card rounded-2xl border p-6 text-center transition-all hover:shadow-xs"
              >
                <div className="bg-primary/10 text-primary mx-auto flex h-12 w-12 items-center justify-center rounded-xl">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-foreground mt-4 text-base font-bold">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
