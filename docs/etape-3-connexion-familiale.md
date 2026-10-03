> Mise à jour 0.10.0 : suivre désormais le [guide de livraison manuelle](../livraison-0.10.0/LIRE-MOI.md), avec migration du limiteur et remplacement de la fonction avant utilisation du PIN. Les déploiements décrits ci-dessous sont historiques.

# Connexion familiale — guide de reprise

> **Décision ultérieure — README 0.8.1 :** à la demande de l’utilisateur, le code familial est reporté à la mise en production finale. Continuer maintenant sur l’application locale `http://127.0.0.1:8767/`, sans code. Les étapes de configuration ci-dessous concernent la future mise en service ; aucune saisie de secret n’est attendue pour poursuivre. Voir le [guide de sauvegarde/restauration](etape-3-sauvegarde-restauration.md).

26 septembre 2026 · Application **0.7.0** · Cloud **0.3.0** · README **0.8.0**

## Ce qui est livré et ce qui reste à activer

La consultation familiale fonctionne dans le code avec une adresse et un code commun, sans e-mail ni compte Supabase Auth. L’écran reprend les couleurs vert, crème et or d’Héritage. La passerelle `family-access` est déployée dans le projet **genealogie** (`plexhqgdxdejijgxviie`). Elle refuse actuellement toute lecture : **le code familial n’est pas encore défini et le bucket ne contient aucun fichier familial**.

L’application locale complète reste accessible à `http://127.0.0.1:8767/`. Le paquet familial est prévisualisé sur ce PC à `http://127.0.0.1:8770/`, tant que son serveur fonctionne. Ces adresses ne sont pas accessibles avec le PC éteint depuis l’iPhone ou l’iPad. Aucun hébergement HTTPS, dépôt GitHub, push ou cron n’est configuré.

## Parcours prévu pour la famille

1. Ouvrir l’adresse commune ; seule la page du code apparaît sans session valide.
2. Saisir le code familial. L’application le transmet par HTTPS à la passerelle et vide le champ ; elle ne le conserve pas dans ses fichiers, caches ou IndexedDB.
3. Une réponse valide fournit un jeton signé valable **sept jours**, conservé dans IndexedDB dans ce navigateur. Ce jeton reste une information d’accès privée ; il ne doit pas être partagé.
4. Le service worker transmet le jeton en en-tête `Authorization: Bearer …` pour lire l’arbre et les images. Aucun secret de service Supabase n’arrive dans le navigateur.
5. Consulter et rechercher les personnes, explorer les branches et les photographies comme dans l’application locale. Le chargement initial ne télécharge pas les 1 116 photos : elles arrivent au fil de la consultation, ou lors de la préparation complète demandée dans le Carnet.
6. Utiliser **Fermer l’accès familial** pour supprimer la session et les caches arbre/photos de cette origine. Le Carnet reste conservé ; une note en cours d’édition empêche la fermeture avant traitement de son brouillon.

L’accès hors connexion utilise uniquement les copies présentes et exige une session non expirée. Un refus `401/403` du serveur invalide la session sans réutiliser le cache privé. Une panne réseau peut utiliser la dernière copie valide. Une modification du code révoque les sessions lors du prochain contrôle serveur ; elle ne peut ni effacer les téléchargements déjà faits ni prévenir immédiatement un appareil hors connexion. Le cache navigateur est une copie locale, pas un coffre chiffré ni une sauvegarde de référence.

Les notes et favoris restent **propres au navigateur et à l’origine**. Passer de `8767` à `8770`, puis à une adresse HTTPS, ne les copie pas automatiquement. Exporter le Carnet puis le restaurer sur la nouvelle origine permet de conserver ses notes, pour le même export généalogique. Le code familial ne donne aucun accès aux notes stockées sur un autre appareil. La synchronisation personnelle reste à concevoir et à implémenter.

## Structure du code

| Fichier | Rôle |
|---|---|
| `app/runtime-config.js` | Mode local par défaut ; remplacé par la configuration publique dans le paquet familial |
| `app/index.html`, `app/family.css` | Écran du code et présentation responsive |
| `app/lib/family-ui.js` | Saisie, ouverture, fermeture, service worker et messages d’erreur |
| `app/lib/family-session.js` | Validation de configuration/session, routes permises, stockage IndexedDB |
| `app/lib/private-response.js` | Chargement sous session, cache privé, refus serveur et contrôle de l’export reçu |
| `app/sw.js`, `app/lib/offline-config.js` | Routage, fichiers d’interface et caches distincts par famille/export |
| `app/lib/offline.js` | Préparation hors connexion et disponibilité selon la session |
| `app/lib/media.js` | Images locales ou privées ; aucun repli sur les URL MyHeritage dans le mode familial |
| `supabase/functions/family-access/gateway.js` | Contrôle du code, limitation des tentatives, signature et vérification des sessions, routes de lecture |
| `supabase/functions/family-access/index.ts` | Adaptateur Deno, variables serveur et accès au stockage privé |
| `supabase/migrations/` | Socle privé et compteur de tentatives, déjà appliqués depuis le tableau de bord |
| `supabase/family-public.json` | Adresse de passerelle et identifiants publics de l’export, sans secret |
| `scripts/build_family.mjs` | Copie explicite des seuls fichiers d’interface autorisés |
| `scripts/build_gateway.mjs` | Regroupement des sources pour l’éditeur de fonction Supabase |
| `tests/family-client.test.js` | Huit tests du client, des caches et du paquet public |

Les données généalogiques restent dans `app/data/`, les originaux dans `sources/`, les résultats privés dans `analysis/` et `artifacts/`. Le site à publier devra provenir du constructeur familial ; **ne pas publier directement le dossier `app/`**, qui contient le vrai arbre et les images.

## Contrat serveur

Endpoint : `https://plexhqgdxdejijgxviie.supabase.co/functions/v1/family-access`.

| Route | Résultat |
|---|---|
| `POST /unlock`, JSON `{code}` | Session HMAC de sept jours si le code est valide |
| `GET /tree`, session Bearer | JSON de l’export configuré |
| `GET /media/<sha>.<extension>`, session Bearer | Image du même espace privé ; extensions jpg/png/gif/webp |

Aucune route pour modifier l’arbre, lire les notes ou récupérer le GEDCOM original. La limite durable est **5 tentatives de déverrouillage par fenêtre de 15 minutes pour toute la famille** ; les sessions valides restent utilisables pendant ce délai. Les paramètres de requête et chemins arbitraires sont refusés.

Le paramètre `verify_jwt=false` concerne uniquement cette nouvelle fonction : les jetons familiaux sont contrôlés dans son code. Les politiques RLS et le bucket privé restent actifs. CORS limite les origines autorisées du navigateur, mais n’est pas un mécanisme d’authentification ; les requêtes sans Origin exigent également le bon code ou un jeton valide.

## Configuration et reprise du déploiement

| Paramètre | État actuel |
|---|---|
| `HERITAGE_FAMILY_CODE` | **À saisir par l’utilisateur dans Supabase → Edge Functions → Secrets** ; PIN de quatre chiffres (serveur 0.10.0 à déployer), jamais dans la conversation |
| `HERITAGE_SESSION_SECRET` | Optionnel ; sinon signature dérivée côté serveur de la clé de service existante et du code, avec un domaine de signature propre à Héritage |
| `HERITAGE_TREE_ID` | Valeur par défaut `36916abc-3366-4c02-8d10-a654cc741b34` |
| `HERITAGE_SOURCE_SHA` | Valeur par défaut `72a26859d864978f8343573676e2644e22478a921cea49ed3fa402303e36962b` |
| `HERITAGE_ALLOWED_ORIGINS` | Défaut `http://127.0.0.1:8770` ; ajouter la véritable origine HTTPS lors de l’hébergement |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Fournies au runtime serveur ; ne jamais copier la clé dans le client |

Le nom et la valeur du code sont enregistrés dans le gestionnaire de secrets du projet. La saisie et la validation de ce nouvel identifiant doivent être effectuées par l’utilisateur lui-même, conformément aux règles de manipulation des identifiants du navigateur utilisé pour cette intervention.

Le futur transfert doit placer les fichiers dans le bucket **privé** `heritage-private` :

```text
36916abc-3366-4c02-8d10-a654cc741b34/
  exports/72a26859d864978f8343573676e2644e22478a921cea49ed3fa402303e36962b/tree.json
  media/<sha256>.<extension>
```

La consultation familiale lit ces objets directement via la passerelle ; elle n’exige pas de créer un faux propriétaire Auth dans `heritage_trees`. Cette table et le contrat de notes sont réservés au futur volet personnel. L’archive ZIP de sauvegarde privée inclut également le GEDCOM ; elle ne remplace pas les objets séparés attendus par la passerelle et n’est pas téléchargeable par les routes familiales.

Pour reconstruire, depuis le dossier du projet, choisir un **nouveau dossier de sortie** : le constructeur refuse d’écraser un dossier existant.

```powershell
npm test
npx --yes deno check supabase/functions/family-access/index.ts
npm run build:gateway
node scripts/build_family.mjs supabase/family-public.json artifacts/family-web-nouvelle-livraison
```

Le paquet actuel `artifacts/family-web-0.7.0/` contient 21 fichiers. L’aperçu utilise un serveur Python lié uniquement à `127.0.0.1:8770`. Le service worker de l’application 0.7.0 utilise une révision de cache d’interface `r1`. Les données préparées gardent leur métadonnée 0.6.0 : aucun réimport du corpus n’a été nécessaire pour ce lot.

La fonction a été déployée depuis l’éditeur Supabase avec les sources regroupées. Le fichier généré `artifacts/family-access-deploy.ts` permet de reproduire ce déploiement ; la présentation du code dans l’éditeur peut différer. Ne pas réappliquer aveuglément les migrations déjà installées depuis le tableau de bord.

## Validation et prochaines actions

**85 tests passent : 66 JavaScript et 19 Python.** Deno valide l’adaptateur. L’appel HTTP réel retourne 503 sans code, ce qui confirme le refus d’accès attendu. Les cinq formats d’écran sont contrôlés sans débordement horizontal ; la consultation locale conserve portrait, unions et Carnet.

Le test avec une saisie fictive ne déverrouille pas l’interface et efface le champ. Avant configuration, le refus de la prérequête CORS se traduit par le message générique de connexion. Le téléchargement du vrai corpus distant et le parcours complet ne sont pas encore validés.

Ordre de reprise :

1. L’utilisateur définit le code dans Supabase, sans le communiquer dans la conversation.
2. Contrôler le fonctionnement configuré et la protection avec un essai maîtrisé, puis transférer et vérifier le corpus dans le bucket privé du projet choisi.
3. Faire saisir le vrai code par l’utilisateur dans l’application ; vérifier arbre, portraits, préparation hors connexion, fermeture et conservation des notes.
4. Choisir/configurer l’hébergement HTTPS du seul paquet d’interface ; adapter l’origine serveur. Aucun push GitHub n’est effectué à ce stade.
5. Valider sur l’iPhone 15 Pro et l’iPad Pro 11 pouces de 3e génération, puis poursuivre sauvegardes globales, synchronisation personnelle et finalisation.

Ce lot fait avancer **l’étape 3**. Il ne clôt ni la mise en service multiappareil ni l’étape 4.
