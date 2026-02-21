"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { FolderTree } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCategoriesAction } from "@/lib/actions/page-builder";
import { useEditorContext } from "@/lib/page-builder/editor-context";
import type { ResolvedCategory } from "@/lib/page-builder/types";

interface CategoryPickerFieldProps {
  value: string[];
  onChange: (value: string[]) => void;
  readOnly?: boolean;
}

export function CategoryPickerFieldRender({
  value = [],
  onChange,
  readOnly,
}: CategoryPickerFieldProps) {
  const { tenantId } = useEditorContext();
  const [categories, setCategories] = useState<ResolvedCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCategoriesAction(tenantId).then((res) => {
      if (res.success && res.data) {
        setCategories(res.data);
      }
      setIsLoading(false);
    });
  }, [tenantId]);

  const toggleCategory = (categoryId: string) => {
    if (value.includes(categoryId)) {
      onChange(value.filter((id) => id !== categoryId));
    } else {
      onChange([...value, categoryId]);
    }
  };

  if (isLoading) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        Loading categories...
      </p>
    );
  }

  if (categories.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        No categories found. Create categories in your dashboard first.
      </p>
    );
  }

  return (
    <ScrollArea className="h-[240px] rounded-md border">
      <div className="p-1">
        {categories.map((category) => (
          <label
            key={category.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-2 hover:bg-accent"
          >
            <Checkbox
              checked={value.includes(category.id)}
              onCheckedChange={() => toggleCategory(category.id)}
              disabled={readOnly}
            />
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
              {category.imageUrl ? (
                <Image
                  src={category.imageUrl}
                  alt={category.name}
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{category.name}</p>
              <p className="text-xs text-muted-foreground">
                {category.productCount} product
                {category.productCount !== 1 ? "s" : ""}
              </p>
            </div>
          </label>
        ))}
      </div>
    </ScrollArea>
  );
}
