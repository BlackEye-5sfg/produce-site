# PLU Hub

Walmart produce PLU reference with login, SQLite, and generated barcodes.

```
produce-site/
├── src/
│   ├── server.js      Express app, auth, API
│   ├── db.js          SQLite access
│   ├── catalog.js     Seed catalog
│   └── seed.js        Load catalog into SQLite
├── public/            Static frontend
├── data/              SQLite database (gitignored)
├── package.json
└── .env               AUTH_USER, AUTH_PASSWORD, SESSION_SECRET, PORT
```

## Setup

```bash
cp .env.example .env
npm install
npm run seed
npm start
```

Production is managed with PM2 as **PLU Hub**.
