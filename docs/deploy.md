# Deploy RE-VALUE — Render.com

## Struttura

| Componente | Tipo Render | Root dir | Start command |
|------------|-------------|----------|---------------|
| Backend | Web Service | `backend/` | `node server.js` |
| Frontend | Static Site | `frontend/` | — |

---

## 1. Backend — Render Web Service

### 1.1 Creare il service

1. Render Dashboard → **New → Web Service**
2. Connetti repo GitHub (`Gruppo21/ReValue` o nome effettivo)
3. Impostazioni:
   - **Name**: `revalue-backend`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free

### 1.2 Env vars (Environment → Add Environment Variable)

| Key | Valore |
|-----|--------|
| `MONGODB_URI` | `mongodb+srv://<user>:<password>@cluster.mongodb.net/?appName=Cluster0` |
| `JWT_SECRET` | stringa casuale lunga ≥ 32 char |
| `PORT` | `3000` |
| `REQUEST_BODY_LIMIT` | `10mb` |
| `FRONTEND_URL` | URL del frontend Render (aggiungere dopo step 2) |
| `SMTP_USER` | indirizzo Gmail |
| `SMTP_PASS` | App Password Gmail (non la password normale) |
| `NODE_ENV` | `production` |

> **NON committare mai `.env.production`** — solo env vars nel dashboard Render.

### 1.3 MongoDB Atlas — whitelist IP

Atlas Dashboard → **Network Access → Add IP Address** → inserire `0.0.0.0/0` (tutti gli IP, necessario per Render piano gratuito).

### 1.4 Verifica

Dopo il deploy, aprire:
```
https://revalue-backend-84jb.onrender.com/api/v1/annunci
```
Atteso: risposta JSON (anche array vuoto), non errore 503.

---

## 2. Frontend — Render Static Site

### 2.1 Creare il service

1. Render Dashboard → **New → Static Site**
2. Stesso repo GitHub
3. Impostazioni:
   - **Name**: `revalue-frontend`
   - **Root Directory**: `frontend`
   - **Publish Directory**: `.` (o `views` se necessario)
   - **Build Command**: lasciare vuoto

### 2.2 Configurare URL backend

In `frontend/js/apiClient.js`, `API_BASE` deve puntare all'URL backend Render in produzione (vedere step seguente nel file).

### 2.3 Aggiornare FRONTEND_URL nel backend

Dopo creazione Static Site, copiare l'URL (es. `https://revalue-frontend.onrender.com`) e aggiornare la env var `FRONTEND_URL` nel Web Service backend → **Redeploy**.

### 2.4 Verifica

Aprire `https://revalue-frontend.onrender.com/views/login.html` → pagina carica, form funziona.

---

## 3. URL Produzione

| Servizio | URL |
|----------|-----|
| Backend | `https://revalue-backend-84jb.onrender.com` |
| Frontend | `https://revalue-frontend.onrender.com` |

---

## 4. Smoke Test — Risultati (31-05-2026)

Eseguito manualmente su `https://revalue-frontend.onrender.com`.

| # | Flusso | Esito | Note |
|---|--------|-------|------|
| 1 | Registrazione nuovo utente | PASS | — |
| 2 | Login + JWT restituito | PASS | JWT presente in localStorage |
| 3 | Creazione annuncio | PASS | Redirect a `annuncio.html` anziché `my-annunci.html` (comportamento accettabile) |
| 4 | Prenotazione annuncio | PASS | — |
| 5 | Visualizzazione crediti utente | PASS | Saldo visibile; crediti iniziali 50pt non mostrati per utenti nuovi (seed non eseguito in produzione) |

**Tutti i flussi principali operativi in produzione.**
