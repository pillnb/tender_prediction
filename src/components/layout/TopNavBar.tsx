"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";

export function TopNavBar() {
  const pathname = usePathname();
  const router = useRouter();

  const homeIsActive = pathname === "/";
  const savedProjectIsActive = pathname === "/archived";

  function navigateWithSmoothScroll(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (pathname === href) {
      event.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      return;
    }

    event.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    window.setTimeout(() => {
      router.push(href);
    }, 180);
  }

  return (
    <header className="fixed top-0 left-0 z-50 h-20 w-full border-b border-black/5 bg-white/60 shadow-sm backdrop-blur-lg">
      <div className="mx-auto flex h-full max-w-[1920px] items-center justify-between px-12">
        <Link
          className="font-h1 from-primary to-secondary bg-linear-to-r bg-clip-text text-xl font-bold tracking-tighter text-transparent"
          href="/"
          onClick={(event) => navigateWithSmoothScroll(event, "/")}
        >
          Tender Price - Rule Based Calculator
        </Link>

        <nav className="flex items-center gap-8">
          <Link
            className={
              homeIsActive
                ? "border-primary text-primary border-b-2 pb-1 text-sm font-semibold"
                : "text-on-surface-variant hover:text-on-surface text-sm font-semibold transition-all"
            }
            href="/"
            onClick={(event) => navigateWithSmoothScroll(event, "/")}
          >
            Home
          </Link>
          <Link
            className={
              savedProjectIsActive
                ? "border-primary text-primary border-b-2 pb-1 text-sm font-semibold"
                : "text-on-surface-variant hover:text-on-surface text-sm font-semibold transition-all"
            }
            href="/archived"
            onClick={(event) => navigateWithSmoothScroll(event, "/archived")}
          >
            Saved Project
          </Link>
        </nav>
      </div>
    </header>
  );
}
