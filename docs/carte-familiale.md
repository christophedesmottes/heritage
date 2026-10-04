# Carte familiale — Héritage 0.18.0

Sélectionnez une personne, puis ouvrez **Carte** dans les outils de l’arbre. Cette personne devient la référence jusqu’à la fermeture de la carte. Pour changer de référence, revenez à l’arbre, sélectionnez une autre personne et rouvrez Carte.

## Explorer

Le périmètre propose la référence seule, ses ascendants, ses descendants ou tout l’arbre. Les branches incluent leur référence et suivent les filiations déclarées dans l’export. Filtrez par naissance, mariage, résidence, immigration, émigration ou décès, par années, ou par nom/lieu. Les dates inconnues sont exclues lorsqu’une période est demandée ; les plages de dates sont comparées à cette période.

Les événements localisés sont regroupés en points. Cliquez un point ou un lieu dans la liste pour voir les personnes, dates et écritures originales. Un mariage familial est compté une fois pour ses partenaires. Un bouton de personne ouvre sa fiche. La liste affiche initialement 80 lieux ; **Afficher tous les lieux** révèle la suite. Le détail affiche 80 événements au maximum ; affinez les filtres si nécessaire.

La molette et les boutons changent le zoom ; le glissement au clic gauche déplace la carte sans sélectionner du texte ou activer le point traversé. Sur écran tactile, glissez ou pincez. Les filtres gardent le cadrage et le zoom ; **Tout voir** recadre explicitement les lieux du périmètre. La carte reste indépendante du zoom de l’arbre général.

**Relier les lieux de la référence** montre les liaisons entre ses événements datés et localisés. La liste **Lieux datés** en donne le détail. Ce ne sont ni des itinéraires ni des dates de voyage : une résidence indique un lieu attesté à cette date. La naissance d’un enfant ne place pas automatiquement son parent dans cette ville. Les dates approximatives, ouvertes, les intervalles, les dates inconnues, les événements non localisés et les années identiques ne produisent pas de liaison certaine. Les liaisons traversant l’antiméridien sont omises. L’ordre de la liste reste indicatif pour les dates qui se chevauchent.

## Rapprocher les variantes

Ouvrez **Rapprocher les lieux et confirmer les variantes**. Les accents, majuscules, ponctuation et abréviations Saint/Sainte sont normalisés pour la comparaison. Les pays français/anglais et certaines formes administratives sont rapprochés. Le pays et les éléments administratifs servent à distinguer les communes homonymes. L’écriture originale du GEDCOM reste affichée et n’est jamais modifiée.

Un rapprochement automatique exige une concordance dans le référentiel et un contexte suffisant. Les contradictions administratives, noms seuls ambigus, préfixes postaux belges non vérifiables et lieux trop vagues restent à confirmer. Un nom de pays seul n’est pas placé au centre du pays. Les départements et les anciens noms de communes ne sont pas remplacés arbitrairement par une ville moderne.

1. Sélectionnez une écriture à vérifier.
2. Examinez les propositions : commune, contexte administratif, pays et coordonnées.
3. Si nécessaire, cherchez une commune dans le référentiel, en ajoutant le code pays (FR, BE, US…). Les 30 premières propositions sont affichées ; précisez la recherche si elles sont trop nombreuses.
4. Après vérification, cliquez **Confirmer ce lieu**. Les écritures confirmées vers la même commune partagent un point.
5. Si le lieu reste inconnu ou ne doit pas être placé, utilisez **Écarter de la carte**.

**Inclure les lieux déjà rapprochés ou écartés** permet de revenir sur un rapprochement automatique ou personnel. **Annuler mon choix** rétablit la proposition initiale. Un choix vaut pour les événements portant cette même écriture normalisée dans l’arbre : vérifiez que ce nom ne désigne pas plusieurs communes différentes avant de confirmer.

## Sauvegarder les choix

Les confirmations sont propres au navigateur, séparées du Carnet et de sa synchronisation. **Exporter mes rapprochements** sauvegarde uniquement les écritures normalisées et identifiants géographiques, sans personnes ni événements. Ce fichier peut néanmoins contenir vos noms de lieux : gardez-le privé.

Sur un autre appareil, choisissez **Importer des rapprochements**, examinez le nombre de choix lus puis **Confirmer l’import**. Les choix importés remplacent les choix existants pour les mêmes écritures ; les autres sont conservés. Un fichier invalide est entièrement refusé. Conservez un export avant un import. L’effacement des données du navigateur efface les confirmations locales ; le fichier exporté permet de les restaurer.

Les choix sont associés à l’arbre familial, pas aux identifiants des personnes. Ils sont réutilisés lors d’un prochain GEDCOM pour les mêmes écritures, même si les personnes changent d’identifiant. Une nouvelle écriture peut nécessiter un nouveau rapprochement. Aucun événement, note ou favori n’est modifié.

## Référentiel et hors connexion

Le fond de carte est un dessin géographique simplifié, sans routes ni adresses. Les coordonnées représentent des centres de localités, pas les domiciles ou lieux précis de cérémonie. Le référentiel local couvre les communes françaises actuelles, les localités belges de GeoNames et une sélection de villes mondiales. Il ne garantit pas l’exhaustivité des hameaux, lieux historiques ou homonymes. Si une commune manque, écartez provisoirement l’écriture et signalez-la pour compléter le référentiel ; aucune coordonnée n’est devinée.

Les lieux familiaux ne sont envoyés à aucun géocodeur et aucune tuile distante n’est utilisée. Le fichier public `places.json.gz` (environ 4 Mo) fait partie du cache de l’application. Après mise à jour complète et ouverture de l’arbre, la carte fonctionne hors connexion pendant la validité de l’accès familial. Elle ne prolonge ni l’accès ni la disponibilité de photos non préparées.

Sources publiques : [API Découpage administratif](https://geo.api.gouv.fr/decoupage-administratif/communes), Licence Ouverte ; [GeoNames](https://download.geonames.org/export/dump/), CC BY 4.0 ; [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), domaine public. Les liens d’attribution restent visibles dans la carte.

## Validation après publication

- Ouvrir **Carnet**, vérifier la mise à jour **0.18.0**, puis ouvrir **Carte**.
- Tester les lieux d’une personne connue, ses ascendants, les mariages et une période.
- Zoomer puis changer les filtres : le cadrage doit rester ; **Tout voir** doit recadrer.
- Confirmer un homonyme, fermer puis rouvrir la carte ; exporter ses choix et les importer sur un autre appareil.
- Sur iPhone et iPad réels : vérifier pincement, glissement, rotation, formulaires et mode avion après mise à jour complète.
- Une fois l’accès familial fermé ou expiré, la carte ne doit pas permettre de consulter l’arbre.

Cette livraison ne demande aucun nouveau script Supabase. Les anciens scripts de synchronisation restent nécessaires uniquement s’ils n’ont pas été installés. Le guide utilisateur complet existant n’a pas été régénéré dans ce lot ; ce document décrit la nouvelle fonction.
