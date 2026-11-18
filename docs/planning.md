# Planning

## Semaine 1 (16/11 au 20/11) : conception et studio de quiz

Lundi 16 : création du dépôt, tableau de projet. Début de la conception : architecture et schéma de la base de données.

Mardi 17 : protocole des événements temps réel, maquettes des écrans clés, choix de la stack avec comparaisons, découpage des steps 1 à 3 en issues estimées.

Mercredi 18 : docker-compose.yml, Dockerfiles de l'API et du front, configuration nginx, .env.example. Squelette de l'API Express et du front React. Mise en place de la CI : lint, types, construction des images.

Jeudi 19 : comptes (inscription, connexion, déconnexion), mots de passe hachés, routes protégées, rate limiting sur l'authentification.

Vendredi 20 : Préparation au Follow up

## Semaine 2 (23/11 au 27/11) : le direct

Lundi 23 : stabilisation du step 1 après les retours du follow-up. Mise en place de Socket.IO avec l'adaptateur Redis.

Mardi 24 : lancement d'une partie avec PIN à 6 chiffres, état de la partie dans Redis, rejoindre sans compte avec pseudo unique, refus des pseudos injurieux, rate limiting sur la saisie du code.

Mercredi 25 : salle d'attente en temps réel (arrivées, compteur, exclusion d'un joueur), écran animateur projeté avec question, médias et nombre de réponses reçues.

Jeudi 26 : écran joueur, envoi des réponses sans jamais exposer la bonne réponse avant la fin, score simple, répartition des réponses, top 5, rang du joueur, classement final.

Vendredi 27 : Préparation au Follow up

## Semaine 3 (30/11 au 04/12) : jeu complet et analyses

Lundi 30 : chronomètre piloté par le serveur, refus des réponses arrivées après la fin, score fondé sur la justesse et la rapidité avec bonus de série.

Mardi 01 : contrôles de l'animateur (pause, reprise, question suivante, fin), reconnexion d'un joueur qui recharge ou perd le réseau, pause automatique si l'animateur se déconnecte.

Mercredi 02 : podium animé de fin de partie, début du nouveau mode de jeu (équipes ou devoir).

Jeudi 03 : fin du mode de jeu, historique des parties, rapport de partie et rapport par joueur, export CSV.

Vendredi 04 : Préparation au Follow up

## Semaine 4 (07/12 au 11/12) : produit final

Lundi 07 : API sans état vérifiée avec docker compose up --scale api=2, test de charge k6 à 100 joueurs, rédaction de docs/charge.md, optimisations.

Mardi 08 : écran joueur pensé pour le mobile, QR code pour rejoindre, reconnexion transparente, vérification sur Android et iPhone ou leurs émulateurs.

Mercredi 09 : finalisation de la fonctionnalité différenciante.

Jeudi 10 : tests unitaires et d'intégration, test end-to-end Playwright, accessibilité, messages d'erreur clairs.

Vendredi 11 : README final, dossier docs à jour, préparation et répétition de la soutenance. Rendu final.

## Conseil des Follow up

