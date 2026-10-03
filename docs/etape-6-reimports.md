# Nouveaux exports MyHeritage — Héritage 0.12.0

Le prochain GEDCOM sera préparé à côté de l’arbre actuel. Son import ne remplace pas immédiatement les données consultées et ne touche pas aux carnets des appareils.

## Ce que vous aurez à fournir

Un export GEDCOM complet, en UTF-8, avec les photos incluses sous forme de liens MyHeritage. Conserver le fichier original. Les liens de photos peuvent expirer : transmettre l’export récent dès que possible. Si des photos ne sont pas téléchargeables, elles seront signalées et la préparation ne sera pas déclarée prête à publier.

Avant le remplacement, enregistrer les notes en cours puis **Exporter le carnet** sur chaque appareil et dans chaque contexte utilisé (Safari et icône peuvent être distincts). Les carnets restent personnels à chaque navigateur ; ce travail n’ajoute pas de synchronisation.

## Conservation des notes et favoris

Les numéros GEDCOM peuvent changer. Le script rapproche les personnes grâce à leur `_UID` MyHeritage lorsqu’il est unique dans les deux exports, puis conserve leur identifiant Héritage. Les relations de parenté sont réécrites avec ces identifiants conservés.

Un nom ou une naissance corrigés ne font pas perdre le carnet : les anciennes identités vérifiées accompagnent la fiche. À la prochaine ouverture, une transaction actualise les libellés du carnet en conservant le texte, le favori et la date de modification. Les anciennes sauvegardes JSON restent restaurables si leur export figure dans l’historique reconnu du nouvel arbre.

Un identifiant d’une personne absente reste réservé. Une nouvelle personne réutilisant son numéro GEDCOM reçoit un autre identifiant Héritage. Les notes de personnes absentes restent stockées et exportables, sans rattachement à une autre personne. Une personne retrouvée dans un export ultérieur par son `_UID` reprend son identifiant.

Sans `_UID` fiable, un nom identique fournit seulement une suggestion. Les doublons et correspondances incertaines doivent être examinés ; aucun transfert de carnet ne se fait par simple ressemblance. Les réservations sont incluses dans l’arbre privé pour survivre à une sauvegarde complète et sa restauration. Conserver également le registre d’identités et les rapports de préparation.

## Préparation locale par Codex

Pour le premier nouvel export, depuis le dossier du projet :

```powershell
python -X utf8 scripts/reimport.py --source "sources/nouvel-export.ged" --previous-tree "app/data/tree.json" --previous-source "sources/2026-09-24.ged" --output "imports/nouvel-export" --download-photos
```

Le dossier de sortie doit être nouveau. Une sortie existante est refusée. Le script vérifie que l’ancien GEDCOM correspond à l’ancien arbre avant tout rapprochement. Il copie l’interface et le nouveau corpus dans le dossier de préparation, récupère uniquement les photos manquantes et vérifie les empreintes des photos réutilisées. Le fichier source, les anciens médias et l’arbre actif restent intacts.

Pour les exports suivants, utiliser comme `--previous-tree` et `--previous-source` les fichiers de **la dernière préparation réellement mise en service**, par exemple `imports/dernier-export/app/data/tree.json` et `imports/dernier-export/sources/source.ged`. Ne pas repartir systématiquement de septembre 2026. Ne pas utiliser `prepare_tree.py` pour remplacer un export : il refuse désormais ce remplacement afin de protéger les identités du carnet.

Le bilan `analysis/reimport-report.json` contient les correspondances, les fiches modifiées, les ajouts, les absences, les cas à examiner et les photos à envoyer. `readyForPublication` est un contrôle technique ; le bilan généalogique reste à relire, notamment les absences et les relations modifiées.

Si une correspondance doit être validée manuellement, fournir un fichier JSON à `--matches`, par exemple :

```json
{ "@NOUVEL_ID@": "@ANCIEN_ID_HERITAGE@" }
```

Relancer dans un autre dossier de préparation. Deux nouvelles personnes ne peuvent pas reprendre la même identité. Si la personne d’accueil a disparu, fournir `--root` avec l’identifiant GEDCOM d’une nouvelle personne d’accueil ; cela reste un choix explicite.

## Mise en service du nouvel export

Codex préparera les livraisons exactes après réception et contrôle de votre export. Vous pourrez continuer à publier vous-même :

1. Conserver les anciens fichiers et sauvegardes, puis relire le bilan et vérifier quelques familles et photos dans l’aperçu local.
2. Envoyer dans `heritage-private` le nouveau `tree.json` sous `<treeId>/exports/<nouvelle empreinte>/tree.json` et les nouveaux fichiers photo sous `<treeId>/media/`. Les noms des photos sont leurs empreintes. Les anciens fichiers restent disponibles pour revenir en arrière.
3. Mettre à jour `HERITAGE_SOURCE_SHA` dans les secrets de la fonction Supabase, en gardant `HERITAGE_TREE_ID`, le PIN et les autres paramètres. La configuration publique de la livraison GitHub doit porter exactement la même empreinte.
4. Publier la nouvelle livraison publique préparée par Codex. Aucun GEDCOM, arbre JSON privé, rapport nominatif ou photo familiale ne va dans GitHub.
5. Ouvrir en ligne dans chaque contexte habituel, vérifier version, nouvelles personnes, photos et carnet. Refaire **Préparer le hors connexion** pour ce nouvel export : les anciennes copies hors connexion ne prouvent pas que les nouvelles données sont téléchargées.

Le remplacement distant est une opération coordonnée : un court décalage entre les configurations peut empêcher la lecture. En cas de retour à l’ancien export, rétablir ensemble son interface et son empreinte côté serveur ; les sauvegardes de carnets restent à conserver.

## Validation de ce lot

152 tests automatiques réussis : renumérotations croisées, corrections, homonymes sans UID, UID dupliqués, identifiants réutilisés, disparition puis retour, réservations portables, décisions invalides, dossier non écrasé, anciennes sauvegardes et téléchargement des seules nouvelles photos. Un test navigateur utilise réellement IndexedDB : note et favori conservés lors d’une correction, fiche absente préservée, écriture et réouverture vérifiées.

Préparation isolée avec l’export actuel : 16 262 personnes rapprochées, 4 440 familles, aucune ambiguïté ni absence, 1 381 ressources photo réutilisées correspondant à 1 116 fichiers distincts, aucun téléchargement. Inventaire de transfert privé vérifié. Ce contrôle ne remplace pas l’examen de votre prochain export, qui n’a pas encore été fourni.
