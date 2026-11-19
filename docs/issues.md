# Découpage des steps 1 à 3 en issues

Les steps suivent le planning : step 1 = conception, socle et comptes (semaine 1), step 2 = le direct (semaine 2), step 3 = jeu complet et analyses (semaine 3). Une issue regroupe un ensemble cohérent de travail et peut s'étendre sur plusieurs jours.

## Step 1 : conception, socle, comptes et studio de quiz

| # | Issue | Contenu | Dépend de |
| --- | --- | --- | --- |
| 1.1 | Socle d'infrastructure et squelettes API et front | `docker-compose.yml` (db, redis, storage, api, web, proxy), `Dockerfile` de l'API et du front, configuration nginx (proxy `/api`, `/media`, `/socket.io`, front statique), `.env.example`, squelette Express (TypeScript, configuration validée, route de santé, gestion d'erreurs), squelette React avec Vite | |
| 1.2 | Base de données | Schéma PostgreSQL, migrations initiales | 1.1 |
| 1.3 | Comptes et accès | Inscription avec mot de passe haché, connexion, déconnexion, routes protégées, rate limiting sur l'authentification, écrans de connexion et d'inscription | 1.1, 1.2 |
| 1.4 | API des quiz | CRUD des quiz et des questions | 1.2, 1.3 |
| 1.5 | Médias | Téléversement vers le stockage S3, validation des fichiers | 1.1 |
| 1.6 | Studio de quiz | Tableau de bord, liste et édition des quiz, types de questions, ajout d'images | 1.3, 1.4, 1.5 |

## Step 2 : le direct

| # | Issue | Contenu | Dépend de |
| --- | --- | --- | --- |
| 2.1 | Temps réel et création de partie | Socket.IO avec adaptateur Redis, authentification des sockets, PIN à 6 chiffres unique, état de la partie dans Redis | 1.1 |
| 2.2 | Rejoindre une partie | `player:join` sans compte, pseudo unique, jeton joueur, filtre des pseudos injurieux, rate limiting sur la saisie du PIN | 2.1 |
| 2.3 | Salle d'attente | Arrivées, compteur et exclusion en temps réel, écran animateur avec PIN projeté | 2.2 |
| 2.4 | Déroulement d'une question | Machine à états de la partie, diffusion des questions sans bonne réponse, écran animateur (question, médias, nombre de réponses), écran joueur, enregistrement d'une réponse par joueur et par question | 2.2, 2.3 |
| 2.5 | Score, résultats et tests | Score simple, révélation de la bonne réponse, répartition des réponses, top 5, rang du joueur, classement final, tests d'intégration du protocole dont l'absence de fuite de la bonne réponse | 2.4 |

## Step 3 : jeu complet et analyses

| # | Issue | Contenu | Dépend de |
| --- | --- | --- | --- |
| 3.1 | Chronomètre et score avancé | Chronomètre piloté par le serveur (échéance dans Redis, verrou de clôture), refus des réponses tardives, score fondé sur la justesse et la rapidité, bonus de série | 2.4, 2.5 |
| 3.2 | Contrôles de l'animateur et reconnexion | Pause, reprise, question suivante, fin, pause automatique si l'animateur se déconnecte, reconnexion d'un joueur (`player:rejoin`, `game:state`) | 3.1 |
| 3.3 | Podium et nouveau mode de jeu | Podium animé de fin de partie, mode équipes ou devoir (modèle, règles, écrans) | 2.5, 3.1 |
| 3.4 | Historique et rapports | Persistance de la partie à la fin, historique des parties, rapport de partie, rapport par joueur, export CSV | 2.5 |

## Ordre conseillé

1. Semaine 1 : 1.1 en premier (déjà réalisée en local), 1.2 en parallèle, puis 1.3 (jeudi), 1.4 à 1.6 repoussées en semaine 2 si le retard se confirme, au plus tard le lundi 23.
2. Semaine 2 : 2.1 puis 2.2, ensuite 2.3 et 2.4, 2.5 en dernier.
3. Semaine 3 : 3.1 en premier, car 3.2 et 3.3 en dépendent.

## Étiquettes proposées

`step-1`, `step-2`, `step-3`, `api`, `front`, `temps-reel`, `infra`, `docs`, `tests`, avec le titre de l'issue repris du tableau.
