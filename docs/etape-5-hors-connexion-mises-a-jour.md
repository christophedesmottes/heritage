# Hors connexion, mises à jour et accès familial

Application 0.11.4 — fiche de validation du 1er octobre 2026.

L’utilisateur confirme que les essais de l’application sur iPhone et iPad réels semblent corrects. Cette fiche porte sur la phase suivante. Faire les essais sur chaque appareil, dans le même contexte : de préférence depuis l’icône installée. Une préparation dans Safari ne valide pas la copie utilisée par l’icône.

## Avant de commencer

Ouvrir [Héritage](https://christophedesmottes.github.io/heritage/) en ligne. Dans Carnet, relever la version affichée, l’appareil, iOS/iPadOS et le contexte Safari ou icône. Vérifier que les notes sont enregistrées puis exporter le Carnet si des notes personnelles sont déjà présentes. Ne pas effacer les données Safari.

Créer une note sur une fiche sans note existante, par exemple « Essai hors connexion iPhone », puis l’enregistrer. Ajouter cette personne aux favoris. Relever son nom pour la retrouver aux différentes étapes.

## H1 — Préparer l’arbre et les photos

1. Carnet → Préparer le hors connexion. Attendre **Arbre prêt hors connexion**. Si la confirmation n’apparaît pas, rester en ligne et relever le message : la simple ouverture de l’arbre ne prouve pas que la copie est prête.
2. Choisir **Conserver toutes les photos** et attendre la fin si l’objectif est de retrouver toute la bibliothèque. Environ 315 Mo ; utiliser le Wi-Fi. Vérifier le compteur et les éventuels échecs. Sinon, le test porte uniquement sur les photos effectivement conservées.
3. Ouvrir quelques fiches avec photo, dont celle de Christophe, et repérer celles à vérifier hors connexion.

## H2 — Réouvrir en mode avion

1. Activer le mode avion et vérifier que Wi-Fi et données mobiles sont coupés.
2. Fermer puis rouvrir Héritage depuis son icône, sans rétablir Internet. Attendre l’ouverture : une tentative réseau peut précéder la lecture de la copie locale.
3. Rechercher une personne, parcourir l’arbre et ouvrir les portraits et photos préparés à H1.
4. Retrouver la note et le favori créés au départ. Compléter la note avec « Ajout en mode avion », enregistrer, fermer puis rouvrir l’application : le texte complet doit rester présent.
5. Dans Carnet, Vérifier les mises à jour doit signaler que la vérification est impossible sans connexion ; cela ne doit pas effacer la copie ni les notes.

Attendu : arbre et ressources déjà préparées disponibles tant que la session familiale est valide. Une photo non téléchargée peut manquer. Sans copie de l’arbre, ou après expiration de la session, le premier accès nécessite Internet et le PIN.

## H3 — Conserver le Carnet lors d’une mise à jour

1. Rétablir Internet et exporter le Carnet comprenant l’ajout hors connexion.
2. Noter la version de départ dans Carnet. Vérifier les mises à jour.
3. Si une nouvelle livraison est publiée, attendre son activation puis relever la nouvelle version. La mise à jour automatique attend lorsqu’une note non enregistrée ou une opération du Carnet est en cours ; enregistrer puis choisir Activer la mise à jour si proposé.
4. Rouvrir la fiche d’essai : note complète et favori présents. Contrôler de nouveau la disponibilité hors connexion et une photo déjà conservée.

Si l’appareil est déjà en 0.11.4 et qu’aucune nouvelle livraison n’existe, noter **Vérification à jour OK ; migration matérielle en attente d’une prochaine version**. Un simple rechargement de la même version ne valide pas une migration. Si l’appareil est encore en 0.11.3, la livraison 0.11.4 peut servir à l’essai. La migration réelle avec note conservée a aussi été vérifiée dans le navigateur PC de test.

## H4 — Fermer l’accès familial sans perdre les notes

Faire cette étape après les essais hors connexion, car elle supprime volontairement les copies familiales du contexte utilisé.

1. En ligne, enregistrer les notes et exporter le Carnet.
2. Choisir **Fermer l’accès**. Attendu : retour à l’écran du PIN.
3. Fermer puis rouvrir l’application : l’arbre ne doit pas réapparaître sans code.
4. Saisir le bon PIN en ligne. Retrouver la note complète et le favori.
5. Le téléchargement hors connexion de l’arbre et des photos doit être refait après cette fermeture. Carnet → Préparer le hors connexion, puis Conserver toutes les photos si souhaité.

La fermeture concerne ce navigateur ou cette icône : elle ne ferme pas les sessions des autres appareils.

## H5 — Expiration de l’accès après sept jours

Après la reconnexion de H4, relever la date et l’heure de saisie du PIN. La session dure sept jours à partir de cette connexion, et non à partir du début des essais. Une nouvelle connexion avec le PIN recommence cette durée.

Après l’échéance, fermer puis rouvrir l’application. L’écran du PIN doit réapparaître, même si l’arbre et les photos avaient été conservés. Le mode avion ne permet pas de renouveler l’accès : rétablir Internet, saisir le PIN puis vérifier les notes et favoris.

Ne pas modifier l’heure de l’appareil pour accélérer le test. La limite exacte de sept jours est couverte automatiquement avec une horloge fictive, sans changer la configuration Supabase ni la durée réelle des sessions. L’expiration naturelle sur les appareils restera en attente jusqu’à l’échéance.

## Résultats à relever

| Contrôle | iPhone | iPad |
|---|---|---|
| Version, iOS/iPadOS et contexte | À renseigner | À renseigner |
| H1 — Arbre prêt, photos conservées / total, échecs | À tester | À tester |
| H2 — Réouverture et photos en mode avion | À tester | À tester |
| H2 — Note modifiée hors connexion et retrouvée | À tester | À tester |
| H3 — Version avant → après, note et favori conservés | À tester ou prochaine livraison | À tester ou prochaine livraison |
| H4 — PIN demandé après fermeture, Carnet conservé après reconnexion | À tester | À tester |
| H5 — Dernière connexion et date limite | À renseigner | À renseigner |
| H5 — Expiration naturelle et renouvellement | En attente de l’échéance | En attente de l’échéance |

Retour utile : « iPhone, depuis l’icône, version … : H1 … photos, H2 OK/échec et message, H3 version … → …, H4 OK/échec ». Faire ensuite la même passe sur iPad. Ne pas transmettre le PIN.

## Contrôles du développement

Le programme applicatif reste en 0.11.4 : ce lot ajoute des tests et de la documentation. Les tests vérifient l’arbre et la photo en cache juste avant puis à l’expiration exacte, les ressources absentes hors connexion, et le cas d’un cache plein. Les tests existants couvrent refus serveur, fermeture pendant téléchargement, notes et activation de mise à jour avec brouillon. Journal de cette passe : `analysis/tests-validation-hors-connexion.log`. Les résultats matériels ci-dessus seront complétés à partir du retour utilisateur.
