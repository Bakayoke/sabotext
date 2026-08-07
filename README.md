# Sabotext

Sällskapsspel där alla skriver ett SMS — sen saboterar ni varandras till något pinsamt, konstigt eller hysteriskt roligt. Sen röstar alla på den roligaste versionen.

**Domän:** [sabotext.com](https://sabotext.com)

## Så funkar det

1. Ni får samma uppdrag (t.ex. *svara chefen varför du är sen*)
2. Alla skriver sitt eget SMS
3. Varje spelare saboterar en annans text
4. Alla röstar på det roligaste sabotaget (även sitt eget) — **100 poäng per röst**
5. Vid lika totalpoäng delar ni segern

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
2. Lägg till Redis-plugin och länka URL till API-tjänsten:
   - `REDIS_URL=${{Redis.REDIS_URL}}` (eller klistra in Redis-URL)
3. Sätt bland annat:
   - `PUBLIC_APP_URL=https://sabotext.com`
   - `STRIPE_SECRET_KEY=sk_live_…`
   - `STRIPE_WEBHOOK_SECRET=whsec_…` (endpoint: `https://<railway>/api/stripe/webhook`, event `checkout.session.completed`)
4. Verifiera: `GET /api/health` → `persist.configured: true` + `stripe: true`.
   Då överlever rum (även mitt i match) och Party-pass redeploys.

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
