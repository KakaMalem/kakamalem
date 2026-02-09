"use client";

import {
  MapPin,
  Circle,
  Globe,
  Earth,
  ChevronRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UnifiedZoneType } from "@/lib/validations/unified-delivery";

interface ZoneTypeOption {
  type: UnifiedZoneType;
  icon: React.ReactNode;
  title: string;
  description: string;
  examples: string;
  specificity: number;
}

const ZONE_TYPE_OPTIONS: ZoneTypeOption[] = [
  {
    type: "radius",
    icon: <Circle className="h-6 w-6" />,
    title: "Radius Zone",
    description: "Set a circular delivery area around a center point",
    examples: "Within 5km of store, local delivery area",
    specificity: 500,
  },
  {
    type: "polygon",
    icon: <MapPin className="h-6 w-6" />,
    title: "Custom Polygon",
    description: "Draw a custom shape on the map for precise delivery areas",
    examples: "Downtown district, industrial zone, campus",
    specificity: 600,
  },
  {
    type: "country",
    icon: <Globe className="h-6 w-6" />,
    title: "Countries",
    description: "Select one or more countries for shipping",
    examples: "Afghanistan, Iran, UAE",
    specificity: 100,
  },
  {
    type: "worldwide",
    icon: <Earth className="h-6 w-6" />,
    title: "Worldwide",
    description: "Global fallback for all other locations",
    examples: "Rest of world, international shipping",
    specificity: 10,
  },
];

interface ZoneTypeSelectorProps {
  selectedType: UnifiedZoneType | null;
  onSelect: (type: UnifiedZoneType) => void;
  onContinue?: () => void;
  disabled?: boolean;
  /** Suggested zone types based on delivery type preset */
  suggestedTypes?: UnifiedZoneType[];
}

export function ZoneTypeSelector({
  selectedType,
  onSelect,
  onContinue,
  disabled = false,
  suggestedTypes,
}: ZoneTypeSelectorProps) {
  // Sort options: suggested first, then others
  const sortedOptions = suggestedTypes
    ? [
        ...ZONE_TYPE_OPTIONS.filter((opt) => suggestedTypes.includes(opt.type)),
        ...ZONE_TYPE_OPTIONS.filter(
          (opt) => !suggestedTypes.includes(opt.type)
        ),
      ]
    : ZONE_TYPE_OPTIONS;

  return (
    <div className="space-y-6">
      {suggestedTypes && suggestedTypes.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Recommended area types for your delivery option are highlighted below.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedOptions.map((option) => (
          <ZoneTypeCard
            key={option.type}
            option={option}
            isSelected={selectedType === option.type}
            isSuggested={suggestedTypes?.includes(option.type)}
            onSelect={() => onSelect(option.type)}
            disabled={disabled}
          />
        ))}
      </div>

      {selectedType && onContinue && (
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onContinue} disabled={disabled}>
            Continue
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface ZoneTypeCardProps {
  option: ZoneTypeOption;
  isSelected: boolean;
  isSuggested?: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

function ZoneTypeCard({
  option,
  isSelected,
  isSuggested,
  onSelect,
  disabled,
}: ZoneTypeCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left",
        "hover:border-primary/50 hover:bg-muted/30",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : isSuggested
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-card",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={onSelect}
      disabled={disabled}
    >
      {/* Suggested badge */}
      {isSuggested && !isSelected && (
        <div className="absolute top-3 right-3 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
          Recommended
        </div>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}

      {/* Icon */}
      <div
        className={cn(
          "p-2.5 rounded-lg mb-3",
          isSelected || isSuggested
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        {option.icon}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm mb-1">{option.title}</h3>

      {/* Description */}
      <p className="text-xs text-muted-foreground mb-2">{option.description}</p>

      {/* Examples */}
      <p className="text-xs text-muted-foreground/70 italic">
        e.g., {option.examples}
      </p>

      {/* Specificity badge */}
      <div
        className={cn(
          "absolute bottom-3 right-3 text-[10px] px-1.5 py-0.5 rounded",
          isSelected || isSuggested
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        Priority: {option.specificity}
      </div>
    </button>
  );
}

/**
 * Compact inline selector (for editing existing zones)
 */
interface ZoneTypeSelectorInlineProps {
  value: UnifiedZoneType;
  onChange: (type: UnifiedZoneType) => void;
  disabled?: boolean;
}

export function ZoneTypeSelectorInline({
  value,
  onChange,
  disabled,
}: ZoneTypeSelectorInlineProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ZONE_TYPE_OPTIONS.map((option) => (
        <button
          key={option.type}
          type="button"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors",
            value === option.type
              ? "border-primary bg-primary/10 text-primary"
              : "border-border hover:border-primary/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => onChange(option.type)}
          disabled={disabled}
        >
          <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{option.icon}</span>
          {option.title}
        </button>
      ))}
    </div>
  );
}

/**
 * Get zone type metadata
 */
export function getZoneTypeInfo(
  type: UnifiedZoneType
): ZoneTypeOption | undefined {
  return ZONE_TYPE_OPTIONS.find((opt) => opt.type === type);
}
