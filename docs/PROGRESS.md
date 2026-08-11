# MAW Pilot — Avancement

> État utile pour reprendre le travail. Mis à jour à la fin de chaque phase.

## Phase actuelle : 4 terminée — phase 5 (rapports) à suivre

## Phase 4 · Ressources et documents — ✅ terminée (2026-08-11)

### Réalisé

- **Contacts** par entreprise : coordonnées, rôle, numéro WhatsApp validé au
  format international, canal préféré, archivage.
- **Destinations de communication** (`company_channels`) : WhatsApp direct
  (numéro international obligatoire), groupe WhatsApp (nom obligatoire, avec
  avertissement explicite qu'aucun ciblage automatique n'est possible), email,
  autre ; canal par défaut unique par entreprise (garanti en base et côté
  serveur) ; bouton d'ouverture WhatsApp pour les numéros valides.
- **Centre d'accès rapides** : 24 catégories regroupées en 4 familles,
  recherche, favoris, réordonnancement (haut/bas), archivage, ouverture en
  nouvel onglet (`rel="noopener noreferrer"`), marquage « vérifié ».
  Page globale `/ressources` avec sélecteur d'entreprise + onglet dans le
  cockpit.
- **Refus des secrets en base** : les champs description, notes d'accès et
  identifiant rejettent tout ce qui ressemble à un mot de passe, une clé API,
  un jeton ou un code de récupération (validation Zod + avertissement visible).
- **Documents** : téléversement dans le bucket privé `documents`
  (chemin `<user_id>/<company_id>/<horodatage>-<nom nettoyé>`), liens externes,
  archivage, suppression définitive avec confirmation, consultation par **URL
  signée valable 5 minutes**. Limites : 25 Mo, liste blanche de types MIME.
  Page globale `/documents` + onglet dans le cockpit.
- **Migration 4** : politiques RLS sur `storage.objects` (chaque utilisateur
  n'accède qu'à son propre dossier) + création du bucket privé en filet de
  sécurité.
- **Tests** : 44 au total (26 nouveaux) — liens WhatsApp déterministes,
  validation des numéros internationaux, règles des canaux, refus des secrets,
  limites d'upload, nettoyage des noms de fichiers (dont tentative de remontée
  de dossier).

### Vérifications

- `lint` ✅ · `typecheck` ✅ · `test` ✅ (44/44) · `build` ✅.
- Trois bugs réels trouvés et corrigés grâce aux tests : intersection Zod qui
  rendait les champs facultatifs obligatoires, `..` conservé dans les noms de
  fichiers, et test d'accents mal écrit.

### Problèmes connus

- Toujours aucun test en conditions réelles contre Supabase (réseau bloqué
  ici). À faire au premier lancement local.
- Migrations 3 et 4 à appliquer par l'utilisateur dans le SQL Editor.

## Phase 3 · Pilotage — ✅ terminée (2026-08-11)

### Réalisé

- **Dashboard réel** : compteurs (à faire, urgentes, en retard, attente client,
  terminées et temps du mois), échéances du jour/de la semaine, charge par
  entreprise (temps + tâches ouvertes), prestations à facturer avec total,
  activité récente. Chaque compteur est cliquable vers la vue filtrée.
- **Temps passé** : action `logTime` (validée Zod, vérification
  d'appartenance), dialogue de saisie avec raccourcis 15 min/30 min/1 h/2 h,
  bouton horloge sur chaque tâche, mise à jour du cumul `actual_minutes`.
- **Vues tâches** : liste + Kanban (colonnes par statut, sans glisser-déposer
  au MVP), filtres combinables par entreprise, projet, statut, priorité,
  catégorie, facturation et période (retard/aujourd'hui/semaine/mois) via URL.
- **Calendrier mensuel** : grille avec navigation mois précédent/suivant,
  tâches à leur échéance, style urgence/terminée/retard.
- **Historique** : page dédiée groupée par jour (fuseau Europe/Paris), icône
  manuelle/IA, pastille entreprise.
- **Cockpit entreprise** : 7 onglets (Vue d'ensemble, Projets & tâches,
  Rapports, Contacts & WhatsApp, Documents, Accès rapides, Historique) —
  les onglets des phases 4/5 affichent un état « bientôt disponible ».
  Boutons rapides : tâche, temps, modifier, archiver.
- **Paramètres** : édition du profil (nom, fuseau).
- **Tests** : Vitest configuré, 18 tests (formats de dates FR/fuseau,
  validations entreprise/tâche/temps). Un test a révélé et corrigé un vrai
  bug : montant vide converti en 0 au lieu de null.

### Vérifications

- `lint` ✅ · `typecheck` ✅ · `test` ✅ (18/18) · `build` ✅.

### Problèmes connus

- Toujours aucun test en conditions réelles contre Supabase (réseau bloqué
  dans l'environnement distant, l'utilisateur a choisi d'avancer sans tester).
- Kanban sans glisser-déposer (changement de statut via la carte) — décision
  MVP, à réévaluer après le MVP.

## Phase 2 · Données et authentification — ✅ terminée (2026-08-11)

### Réalisé

- Projet Supabase Cloud créé par l'utilisateur (région Paris), migrations
  appliquées via le SQL Editor : 15 tables + enums + triggers + index + RLS.
- Compte utilisateur unique créé, inscription publique désactivée (D-001).
- `.env.local` configuré (URL + clé publiable) — jamais commité.
- Clients Supabase (`src/lib/supabase/`) : navigateur, serveur, proxy de
  session (`src/proxy.ts`) avec redirection vers /login.
- Page `/login` (connexion seule), action serveur validée Zod, layout protégé
  `(app)` avec sidebar desktop + navigation mobile provisoire.
- CRUD manuel : entreprises (création, édition, archivage), projets, tâches
  (création, édition, changement de statut rapide, terminer/reprendre).
- Journalisation `activity_logs` sur toutes les mutations, avec description
  française et données avant/après.
- Pages provisoires pour calendrier, historique, rapports, documents,
  ressources, assistant et paramètres (plus de 404).

### Vérifications

- `lint` ✅ (0 erreur, 0 avertissement) · `typecheck` ✅ · `build` ✅.

### Problèmes connus

- **Aucun test en conditions réelles** : l'utilisateur a choisi d'avancer sans
  tester la connexion. Le proxy réseau de l'environnement distant bloque
  `supabase.co`, donc rien n'a été vérifié contre la vraie base. À tester dès
  que possible (localement via `npm run dev` ou en autorisant le domaine).
- Pas encore de tests automatisés (prévus avec la logique métier des phases
  suivantes).

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
