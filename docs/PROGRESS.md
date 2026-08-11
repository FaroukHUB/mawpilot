# MAW Pilot — Avancement

> État utile pour reprendre le travail. Mis à jour à la fin de chaque phase.

## Phase actuelle : 1 terminée — en attente de validation pour la phase 2

## Phase 1 · Fondations — ✅ terminée (2026-08-11)

### Réalisé

- Projet Next.js 16.3 (App Router) + TypeScript strict + Tailwind CSS v4,
  initialisé dans le dépôt `faroukhub/mawpilot`, branche
  `claude/maw-pilot-architecture-mvp-0q0sb9`.
- Thème MAW Pilot en variables CSS (`src/app/globals.css`) : orange `#FFA000`,
  jaune `#FFD100`, noir `#111111`, gris neutres, tokens shadcn/ui complets
  (clair + sombre + sidebar).
- Composants shadcn/ui de départ dans `src/components/ui/` : button, badge,
  card, input, label, separator, skeleton (ajoutés manuellement — voir D-004).
- Dépendances de fondation : zod, react-hook-form, @hookform/resolvers,
  date-fns + @date-fns/tz, lucide-react, geist (polices locales), cva/clsx/
  tailwind-merge, tw-animate-css, @radix-ui/react-{slot,label,separator}.
- Helpers de dates `src/lib/dates.ts` (locale `fr`, fuseau `Europe/Paris`,
  formats FR, durée en minutes).
- Layout racine en français (`lang="fr"`, métadonnées, `robots: noindex`),
  page d'accueil provisoire stylée.
- Documentation : `CLAUDE.md`, `README.md`, `docs/PROJECT_SPEC.md`,
  `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` (D-001 → D-008), `.env.example`.
- Script `npm run typecheck` ajouté.

### Vérifications

- `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run build` ✅ (Next 16.3,
  aucune erreur). Pas encore de tests : la logique métier arrive en phase 2+.

### Problèmes connus / contraintes

- Le proxy de l'environnement distant bloque `ui.shadcn.com` : composants
  shadcn ajoutés à la main (D-004). Aucun impact sur le résultat.
- `npm run typecheck` nécessite d'avoir lancé `npm run dev` ou `npm run build`
  au moins une fois (types `LayoutProps` générés par Next dans `.next/types`).

### Prochaine étape (phase 2 — après validation)

- Création du projet Supabase Cloud par l'utilisateur (actions guidées).
- Migrations SQL complètes (~15 tables + RLS) dans `supabase/migrations/`.
- Clients Supabase (`@supabase/ssr`), page `/login` (inscription fermée),
  layout protégé `(app)`, CRUD manuel entreprises/projets/tâches.

## Phases suivantes

3. Pilotage (dashboard, vues tâches, temps, historique, cockpit entreprise) ·
4. Ressources et documents · 5. Rapports · 6. Assistant texte ·
7. Assistant vocal · 8. Finition (PWA, accessibilité, sécurité, déploiement).
