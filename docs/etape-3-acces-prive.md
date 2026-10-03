# Étape 3 — préparation initiale de l’accès privé

> **Historique du lot 0.1.0.** Après cette préparation, les deux migrations ont été appliquées et l’utilisateur a retenu un code familial sans e-mail. L’état actuel, les 77 tests et les limites restantes sont décrits dans [le guide du code familial](etape-3-code-familial.md), README 0.7.2. Les mentions « non appliqué » ci-dessous décrivent l’état antérieur.

26 septembre 2026 · Préparation cloud 0.1.0 · Application locale 0.6.0 · README 0.7.1

## Ce qui est livré et ce qui ne l’est pas

Le projet contient maintenant une migration SQL Supabase testée localement et un outil de préparation d’archive privée. **La connexion de l’application à Supabase, la synchronisation dans l’interface et l’hébergement HTTPS ne sont pas livrés.** L’application actuelle continue de lire ses fichiers sur le PC et son carnet dans le navigateur.

L’utilisateur a fourni le projet `https://plexhqgdxdejijgxviie.supabase.co`. Son [tableau de bord](https://supabase.com/dashboard/project/plexhqgdxdejijgxviie) redirige vers une connexion dans le navigateur intégré ; l’utilisateur a été invité à s’y connecter directement. Aucune migration n’a été exécutée à distance. Aucun compte créé, aucun fichier familial transféré, aucun push GitHub. Le périmètre proposé pour le premier accès est un propriétaire sur ses trois appareils ; le partage avec des proches reste à confirmer. Cette préparation ne donne aucun accès à un compte réel.

## Organisation prévue

| Élément | Fonction |
|---|---|
| Interface web HTTPS | Code et écran de connexion ; aucune généalogie dans le paquet public |
| Supabase Auth | Même compte personnel sur le PC, l’iPhone et l’iPad |
| `heritage_trees` | Arbre attribué à un propriétaire, empreinte de l’export actif et personne d’accueil |
| Bucket privé `heritage-private` | GEDCOM original, JSON complet et photographies |
| `heritage_notebook` | Notes/favoris, version GEDCOM, révisions et marqueurs de suppression |
| IndexedDB et caches du navigateur | Consultation et carnet hors connexion, après préparation sur chaque appareil |

La migration est `supabase/migrations/202609260001_private_foundation.sql`. Elle s’applique **une seule fois**, dans une transaction, à un projet dédié. Elle échoue si ces tables, ce bucket ou ces politiques existent déjà : il faut alors examiner l’état du projet, pas effacer les objets ni relancer une variante aveuglément. Le modèle `supabase/bootstrap.example.sql` attribue ensuite explicitement l’arbre à l’identifiant UUID d’un compte Auth. Il contient des espaces réservés volontairement invalides tant qu’ils ne sont pas remplacés.

Le modèle initial n’inclut ni invitation familiale, ni inscription libre dans l’interface, ni droit d’éditer la généalogie. Un compte Auth sans arbre attribué ne voit aucune donnée familiale. Les tables sont protégées par RLS ; les clients ne peuvent pas changer le propriétaire, la version active, ou écrire directement les annotations. Le bucket est privé et des politiques restrictives limitent aussi les effets de politiques Storage préexistantes trop larges. L’import des fichiers reste une opération d’administration séparée.

## Contrat de synchronisation préparé côté serveur

`heritage_save_note(p_tree, p_sha, p_person, p_name, p_birth, p_note, p_favorite, p_expected_revision)` vérifie l’utilisateur, l’arbre et l’export actif. Le premier enregistrement exige la révision `0`. Une modification doit transmettre la révision relue auparavant ; le serveur l’incrémente atomiquement. Une révision périmée déclenche un conflit SQL `40001` et ne remplace aucun texte. Un changement de nom ou naissance est également refusé sur une annotation existante.

Une annotation vidée conserve une ligne `deleted=true`, avec une nouvelle révision. Cela permet au futur client de propager une suppression sans faire réapparaître une ancienne note restée sur un autre appareil. Les annotations sont indexées par arbre, empreinte GEDCOM et personne. Lors d’un nouvel export, les anciennes annotations sont conservées dans leur version ; leur rapprochement reste à implémenter.

**Ce contrat serveur ne constitue pas une synchronisation déjà fonctionnelle.** Il reste à développer le journal local des modifications, la reprise après coupure réseau, les téléchargements paginés, le traitement des conflits et la migration du carnet local. En cas de réponse réseau perdue après une écriture réussie, le futur client devra relire et comparer le contenu avant de proposer un conflit.

## Paquet de transfert privé

Commandes à exécuter dans le dossier du projet :

```powershell
npm run inspect:private
npm run package:private
```

Le premier contrôle le corpus et affiche l’inventaire, sans créer d’archive. Le second crée une archive ZIP dans `artifacts/`. Ce dossier est exclu d’un futur dépôt Git. Le script ne possède aucune fonction réseau et ne lit aucune clé.

Contenu de l’archive :

```text
transfer-manifest.json
exports/<empreinte GEDCOM>/tree.json
exports/<empreinte GEDCOM>/source.ged
media/<empreinte image>.<extension>
```

Les fichiers seront placés dans le bucket sous le préfixe `<UUID_ARBRE>/`. Le script contrôle que le GEDCOM correspond au JSON, que chaque référence locale désigne une photographie présente dans le dossier autorisé, et que son empreinte correspond au nom du fichier. Il n’inclut ni `.env`, ni analyses, ni maquettes, ni fichiers supplémentaires non référencés. Après création, tous les membres du ZIP sont relus et leurs empreintes vérifiées. Une archive existante n’est jamais remplacée automatiquement.

Cette archive **contient des données familiales privées et n’est pas chiffrée** : elle n’est pas destinée à GitHub Pages ni à un téléchargement public. Elle ne contient pas les notes/favoris du navigateur. Exporter le Carnet séparément pour une sauvegarde complète. Le script utilise pour le moment la source `sources/2026-09-24.ged` ; ce choix devra évoluer lors du prochain import.

Le volume de Storage à prévoir est celui des fichiers décompressés : environ 349 Mo pour cet export avec ses images et son original. Les limites publiées au 26/09/2026 sont 1 Go de fichiers et 500 Mo de base pour l’offre gratuite ; les images vont dans Storage, pas dans la base. Les téléchargements répétés et les versions supplémentaires consomment aussi des quotas. Ces chiffres ne garantissent pas la disponibilité continue du projet. [Tarifs Supabase](https://supabase.com/pricing).

## Séquence de raccordement restante

1. Ouvrir le projet Supabase identifié après connexion de l’utilisateur ; relever sa région et vérifier s’il est dédié à Héritage ou s’il contient d’autres applications.
2. Examiner ses réglages d’authentification et ses règles existantes, appliquer la migration et attribuer l’arbre au bon compte.
3. Vérifier les autorisations sur le service réel avec des fichiers fictifs avant de transférer les données privées.
4. Ajouter la connexion dans l’interface, le téléchargement autorisé de l’arbre et des médias, puis la synchronisation du carnet. Isoler les caches par compte et arbre ; traiter la déconnexion et l’effacement local sans perte des notes non synchronisées.
5. Produire un paquet d’interface sans données familiales, choisir son hébergement HTTPS et raccorder les URL de connexion. **Ne pas publier directement `app/` ni tout ce projet** : `app/data/` contient l’arbre et les photos, et certaines maquettes/documentations contiennent des informations réelles.
6. Après validation du destinataire et du périmètre, transférer l’archive au stockage privé, publier l’interface et tester sur les appareils réels.

L’URL et la clé **publishable** du projet suffisent à identifier le service côté client, mais ne donnent pas à elles seules accès aux données. Aucune clé d’administration (`service_role` ou `sb_secret_…`) ne doit entrer dans l’interface ou le dépôt. Les mots de passe se saisissent directement dans le service concerné. [Documentation des clés](https://supabase.com/docs/guides/getting-started/api-keys).

## Vérifications

**68 tests automatisés passent : 49 JavaScript et 19 Python.** Les 14 nouveaux tests comprennent 8 tests des droits/conflits et 6 tests du paquet privé.

Les tests SQL exécutent réellement la migration dans PostgreSQL embarqué via PGlite, dépendance de développement verrouillée dans `package-lock.json`. Ils simulent les rôles et les tables minimales Auth/Storage de Supabase ; ils ne contactent aucun compte ni service distant. Ils couvrent visiteurs, comptes non autorisés, séparation de deux propriétaires, refus des écritures directes, conflits de révisions, suppressions et anciennes politiques Storage permissives. **Ils ne remplacent pas les essais Auth, REST, Storage et RLS sur le vrai projet Supabase.**

Les tests du paquet contrôlent restauration des octets, exclusion des fichiers étrangers, non-écrasement, source incohérente, image absente/altérée, chemin sortant du périmètre et archive modifiée.

Références : [RLS et permissions](https://supabase.com/docs/guides/database/postgres/row-level-security), [buckets privés](https://supabase.com/docs/guides/storage/buckets/fundamentals), [contrôle Storage](https://supabase.com/docs/guides/storage/security/access-control), [PGlite](https://pglite.dev/docs/).
