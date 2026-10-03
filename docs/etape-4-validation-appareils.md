# Validation sur iPhone et iPad — Héritage 0.11.1

Fiche du 1er octobre 2026. Après les correctifs de zoom et de mise à jour jusqu’à 0.11.4, l’utilisateur confirme que tout semble correct pour la validation sur iPhone et iPad réels. Validation globale utilisateur enregistrée ; versions iOS/iPadOS et résultats ligne par ligne non fournis. Les tableaux initiaux ci-dessous restent la fiche détaillée, et ne remettent pas en cause cette confirmation globale. La nouvelle étape suit la [fiche hors connexion, mises à jour et accès familial](etape-5-hors-connexion-mises-a-jour.md).

## Adresse et préparation

Ouvrir [Héritage](https://christophedesmottes.github.io/heritage/) dans Safari, hors navigation privée. Saisir le PIN familial lorsqu’il est demandé. Une session encore valide peut ouvrir directement l’arbre : c’est le comportement prévu.

La publication 0.11.1 est confirmée par comparaison des fichiers publics `app.js`, `lib/tree-layout.js`, `lib/offline-config.js` et `sw.js` avec la livraison locale. Une ancienne copie hors connexion peut néanmoins nécessiter **Carnet → Activer la mise à jour**, si le bouton est proposé. Ne pas supprimer les données Safari pour actualiser une application contenant des notes.

Noter avant les essais :

| Repère | iPhone | iPad |
|---|---|---|
| Modèle | iPhone 15 Pro, à confirmer | iPad Pro 11 pouces, 3e génération, à confirmer |
| Version iOS / iPadOS | À renseigner | À renseigner |
| Date de l’essai | À renseigner | À renseigner |
| Contexte | Safari puis icône | Safari puis icône |

## Première passe : navigation, environ dix minutes par appareil

Effectuer les actions en portrait, puis en paysage. Pour chaque ligne, noter **OK**, **Échec** ou **Non testé**.

| Test | Action et résultat attendu | iPhone | iPad |
|---|---|---|---|
| A1 — Accès | Ouvrir l’adresse, entrer le PIN si demandé : arbre et photographies accessibles. | Non testé | Non testé |
| A2 — Recherche | Rechercher Christophe Desmottes, ouvrir sa fiche puis Explorer sa famille : sélection et liens cohérents. | Non testé | Non testé |
| A3 — Déplacement | Glisser sur une zone vide avec un doigt : déplacement dans les deux directions, sans ouvrir une fiche par accident. | Non testé | Non testé |
| A4 — Pincement | Écarter puis rapprocher deux doigts : zoom de l’arbre autour du geste. Les boutons + et − fonctionnent aussi. | Non testé | Non testé |
| A5 — Générations | Après zoom et déplacement, changer Ancêtres puis Descendants : pourcentage de zoom conservé, position compensée autour d’une carte restante. Voir tout ajuste volontairement l’ensemble. | Non testé | Non testé |
| A6 — Descendance | Centrer sur Élisabeth Marie Blanchemanche, Descendants 3 : retrouver enfants, petits-enfants et arrière-petits-enfants ; ouvrir notamment la branche de Bernadette. | Non testé | Non testé |
| A7 — Fiche et galerie | Ouvrir un portrait avec photo puis sa galerie : commandes de fermeture accessibles, retour possible à l’arbre. | Non testé | Non testé |
| A8 — Rotation | Tourner pendant la consultation : même personne sélectionnée, commandes accessibles. La rotation peut recadrer la sélection. | Non testé | Non testé |

## Deuxième passe : notes et installation

Utiliser une fiche sans note existante pour l’essai. Si des notes sont déjà présentes, exporter le Carnet avant de changer de contexte. Safari et l’application ouverte depuis une icône doivent être contrôlés séparément : les carnets ne sont pas synchronisés entre appareils.

1. Ajouter une note identifiable, par exemple « Essai iPhone du 1er octobre ». Tourner l’appareil avec le clavier ouvert : le texte doit rester présent et Enregistrer ma note doit être accessible. Enregistrer, fermer puis rouvrir la note.
2. Dans Carnet, exporter le carnet et vérifier que le fichier est accessible dans Fichiers. Conserver ce fichier pour l’essai suivant.
3. Ajouter l’application à l’écran d’accueil depuis Safari. Sur iPhone, ouvrir Partager, éventuellement depuis le menu de la page, puis Sur l’écran d’accueil. Sur iPad, Partager puis, si nécessaire, En voir plus et Sur l’écran d’accueil. Activer Ouvrir comme app web si proposé, puis Ajouter. Parcours vérifiés dans les guides [Apple iPhone](https://support.apple.com/fr-fr/guide/iphone/iphea86e5236/ios) et [Apple iPad](https://support.apple.com/fr-fr/guide/ipad/ipad8f1f7a29/ipados) ; libellés selon la version installée.
4. Ouvrir Héritage depuis l’icône, saisir le PIN si nécessaire. Vérifier les notes et favoris. Si le Carnet est distinct, choisir la sauvegarde exportée, consulter l’aperçu et restaurer explicitement.
5. Fermer puis rouvrir depuis l’icône : la note enregistrée doit être retrouvée dans ce contexte.

| Résultat | iPhone | iPad |
|---|---|---|
| Clavier et rotation sans perte du texte | Non testé | Non testé |
| Export du Carnet accessible dans Fichiers | Non testé | Non testé |
| Installation et ouverture depuis l’icône | Non testé | Non testé |
| Carnet conservé après fermeture/réouverture | Non testé | Non testé |

## Troisième passe : hors connexion et fermeture de l’accès

Effectuer cette passe **depuis l’icône installée**, en ligne et avec une session valide. La préparation du hors connexion se fait dans le contexte où l’on souhaite consulter l’arbre.

1. Carnet → Préparer le hors connexion. Attendre la confirmation « Arbre prêt hors connexion ». Ouvrir quelques portraits et contrôler le nombre de photos conservées. Pour la totalité, choisir Conserver toutes les photos et attendre la fin ; la bibliothèque représente environ 315 Mo.
2. Activer le mode avion et vérifier que Wi-Fi et données cellulaires sont effectivement coupés. Fermer puis rouvrir l’application. L’arbre, les fiches et les photos déjà conservées doivent être consultables. Une photo non conservée peut être absente.
3. Ajouter et enregistrer une note d’essai hors connexion. Fermer puis rouvrir : la note doit être retrouvée.
4. Rétablir Internet. Exporter le Carnet. Choisir Fermer l’accès : le PIN doit être redemandé et les copies familiales de ce contexte doivent être effacées. Se reconnecter avec le PIN et vérifier que les notes sont conservées.

Le hors connexion familial exige une session encore valide. Après sept jours, le code doit être ressaisi en ligne ; ne pas modifier l’heure de l’appareil pour simuler cette échéance. Le contrôle naturel à sept jours reste à consigner séparément.

| Résultat | iPhone | iPad |
|---|---|---|
| Préparation confirmée avec compteur de photos | Non testé | Non testé |
| Réouverture en mode avion | Non testé | Non testé |
| Note conservée après réouverture hors connexion | Non testé | Non testé |
| Fermeture de l’accès puis PIN et Carnet conservé | Non testé | Non testé |
| Expiration naturelle après sept jours | Non testé | Non testé |

## Retour à transmettre

Commencer par la première passe sur iPhone et iPad. Exemple : « iPhone, iOS … : A1 à A4 OK, A5 Échec en paysage : le zoom passe de … à … ». Pour un problème de saisie ou de fermeture, préciser Safari ou icône, orientation, action effectuée et texte exact du message. Ne pas transmettre le PIN.

## Suivi et suite

Dernière livraison applicative : 0.11.4, 134 tests automatiques réussis. Cette phase de validation ajoute trois tests ciblés ; voir le journal `analysis/tests-validation-hors-connexion.log`. La confirmation utilisateur porte sur le fonctionnement sur appareils réels ; hors connexion, mises à jour et expiration naturelle restent à consigner séparément.

Après ces retours : corriger les problèmes constatés, puis définir l’identification personnelle nécessaire à la synchronisation des carnets. Le PIN familial donne accès à l’arbre ; il ne distingue pas les propriétaires des notes.
