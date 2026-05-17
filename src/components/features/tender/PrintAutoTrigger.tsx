"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function PrintAutoTrigger() {
  const searchParams = useSearchParams();
  const shouldAutoPrint = searchParams.get("autoprint") === "1";

  useEffect(() => {
    if (!shouldAutoPrint) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.print();
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldAutoPrint]);

  return null;
}
