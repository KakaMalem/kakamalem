"use client";

import { useCallback } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OrderPrintButton() {
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      className="no-print"
    >
      <Printer className="size-4" />
      <span className="hidden sm:inline">Print</span>
    </Button>
  );
}
