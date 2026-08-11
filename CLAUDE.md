# MAW Pilot — Règles durables du projet

Application web privée de pilotage d'activité freelance multi-entreprises.
Mono-utilisateur au MVP, architecturée pour évoluer vers du multi-utilisateurs.

## Documents de référence

- `docs/PROJECT_SPEC.md` — périmètre fonctionnel et modèle de données.
- `docs/ARCHITECTURE.md` — architecture technique et arborescence.
- `docs/DECISIONS.md` — décisions importantes et leurs justifications.
- `docs/PROGRESS.md` — état d'avancement par phase (à mettre à jour après chaque phase).

## Stack imposée

Next.js (App Router) + TypeScript strict + Tailwind CSS v4 + shadcn/ui +
Lucide React + Supabase (PostgreSQL, Auth, Storage) + Zod + React Hook Form +
date-fns (`fr-FR`, fuseau `Europe/Paris`) + Recharts (graphiques uniquement).
Pas de backend séparé : Server Actions et Route Handlers uniquement.
IA intégrée : API OpenAI côté serveur (Responses API + function calling,
transcription). Jamais l'ancienne Assistants API.

## Règles non négociables

- **Langue** : interface entièrement en français. Dates en `fr-FR`, fuseau `Europe/Paris`.
- **Sécurité** :
  - aucune clé secrète dans le code, le dépôt, ou une variable `NEXT_PUBLIC_*` ;
  - `OPENAI_API_KEY` uniquement côté serveur ;
  - RLS activée sur toutes les tables métier, `user_id` vérifié dans chaque lecture/mutation serveur ;
  - toutes les entrées validées avec Zod côté serveur ;
  - jamais de mot de passe, clé API ou secret client stocké en base (`company_resources` = liens et infos non sensibles uniquement) ;
  - fichiers dans un bucket Supabase Storage privé, URL signées à durée limitée ;
  - clé `service_role` jamais côté navigateur.
- **Données** :
  - migrations SQL versionnées dans `supabase/migrations`, jamais modifiées après application — toute évolution passe par une nouvelle migration ;
  - suppression métier = archivage de préférence ; suppression définitive = confirmation explicite ;
  - l'historique (`activity_logs`) ne disparaît jamais lors d'une modification.
- **IA** :
  - l'IA n'a jamais d'accès SQL direct : elle choisit parmi des fonctions dont les arguments sont validés avec Zod ;
  - toute action proposée par l'IA est prévisualisée et confirmée par l'utilisateur avant exécution ;
  - en cas d'ambiguïté (entreprise, tâche), l'IA demande une précision, jamais de choix silencieux ;
  - les rapports n'inventent jamais un fait : données enregistrées et synthèse IA clairement distinguées.
- **WhatsApp** : partage assisté manuel uniquement au MVP (lien `wa.me` pour un numéro
  international validé, feuille de partage native, copier-coller). Jamais d'envoi
  automatique, jamais de rapport marqué « envoyé » sans confirmation de l'utilisateur.
- **Qualité** : `npm run lint`, `npm run typecheck`, tests et `npm run build`
  doivent passer à la fin de chaque phase. Pas d'API dépréciée, pas de package non maintenu.
- **Méthode** : travail par phases (voir `docs/PROGRESS.md`) ; validation de
  l'utilisateur requise entre les phases ; jamais d'action destructive sans confirmation.

## Contraintes d'environnement connues

- L'environnement distant de développement bloque `ui.shadcn.com` : les composants
  shadcn/ui sont écrits directement dans `src/components/ui/` (ce qui est le
  fonctionnement normal de shadcn — composants copiés dans le projet).
- Polices Geist via le package npm `geist` (embarquées localement, pas de
  téléchargement Google Fonts au build).
