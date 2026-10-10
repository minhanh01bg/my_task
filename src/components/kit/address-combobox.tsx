"use client";

import { Combobox } from "@base-ui/react/combobox";
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";

export interface AddressOption {
  value: string;
  label: string;
}

function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi-VN")
    .trim()
    .replace(/\s+/g, " ");
}

/** Tìm trực tiếp trong danh mục; chỉ lựa chọn đã xác nhận được lưu làm địa chỉ. */
export function AddressCombobox({
  id,
  label,
  placeholder,
  options,
  value,
  onValueChange,
  disabled = false,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: AddressOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const selected = options.find((option) => option.value === value) ?? null;
  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={(option) => onValueChange(option?.value ?? "")}
      isItemEqualToValue={(a, b) => a.value === b.value}
      filter={(option, query) =>
        normalizeSearch(option.label).includes(normalizeSearch(query))
      }
      disabled={disabled}
      openOnInputClick
    >
      <Combobox.InputGroup className="border-input bg-background focus-within:ring-ring/50 mt-2 flex min-w-0 items-center rounded-xl border focus-within:ring-3 data-disabled:opacity-50">
        <IconSearch
          aria-hidden="true"
          className="text-muted-foreground ml-3 size-5 shrink-0"
        />
        <Combobox.Input
          id={id}
          aria-label={label}
          aria-required="true"
          placeholder={placeholder}
          className="h-12 min-w-0 flex-1 bg-transparent px-2 text-base outline-none disabled:cursor-not-allowed"
        />
        <Combobox.Trigger
          aria-label={`Mở danh sách ${label.toLocaleLowerCase("vi-VN")}`}
          className="text-muted-foreground hover:text-foreground flex size-12 shrink-0 items-center justify-center rounded-xl outline-none focus-visible:ring-3 disabled:cursor-not-allowed"
        >
          <IconChevronDown aria-hidden="true" className="size-5" />
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner
          sideOffset={6}
          align="start"
          className="z-50 max-w-(--available-width)"
        >
          <Combobox.Popup
            data-slot="address-options"
            className="bg-popover text-popover-foreground ring-border w-(--anchor-width) max-w-(--available-width) overflow-hidden rounded-xl shadow-xl ring-1"
          >
            <Combobox.Empty className="text-muted-foreground p-4 text-sm empty:hidden">
              Không tìm thấy địa chỉ phù hợp.
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto overscroll-contain p-1 empty:p-0">
              {(option: AddressOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {option.label}
                  </span>
                  <Combobox.ItemIndicator>
                    <IconCheck aria-hidden="true" className="size-4 shrink-0" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
