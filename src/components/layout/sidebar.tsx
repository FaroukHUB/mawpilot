"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Rocket } from "lucide-react";

import { logout } from "@/actions/auth";
import { navigation, type NavBadges } from "@/components/layout/nav-items";
import { NotificationBell } from "@/components/layout/notification-bell";
import type { NotificationRow } from "@/components/notifications/notification-list";
import { cn } from "@/lib/utils";

export function Sidebar({
  userEmail,
  badges,
  notifications,
}: {
  userEmail: string;
  badges: NavBadges;
  notifications: NotificationRow[];
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex print:hidden">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Rocket className="size-4" aria-hidden />
        </span>
        <span className="text-lg font-semibold">MAW Pilot</span>
        <NotificationBell notifications={notifications} className="ml-auto" />
      </div>
      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-2">
        <ul className="flex flex-col gap-1">
          {navigation.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const count = badge ? badges[badge] : 0;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <p className="mb-2 truncate px-1 text-xs text-sidebar-foreground/60" title={userEmail}>
          {userEmail}
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" aria-hidden />
            Se déconnecter
          </button>
        </form>
      </div>
    </aside>
  );
}
