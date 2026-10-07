"use client";

import { useId, useRef, useState, useTransition } from "react";
import { IconCheck, IconLoader2, IconPlus } from "@tabler/icons-react";

import { InputField } from "@/components/shared/input-field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { categoryNameSchema } from "@/lib/categories/category-form";

import { saveCategoryAction } from "./actions";

export function CategoryForm({
  category,
  sortOrder,
}: {
  category?: { id: string; name: string };
  sortOrder: number;
}) {
  const inputId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(category?.name ?? "");
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const focusInput = () => formRef.current?.querySelector("input")?.focus();

  return (
    <form
      ref={formRef}
      noValidate
      aria-busy={pending}
      aria-label={category ? `Sửa danh mục ${category.name}` : "Thêm danh mục"}
      className="min-w-0 flex-1 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const parsed = categoryNameSchema.safeParse(name);
        setFormError(undefined);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message);
          focusInput();
          return;
        }
        setError(undefined);
        const data = new FormData();
        data.set("name", name);
        data.set("sortOrder", String(sortOrder));
        if (category) data.set("id", category.id);
        startTransition(async () => {
          try {
            const result = await saveCategoryAction(data);
            if (!result.ok) {
              setError(result.fieldErrors?.name);
              setFormError(result.fieldErrors?.name ? undefined : result.error);
              focusInput();
              return;
            }
            setName(category ? parsed.data : "");
            toast.add({ title: result.message, type: "success" });
          } catch {
            setFormError("Không thể lưu danh mục. Vui lòng thử lại.");
          }
        });
      }}
    >
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
        <InputField
          id={inputId}
          name="name"
          label={category ? "Tên danh mục" : "Tên danh mục mới"}
          aria-label={
            category ? `Tên danh mục ${category.name}` : "Tên danh mục mới"
          }
          placeholder="Ví dụ: Đồ uống, Bánh kẹo…"
          value={name}
          required
          readOnly={pending}
          hint={
            category
              ? undefined
              : "Dùng tên ngắn, dễ nhận biết để nhóm sản phẩm."
          }
          error={error}
          className="h-11"
          onBlur={() => {
            if (!name && !error) return;
            const parsed = categoryNameSchema.safeParse(name);
            setError(
              parsed.success ? undefined : parsed.error.issues[0]?.message,
            );
          }}
          onChange={(event) => {
            const value = event.target.value;
            setName(value);
            if (error) {
              const parsed = categoryNameSchema.safeParse(value);
              setError(
                parsed.success ? undefined : parsed.error.issues[0]?.message,
              );
            }
            setFormError(undefined);
          }}
        />
        <Button
          type="submit"
          variant={category ? "outline" : "default"}
          disabled={pending}
          className="h-11 w-full shrink-0 sm:mt-6 sm:w-auto"
        >
          {pending ? (
            <IconLoader2
              className="motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : category ? (
            <IconCheck aria-hidden="true" />
          ) : (
            <IconPlus aria-hidden="true" />
          )}
          {pending ? "Đang lưu…" : category ? "Lưu" : "Thêm danh mục"}
        </Button>
      </div>
      {formError ? (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      ) : null}
    </form>
  );
}
