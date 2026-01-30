"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  Reorder,
  useDragControls,
} from "framer-motion";
import {
  Plus,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  GripVertical,
  AlertCircle,
  Copy,
  Settings2,
  Layers,
  Palette,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SwatchEditor,
  SwatchPreview,
  type SwatchType,
  type SwatchSize,
  type SwatchShape,
} from "./swatch-editor";
import { cn } from "@/lib/utils";
import type {
  InlineOption,
  InlineOptionValue,
} from "@/lib/validations/variant-form";
import {
  calculateVariantCount,
  validateVariantCount,
} from "@/lib/variants/cartesian";

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

const slideInRight = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

// Wizard steps
const WIZARD_STEPS = [
  { id: "options", title: "Configure Options", icon: Settings2 },
  { id: "values", title: "Set Values", icon: Layers },
  { id: "swatches", title: "Style Swatches", icon: Palette },
] as const;

type WizardStep = (typeof WIZARD_STEPS)[number]["id"];

// Existing global options from the tenant (for autocomplete)
export type ExistingOption = {
  id: string;
  name: string;
  values: {
    id: string;
    value: string;
    swatchType?: SwatchType;
    swatchValue?: string;
  }[];
};

interface VariantWizardProps {
  tenantId: string;
  /** Current options in the form */
  options: InlineOption[];
  /** Callback when options change */
  onChange: (options: InlineOption[]) => void;
  /** Existing global options for autocomplete suggestions */
  existingOptions?: ExistingOption[];
  /** Whether the wizard is open */
  open: boolean;
  /** Callback when wizard should close */
  onOpenChange: (open: boolean) => void;
  /** Error message to display */
  error?: string;
}

export function VariantWizard({
  tenantId,
  options,
  onChange,
  existingOptions = [],
  open,
  onOpenChange,
  error: _error,
}: VariantWizardProps) {
  // error is available for future use
  void _error;
  // Current step in wizard
  const [currentStep, setCurrentStep] = useState<WizardStep>("options");

  // Track whether dialog was previously open to detect open transitions
  const wasOpen = useRef(open);

  // Local draft of options being edited
  const [draftOptions, setDraftOptions] = useState<InlineOption[]>(() =>
    options.length > 0 ? [...options] : []
  );

  // Sync draft with props when dialog opens (not on every render)
  // Using queueMicrotask to defer setState and avoid cascading render warnings
  useEffect(() => {
    // Only sync when transitioning from closed to open
    if (open && !wasOpen.current) {
      queueMicrotask(() => {
        setDraftOptions(options.length > 0 ? [...options] : []);
        setCurrentStep("options");
      });
    }
    wasOpen.current = open;
  }, [open, options]);

  // Calculate variant count for preview
  const variantCount = useMemo(() => {
    const optionsForCount = draftOptions.map((opt) => ({
      values: opt.values.map((v) => ({
        valueId: v.id || v.value,
        value: v.value,
      })),
    }));
    return calculateVariantCount(optionsForCount);
  }, [draftOptions]);

  const validation = validateVariantCount(variantCount);

  // Generate a unique temp ID
  const generateTempId = () =>
    `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Add new option
  const addOption = useCallback(() => {
    const newOption: InlineOption = {
      tempId: generateTempId(),
      name: "",
      values: [],
      isNew: true,
      swatchSize: "md",
      swatchShape: "square",
    };
    setDraftOptions([...draftOptions, newOption]);
  }, [draftOptions]);

  // Remove option
  const removeOption = useCallback(
    (index: number) => {
      setDraftOptions(draftOptions.filter((_, i) => i !== index));
    },
    [draftOptions]
  );

  // Update option name
  const updateOptionName = useCallback(
    (index: number, name: string) => {
      const newOptions = [...draftOptions];
      newOptions[index] = { ...newOptions[index], name };
      setDraftOptions(newOptions);
    },
    [draftOptions]
  );

  // Reorder options
  const reorderOptions = useCallback((newOrder: InlineOption[]) => {
    setDraftOptions(newOrder);
  }, []);

  // Add value to option
  const addValue = useCallback(
    (optionIndex: number, value: string) => {
      const trimmedValue = value.trim();
      if (!trimmedValue) return;

      const option = draftOptions[optionIndex];
      // Check for duplicates
      if (
        option.values.some(
          (v) => v.value.toLowerCase() === trimmedValue.toLowerCase()
        )
      ) {
        return;
      }

      const newOptions = [...draftOptions];
      newOptions[optionIndex] = {
        ...option,
        values: [
          ...option.values,
          { value: trimmedValue, swatchType: "text", isNew: true },
        ],
      };
      setDraftOptions(newOptions);
    },
    [draftOptions]
  );

  // Remove value from option
  const removeValue = useCallback(
    (optionIndex: number, valueIndex: number) => {
      const newOptions = [...draftOptions];
      newOptions[optionIndex] = {
        ...newOptions[optionIndex],
        values: newOptions[optionIndex].values.filter(
          (_, i) => i !== valueIndex
        ),
      };
      setDraftOptions(newOptions);
    },
    [draftOptions]
  );

  // Update value swatch
  const updateValueSwatch = useCallback(
    (
      optionIndex: number,
      valueIndex: number,
      swatchType: SwatchType,
      swatchValue?: string,
      swatchImageUrl?: string
    ) => {
      const newOptions = [...draftOptions];
      const newValues = [...newOptions[optionIndex].values];
      newValues[valueIndex] = {
        ...newValues[valueIndex],
        swatchType,
        swatchValue,
        swatchImageUrl,
      };
      newOptions[optionIndex] = {
        ...newOptions[optionIndex],
        values: newValues,
      };
      setDraftOptions(newOptions);
    },
    [draftOptions]
  );

  // Update option swatch display settings (size, shape)
  const updateOptionSwatchSettings = useCallback(
    (
      optionIndex: number,
      settings: { swatchSize?: SwatchSize; swatchShape?: SwatchShape }
    ) => {
      const newOptions = [...draftOptions];
      newOptions[optionIndex] = {
        ...newOptions[optionIndex],
        ...settings,
      };
      setDraftOptions(newOptions);
    },
    [draftOptions]
  );

  // Reorder values within an option
  const reorderValues = useCallback(
    (optionIndex: number, newValues: InlineOptionValue[]) => {
      const newOptions = [...draftOptions];
      newOptions[optionIndex] = {
        ...newOptions[optionIndex],
        values: newValues,
      };
      setDraftOptions(newOptions);
    },
    [draftOptions]
  );

  // Bulk add values (from text area)
  const bulkAddValues = useCallback(
    (optionIndex: number, text: string) => {
      const values = text
        .split(/[,\n]/)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);

      const option = draftOptions[optionIndex];
      const existingValues = new Set(
        option.values.map((v) => v.value.toLowerCase())
      );

      const newValues = values
        .filter((v) => !existingValues.has(v.toLowerCase()))
        .map((value) => ({
          value,
          swatchType: "text" as SwatchType,
          isNew: true,
        }));

      if (newValues.length === 0) return;

      const newOptions = [...draftOptions];
      newOptions[optionIndex] = {
        ...option,
        values: [...option.values, ...newValues],
      };
      setDraftOptions(newOptions);
    },
    [draftOptions]
  );

  // Navigation
  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case "options":
        return (
          draftOptions.length > 0 &&
          draftOptions.every((opt) => opt.name.trim().length >= 2)
        );
      case "values":
        return draftOptions.every((opt) => opt.values.length > 0);
      case "swatches":
        return true;
      default:
        return false;
    }
  }, [currentStep, draftOptions]);

  const goToNext = useCallback(() => {
    const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex < WIZARD_STEPS.length - 1) {
      setCurrentStep(WIZARD_STEPS[stepIndex + 1].id);
    }
  }, [currentStep]);

  const goToPrev = useCallback(() => {
    const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(WIZARD_STEPS[stepIndex - 1].id);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  // Save and close
  const handleSave = useCallback(() => {
    // Validate options
    const validOptions = draftOptions.filter(
      (opt) => opt.name.trim().length >= 2 && opt.values.length > 0
    );
    onChange(validOptions);
    onOpenChange(false);
  }, [draftOptions, onChange, onOpenChange]);

  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] h-175 flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header with step indicators */}
        <DialogHeader className="px-6 py-4 border-b shrink-0 bg-background">
          <DialogTitle className="text-xl">Variant Setup Wizard</DialogTitle>
          <DialogDescription>
            Configure product variants step by step
          </DialogDescription>

          {/* Step indicators */}
          <div className="flex items-center justify-between mt-4 px-4">
            {WIZARD_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex;
              const isClickable =
                index <= currentStepIndex ||
                (index === currentStepIndex + 1 && canGoNext);

              return (
                <div key={step.id} className="flex items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => isClickable && goToStep(step.id)}
                          disabled={!isClickable}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                            isActive && "bg-primary text-primary-foreground",
                            isCompleted &&
                              !isActive &&
                              "bg-primary/10 text-primary",
                            !isActive &&
                              !isCompleted &&
                              "text-muted-foreground",
                            isClickable &&
                              !isActive &&
                              "hover:bg-muted cursor-pointer",
                            !isClickable && "cursor-not-allowed opacity-50"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full border-2",
                              isActive &&
                                "border-primary-foreground bg-primary-foreground/20",
                              isCompleted &&
                                !isActive &&
                                "border-primary bg-primary text-primary-foreground",
                              !isActive &&
                                !isCompleted &&
                                "border-muted-foreground/30"
                            )}
                          >
                            {isCompleted && !isActive ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Icon className="h-4 w-4" />
                            )}
                          </div>
                          <span className="text-sm font-medium hidden sm:inline">
                            {step.title}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{step.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {index < WIZARD_STEPS.length - 1 && (
                    <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* Main content area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Step 1: Configure Options */}
            {currentStep === "options" && (
              <motion.div
                key="options"
                variants={slideInRight}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="h-full overflow-hidden"
              >
                <div className="flex flex-col h-full p-6">
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Configure Options
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Define variant option names (e.g., Size, Color,
                        Material)
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={addOption}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Option
                    </Button>
                  </div>

                  <ScrollArea className="flex-1 min-h-0 -mx-6">
                    <Reorder.Group
                      axis="y"
                      values={draftOptions}
                      onReorder={reorderOptions}
                      className="space-y-3 px-6 pb-6 pt-1"
                    >
                      <AnimatePresence mode="popLayout">
                        {draftOptions.map((option, index) => (
                          <OptionNameEditor
                            key={option.id || option.tempId}
                            option={option}
                            index={index}
                            existingOptions={existingOptions}
                            onNameChange={updateOptionName}
                            onRemove={removeOption}
                            otherNames={draftOptions
                              .filter((_, i) => i !== index)
                              .map((o) => o.name.toLowerCase())}
                          />
                        ))}
                      </AnimatePresence>
                    </Reorder.Group>

                    {draftOptions.length === 0 && (
                      <motion.div
                        variants={fadeInUp}
                        initial="initial"
                        animate="animate"
                        className="text-center py-12 px-6"
                      >
                        <Settings2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          No options yet. Add your first option to get started.
                        </p>
                        <Button className="mt-4" onClick={addOption}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add First Option
                        </Button>
                      </motion.div>
                    )}
                  </ScrollArea>
                </div>
              </motion.div>
            )}

            {/* Step 2: Set Values */}
            {currentStep === "values" && (
              <motion.div
                key="values"
                variants={slideInRight}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="h-full overflow-hidden"
              >
                <div className="flex flex-col h-full p-6">
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Set Option Values
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Add values for each option (e.g., S, M, L for Size)
                      </p>
                    </div>
                    {variantCount > 0 && (
                      <Badge
                        variant={
                          validation.status === "error"
                            ? "destructive"
                            : validation.status === "warning"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {variantCount} variant{variantCount !== 1 ? "s" : ""}{" "}
                        will be created
                      </Badge>
                    )}
                  </div>

                  <ScrollArea className="flex-1 min-h-0 -mx-6">
                    <div className="space-y-4 px-6 pb-6 pt-1">
                      {draftOptions.map((option, optionIndex) => (
                        <OptionValuesEditor
                          key={option.id || option.tempId}
                          option={option}
                          optionIndex={optionIndex}
                          onAddValue={addValue}
                          onRemoveValue={removeValue}
                          onBulkAdd={bulkAddValues}
                          onReorderValues={reorderValues}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </motion.div>
            )}

            {/* Step 3: Style Swatches */}
            {currentStep === "swatches" && (
              <motion.div
                key="swatches"
                variants={slideInRight}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="h-full overflow-hidden"
              >
                <div className="flex flex-col h-full p-6">
                  <div className="mb-4 shrink-0">
                    <h3 className="text-lg font-semibold">Style Swatches</h3>
                    <p className="text-sm text-muted-foreground">
                      Customize how each value appears on your storefront
                    </p>
                  </div>

                  <ScrollArea className="flex-1 min-h-0 -mx-6">
                    <div className="space-y-6 px-6 pb-6 pt-1">
                      {draftOptions.map((option, optionIndex) => (
                        <Card key={option.id || option.tempId}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">
                                {option.name}
                              </CardTitle>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-muted-foreground">
                                    Size
                                  </Label>
                                  <Select
                                    value={option.swatchSize || "md"}
                                    onValueChange={(value: SwatchSize) =>
                                      updateOptionSwatchSettings(optionIndex, {
                                        swatchSize: value,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-20">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="sm">Small</SelectItem>
                                      <SelectItem value="md">Medium</SelectItem>
                                      <SelectItem value="lg">Large</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-muted-foreground">
                                    Shape
                                  </Label>
                                  <Select
                                    value={option.swatchShape || "square"}
                                    onValueChange={(value: SwatchShape) =>
                                      updateOptionSwatchSettings(optionIndex, {
                                        swatchShape: value,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-24">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="square">
                                        Square
                                      </SelectItem>
                                      <SelectItem value="circle">
                                        Circle
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {option.values.map((value, valueIndex) => (
                                <div
                                  key={
                                    value.id ||
                                    `${option.tempId}-${value.value}`
                                  }
                                  className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50"
                                >
                                  <SwatchPreview
                                    type={value.swatchType || "text"}
                                    value={value.swatchValue}
                                    imageUrl={value.swatchImageUrl}
                                    size={option.swatchSize || "md"}
                                    shape={option.swatchShape || "square"}
                                  />
                                  <span className="flex-1 text-sm truncate">
                                    {value.value}
                                  </span>
                                  <SwatchEditor
                                    tenantId={tenantId}
                                    value={value.value}
                                    swatchType={value.swatchType || "text"}
                                    swatchValue={value.swatchValue}
                                    swatchImageUrl={value.swatchImageUrl}
                                    onSwatchChange={(type, sVal, imgUrl) =>
                                      updateValueSwatch(
                                        optionIndex,
                                        valueIndex,
                                        type,
                                        sVal,
                                        imgUrl
                                      )
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer with navigation */}
        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <Button variant="outline" onClick={goToPrev}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}

              {currentStepIndex < WIZARD_STEPS.length - 1 ? (
                <Button onClick={goToNext} disabled={!canGoNext}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={validation.status === "error"}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Save Options
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Option name editor with drag handle and autocomplete
interface OptionNameEditorProps {
  option: InlineOption;
  index: number;
  existingOptions: ExistingOption[];
  onNameChange: (index: number, name: string) => void;
  onRemove: (index: number) => void;
  otherNames: string[];
}

function OptionNameEditor({
  option,
  index,
  existingOptions,
  onNameChange,
  onRemove,
  otherNames,
}: OptionNameEditorProps) {
  const dragControls = useDragControls();
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDuplicate = otherNames.includes(option.name.trim().toLowerCase());

  // Filter suggestions based on input
  const suggestions = existingOptions.filter(
    (opt) =>
      opt.name.toLowerCase().includes(option.name.toLowerCase()) &&
      !otherNames.includes(opt.name.toLowerCase())
  );

  return (
    <Reorder.Item
      value={option}
      dragListener={false}
      dragControls={dragControls}
      className="group"
    >
      <motion.div
        layout
        variants={scaleIn}
        initial="initial"
        animate="animate"
        exit="exit"
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border bg-card",
          isDuplicate && "border-destructive"
        )}
      >
        <button
          type="button"
          onPointerDown={(e) => dragControls.start(e)}
          className="cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="flex-1 relative">
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverAnchor asChild>
              <Input
                ref={inputRef}
                value={option.name}
                onChange={(e) => {
                  onNameChange(index, e.target.value);
                  if (e.target.value.length > 0) {
                    setIsOpen(true);
                  }
                }}
                onFocus={() => {
                  if (option.name.length > 0 && suggestions.length > 0) {
                    setIsOpen(true);
                  }
                }}
                placeholder="Option name (e.g., Size, Color)"
                className={cn(
                  isDuplicate &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
            </PopoverAnchor>
            {suggestions.length > 0 && (
              <PopoverContent
                className="p-0 w-(--radix-popover-trigger-width)"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command>
                  <CommandList>
                    <CommandEmpty>No existing options found</CommandEmpty>
                    <CommandGroup heading="Existing Options">
                      {suggestions.slice(0, 5).map((opt) => (
                        <CommandItem
                          key={opt.id}
                          value={opt.name}
                          onSelect={() => {
                            onNameChange(index, opt.name);
                            setIsOpen(false);
                          }}
                        >
                          {opt.name}
                          <Badge
                            variant="secondary"
                            className="ml-auto text-xs"
                          >
                            {opt.values.length} values
                          </Badge>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            )}
          </Popover>

          {isDuplicate && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              This option name is already used
            </p>
          )}
        </div>

        <Badge variant="outline" className="shrink-0">
          {option.values.length} value{option.values.length !== 1 ? "s" : ""}
        </Badge>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(index)}
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </motion.div>
    </Reorder.Item>
  );
}

// Option values editor with tags and bulk add
interface OptionValuesEditorProps {
  option: InlineOption;
  optionIndex: number;
  onAddValue: (optionIndex: number, value: string) => void;
  onRemoveValue: (optionIndex: number, valueIndex: number) => void;
  onBulkAdd: (optionIndex: number, text: string) => void;
  onReorderValues: (optionIndex: number, values: InlineOptionValue[]) => void;
}

function OptionValuesEditor({
  option,
  optionIndex,
  onAddValue,
  onRemoveValue,
  onBulkAdd,
  onReorderValues,
}: OptionValuesEditorProps) {
  const [inputValue, setInputValue] = useState("");
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        onAddValue(optionIndex, inputValue);
        setInputValue("");
      }
    } else if (
      e.key === "Backspace" &&
      !inputValue &&
      option.values.length > 0
    ) {
      onRemoveValue(optionIndex, option.values.length - 1);
    }
  };

  const handleBulkAdd = () => {
    if (bulkText.trim()) {
      onBulkAdd(optionIndex, bulkText);
      setBulkText("");
      setShowBulkAdd(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {option.name || "Unnamed Option"}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBulkAdd(!showBulkAdd)}
          >
            <Copy className="h-4 w-4 mr-1" />
            Bulk Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <AnimatePresence>
          {showBulkAdd && (
            <motion.div
              variants={fadeInUp}
              initial="initial"
              animate="animate"
              exit="exit"
              className="mb-3 p-3 rounded-lg bg-muted"
            >
              <Label className="text-sm">
                Paste values (comma or line separated)
              </Label>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Red, Blue, Green&#10;or one per line"
                className="w-full mt-1.5 px-3 py-2 text-sm rounded-md border bg-background resize-none h-20"
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBulkAdd(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleBulkAdd}>
                  Add Values
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/30 min-h-15 cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          <Reorder.Group
            axis="x"
            values={option.values}
            onReorder={(newValues) => onReorderValues(optionIndex, newValues)}
            className="flex flex-wrap gap-2"
          >
            <AnimatePresence mode="popLayout">
              {option.values.map((value, valueIndex) => (
                <Reorder.Item
                  key={value.id || `${option.tempId}-${value.value}`}
                  value={value}
                  className="select-none"
                >
                  <motion.div
                    layout
                    variants={scaleIn}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <Badge
                      variant="secondary"
                      className="pr-1 gap-1 cursor-grab active:cursor-grabbing"
                    >
                      <SwatchPreview
                        type={value.swatchType || "text"}
                        value={value.swatchValue}
                        imageUrl={value.swatchImageUrl}
                        size="sm"
                      />
                      {value.value}
                      <button
                        type="button"
                        onClick={() => onRemoveValue(optionIndex, valueIndex)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </motion.div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>

          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (inputValue.trim()) {
                onAddValue(optionIndex, inputValue);
                setInputValue("");
              }
            }}
            placeholder="Type and press Enter"
            className="flex-1 min-w-30 h-7 border-none shadow-none bg-transparent focus-visible:ring-0 px-1"
          />
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Press Enter or comma to add values. Drag to reorder.
        </p>
      </CardContent>
    </Card>
  );
}
