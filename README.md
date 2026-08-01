# Sabotext

Sällskapsspel där en spelare skriver ett SMS — och resten sabotera det till något pinsamt, konstigt eller hysteriskt roligt. Sen röstar alla på den roligaste versionen.

**Domän:** [sabotext.com](https://sabotext.com)

## Så funkar det

1. En spelare får en uppgift (t.ex. *svara chefen varför du är sen*)
2. De skriver ett SMS
3. Övriga ändrar texten till något pinsamt/roligt
4. Alla röstar på den roligaste — vinnaren får poäng

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
2. Lägg till Redis-plugin (rekommenderas).
3. Sätt `PUBLIC_APP_URL=https://sabotext.com` och `REDIS_URL`.
4. Verifiera: `GET /api/health` → `persist.configured: true`.

### Cloudflare (frontend)

```bash
npm install && npm run build
npx wrangler deploy
```

Sätt `VITE_SOCKET_URL` i `client/.env.production` till din Railway-URL.

## Stack

- React + Vite (klient)
- Express + Socket.io (realtid)
- TypeScript
- Cloudflare Workers Assets + Railway
