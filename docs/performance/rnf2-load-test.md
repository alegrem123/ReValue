# RNF2 - Load and concurrency evidence

Data evidenza locale: 2026-06-02.  
Ambiente locale: backend Jest/Supertest con `mongodb-memory-server`, non deployment production.  
Comando eseguito: `cd backend && npm test`.

## Scope RNF2

RNF2 viene trattato in modo prudente come:

- tenuta funzionale sotto concorrenza per il flusso critico di prenotazione;
- assenza di doppia prenotazione dello stesso annuncio;
- template operativo per una prova di carico HTTP a 500 utenti virtuali.

Questa pagina non dichiara throughput, latenza p95/p99 o capacita' production a 500 utenti, perche' tali metriche non sono state misurate in questa sessione.

## Evidenza locale misurata

Suite: `backend/tests/integration/concurrent.test.js`.

Risultati inclusi nella run locale del 2026-06-02:

| Caso | Concorrenza | Expected | Actual result |
|---|---:|---|---|
| Prenotazione concorrente su stesso annuncio | 2 acquirenti | Un solo HTTP 201, un HTTP 409, una sola prenotazione `ATTIVA`, annuncio `PRENOTATO`, versione incrementata a 1. | Passato in `npm test` in 31 ms. |
| Stress locale su stesso annuncio | 10 acquirenti | Un solo successo, nove conflitti HTTP 409, una sola prenotazione `ATTIVA`, versione incrementata a 1. | Passato in `npm test` in 150 ms. |
| Tentativo dopo prenotazione gia' acquisita | 1 richiesta successiva | HTTP 409 "Oggetto non piu' disponibile". | Passato in `npm test` in 12 ms. |

Run completa backend:

- Test suites: 17 passed / 17 total.
- Tests: 160 passed / 160 total.
- Time: 19.671 s.

Interpretazione: l'evidenza automatica dimostra che il meccanismo di optimistic locking e i vincoli applicativi impediscono la doppia prenotazione in concorrenza locale controllata. Non e' un benchmark prestazionale production.

## Piano per prova RNF2 a 500 utenti virtuali

### Prerequisiti

- Backend avviato contro un database dedicato ai test di carico, non un database condiviso con dati reali.
- `JWT_SECRET`, `MONGODB_URI`, `PORT` configurati.
- Dataset di test preparato con utenti e annunci disponibili.
- Log e metriche raccolti durante il test: status code, latenza media, p95, p99, request rate, error rate, CPU/RAM, metriche MongoDB.
- Definizione soglia prima dell'esecuzione. Esempio da confermare con il docente/team: almeno 95% richieste con risposta sotto 2 s e tasso errori tecnici sotto 1%, escludendo conflitti HTTP 409 attesi nei test di prenotazione concorrente.

### Scenari consigliati

| Scenario | Obiettivo | Note |
|---|---|---|
| Catalogo pubblico | Verificare lettura annunci e paginazione sotto carico. | Endpoint idoneo a 500 VU senza conflitti di dominio. |
| Login | Verificare rate limit e autenticazione. | Usare utenti pre-creati; attenzione ai limiti intenzionali su `/auth`. |
| Prenotazione distribuita | 500 utenti prenotano annunci diversi. | Misura carico applicativo senza conflitto intenzionale sullo stesso annuncio. |
| Prenotazione contesa | Molti utenti prenotano lo stesso annuncio. | Qui i 409 sono risultato corretto, non errore di performance. |
| Flusso QR | Generazione e validazione QR su prenotazioni gia' create. | Richiede setup dati accurato per evitare token riusati. |

## Istruzioni autocannon

Installazione temporanea:

```bash
npx autocannon --help
```

Esempio lettura catalogo a 500 connessioni per 60 secondi:

```bash
cd backend
npm start
```

In un secondo terminale:

```bash
npx autocannon \
  -c 500 \
  -d 60 \
  -p 10 \
  "http://localhost:3000/api/v1/annunci?page=1&limit=20"
```

Esempio con header JWT per endpoint protetto:

```bash
npx autocannon \
  -c 500 \
  -d 60 \
  -p 10 \
  -H "Authorization: Bearer <JWT_TEST>" \
  "http://localhost:3000/api/v1/wallet/me"
```

Per endpoint `POST`, preparare un body JSON dedicato e assicurarsi che i dati non causino conflitti non desiderati:

```bash
npx autocannon \
  -c 500 \
  -d 60 \
  -p 5 \
  -m POST \
  -H "Authorization: Bearer <JWT_TEST>" \
  -H "Content-Type: application/json" \
  -b '{"annuncioId":"<ANNUNCIO_ID>"}' \
  "http://localhost:3000/api/v1/prenotazioni"
```

Nota: se tutte le richieste usano lo stesso `annuncioId`, i conflitti HTTP 409 sono attesi dopo la prima prenotazione riuscita.

## Istruzioni k6

File esempio `rnf2-catalog.k6.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '60s', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/v1/annunci?page=1&limit=20');
  check(res, {
    'status 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

Esecuzione:

```bash
k6 run rnf2-catalog.k6.js
```

File esempio `rnf2-authenticated.k6.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

const token = __ENV.JWT_TEST;

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '60s', target: 500 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const headers = { Authorization: `Bearer ${token}` };
  const res = http.get('http://localhost:3000/api/v1/wallet/me', { headers });
  check(res, {
    'status 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

Esecuzione:

```bash
JWT_TEST="<JWT_TEST>" k6 run rnf2-authenticated.k6.js
```

## Template risultati 500 utenti

Compilare solo dopo esecuzione reale.

| Campo | Valore |
|---|---|
| Data esecuzione | TBD |
| Ambiente | TBD |
| Commit/branch | TBD |
| Database | TBD |
| Tool | autocannon/k6 |
| Scenario | TBD |
| Utenti virtuali / connessioni | 500 |
| Durata | TBD |
| Richieste totali | TBD |
| RPS medio | TBD |
| Latenza media | TBD |
| Latenza p95 | TBD |
| Latenza p99 | TBD |
| Error rate tecnico | TBD |
| HTTP 409 attesi per conflitti dominio | TBD |
| CPU/RAM backend | TBD |
| Metriche MongoDB | TBD |
| Esito rispetto soglia RNF2 | TBD |
| Note/anomalie | TBD |

## Criteri di lettura

- HTTP 2xx indica successo applicativo.
- HTTP 401/403 indica problema di setup token/ruoli, salvo scenario di sicurezza intenzionale.
- HTTP 409 puo' essere corretto nei test di prenotazione contesa.
- HTTP 5xx e timeout sono errori tecnici e vanno conteggiati nell'error rate.
- I risultati raccolti su laptop locale non rappresentano automaticamente il comportamento del deployment cloud.
