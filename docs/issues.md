# Découpage des steps 1 à 3 en issues

Les steps suivent le planning : step 1 = conception, socle et comptes (semaine 1), step 2 = le direct (semaine 2), step 3 = jeu complet et analyses (semaine 3). Estimations en heures de travail ; une issue ne dépasse pas une journée (8 h).

## Step 1 : conception, socle, comptes et studio de quiz

| # | Issue | Estimation | Dépend de |
| --- | --- | --- | --- |
| 1.1 | Schéma de base de données et migrations initiales | 4 h | |
| 1.2 | `Dockerfile` de l'API et du front | 3 h | |
| 1.3 | Configuration nginx (proxy `/api`, `/socket.io`, front statique) | 2 h | 1.2 |
| 1.4 | Squelette de l'API Express (TypeScript, route de santé, configuration, gestion d'erreurs) | 3 h | |
| 1.5 | Squelette du front React avec Vite et routage | 3 h | |
| 1.6 | CI : lint, types, construction des images | 3 h | 1.2, 1.4, 1.5 |
| 1.7 | Inscription avec mot de passe haché | 3 h | 1.1, 1.4 |
| 1.8 | Connexion, déconnexion et routes protégées | 4 h | 1.7 |
| 1.9 | Rate limiting sur l'authentification | 2 h | 1.8 |
| 1.10 | Écrans de connexion et d'inscription | 3 h | 1.5, 1.8 |
| 1.11 | API CRUD des quiz et des questions | 6 h | 1.1, 1.8 |
| 1.12 | Téléversement de médias vers le stockage S3 | 4 h | 1.4 |
| 1.13 | Tableau de bord et studio de quiz (liste, édition, types de questions) | 8 h | 1.10, 1.11 |
| 1.14 | Ajout d'images dans le studio, validation des fichiers | 3 h | 1.12, 1.13 |

Total step 1 : 51 h.

## Step 2 : le direct

| # | Issue | Estimation | Dépend de |
| --- | --- | --- | --- |
| 2.1 | Socket.IO avec adaptateur Redis et authentification des sockets | 4 h | 1.4 |
| 2.2 | Création d'une partie : PIN à 6 chiffres unique et état dans Redis | 4 h | 2.1 |
| 2.3 | Rejoindre sans compte avec pseudo unique (`player:join`, jeton joueur) | 4 h | 2.2 |
| 2.4 | Filtre des pseudos injurieux | 2 h | 2.3 |
| 2.5 | Rate limiting sur la saisie du PIN | 2 h | 2.3 |
| 2.6 | Salle d'attente temps réel : arrivées, compteur, exclusion | 4 h | 2.3 |
| 2.7 | Écran animateur : salle d'attente et PIN projeté | 4 h | 2.6 |
| 2.8 | Diffusion des questions sans bonne réponse et machine à états de la partie | 5 h | 2.2 |
| 2.9 | Écran animateur : question, médias, nombre de réponses reçues | 5 h | 2.8 |
| 2.10 | Écran joueur : rejoindre et répondre | 5 h | 2.3, 2.8 |
| 2.11 | Envoi et enregistrement des réponses (une par joueur et par question) | 3 h | 2.8 |
| 2.12 | Score simple et révélation de la bonne réponse | 3 h | 2.11 |
| 2.13 | Répartition des réponses, top 5, rang du joueur, classement final | 5 h | 2.12 |
| 2.14 | Tests d'intégration du protocole et vérification qu'aucun événement n'expose la bonne réponse | 4 h | 2.8, 2.12 |

Total step 2 : 54 h.

## Step 3 : jeu complet et analyses

| # | Issue | Estimation | Dépend de |
| --- | --- | --- | --- |
| 3.1 | Chronomètre piloté par le serveur avec échéance dans Redis et verrou de clôture | 5 h | 2.8 |
| 3.2 | Refus des réponses reçues après la fin | 2 h | 3.1 |
| 3.3 | Score fondé sur la justesse et la rapidité, bonus de série | 4 h | 3.1, 2.12 |
| 3.4 | Contrôles de l'animateur : pause, reprise, question suivante, fin | 5 h | 3.1 |
| 3.5 | Reconnexion d'un joueur (`player:rejoin`, `game:state`) | 5 h | 2.3, 3.1 |
| 3.6 | Pause automatique à la déconnexion de l'animateur et reprise | 3 h | 3.4 |
| 3.7 | Podium animé de fin de partie | 4 h | 2.13 |
| 3.8 | Nouveau mode de jeu : modèle et règles (équipes ou devoir) | 6 h | 3.3 |
| 3.9 | Nouveau mode de jeu : écrans et finalisation | 6 h | 3.8 |
| 3.10 | Persistance de la partie à la fin et historique des parties | 5 h | 2.13 |
| 3.11 | Rapport de partie (questions difficiles, répartition) | 5 h | 3.10 |
| 3.12 | Rapport par joueur | 3 h | 3.10 |
| 3.13 | Export CSV | 3 h | 3.11, 3.12 |

Total step 3 : 56 h.

## Ordre conseillé

1. Semaine 1 : 1.1 à 1.6 en parallèle, puis 1.7 à 1.10 (jeudi), 1.11 à 1.14 repoussées en semaine 2 si le retard se confirme, au plus tard le lundi 23.
2. Semaine 2 : 2.1 puis 2.2 et 2.3, ensuite écrans en parallèle des événements.
3. Semaine 3 : 3.1 en premier, car 3.2 à 3.6 en dépendent.

## Étiquettes proposées

`step-1`, `step-2`, `step-3`, `api`, `front`, `temps-reel`, `infra`, `docs`, `tests`, avec le titre de l'issue repris du tableau et l'estimation en étiquette `estimation:Nh`.
