"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rocket } from "lucide-react";

import { navigation } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/**
 * Navigation mobile provisoire : en-tête + rangée d'onglets défilante.
 * Sera raffinée en phase 8 (finition responsive).
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b bg-sidebar text-sidebar-foreground md:hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Rocket className="size-4" aria-hidden />
        </span>
        <span className="font-semibold">MAW Pilot</span>
      </div>
      <nav aria-label="Navigation principale" className="overflow-x-auto">
        <ul className="flex gap-1 px-2 pb-2">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
