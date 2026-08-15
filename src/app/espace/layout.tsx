import { redirect } from "next/navigation";
import { LogOut, Rocket } from "lucide-react";

import { logout } from "@/actions/auth";
import { getClientAccount } from "@/lib/client-portal/session";

/**
 * Espace client : mise en page dédiée, distincte du cockpit du propriétaire.
 * Un compte non rattaché à une entreprise n'a rien à faire ici.
 */
export default async function ClientSpaceLayout({
  children,
}: LayoutProps<"/espace">) {
  const account = await getClientAccount();
  if (!account) redirect("/login");

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: account.companyColor }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="truncate font-semibold">{account.companyName}</p>
              <p className="truncate text-xs text-muted-foreground">
                Suivi de projet · {account.displayName}
              </p>
            </div>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Quitter</span>
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5">
        {children}
      </main>

      <footer className="border-t bg-background px-4 py-4">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-center gap-2 text-xs text-muted-foreground">
          <Rocket className="size-3.5" aria-hidden />
          Propulsé par MAW Pilot
        </div>
      </footer>
    </div>
  );
}
