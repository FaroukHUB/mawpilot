# MAW Pilot — Architecture technique

## Vue d'ensemble

Une seule application full-stack **Next.js (App Router)** déployée sur Vercel,
adossée à **Supabase** (PostgreSQL + Auth + Storage). Pas de backend séparé :

- **Server Actions** pour les mutations CRUD (entreprises, tâches, temps…) ;
- **Route Handlers** (`src/app/api/`) pour ce qui ne peut pas être une Server
  Action : upload audio, appels OpenAI, génération de fichiers (PDF/DOCX/XLSX).

```
Navigateur ── React (Server + Client Components)
    │
    ├─ Server Actions ──► validation Zod ──► Supabase (RLS) ──► activity_logs
    │
    └─ Route Handlers ──► OpenAI (interprétation, transcription)
                     └──► exports de fichiers ──► Supabase Storage (privé)
```

Le navigateur parle à Supabase uniquement avec la clé publique `anon`,
protégée par RLS. La clé OpenAI et toute logique sensible restent côté serveur.

## Arborescence cible

```
mawpilot/
├── CLAUDE.md, README.md, .env.example
├── docs/                      # SPEC, ARCHITECTURE, DECISIONS, PROGRESS
├── supabase/migrations/       # SQL versionné : schéma, RLS, storage (phase 2)
├── public/                    # manifest PWA, icônes (phase 8)
├── src/
│   ├── app/
│   │   ├── (auth)/login/      # connexion (inscription publique fermée)
│   │   ├── (app)/             # layout protégé : sidebar + navigation mobile
│   │   │   ├── dashboard/ entreprises/ entreprises/[id]/ taches/
│   │   │   ├── calendrier/ historique/ rapports/ documents/
│   │   │   └── ressources/ assistant/ parametres/
│   │   └── api/
│   │       ├── ai/interpret/  # texte → actions proposées (phase 6)
│   │       ├── ai/transcribe/ # audio → texte (phase 7)
│   │       └── exports/       # PDF, DOCX, CSV/XLSX (phase 5)
│   ├── components/
│   │   ├── ui/                # composants shadcn/ui copiés dans le projet
│   │   └── layout/ tasks/ companies/ reports/ resources/ assistant/
│   ├── lib/
│   │   ├── supabase/          # clients navigateur + serveur (@supabase/ssr)
│   │   ├── validations/       # schémas Zod partagés
│   │   ├── ai/                # définitions des fonctions IA + exécuteur
│   │   ├── reports/           # assemblage déterministe des rapports
│   │   ├── whatsapp/          # liens wa.me, partage natif
│   │   ├── dates.ts           # date-fns fr-FR / Europe/Paris
│   │   └── utils.ts           # cn() et utilitaires
│   ├── actions/               # Server Actions par domaine
│   └── types/                 # types partagés (générés Supabase + métier)
└── tests/                     # unitaires + parcours principal
```

Les dossiers sont créés au moment où ils reçoivent du contenu (pas de
squelette vide) ; ce document décrit la cible.

## Choix structurants

- **Groupes de routes** : `(auth)` public, `(app)` protégé par vérification de
  session dans le layout — un seul endroit qui garde toutes les pages privées.
- **Validation** : chaque Server Action / Route Handler valide ses entrées avec
  un schéma Zod de `src/lib/validations/`, puis vérifie l'appartenance
  (`user_id`) avant toute écriture. La RLS est le filet de sécurité de second
  niveau, pas le seul contrôle.
- **Historique** : les mutations importantes écrivent dans `activity_logs` via
  une fonction commune, avec description humaine en français et données
  avant/après en JSONB.
- **Actions IA** : l'IA produit des appels de fonctions (function calling) ;
  chaque fonction a un schéma Zod et un exécuteur serveur. Les actions
  multiples d'une même demande s'exécutent dans une transaction PostgreSQL
  (fonction SQL côté Supabase) : tout réussit ou tout échoue.
- **Rapports** : l'assemblage des faits (tâches, temps, livrables de la
  période) est du code déterministe et testé ; l'IA n'intervient que pour la
  rédaction de la synthèse, jamais pour produire des faits.
- **Fuseau et locale** : helpers uniques dans `src/lib/dates.ts`
  (`Europe/Paris`, `fr`). Stockage en UTC (`timestamptz`), affichage converti.

## Contraintes d'environnement de développement

- Le proxy réseau de l'environnement distant bloque `ui.shadcn.com` : le CLI
  shadcn ne fonctionne pas ici. Les composants sont ajoutés manuellement dans
  `src/components/ui/` (fonctionnement normal de shadcn : le composant vit
  dans le projet). `components.json` est conservé pour un usage local futur.
- Polices Geist via le package npm `geist` (fichiers embarqués) : le build ne
  dépend pas de Google Fonts.
