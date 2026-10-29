# rig

Keeps a lane's lights on while nobody is in it: a heartbeat every minute, a status board, and a
morning digest of what ran overnight.

## Routes

- `GET /`: status board, including links to each available night's digest.
- `GET /digest/:night`: HTML digest for a night.
- `GET /api/digest/:night`: the same digest rows as JSON.

## Checks

```sh
pnpm test
pnpm typecheck
```

Completed plan: [Morning digest](docs/plans/done/morning-digest.md).

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

Working on it with an agent: start at [AGENTS.md](AGENTS.md).
