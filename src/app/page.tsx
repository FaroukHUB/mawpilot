import { redirect } from "next/navigation";

// Le proxy redirige vers /login si aucune session n'est active.
export default function Home() {
  redirect("/dashboard");
}
