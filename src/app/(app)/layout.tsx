import { redirect } from "next/navigation";

import { MawButton } from "@/components/assistant/maw-button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import type { NotificationRow } from "@/components/notifications/notification-list";
import { isOpenAIConfigured } from "@/lib/ai/openai";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email ?? "";

  // Les alertes doivent être visibles depuis n'importe quel écran : sans cela,
  // une demande client arrivait en base sans que rien ne l'annonce.
  const supabase = await createClient();
  const [{ data: notifications }, { count: pendingRequests }] =
    await Promise.all([
      supabase
        .from("notifications")
        .select("id, title, body, url, delivery, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("client_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["nouvelle", "en_analyse"]),
    ]);

  return (
    <div className="flex min-h-svh w-full">
      <Sidebar
        userEmail={email}
        badges={{ demandes: pendingRequests ?? 0 }}
        notifications={(notifications ?? []) as NotificationRow[]}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav
          userEmail={email}
          badges={{ demandes: pendingRequests ?? 0 }}
          notifications={(notifications ?? []) as NotificationRow[]}
        />
        <main
          id="contenu-principal"
          // pb-20 sur mobile : laisse la place à la barre de navigation basse.
          className="flex-1 bg-muted/40 p-4 pb-20 md:p-6 md:pb-6 print:bg-white print:p-0"
        >
          {children}
        </main>
      </div>
      {/* Entrée principale de l'application, disponible partout. */}
      <MawButton isConfigured={isOpenAIConfigured()} />
    </div>
  );
}
