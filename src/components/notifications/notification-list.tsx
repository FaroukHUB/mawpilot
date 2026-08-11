"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CheckCheck } from "lucide-react";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/reminders";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  delivery: Record<string, string> | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationList({
  notifications,
}: {
  notifications: NotificationRow[];
}) {
  const [isPending, startTransition] = React.useTransition();
  const list = Array.isArray(notifications) ? notifications : [];
  const unread = list.filter((n) => !n.read_at);

  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune notification pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {unread.length > 0 ? (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {unread.length} non lue{unread.length > 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await markAllNotificationsRead();
              })
            }
          >
            <CheckCheck aria-hidden />
            Tout marquer comme lu
          </Button>
        </div>
      ) : null}

      {list.slice(0, 15).map((notification) => (
        <div
          key={notification.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border px-3 py-2.5",
            notification.read_at ? "opacity-60" : "bg-accent/40"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{notification.title}</p>
            {notification.body ? (
              <p className="text-sm text-muted-foreground">
                {notification.body}
              </p>
            ) : null}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatRelative(notification.created_at)}
              {notification.delivery?.push
                ? ` · push : ${notification.delivery.push}`
                : ""}
              {notification.delivery?.email &&
              notification.delivery.email !== "non_necessaire"
                ? ` · email : ${notification.delivery.email}`
                : ""}
            </p>
          </div>

          {notification.url ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={notification.url}>Ouvrir</Link>
            </Button>
          ) : null}

          {!notification.read_at ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Marquer comme lue"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await markNotificationRead(notification.id);
                })
              }
            >
              <Check aria-hidden />
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
