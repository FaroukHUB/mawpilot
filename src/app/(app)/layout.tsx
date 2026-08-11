import { redirect } from "next/navigation";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email ?? "";

  return (
    <div className="flex min-h-svh w-full">
      <Sidebar userEmail={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav userEmail={email} />
        <main
          id="contenu-principal"
          // pb-20 sur mobile : laisse la place à la barre de navigation basse.
          className="flex-1 bg-muted/40 p-4 pb-20 md:p-6 md:pb-6 print:bg-white print:p-0"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
