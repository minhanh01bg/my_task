"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CustomerOption } from "@/types/catalog";

interface DebtPanelProps {
  selected: CustomerOption | null;
  onSelect: (customer: CustomerOption | null) => void;
}

/** Khach quen mua chiu — go ten la goi y khach cu, khong co thi tao ngay. */
export function DebtPanel({ selected, onSelect }: DebtPanelProps) {
  const [query, setQuery] = useState("");
  const [fetchedOptions, setFetchedOptions] = useState<CustomerOption[]>([]);
  const [creating, setCreating] = useState(false);

  const options = query.trim().length === 0 ? [] : fetchedOptions;

  useEffect(() => {
    if (query.trim().length === 0) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const response = await fetch(
        `/api/customers?q=${encodeURIComponent(query.trim())}`,
      ).catch(() => null);
      if (!response?.ok || cancelled) return;

      const body = (await response.json()) as { customers: CustomerOption[] };
      setFetchedOptions(body.customers);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function createCustomer() {
    setCreating(true);
    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: query.trim() }),
    }).catch(() => null);
    setCreating(false);

    if (!response?.ok) return;

    const body = (await response.json()) as { customer: CustomerOption };
    onSelect(body.customer);
    setQuery("");
    setFetchedOptions([]);
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border p-4">
        <span className="text-lg font-medium">{selected.name}</span>
        <Button variant="outline" onClick={() => onSelect(null)}>
          Đổi khách
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        aria-label="Tên khách nợ"
        value={query}
        autoFocus
        placeholder="Tên khách nợ"
        onChange={(event) => setQuery(event.target.value)}
        className="w-full rounded border px-4 py-3 text-lg"
      />

      <ul className="flex flex-col gap-1">
        {options.map((customer) => (
          <li key={customer.id}>
            <button
              type="button"
              onClick={() => onSelect(customer)}
              className="hover:bg-accent w-full rounded px-4 py-3 text-left"
            >
              {customer.name}
              {customer.phone ? (
                <span className="text-muted-foreground ml-2 text-sm">
                  {customer.phone}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {query.trim().length > 0 && options.length === 0 ? (
        <Button variant="outline" disabled={creating} onClick={createCustomer}>
          {creating ? "Đang tạo..." : `Tạo khách mới "${query.trim()}"`}
        </Button>
      ) : null}
    </div>
  );
}
