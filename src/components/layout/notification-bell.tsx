"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/reminders";
import type { NotificationRow } from "@/components/notifications/notification-list";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Cloche de notifications, présente sur tous les écrans.
 *
 * Sans elle, une alerte enregistrée en base restait invisible tant qu'on
 * n'ouvrait pas la page Rappels : on pouvait donc « recevoir » une demande
 * client sans jamais le savoir.
 */
export function NotificationBell({
  notifications,
  className,
}: {
  notifications: NotificationRow[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const list = Array.isArray(notifications) ? notifications : [];
  const unread = list.filter((n) => !n.read_at);

  // Fermeture au clic extérieur et à Échap : comportement attendu d'un menu.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          unread.length > 0
            ? `Notifications, ${unread.length} non lue${unread.length > 1 ? "s" : ""}`
            : "Notifications"
        }
        className="relative rounded-md p-1.5 transition-colors hover:bg-sidebar-accent"
      >
        <Bell className="size-5" aria-hidden />
        {unread.length > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] leading-4 font-semibold text-white">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-2 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread.length > 0 ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await markAllNotificationsRead();
                  })
                }
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Tout lire
              </button>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto">
            {list.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Rien de neuf.
              </p>
            ) : (
              list.slice(0, 12).map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-2 border-b px-3 py-2.5 last:border-b-0",
                    notification.read_at ? "opacity-60" : "bg-accent/40"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    {notification.url ? (
                      <Link
                        href={notification.url}
                        onClick={() => {
                          setOpen(false);
                          startTransition(async () => {
                            await markNotificationRead(notification.id);
                          });
                        }}
                        className="text-sm font-medium hover:underline"
                      >
                        {notification.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">{notification.title}</p>
                    )}
                    {notification.body ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {notification.body}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatRelative(notification.created_at)}
                    </p>
                  </div>

                  {!notification.read_at ? (
                    <button
                      type="button"
                      aria-label="Marquer comme lue"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await markNotificationRead(notification.id);
                        })
                      }
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Check className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <Link
            href="/rappels"
            onClick={() => setOpen(false)}
            className="border-t px-3 py-2 text-center text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Voir les rappels et automatisations
          </Link>
        </div>
      ) : null}
    </div>
  );
}
