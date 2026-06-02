# Sprint 2 - Evidence test cases

Data evidenza locale: 2026-06-02.  
Comando eseguito: `cd backend && npm test`.  
Risultato locale: 17 suite passate, 160 test passati, 0 snapshot, tempo 19.671 s.

Questa matrice documenta i casi di test allineati ai moduli implementati e alla suite corrente. Dove il caso e' coperto da Jest/Supertest, l'esito "Actual result" riporta l'evidenza locale. Dove il caso e' di smoke/manuale, l'esito indica lo stato verificabile dalla documentazione o dalla presenza del codice, senza dichiarare risultati non misurati.

| ID | Modulo | Tipo | Scenario / passi sintetici | Fonte | Expected result | Actual result |
|---|---|---|---|---|---|---|
| TC-S2-001 | Auth | Automatico | Registrazione utente valida con nome, cognome, email e password. | `backend/tests/unit/auth.test.js` | HTTP 201 con token JWT e utente. | Passato in `npm test`: token e utente restituiti. |
| TC-S2-002 | Auth | Automatico | Registrazione con email gia' esistente. | `backend/tests/unit/auth.test.js` | Errore applicativo, nessun duplicato utente. | Passato in `npm test`: registrazione duplicata rifiutata. |
| TC-S2-003 | Auth | Automatico | Login con credenziali corrette. | `backend/tests/unit/auth.test.js` | HTTP 200 con token JWT. | Passato in `npm test`: login riuscito. |
| TC-S2-004 | Auth | Automatico | Login con password errata. | `backend/tests/unit/auth.test.js` | Errore autenticazione. | Passato in `npm test`: credenziali errate rifiutate. |
| TC-S2-005 | Auth | Automatico | Login di utente bannato. | `backend/tests/unit/auth.test.js` | Accesso negato. | Passato in `npm test`: utente bannato non accede. |
| TC-S2-006 | Auth | Automatico | Verifica JWT scaduto. | `backend/tests/unit/auth.test.js` | Token non valido. | Passato in `npm test`: `verifyToken` fallisce. |
| TC-S2-007 | Sicurezza | Automatico | Accesso a route private senza token. | `backend/tests/integration/security.test.js` | HTTP 401. | Passato in `npm test`: users, prenotazioni, annunci, wallet, notifiche, recensioni e segnalazioni rifiutano richieste non autorizzate. |
| TC-S2-008 | Sicurezza | Automatico | Authorization header malformato o token con firma errata. | `backend/tests/integration/security.test.js` | HTTP 401. | Passato in `npm test`: token malformato, firma errata e header senza Bearer rifiutati. |
| TC-S2-009 | Sicurezza/Admin | Automatico | Utente normale accede a route admin. | `backend/tests/integration/security.test.js` | HTTP 403. | Passato in `npm test`: accesso admin negato. |
| TC-S2-010 | Sicurezza | Automatico | Utente sospeso prova a pubblicare annuncio. | `backend/tests/integration/security.test.js` | HTTP 403. | Passato in `npm test`: pubblicazione bloccata. |
| TC-S2-011 | Sicurezza | Automatico | Utente sospeso prova a prenotare. | `backend/tests/integration/security.test.js` | HTTP 403. | Passato in `npm test`: prenotazione bloccata. |
| TC-S2-012 | Sicurezza | Automatico | Utente sospeso prova a inviare segnalazione. | `backend/tests/integration/security.test.js` | HTTP 403. | Passato in `npm test`: segnalazione bloccata. |
| TC-S2-013 | Annunci | Automatico | Creazione annuncio valido con oggetto, scadenza futura e posizione. | `backend/tests/unit/annunci.test.js` | Annuncio creato. | Passato in `npm test`: creazione valida riuscita. |
| TC-S2-014 | Annunci | Automatico | Creazione annuncio con data scadenza nel passato. | `backend/tests/unit/annunci.test.js` | Errore validazione. | Passato in `npm test`: annuncio rifiutato. |
| TC-S2-015 | Annunci | Automatico | Creazione annuncio senza titolo o categoria. | `backend/tests/unit/annunci.test.js` | Errore validazione. | Passato in `npm test`: campi obbligatori applicati. |
| TC-S2-016 | Annunci | Automatico | Creazione annuncio con piu' di 5 foto. | `backend/tests/unit/annunci.test.js` | Errore validazione. | Passato in `npm test`: limite foto applicato. |
| TC-S2-017 | Annunci | Automatico | Lettura annuncio per ID. | `backend/tests/unit/annunci.test.js` | Annuncio restituito. | Passato in `npm test`: lettura riuscita. |
| TC-S2-018 | Annunci | Automatico | Lettura annunci del donatore. | `backend/tests/unit/annunci.test.js` | Lista annunci proprietario. | Passato in `npm test`: lista corretta. |
| TC-S2-019 | Annunci | Automatico | Annuncio soft-deleted non visibile in lettura pubblica. | `backend/tests/unit/annunci.test.js` | Annuncio escluso. | Passato in `npm test`: annuncio non letto. |
| TC-S2-020 | Annunci | Automatico | Modifica annuncio in stato `DISPONIBILE`. | `backend/tests/unit/annunci.test.js` | Modifica accettata. | Passato in `npm test`: update riuscito. |
| TC-S2-021 | Annunci | Automatico | Modifica annuncio in stato non modificabile. | `backend/tests/unit/annunci.test.js` | Modifica rifiutata. | Passato in `npm test`: update bloccato. |
| TC-S2-022 | Annunci | Automatico | Soft-delete annuncio disponibile. | `backend/tests/unit/annunci.test.js` | `isAttivo=false`, documento mantenuto. | Passato in `npm test`: soft-delete applicato e documento presente. |
| TC-S2-023 | Annunci/Catalogo | Automatico | Filtro catalogo per categoria. | `backend/tests/unit/annunci.test.js` | Solo annunci della categoria richiesta. | Passato in `npm test`: filtro categoria corretto. |
| TC-S2-024 | Annunci/Catalogo | Automatico | Filtro catalogo per dimensione. | `backend/tests/unit/annunci.test.js` | Solo annunci della dimensione richiesta. | Passato in `npm test`: filtro dimensione corretto. |
| TC-S2-025 | Annunci/Catalogo | Automatico | Filtro catalogo per materiale. | `backend/tests/unit/annunci.test.js` | Solo annunci del materiale richiesto. | Passato in `npm test`: filtro materiale corretto. |
| TC-S2-026 | Annunci/Catalogo | Automatico | Ordinamento catalogo per data scadenza ASC. | `backend/tests/unit/annunci.test.js` | Ordine crescente. | Passato in `npm test`: ordinamento corretto. |
| TC-S2-027 | Annunci/Catalogo | Automatico | Paginazione e ordinamento backend senza filtri in memoria. | `backend/tests/unit/annunci.test.js` | Risposta paginata corretta. | Passato in `npm test`: catalogo paginato. |
| TC-S2-028 | Prenotazioni | Automatico | Donatore prova a prenotare il proprio annuncio. | `backend/tests/unit/prenotazioni.test.js`, `backend/tests/integration/swap.test.js` | Prenotazione rifiutata. | Passato in `npm test`: vincolo applicato. |
| TC-S2-029 | Prenotazioni | Automatico | Creazione prenotazione valida da acquirente. | `backend/tests/integration/swap.test.js` | HTTP 201 e annuncio prenotato. | Passato in `npm test`: prenotazione riuscita. |
| TC-S2-030 | Prenotazioni/RNF2 | Automatico | Due acquirenti prenotano contemporaneamente lo stesso annuncio. | `backend/tests/integration/concurrent.test.js` | Un HTTP 201, un HTTP 409, una sola prenotazione `ATTIVA`. | Passato in `npm test`: race gestita con optimistic locking. |
| TC-S2-031 | Prenotazioni/RNF2 | Automatico | Dieci acquirenti tentano contemporaneamente di prenotare lo stesso annuncio. | `backend/tests/integration/concurrent.test.js` | Un successo, nove conflitti, versione annuncio incrementata una sola volta. | Passato in `npm test`: stress locale 10 concorrenti superato. |
| TC-S2-032 | Prenotazioni | Automatico | Tentativo di prenotazione dopo annuncio gia' prenotato. | `backend/tests/integration/concurrent.test.js` | HTTP 409 "Oggetto non piu' disponibile". | Passato in `npm test`: ulteriore prenotazione rifiutata. |
| TC-S2-033 | QR | Automatico | Donatore genera QR per prenotazione attiva. | `backend/tests/integration/swap.test.js` | QR generato. | Passato in `npm test`: generazione riuscita. |
| TC-S2-034 | QR | Automatico | Acquirente valida QR e completa scambio. | `backend/tests/integration/swap.test.js` | Prenotazione completata e wallet aggiornati. | Passato in `npm test`: scambio completato. |
| TC-S2-035 | QR | Automatico | Validazione QR gia' usato. | `backend/tests/integration/qr_edge_cases.test.js` | HTTP 409. | Passato in `npm test`: riuso QR rifiutato. |
| TC-S2-036 | QR | Automatico | Validazione QR scaduto. | `backend/tests/integration/qr_edge_cases.test.js` | HTTP 410. | Passato in `npm test`: QR scaduto rifiutato. |
| TC-S2-037 | QR | Automatico | Validazione codice QR inesistente. | `backend/tests/integration/qr_edge_cases.test.js` | HTTP 404. | Passato in `npm test`: codice inesistente rifiutato. |
| TC-S2-038 | QR | Automatico | Acquirente tenta di generare QR. | `backend/tests/integration/qr_edge_cases.test.js` | HTTP 403. | Passato in `npm test`: generazione non autorizzata bloccata. |
| TC-S2-039 | Wallet | Automatico | Creazione wallet utente. | `backend/tests/unit/wallet.test.js` | Bilancio iniziale 0 e transazioni vuote. | Passato in `npm test`: wallet inizializzato correttamente. |
| TC-S2-040 | Wallet | Automatico | Accredito punti positivo. | `backend/tests/unit/wallet.test.js` | Bilancio incrementato e transazione registrata. | Passato in `npm test`: accredito corretto. |
| TC-S2-041 | Wallet | Automatico | Accredito punti nullo/negativo. | `backend/tests/unit/wallet.test.js` | Errore OCL #16. | Passato in `npm test`: importi invalidi rifiutati. |
| TC-S2-042 | Wallet | Automatico | Sottrazione punti con saldo sufficiente. | `backend/tests/unit/wallet.test.js` | Bilancio decrementato e transazione registrata. | Passato in `npm test`: sottrazione corretta. |
| TC-S2-043 | Wallet | Automatico | Sottrazione con saldo insufficiente. | `backend/tests/unit/wallet.test.js` | Errore, saldo non negativo. | Passato in `npm test`: saldo negativo impedito. |
| TC-S2-044 | Wallet | Automatico | Lettura saldo e storico. | `backend/tests/unit/wallet.test.js` | Saldo aggiornato e storico ordinato. | Passato in `npm test`: letture corrette. |
| TC-S2-045 | Notifiche | Automatico | Lista notifiche utente richiede autenticazione. | `backend/tests/integration/notifiche.test.js` | HTTP 401 senza token. | Passato in `npm test`: accesso anonimo rifiutato. |
| TC-S2-046 | Notifiche | Automatico | Lista notifiche paginata e filtrabile per `letta`. | `backend/tests/integration/notifiche.test.js` | HTTP 200 con paginazione coerente. | Passato in `npm test`: paginazione e filtro corretti. |
| TC-S2-047 | Notifiche | Automatico | Marca singola notifica come letta solo se proprietario. | `backend/tests/integration/notifiche.test.js` | Aggiornamento solo su notifica propria. | Passato in `npm test`: ownership applicata. |
| TC-S2-048 | Notifiche | Automatico | Marca tutte le notifiche proprie come lette. | `backend/tests/integration/notifiche.test.js` | Solo notifiche dell'utente aggiornate. | Passato in `npm test`: update massivo limitato al proprietario. |
| TC-S2-049 | Premi | Automatico | Riscatto premio con saldo sufficiente. | `backend/tests/unit/premi.test.js` | HTTP 201, codice univoco, stock decrementato. | Passato in `npm test`: riscatto riuscito. |
| TC-S2-050 | Premi | Automatico | Riscatto premio con saldo insufficiente. | `backend/tests/unit/premi.test.js` | HTTP 409. | Passato in `npm test`: riscatto rifiutato. |
| TC-S2-051 | Premi | Automatico | Lista premi attivi con filtro costo massimo e ordinamento. | `backend/tests/unit/premi.test.js` | Solo coupon attivi, ordinati per costo. | Passato in `npm test`: lista e filtro corretti. |
| TC-S2-052 | Premi | Automatico | Utente legge i propri riscatti. | `backend/tests/unit/premi.test.js` | Lista personale con coupon popolato. | Passato in `npm test`: riscatti personali restituiti. |
| TC-S2-053 | Premi | Automatico | Owner marca riscatto come usato. | `backend/tests/unit/premi.test.js` | HTTP 200 e stato aggiornato. | Passato in `npm test`: aggiornamento riuscito. |
| TC-S2-054 | Premi | Automatico | Non-owner marca riscatto come usato. | `backend/tests/unit/premi.test.js` | HTTP 403. | Passato in `npm test`: accesso rifiutato. |
| TC-S2-055 | Segnalazioni | Automatico | Segnalazione valida. | `backend/tests/unit/segnalazioni.test.js` | HTTP 201. | Passato in `npm test`: segnalazione creata. |
| TC-S2-056 | Segnalazioni | Automatico | Auto-segnalazione. | `backend/tests/unit/segnalazioni.test.js`, `backend/tests/integration/security.test.js` | HTTP 400/409. | Passato in `npm test`: OCL #19 applicato. |
| TC-S2-057 | Segnalazioni | Automatico | Segnalazione con motivo vuoto o assente. | `backend/tests/unit/segnalazioni.test.js` | HTTP 400. | Passato in `npm test`: OCL #18 applicato. |
| TC-S2-058 | Recensioni | Automatico | Recensione su prenotazione non completata. | `backend/tests/integration/reviews.test.js` | HTTP 409. | Passato in `npm test`: recensione anticipata rifiutata. |
| TC-S2-059 | Recensioni | Automatico | Recensione dopo scambio completato. | `backend/tests/integration/reviews.test.js` | HTTP 201. | Passato in `npm test`: recensione creata. |
| TC-S2-060 | Recensioni | Automatico | Seconda recensione dello stesso utente sulla stessa prenotazione. | `backend/tests/integration/reviews.test.js` | HTTP 409. | Passato in `npm test`: duplicato rifiutato. |
| TC-S2-061 | Recensioni | Automatico | Recensione da utente non partecipante. | `backend/tests/integration/reviews.test.js` | HTTP 403. | Passato in `npm test`: accesso rifiutato. |
| TC-S2-062 | Admin | Automatico | Admin sospende e riabilita utente. | `backend/tests/integration/admin_moderation.test.js` | Stato utente aggiornato e route protette coerenti. | Passato in `npm test`: sospensione e riabilitazione verificate. |
| TC-S2-063 | Admin | Automatico | Admin prova a riabilitare account bannato. | `backend/tests/integration/admin_moderation.test.js` | Operazione rifiutata. | Passato in `npm test`: account bannato non riabilitato. |
| TC-S2-064 | Admin/Segnalazioni | Automatico | Terzo malus produce auto-sospensione. | `backend/tests/integration/admin_moderation.test.js` | Utente sospeso automaticamente. | Passato in `npm test`: OCL #20 applicato. |
| TC-S2-065 | Admin/Segnalazioni | Automatico | Malus su segnalazione inesistente o gia' risolta. | `backend/tests/integration/admin_moderation.test.js` | Errori distinti. | Passato in `npm test`: casi distinti gestiti. |
| TC-S2-066 | Supporto | Automatico | Utente autenticato crea ticket supporto. | `backend/tests/integration/support_push.test.js` | HTTP 201. | Passato in `npm test`: ticket creato. |
| TC-S2-067 | Supporto | Automatico | Ticket supporto con testo vuoto. | `backend/tests/integration/support_push.test.js` | Errore validazione. | Passato in `npm test`: ticket rifiutato. |
| TC-S2-068 | Supporto | Automatico | Lista ticket personali. | `backend/tests/integration/support_push.test.js` | Solo ticket dell'utente autenticato. | Passato in `npm test`: isolamento utenti verificato. |
| TC-S2-069 | Push token | Automatico | Salvataggio token Expo valido. | `backend/tests/integration/support_push.test.js` | Token salvato su profilo utente. | Passato in `npm test`: token valido accettato. |
| TC-S2-070 | Push token | Automatico | Salvataggio token non Expo. | `backend/tests/integration/support_push.test.js` | Errore validazione. | Passato in `npm test`: token non valido rifiutato. |
| TC-S2-071 | Chat/Messaggi | Manuale/API | Lista conversazioni utente, storico messaggi, invio messaggio, typing e non letti. | `backend/src/routes/chatRoutes.js`, `backend/src/routes/messaggiRoutes.js` | Endpoint protetti da JWT e participant check dove previsto. | Non misurato nella run Jest corrente; endpoint implementati e inclusi nella checklist Postman. |
| TC-S2-072 | Scambi legacy | Automatico | Route legacy `/api/v1/scambi/:id/qr` e `/api/v1/scambi/:id/valida`. | `backend/tests/integration/scambi_legacy.test.js` | HTTP 410 con header `Deprecation`. | Passato in `npm test`: endpoint legacy deprecati esplicitamente. |
| TC-S2-073 | Frontend web | Automatico smoke | Verifica presenza/struttura pagine web principali. | `frontend/tests/smoke.test.mjs` | Smoke test frontend verde quando eseguito. | Passato in `cd frontend && npm test`: 4 smoke test verdi. |
| TC-S2-074 | Mobile | Automatico smoke | Verifica app Expo, schermate principali, client API e wiring push token. | `mobile/tests/smoke.test.mjs` | Smoke test mobile verde quando eseguito. | Passato in `cd mobile && npm test`: 4 smoke test verdi. |
