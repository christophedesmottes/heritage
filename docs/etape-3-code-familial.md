# Accès familial — décision et réalisation au 26 septembre 2026

> **Décision ultérieure — README 0.8.1 :** à la demande de l’utilisateur, le code familial est reporté à la mise en production finale. Continuer maintenant sur l’application locale `http://127.0.0.1:8767/`, sans code. Les étapes de configuration ci-dessous concernent la future mise en service ; aucune saisie de secret n’est attendue pour poursuivre. Voir le [guide de sauvegarde/restauration](etape-3-sauvegarde-restauration.md).

README 0.7.2 · Socle cloud 0.2.0 · Application locale 0.6.0

> **Document historique conservé.** Le déploiement et l’écran ont depuis été réalisés en application 0.7.0 / cloud 0.3.0. Consulter le [guide actuel](etape-3-connexion-familiale.md) et le README 0.8.0 pour l’état et les consignes à jour.

## Décision validée par l’utilisateur

**Une adresse commune et un code familial, sans compte ni e-mail, pour consulter l’arbre et les photos.** Le partage public sans protection et le lien secret donnant accès à son seul détenteur n’ont pas été retenus. Le code familial ne doit pas donner accès aux notes personnelles. Celles-ci restent pour l’instant dans le navigateur ; la synchronisation personnelle devra disposer de son propre mécanisme d’identification, à choisir ultérieurement.

Toute personne ayant l’adresse et le code pourra consulter les données partagées. Un destinataire peut transmettre le code et conserver des copies : ce mécanisme contrôle l’accès au service, pas la circulation ultérieure des informations. Le changement du code révoquera les sessions en ligne, mais ne supprimera pas les fichiers déjà copiés ou mis hors connexion. La durée des copies locales et le comportement après révocation restent à préciser dans l’interface.

## Ce qui existe dans Supabase

Projet **genealogie**, référence `plexhqgdxdejijgxviie`, offre Free, région **eu-west-2 — Londres**, état Healthy au contrôle. L’utilisateur s’est connecté au tableau de bord. L’inventaire initial était vide : aucune table publique, aucun bucket, aucun utilisateur Auth ni politique Storage.

Deux migrations ont ensuite été appliquées par l’éditeur SQL :

- `202609260001_private_foundation.sql` : `heritage_trees`, `heritage_notebook`, fonction de révisions des notes, huit politiques et bucket `heritage-private` non public, limite de fichier 50 Mio.
- `202609260002_family_attempts.sql` : compteur technique des tentatives et fonction accessible uniquement au rôle serveur `service_role`.

Les tables ont RLS activé. Les visiteurs ne peuvent pas lire les tables privées ; un rôle connecté ne peut pas écrire directement le carnet. La première migration reste utile pour un éventuel espace personnel, mais **ses comptes Auth ne sont pas nécessaires à la consultation familiale choisie**.

**État final observé : zéro arbre, zéro note, zéro objet stocké, zéro utilisateur Auth.** Le compteur technique est à zéro après annulation des essais. Aucun GEDCOM, portrait ou corpus familial transféré. Aucun dépôt ou push GitHub. Aucun hébergement d’interface.

Ces migrations ont été appliquées directement depuis le tableau de bord, pas par la CLI de migrations. Ne pas les réexécuter sans examiner les objets présents et réconcilier l’historique CLI si celle-ci est utilisée plus tard.

## Ce qui est prêt dans le code local

`supabase/functions/family-access/gateway.js` implémente le contrôle d’accès. `index.ts` l’adapte à une Edge Function Supabase et lit les secrets côté serveur. **La fonction n’est pas encore déployée, les secrets ne sont pas configurés et aucun écran de code n’est encore intégré à l’application.**

Le contrat prévu est :

| Requête | Fonction |
|---|---|
| `POST /family-access/unlock` avec JSON `{code}` | Vérifier le code et retourner une session signée valable sept jours |
| `GET /family-access/tree` avec session Bearer | Télécharger uniquement le JSON de l’export configuré |
| `GET /family-access/media/<sha>.<extension>` avec session Bearer | Lire une photographie du même espace familial |

Aucune route ne donne le GEDCOM original, les notes, une clé d’administration ou une URL privée signée. Les routes de modification et chemins arbitraires sont refusés. L’adresse de l’API et un nom de fichier ne suffisent pas : une session valide est requise pour chaque lecture.

Le code familial est un secret côté serveur, de 16 à 200 caractères ; une phrase de plusieurs mots convient mieux qu’un PIN à quatre chiffres. La comparaison utilise des empreintes de longueur fixe. Les sessions sont signées par HMAC et liées à l’espace familial. Changer le code ou le secret de session les invalide. Une configuration incomplète retourne 503 et ne donne aucun accès.

Le compteur PostgreSQL autorise au maximum **20 tentatives de déverrouillage par fenêtre de 15 minutes**, pour toute la famille. Il ne dépend pas d’une adresse IP fournie par le client. Une panne du compteur refuse le déverrouillage. Ce plafond global peut temporairement gêner une nouvelle connexion en cas d’abus ; les sessions valides restent utilisables. L’amélioration de cette limitation reste possible selon l’usage réel.

Les origines de l’interface sont explicitement autorisées pour CORS. CORS ne remplace pas le code : un client externe peut envoyer des requêtes sans Origin, mais doit toujours fournir le bon code ou une session valide. Les réponses sont `no-store` pour les caches HTTP intermédiaires ; le cache hors connexion de l’application devra être adapté explicitement avant activation du parcours distant.

## Configuration à faire lors du raccordement

Secrets de la fonction (aucune valeur réelle actuellement enregistrée) :

| Nom | Contenu prévu |
|---|---|
| `HERITAGE_FAMILY_CODE` | Code choisi et saisi directement par l’utilisateur dans le gestionnaire de secrets, pas dans la conversation |
| `HERITAGE_SESSION_SECRET` | Secret aléatoire de signature d’au moins 32 caractères, uniquement côté serveur |
| `HERITAGE_TREE_ID` | UUID du préfixe privé des fichiers de cette famille |
| `HERITAGE_SOURCE_SHA` | Empreinte du GEDCOM actif |
| `HERITAGE_ALLOWED_ORIGINS` | Origines HTTPS de l’interface, séparées par des virgules ; localhost autorisé pour les essais |

La fonction utilise les variables serveur Supabase pour télécharger les objets privés et appeler le limiteur. Aucune clé privilégiée n’est envoyée au navigateur. `supabase/config.toml` prévoit une authentification personnalisée pour **cette nouvelle fonction seulement** (`verify_jwt=false`) : les sessions familiales sont vérifiées dans son code. Ce fichier n’a pas changé de paramètre sur une fonction existante et aucun réglage Auth distant n’a été modifié.

Prochaine réalisation : vérifier l’adaptateur Deno, déployer la fonction fermée tant que ses secrets manquent, configurer les secrets au bon endroit, intégrer l’écran du code et adapter le chargement/cache des données dans l’application. Tester avec des données fictives avant le transfert familial, puis préparer un paquet d’interface sans données privées et son hébergement HTTPS. Le client ne doit pas mettre en cache le code familial, et la déconnexion doit traiter séparément les copies familiales et les notes locales non synchronisées.

## Vérifications et limites

**77 tests automatisés réussis : 58 JavaScript + 19 Python.** Neuf nouveaux tests depuis le lot précédent : huit tests du contrôleur familial et un du compteur PostgreSQL. Ils couvrent configuration absente, code faux/correct, session falsifiée/expirée/révoquée, origines, limites de tentatives, indisponibilité du stockage, taille des requêtes et interdiction des routes privées non prévues.

Sur **le vrai projet Supabase**, les permissions des tables/fonctions et le caractère privé du bucket ont été contrôlés. Des requêtes sous `anon` et `authenticated` ont vérifié les refus de lecture/écriture sans compte attribué. La limite de vingt tentatives a également été exercée puis annulée par transaction ; son compteur est resté à zéro. Le fichier `supabase/checks/access_without_account.sql` conserve le premier contrôle.

Les tests locaux ne contactent pas Supabase. Les essais SQL distants sont décrits séparément et ne sont pas ajoutés artificiellement au total de 77. **Les échanges HTTP avec la nouvelle Edge Function, l’exécution Deno, le téléchargement privé réel, l’écran du code et les appareils Apple ne sont pas encore validés.**

Références : [authentification des Edge Functions](https://supabase.com/docs/guides/functions/auth), [secrets côté serveur](https://supabase.com/docs/guides/functions/secrets), [déploiement depuis le tableau de bord](https://supabase.com/docs/guides/functions/quickstart-dashboard).
