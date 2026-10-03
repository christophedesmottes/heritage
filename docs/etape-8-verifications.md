# Espace À vérifier — Héritage 0.16.0

Dans les outils au-dessus de l’arbre, cliquer sur **À vérifier**, à côté de **Parenté**. La première ouverture analyse l’export chargé ; les résultats sont gardés en mémoire jusqu’à son rechargement. La vue commence par les dates pour privilégier les contrôles les plus ciblés.

## Quatre catégories

- **Dates à vérifier** : chronologies manifestement inversées, dates futures, durée de vie supérieure à 120 ans, dates de mariage et de filiation à relire. Les dates partielles et les intervalles sont respectés. ABT/EST/CAL ont une marge de deux ans pour ce contrôle, pas une précision ajoutée à vos données. Dates non interprétables ignorées. Adoption/autre qualification non biologique exclue du contrôle parent/enfant.
- **Informations manquantes** : date de naissance, lieu d’une naissance datée ; date/lieu d’un décès déclaré. L’absence de décès ne signifie pas qu’une personne est vivante.
- **Doublons possibles** : concordance forte de nom normalisé et de naissance. Date précise identique, ou année identique avec lieu ou parents concordants. Les homonymes restent possibles ; les dates approximatives ne sont pas utilisées. Aucun rapprochement ni fusion automatique.
- **Citations de sources** : événement sans citation propre dans l’export. Les sources générales de fiche ou de famille sont mentionnées séparément. Cela ne signifie pas qu’aucun acte existe dans vos archives ou dans MyHeritage.

Rechercher par nom ou texte du signalement. Le périmètre peut être tout l’arbre, les ascendants ou les descendants de la personne sélectionnée à l’ouverture. Cette référence est affichée. Les groupes concernant plusieurs personnes restent affichés si au moins une est dans la branche. Les compteurs par catégorie sont globaux ; le compteur des résultats correspond aux filtres actifs.

Les résultats sont affichés par groupes de 60. **Afficher les signalements suivants** complète la liste. Cliquer sur une personne ferme la liste, recentre l’arbre et ouvre sa fiche. Pour un groupe de doublons, comparer les différentes fiches. Les groupes très importants proposent leurs 20 premières fiches ; utiliser aussi la recherche globale.

## Traiter une piste

Examiner les dates, événements et sources de la fiche. Utiliser vos notes personnelles pour consigner vos recherches. Si une correction est nécessaire, l’effectuer dans MyHeritage, puis fournir un nouvel export. Les signalements seront recalculés avec cet export. Cette première version ne propose ni correction de l’arbre, ni état « résolu », ni suppression de signalement.

Aucun changement Supabase nécessaire pour cet espace ; il fonctionne sur l’arbre disponible, y compris hors connexion une fois celui-ci préparé. La synchronisation du Carnet demeure celle de 0.15.2 et doit être installée/validée séparément. Toutes les pistes sont calculées localement, sans service d’analyse externe.

## Vérifier après publication

Ouvrir les quatre catégories, rechercher un nom, filtrer une branche, ouvrir une fiche, essayer la pagination. Refaire sur iPhone/iPad, et hors connexion après préparation. Ce contrôle est partiel : aucun résultat ou aucune piste dans une catégorie ne garantit l’absence d’erreurs dans l’arbre.
