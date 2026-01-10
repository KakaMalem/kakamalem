"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, X, AlertCircle, Info, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type {
  InlineOption,
  InlineOptionValue,
} from "@/lib/validations/variant-form";
import {
  calculateVariantCount,
  validateVariantCount,
} from "@/lib/variants/cartesian";

// Existing global options from the tenant (for autocomplete)
export type ExistingOption = {
  id: string;
  name: string;
  values: { id: string; value: string }[];
};

interface VariantOptionsBuilderProps {
  /** Current options in the form */
  options: InlineOption[];
  /** Callback when options change */
  onChange: (options: InlineOption[]) => void;
  /** Existing global options for autocomplete suggestions */
  existingOptions?: ExistingOption[];
  /** Error message to display */
  error?: string;
  /** Whether the form is disabled */
  disabled?: boolean;
}

export function VariantOptionsBuilder({
  options,
  onChange,
  existingOptions = [],
  error,
  disabled = false,
}: VariantOptionsBuilderProps) {
  // Track which option name input is open for autocomplete
  const [openCombobox, setOpenCombobox] = useState<string | null>(null);

  // Track which value input is focused for each option
  const [activeValueInputs, setActiveValueInputs] = useState<
    Record<string, string>
  >({});

  // Track option name errors (for duplicate detection)
  const [optionNameErrors, setOptionNameErrors] = useState<
    Record<string, string>
  >({});

  // Refs for value inputs
  const valueInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Calculate variant count for preview
  const optionsForCount = options.map((opt) => ({
    values: opt.values.map((v) => ({
      valueId: v.id || v.value,
      value: v.value,
    })),
  }));
  const variantCount = calculateVariantCount(optionsForCount);
  const validation = validateVariantCount(variantCount);

  // Generate a unique temp ID
  const generateTempId = () =>
    `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Get option key for state management
  const getOptionKey = (option: InlineOption, index: number) => {
    return option.id || option.tempId || `option-${index}`;
  };

  // Add a new empty option
  const addOption = useCallback(() => {
    const newOption: InlineOption = {
      tempId: generateTempId(),
      name: "",
      values: [],
      isNew: true,
    };
    onChange([...options, newOption]);
  }, [options, onChange]);

  // Remove an option
  const removeOption = useCallback(
    (index: number) => {
      const newOptions = options.filter((_, i) => i !== index);
      onChange(newOptions);
    },
    [options, onChange]
  );

  // Update option name
  const updateOptionName = useCallback(
    (index: number, name: string) => {
      const optionKey = getOptionKey(options[index], index);
      const trimmedName = name.trim().toLowerCase();

      // Check for duplicate names (case-insensitive)
      const isDuplicate =
        trimmedName &&
        options.some(
          (opt, i) =>
            i !== index && opt.name.trim().toLowerCase() === trimmedName
        );

      if (isDuplicate) {
        setOptionNameErrors((prev) => ({
          ...prev,
          [optionKey]: "This option name is already used",
        }));
      } else {
        setOptionNameErrors((prev) => {
          const next = { ...prev };
          delete next[optionKey];
          return next;
        });
      }

      const newOptions = [...options];
      newOptions[index] = { ...newOptions[index], name };
      onChange(newOptions);
    },
    [options, onChange]
  );

  // Select an existing option (from autocomplete)
  const selectExistingOption = useCallback(
    (index: number, existing: ExistingOption) => {
      const newOptions = [...options];
      newOptions[index] = {
        id: existing.id,
        name: existing.name,
        values: existing.values.map((v) => ({
          id: v.id,
          value: v.value,
          isNew: false,
        })),
        isNew: false,
      };
      onChange(newOptions);
      setOpenCombobox(null);
    },
    [options, onChange]
  );

  // Add a value to an option
  const addValue = useCallback(
    (optionIndex: number, value: string) => {
      const trimmedValue = value.trim();
      if (!trimmedValue) return;

      const option = options[optionIndex];

      // Check for duplicate
      if (
        option.values.some(
          (v) => v.value.toLowerCase() === trimmedValue.toLowerCase()
        )
      ) {
        return;
      }

      const newValue: InlineOptionValue = {
        value: trimmedValue,
        isNew: true,
      };

      const newOptions = [...options];
      newOptions[optionIndex] = {
        ...option,
        values: [...option.values, newValue],
      };
      onChange(newOptions);
    },
    [options, onChange]
  );

  // Remove a value from an option
  const removeValue = useCallback(
    (optionIndex: number, valueIndex: number) => {
      const newOptions = [...options];
      const option = newOptions[optionIndex];
      newOptions[optionIndex] = {
        ...option,
        values: option.values.filter((_, i) => i !== valueIndex),
      };
      onChange(newOptions);
    },
    [options, onChange]
  );

  // Handle value input keydown
  const handleValueInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    optionIndex: number,
    optionKey: string
  ) => {
    const value = activeValueInputs[optionKey] || "";

    if (e.key === "Enter") {
      // Always prevent default Enter behavior to avoid mobile keyboard moving to next field
      e.preventDefault();
      e.stopPropagation();

      // If there's text in the input, add the value and stay on the same input
      if (value.trim()) {
        addValue(optionIndex, value);
        setActiveValueInputs((prev) => ({ ...prev, [optionKey]: "" }));
        // Refocus the input after a short delay to stay on the same field
        setTimeout(() => {
          valueInputRefs.current[optionKey]?.focus();
        }, 0);
      }
      return;
    }

    if (e.key === "Backspace" && !value) {
      // Remove last value if input is empty
      const option = options[optionIndex];
      if (option.values.length > 0) {
        removeValue(optionIndex, option.values.length - 1);
      }
      return;
    }

    if (e.key === ",") {
      // Add value on comma
      if (value.trim()) {
        e.preventDefault();
        e.stopPropagation();
        addValue(optionIndex, value);
        setActiveValueInputs((prev) => ({ ...prev, [optionKey]: "" }));
        // Refocus the input after a short delay to stay on the same field
        setTimeout(() => {
          valueInputRefs.current[optionKey]?.focus();
        }, 0);
      }
      return;
    }

    if (e.key === "Tab" && value.trim()) {
      // Add value on tab if there's content
      e.preventDefault();
      e.stopPropagation();
      addValue(optionIndex, value);
      setActiveValueInputs((prev) => ({ ...prev, [optionKey]: "" }));
      // Refocus the input after a short delay to stay on the same field
      setTimeout(() => {
        valueInputRefs.current[optionKey]?.focus();
      }, 0);
      return;
    }

    if (e.key === "Escape") {
      // Clear input and blur on Escape
      setActiveValueInputs((prev) => ({ ...prev, [optionKey]: "" }));
      valueInputRefs.current[optionKey]?.blur();
    }
  };

  // Filter existing options not already used
  const getAvailableOptions = (currentOptionName: string) => {
    const usedOptionIds = new Set(options.filter((o) => o.id).map((o) => o.id));
    const usedOptionNames = new Set(
      options.filter((o) => !o.id && o.name).map((o) => o.name.toLowerCase())
    );

    return existingOptions.filter((existing) => {
      // Don't suggest if already used
      if (usedOptionIds.has(existing.id)) return false;
      if (usedOptionNames.has(existing.name.toLowerCase())) return false;

      // Filter by search term
      if (currentOptionName) {
        return existing.name
          .toLowerCase()
          .includes(currentOptionName.toLowerCase());
      }
      return true;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Label className="text-base font-medium">Variant Options</Label>
          <p className="text-sm text-muted-foreground">
            Define options like Size, Color, Material
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          disabled={disabled}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 size-4" />
          Add Option
        </Button>
      </div>

      {/* Options List */}
      {options.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="mb-4 text-center text-sm text-muted-foreground">
              No variant options added. Add options like Size or Color to create
              product variants.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOption}
              disabled={disabled}
            >
              <Plus className="mr-2 size-4" />
              Add First Option
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {options.map((option, optionIndex) => {
            const optionKey = getOptionKey(option, optionIndex);
            const availableOptions = getAvailableOptions(option.name);
            const isComboboxOpen = openCombobox === optionKey;

            return (
              <Card key={optionKey} className="overflow-hidden w-full">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 sm:gap-3 w-full">
                    {/* Drag Handle (for future reordering) */}
                    <div className="mt-2 cursor-grab text-muted-foreground hidden sm:block shrink-0">
                      <GripVertical className="size-5" />
                    </div>

                    <div className="flex-1 space-y-3 min-w-0 overflow-hidden">
                      {/* Option Name with Autocomplete */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Popover
                            open={isComboboxOpen}
                            onOpenChange={(open) => {
                              // Only close if explicitly requested, don't toggle on input click
                              if (!open) {
                                setOpenCombobox(null);
                              }
                            }}
                          >
                            <PopoverAnchor asChild>
                              <div className="relative flex-1">
                                <Input
                                  value={option.name}
                                  onChange={(e) => {
                                    updateOptionName(
                                      optionIndex,
                                      e.target.value
                                    );
                                    if (
                                      !isComboboxOpen &&
                                      e.target.value &&
                                      existingOptions.length > 0
                                    ) {
                                      setOpenCombobox(optionKey);
                                    }
                                  }}
                                  onFocus={() => {
                                    if (
                                      existingOptions.length > 0 &&
                                      !option.id
                                    ) {
                                      setOpenCombobox(optionKey);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // Close popover when clicking outside
                                    // Use setTimeout to allow popover clicks to register
                                    setTimeout(() => {
                                      if (
                                        !e.relatedTarget?.closest(
                                          '[role="dialog"]'
                                        )
                                      ) {
                                        setOpenCombobox(null);
                                      }
                                    }, 200);
                                  }}
                                  placeholder="Option name (e.g., Size, Color)"
                                  disabled={disabled || !!option.id}
                                  className={cn(
                                    option.id && "bg-muted cursor-not-allowed",
                                    optionNameErrors[optionKey] &&
                                      "border-destructive"
                                  )}
                                />
                                {option.id && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                    (existing)
                                  </span>
                                )}
                              </div>
                            </PopoverAnchor>
                            {!option.id && availableOptions.length > 0 && (
                              <PopoverContent
                                className="w-75 p-0"
                                align="start"
                                side="bottom"
                                sideOffset={4}
                              >
                                <Command>
                                  <CommandInput placeholder="Search options..." />
                                  <CommandList>
                                    <CommandEmpty>
                                      <span className="text-muted-foreground">
                                        No matching options. &quot;{option.name}
                                        &quot; will be created as new.
                                      </span>
                                    </CommandEmpty>
                                    <CommandGroup heading="Existing Options">
                                      {availableOptions.map((existing) => (
                                        <CommandItem
                                          key={existing.id}
                                          value={existing.name}
                                          onSelect={() =>
                                            selectExistingOption(
                                              optionIndex,
                                              existing
                                            )
                                          }
                                        >
                                          <div className="flex flex-col">
                                            <span className="font-medium">
                                              {existing.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              {existing.values
                                                .map((v) => v.value)
                                                .join(", ")}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            )}
                          </Popover>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(optionIndex)}
                            disabled={disabled}
                            className="shrink-0"
                          >
                            <X className="size-4" />
                            <span className="sr-only">Remove option</span>
                          </Button>
                        </div>
                        {optionNameErrors[optionKey] && (
                          <p className="text-sm text-destructive">
                            {optionNameErrors[optionKey]}
                          </p>
                        )}
                      </div>

                      {/* Values Input */}
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">
                          Values
                        </Label>
                        <div
                          className={cn(
                            "flex flex-wrap items-center gap-2 rounded-md border bg-background p-2 min-h-10.5",
                            disabled && "opacity-50 cursor-not-allowed"
                          )}
                          onClick={() => {
                            const input = valueInputRefs.current[optionKey];
                            if (input) input.focus();
                          }}
                        >
                          {/* Existing Values as Badges */}
                          {option.values.map((val, valueIndex) => (
                            <Badge
                              key={val.id || `${optionKey}-value-${valueIndex}`}
                              variant="secondary"
                              className="gap-1 pr-1"
                            >
                              {val.value}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeValue(optionIndex, valueIndex);
                                }}
                                disabled={disabled}
                                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                              >
                                <X className="size-3" />
                                <span className="sr-only">
                                  Remove {val.value}
                                </span>
                              </button>
                            </Badge>
                          ))}

                          {/* Input for New Values */}
                          <input
                            ref={(el) => {
                              valueInputRefs.current[optionKey] = el;
                            }}
                            type="search"
                            inputMode="search"
                            enterKeyHint="done"
                            autoComplete="off"
                            value={activeValueInputs[optionKey] || ""}
                            onChange={(e) =>
                              setActiveValueInputs((prev) => ({
                                ...prev,
                                [optionKey]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) =>
                              handleValueInputKeyDown(e, optionIndex, optionKey)
                            }
                            onBlur={() => {
                              // Add value on blur if there's content
                              const value = activeValueInputs[optionKey];
                              if (value?.trim()) {
                                addValue(optionIndex, value);
                                setActiveValueInputs((prev) => ({
                                  ...prev,
                                  [optionKey]: "",
                                }));
                              }
                            }}
                            placeholder={
                              option.values.length === 0
                                ? "Type value and press Enter"
                                : "Add more..."
                            }
                            disabled={disabled}
                            className="flex-1 min-w-20 max-w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Press Enter, comma, or Tab to add. Backspace to
                          remove.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Variant Count Preview */}
      {options.length > 0 && options.some((o) => o.values.length > 0) && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3",
            validation.status === "error" &&
              "border-destructive bg-destructive/10",
            validation.status === "warning" &&
              "border-yellow-500 bg-yellow-500/10",
            validation.status === "ok" && "border-muted bg-muted/50"
          )}
        >
          {validation.status === "error" ? (
            <AlertCircle className="size-5 shrink-0 text-destructive" />
          ) : validation.status === "warning" ? (
            <AlertCircle className="size-5 shrink-0 text-yellow-600" />
          ) : (
            <Info className="size-5 shrink-0 text-muted-foreground" />
          )}
          <div className="flex-1">
            {validation.message ? (
              <p
                className={cn(
                  "text-sm",
                  validation.status === "error" && "text-destructive",
                  validation.status === "warning" && "text-yellow-600"
                )}
              >
                {validation.message}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                This will generate <strong>{variantCount}</strong> variant
                {variantCount !== 1 ? "s" : ""}.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="size-4" />
          {error}
        </p>
      )}
    </div>
  );
}
