# Protocole des événements temps réel

Transport : Socket.IO, adaptateur Redis, namespace `/game`. Toutes les charges utiles sont en JSON. Les noms d'événements sont en `domaine:action`.

## Principes

- Le serveur est l'unique source de vérité : état, chronomètre, score, classement.
- La bonne réponse n'est jamais envoyée avant l'événement `question:reveal`.
- Le chronomètre est piloté par le serveur : le client reçoit `endsAt` (horodatage serveur en ms) et `serverTime` pour corriger sa dérive d'horloge. Une réponse reçue après `endsAt` est refusée.
- Chaque socket rejoint la room `game:{pin}` ; l'animateur rejoint aussi `game:{pin}:host`, le joueur `game:{pin}:player:{playerId}`.
- L'état de la partie est dans Redis (`game:{pin}`), ce qui permet plusieurs instances d'API sans état.
- Les requêtes client avec accusé utilisent un callback `ack({ ok: true, ... })` ou `ack({ ok: false, error: { code, message } })`.

## Authentification des sockets

| Rôle | Handshake `auth` | Vérification |
| --- | --- | --- |
| Animateur | `{ role: "host", token: <JWT> }` | JWT valide, propriétaire du quiz de la partie |
| Joueur | `{ role: "player", pin, playerToken? }` | PIN existant ; `playerToken` pour une reconnexion |

`playerToken` est un jeton signé opaque, délivré par `player:join`, qui identifie un joueur sans compte et permet de reprendre sa place.

## Cycle de vie d'une partie

```
LOBBY -> QUESTION -> REVEAL -> (LEADERBOARD) -> QUESTION ... -> FINISHED
              \-> PAUSED (animateur ou déconnexion) -> reprise vers QUESTION
```

| État | Signification |
| --- | --- |
| `LOBBY` | Salle d'attente, joueurs en arrivée |
| `QUESTION` | Question ouverte, chronomètre en cours |
| `REVEAL` | Question terminée, bonne réponse et répartition affichées |
| `LEADERBOARD` | Top 5 intermédiaire |
| `PAUSED` | Chronomètre figé |
| `FINISHED` | Classement final, podium |

## Événements client vers serveur

### Joueur

| Événement | Charge utile | Accusé / erreurs |
| --- | --- | --- |
| `player:join` | `{ pin, nickname }` | `{ playerId, playerToken, nickname }` ; `GAME_NOT_FOUND`, `GAME_STARTED`, `NICKNAME_TAKEN`, `NICKNAME_FORBIDDEN`, `RATE_LIMITED` |
| `player:rejoin` | `{ pin, playerToken }` | `{ playerId, state }` (voir `game:state`) ; `INVALID_TOKEN` |
| `answer:submit` | `{ questionId, choice }` où `choice` est un tableau d'indices ou un texte selon le type | `{ received: true }` ; `QUESTION_CLOSED`, `ALREADY_ANSWERED`, `INVALID_CHOICE` |

### Animateur

| Événement | Charge utile | Effet |
| --- | --- | --- |
| `host:open` | `{ gameId }` | Attache l'animateur à la partie, renvoie `game:state` |
| `host:start` | `{}` | `LOBBY` vers première question |
| `host:kick` | `{ playerId }` | Exclut un joueur, émet `player:kicked` |
| `host:pause` | `{}` | Fige le chronomètre |
| `host:resume` | `{}` | Reprend avec le temps restant |
| `host:skip` | `{}` | Termine la question en cours immédiatement |
| `host:next` | `{}` | Passe à la question suivante ou termine la partie |
| `host:end` | `{}` | Termine la partie |

Toute commande `host:*` d'un socket non animateur est refusée avec `FORBIDDEN`. Une commande incompatible avec l'état courant est refusée avec `INVALID_STATE`.

## Événements serveur vers client

### Diffusion à toute la room `game:{pin}`

| Événement | Charge utile |
| --- | --- |
| `lobby:update` | `{ count, players: [{ playerId, nickname }] }` |
| `player:kicked` | `{ playerId }` (le joueur concerné est déconnecté) |
| `game:started` | `{ totalQuestions }` |
| `question:start` | `{ questionId, index, total, type, text, media, options: [{ index, text, media }], durationMs, startsAt, endsAt, serverTime }` sans aucun indicateur de justesse |
| `question:end` | `{ questionId, reason: "timeout" \| "all-answered" \| "skipped" }` |
| `question:reveal` | `{ questionId, correct: [indices], distribution: { "0": n, "1": n }, explanation? }` |
| `leaderboard:top` | `{ top: [{ rank, playerId, nickname, score }] }` (5 premiers) |
| `game:paused` | `{ reason: "host" \| "host-disconnected", remainingMs }` |
| `game:resumed` | `{ endsAt, serverTime }` |
| `game:finished` | `{ ranking: [{ rank, playerId, nickname, score }], podium: [...] }` |

### Animateur uniquement (`game:{pin}:host`)

| Événement | Charge utile |
| --- | --- |
| `answer:count` | `{ questionId, answered, total }` |
| `host:disconnected` / `host:reconnected` | `{}` |

### Joueur uniquement (`game:{pin}:player:{playerId}`)

| Événement | Charge utile |
| --- | --- |
| `answer:result` | `{ questionId, correct, points, streak, total, rank }` envoyé après `question:reveal` |
| `game:state` | Instantané de reprise : `{ state, question?, endsAt?, serverTime, answered, score, rank }` |

## Séquence d'une question

```
Animateur            Serveur                       Joueurs
   |  host:next  ------>|                            |
   |                    |-- question:start --------->|  (tous)
   |                    |   (endsAt = now + durée)   |
   |                    |<------- answer:submit -----|
   |<-- answer:count ---|--- ack { received } ------>|
   |                    |  fin : timeout / tous ont répondu / host:skip
   |                    |-- question:end ----------->|
   |                    |-- question:reveal -------->|
   |                    |-- answer:result ---------->|  (individuel)
   |                    |-- leaderboard:top -------->|
```

## Chronomètre

- À `question:start`, le serveur enregistre `startsAt` et `endsAt` dans Redis et programme la fin de question.
- Pour que le minuteur survive à un redémarrage ou à un changement d'instance, la fin est portée par une clé Redis avec expiration plus un verrou (`SET NX`) qui garantit qu'une seule instance clôture la question.
- Le client calcule `offset = serverTime - Date.now()` à la réception, puis affiche `endsAt - (Date.now() + offset)`.
- Une réponse est acceptée si `now <= endsAt` côté serveur. Le temps de réponse retenu est `now - startsAt`, mesuré par le serveur.

## Score

`points = round(base * (0,5 + 0,5 * (1 - tempsDeRéponse / durée)))` si la réponse est juste, sinon 0. Le bonus de série ajoute `min(streak, 5) * 50`. Les paramètres sont centralisés côté serveur.

## Reconnexion et déconnexions

- Joueur : à la reconnexion du socket, le client envoie `player:rejoin` avec `playerToken` ; le serveur répond avec `game:state` et rétablit les rooms. Une réponse déjà envoyée n'est pas rejouable (`ALREADY_ANSWERED`).
- Un joueur déconnecté reste dans la partie et le classement ; il n'est pas retiré du compteur sauf exclusion.
- Animateur : à la déconnexion, une période de grâce de 15 s démarre ; passé ce délai la partie passe en `PAUSED` avec `reason: "host-disconnected"`. À la reconnexion, l'animateur reprend explicitement avec `host:resume`.

## Codes d'erreur

`GAME_NOT_FOUND`, `GAME_STARTED`, `NICKNAME_TAKEN`, `NICKNAME_FORBIDDEN`, `INVALID_TOKEN`, `RATE_LIMITED`, `FORBIDDEN`, `INVALID_STATE`, `QUESTION_CLOSED`, `ALREADY_ANSWERED`, `INVALID_CHOICE`, `VALIDATION_ERROR`.

## Limites de débit

- Saisie du PIN et `player:join` : 10 tentatives par minute et par IP, compteur dans Redis.
- `answer:submit` : une seule réponse acceptée par joueur et par question.
- Charge utile maximale d'un événement : 4 Ko.
