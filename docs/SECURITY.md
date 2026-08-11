# MAW Pilot — Audit de sécurité

Dernière vérification : 2026-08-11 (fin de phase 8).
À refaire avant chaque mise en production importante.

## Résultat

| # | Contrôle | État |
|---|---|---|
| 1 | Aucun secret dans les fichiers suivis par Git | ✅ |
| 2 | `.env.local` ignoré par Git, jamais commité | ✅ |
| 3 | Aucune variable `NEXT_PUBLIC_*` sensible | ✅ |
| 4 | `OPENAI_API_KEY` lue uniquement côté serveur | ✅ |
| 5 | Toutes les Server Actions vérifient l'utilisateur | ✅ (35/35 mutations) |
| 6 | Toutes les routes API vérifient l'utilisateur | ✅ (2/2) |
| 7 | Toutes les mutations filtrent sur `user_id` | ✅ |
| 8 | Aucun `dangerouslySetInnerHTML`, `eval`, `new Function` | ✅ |
| 9 | Tous les liens externes en `rel="noopener noreferrer"` | ✅ |
| 10 | Pas de redirection ouverte après connexion | ✅ |
| 11 | Toutes les entrées validées avec Zod | ✅ (13/13 modules) |
| 12 | Fichiers privés : URL signées à durée limitée | ✅ (5 minutes) |
| 13 | RLS activée sur les 18 tables métier | ✅ (vérifié en base) |
| 14 | Bucket Storage privé + politiques par dossier utilisateur | ✅ |
| 15 | Historique `activity_logs` non modifiable ni supprimable | ✅ (aucune politique UPDATE/DELETE) |
| 16 | Limitation des appels IA | ✅ (12/min, 120/h) |
| 17 | Limitation des téléversements (type + taille) | ✅ (25 Mo documents, 10 Mo audio) |
| 18 | Aucun secret client stocké en base | ✅ (validation qui refuse les motifs) |
| 19 | En-têtes de sécurité HTTP | ✅ (voir `next.config.ts`) |
| 20 | Application non indexable | ✅ (`robots: noindex`) |

## Défenses en profondeur

La sécurité ne repose jamais sur une seule barrière :

1. **Proxy** (`src/proxy.ts`) : redirige vers `/login` sans session valide.
2. **Layout protégé** (`src/app/(app)/layout.tsx`) : vérifie l'utilisateur
   auprès du serveur Supabase (`getUser()`, jamais le cookie seul).
3. **Server Actions / Routes** : re-vérifient l'utilisateur, valident les
   entrées avec Zod, et filtrent explicitement sur `user_id`.
4. **RLS PostgreSQL** : dernière barrière — même un bug applicatif ne peut pas
   lire ou écrire les données d'un autre compte.

Pour l'assistant IA, une barrière supplémentaire : le modèle ne peut appeler
que des fonctions déclarées, dont les arguments sont revalidés côté serveur,
et les écritures exigent une confirmation humaine.

## En-têtes HTTP appliqués

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (pas d'intégration en iframe)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` : caméra et géolocalisation refusées, micro autorisé
  uniquement pour l'application elle-même (dictée)
- `Strict-Transport-Security` (HTTPS obligatoire)

## Points de vigilance connus

- **Le crédit IA restant est une estimation** : l'API OpenAI n'expose pas le
  solde du compte (D-020). Le montant dépensé, lui, est mesuré exactement.
- **Le service worker ne met en cache que les icônes et le manifest.** Mettre
  en cache des pages authentifiées exposerait des données privées sur un
  appareil partagé — c'est volontairement exclu.
- Les contrôles ci-dessus sont **statiques** (analyse du code) ou faits **en
  base** (RLS, politiques). Le parcours applicatif a été vérifié manuellement
  après déploiement, mais aucun test d'intrusion n'a été mené. Refaire cet
  audit avant toute ouverture à d'autres utilisateurs (portail client).
- **Rotation des clés** : si une clé OpenAI ou Supabase a été exposée, la
  révoquer sur la plateforme concernée et la remplacer dans `.env.local` et
  chez l'hébergeur.

## Ce qu'il ne faut jamais faire

- Utiliser la clé Supabase `service_role` côté navigateur.
- Créer une variable `NEXT_PUBLIC_OPENAI_API_KEY`.
- Enregistrer un mot de passe, une clé API ou un code de récupération dans
  `company_resources`, les notes ou les documents.
- Marquer un rapport comme envoyé sans confirmation explicite.
- Rendre le bucket `documents` public.
