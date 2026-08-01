# Sabotext

Sällskapsspel där en spelare skriver ett SMS — och resten saboterar det till något pinsamt, konstigt eller hysteriskt roligt. Sen röstar alla på den roligaste versionen.

**Domän:** [sabotext.com](https://sabotext.com)

## Så funkar det

1. En spelare får en uppgift (t.ex. *svara chefen varför du är sen*)
2. De skriver ett SMS
3. Övriga ändrar texten till något pinsamt/roligt
4. Alla röstar på den roligaste — vinnaren får poäng

## Party

Gratis upp till **5 spelare**. Party-pass (Stripe) låser upp:

- Obegränsat antal spelare
- Fler rundor (12 / 16)
- Öppna rum (Hitta spel)
- Första köpet −30 %

Sätt Stripe-nycklar på Railway — se `.env.example`.

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
2. Lägg till Redis-plugin (rekommenderas för Party-pass + rum).
3. Sätt bland annat:
   - `PUBLIC_APP_URL=https://sabotext.com`
   - `STRIPE_SECRET_KEY=sk_live_…`
   - `STRIPE_WEBHOOK_SECRET=whsec_…` (endpoint: `https://<railway>/api/stripe/webhook`, event `checkout.session.completed`)
   - `REDIS_URL=…`
4. Verifiera: `GET /api/health` → `persist.configured` + `stripe: true`.

### Cloudflare (frontend)

```bash
npm install && npm run build
npx wrangler deploy
```

Sätt `VITE_SOCKET_URL` i `client/.env.production` till Railway-URL.

## Stack

- React + Vite (klient)
- Express + Socket.io (realtid)
- Stripe Checkout (Party)
- TypeScript
- Cloudflare Workers Assets + Railway
