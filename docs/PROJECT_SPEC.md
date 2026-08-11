# MAW Pilot — Spécification fonctionnelle

> Version condensée du cahier des charges initial (2026-08). Fait foi avec
> `CLAUDE.md` (règles) et `docs/DECISIONS.md` (arbitrages).

## 1. Objectif

Application web **privée mono-utilisateur** de pilotage pour un freelance
travaillant pour au moins six entreprises. Elle centralise :

- entreprises clientes, projets, tâches (statuts, priorités, échéances) ;
- temps passé et prestations (incluses, supplémentaires, à facturer, facturées) ;
- historique exact des actions ;
- rapports hebdomadaires (dictés, corrigés, exportables, partageables) et
  comptes rendus mensuels par entreprise ;
- contacts et canaux WhatsApp habituels ;
- documents, tableaux, livrables et liens ;
- centre d'accès rapide (sites, administrations, SEO, analytics, réseaux sociaux) ;
- assistant IA texte + voix comprenant le français naturel.

L'architecture (`user_id` partout, RLS) permet une évolution future
multi-utilisateurs/SaaS sans la construire maintenant. Le MVP doit rester
rapide, fiable, utilisable au quotidien — pas un clone de ClickUp.

## 2. Modèle de données (tables minimales)

Toutes les tables métier : `user_id`, `created_at`, `updated_at`, RLS.

| Table | Rôle | Points clés |
|---|---|---|
| `profiles` | Profil lié à `auth.users` | nom, avatar, fuseau, préférences UI |
| `companies` | Entreprises clientes | couleur, contact principal, montant mensuel, prestations incluses, actif/inactif |
| `company_contacts` | Personnes | WhatsApp international facultatif, canal préféré |
| `company_channels` | Destinations de communication | WhatsApp direct / groupe / email / autre ; le nom d'un groupe est un aide-mémoire, pas un ciblage automatique ; canal par défaut |
| `company_resources` | Accès rapides | catégorie, URL, favori, ordre, identifiant non sensible, référence gestionnaire de mots de passe ; **jamais de secret** |
| `company_documents` | Fichiers et liens | fichier stocké / lien externe / document ou tableau généré ; rattachable à projet/tâche |
| `projects` | Projets par entreprise | statut, dates facultatives |
| `tasks` | Tâches | `company_id` obligatoire, `project_id` facultatif ; catégorie, statut (backlog → archivée), priorité, échéance, estimation/réel en minutes, statut de facturation, montant, étiquettes, source (manuelle/texte IA/voix IA) |
| `time_entries` | Temps passé | minutes, date, facturable |
| `activity_logs` | Historique | description humaine, avant/après JSONB, source manuelle/IA ; ne disparaît jamais |
| `ai_requests` | Demandes IA | transcription, intention, actions JSONB, statut (proposée → exécutée/annulée/échouée) |
| `reports` | Rapports | hebdo/mensuel/personnalisé ; données sources figées en JSONB ; dictée brute + transcription corrigée ; version courte WhatsApp + version longue |
| `report_attachments` | Pièces jointes de rapport | document, tableau, URL ou fichier ; ordre |
| `report_deliveries` | Partages | destination, méthode, contenu réellement préparé, statut (préparé → confirmé envoyé), notes |
| `report_schedules` | Planification | hebdo/mensuel, jour, heure, fuseau, canal par défaut, sections ; crée un rappel/brouillon, **jamais d'envoi automatique** |

Suppression métier = archivage de préférence. Suppression définitive =
confirmation explicite.

## 3. Pages

`/login`, `/dashboard`, `/entreprises`, `/entreprises/[id]`, `/taches`,
`/calendrier`, `/historique`, `/rapports`, `/documents`, `/ressources`,
`/assistant`, `/parametres`.

**Dashboard** : tâches à faire, urgences, tâches du jour/semaine, retards,
en attente client, terminées dans le mois, temps du mois, charge par entreprise,
prestations supplémentaires à facturer, rapports à préparer/envoyer, activité récente.

**Vues tâches** : liste, Kanban, calendrier. Filtres combinables : entreprise,
projet, statut, priorité, catégorie, facturation, période.

**Fiche entreprise = cockpit** en 7 sections : vue d'ensemble ; projets et
tâches ; rapports (brouillons, historique, modèles, planning) ; contacts et
WhatsApp ; documents ; accès rapides (recherche, favoris, réordonnancement,
cartes compactes, ouverture sûre dans un nouvel onglet) ; historique complet.

## 4. Rapports et partage WhatsApp

Workflow hebdomadaire : collecte automatique des faits de la période (tâches
terminées, temps, livrables, URL, en cours, blocages, prestations
supplémentaires) → dictée facultative → transcription affichée et corrigeable →
organisation par l'IA **sans invention de faits** → choix des sections et
édition → prévisualisation → choix d'une destination enregistrée → préparation
du partage → journalisation après confirmation.

Sections : résumé, terminé, en cours, résultats connus, blocages/attente
client, liens et livrables, tableau récapitulatif, temps passé, prestations
supplémentaires, prochaines actions.

Formats : message WhatsApp court formaté, rapport détaillé PDF, DOCX si
pertinent, CSV/XLSX pour les données tabulaires, liste d'URL cliquables,
fichiers existants joints. Tout reste modifiable avant partage ; les exports
sont générés côté serveur et enregistrables dans les documents de l'entreprise.

**Réalisme WhatsApp** : lien officiel `wa.me` pour un numéro international
validé (message prérempli si possible) ; feuille de partage native en priorité
sur mobile/PWA ; pour un groupe, affichage du nom + copie/partage + ouverture
de WhatsApp, sélection manuelle par l'utilisateur ; repli copier/télécharger/
ouvrir WhatsApp Web ; jamais de marquage « envoyé » automatique ; pas de
WhatsApp Business Platform au MVP (extension future séparée).

## 5. Assistant IA

- Transcription : API OpenAI (modèle configurable, `gpt-transcribe` initial).
- Interprétation : Responses API + function calling (jamais l'Assistants API).
- Chaîne vocale : micro → `MediaRecorder` → route serveur → transcription →
  correction à l'écran → interprétation → prévisualisation → confirmation →
  exécution transactionnelle → journal. La saisie texte utilise le même moteur.
- Fonctions minimales : `create_company`, `create_project`, `create_task`,
  `update_task`, `complete_task`, `reopen_task`, `log_time`, `search_tasks`,
  `get_company_summary`, `get_overdue_tasks`, `get_unbilled_work`,
  `generate_weekly_report`, `generate_monthly_report`,
  `update_report_from_dictation`, `add_report_link`, `attach_company_document`,
  `prepare_whatsapp_share`, `mark_report_as_sent`, `add_company_resource`,
  `search_company_resources`.
- Jamais d'accès SQL direct ; arguments validés Zod ; appartenance à
  l'utilisateur vérifiée ; ambiguïté → question, jamais de choix silencieux ;
  actions multiples/importantes/destructives → confirmation.
- Dates relatives (« vendredi », « demain ») interprétées avec la date serveur,
  locale `fr`, fuseau `Europe/Paris`.

## 6. Sécurité (résumé)

Voir `CLAUDE.md`, section « Règles non négociables ». En bref : secrets
serveur uniquement, RLS partout, validation Zod systématique, limitation des
appels IA, fichiers privés avec URL signées, aucun secret client en base,
numéros WhatsApp validés au format international.

## 7. Design

Interface française, moderne, claire, responsive (ordinateur + téléphone).
Identité via variables CSS : orange `#FFA000`, jaune `#FFD100`, noir `#111111`,
blanc, gris accessibles. Sidebar sur desktop, navigation mobile adaptée,
bouton « Ajouter » visible, bouton micro très identifiable, badges lisibles,
contrastes/clavier/`aria` respectés. Manifest PWA installable, sans chantier
hors-ligne complexe. Pas d'animations inutiles.

## 8. Phases

1. Fondations · 2. Données et auth · 3. Pilotage · 4. Ressources et documents ·
5. Rapports · 6. Assistant texte · 7. Assistant vocal · 8. Finition.
Vérifications (`lint`, `typecheck`, tests, `build`) et mise à jour de
`docs/PROGRESS.md` à chaque fin de phase ; validation utilisateur entre les phases.
