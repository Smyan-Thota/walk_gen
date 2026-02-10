# Random Walk Generator

Generate random loop walking routes based on time and hilliness preference.

## Quick Start

### Prerequisites
- Node.js 18+
- API keys: [openrouteservice.org](https://openrouteservice.org) and [maptiler.com](https://maptiler.com)

### Run Locally
```bash
git clone <repo> && cd random-walk
cp .env.example .env.local
# Add your API keys to .env.local
npm install
npm run dev
```

Open http://localhost:3000.

> **No API keys?** The app runs in demo mode locally, returning a sample route in San Francisco.

### Deploy to Vercel
1. Push to GitHub.
2. Import project in Vercel.
3. Add environment variables: `ORS_API_KEY`, `NEXT_PUBLIC_MAPTILER_KEY`.
4. Deploy.

### Run Tests
```bash
npm test
```

## Troubleshooting

| Problem | Solution |
|---|---|
| Map shows grey/no tiles | Check `NEXT_PUBLIC_MAPTILER_KEY` is set and valid |
| "Rate limited" errors | ORS free tier allows ~40 req/min. Wait and retry. |
| Route not generating | Check `ORS_API_KEY` is set. Check browser console for errors. |
| Geolocation not working | Requires HTTPS (or localhost). Try entering address manually. |
