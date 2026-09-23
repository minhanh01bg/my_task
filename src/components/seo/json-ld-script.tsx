import { serializeJsonLd, type JsonLd } from "@/lib/seo/json-ld";

/** `<script type="application/ld+json">` đã escape `<` (xem `serializeJsonLd`). */
export function JsonLdScript({ data }: { data: JsonLd | JsonLd[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
