import {
  Building2,
  Calendar,
  FileText,
  FolderOpen,
  History,
  LayoutDashboard,
  Link2,
  ListChecks,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const navigation: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/entreprises", label: "Entreprises", icon: Building2 },
  { href: "/taches", label: "Tâches", icon: ListChecks },
  { href: "/calendrier", label: "Calendrier", icon: Calendar },
  { href: "/historique", label: "Historique", icon: History },
  { href: "/rapports", label: "Rapports", icon: FileText },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/ressources", label: "Accès rapides", icon: Link2 },
  { href: "/assistant", label: "Assistant IA", icon: Sparkles },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];
