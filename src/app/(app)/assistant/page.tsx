import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessagesSquare, Plus } from "lucide-react";

import { createConversation } from "@/actions/ai";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { isOpenAIConfigured } from "@/lib/ai/openai";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Assistant IA" };

export default async function AssistantPage({
  searchParams,
}: PageProps<"/assistant">) {
  const params = await searchParams;
  const requested =
    typeof params.conversation === "string" ? params.conversation : "";

  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [{ data: conversations }, { data: companies }] = await Promise.all([
    supabase
      .from("ai_conversations")
      .select("id, title, company_id, last_message_at")
      .eq("is_archived", false)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(30),
    supabase
      .from("companies")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  const list = conversations ?? [];

  // Première visite : on crée la conversation générale.
  if (list.length === 0) {
    const created = await createConversation();
    if (created.data) redirect(`/assistant?conversation=${created.data.id}`);
  }

  const activeId = list.some((c) => c.id === requested)
    ? requested
    : (list[0]?.id ?? "");

  const { data: messages } = activeId
    ? await supabase
        .from("ai_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", activeId)
        .in("role", ["user", "assistant", "system"])
        .order("created_at", { ascending: true })
        .limit(60)
    : { data: [] };

  async function startCompanyConversation(formData: FormData) {
    "use server";
    const companyId = String(formData.get("company_id") ?? "");
    const result = await createConversation(companyId || undefined);
    if (result.data) redirect(`/assistant?conversation=${result.data.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Assistant IA</h1>
        <form action={startCompanyConversation} className="flex gap-2">
          <Select
            name="company_id"
            aria-label="Nouvelle conversation pour une entreprise"
            className="w-auto"
          >
            <option value="">Conversation générale</option>
            {(companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline" size="sm">
            <Plus aria-hidden />
            Nouvelle
          </Button>
        </form>
      </div>

      {list.length > 1 ? (
        <nav aria-label="Conversations" className="overflow-x-auto">
          <ul className="flex gap-1 border-b">
            {list.map((c) => (
              <li key={c.id} className="shrink-0">
                <Link
                  href={`/assistant?conversation=${c.id}`}
                  aria-current={activeId === c.id ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    activeId === c.id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessagesSquare className="size-3.5" aria-hidden />
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {activeId ? (
        <AssistantChat
          conversationId={activeId}
          initialMessages={(messages ?? []).map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          }))}
          isConfigured={isOpenAIConfigured()}
        />
      ) : null}
    </div>
  );
}
