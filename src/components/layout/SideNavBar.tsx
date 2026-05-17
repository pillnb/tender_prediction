import {
  LayoutDashboard,
  Users,
  Truck,
  Hammer,
  Layers,
  Banknote,
  TrendingUp,
  FileText,
} from "lucide-react";
import Link from "next/link";

export function SideNavBar() {
  return (
    <nav className="border-outline-variant/70 bg-surface-container-lowest/82 fixed top-16 left-0 z-40 flex h-[calc(100vh-64px)] w-[280px] flex-col gap-3 border-r px-4 py-5 text-sm font-medium shadow-[18px_0_40px_rgba(11,28,48,0.04)] backdrop-blur-xl">
      <div className="border-outline-variant/70 from-surface-container-high to-surface-container-low rounded-[1.25rem] border bg-linear-to-br p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
        <div className="text-on-surface-variant text-[11px] font-semibold tracking-[0.08em] uppercase">
          Workspace
        </div>
        <div className="text-on-surface font-h2 mt-2 text-lg font-bold">Tender Navigator</div>
        <div className="text-on-surface-variant mt-1 text-sm">
          Rule-based pricing, archive access, and review flow in one place.
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Link
          className="text-primary bg-primary/8 flex items-center gap-3 rounded-full px-4 py-3 font-semibold shadow-[inset_0_0_0_1px_rgba(22,78,182,0.14)] transition-transform active:scale-95"
          href="/"
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Overview</span>
        </Link>
        <a className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex cursor-pointer items-center gap-3 rounded-full px-4 py-3 transition-all hover:translate-x-1">
          <Users className="h-5 w-5" />
          <span>Labor</span>
        </a>
        <a className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex cursor-pointer items-center gap-3 rounded-full px-4 py-3 transition-all hover:translate-x-1">
          <Truck className="h-5 w-5" />
          <span>Logistics</span>
        </a>
        <a className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex cursor-pointer items-center gap-3 rounded-full px-4 py-3 transition-all hover:translate-x-1">
          <Hammer className="h-5 w-5" />
          <span>Equipment</span>
        </a>
        <a className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex cursor-pointer items-center gap-3 rounded-full px-4 py-3 transition-all hover:translate-x-1">
          <Layers className="h-5 w-5" />
          <span>Materials</span>
        </a>
        <a className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex cursor-pointer items-center gap-3 rounded-full px-4 py-3 transition-all hover:translate-x-1">
          <Banknote className="h-5 w-5" />
          <span>Overhead</span>
        </a>
        <a className="text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex cursor-pointer items-center gap-3 rounded-full px-4 py-3 transition-all hover:translate-x-1">
          <TrendingUp className="h-5 w-5" />
          <span>Profit</span>
        </a>
      </div>
      <div className="mt-auto">
        <Link
          className="from-primary-container to-secondary-container text-on-primary-container flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r py-3.5 text-sm font-bold shadow-[0_16px_30px_rgba(22,78,182,0.22)] transition-all hover:translate-y-[-1px] hover:opacity-95"
          href="/archived"
        >
          <FileText className="text-on-primary-container h-4 w-4" />
          Saved Projects
        </Link>
      </div>
    </nav>
  );
}
