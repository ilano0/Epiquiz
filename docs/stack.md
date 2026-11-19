# Choix de la stack

Critères : temps réel fiable, API sans état pour passer à l'échelle (`--scale api=2`), délai de 4 semaines, déploiement par `docker compose`, tests faciles.

## Synthèse

| Besoin | Choix | Alternatives étudiées |
| --- | --- | --- |
| API | Node.js, Express, TypeScript | Fastify, NestJS |
| Temps réel | Socket.IO avec adaptateur Redis | `ws` brut, SSE |
| Front | React, Vite, TypeScript | Vue, Svelte, Next.js |
| Base de données | PostgreSQL 18 | MySQL, MongoDB |
| État de partie, pub/sub, limitation de débit | Redis 8 | Mémoire de l'API, PostgreSQL |
| Médias | SeaweedFS (API S3) | MinIO, disque local |
| Reverse proxy | nginx | Traefik, Caddy |
| Authentification | JWT en cookie `HttpOnly`, hachage argon2 | Sessions serveur |
| Tests | Vitest, Playwright, k6 | Jest, Cypress |

## Comparaisons

### API : Express contre Fastify et NestJS

| | Express | Fastify | NestJS |
| --- | --- | --- | --- |
| Prise en main | Immédiate | Rapide | Longue (décorateurs, modules) |
| Performances | Suffisantes pour 100 joueurs | Meilleures | Dépend du moteur |
| Écosystème | Le plus large | Large | Large, très structuré |
| Intégration Socket.IO | Directe sur le serveur HTTP | Directe via plugin | Passerelles dédiées |

Choix : Express. Le goulot d'étranglement est le temps réel et Redis, pas le routeur HTTP ; la simplicité fait gagner du temps sur un projet de quatre semaines.

### Temps réel : Socket.IO contre `ws` et SSE

| | Socket.IO | `ws` | SSE |
| --- | --- | --- | --- |
| Rooms et diffusion | Natif | À écrire | À écrire |
| Reconnexion automatique | Oui | À écrire | Oui (un sens seulement) |
| Plusieurs instances | Adaptateur Redis officiel | À écrire | À écrire |
| Accusés de réception | Oui | À écrire | Non |
| Sens du flux | Bidirectionnel | Bidirectionnel | Serveur vers client |

Choix : Socket.IO, qui couvre rooms, reconnexion, accusés et passage à l'échelle avec l'adaptateur Redis. Le surcoût de protocole est acceptable.

### Front : React contre Vue, Svelte et Next.js

| | React + Vite | Vue + Vite | Svelte | Next.js |
| --- | --- | --- | --- | --- |
| Connaissance de l'équipe | Bonne | Moyenne | Faible | Bonne |
| Rendu serveur utile ici | Non | Non | Non | Oui, sans intérêt pour une application connectée |
| Bibliothèques (QR code, animations, graphiques) | Très nombreuses | Nombreuses | Moins nombreuses | Comme React |
| Image Docker | Fichiers statiques servis par nginx | Idem | Idem | Serveur Node supplémentaire |

Choix : React avec Vite. L'application est une SPA derrière authentification, sans besoin de référencement ; des fichiers statiques réduisent l'image du front.

### Données : PostgreSQL contre MySQL et MongoDB

Le modèle est relationnel (utilisateurs, quiz, questions, options, parties, joueurs, réponses) et les rapports demandent des agrégats. PostgreSQL offre `jsonb` pour les paramètres de question, des transactions et de bons outils d'agrégation. MongoDB complique les rapports ; MySQL n'apporte rien de plus.

### État de partie : Redis

L'état d'une partie vivante est court, très modifié et partagé entre instances. Redis fournit structures de données, expiration, verrous (`SET NX`) et pub/sub pour l'adaptateur Socket.IO. Les résultats définitifs sont écrits dans PostgreSQL à la fin de la partie.

### Médias : SeaweedFS contre MinIO et disque local

L'API S3 rend le stockage interchangeable. Le disque local casserait l'API sans état avec plusieurs instances. SeaweedFS est déjà configuré dans `docker-compose.yml`, légèrement plus léger à faire tourner que MinIO.

### Reverse proxy : nginx contre Traefik et Caddy

nginx sert le front statique, route `/api` et `/socket.io` vers l'API avec l'en-tête `Upgrade` pour les WebSocket. La configuration est explicite et bien connue. Pour plusieurs instances d'API, Socket.IO exige soit un affinage de session, soit le transport WebSocket seul ; le choix est le transport `websocket` forcé côté client, sans affinage.

