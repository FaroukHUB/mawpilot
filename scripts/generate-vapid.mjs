/**
 * Génère une paire de clés VAPID pour les notifications push.
 * Usage : npm run generate:vapid
 *
 * La clé publique est destinée au navigateur (variable NEXT_PUBLIC_*),
 * la clé privée reste strictement côté serveur.
 */

import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\nClés VAPID générées. À copier dans .env.local ET chez votre");
console.log("hébergeur (Vercel → Settings → Environment Variables) :\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:votre@email.fr\n");
console.log("⚠ La clé privée est un secret : ne la commitez jamais.\n");
