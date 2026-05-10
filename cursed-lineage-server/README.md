# Cursed Lineage: Domain Wars — Multiplayer Server

A real-time multiplayer backend for Cursed Lineage: Domain Wars. Enables true PvP matchmaking, global leaderboards, and friend codes across all players.

## Features
- **Real PvP Matchmaking** — find and fight actual players by level range
- **Global Leaderboard** — top 50 by kills, streak, level, or damage
- **Friend System** — 8-character friend codes (e.g. `AB3K-7NM2`), add/remove friends
- **Player Profiles** — persistent stats, builds, and arena records
- **Offline Matching** — fight offline players' saved builds when no one is live

## Tech Stack
- **Node.js + Express** — API server
- **better-sqlite3** — embedded database (no setup needed)
- **Single HTML frontend** — drop `index.html` into `/public`

## Quick Start (Local)
```bash
npm install
npm start
# Server runs on http://localhost:3000
```

## Deploy to Render (Free)
1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Create a **Disk** (under Advanced):
   - Mount path: `/opt/render/project/src/db`
   - Size: 1 GB (free tier)
6. Deploy — your game is live!

## Deploy to Railway (Free)
1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. It auto-detects Node.js and deploys
4. Add a volume mounted at `./db` for persistent database
5. Your game URL is generated automatically

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/player` | Register or update player profile |
| GET | `/api/player/code/:code` | Look up player by friend code |
| POST | `/api/pvp/queue` | Join the PvP matchmaking queue |
| GET | `/api/pvp/opponents/:name/:level` | Find 3 opponents near your level |
| POST | `/api/friends/add` | Add friend by their code |
| GET | `/api/friends/:playerId` | Get your friends list |
| DELETE | `/api/friends/:playerId/:friendName` | Remove a friend |
| GET | `/api/leaderboard?sort=kills` | Top 50 (sort: kills/streak/level/dmg) |
| GET | `/api/stats` | Global server stats |

## Project Structure
```
cursed-lineage-server/
├── server.js          # Express API server
├── package.json       # Dependencies
├── .gitignore
├── README.md
├── db/                # SQLite database (auto-created)
└── public/
    └── index.html     # The game (drop your file here)
```

## Connecting the Frontend
The game's `index.html` needs a small update to call the API instead of local storage for PvP features. The key changes:
- `publishToLeaderboard()` → POST to `/api/player`
- `findMatch()` → GET from `/api/pvp/opponents`
- Friend codes → GET/POST to `/api/friends`
- Leaderboard → GET from `/api/leaderboard`

The game still works fully offline with local storage — the API enhances it with real multiplayer when available.
