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
└── docs/         # Documentazione deliverable
```

---

## Prerequisiti

| Tool | Versione minima |
|------|-----------------|
| Node.js | 22.x (LTS) |
| npm | 9.x |
| Expo CLI | `npx expo` (incluso con Expo SDK 54) |
| MongoDB Atlas | account con cluster attivo |

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

Il frontend chiama l'API su `/api/...` — assicurati che il backend giri su porta 3000 e che il browser punti allo stesso host (o configura un proxy).

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

L'app punta al backend tramite `API_BASE_URL` definita in `mobile/src/api/apiClient.js`.  
In sviluppo locale cambia l'URL con l'IP della tua macchina (es. `http://192.168.1.x:3000`).

---

## Flusso principale

1. Utente si registra / accede → riceve JWT
2. Donatore crea annuncio con foto e posizione
3. Acquirente sfoglia catalogo, prenota annuncio
4. Donatore mostra QR (da `qr-display`) → Acquirente scansiona (`qr-scan`)
5. Backend valida QR → trasferisce crediti (50pt ciascuno)
6. Acquirente e donatore possono chattare via messaggi integrati

---

## Autori

Gruppo 21 — Università di Trento  
Alessandro Turri · [altri membri del gruppo]
