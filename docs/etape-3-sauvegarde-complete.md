# Sauvegarde complète et reprise d’Héritage

30/09/2026 · Application **0.9.0** · Documentation **0.10.1**

Actualisation 0.12.0 : les nouvelles archives complètes utilisent le format 2 et incluent aussi le module et la page de mise à jour. Le vérificateur actuel continue à reconnaître les anciennes archives de format 1. Les réservations d’identifiants des réimports accompagnent l’arbre privé dans la sauvegarde.

## Créer la sauvegarde depuis le PC

1. Ouvrir [Héritage local](http://127.0.0.1:8767/) dans le navigateur qui contient vos notes. Si le serveur est arrêté, lancer `npm start` depuis le dossier du projet.
2. Enregistrer les notes en cours, puis ouvrir **Carnet → Tout sauvegarder**.
3. Cliquer sur **Créer la sauvegarde complète** et garder la page ouverte pendant la préparation. Le serveur vérifie les fichiers avant de renvoyer le ZIP.
4. Attendre **Téléchargement lancé**, puis vérifier la présence du fichier `heritage-complet-…zip` dans les téléchargements du navigateur. Ce message confirme le lancement du téléchargement, pas sa conservation sur un autre support.
5. Copier le ZIP sur un support privé distinct du PC, par exemple votre disque externe. Aucune copie externe n’est effectuée automatiquement.

La création est disponible avec le serveur local à jour et les fichiers originaux sur le PC. L’interface familiale hébergée ne propose pas cette commande. Les aperçus iPhone/iPad du PC vérifient la présentation ; ils ne donnent pas accès au disque du PC depuis un appareil mobile.

## Contenu du ZIP

| Élément | Emplacement dans le ZIP |
|---|---|
| Arbre préparé et photographies référencées | `app/data/tree.json`, `app/data/media/` |
| GEDCOM original | `sources/source.ged` |
| Notes et favoris enregistrés dans ce navigateur | `carnet.json` |
| Programme de consultation, serveur et outils de sauvegarde | `app/` hors données, `scripts/` |
| Guide de reprise | `LIRE-MOI.txt` |
| Inventaire et empreintes des fichiers | `backup-manifest.json` |

Pour l’export actuel, le ZIP vérifié mesure **316,34 Mo** et contient **16 262 personnes, 4 440 familles et 1 116 photos**. Le Carnet est un instantané des fiches enregistrées au début de l’opération. Les notes modifiées ensuite demandent une nouvelle sauvegarde.

Le ZIP est **privé et non chiffré**. Il ne contient pas les carnets des autres navigateurs ou appareils, les brouillons, les préférences de navigation, le zoom, l’historique de consultation, les secrets Supabase, ni tout le dossier de développement. Pour conserver aussi les analyses et documents de travail du projet, garder une copie privée du dossier de développement en complément.

## Restaurer avec le projet encore disponible

Depuis le dossier du projet, exécuter les commandes ci-dessous en adaptant les deux chemins entre guillemets :

```powershell
python -X utf8 scripts/complete_backup.py --verify "C:\chemin\heritage-complet.zip"
python -X utf8 scripts/complete_backup.py --restore "C:\chemin\heritage-complet.zip" "C:\chemin\heritage-restaure"
```

Le dossier de destination doit être **absent** et son dossier parent doit déjà exister. Aucun dossier existant, même vide, n’est remplacé. La restauration vérifie l’inventaire, les empreintes, la cohérence du corpus et le Carnet avant de créer la copie, puis relit les fichiers écrits. Si `RESTAURATION_INCOMPLETE.txt` reste présent après une erreur, conserver la sauvegarde et recommencer vers un nouveau dossier après correction de la cause.

Ouvrir un terminal dans le dossier restauré :

```powershell
python -X utf8 scripts/serve.py --port 8771
```

Ouvrir ensuite `http://127.0.0.1:8771/`. Utiliser un port neuf s’il est occupé ou s’il a déjà servi à une ancienne copie, pour éviter de confondre les carnets ou les caches. Le serveur reste limité à ce PC. Arrêter le serveur par `Ctrl+C` après consultation.

## Retrouver les notes et favoris

La restauration du ZIP écrit **`carnet.json` dans le dossier restauré**, à côté de `LIRE-MOI.txt`. Elle ne modifie pas automatiquement le stockage du navigateur.

Dans la copie ouverte, choisir **Carnet → Choisir une sauvegarde**, sélectionner ce `carnet.json`, examiner l’aperçu, puis cliquer sur **Restaurer le carnet**. Les notes existantes sont conservées par défaut ; les textes peuvent être réunis explicitement. Voir le [guide de comparaison des notes](etape-3-restauration-carnet.md).

Un autre port ou navigateur possède son propre Carnet. Le fichier est compatible avec l’arbre inclus dans ce ZIP. Un Carnet provenant d’un autre export généalogique est refusé.

## Si le dossier du projet original est perdu

Le ZIP contient le programme et les outils nécessaires ; **Python 3 doit être disponible** sur le PC de reprise.

1. Décompresser votre ZIP conservé dans un dossier neuf et garder le ZIP d’origine.
2. Depuis le dossier extrait, vérifier le ZIP avec `python -X utf8 scripts/complete_backup.py --verify "C:\chemin\heritage-complet.zip"`.
3. Après réussite du contrôle, lancer le serveur et importer `carnet.json` comme décrit plus haut.

Cette vérification contrôle l’intégrité et la cohérence de votre sauvegarde ; elle ne certifie pas l’authenticité d’une archive reçue d’un tiers. La copie restaurée fonctionne en mode local, sans code familial ni connexion à Supabase. Elle peut produire une nouvelle sauvegarde complète après import de son Carnet.

## En cas de difficulté

| Message ou situation | Action |
|---|---|
| Commande absente | Ouvrir la version locale sur le PC, puis le Carnet. |
| Serveur local à mettre à jour | Arrêter le serveur, relancer `npm start` depuis le projet à jour et rouvrir le Carnet. Avec une ancienne PWA, préparer le hors connexion puis activer la mise à jour proposée après enregistrement des notes. |
| Notes en cours | Enregistrer les brouillons avant la sauvegarde complète. |
| Sauvegarde non créée | Vérifier l’espace disque, la présence des originaux et la correspondance du Carnet avec l’arbre. Prévoir de la place pour le ZIP, sa préparation temporaire et la copie restaurée. |
| Fichier absent ou téléchargement incomplet | Vérifier les téléchargements et l’espace disque du navigateur, puis relancer la sauvegarde. |
| Carnet vide dans le ZIP | Vérifier que la sauvegarde a été créée dans le navigateur et à l’adresse où les notes ont été enregistrées. |

L’ancien ZIP `heritage-private-…zip` contient uniquement le corpus ; il utilise toujours le [guide et l’outil de restauration du corpus](etape-3-sauvegarde-restauration.md). Ne pas le confondre avec le nouveau ZIP `heritage-complet-…zip`.

## Vérifications réalisées

- **116 tests automatiques réussis** : 79 JavaScript et 37 Python, dont 12 tests du lot complet ; **6 tests navigateur** du Carnet réussis séparément.
- Téléchargement du vrai ZIP depuis le Carnet, contrôle puis restauration dans `artifacts/restauration-complete-2026-09-30/` ; **1 147 fichiers inventoriés**. Son Carnet est vide dans le navigateur utilisé ; les annotations non vides sont couvertes par les tests fictifs.
- Ouverture effective de la copie sur le port temporaire **8773**, sans code : **21 cartes autour de Christophe**, compteur de **16 262 personnes**, portrait chargé depuis la copie et Carnet disponible. La sauvegarde complète est également proposée par le serveur restauré.
- Présentation du Carnet contrôlée dans les cadres **1440×960, 393×852, 852×393, 834×1194 et 1194×834**, avec dimensions internes vérifiées : aucun débordement horizontal du dialogue ou de la section de sauvegarde. Les essais sur appareils Apple physiques restent à faire.
- Rapport conservé dans `analysis/complete-backup-validation-2026-09-30.json`. Aucune copie sur un support externe ni mise en service distante effectuée pendant ce lot.
