# Architecture

## Vue d'ensemble

```mermaid
flowchart LR
    Client[Navigateur animateur / joueur] -->|HTTP + WebSocket| Proxy[nginx :8080]
    Proxy -->|/| Web[web : React statique]
    Proxy -->|/api| Api[api : Express + Socket.IO]
    Proxy -->|/socket.io| Api
    Api --> Db[(PostgreSQL)]
    Api --> Redis[(Redis)]
    Api --> Storage[(SeaweedFS S3)]
    Client -.->|médias via /media| Proxy
```

Le déploiement est défini dans [docker-compose.yml](../docker-compose.yml).

| Service | Image | Rôle | Réseaux | Exposé |
| --- | --- | --- | --- | --- |
| `proxy` | `nginx:1.29-alpine` | Point d'entrée unique, routage, upgrade WebSocket | `frontend` | `HTTP_PORT` (8080) |
| `web` | build `./web` | Fichiers statiques du front React | `frontend` | interne :80 |
| `api` | build `./api` | API REST, Socket.IO, logique de jeu | `frontend`, `backend` | interne :3000 |
| `db` | `postgres:18-alpine` | Données durables | `backend` | non |
| `redis` | `redis:8-alpine` | État des parties, pub/sub, limitation de débit | `backend` | non |
| `storage` | SeaweedFS (S3) | Images et médias des questions | `backend` | non |

Seul `proxy` est publié sur l'hôte. La base, Redis et le stockage ne sont joignables que depuis le réseau `backend`.

## Routage nginx

| Chemin | Destination | Remarque |
| --- | --- | --- |
| `/` | `web:80` | Repli sur `index.html` pour le routage côté client |
| `/api/` | `api:3000` | REST |
| `/socket.io/` | `api:3000` | En-têtes `Upgrade` et `Connection`, délais de lecture longs |
| `/media/` | `api:3000` | L'API vérifie les droits puis redirige vers une URL signée ou relaie le flux S3 |

## Composants de l'API

```
api/src
  config/        variables d'environnement validées au démarrage
  http/          routes REST, middlewares (auth, rate limit, validation, erreurs)
  realtime/      serveur Socket.IO, authentification des sockets, gestionnaires d'événements
  game/          machine à états, chronomètre, score, classement (logique pure, testable)
  repositories/  accès PostgreSQL, Redis, S3
  services/      comptes, quiz, parties, rapports, médias
```

Règles de dépendance : `http` et `realtime` appellent `services` ; `services` appellent `game` et `repositories` ; `game` ne dépend d'aucune infrastructure.

## Front

```
web/src
  pages/        connexion, tableau de bord, studio, salle d'attente, partie, rapports, rejoindre
  features/     auth, quiz-editor, host, player, reports
  realtime/     client Socket.IO, synchronisation d'horloge, reconnexion
  api/          client REST typé
```

L'écran animateur et l'écran joueur partagent le même client temps réel. L'état de la partie côté client est dérivé des événements ; le client ne calcule jamais le score ni la justesse.

## Authentification

- Animateurs : inscription et connexion par email et mot de passe haché avec argon2. L'API émet un JWT signé avec `JWT_SECRET`, stocké dans un cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Routes protégées : un middleware vérifie le JWT et rattache l'utilisateur à la requête. Les sockets animateur sont authentifiées avec le même jeton.
- Joueurs : aucun compte. Un `playerToken` signé est délivré à l'arrivée dans une partie et sert à la reconnexion.
- Rate limiting : compteurs Redis par IP sur l'authentification et la saisie du PIN.

## Données durables : PostgreSQL

```mermaid
erDiagram
    USERS ||--o{ QUIZZES : possède
    QUIZZES ||--o{ QUESTIONS : contient
    QUESTIONS ||--o{ OPTIONS : propose
    QUIZZES ||--o{ GAMES : "est joué dans"
    USERS ||--o{ GAMES : anime
    GAMES ||--o{ PLAYERS : accueille
    GAMES ||--o{ GAME_QUESTIONS : "fige"
    GAME_QUESTIONS ||--o{ ANSWERS : reçoit
    PLAYERS ||--o{ ANSWERS : donne
    GAMES ||--o{ TEAMS : "regroupe"
    TEAMS ||--o{ PLAYERS : "compose"
```

| Table | Colonnes principales |
| --- | --- |
| `users` | `id` uuid, `email` unique, `password_hash`, `display_name`, `created_at` |
| `quizzes` | `id`, `owner_id` vers `users`, `title`, `description`, `created_at`, `updated_at` |
| `questions` | `id`, `quiz_id`, `position`, `type` (`single`, `multiple`, `true_false`, `text`), `text`, `media_key`, `duration_s`, `points`, `settings` jsonb |
| `options` | `id`, `question_id`, `position`, `text`, `media_key`, `is_correct` |
| `games` | `id`, `quiz_id`, `host_id`, `pin`, `mode` (`classic`, `team`, `homework`), `status` (`lobby`, `running`, `finished`), `started_at`, `finished_at` |
| `game_questions` | `id`, `game_id`, `position`, `question_snapshot` jsonb : copie figée de la question et de ses options au lancement |
| `teams` | `id`, `game_id`, `name` |
| `players` | `id`, `game_id`, `team_id` nullable, `nickname`, `final_score`, `final_rank`, `joined_at`, contrainte unique (`game_id`, `lower(nickname)`) |
| `answers` | `id`, `game_question_id`, `player_id`, `choice` jsonb, `is_correct`, `response_ms`, `points`, `streak`, unique (`game_question_id`, `player_id`) |

Choix de conception :

- `game_questions.question_snapshot` fige le contenu : modifier un quiz après coup ne change ni l'historique ni les rapports.
- La contrainte unique sur `answers` garantit une seule réponse par joueur et par question, même avec plusieurs instances.
- Les parties et réponses sont écrites en base à la fin de la partie ; pendant la partie, elles vivent dans Redis.
- Index : `games(host_id, finished_at desc)`, `answers(player_id)`, `players(game_id)`.
- Les suppressions de quiz utilisent `on delete restrict` si des parties existent, pour préserver l'historique.
- Le PIN est unique parmi les parties non terminées (index unique partiel sur `games(pin)`) et vérifié par `^[0-9]{6}$`.
- Les unicités de position (`questions`, `options`) sont différées pour permettre de réordonner dans une transaction.

### Migrations

Les migrations sont des fichiers SQL numérotés dans `api/migrations/` (`001_schema.sql`). Au démarrage, l'API applique celles qui manquent dans une transaction, sous un verrou consultatif PostgreSQL, ce qui reste sûr avec `--scale api=2`. L'historique est dans la table `schema_migrations`. `npm run migrate` dans `api/` les applique à la demande. Pour changer le schéma, ajouter un nouveau fichier ; ne jamais modifier un fichier déjà appliqué.

## État temps réel : Redis

| Clé | Type | Contenu | Durée de vie |
| --- | --- | --- | --- |
| `game:{pin}` | hash | état, index de question, `hostId`, `gameId`, mode | 24 h après dernière activité |
| `game:{pin}:players` | hash | `playerId` vers JSON (pseudo, jeton haché, connecté) | idem |
| `game:{pin}:nicknames` | set | pseudos en minuscules, garantit l'unicité | idem |
| `game:{pin}:q:{index}:answers` | hash | `playerId` vers réponse, temps, points | idem |
| `game:{pin}:scores` | sorted set | score par joueur, source du classement | idem |
| `game:{pin}:timer` | string avec expiration | échéance de la question, verrou `SET NX` de clôture | durée de la question |
| `pin:{pin}` | string | `gameId`, garantit l'unicité du PIN | idem |
| `rl:{route}:{ip}` | compteur | limitation de débit | fenêtre glissante |

Le canal pub/sub de l'adaptateur Socket.IO relaie les diffusions entre instances de l'API.

## API sans état

Aucune donnée de partie ou de session n'est gardée en mémoire dans un processus : tout passe par Redis et PostgreSQL. Une instance peut donc être arrêtée ou dupliquée (`docker compose up --scale api=2`). Conséquence pour le temps réel : le transport `websocket` est forcé côté client, ce qui évite l'affinage de session sur nginx. Le proxy doit résoudre le service `api` par DNS Docker pour répartir les connexions.

## Flux principal d'une partie

```mermaid
sequenceDiagram
    participant H as Animateur
    participant A as API
    participant R as Redis
    participant P as Joueurs
    participant D as PostgreSQL
    H->>A: POST /api/games (quiz)
    A->>D: fige les questions
    A->>R: crée game:{pin}
    A-->>H: pin, gameId
    P->>A: player:join (pin, pseudo)
    A->>R: pseudo unique, joueur
    H->>A: host:next
    A->>R: échéance de question
    A-->>P: question:start
    P->>A: answer:submit
    A->>R: réponse, score
    A-->>P: question:reveal, answer:result
    H->>A: host:end
    A->>D: écrit joueurs, réponses, scores
    A-->>P: game:finished
```

