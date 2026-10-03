# Restaurer et comparer les notes du Carnet

29/09/2026 · Application **0.8.1** · Documentation **0.9.0**

## Parcours

1. Ouvrir **Carnet**, puis **Choisir une sauvegarde**. Enregistrer d’abord les notes en cours : les brouillons ne font pas partie de la sauvegarde.
2. Choisir un JSON obtenu par **Exporter le carnet**, provenant du même export généalogique ou, depuis 0.12.0, d’un export antérieur reconnu par le [parcours de réimport](etape-6-reimports.md). Le format reste compatible avec les versions précédentes ; la limite reste 10 Mo.
3. Lire l’aperçu : nouvelles fiches, notes vides et favoris à compléter, différences et fiches sans correspondance exacte avec l’arbre.
4. Parcourir les différences avec les flèches. Chaque vue présente les deux identités et le texte complet des deux notes, avec défilement si nécessaire.
5. Pour deux notes d’une même identité, choisir **Garder ma note actuelle** (défaut) ou **Réunir les deux textes**. La réunion conserve les deux textes séparés par « Note issue de la sauvegarde ». Elle est indisponible au-delà de 20 000 caractères, séparateur compris.
6. Cliquer sur **Restaurer le carnet** pour appliquer les choix ensemble, ou **Annuler**. Fermer le Carnet abandonne également l’aperçu sans l’appliquer.

Si un même identifiant porte un autre nom ou une autre naissance, sa fiche entrante est ignorée. Il n’est pas possible de réunir ces textes automatiquement. Conserver la sauvegarde pour vérifier l’identité et effectuer ultérieurement un rapprochement manuel.

Les nouvelles fiches sans correspondance exacte sont conservées et réexportables, mais ne sont pas rattachées à une personne du nouvel arbre. Le rapprochement entre exports différents reste hors de ce lot.

## Protection des modifications

L’aperçu ne modifie rien. Au clic de restauration, une transaction IndexedDB relit les fiches concernées et compare leur état à l’aperçu. Si un autre onglet a modifié, créé ou supprimé l’une de ces fiches, toute l’opération est refusée. Le nouvel aperçu apparaît, les choix reviennent à la conservation par défaut et une nouvelle validation est nécessaire. Les changements d’autres fiches restent conservés.

Les favoris sont réunis ; une note déjà présente n’est jamais remplacée par le seul texte importé. Réunir à nouveau les mêmes textes lors d’une restauration ultérieure peut les répéter : vérifier l’aperçu et garder la note actuelle si elle contient déjà le souvenir importé.

La sauvegarde source n’est pas supprimée ni modifiée. Elle reste utile pour les notes laissées de côté. Ce parcours concerne les **notes et favoris** ; le ZIP contenant le GEDCOM et les photos utilise toujours l’[outil de restauration du corpus](etape-3-sauvegarde-restauration.md). Aucune synchronisation ni sauvegarde externe automatique n’est ajoutée.

## Vérification reproductible

`npm test` exécute **104 tests** (79 JavaScript + 25 Python). Les huit nouveaux tests sont dans `tests/notebook-restore.test.js`.

Pour vérifier le véritable stockage navigateur et le parcours d’interface :

```powershell
python -X utf8 tests/serve_notebook_preview.py
```

Ouvrir ensuite `http://127.0.0.1:8879/__tests/notebook.html`. La page exécute six tests avec des personnes fictives et une base dédiée, sans accéder au carnet habituel. Le résultat attendu est **6/6 tests navigateur réussis**. Le bouton **Afficher l’aperçu fictif** permet d’inspecter la présentation. Arrêter le serveur par `Ctrl+C` après les tests. Cette page n’entre pas dans les paquets publics ni dans le cache hors connexion.

Les cinq formats PC, téléphone portrait/paysage et tablette portrait/paysage ont été contrôlés sans débordement horizontal du dialogue ni de l’aperçu. Les essais sur iPhone/iPad physiques restent à réaliser.
