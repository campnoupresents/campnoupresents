# Tournee Backend

Express + MongoDB backend for the Tournee app.

Setup:

1. Copy `.env.example` to `.env` and set `MONGODB_URI` and `JWT_SECRET`.
2. Install dependencies:

```bash
cd backend
npm install
```

3. Run server in dev:

```bash
npm run dev
```

API endpoints:
- `POST /api/auth/register` - create admin
- `POST /api/auth/login` - returns JWT
- `GET/POST/PUT/DELETE /api/teams` - teams (auth)
- `GET/POST/PUT/DELETE /api/matches` - matches (auth)
- `GET/PUT /api/tournament` - tournament config (auth)

