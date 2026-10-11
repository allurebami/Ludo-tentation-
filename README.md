# Ludo Tentation

Jeu de Ludo tactile contre la machine, en français, écrit en HTML, CSS et JavaScript sans dépendances.

## Jouer

Ouvrir `index.html` dans un navigateur, ou servir le dossier avec un serveur web statique. Dans la version Sites, les fichiers du jeu sont dans `dist/`.

- Quatre pions corail pour le joueur, quatre violets pour la machine.
- Un 6 pour sortir un pion ; un 6, une capture ou une arrivée donne un tour supplémentaire.
- Trois 6 consécutifs font passer le tour. Les deux déplacements précédents restent acquis.
- Les étoiles et les cases de départ sont protégées ; les pions ne créent pas de blocages.
- Il faut le nombre exact pour atteindre l’arrivée. Faire arriver les quatre pions donne la victoire.
- Toucher un pion entouré de jaune, ou utiliser les boutons de déplacement.

## Mode Tentation

- **Avidité** : chaque capture rapporte 20 points. Garder ce bonus ou le risquer sur un dé indépendant (4–6 : double ; 1–3 : bonus perdu). La capture reste acquise.
- **Orgueil** : faire arriver son champion avant ses autres pions, sans avoir été capturé, rapporte 50 points.
- **Vengeance** : capturer le dernier pion à avoir capturé l’un des siens rapporte 20 points supplémentaires.
- Chaque arrivée rapporte 30 points. La machine suit les mêmes règles de score.
- Le score ne modifie ni les dés ni la condition de victoire.

Sauvegarde de la partie et record dans le navigateur si son stockage local est disponible. Sons facultatifs. Règles intégrées. Mode classique disponible.

## Portée

Entraînement avec points fictifs, sans dépôt, retrait, mise ou gain d’argent. Le moteur tourne dans le navigateur ; cette version n’est pas un système de jeu avec argent réel. Les dés utilisent `crypto.getRandomValues` avec rejet pour éviter un biais modulo lorsqu’il est disponible.

## Vérification

Exécuter `node tests/engine.test.cjs`. Les tests couvrent sortie, captures, cases protégées, arrivée exacte, tours supplémentaires, trois 6, défis, victoire et simulations de parties complètes.
