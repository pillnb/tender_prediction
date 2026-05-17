"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

export function PrintPageActions() {
  return (
    <div className="no-print mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Link
        href="/archived"
        className="text-on-surface inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Saved Project
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="bg-primary text-on-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
      >
        <Printer className="h-4 w-4" />
        Print / Save PDF
      </button>
    </div>
  );
}
