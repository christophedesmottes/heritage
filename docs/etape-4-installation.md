# Installation et navigation — Héritage 0.11.1

1er octobre 2026 — publication 0.11.1 confirmée, installation physique à valider. Suivre la [fiche de validation iPhone/iPad](etape-4-validation-appareils.md) pour relever les résultats.

Dans **Carnet → Retrouver Héritage depuis une icône**, ouvrir les étapes correspondant à son appareil. Le bouton **Installer Héritage** apparaît seulement quand le navigateur fournit une invitation d’installation. Le clic ouvre sa demande de confirmation ; une annulation laisse la consultation disponible. Sans invitation, utiliser les instructions du menu du navigateur. L’application distingue une demande acceptée de la confirmation d’installation du navigateur ; elle détecte aussi une ouverture en mode application.

L’adresse `http://127.0.0.1:8767/` reste propre au PC. Sur iPhone et iPad, utiliser [l’adresse publiée](https://christophedesmottes.github.io/heritage/) dans Safari puis le PIN familial si demandé. L’hébergement et la configuration Supabase ont été réalisés par l’utilisateur, qui a confirmé le bon fonctionnement de l’accès. Aucun changement distant effectué par l’assistant dans ce lot.

## Après installation

1. Ouvrir Héritage depuis son icône et vérifier le contenu du Carnet. Les notes ne sont pas synchronisées ; exporter le Carnet avant de changer de navigateur ou de contexte d’ouverture.
2. Dans le Carnet, préparer le hors connexion, attendre sa confirmation, puis conserver toutes les photos si souhaité.
3. Fermer et rouvrir l’application hors connexion pour vérifier arbre, portrait et photos préparées. Sur PC, garder le serveur local lancé jusqu’à préparation complète.
4. Conserver une sauvegarde du Carnet et un ZIP complet sur un support privé. L’installation ne remplace aucune sauvegarde.

## Gestes actuellement disponibles

Déplacement tactile par défilement natif, glissement de souris depuis une zone vide, sélection d’une carte, ouverture de branche, zoom par les boutons + et −, recentrage. Depuis 0.9.3, poser deux doigts dans l’arbre puis les écarter ou les rapprocher permet de zoomer autour de leur milieu. Si le défilement est déjà engagé, relever les doigts avant le pincement. Le geste reste à valider sur le matériel Apple réel. Les contrôles de dimensions sur PC ne valident pas les gestes ni le clavier Safari.

## Essais restant à réaliser sur appareils

Relever la version d’iOS/iPadOS et du navigateur. L’adresse publiée permet maintenant les essais sur iPhone 15 Pro et iPad Pro 11 pouces : installation depuis Safari, ouverture depuis l’icône, saisie d’une note avec clavier, rotation pendant la saisie, déplacement de l’arbre, maintien du zoom lors du changement des générations, accès aux commandes près des bords, fermeture/réouverture, conservation du Carnet et consultation hors connexion. Faire aussi un essai réel d’installation Edge sur PC. Aucun de ces essais physiques n’est déclaré réussi ici.

## Validation locale

116 tests automatiques réussis (`analysis/tests-0.9.2.log`). 11 tests navigateur sur l’origine fictive 8879 : les six tests de restauration existants et cinq contrôles de l’installation (absence d’invitation, acceptation, annulation, erreur et confirmation). Les invitations sont simulées ; aucun logiciel n’a été installé par ces tests. Aide Apple dépliée et avertissement local contrôlés aux cinq formats, sans débordement horizontal.

## Références vérifiées le 30 septembre 2026

- [Apple : transformer un site en application Safari](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios).
- [Microsoft : installer et gérer les applications Edge](https://support.microsoft.com/fr-fr/edge/install-manage-or-uninstall-apps-in-microsoft-edge).

Les intitulés peuvent varier selon les versions. Les instructions intégrées utilisent le partage Safari puis l’ajout à l’écran d’accueil, ou le menu Applications d’Edge.

Validation complémentaire 0.9.3 : 118 tests automatiques réussis ; scénario de pincement simulé dans l’application réussi. Référence technique : [gestion multitactile MDN](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Multi-touch_interaction).
