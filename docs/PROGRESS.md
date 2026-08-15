# MAW Pilot — Avancement

> État utile pour reprendre le travail. Mis à jour à la fin de chaque phase.

## État : MVP déployé ✅ — recadrage voice-first en cours

Le produit est recadré : **MAW Pilot est un assistant opérationnel vocal**,
les écrans servant à consulter ce que la dictée a rempli. L'audit de la
version déployée a donné 5 priorités ; voici leur avancement.

| # | Priorité | État |
|---|---|---|
| 1 | Corriger la mémoire IA | ✅ livré |
| 2 | Interface voice-first | ✅ livré |
| 3 | Rappels, automatisations, notifications | ✅ livré |
| 4 | Cohérence des données (contact principal…) | ✅ livré |
| 5 | Configuration des rapports + XLSX | ✅ livré |
| 6 | **Portail client** (lien privé, demandes, IA) | ✅ livré |

### Priorité 5 — configuration des rapports et XLSX (2026-08-12)

**Configuration par entreprise** (onglet Rapports du cockpit) : fréquence
hebdomadaire ou mensuelle, jour, heure, destination habituelle, format
préféré et sections incluses. `report_schedules` porte le QUOI ;
`automation_rules` porte le QUAND — enregistrer la configuration synchronise
automatiquement la règle, pour n'avoir **qu'un seul chemin de planification**.

Le worker lit désormais cette configuration : période mensuelle si demandée,
sections retenues appliquées au brouillon.

**Export XLSX** : trois feuilles (Synthèse, Détail, Temps), en-têtes mis en
forme, largeurs de colonnes, et **montants et durées exportés comme nombres**
— le destinataire peut calculer dessus. Bibliothèque `write-excel-file` v4
(maintenue, aucune vulnérabilité), retenue après le retrait d'`exceljs`.

**Migration** : 12 (`default_format` + unicité par entreprise).
**Tests** : 5 nouveaux (structure ZIP valide, trois feuilles, rapport vide,
déterminisme). 197 au total.

> Note de fabrication : le test `server-boundaries` écrit à la priorité 1 a
> attrapé une récidive du bug d'origine — `report-schedules.ts` (`"use server"`)
> exportait `REPORT_FORMATS`. Constantes déplacées dans
> `src/lib/reports/formats.ts`. Le garde-fou a fonctionné avant déploiement.

### Portail client (2026-08-12)

**Accès** (D-024) : lien privé par contact, sans compte. Jeton haché SHA-256,
expirable, révocable, avec compteur d'ouvertures. Le lien complet n'est
affiché qu'une fois, à la création.

**Ce que le client voit** : en attente de son retour (mis en avant), en cours,
à venir, réalisé, résultats, livrables partagés, comptes rendus partagés.
**Jamais** : temps passé, montants, facturation, priorités, notes internes,
mémoire IA, historique, accès rapides, autres entreprises.

**Point d'audit unique** (D-025) : `src/lib/client-portal/data.ts`, marqué
`server-only`. Documents masqués par défaut, tâches masquables une par une,
rapports visibles seulement au statut « partagé ».

**Demandes** : le client écrit ou dicte. L'assistant accuse réception, classe
(incluse / supplémentaire / question) contre la charte de l'entreprise, et
répond avec **les phrases exactes de l'utilisateur** quand c'est hors forfait
ou hors quota. Notification immédiate au propriétaire, email forcé pour les
dépassements.

**Sécurité de l'IA** (D-026) : **aucun outil** donné au modèle du portail —
il ne peut pas aller chercher ce qu'on ne lui a pas donné. Message du client
délimité, sortie contrainte par schéma, phrases de refus figées.

**Engagement de date** (D-027) : jamais par l'IA. Seule l'action
`acceptClientRequest` du propriétaire renseigne une date, crée la tâche et
envoie la réponse.

**Charte configurable par entreprise** : prestations incluses, hors forfait,
quota mensuel, phrases de refus, ton, sections visibles, réponse IA activable,
dictée activable.

**Fichiers** : `lib/client-portal/{tokens,data,assistant}.ts`,
`app/client/[token]`, `app/api/client/transcribe`, `app/(app)/demandes`,
`actions/client-{portal,access}.ts`, `components/client-portal/*`.
**Migration** : 11.

**Tests** : 26 nouveaux — jetons (falsification, préfixe seul, format
invalide), confidentialité par analyse du code source (tables et colonnes
interdites), protection anti-injection, interdiction d'engagement de date.
192 au total. Vérifiés comme échouant sur une fuite volontairement
réintroduite.

### Priorité 3 — rappels, automatisations et notifications (2026-08-11)

**Planificateur** (D-021) : `pg_cron` dans Supabase appelle `/api/cron/tick`
toutes les 5 minutes via `pg_net`. Fonctionne **application fermée** et
indépendamment de Vercel (dont l'offre gratuite limite le cron à un
déclenchement par jour). Secrets stockés dans **Supabase Vault**, route
authentifiée par comparaison à temps constant.

**Idempotence** : contrainte d'unicité sur
`automation_runs (source_type, source_id, occurrence_key)`. Un double
déclenchement ne produit jamais deux notifications.

**Notifications** (D-022) : trace interne → **push PWA** → **email de secours
seulement si aucun appareil n'a été atteint**. Abonnements expirés supprimés
automatiquement.

**Automatisations disponibles** : briefing du matin, compte rendu du soir,
préparation du brouillon de rapport hebdomadaire (avec notification « rapport
prêt »), relance quand un client ne répond pas depuis N jours, alerte de temps
non saisi. Aucune n'envoie quoi que ce soit à un client.

**Par la voix** : `create_reminder` et `create_automation_rule` ajoutées au
catalogue IA et à `execute_ai_actions` (migration 10) — « rappelle-moi vendredi
à 15 h » et « chaque vendredi prépare le rapport de Trust » fonctionnent.
Le calcul d'échéance reste côté application (fonctions pures testées).

**Fichiers** : `lib/automations/{schedule,worker}.ts`,
`lib/notifications/{push,email,dispatch}.ts`, `lib/supabase/admin.ts`,
`app/api/cron/tick`, `app/api/push/subscribe`, `app/(app)/rappels`,
`components/notifications/*`, `actions/reminders.ts`.
**Migrations** : 8 (tables), 9 (pg_cron + Vault), 10 (actions IA).

**Tests** : 23 nouveaux sur la planification — occurrences hebdomadaires et
mensuelles, dernier jour du mois, changement d'heure, tolérance au retard du
planificateur, stabilité des clés d'idempotence. 166 au total.

### Priorité 4 — cohérence des données (2026-08-11)

À la création **et** à la modification d'une entreprise, l'application crée
maintenant, s'ils sont absents : le **contact principal** (dans
`company_contacts`) et l'**accès rapide du site** (dans `company_resources`).
Synchronisation **additive et idempotente** : jamais de doublon, jamais
d'écrasement. Même logique dans `execute_ai_actions` pour les créations
dictées. Une action `syncAllCompaniesConsistency` rattrape les entreprises
déjà créées (cas Mobilier Malin / Jamel).

### Priorité 1 — mémoire IA corrigée (2026-08-11)

**Cause réelle** : `src/actions/memories.ts` porte `"use server"` et exportait
`MEMORY_CATEGORIES` (tableau) et `memoryCategoryLabels` (objet). Next.js
remplace tout export d'un module serveur par une référence d'appel distant,
c'est-à-dire une **fonction** : le navigateur recevait donc une fonction au
lieu d'un tableau, d'où `u.map is not a function`. Ce n'était **pas** un
problème de migration — `company_memories` était bien présente avec sa RLS.

**Correctif** : constantes déplacées dans `src/lib/memories.ts` (module
neutre), états vide et erreur explicites, garde `Array.isArray`, libellés
tolérants aux valeurs inconnues.

**Non-régression** : `tests/server-boundaries.test.ts` analyse tout le projet
et échoue si un module `"use server"` exporte autre chose qu'une fonction, ou
si un composant client importe une constante depuis `@/actions`. Vérifié comme
échouant quand le bug est volontairement réintroduit.

### Priorité 2 — interface voice-first (2026-08-11)

- **Bouton « Parler à MAW »** flottant sur toutes les pages (au-dessus de la
  barre mobile, en bas à droite sur ordinateur), raccourci `Ctrl/Cmd + K`.
- **Accroche sur le tableau de bord** avec exemples réels cliquables.
- **Parcours complet en une feuille** : dicter → corriger → analyser →
  prévisualiser → confirmer → résumé de ce qui a été enregistré.
- **Extraction multi-actions** : la consigne système impose d'extraire toutes
  les actions d'une dictée en un seul tour, et de chercher les tâches
  existantes avant d'en créer.
- **Plus de questions inutiles** : seuls l'entreprise + titre (tâche),
  l'entreprise + durée (temps), le nom (entreprise) et libellé + URL (accès)
  sont obligatoires. Tout le reste est omis et proposé immédiatement.
- Conversation globale réutilisée (`getOrCreateGlobalConversation`) plutôt
  qu'une nouvelle conversation à chaque ouverture.

**Tests** : `tests/ai-dictation.test.ts` couvre les scénarios 1, 4 et 5 de
l'audit, la recherche avant création, l'absence d'exécution avant
confirmation et le cumul des coûts. 143 tests au total.

### Exigences notées pour la priorité 3

- Notification **push PWA** avec **email de secours** — un centre de
  notifications interne ne suffit pas : il faut être prévenu application
  fermée.
- Secrets du Cron stockés dans **Supabase Vault**.
- Déclencheur serveur : `pg_cron` + `pg_net` (Vercel Cron limité à un
  déclenchement par jour sur l'offre gratuite), exécution idempotente.

## Historique du MVP

**Production** : <https://mawpilot-rose.vercel.app> (Vercel, branche
`claude/maw-pilot-architecture-mvp-0q0sb9`, déploiement automatique à chaque
push).

Les 8 phases sont terminées. Le parcours principal a été vérifié par
l'utilisateur sur l'application déployée le 2026-08-11 : connexion, création
d'entreprise, création de tâche, saisie de temps, assistant texte, dictée
vocale et génération de rapport.

> **Les réserves « aucun test en conditions réelles » mentionnées dans les
> phases 2 à 8 sont donc levées.** Elles venaient du fait que l'environnement
> de développement distant bloquait l'accès réseau à Supabase et à OpenAI ;
> les vérifications y étaient statiques (lint, typecheck, 124 tests, build).

### Correctif post-déploiement

- `output: "standalone"` faisait échouer le build Vercel à l'étape
  `onBuildComplete` : Vercel construit Next.js nativement et n'attend pas ce
  format. Le mode est désormais conditionnel (`process.env.VERCEL`), ce qui
  préserve le déploiement Docker portable. Vérifié dans les deux sens.

### À faire par l'utilisateur

1. **Paramètres → Budget de l'assistant** : saisir le crédit OpenAI rechargé
   et recopier les tarifs réels de `gpt-5-mini` (les valeurs par défaut
   correspondent à un modèle plus cher : le compteur surestime tant qu'elles
   ne sont pas ajustées).
2. Installer l'application sur le téléphone (« Ajouter à l'écran d'accueil »).
3. Utiliser l'outil quelques semaines avant d'ajouter des fonctionnalités.

## Phase 8 · Finition — ✅ terminée (2026-08-11)

## Phase 8 · Finition — ✅ terminée (2026-08-11)

### Réalisé

- **PWA installable** : `manifest.webmanifest` (raccourcis Assistant, Tâches,
  Rapports), icônes 192/512/maskable/apple-touch **générées hors ligne** par
  `scripts/generate-icons.mjs` (encodeur PNG maison — aucune dépendance, le
  réseau étant bloqué), service worker minimal qui ne met en cache **que** les
  icônes et le manifest (jamais de page authentifiée : ce serait une fuite de
  données sur un appareil partagé).
- **Navigation mobile repensée** : barre inférieure à 4 onglets (Accueil,
  Tâches, **Assistant en évidence avec l'icône micro**, Clients) + menu complet
  dépliable dans l'en-tête, avec déconnexion.
- **Accessibilité** : lien « Aller au contenu principal », zoom jamais bloqué
  (`maximumScale: 5`), `aria-current` sur la navigation, `aria-label` sur tous
  les boutons icônes, rôles `status`/`alert`, focus visible partout.
- **Robustesse** : page d'erreur avec reprise, squelettes de chargement, page
  404 en français.
- **En-têtes de sécurité HTTP** dans `next.config.ts` (nosniff, DENY iframe,
  Referrer-Policy, Permissions-Policy micro uniquement, HSTS).
- **Déploiement portable** (D-008) : `output: standalone` + `Dockerfile`
  multi-étapes (utilisateur non root, secrets fournis à l'exécution) +
  `.dockerignore`. README documentant Vercel **et** Docker.
- **Audit de sécurité complet** documenté dans `docs/SECURITY.md` : 20
  contrôles, tous au vert (35/35 mutations filtrées sur `user_id`, 13/13
  modules validés Zod, 2/2 routes API authentifiées, aucun secret dans le
  dépôt, aucun `dangerouslySetInnerHTML`, pas de redirection ouverte).

### Vérifications

- `lint` ✅ · `typecheck` ✅ · `test` ✅ (124/124) · `build` ✅ ·
  build `standalone` produit et vérifié.

### Reste à faire (par l'utilisateur)

1. Appliquer les migrations 5, 6 et 7 si ce n'est pas fait.
2. Renseigner `OPENAI_API_KEY` dans `.env.local`.
3. **Premier essai réel en local** (`npm run dev`) : c'est la seule chose qui
   n'a jamais pu être testée ici (réseau bloqué vers Supabase et OpenAI).
4. Choisir l'hébergeur et déployer (README, section Déploiement).

## Phase 7 · Assistant vocal — ✅ terminée (2026-08-11)

### Réalisé

- **Chaîne vocale complète** : bouton micro → `MediaRecorder` → route serveur
  `/api/ai/transcribe` → transcription OpenAI → **texte affiché dans le champ
  pour correction** → envoi au même moteur d'interprétation que le texte →
  prévisualisation → confirmation → exécution transactionnelle → journal.
  **Aucune action n'est jamais déclenchée directement par la voix.**
- **Bouton micro identifiable** : libellé explicite, minuteur pendant
  l'enregistrement, pastille rouge clignotante, `aria-label` et `aria-pressed`,
  arrêt automatique à 5 minutes.
- **Sécurité de l'audio** : liste blanche de types MIME (normalisés car
  `MediaRecorder` ajoute un suffixe de codec), 10 Mo et 5 minutes maximum,
  vérification d'authentification, limitation anti-abus partagée avec le texte.
- **Dictée des rapports** : bloc dédié dans l'éditeur — la transcription brute
  est conservée (`raw_dictation`, empilée), la version corrigée est éditable
  puis insérée dans la section choisie (`corrected_transcription`). L'IA
  n'ajoute aucun fait.
- **Coût de la dictée** : migration 7 (tarif à la minute d'audio, modifiable),
  chaque transcription tracée dans `ai_requests` et comptée dans le budget ;
  refus si le crédit déclaré est épuisé.
- Messages d'erreur explicites : micro refusé, navigateur incompatible,
  enregistrement trop court, rien compris.

### Vérifications

- `lint` ✅ · `typecheck` ✅ · `test` ✅ (124/124, dont 14 nouveaux sur la
  validation audio et le coût de transcription) · `build` ✅.

### Problèmes connus

- Migration 7 à appliquer par l'utilisateur.
- Le parcours vocal n'a pas pu être testé en conditions réelles ici (ni micro,
  ni accès réseau à OpenAI dans l'environnement distant) : à valider au
  premier essai local.

## Phase 6 · Assistant texte — ✅ terminée (2026-08-11)

### Réalisé

- **Migration 5** : fonction PostgreSQL `execute_ai_actions` — exécution
  transactionnelle des actions confirmées (D-007). Tout réussit ou tout est
  annulé ; chaque action est journalisée. **Pas `security definer`** : la RLS
  s'applique, et l'appartenance est vérifiée explicitement pour chaque
  identifiant.
- **Catalogue de fonctions** (`src/lib/ai/functions.ts`) : 9 fonctions de
  lecture + 10 d'écriture, chacune avec son schéma Zod converti en JSON Schema
  pour la Responses API. L'IA ne peut rien faire d'autre.
- **Moteur d'interprétation** (`src/lib/ai/interpret.ts`), indépendant
  d'OpenAI donc testable : les lectures s'exécutent et alimentent le modèle ;
  les écritures s'arrêtent en **propositions à confirmer**. Garde-fou de 4
  allers-retours maximum.
- **Responses API** avec `store: false` (D-015) ; jamais l'Assistants API.
  Modèles configurables par variables d'environnement.
- **Contexte fenêtré** (D-013) : consigne système (date du jour en
  Europe/Paris, entreprises et leurs identifiants, consignes durables) +
  résumé roulant + 12 derniers messages. Jamais l'historique complet.
- **Conversations** : une générale (multi-entreprises) et autant que voulu
  par entreprise, avec résumé roulant maintenu localement.
- **Mémoire** : onglet « Mémoire IA » dans le cockpit — ajouter, confirmer,
  archiver, supprimer. Distinction visible de la source (vous / assistant
  confirmé / déduit) et du statut (confirmée / à vérifier).
- **Anti-abus** : limite de 12 requêtes/minute et 120/heure, comptées en base.
- **Interface** : chat avec exemples cliquables, prévisualisation des actions
  proposées, confirmation ou annulation, messages système récapitulant ce qui
  a réellement été exécuté.

### Vérifications

- `lint` ✅ · `typecheck` ✅ · `test` ✅ (93/93, dont 26 nouveaux sur l'IA avec
  réponses de modèle simulées) · `build` ✅.
- Les tests couvrent : séparation lecture/écriture, refus des fonctions
  inventées, refus des arguments invalides (UUID, énumérations, durées
  négatives, URL), JSON illisible, boucle bornée, actions multiples, et
  contenu de la consigne système.

### Compteur de coût IA (ajout demandé en cours de phase)

- **Migration 6** : jetons et coût par demande dans `ai_requests`
  (`model`, `input_tokens`, `cached_input_tokens`, `output_tokens`,
  `cost_usd`) + table `ai_budget` (crédit déclaré, date de rechargement,
  seuil d'alerte, tarifs modifiables).
- Coût **mesuré réellement** à partir des jetons retournés par l'API, cumulé
  sur tous les allers-retours d'une même demande.
- Affichage : coût de la dernière demande et consommation du mois dans le
  chat ; compteur complet (mois, depuis rechargement, crédit, restant estimé,
  barre de progression) en haut de `/assistant` ; détail des 10 dernières
  demandes et réglages dans `/parametres`.
- **Alerte à 2 $ restants** (seuil configurable) et **mise en pause de
  l'assistant** si le crédit estimé atteint zéro.
- Limite assumée et affichée : l'API OpenAI n'expose pas le solde du compte,
  le « restant » est donc une estimation fondée sur le crédit déclaré (D-020).
- 17 tests dédiés au calcul de coût, aux seuils d'alerte et au formatage.

### Problèmes connus

- Migrations 5 et 6 à appliquer par l'utilisateur dans le SQL Editor.
- Les tarifs par défaut doivent être vérifiés sur la page Tarifs d'OpenAI et
  ajustés dans les réglages : ils évoluent régulièrement.
- `OPENAI_API_KEY` à renseigner dans `.env.local` pour utiliser l'assistant
  (l'interface l'indique clairement si elle est absente).
- Toujours aucun test en conditions réelles (réseau bloqué dans
  l'environnement de développement distant).

## Phase 5 · Rapports — ✅ terminée (2026-08-11)

### Réalisé

- **Collecte déterministe des faits** (`src/lib/reports/collect.ts`) :
  fonction pure et testée qui rassemble tâches terminées, en cours, bloquées,
  en attente client, échéances à venir, temps passé (dont facturable),
  livrables et prestations à facturer sur la période. **N'invente jamais un
  fait.**
- **Faits figés à la génération** dans `reports.source_data` (D-019) : un
  rapport partagé reste le reflet exact de ce qui a été communiqué.
- **Éditeur de rapport** : 10 sections cochables, chacune affichant d'abord
  les **données enregistrées** (encadré gris « Données enregistrées ») puis un
  champ de commentaire libre — la distinction faits / rédaction est visible à
  l'écran, comme exigé.
- **Indicateurs saisis** (Search Console, Analytics…) et **liens ajoutés**,
  éditables à la volée.
- **Message WhatsApp** court, formaté (gras WhatsApp), modifiable et
  régénérable depuis les faits.
- **Exports** : DOCX (bibliothèque `docx`, avec tableau récapitulatif), CSV
  (séparateur `;` + BOM UTF-8 pour Excel français), PDF par page imprimable
  dédiée (D-018).
- **Partage assisté manuel** : choix de la destination enregistrée, lien
  `wa.me` prérempli pour un numéro valide, partage natif quand le navigateur
  le permet, copie du message, repli WhatsApp Web. Avertissement explicite
  pour les groupes. Chaque préparation est journalisée ; **le rapport n'est
  marqué « partagé » qu'après confirmation manuelle** (« J'ai envoyé »).
- **Rappels** : le tableau de bord liste les rapports « à préparer » et « à
  envoyer » pour la semaine écoulée ; la page Rapports propose un raccourci de
  génération par entreprise manquante.
- **Onglet Rapports** du cockpit entreprise branché.

### Vérifications

- `lint` ✅ · `typecheck` ✅ · `test` ✅ (67/67, dont 23 nouveaux sur la
  génération déterministe, le formatage WhatsApp et le CSV) · `build` ✅.

### Problèmes connus

- Toujours aucun test en conditions réelles contre Supabase (réseau bloqué
  dans l'environnement distant).
- `report_schedules` existe en base mais n'a pas encore d'interface de
  configuration : les rappels utilisent la semaine écoulée par défaut
  (conforme à D-006, à compléter si besoin).
- `exceljs` retiré (dépendance vulnérable) : les tableaux sortent en CSV, ce
  que le cahier des charges autorise explicitement.

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

## Après le MVP

Idées validées comme cap, hors périmètre du MVP (voir `docs/DECISIONS.md`) :

- **Portail client** (D-011) : tableau de bord consultable par chaque client,
  avec curation stricte de ce qui est exposé.
- **Connecteurs externes** (D-016) : Search Console / Analytics 4 en lecture,
  notifications web push, calendrier, brouillons d'emails.
- **Déclencheurs planifiés** (D-017) : briefing du matin, relance de saisie du
  temps, brouillon de rapport hebdomadaire — l'application déclenche, l'IA
  rédige, l'utilisateur valide.
