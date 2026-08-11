# MAW Pilot — Journal des décisions

Format : une décision par entrée, avec le contexte et la justification.
Seules les décisions structurantes sont notées.

## D-001 · Inscription publique fermée

**Date** : 2026-08-11 · **Statut** : validée par l'utilisateur.
L'application est privée : la page `/login` ne propose que la connexion.
Le compte unique est créé manuellement dans le dashboard Supabase.
L'architecture (RLS par `user_id`) reste prête pour du multi-comptes futur.

## D-002 · Supabase Cloud dès le développement

**Date** : 2026-08-11 · **Statut** : validée par l'utilisateur.
Un seul projet Supabase Cloud sert au développement puis à la production du
MVP. Plus simple pour un développeur débutant qu'une instance locale Docker.
Si le besoin d'un environnement de staging apparaît, un second projet gratuit
pourra être créé.

## D-003 · date-fns + @date-fns/tz

**Date** : 2026-08-11.
Bibliothèque de dates : `date-fns` v4 avec `@date-fns/tz` (support natif des
fuseaux, léger, maintenu, API en fonctions pures). Helpers centralisés dans
`src/lib/dates.ts` — locale `fr`, fuseau `Europe/Paris`, stockage UTC.

## D-004 · Composants shadcn/ui ajoutés manuellement

**Date** : 2026-08-11.
Le proxy de l'environnement de développement distant bloque `ui.shadcn.com`,
dont le CLI `shadcn` a besoin. Comme shadcn/ui est par conception une
collection de composants **copiés dans le projet**, les composants sont écrits
directement dans `src/components/ui/` avec leurs dépendances npm officielles
(`@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`,
`tw-animate-css`). Résultat identique à `npx shadcn add`. `components.json`
est présent pour permettre le CLI en local si besoin.

## D-005 · Polices Geist embarquées via le package npm `geist`

**Date** : 2026-08-11.
`next/font/google` télécharge les polices au moment du build, ce qui rend le
build dépendant du réseau (et échoue derrière un proxy restrictif). Le package
officiel `geist` embarque les fichiers de police : build reproductible et
hors-ligne, aucune requête vers Google Fonts côté visiteur.

## D-006 · Rappels de rapports calculés à l'affichage (pas de cron au MVP)

**Date** : 2026-08-11.
`report_schedules` définit les fréquences souhaitées ; le « rapport à
préparer » est calculé à l'ouverture de l'application (comparaison
date courante / planification), sans tâche planifiée serveur. Comportement
identique pour un usage mono-utilisateur, zéro infrastructure en plus.
Un vrai cron pourra être ajouté après le MVP si nécessaire.

## D-007 · Exécution transactionnelle des actions IA via fonction PostgreSQL

**Date** : 2026-08-11.
Les demandes IA pouvant produire plusieurs actions (« ajoute 3 tâches et
2 heures »), l'exécution confirmée passe par une fonction PostgreSQL côté
Supabase appelée par le serveur Next.js : tout réussit ou tout échoue,
puis l'ensemble est journalisé. Détail d'implémentation en phase 6.

## D-008 · Hébergement de production à décider en phase 8

**Date** : 2026-08-11 · **Statut** : demandé par l'utilisateur.
Le forfait Vercel Hobby n'est pas considéré comme définitif pour un usage
professionnel (limites et conditions d'usage commercial). Le choix final
(Vercel Pro ou alternative) sera fait en phase 8 avec l'utilisateur.

## D-009 · Énumérations PostgreSQL en slugs français sans accents

**Date** : 2026-08-11.
Les statuts, priorités, catégories, etc. sont des types `enum` PostgreSQL avec
des valeurs stables sans accents (`a_faire`, `terminee`, `supplementaire`…).
Les libellés affichés (avec accents et majuscules) sont définis dans le code de
l'interface. Avantage : intégrité garantie par la base, libellés modifiables
sans migration.

## D-010 · Historique immuable garanti par la base

**Date** : 2026-08-11.
`activity_logs` n'a aucune politique RLS `UPDATE` ni `DELETE` : même un bug
applicatif ne peut pas réécrire ou effacer l'historique. Les corrections
passent par une nouvelle entrée de journal.

## D-011 · Portail client = évolution post-MVP

**Date** : 2026-08-11 · **Statut** : discuté avec l'utilisateur.
Un tableau de bord consultable par chaque client (réalisations, en cours,
semaine, résultats, livrables, rapports) est souhaité à terme. L'architecture
actuelle (données par `company_id`, RLS) le permet sans réécriture. Décision :
terminer le MVP d'abord ; le portail devient une phase 9, avec curation
stricte de ce qui est exposé (jamais les notes internes, montants à facturer,
temps réels). Les résultats Search Console/Analytics commenceront par des
indicateurs saisis dans les rapports ; l'intégration des API Google est un
chantier séparé.

## D-012 · Mémoire de l'assistant : Supabase source de vérité

**Date** : 2026-08-11 · **Statut** : exigé par l'utilisateur.
L'API OpenAI n'est jamais la source principale de mémoire. Trois tables
locales : `ai_conversations` (globale ou par entreprise, résumé roulant),
`ai_messages` (historique utile), `company_memories` (faits durables par
entreprise avec catégorie, source `utilisateur`/`ia_confirmee`/`donnees` et
statut `confirmee`/`a_verifier`). `openai_conversation_id` est un simple cache
d'optimisation : sa perte est sans conséquence. Migration 3
(`20260811130000_ai_conversations_memories.sql`).

## D-013 · Contexte IA fenêtré (coûts et fiabilité)

**Date** : 2026-08-11 · **Statut** : exigé par l'utilisateur.
Chaque requête à l'assistant envoie : la consigne système, le résumé roulant
de la conversation, les N derniers messages et les données pertinentes
récupérées depuis Supabase via les fonctions de recherche — jamais
l'historique complet. Une supposition de l'IA ne devient jamais un souvenir
sans confirmation explicite (`save_company_memory` uniquement sur demande ou
confirmation).

## D-014 · Les souvenirs ne dupliquent jamais les données opérationnelles

**Date** : 2026-08-11 · **Statut** : exigé par l'utilisateur.
`company_memories` est réservée aux **consignes, préférences et informations
durables** (« toujours envoyer le rapport le vendredi avant 17h », « le
contact technique préfère les captures d'écran », « le site tourne sous
Shopify 2.0 »). Les tâches, temps passés, rapports et documents ne doivent
**jamais** y être recopiés : l'IA les lit dans leurs tables d'origine via les
fonctions de recherche. Raison : une copie diverge toujours de la source et
produit des réponses fausses avec assurance.

## D-015 · `store: false` côté OpenAI au MVP

**Date** : 2026-08-11 · **Statut** : exigé par l'utilisateur.
Les appels à la Responses API utilisent `store: false` : OpenAI ne conserve
rien. Le contexte est reconstruit à chaque requête depuis Supabase (résumé
roulant + derniers messages + données pertinentes).
`ai_conversations.openai_conversation_id` reste facultatif et ne doit jamais
être nécessaire au fonctionnement — il n'est qu'une optimisation éventuelle
pour plus tard.

## D-016 · Connecteurs externes : feuille de route post-MVP

**Date** : 2026-08-11 · **Statut** : accepté comme cap, hors périmètre MVP.
Extensions souhaitées, dans un ordre de valeur décroissant, chacune isolée
derrière son propre module (`src/lib/connectors/<service>/`) afin de ne jamais
alourdir le cœur de l'application :
1. **Search Console / Analytics 4** (lecture) → analyse de performance et
   création de tâches sur baisse détectée ;
2. **Notifications** (web push / PWA) → briefing du matin, relances ;
3. **Calendrier** (Google Calendar) → échéances et créneaux de travail ;
4. **Email** (préparation de brouillons, jamais d'envoi automatique) ;
5. **Organisation de documents** (rangement assisté des livrables).
Règles communes : OAuth par service et par entreprise, jetons chiffrés côté
serveur uniquement, lecture d'abord, **aucune action sortante sans
confirmation explicite de l'utilisateur** (même règle que WhatsApp).
Le MVP se contente d'indicateurs saisis manuellement dans les rapports.

## D-017 · Déclencheurs planifiés (« l'app a l'initiative, l'IA a l'intelligence »)

**Date** : 2026-08-11.
L'API OpenAI ne peut rien déclencher d'elle-même : elle n'existe qu'entre une
requête et sa réponse. La proactivité (briefing du matin, relance de saisie
du temps, brouillon de rapport hebdomadaire, détection des prestations non
facturées) vient donc de **déclencheurs applicatifs** — calculés à
l'ouverture de l'application au MVP (D-006), puis via tâches planifiées côté
hébergeur en extension. L'IA n'est appelée qu'au moment du déclenchement,
pour rédiger ou interpréter. Aucun message n'est jamais envoyé à un client
sans action de l'utilisateur.

