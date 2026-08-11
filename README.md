# MAW Pilot

Application web privée de pilotage d'activité freelance multi-entreprises :
entreprises clientes, projets, tâches, temps passé, facturation des prestations,
historique, rapports hebdomadaires/mensuels, documents, accès rapides et
assistant IA texte + voix en français.

Application mono-utilisateur (usage personnel), non indexée, protégée par
authentification. Voir `docs/PROJECT_SPEC.md` pour le périmètre complet.

## Stack

- [Next.js](https://nextjs.org) (App Router) · TypeScript strict
- Tailwind CSS v4 · shadcn/ui · Lucide React
- Supabase (PostgreSQL, Auth, Storage) — RLS activée partout
- Zod · React Hook Form · date-fns (`fr-FR`, `Europe/Paris`) · Recharts
- API OpenAI côté serveur (interprétation + transcription vocale)

## Installation locale

Prérequis : Node.js ≥ 20 (testé avec 22), npm.

```bash
git clone https://github.com/faroukhub/mawpilot.git
cd mawpilot
npm install
cp .env.example .env.local
# Remplir .env.local (voir ci-dessous), puis :
npm run dev
```

L'application est disponible sur <http://localhost:3000>.

### Variables d'environnement (`.env.local`)

| Variable | Rôle | Où la trouver |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique « anon » | Supabase → Settings → API |
| `OPENAI_API_KEY` | Clé API OpenAI (serveur uniquement) | platform.openai.com → API keys |
| `OPENAI_TEXT_MODEL` | Modèle texte pour l'assistant | doc OpenAI |
| `OPENAI_TRANSCRIPTION_MODEL` | Modèle de transcription (`gpt-transcribe` par défaut) | doc OpenAI |
| `NEXT_PUBLIC_APP_URL` | URL publique de l'application | `http://localhost:3000` en local |

Ne jamais commiter `.env.local` ni écrire une clé réelle où que ce soit dans le dépôt.

## Commandes

```bash
npm run dev        # serveur de développement
npm run lint       # ESLint
npm run typecheck  # vérification TypeScript
npm run build      # build de production
npm start          # serveur de production local
```

## Base de données

Les migrations SQL versionnées vivent dans `supabase/migrations/` (à partir de la
phase 2). Elles s'appliquent sur le projet Supabase Cloud via le SQL Editor ou la
CLI Supabase.

## Déploiement

Cible prévue : Vercel (import du dépôt GitHub, variables d'environnement à
recopier dans les réglages du projet). Le choix du forfait définitif pour un
usage professionnel sera fait en phase 8 — voir `docs/DECISIONS.md`.

## Documentation

- `CLAUDE.md` — règles durables du projet
- `docs/PROJECT_SPEC.md` — spécification fonctionnelle
- `docs/ARCHITECTURE.md` — architecture technique
- `docs/DECISIONS.md` — décisions et justifications
- `docs/PROGRESS.md` — avancement par phase
