# RE-VALUE

Progetto Ingegneria del Software, Università di Trento A.A. 2025/2026 — Gruppo 21.

## 👥 Team

| Nome | Matricola | Ruolo |
|------|-----------|-------|
| Alessandro Gremes | 242330 | 
| Paolo Sarcletti | 246846 | 
| Alessandro Turri | 244927 | 

## Convenzioni API

### Naming
- Variabili e campi: **camelCase** (es. `dataScadenza`, `idUtente`)
- Endpoint: **kebab-case** (es. `/api/annunci/:id/cambia-stato`)
- Collezioni MongoDB: **camelCase plurale** (es. `utenti`, `annunci`)

### Formato risposta
Tutte le risposte API seguono questo formato standard:

\`\`\`json
// Successo
{ "ok": true, "data": { ... } }

// Errore
{ "ok": false, "error": "CODICE_ERRORE", "message": "Descrizione leggibile" }
\`\`\`

### Autenticazione
Tutte le route protette richiedono header:
\`\`\`
Authorization: Bearer <jwt_token>
\`\`\`

## 🚀 Setup locale

### Prerequisiti
- Node.js 18+
- npm 9+
- Account MongoDB Atlas

### Configurazione
Crea \`backend/.env\` (vedi \`backend/.env.example\`):
\`\`\`
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
PORT=3000
NODE_ENV=development
ALLOWED_ORIGIN=http://localhost:3000
\`\`\`

### Avvio
\`\`\`bash
cd backend
npm run dev
\`\`\`
