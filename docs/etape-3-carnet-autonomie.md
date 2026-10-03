# Étape 3 — carnet personnel et autonomie locale

**26 septembre 2026 · Application 0.6.0 · README 0.7.0**

> Ce guide décrit le lot local 0.6.0. La préparation cloud suivante est documentée dans [Accès privé](etape-3-acces-prive.md), avec le README 0.7.1 et 68 tests au total ; elle n’active pas encore la synchronisation.

Le [README officiel](<C:/Users/cdesmottes/Documents/Codex/Généalogie/readme.md>) reste le carnet de bord. Cette livraison conserve l’arbre de 16 262 personnes, les unions, la recherche et les photographies, puis ajoute un premier lot de l’étape 3. Elle fonctionne localement sur le PC. L’hébergement privé et la synchronisation entre les appareils feront l’objet du lot suivant.

## Où en sont les quatre étapes ?

| Étape | État |
|---|---|
| 1. Cadrage et maquettes | Direction visuelle choisie et interface commune construite |
| 2. Première version utilisable | Arbre complet et photographies consultables ; essais sur les appareils Apple physiques à effectuer |
| 3. Autonomie et sauvegardes | **En cours : premier lot local livré** — carnet, favoris, notes, reprise, export/restauration et préparation hors connexion |
| 4. Version finalisée | Installation sur les appareils, finition tactile et validation quotidienne à venir |

## Utiliser les favoris et les notes

1. Ouvrir [Héritage](http://127.0.0.1:8767/) après lancement du serveur local.
2. Sélectionner une personne, puis cliquer sur **☆ Favori** dans sa fiche. Le bouton devient **★ Favori**. Un second clic retire le favori.
3. Cliquer sur **Ajouter une note**, écrire un souvenir ou une piste de recherche, puis **Enregistrer ma note**.
4. Attendre le message **Note enregistrée dans ce navigateur** avant de quitter.
5. Le bouton **Carnet**, dans l’en-tête, rassemble les personnes annotées et les favoris. Le filtre permet de ne voir que l’un ou l’autre. Cliquer sur une ligne revient à la personne.

La généalogie reste en consultation seule. Une note personnelle ne remplace pas une note du GEDCOM et ne change aucun nom, événement ou lien familial. Les notes acceptent du texte brut et des retours à la ligne, jusqu’à 20 000 caractères.

Fermer l’éditeur sans enregistrer conserve le brouillon uniquement dans cet onglet. Un départ avec un brouillon non enregistré déclenche la protection du navigateur ; les exports et mises à jour demandent de l’enregistrer d’abord. En cas d’échec du stockage ou de modification concurrente dans un autre onglet, le message le signale et le texte reste dans l’éditeur. Copier ce texte avant de rouvrir la fiche si un conflit est annoncé.

La dernière personne centrale, la sélection, la profondeur, la fratrie, le mode Famille/Ascendance et la famille parentale sont conservés. Le zoom, la position de défilement et l’historique du bouton retour ne sont pas repris. Le bouton maison ramène à Christophe.

## Sauvegarder et restaurer le carnet

Dans **Carnet → Sauvegarder mon carnet**, choisir **Exporter le carnet**. Le fichier `heritage-carnet-AAAA-MM-JJ.json` contient les notes et favoris enregistrés. Conserver ce fichier dans un emplacement de sauvegarde privé.

Pour restaurer :

1. Choisir **Choisir une sauvegarde** et sélectionner le JSON.
2. Lire le bilan : fiches nouvelles, compléments possibles et conflits.
3. Cliquer sur **Restaurer le carnet**. Avant ce clic, aucune donnée du carnet n’est modifiée.
4. Vérifier le message de fin et retrouver les fiches dans la liste.

La restauration **complète sans écraser** : elle ajoute les nouvelles fiches, remplit une note vide et ajoute les favoris. Depuis **0.8.1**, un aperçu présente les deux notes en conflit : garder la note actuelle (défaut) ou réunir les deux textes explicitement. Une identité différente interdit la réunion. Un changement concurrent d’une fiche concernée invalide l’aperçu avant toute écriture. Les fiches ne sont pas dupliquées lors d’une seconde restauration ; vérifier les textes avant de les réunir de nouveau. Voir le [guide détaillé](etape-3-restauration-carnet.md).

Cette première version accepte seulement une sauvegarde correspondant au **même export GEDCOM**, contrôlé par empreinte SHA-256 et personne d’accueil. Un autre export, une version inconnue, un champ invalide, un identifiant répété ou un fichier de plus de 10 Mo est refusé. L’import est effectué dans une seule transaction.

**Ce JSON ne contient ni l’arbre, ni les photographies, ni les préférences de navigation.** Depuis **0.9.0**, **Carnet → Tout sauvegarder** produit sur le PC un ZIP réunissant l’arbre, le GEDCOM, les photos, le programme et ce Carnet. Voir le [guide de sauvegarde complète](etape-3-sauvegarde-complete.md). Le ZIP conserve les données nécessaires à la consultation ; garder également une copie du dossier de développement si l’on souhaite conserver les analyses et documents de travail. La simple copie du dossier du projet n’inclut pas le stockage du navigateur.

## Préparer la consultation hors connexion

Dans **Carnet → Emporter mon arbre**, cliquer **Préparer le hors connexion**. Attendre le message **Arbre prêt hors connexion**. Le navigateur conserve alors l’interface et une copie de tout l’arbre, soit environ 22,72 Mo de JSON décompressé, en plus des petits fichiers de l’interface.

Après cette préparation, les photos consultées sont conservées progressivement. Pour emporter toute la bibliothèque, cliquer **Conserver toutes les photos** : 1 116 fichiers, environ 315 Mo supplémentaires. Le compteur affiche le nombre effectivement conservé. Garder la page ouverte pendant la copie. **Arrêter** interrompt le travail sans supprimer les fichiers déjà présents ; relancer reprend les fichiers manquants. Un échec ou un manque de place est signalé.

La même adresse peut ensuite être rouverte dans le même navigateur, même si le serveur local est arrêté, tant que le cache reste présent. Les notes et favoris restent accessibles et modifiables hors connexion. Les anciens aperçus `review.html` ne sont pas mis en cache : utiliser l’adresse principale de l’application.

Le cache appartient à **un navigateur et une adresse précise**. `127.0.0.1:8767`, `localhost:8767` et `127.0.0.1:8768` ne partagent pas leurs données. Un autre navigateur ou un effacement des données de site peut donc présenter un carnet vide. La demande de persistance faite au navigateur n’est pas une garantie de conservation ; conserver le fichier exporté.

## Mettre à jour l’application

Avec le serveur accessible, rouvrir le Carnet et cliquer **Préparer le hors connexion** pour vérifier et préparer le socle courant. Si une nouvelle version est disponible, **Activer la mise à jour** apparaît. Enregistrer ses notes en cours avant de l’activer ; la page se recharge sur la nouvelle version.

L’interface dispose d’un cache versionné. La nouvelle version doit être entièrement préparée avant son activation ; les caches d’images et le carnet sont conservés. Les données généalogiques tentent une lecture réseau à l’ouverture, puis utilisent la dernière copie complète en cas d’échec. Une réponse invalide ne remplace pas cette copie.

Pour le développement : toute évolution des fichiers mis en cache doit aussi changer la version ou révision de `SHELL_CACHE` dans `app/lib/offline-config.js`, et être testée lors d’une mise à jour réelle. Après activation, vérifier la page rechargée ; une simple actualisation peut continuer à servir l’ancien socle tant qu’il n’a pas été remplacé.

## Sur l’iPhone et l’iPad

Le manifeste et les icônes PWA existent. Ils préparent une ouverture autonome depuis l’écran d’accueil d’un navigateur compatible. **Il manque encore l’adresse privée en HTTPS commune aux appareils**, l’authentification et la synchronisation. L’adresse locale du PC ne fournit pas cet accès à elle seule.

Le prochain lot doit permettre d’ouvrir l’application depuis les appareils réels, puis de vérifier installation, portrait/paysage, gestes, clavier, mémoire et conservation du cache. Aucune donnée familiale n’a été publiée et aucun projet Supabase n’a été créé.

Les mécanismes utilisés reposent sur les [service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) et la [politique de stockage du navigateur](https://webkit.org/blog/14403/updates-to-storage-policy/). Ils ne constituent pas une sauvegarde externe.

## Repères pour reprendre le code

| Fichier | Rôle |
|---|---|
| `app/lib/notebook.js` | Modèle, format de sauvegarde version 1, validation, fusion sans écrasement et accès transactionnel à IndexedDB |
| `app/lib/personal-ui.js` | Carnet, éditeur, favoris, choix du fichier, restauration et commandes de cache |
| `app/lib/offline-config.js` | Version de l’application, noms des caches, liste du socle et sélection des URL |
| `app/lib/offline.js` | Préparation, vérification de disponibilité, inventaire et téléchargement des images |
| `app/sw.js` | Installation/activation du socle, interception limitée, dernier arbre valide et images locales |
| `app/manifest.webmanifest` | Nom, portée, URL de lancement et icônes PWA |
| `tests/notebook.test.js` | Huit tests du format, de la fusion, des erreurs et des identités |
| `tests/offline.test.js` | Trois tests des ressources mises en cache |

Base IndexedDB : `heritage-notebook`, version 1. Magasins : `entries` et `settings`. Entrée : `id`, `name`, `birth`, `note`, `favorite`, `updatedAt`. Le contrôle nom/naissance conserve séparément les annotations dont la personne a changé dans un futur export, sans les rattacher silencieusement. Elles restent exportables et sont signalées dans le Carnet ; le rapprochement guidé reste à concevoir.

Tests : **54 réussis, 41 JavaScript + 13 Python**, via `npm test`. Le détail des essais réels et leurs limites est conservé en section 13.13 du README. Les formats de prévisualisation ne remplacent pas les appareils Apple physiques.
