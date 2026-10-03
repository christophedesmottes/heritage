# Étape 1 — cadrage et prototype responsive

**23 septembre 2026 · Prototype 0.2.1 · README 0.3.1**

> **Document historique de l’étape 1.** L’application actuelle est en **0.3.0** et consulte tout l’arbre. Voir le [guide de l’étape 2](<C:/Users/cdesmottes/Documents/Codex/Généalogie/docs/etape-2-arbre-complet.md>) et le README **0.4.0** pour les commandes et le nombre de tests actuels.

Le carnet de bord officiel reste [readme.md](<C:/Users/cdesmottes/Documents/Codex/Généalogie/readme.md>). Ce document précise le périmètre de la première livraison visuelle et les critères de passage à la suivante.

## Décisions confirmées

- L'utilisateur a autorisé le démarrage de l'application le 23 septembre 2026. La suspension précédente est levée.
- **Consultation d'abord** : arbre complet, recherche, navigation familiale et portraits à l'étape 2. L'édition des personnes, filiations et événements n'entre pas dans cette première version.
- **Notes personnelles et favoris à l'étape 3**, avec autonomie et sauvegardes.
- Design : identité **Héritage**, navigation familiale inspirée de **Constellation**, puis disposition de consultation rapprochée de la capture **MyHeritage** fournie par l’utilisateur. La révision 0.2.0 place la fiche à gauche et donne la priorité à l’arbre ; aucune création ou modification de personne.
- Appareils : PC, **iPhone 15 Pro**, **iPad Pro 11 pouces de 3e génération** ; portrait et paysage sur les appareils mobiles. Le numéro de série n'est pas nécessaire au projet et n'est pas conservé dans ses fichiers.

## Ce qui est livré pour cette étape

Un prototype local, interactif et responsive utilisant les **neuf personnes réelles** de la branche de Martin Desmottes. Il permet de :

1. Sélectionner une carte compacte dans l’arbre et ouvrir sa fiche de détails.
2. Passer du mode arbre à un portrait plus large.
3. Rechercher dans les neuf personnes, avec tolérance aux accents et à l'ordre des mots.
4. Recentrer l'arbre sur une autre personne de l'extrait et revenir à la famille précédente.
5. Basculer entre famille proche et parents.
6. Déplacer l'arbre, régler le zoom ou afficher une vue d'ensemble.
7. Changer de format sans perdre la personne sélectionnée.
8. Masquer la fiche pour agrandir l’espace de navigation et parcourir les proches depuis cette fiche.

Un clic sur une carte sélectionne la personne sans changer la famille affichée. Les deux rectangles gris reliés au-dessus d’une carte et « Explorer sa famille » changent le centre de l’arbre. Ces rectangles remplacent les flèches sous les cartes depuis la version 0.2.1 ; ils apparaissent sur les cartes autres que la personne centrale. Le libellé accessible précise « Afficher la branche familiale de … ». Les branches hors de l’extrait ne sont pas chargées et le déploiement de plusieurs branches simultanées n’est pas implémenté. Les sections Événements, Biographie et Famille immédiate sont repliables. La maison revient à Martin, la flèche de retour à la famille précédente et la cible recadre la sélection. Le `+` de la barre de zoom agrandit seulement l’arbre.

Les personnes absentes de l'extrait sont signalées comme **hors extrait** ; leur absence n'est pas présentée comme l'absence de lien dans le GEDCOM. Les dates inconnues ou approximatives restent visibles. Les prénoms longs peuvent être abrégés sur les cartes ; le nom complet reste accessible dans la recherche, le portrait et le libellé d'accessibilité.

Le prototype ne charge pas les 16 154 personnes. Il n'offre encore ni installation PWA, ni authentification, ni synchronisation, ni notes, ni favoris, ni sauvegarde. Un rechargement de la page revient au point de départ : l'état de navigation est conservé pendant la session d'affichage, pas durablement.

## Parcours et dispositions

| Format de prévisualisation | Disposition | Interaction principale |
|---|---|---|
| PC, 1 440 × 960 pixels CSS | Grand arbre à droite, fiche repliable à gauche | Sélection et détails simultanés ; cartes compactes |
| iPhone 15 Pro, 393 × 852 | Arbre et fiche dans un panneau inférieur | Carte sélectionnée recadrée au-dessus de la fiche ; lecture complète disponible |
| iPhone 15 Pro, 852 × 393 | En-tête compact, fiche latérale repliable | Masquer les détails pour parcourir l’arbre dans la faible hauteur disponible |
| iPad Pro 11″, 834 × 1 194 | Fiche à gauche et arbre dans la zone restante | Replier la fiche pour donner toute la largeur à l’arbre |
| iPad Pro 11″, 1 194 × 834 | Fiche à gauche et grand arbre à droite | Consultation simultanée, adaptée à la largeur |

Les dimensions ci-dessus sont des **repères de simulation**, pas une garantie de la zone utile exacte dans Safari. Les barres du navigateur, le clavier, le zoom du système et les zones de sécurité modifient l'espace disponible. Les caractéristiques physiques des écrans sont documentées par Apple : [iPad Pro 11″ de 3e génération](https://support.apple.com/fr-fr/111897), [iPhone 15 Pro](https://support.apple.com/fr-fr/111829).

La page des formats redimensionne une même instance du prototype dans un cadre. Ce cadre n'est pas un émulateur iOS. Les commandes de zoom concernent l'arbre ; le défilement tactile natif est préparé, mais le pincement à deux doigts propre au graphe n'est pas implémenté.

## Design conservé et précisé

- Papier clair `#f8f7f2`, panneaux crème, fond d’arbre `#f0f2ed` et vert `#315b45` ; accent doré discret.
- Georgia pour les noms et titres, police système pour les commandes.
- Boutons sélectionnés et personne centrale distingués visuellement ; les libellés rendent aussi ces états accessibles.
- Cartes horizontales de 184 × 82 pixels avant zoom, médaillon rond, bordures fines vert grisé ou rose, liens familiaux tracés en arrière-plan ; sélection verte et repère doré sur le centre.
- Aucune image de visage générée : les initiales sont un repère typographique, pas une photographie.
- Mode clair pour ce prototype. Une finition du thème sombre pourra être traitée ultérieurement.
- Commandes principales et zones d’accès aux branches agrandies avec `pointer: coarse` ; leur taille apparente dans l’arbre suit le zoom. Le contrôle tactile sur appareils réels reste nécessaire.

Le défilement horizontal est limité à l'arbre lorsqu'il ne tient pas en largeur. La page elle-même ne doit pas déborder. La commande « Voir tout l’arbre affiché » offre un aperçu réduit ; le zoom de 100 % permet de retrouver les tailles de lecture normales.

## Socle technique de cette livraison

Le prototype utilise **HTML, CSS et JavaScript en modules**, sans dépendance distante et sans étape de compilation. Le choix permet de reprendre directement la direction approuvée et de séparer dès maintenant interface, données et règles généalogiques.

```text
app/index.html            Structure et commandes
app/styles.css            Identité et adaptations aux écrans
app/app.js                État de navigation, arbre, portrait et recherche
app/lib/genealogy.js      Recherche, dates, relations et événements de mariage
app/lib/tree-layout.js    Disposition de la famille immédiate, tracés et zoom
app/data/demo.json        Extrait privé généré localement, ignoré par Git
app/review.html           Comparaison des cinq formats
scripts/prepare_demo.py   Préparation de l'extrait depuis l'index d'analyse
scripts/serve.py          Serveur local limité à app/ et à 127.0.0.1
tests/genealogy.test.js   Cinq tests utilisant uniquement des données fictives
tests/tree-layout.test.js Trois tests de disposition, cadrage et zoom
design/archive/          Copies des cinq maquettes historiques
```

Le client ne dépend plus du système de widgets de Codex. Python sert à préparer les données et à ouvrir le serveur de développement ; Node sert aux tests. L'application dans le navigateur utilise uniquement les fichiers statiques locaux.

L'architecture cible reste une **PWA**. Le prototype n'implémente pas encore son manifeste ni son cache hors connexion. Les choix d'hébergement et de services de données restent à finaliser avant déploiement ; aucun compte externe n'a été configuré. Supabase reste une proposition pour les étapes nécessitant accès privé et synchronisation.

Les cinq anciennes sources HTML ont été copiées dans le projet. Elles conservent leur état historique et ne sont pas les fichiers à modifier pour cette nouvelle interface. Les données personnelles et ces archives sont exclues d'un futur ajout Git par `.gitignore` ; une publication demandera toujours de préparer explicitement les fichiers à déployer.

## Lancer et vérifier

Depuis PowerShell :

```powershell
Set-Location -LiteralPath 'C:\Users\cdesmottes\Documents\Codex\Généalogie'
python -X utf8 scripts/prepare_demo.py
python -X utf8 scripts/serve.py
```

La préparation est nécessaire à la première installation et après modification de l'extrait. Le fichier est déjà préparé dans l'espace de travail actuel. Si l'index d'analyse n'est pas présent, il faut d'abord le régénérer avec le GEDCOM accessible sur `P:`.

- [Ouvrir le prototype](http://127.0.0.1:8767/)
- [Comparer les formats](http://127.0.0.1:8767/review.html)

Le serveur reste nécessaire et s'arrête avec **Ctrl+C** dans le terminal qui le lance. Le port peut être changé avec `--port 8768`. Ces adresses sont locales au PC : elles ne permettent pas encore à l'iPad de se connecter ni de fonctionner avec le PC éteint.

Tests reproductibles, sans le fichier généalogique privé :

```powershell
Set-Location -LiteralPath 'C:\Users\cdesmottes\Documents\Codex\Généalogie'
node --test
```

**Résultat de cette livraison : 8 tests automatisés, 8 réussis.** Ils vérifient la recherche avec accents et homonymes, les liens absents de l'extrait et doublons de références, le périmètre parents et le recentrage logique, les dates incertaines/inconnues, et les mariages rattachés aux deux partenaires. Les trois tests ajoutés en 0.2.0 couvrent la séparation des générations et le défilement nécessaire au panneau mobile, le cadrage de la vue d’ensemble et la conservation du point central lors du zoom.

Contrôles de la révision 0.2.0 dans le navigateur : sélection de Marie Thérèse avec naissance inconnue, recherche sans accents, exploration de sa famille et retour, fermeture/réouverture de la fiche, lecture et retour, réduction aux parents, zoom et vue d’ensemble. Les cinq formats cibles et la largeur de 320 pixels ont été contrôlés sans débordement global constaté. La réserve de défilement a été augmentée pour garder un descendant visible au-dessus du panneau mobile ; le cadrage d’un couple cède la priorité à la sélection sur les petites largeurs. Aucun essai matériel sur iPhone ou iPad n’est revendiqué.

Contrôle complémentaire de la version **0.2.1** : rendu des rectangles gris, ouverture de la branche de Martin depuis Marie et retour vérifiés dans le navigateur. Les **8 tests automatisés** restent réussis ; aucun nouveau test cosmétique ajouté.

## Suite de la livraison

Le prototype est prêt à être parcouru pour recueillir les retours sur le design et la navigation. Les modifications demandées à ce stade peuvent être intégrées avant de généraliser l'interface.

L'étape 2 doit ensuite rendre toutes les personnes accessibles, avec recherche globale et navigation au-delà de l'extrait. Avant de la considérer livrée, il faudra :

- Afficher les 16 154 personnes dans le répertoire et retrouver les groupes séparés.
- Naviguer correctement dans les unions multiples et les filiations, sans mélange de familles.
- Importer et présenter les informations nécessaires aux portraits avec une provenance lisible.
- Mesurer temps de chargement, recherche et navigation sur les appareils cibles.
- Conserver la lisibilité et les interactions établies ici.

La conservation complète des notes, sources et balises du GEDCOM reste un travail d'import spécifique. Le petit index et les fonctions de cette étape ne constituent pas un importeur généalogique exhaustif.
