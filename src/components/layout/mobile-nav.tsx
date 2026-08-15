"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Mic,
  Rocket,
  X,
} from "lucide-react";

import { logout } from "@/actions/auth";
import { navigation, type NavBadges } from "@/components/layout/nav-items";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Wordmark } from "@/components/layout/wordmark";
import type { NotificationRow } from "@/components/notifications/notification-list";
import { cn } from "@/lib/utils";

/** Onglets principaux de la barre inférieure (mobile). */
const PRIMARY = [
  { href: "/dashboard", label: "Accueil", icon: LayoutDashboard },
  { href: "/taches", label: "Tâches", icon: ListChecks },
  { href: "/assistant", label: "Assistant", icon: Mic, highlight: true },
  { href: "/entreprises", label: "Clients", icon: Building2 },
] as const;

export function MobileNav({
  userEmail,
  badges,
  notifications,
}: {
  userEmail: string;
  badges: NavBadges;
  notifications: NotificationRow[];
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden print:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Rocket className="size-4" aria-hidden />
          </span>
          <Wordmark className="font-semibold" />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell notifications={notifications} />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            className="rounded-md p-1.5 hover:bg-sidebar-accent"
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <nav
          id="menu-mobile"
          aria-label="Menu complet"
          className="sticky top-[57px] z-20 border-b bg-sidebar px-2 pb-3 text-sidebar-foreground md:hidden print:hidden"
        >
          <ul className="grid grid-cols-2 gap-1">
            {navigation.map(({ href, label, icon: Icon, badge }) => {
              const count = badge ? badges[badge] : 0;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                      isActive(href)
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {label}
                    {count > 0 ? (
                      <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-semibold text-white">
                        {count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 border-t border-sidebar-border pt-2">
            <p className="truncate px-3 text-xs text-sidebar-foreground/60">
              {userEmail}
            </p>
            <form action={logout}>
              <button
                type="submit"
                className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent"
              >
                <LogOut className="size-4" aria-hidden />
                Se déconnecter
              </button>
            </form>
          </div>
        </nav>
      ) : null}

      {/* Barre inférieure : accès en un pouce aux écrans les plus utilisés. */}
      <nav
        aria-label="Navigation rapide"
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        <ul className="grid grid-cols-4">
          {PRIMARY.map(({ href, label, icon: Icon, ...rest }) => {
            const active = isActive(href);
            const highlight = "highlight" in rest && rest.highlight;
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full",
                      highlight
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : active
                          ? "bg-accent"
                          : ""
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
