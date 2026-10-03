# Synchronisation personnelle — application 0.15.2

## Fonctionnement

Le PIN familial ouvre l’arbre. Un **code personnel généré** relie un Carnet entre appareils sans compte ni e-mail. Un Carnet différent utilise un code différent. La création et la liaison sont volontaires ; aucune note existante n’est envoyée avant cette activation. Le code reste mémorisé dans ce navigateur ; le serveur conserve une empreinte SHA-256 liée à l’arbre. Aucun code personnel n’est placé dans l’URL ou dans la livraison.

La synchronisation exige également une session familiale valide. Fermer ou laisser expirer cet accès bloque les échanges sans effacer les notes ni le code personnel conservés sur l’appareil. Toute personne disposant à la fois de ce code et de l’accès familial peut utiliser le Carnet correspondant. Le code n’est pas récupérable par e-mail ; le bouton **Conserver le code dans un fichier** permet une copie privée.

## Activation sur vos appareils

1. Exporter les carnets actuels sur chaque appareil avant la première liaison.
2. Sur le site publié, dans **Carnet → Retrouver mon Carnet sur mes appareils**, cliquer **Créer mon Carnet synchronisé** sur un premier appareil. Les notes et favoris déjà présents sont conservés et transférés.
3. Conserver le code personnel généré.
4. Sur les autres appareils ou contextes Safari/icône, ouvrir **J’ai déjà un code personnel**, saisir ce même code et cliquer **Relier cet appareil**. Ne pas créer un nouveau Carnet sur chaque appareil.
5. Les notes et favoris locaux sont rapprochés ; les textes différents apparaissent pour choisir la version locale, la version synchronisée ou réunir les textes.

La copie locale du PC (127.0.0.1:8767) conserve son fonctionnement autonome. Pour la relier : exporter son Carnet, ouvrir l’adresse GitHub sur PC, restaurer la sauvegarde, puis activer la synchronisation. Le même code fonctionne sur le site publié en PC, iPhone et iPad.

**Utiliser un autre code** relie le Carnet local à un autre Carnet distant existant et rapproche les notes ; conserver le code précédent avant ce changement. Le Carnet distant précédent reste disponible avec son code. Un code inconnu ne crée pas de Carnet et ne remplace pas l’association actuelle.

## Hors connexion et différences

Les notes et favoris sont enregistrés d’abord dans IndexedDB. Une synchronisation automatique est tentée après une modification, au retour d’Internet, au retour dans l’application, à l’ouverture du Carnet et chaque minute lorsque la page est visible. Elle attend la fin des brouillons, de la note ouverte et d’une restauration. Les navigateurs mobiles suspendent une application fermée : ouvrir Héritage pour synchroniser.

Le moteur compare chaque champ avec la dernière version commune. Changer une note sur PC et un favori sur iPad peut être combiné. Deux textes différents ou une suppression concurrente à une modification produisent une différence explicite : aucune version n’est écrasée automatiquement. Le Carnet conserve les deux versions et suspend les échanges jusqu’au choix. Une suppression enregistrée se propage aux autres appareils ; une copie distante inchangée ne ressuscite pas la note.

**Mettre en pause** suspend les échanges sur cet appareil, sans supprimer notes, code ou Carnet distant. **Reprendre** traite les modifications en attente. **Synchroniser maintenant** permet une vérification explicite. La synchronisation concerne les notes enregistrées et les favoris ; ni l’arbre/photos, ni les brouillons, ni la navigation et le zoom.

Les identifiants stables et anciens noms/dates vérifiés lors d’un réimport sont reconnus. L’association repose sur l’arbre stable, sans scinder le Carnet à chaque export. Les fiches absentes restent conservées et exportables ; une identité différente sans alias vérifié bloque le rapprochement.

## Installation Supabase et GitHub par l’utilisateur

Ordre : appliquer `supabase/202610020004_personal_notebooks.sql` de la livraison dans le SQL Editor ; redéployer la fonction existante **family-access** avec le contenu de `supabase/family-access.ts` ; publier les 24 fichiers de `github/`. Le fichier de fonction est autonome et généré à partir des sources testées.

Ne pas modifier le PIN, les secrets actuels, l’identifiant de l’arbre ou son empreinte. Garder la vérification JWT désactivée pour cette fonction, comme actuellement : l’accès familial signé est contrôlé par le code de la fonction. Les nouveaux carnets sont accessibles uniquement par cette passerelle ; aucun rôle anonyme ou connecté Supabase ne peut lire la table ni appeler directement la RPC. Aucun compte Supabase Auth supplémentaire nécessaire.

La migration s’ajoute aux migrations existantes ; elle ne touche pas à l’arbre, au Storage, aux anciennes tables ou notes locales. Table dédiée `heritage_sync_notebooks`, RPC `heritage_sync_notebook`, révision monotone et comparaison avant remplacement atomique. Échanges POST non mis en cache, limite 8 Mo et 10 000 fiches par Carnet, 20 créations par arbre sur 24 heures et 200 carnets maximum. Les créations répétées avec le même code sont idempotentes. Les limites ne bloquent pas les carnets déjà créés.

## Validation sur les appareils réels

| Essai | Résultat attendu |
|---|---|
| Note et favori sur PC, liaison iPhone avec le même code | Même note et favori sur l’iPhone |
| Note sur iPad puis retour au PC | Note actualisée au retour dans l’application |
| Modification hors connexion, puis retour en ligne | Modification synchronisée après ouverture d’Héritage |
| Textes différents sur deux appareils hors connexion | Deux textes visibles, choix explicite, résultat retrouvé sur les deux |
| Suppression d’une note et retrait du favori | Disparition sur les autres appareils après synchronisation |
| Pause puis modification | Aucun envoi avant reprise, modifications locales conservées |
| Code personnel inconnu | Carnet local conservé, aucun Carnet distant créé |
| Fermeture/expiration familiale | Échanges refusés ; Carnet conservé et échanges repris après reconnexion |
| Mise à jour et réouverture | Code personnel, notes et favoris conservés |

188 tests automatiques passent (140 JavaScript, 48 Python). Tests PostgreSQL/PGlite : isolation, accès familial, codes distincts, révisions, suppressions et validation des données. Tests moteur : fusion, conflits, réponse perdue, retry CAS, mutation locale pendant transfert et alias de réimport. Scénario navigateur avec vrai IndexedDB et serveur simulé : deux appareils, panne réseau, réunion des textes, pause, mutations concurrentes, réouverture, suppression, formulaire de liaison. Écran du Carnet vérifié sans débordement aux cinq formats cibles. Aucun Carnet réel envoyé pendant ces tests. Déploiement Supabase/GitHub et vérification réelle multi-appareils restent à effectuer par l’utilisateur.

Les exports Carnet JSON restent compatibles. Ils contiennent les notes/favoris locaux, pas le code personnel ni les paramètres de synchronisation ; conserver le fichier du code séparément. En présence d’une différence non résolue, la sauvegarde contient la version locale ; la version distante reste sur le serveur et dans la comparaison locale. La synchronisation ne remplace pas les sauvegardes.

## Changer le PIN personnel (0.15.2)

Après installation des migrations 004, 005 et 006 et de la fonction mise à jour, ouvrir **Carnet → Changer mon code**. Choisir et confirmer **quatre chiffres** ; les zéros initiaux comptent. Enregistrer et conserver le nouveau code. Les anciens codes longs fonctionnent jusqu’à leur remplacement ; ils restent saisissables sur les autres appareils.

Le même Carnet, ses notes/favoris et sa révision sont conservés. L’ancien code est révoqué et ne peut plus être réutilisé. Un code occupé est refusé. La pause reste conservée. Le changement exige Internet et un accès familial valide. Le PIN personnel est distinct du PIN familial : choisir de préférence des chiffres différents.

Sur chaque autre appareil : **Relier un autre Carnet → Relier cet appareil**, avec le nouveau PIN. Les notes locales sont conservées et rapprochées ; les différences sont présentées. En cas de réponse perdue pendant le changement, garder le premier appareil et réessayer **Synchroniser maintenant** : l’intention enregistrée permet la reprise.

Quatre chiffres offrent 10 000 combinaisons. L’accès familial est toujours nécessaire ; après cinq codes inconnus, les demandes du Carnet de cette session familiale sont bloquées pendant quinze minutes. Les demandes déjà en cours peuvent se terminer. Les échanges réussis n’utilisent pas ces cinq essais. Le plafond de 120 demandes sur quinze minutes reste en place. Les codes sont enregistrés sous forme d’empreintes côté serveur.

Validation réelle après publication : choisir un nouveau PIN sur PC, retrouver une note sur iPhone avec celui-ci, vérifier que l’ancien est refusé et que les favoris restent présents. Le PIN familial ne change pas.
