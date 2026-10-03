# Étape 2 — première consultation de l’arbre complet

**24 septembre 2026 · Application 0.5.3 · README 0.6.5**

> Ce guide conserve l’état de l’étape 2. Depuis le 25/09/2026, l’application **0.6.0** ajoute un carnet, des notes, des favoris, la reprise de navigation et la préparation hors connexion. Consulter le [guide de l’étape 3](<C:/Users/cdesmottes/Documents/Codex/Généalogie/docs/etape-3-carnet-autonomie.md>) et le README **0.7.0** pour l’état actuel. Les limites de persistance décrites ci-dessous sont celles de la version historique 0.5.3.

Le [README officiel](<C:/Users/cdesmottes/Documents/Codex/Généalogie/readme.md>) reste le carnet de bord du projet. Ce guide décrit la livraison qui remplace l’extrait de neuf personnes par le corpus entier.

## Ce qui est utilisable

- **16 262 personnes et 4 440 familles**, chargées depuis l’export du 24 septembre 2026 ; 108 personnes de plus que dans l’export d’août.
- Accueil sur **Christophe Desmottes**, avec **Valérie et Rakhel simultanément**, et Timothé et Candice sous l’union avec Rakhel. Le sélecteur « Famille affichée » a été supprimé.
- Clic sur une carte pour consulter sa fiche. Les **rectangles gris** apparaissent uniquement si des parents connus ne sont pas encore déployés sur cette carte ; ils ouvrent la branche parentale concernée. Le bouton « Explorer sa famille » de la fiche conserve le recentrage libre.
- Toutes les unions de la personne centrale sont dessinées, même sans enfant. Chaque descendance garde ses propres parents ; les libellés rappellent les deux personnes de l’union. L’ordre est celui du GEDCOM, sans chronologie inventée lorsque les dates manquent.
- **Ancêtres : de 1 à 5 générations**, avec **3 par défaut** (parents, grands-parents, arrière-grands-parents). **Fratrie cochée par défaut** : Denis et Patricia figurent à côté de Christophe. Le réglage initial affiche 21 personnes.
- Le mode **Ascendance** masque conjoint, fratrie et enfants pour ne garder que les ancêtres et la personne centrale.
- Parents et fratrie restent accessibles dans la fiche ; les enfants sont regroupés par union. Si plusieurs groupes parentaux existent, ils restent séparés.
- Recherche par noms, variantes de noms, lieux et années, avec tolérance aux accents et à l’ordre des mots. Recherche directe par identifiant `@I…@` possible.
- Résultats avec dates, lieu et identifiant pour distinguer les homonymes ; affichage par groupes de 60.
- Événements, notes et sources importés, en lecture seule. Les dates inconnues ou qualifiées restent reconnaissables.
- **Photographies disponibles localement** dans les cartes et les fiches. Les 1 405 références de l’export sont couvertes par 1 116 fichiers distincts, soit 314,71 Mo. Le portrait principal déclaré dans le GEDCOM est utilisé ; la galerie « Photographies » permet d’ouvrir les images en grand. Le portrait de Christophe et ses trois photographies ont été vérifiés.
- Passage à un conjoint ou à un parent pour consulter son ascendance et ses propres unions ; retour à la famille précédente et bouton maison pour revenir à Christophe.

Les cartes gardent l’identité visuelle retenue et la disposition inspirée de MyHeritage. Les vues PC/iPad ont une fiche repliable à gauche ; le téléphone en portrait utilise un panneau inférieur. La vue « Portrait » donne plus de place à la lecture.

## Essayer la livraison

1. [Ouvrir l’application](http://127.0.0.1:8767/) ou [comparer les cinq formats](http://127.0.0.1:8767/review.html).
2. Essayer « Ancêtres » à 1, 3 et 5 générations ; cocher/décocher « Fratrie », puis revenir à 3.
3. Sur Christophe, repérer Valérie et Rakhel sur la même rangée et les deux enfants sous le groupe Christophe–Rakhel.
4. Cliquer sur les rectangles au-dessus de Rakhel pour ouvrir son ascendance ; poursuivre depuis un ancêtre dont le bouton signale encore des parents masqués. Timothé et Candice n’ont pas de bouton lorsque leurs parents sont déjà reliés à leurs cartes.
5. Utiliser le retour pour retrouver la famille précédente.
6. Ouvrir la recherche et essayer `Desmottes`, puis ajouter un prénom, un lieu ou une année.
7. Ouvrir une fiche, puis « Lire le portrait » pour parcourir les détails et les sources disponibles.
8. Sur la fiche de Christophe, ouvrir « Photographies · 3 » et cliquer sur une image pour l’agrandir.

La recherche couvre aussi les groupes séparés et une personne isolée. Le nombre de personnes visibles dans l’arbre est indiqué à côté du total du fichier. « Voir tout l’arbre affiché » ne tente pas de dessiner les 16 262 personnes en même temps : il cadre uniquement la famille explorée.

## Préparer, lancer et reprendre

Depuis PowerShell :

```powershell
Set-Location -LiteralPath 'C:\Users\cdesmottes\Documents\Codex\Généalogie'
python -X utf8 scripts/prepare_tree.py
python -X utf8 scripts/serve.py
```

Les données sont déjà préparées dans le projet actuel. La préparation est nécessaire après changement du GEDCOM ou du lecteur ; elle ne l’est pas à chaque ouverture. Le serveur reste nécessaire et s’arrête avec **Ctrl+C**. Le port peut être changé avec `--port 8768`.

La source par défaut est désormais la copie privée `sources/2026-09-24.ged`, identique au fichier fourni dans Téléchargements. L’ancien export sur `P:` et son audit restent historiques. Pour changer de source ou de personne d’accueil :

```powershell
python -X utf8 scripts/prepare_tree.py --source 'P:/chemin/arbre.ged' --root '@I500003@'
```

L’identifiant d’accueil doit appartenir au fichier choisi. Toutes les unions de la personne d’accueil sont affichées. Le champ historique `meta.rootUnionId` reste dans le JSON mais ne filtre plus la vue. L’application ne propose pas encore d’écran d’import.

La préparation remplace les fichiers générés et ne modifie jamais le GEDCOM. Pour changer le code HTML/CSS/JavaScript, actualiser la page ; pour changer le code du serveur Python, arrêter puis relancer celui-ci.

### Réutiliser les photos ou préparer un futur export

Les images sont déjà téléchargées. Pour reprendre la récupération actuelle puis rattacher les copies :

```powershell
python -X utf8 scripts/download_media.py --source sources/2026-09-24.ged
python -X utf8 scripts/prepare_tree.py
npm run verify:media
```

La récupération réutilise les fichiers intacts à partir de `analysis/media-manifest.json` ; elle ne retélécharge que les éléments absents ou abîmés. Ces derniers nécessitent encore un lien valide. Les formats JPEG, PNG, GIF et WebP sont contrôlés, avec une limite de 25 Mio par fichier. Les erreurs sont consignées sans publier les liens signés et font échouer la commande.

Pour un futur export, conserver une copie privée dans `sources/` et un instantané de l’état préparé, puis passer **le même nouveau chemin** aux deux scripts avec `--source`. La préparation doit suivre la récupération pour inscrire les associations locales dans le corpus. Comparer les comptes et identifiants, lancer les contrôles, puis recharger la page. Le chemin par défaut ne change pas automatiquement. La sauvegarde/restauration depuis l’application reste à construire.

L’état préparé précédant cette actualisation est conservé dans `analysis/archive/before-2026-09-24-media-e07b9ef406b9/`. Cet instantané n’est pas recréé automatiquement à chaque préparation. Une sauvegarde privée doit inclure `sources/`, `app/data/` et le manifeste des images.

## Organisation des données et du code

| Fichier | Rôle |
|---|---|
| `scripts/gedcom.py` | Lecture des enregistrements UTF-8, noms, événements, sources, notes, médias et relations |
| `scripts/prepare_tree.py` | Préparation du JSON de consultation, gzip et rapport d’import |
| `scripts/download_media.py` et `scripts/media_cache.py` | Récupération reprenable, contrôle des formats et empreintes, dédoublonnage et associations locales |
| `sources/2026-09-24.ged` | Source privée actuelle, inchangée |
| `app/data/media/` | Images locales nommées par SHA-256 |
| `analysis/media-manifest.json` | Correspondance ressources/fichiers, tailles et empreintes |
| `analysis/media-download-report.json` | Bilan de la dernière récupération |
| `app/data/tree.json` | Corpus de consultation complet, privé |
| `app/data/tree.json.gz` | Même corpus compressé pour le transfert local |
| `analysis/records.json` | Tous les enregistrements et balises après réunion des continuations, hors du dossier servi |
| `analysis/import-report.json` | Empreinte source, volumes, lignes atypiques et lien non réciproque |
| `app/lib/genealogy.js` | Relations par famille, index de recherche, dates et libellés |
| `app/lib/media.js` | Préférence pour la copie locale, choix du portrait principal, galerie sans doublon |
| `app/lib/tree-layout.js` | Arbre d’occurrences d’ancêtres limité à cinq générations, fratrie, toutes les unions avec enfants séparés, cadrage et zoom |
| `app/app.js` | État de sélection, centre, navigation, recherche et rendu des fiches |
| `scripts/check_tree.mjs` | Contrôle du vrai corpus et mesures locales |
| `analysis/validation-report.json` | Dernier résultat de ce contrôle |
| `scripts/check_media.py` et `analysis/media-validation-report.json` | Contrôle de toutes les copies et de leurs associations au GEDCOM |

Le lecteur garde les événements personnels séparés des événements des familles. La filiation reste rattachée à la famille concernée ; le graphe affiché ne déduit pas les enfants d’un couple à partir de la liste globale des enfants d’une personne.

Les textes importés sont affichés comme texte échappé. Les notes ne peuvent pas injecter des scripts dans la page. Les références originales `file` restent conservées ; `localFile` indique la copie locale dont l’intégrité a été vérifiée. Le marqueur `_PRIM` définit le portrait principal et `_CUTOUT` est conservé. Les images des cartes et du haut de la fiche utilisent le même choix ; la galerie repliable rassemble les médias directs et ceux des événements. Les initiales restent visibles si un médaillon échoue ; la galerie indique explicitement une photographie indisponible.

L’état de navigation et l’index de recherche restent en mémoire. La profondeur et la fratrie suivent le recentrage et sont restaurées par le retour. Un rechargement revient à Christophe, trois générations et fratrie cochée ; il n’y a encore ni préférences persistantes ni cache hors connexion.

## Résultat de l’import

- Source actuelle et copie privée identiques : SHA-256 `72a26859d864978f8343573676e2644e22478a921cea49ed3fa402303e36962b`, 11 361 970 octets.
- **16 262 personnes, 4 440 familles, 970 sources**. Comparaison avec août : 108 identifiants de personnes ajoutés, aucun retiré, 35 noms modifiés et 44 familles supplémentaires.
- **8 127 continuations `CONC`** assemblées en octets avant UTF-8.
- **230 lignes de texte atypiques** conservées et signalées par le nouveau lecteur.
- **Un lien parental non réciproque** : la déclaration `FAMC` avec qualification `Adopted` d’une personne existe dans sa fiche mais manque dans la liste d’enfants de la famille. Ce lien explicitement déclaré est conservé et signalé, sans modifier l’original.
- **12 groupes** dans le graphe consolidé, dont un de 15 101 personnes. La recherche atteint tous les groupes.
- JSON : **22,72 Mo** ; gzip : **2,00 Mo**. Le navigateur reçoit gzip lorsqu’il le prend en charge. Les données sont décompressées en mémoire.
- Médias : **1 405 références**, **1 381 ressources**, **1 116 fichiers distincts**, **314 713 786 octets**. Les octets récupérés restent inchangés ; certains fichiers sont des recadrages ou des vignettes fournis par l’export.

Le compteur de texte atypique diffère de celui de l’analyse historique : les deux scripts ont des règles de lecture différentes. L’ancien audit reste conservé ; le rapport d’import actuel fait foi pour cette version applicative.

L’import prend en charge le GEDCOM UTF-8 fourni. Les balises non interprétées sont conservées dans les enregistrements, mais toutes n’ont pas une présentation spécialisée dans l’interface. Ce n’est pas un outil de réexport généalogique sans perte.

## Vérifications

```powershell
npm test
npm run verify:tree
npm run verify:media
```

Sans npm, les commandes équivalentes sont :

```powershell
node --test
python -X utf8 -m unittest discover -s tests -p test_*.py
node scripts/check_tree.mjs
python -X utf8 scripts/check_media.py
```

**43 tests automatisés réussis : 30 JavaScript et 13 Python**, sur données synthétiques. Ils couvrent les continuations UTF-8, textes atypiques, références invalides, liens non réciproques, familles multiples, qualifications parentales, homonymes, pagination, dates, profondeur, grandes fratries, ancêtres partagés, cycles, filiations alternatives, unions multiples et indicateurs de branche. Les tests médias vérifient la priorité locale, le portrait principal, les chemins et domaines refusés, la reprise, l’intégrité, les limites de téléchargement et la publication concurrente de fichiers identiques.

Le contrôle du vrai fichier est distinct : **48 786 vues** parcourues aux profondeurs 1, 3 et 5, avec fratrie et toutes les unions ; parents et enfants de chaque union préservés, aucune carte superposée ni coordonnée invalide, **77 cartes au maximum** à cinq générations. Les répétitions d’un même ancêtre sont des occurrences légitimes, marquées `↗↗` ; le compteur principal compte les personnes distinctes. Rapport : `analysis/validation-report.json`. Ce contrôle Node ne mesure pas Safari ni les appareils mobiles.

Le contrôle des médias est distinct : toutes les 1 405 associations au GEDCOM et les 1 116 fichiers locaux passent la vérification de chemin, présence, taille et SHA-256. Rapport : `analysis/media-validation-report.json`, sans requête distante.

Contrôles dans le navigateur : profondeur 1/3/5, affichage de Denis et Patricia, mode Ascendance, retour avec réglages conservés, unions de Christophe, branche Bismuth et retour, recherche globale, homonymes, pagination 60/120, personne isolée, vue d’ensemble d’une famille de 19 enfants et cinq formats. Le panneau inférieur réserve de la place à la carte sélectionnée, avec les contrôles d’ascendance et de fratrie. La négociation gzip et la réponse non compressée ont été vérifiées.

En 0.5.3 : portrait de Christophe chargé dans la carte et la fiche, trois images de sa galerie disponibles localement, aucune image externe dans les vues contrôlées. Les cinq formats présentent le portrait sans débordement horizontal global. Ces prévisualisations ne remplacent pas les essais sur les appareils physiques.

## Limites et prochaine livraison

- **Consultation uniquement** : aucune création ou édition de personne.
- Le réglage porte sur les ancêtres de la personne centrale, jusqu’à cinq générations ou jusqu’aux informations disponibles. L’ascendance du conjoint se consulte en ouvrant sa branche.
- Les enfants restent sur **une génération par union de la personne centrale**. Les familles des frères/sœurs, oncles/tantes, cousins et demi-fratries d’autres groupes ne se déploient pas automatiquement.
- Si un ancêtre a plusieurs filiations, la première déclarée est développée ; un message le signale et son bouton de branche permet de choisir une autre famille parentale. Les cycles sont interrompus, les ancêtres communs restent sur chaque chemin.
- PC/iPad : vue d’ensemble adaptée. Téléphone portrait : une fiche ouverte conserve la carte sélectionnée à une taille lisible ; modifier les réglages ferme la fiche et cadre tout le groupe. Le zoom à 100 % permet ensuite de lire les cartes.
- Les photographies de cet export sont désormais conservées sur le PC et ne dépendent plus de l’expiration des liens MyHeritage. Le serveur local reste nécessaire. Le cache PWA sur les appareils mobiles, sa politique de téléchargement et la sauvegarde/restauration intégrée restent à réaliser.
- Les notes importées sont consultables ; les notes personnelles, favoris et sauvegardes appartiennent à l’étape 3.
- Aucune installation PWA, aucun hébergement, compte Supabase ou transfert vers un service externe.
- Le serveur écoute uniquement sur **127.0.0.1**. L’URL est propre à ce PC et ne constitue pas encore un accès depuis l’iPhone ou l’iPad physiques.
- Les essais matériels, le pincement du graphe et les mesures de mémoire sur iOS/iPadOS restent à réaliser.

Les dossiers `sources/`, `analysis/` et `app/data/` contiennent des informations familiales privées et sont exclus par `.gitignore`. Le serveur local sert uniquement `app/`, y compris les images destinées à la consultation ; aucune publication publique ne fait partie de cette livraison.

## Historique de ce lot

- **0.3.0 / README 0.4.0** : arbre complet, recherche, unions et fiches ; 19 tests.
- **0.4.0 / README 0.5.0** : profondeur de 1 à 5 générations, fratrie, ascendance seule, traitement des ancêtres partagés et cadrage ; 24 tests.

- **0.5.0 / README 0.6.0** : suppression du sélecteur d’union, conjoints visibles ensemble, descendance propre à chaque union et libellés ; 28 tests.

- **0.5.1 / README 0.6.1** : rectangles réservés aux ascendances connues non déployées, calcul par occurrence et accès direct à la filiation masquée ; 32 tests.
- **0.5.2 / README 0.6.2** : portraits des médias référencés dans les cartes, galerie repliable dans les fiches, monogramme de secours et chargement différé ; 34 tests.
- **README 0.6.3 / application 0.5.2 inchangée** : diagnostic des trois liens expirés de Christophe et réponses HTTP 403 ; correction du bilan de l’étape 2, photos encore à récupérer et à valider. Les 34 tests ne prouvent pas la disponibilité distante des images.
- **README 0.6.4 / application 0.5.2 inchangée** : l’utilisateur ne possède que le GEDCOM ; les 1 381 URL distinctes indiquent la même expiration au 28/08. Un nouvel export incluant les liens photo est proposé sous réserve d’accès au compte MyHeritage et de vérification des nouveaux liens ; aucune récupération encore effectuée.
- **0.5.3 / README 0.6.5** : nouvel export reçu et actualisation complète autorisée ; 16 262 personnes, 1 116 fichiers photo locaux, portrait principal et galerie agrandissable. 43 tests, 48 786 vues du vrai corpus et toutes les associations photo vérifiées ; portrait et galerie de Christophe visibles.
