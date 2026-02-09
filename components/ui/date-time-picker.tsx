"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateTimePickerProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  id?: string;
  hasError?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date and time",
  disabled = false,
  className,
  minDate,
  maxDate,
  id,
  hasError = false,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(
    value || undefined
  );

  // Sync internal state with external value
  React.useEffect(() => {
    setInternalDate(value || undefined);
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setInternalDate(undefined);
      onChange?.(null);
      return;
    }

    // Preserve existing time or default to current time
    const newDate = new Date(date);
    if (internalDate) {
      newDate.setHours(internalDate.getHours());
      newDate.setMinutes(internalDate.getMinutes());
    } else {
      const now = new Date();
      newDate.setHours(now.getHours());
      newDate.setMinutes(now.getMinutes());
    }
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);

    setInternalDate(newDate);
    onChange?.(newDate);
  };

  const handleTimeChange = (type: "hours" | "minutes", value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;

    const newDate = internalDate ? new Date(internalDate) : new Date();

    if (type === "hours") {
      if (numValue < 0 || numValue > 23) return;
      newDate.setHours(numValue);
    } else {
      if (numValue < 0 || numValue > 59) return;
      newDate.setMinutes(numValue);
    }

    newDate.setSeconds(0);
    newDate.setMilliseconds(0);

    setInternalDate(newDate);
    onChange?.(newDate);
  };

  const hours = internalDate?.getHours() ?? 0;
  const minutes = internalDate?.getMinutes() ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !internalDate && "text-muted-foreground",
            hasError && "border-destructive",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 size-4" />
          {internalDate ? (
            format(internalDate, "PPP 'at' HH:mm")
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={internalDate}
          onSelect={handleDateSelect}
          disabled={(date) => {
            if (minDate && date < minDate) return true;
            if (maxDate && date > maxDate) return true;
            return false;
          }}
          initialFocus
        />
        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={23}
                value={hours.toString().padStart(2, "0")}
                onChange={(e) => handleTimeChange("hours", e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-14 text-center"
                disabled={disabled || !internalDate}
              />
              <span className="text-muted-foreground">:</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={minutes.toString().padStart(2, "0")}
                onChange={(e) => handleTimeChange("minutes", e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-14 text-center"
                disabled={disabled || !internalDate}
              />
            </div>
            <span className="text-xs text-muted-foreground ml-auto">24h</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
