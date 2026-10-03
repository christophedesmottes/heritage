# Sauvegarder et restaurer Héritage sur le PC

> **Archive du corpus seul — méthode historique.** Depuis l’application **0.9.0**, utiliser de préférence **Carnet → Tout sauvegarder** et le [guide de sauvegarde complète](etape-3-sauvegarde-complete.md). Le nouveau ZIP inclut aussi le programme et le Carnet. Les instructions ci-dessous restent applicables aux anciens fichiers `heritage-private-…zip`.

29/09/2026 · Outil de restauration **1.0** · Application **0.8.1** · README **0.9.0**

## Décision : continuer sans code pendant le développement

À la demande de l’utilisateur, le code familial sera défini lors de la mise en production finale, après validation de l’application. **Aucune saisie dans Supabase n’est demandée maintenant.** La consultation et les essais continuent sur `http://127.0.0.1:8767/`, en mode local sans code. La passerelle distante reste fermée, avec un bucket privé ; cette décision ne publie pas l’arbre sur Internet. La future connexion familiale et les essais sur Apple depuis une adresse HTTPS restent à finaliser.

## Les éléments d’une sauvegarde

- **Arbre, original GEDCOM et photos** : archive privée `artifacts/heritage-private-72a26859d864.zip`, environ 316,20 Mo. Ses fichiers décompressés représentent 348,80 Mo. Elle contient 16 262 personnes, 4 440 familles et 1 116 images.
- **Notes et favoris** : ouvrir **Carnet → Exporter le carnet** dans le navigateur utilisé. Conserver ce JSON à côté de l’archive. Les notes ne sont pas des fichiers du projet et ne figurent donc pas dans le ZIP.
- **Programme et documentation** : conserver également une copie privée du dossier du projet. L’archive de données seule ne contient pas le programme ; la restauration utilise les fichiers d’interface et le serveur local présents dans le projet.

Copier ces éléments vers le support privé choisi par l’utilisateur (par exemple un disque externe) constitue la sauvegarde hors du PC. Aucune copie externe n’a été faite automatiquement. Le cache du navigateur et la copie de restauration sur le même disque ne protègent pas contre la panne de ce disque.

## Contrôler l’archive et reconstruire une copie

Depuis `C:\Users\cdesmottes\Documents\Codex\Généalogie` :

```powershell
python -X utf8 scripts/package_private.py --verify artifacts/heritage-private-72a26859d864.zip
npm run restore:private -- artifacts/heritage-private-72a26859d864.zip artifacts/ma-restauration
```

Choisir un dossier de destination **qui n’existe pas encore**, dont le parent existe. Même un dossier vide existant est refusé. Le projet courant, la source et l’archive ne sont jamais remplacés.

L’outil contrôle tout le ZIP avant d’écrire : inventaire exact, chemins autorisés, empreintes, correspondance GEDCOM/arbre, références aux photos et compteurs. Il refuse les archives contenant des chemins extérieurs, des fichiers inattendus ou des photos manquantes. Les fichiers restaurés sont relus et vérifiés. Si l’écriture s’interrompt, un fichier `RESTAURATION_INCOMPLETE.txt` reste présent : cette copie partielle ne doit pas être utilisée ; reprendre dans un nouveau dossier après correction du problème.

La copie contient :

```text
app/                    interface de consultation et données restaurées
app/data/tree.json      arbre issu du ZIP
app/data/media/         photographies issues du ZIP
sources/source.ged      original, inchangé
scripts/serve.py        serveur local limité à ce PC
restore-report.json     inventaire et empreintes de la restauration
LIRE-MOI.txt            instructions de lancement
```

Le programme est copié par liste explicite depuis le projet ; les secrets, réglages Supabase et fichiers annexes ne sont pas copiés. Le mode est systématiquement **local**, sans écran de code. Le dossier reconstruit est une copie de consultation privée, pas un dépôt complet de développement ni un paquet destiné à l’hébergement public.

Pour l’ouvrir :

```powershell
cd artifacts/ma-restauration
python -X utf8 scripts/serve.py --port 8771
```

Ouvrir ensuite `http://127.0.0.1:8771/`. Python 3 doit être disponible sur le PC. Choisir un port de test neuf si celui-ci est occupé ou a déjà servi à une autre copie, pour éviter un ancien cache. Le GEDCOM original reste hors du dossier servi. Le serveur s’arrête avec `Ctrl+C`.

## Retrouver les notes

Le port ou l’adresse faisant partie de l’origine du navigateur, les notes de `8767` ne sont pas automatiquement celles de `8771`. Dans la nouvelle copie, ouvrir **Carnet → Choisir une sauvegarde**, sélectionner l’export du carnet, lire le bilan puis cliquer sur **Restaurer le carnet**. Depuis **0.8.1**, l’aperçu permet de comparer les notes et de réunir explicitement leurs textes ; la conservation de la note actuelle reste le défaut. Voir le [guide du Carnet](etape-3-restauration-carnet.md). La restauration accepte le même export généalogique et ne modifie pas le GEDCOM. Une ancienne copie restaurée garde l’interface de sa date de création.

L’export du carnet protège notes et favoris ; il ne reconstitue pas tous les réglages temporaires, le zoom ou l’historique de navigation. Aucun carnet utilisateur n’a été modifié pendant l’essai de restauration du corpus.

## Validation historique de l’outil corpus — 26 septembre

Six nouveaux tests couvrent la restitution fidèle, le refus d’un dossier existant, une archive altérée, un manifeste incohérent, une photo référencée absente et une tentative de sortie du dossier. Total du projet : **91 tests, 66 JavaScript et 25 Python**.

Le véritable ZIP a été restauré dans `artifacts/restauration-verifiee-2026-09-26/`. Tous les fichiers du corpus ont été relus avec des empreintes identiques à l’archive. Le navigateur a affiché l’accueil de Christophe, ses 21 cartes, le compteur de 16 262 personnes et le portrait local, sans écran de code. Le serveur d’essai 8771 a ensuite été arrêté ; il peut être relancé avec la commande indiquée dans `LIRE-MOI.txt`. La version de travail reste sur 8767.

Cette restauration est un outil local d’administration avec guide. Un assistant de sauvegarde/restauration globale intégré à l’application, la copie automatique sur un autre support et les essais matériels Apple restent à réaliser. Le code familial sera configuré et testé avant toute ouverture de production.
