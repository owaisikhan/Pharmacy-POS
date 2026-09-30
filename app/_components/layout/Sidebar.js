"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  CalendarClock, ChartColumn, LayoutDashboard, Menu, PackagePlus, Pill, ReceiptText, ScanBarcode, Settings, Truck, Users, Wallet, X,
} from "lucide-react";
import { NAV } from "@/app/_components/layout/nav-items";

const ICONS = { CalendarClock, ChartColumn, LayoutDashboard, PackagePlus, Pill, ReceiptText, ScanBarcode, Settings, Truck, Users, Wallet };

function isActive(pathname, href) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ isAdmin, pathname, onNavigate }) {
  const items = NAV.filter((n) => !n.admin || isAdmin);
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((n, i) => {
        const Icon = ICONS[n.icon];
        const active = isActive(pathname, n.href);
        const firstAdmin = n.admin && !items[i - 1]?.admin;
        return (
          <li key={n.href} className={clsx(firstAdmin && "mt-3 border-t border-[var(--color-border)] pt-3")}>
            <Link
              href={n.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                active ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1">{n.label}</span>
              {n.key ? <span className={clsx("kbd", active && "border-white/40 bg-transparent text-white")}>{n.key}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function Sidebar({ isAdmin, pharmacyName }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // F2 opens the sale screen from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "F2" && !pathname.startsWith("/pos")) {
        e.preventDefault();
        router.push("/pos");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  const brand = (
    <Link href="/" className="flex items-center gap-2 px-3 py-1">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-primary)] text-white">
        <Pill className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 truncate text-sm leading-tight font-semibold">{pharmacyName}</span>
    </Link>
  );

  return (
    <>
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-3 lg:flex">
        {brand}
        <nav aria-label="Main" className="flex-1 overflow-y-auto">
          <NavList isAdmin={isAdmin} pathname={pathname} />
        </nav>
      </aside>

      <div className="no-print flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 lg:hidden">
        {brand}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {open ? (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav aria-label="Main" className="absolute inset-y-0 left-0 flex w-72 flex-col gap-4 overflow-y-auto bg-[var(--color-surface)] p-3 shadow-xl">
            <div className="flex items-center justify-between">
              {brand}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <NavList isAdmin={isAdmin} pathname={pathname} onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      ) : null}
    </>
  );
}
