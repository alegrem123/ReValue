# RE-VALUE

[![CI](https://github.com/alegrem123/ReValue/actions/workflows/ci.yml/badge.svg)](https://github.com/alegrem123/ReValue/actions/workflows/ci.yml)

Piattaforma di scambio e donazione di beni usati tra privati.  
Progetto accademico — Gruppo 21, Ingegneria del Software, UniTN A.A. 2025/2026.

---

## Struttura del progetto

```
ReValue/
├── backend/      # API REST — Node.js + Express + MongoDB
├── frontend/     # Web app — HTML/CSS/JS (Bootstrap 5)
├── mobile/       # App mobile — React Native (Expo)
├── docs/         # OpenAPI/Swagger e documentazione operativa
├── oas3.yaml     # Specifica OpenAPI 3 nel nome usato nelle slide del corso
├── report/       # Deliverable 4 e PDF finale
└── apiary.apib   # Versione API Blueprint pubblicabile su Apiary
```

---

## Prerequisiti

| Tool | Versione minima |
|------|-----------------|
| Node.js | 22.x (LTS) |
| npm | 9.x |
| Expo CLI | `npx expo` (incluso con Expo SDK 54) |
| MongoDB Atlas | account con cluster attivo |

La versione Node di riferimento e' dichiarata anche in `.nvmrc`. Con `nvm`:

```bash
nvm use
```

---

## Backend

### Setup

```bash
cd backend
npm ci
cp .env.example .env   # compila le variabili (vedi sotto)
```

### Variabili d'ambiente (`backend/.env`)

| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `MONGODB_URI` | Connection string MongoDB Atlas | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `JWT_SECRET` | Chiave segreta per firma JWT | stringa lunga e casuale |
| `PORT` | Porta del server (default: 3000) | `3000` |
| `REQUEST_BODY_LIMIT` | Limite body JSON (default: 10mb) | `10mb` |

### Avvio

```bash
# Produzione
npm start

# Sviluppo (ricarica automatica non inclusa — usa nodemon se vuoi)
npm run dev
```

Server disponibile su `http://localhost:3000`.

### Esecuzione test backend

Prerequisiti:
- Node.js 22.x, come indicato nel file `.nvmrc` nella root del repository.
- npm 9.x.
- Dipendenze installate a partire da `backend/package-lock.json`.

Comandi:

```bash
cd backend
npm ci
npm test                  # singola run
npm run test:watch        # watch mode
npm run test:coverage     # con coverage report
```

Gli script corrispondono a quelli definiti in `backend/package.json`. Per una esecuzione riproducibile usare `npm ci`, che installa esattamente le versioni risolte nel lockfile e fallisce se `package.json` e `package-lock.json` non sono coerenti.

I test usano `mongodb-memory-server`: durante l'esecuzione viene avviata una istanza MongoDB temporanea in memoria, quindi non serve una connessione a MongoDB Atlas. Possibili fallimenti ambientali possono dipendere dal download o dalla cache del binario MongoDB usato da `mongodb-memory-server`, da restrizioni di rete o filesystem, oppure da incompatibilita' della piattaforma locale con il binario richiesto.

### Seed database

```bash
cd backend
node seeds/<nome-seed>.js
```

---

## Frontend (Web)

Pagine HTML statiche. Nessun build step.

### Sviluppo locale

Opzione A — Live Server (VS Code extension):
```
Apri frontend/index.html → tasto destro → "Open with Live Server"
```

Opzione B — serve statico:
```bash
npx serve frontend
```

Il frontend chiama l'API su `/api/v1/...` — assicurati che il backend giri su porta 3000 e che il browser punti allo stesso host (o configura un proxy).

### Pagine principali

| File | Descrizione |
|------|-------------|
| `index.html` | Homepage |
| `views/catalog.html` | Catalogo annunci |
| `views/annuncio.html` | Dettaglio annuncio + prenotazione |
| `views/create-annuncio.html` | Crea nuovo annuncio |
| `views/my-annunci.html` | I miei annunci (donatore) |
| `views/mybookings.html` | Le mie prenotazioni (acquirente) |
| `views/qr-display.html` | QR code per consegna fisica |
| `views/qr-scan.html` | Scansiona QR (acquirente) |
| `views/messaggi.html` | Lista conversazioni |
| `views/chat.html` | Chat singola |
| `views/profile.html` | Profilo utente |
| `views/wallethistory.html` | Storico crediti |
| `views/login.html` | Accesso |
| `views/register.html` | Registrazione |

---

## Mobile (React Native / Expo)

### Setup

```bash
cd mobile
npm install
```

### Avvio

```bash
npx expo start
```

Poi:
- Premi `i` per simulatore iOS
- Premi `a` per emulatore Android
- Scansiona QR con **Expo Go** per dispositivo fisico

### Configurazione API

Il client mobile e' in `mobile/src/api/client.js`. In sviluppo prova a derivare l'host dal dev server Expo e usa la porta `3000`; in alternativa puoi impostare `EXPO_PUBLIC_API_BASE_URL`.

Per dispositivo fisico o rete LAN:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.x:3000 npm start
```

---

## Flusso principale

1. Utente si registra / accede → riceve JWT
2. Donatore crea annuncio con foto e posizione
3. Acquirente sfoglia catalogo, prenota annuncio
4. Donatore mostra QR (da `qr-display`) → Acquirente scansiona (`qr-scan`)
5. Backend valida QR → accredita i crediti dinamici congelati sulla prenotazione
6. Acquirente e donatore possono chattare via messaggi integrati

---

## Documentazione e file di supporto

| File | Ruolo | Se rimosso rompe runtime/test? | Valutazione |
|------|-------|--------------------------------|-------------|
| `.nvmrc` | Versione Node locale (`22`). | No: CI usa Node 22 in `.github/workflows/ci.yml`; npm continua a funzionare se Node e' corretto. | Da tenere: riduce errori ambientali prima di push/merge. |
| `.prettierrc` | Convenzioni Prettier per formattazione manuale/editor. | No: non ci sono script `format`/`prettier` nella pipeline corrente. | Non essenziale, ma tenerlo costa zero e mantiene stile condiviso. |
| `oas3.yaml` / `docs/openapi.yaml` | Specifica OpenAPI 3 / Swagger-compatible. | No runtime, ma si rompe la consegna API-first se manca o non e' allineata. | Essenziale per il corso: `oas3.yaml` usa il nome delle slide ed e' validabile in Swagger Editor/SwaggerHub. |
| `docs/deploy.md` | Procedura Render backend/frontend e smoke test produzione. | No: e' documentazione. | Da tenere: utile per PB-22, deploy ripetibile e discussione finale. |
| `docs/mongodb-atlas-setup.md` | Appunti minimi sul cluster Atlas usato. | No: e' documentazione. | Utile ma opzionale; non deve contenere password o segreti. |
| `apiary.apib` | Versione API Blueprint pubblicabile su Apiary. | No runtime. | Utile come documentazione Apiary; non sostituisce OpenAPI 3. |

File generati o temporanei (`*.log`, cache, build output, `.env`, credenziali)
non vanno committati. I file di report generati (`.aux`, `.toc`, `.out`, `.log`)
sono utili solo se il team vuole rendere riproducibile localmente la build LaTeX;
per una consegna pulita bastano sorgente `.tex` e PDF finale.

---

## Evidenze Sprint 2

- Specifica OpenAPI/Swagger: `oas3.yaml` (copia allineata anche in `docs/openapi.yaml`)
- Swagger UI interattiva: `/api-docs/` sul backend deployato, alias versionato `/api/v1/docs/`
- Documentazione Apiary/API Blueprint: `apiary.apib`
- Report finale: `report/Deliverable4.tex` e `report/Deliverable4.pdf`
- Deploy: `docs/deploy.md`
- Setup MongoDB Atlas: `docs/mongodb-atlas-setup.md`
- Suite automatica: backend Jest/Supertest, smoke test frontend e smoke test mobile.

---

## Autori

Gruppo 21 — Università di Trento  
Alessandro Turri · [altri membri del gruppo]
