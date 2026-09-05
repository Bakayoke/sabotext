# Sabotext

Sällskapsspel där alla skriver ett SMS — sen saboterar ni varandras till något pinsamt, konstigt eller hysteriskt roligt. Sen röstar alla på den roligaste versionen.

**Domän:** [sabotext.com](https://sabotext.com)

**Helt gratis** — obegränsat antal spelare och alla rundalternativ.

## Så funkar det

1. Ni får samma uppdrag (t.ex. *svara chefen varför du är sen*)
2. Alla skriver sitt eget SMS
3. Varje spelare saboterar en annans text
4. Alla röstar på det roligaste sabotaget (även sitt eget) — **100 poäng per röst**
5. Vid lika totalpoäng delar ni segern

## Kom igång

```bash
npm install
npm install --prefix client
npm run dev
```

Öppna [http://localhost:5173](http://localhost:5173) — API/socket körs på port `3001`.

## Produktion

### Railway (API + sockets)

1. Skapa tjänst från GitHub-repot (Node start: `npm start`).
2. Lägg till Redis-plugin och länka URL till API-tjänsten:
   - `REDIS_URL=${{Redis.REDIS_URL}}` (eller klistra in Redis-URL)
3. Sätt bland annat:
   - `PUBLIC_APP_URL=https://sabotext.com`
4. Verifiera: `GET /api/health` → `persist.configured: true` + `free: true`.
   Då överlever rum (även mitt i match) redeploys.

### Cloudflare (frontend)

```bash
npm install && npm run build
npx wrangler deploy
```

Sätt `VITE_SOCKET_URL` i `client/.env.production` till Railway-URL.

## Stack

- React + Vite (klient)
- Express + Socket.io (realtid)
- TypeScript
- Cloudflare Workers Assets + Railway
- Redis (valfritt, för persistens)
