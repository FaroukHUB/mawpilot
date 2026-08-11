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

Le projet est **portable** : `output: standalone` et un `Dockerfile` permettent
de le déployer n'importe où sans modifier une ligne de code.

### Option A — Vercel (le plus simple)

1. Sur [vercel.com](https://vercel.com), **Add New → Project**, importer le
   dépôt GitHub.
2. Vercel détecte Next.js : ne rien changer aux réglages de build.
3. Dans **Settings → Environment Variables**, ajouter les variables du tableau
   ci-dessus (`OPENAI_API_KEY` en *Secret*).
4. Déployer, puis mettre `NEXT_PUBLIC_APP_URL` à l'URL réelle et redéployer.
5. Dans Supabase → **Authentication → URL Configuration**, ajouter l'URL de
   production dans *Site URL* et *Redirect URLs*.

> L'offre gratuite (Hobby) de Vercel est réservée à un usage non commercial :
> lire leur page « Fair Use » avant de choisir. Voir `docs/DECISIONS.md` (D-008).

### Option B — Docker (Cloudflare, Render, VPS, Coolify…)

Les variables `NEXT_PUBLIC_*` sont figées au moment du build ; les secrets sont
fournis à l'exécution.

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="..." \
  --build-arg NEXT_PUBLIC_APP_URL="https://mawpilot.exemple.fr" \
  -t mawpilot .

docker run -p 3000:3000 \
  -e OPENAI_API_KEY="sk-..." \
  -e OPENAI_TEXT_MODEL="..." \
  -e OPENAI_TRANSCRIPTION_MODEL="gpt-transcribe" \
  mawpilot
```

### Après le premier déploiement

- Appliquer toutes les migrations de `supabase/migrations/` (SQL Editor).
- Vérifier l'état de la base avec `supabase/checks/verify_schema.sql`.
- Renseigner le budget de l'assistant dans **Paramètres**.
- Installer l'application sur le téléphone : ouvrir l'URL, puis
  « Ajouter à l'écran d'accueil ».

## Sécurité

Voir `docs/SECURITY.md` — audit complet et points de vigilance.

## Documentation

- `CLAUDE.md` — règles durables du projet
- `docs/PROJECT_SPEC.md` — spécification fonctionnelle
- `docs/ARCHITECTURE.md` — architecture technique
- `docs/DECISIONS.md` — décisions et justifications
- `docs/PROGRESS.md` — avancement par phase
