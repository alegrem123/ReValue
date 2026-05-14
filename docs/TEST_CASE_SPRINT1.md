# Test Case Sprint 1 - RE-VALUE

Questo file raccoglie i test case formali da riportare nel template ufficiale della Milestone/Deliverable 3. La struttura segue l'impostazione vista nelle lezioni sul software testing: identificativo, requisito collegato, precondizioni, dati di test, passi, risultato atteso, risultato effettivo ed esito.

## Sintesi

| Campo | Valore |
| --- | --- |
| Progetto | RE-VALUE |
| Sprint | Sprint 1 |
| Data verifica automatica locale | 14 maggio 2026 |
| Comando backend | `cd backend && npm install && npm test -- --runInBand` |
| Esito backend locale | 8 suite passate, 74 test passati, 0 falliti |
| Ambiente verifica locale | Node.js `v22.19.0`, npm `10.9.3`, `supertest` e `mongodb-memory-server` installati |
| Ambito test automatici | Backend REST, modelli, servizi e flussi principali |
| Ambito test manuali/formali | Web/mobile e verifica end-to-end dei casi utente |

## Legenda

| Campo | Significato |
| --- | --- |
| Priorita | Alta, Media, Bassa |
| Tipo | Unit, Integration, E2E, Manual |
| Esito | Pass, Fail, Non eseguito |

## Test case

| ID | Requisito / UC / Vincolo | Priorita | Tipo | Precondizioni | Test data | Passi | Expected result | Actual result | Esito |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TC01 | Auth - Registrazione | Alta | Integration | Email non presente nel sistema | `mario.rossi@example.com`, password valida | Inviare `POST /api/auth/register` con nome, cognome, email e password | Utente creato, token JWT restituito, wallet inizializzato | Verificato da `auth.test.js` e flusso E2E | Pass |
| TC02 | Auth - Email duplicata | Alta | Unit/Integration | Utente gia registrato con la stessa email | stessa email di TC01 | Inviare una seconda registrazione con email gia usata | Errore di conflitto, nessun secondo utente creato | Verificato da `auth.test.js` | Pass |
| TC03 | Auth - Login valido | Alta | Unit/Integration | Utente registrato | email e password corrette | Inviare `POST /api/auth/login` | Login riuscito, token JWT restituito, dati utente senza password hash | Verificato da `auth.test.js` | Pass |
| TC04 | Auth - Login con password errata | Alta | Unit/Integration | Utente registrato | email valida, password errata | Inviare `POST /api/auth/login` | Errore di autenticazione, nessun token restituito | Verificato da `auth.test.js` | Pass |
| TC05 | RF15/RF16 - Creazione annuncio valida | Alta | Unit/Integration | Utente autenticato | titolo, categoria, descrizione, scadenza futura, max 5 foto | Inviare `POST /api/annunci` con JWT valido | Annuncio creato, stato `DISPONIBILE`, `isAttivo = true`, versione iniziale 0 | Verificato da `annunci.test.js` e `catalog_flow.test.js` | Pass |
| TC06 | OCL #5 - Data scadenza nel futuro | Alta | Unit | Utente/donatore esistente | `dataScadenza` nel passato | Tentare creazione annuncio con scadenza passata | Creazione rifiutata per violazione vincolo | Verificato da `annunci.test.js` | Pass |
| TC07 | RF15 - Numero massimo foto | Media | Unit/Integration | Utente autenticato | array `foto` con 6 elementi | Tentare creazione annuncio con piu di 5 foto | Validazione rifiutata | Verificato da `annunci.test.js` | Pass |
| TC08 | RF4/UC8 - Catalogo pubblico anonimo | Alta | Integration | Almeno un annuncio disponibile con coordinate | richiesta senza token | Inviare `GET /api/annunci` senza Authorization | Catalogo visibile, coordinate esatte non restituite | Verificato da `catalog_flow.test.js` | Pass |
| TC09 | RF22 - Filtri catalogo | Media | Unit/Integration | Annunci con categorie/materiali/dimensioni diverse | query `categoria`, `dimensione`, `materiale` | Inviare `GET /api/annunci?...` con filtri | Restituiti solo annunci compatibili con i filtri | Verificato da `annunci.test.js` | Pass |
| TC10 | RF24/UC2 - Prenotazione valida | Alta | Integration/E2E | Annuncio disponibile, acquirente autenticato diverso dal donatore | `annuncioId` valido | Inviare `POST /api/prenotazioni` | Prenotazione `ATTIVA`, annuncio `PRENOTATO`, conversazione creata, coordinate rivelate | Verificato da `swap.test.js` | Pass |
| TC11 | OCL #4 - Donatore non prenota il proprio annuncio | Alta | Manual/Integration | Donatore autenticato e annuncio proprio disponibile | token del donatore | Tentare `POST /api/prenotazioni` sul proprio annuncio | Operazione rifiutata con errore | Vincolo presente in `prenotazioniController.js`; candidato a test automatico dedicato | Non eseguito |
| TC12 | OCL #7/#9 - Doppia prenotazione concorrente | Alta | Integration | Annuncio disponibile e acquirenti autenticati | due o dieci token acquirenti, stesso `annuncioId` | Inviare prenotazioni quasi simultanee | Una sola richiesta passa, le altre ricevono conflitto; una sola prenotazione attiva | Verificato da `concurrent.test.js`, incluso stress test con 10 utenti concorrenti | Pass |
| TC13 | RF26/OCL #10 - Annullamento entro 15 minuti | Alta | Integration | Prenotazione attiva recente dell'acquirente | `prenotazioneId` valido | Inviare `DELETE /api/prenotazioni/:id` entro 15 minuti | Prenotazione `ANNULLATA`, annuncio torna `DISPONIBILE`, QR eliminato | Verificato da `qr_edge_cases.test.js` come setup e da logica controller | Pass |
| TC14 | RF26/OCL #10 - Annullamento oltre finestra | Media | Manual/Integration | Prenotazione attiva piu vecchia di 15 minuti | `dataPrenotazione` antecedente | Tentare `DELETE /api/prenotazioni/:id` | Operazione rifiutata per finestra temporale scaduta | Logica presente in `annullaPrenotazione`; candidato a test automatico dedicato | Non eseguito |
| TC15 | RF5/UC10 - Lettura saldo wallet | Alta | Unit/Integration | Utente autenticato con wallet | token utente | Inviare `GET /api/wallet/saldo` | Saldo restituito correttamente | Verificato da `wallet.test.js` e flusso E2E | Pass |
| TC16 | RF6/UC11 - Storico wallet | Media | Unit/Integration | Wallet con transazioni | accrediti/sottrazioni | Inviare `GET /api/wallet/storico` | Transazioni restituite con tipo, ammontare, motivo e data | Verificato da `wallet.test.js` | Pass |
| TC17 | RF10/RF13/RF14 - Invio messaggio tra partecipanti | Alta | Manual/Integration | Prenotazione con conversazione; utente partecipante autenticato | testo non vuoto | Inviare messaggio tramite `/api/conversazioni/:id/messaggi` o `/api/messaggi/:prenotazioneId` | Messaggio salvato e visibile nello storico | Logica presente in controller e middleware; da automatizzare | Non eseguito |
| TC18 | RF13 - Blocco messaggio da non partecipante | Alta | Manual/Integration | Conversazione esistente; utente esterno autenticato | token utente non partecipante | Tentare lettura/invio su conversazione altrui | Accesso negato | Vincolo presente in `requireParticipant.js`; da automatizzare | Non eseguito |
| TC19 | RF17 - Generazione QR | Alta | Integration/E2E | Prenotazione attiva; donatore autenticato | `prenotazioneId` valido | Inviare `POST /api/qr/genera` | Codice generato, scadenza valorizzata, token collegato alla prenotazione | Verificato da `swap.test.js` e `qr_edge_cases.test.js` | Pass |
| TC20 | RF27/UC3/OCL #14 - Validazione QR corretta | Alta | Integration/E2E | QR valido, prenotazione attiva, acquirente autenticato | codice QR valido | Inviare `POST /api/qr/valida` | Prenotazione completata, annuncio ritirato/disattivato, crediti accreditati | Verificato da `swap.test.js` | Pass |
| TC21 | OCL #14 - QR gia usato | Alta | Integration | Token QR gia validato una volta | stesso codice QR | Ripetere `POST /api/qr/valida` | Operazione rifiutata, token non riusabile | Verificato da `qr_edge_cases.test.js` | Pass |
| TC22 | OCL #14 - QR scaduto | Alta | Integration | Token QR con scadenza passata | codice scaduto | Inviare `POST /api/qr/valida` | Operazione rifiutata per codice scaduto | Verificato da `qr_edge_cases.test.js` | Pass |
| TC23 | RF29 - Sospensione/ban utente | Media | Manual | Admin autenticato, utente normale esistente | id utente | Inviare route admin di sospensione o ban | Utente aggiornato come sospeso/bannato; admin non bannabile | Logica presente in `adminController.js`; da automatizzare | Non eseguito |
| TC24 | RF30/UC14 - Statistiche admin | Media | Manual | Admin autenticato, dati presenti nel DB | token admin | Inviare `GET /api/admin/statistiche` | Restituiti scambi mensili, utenti, segnalazioni e crediti | Logica presente in `adminController.js`; da automatizzare | Non eseguito |

## Note per la D3

- I test automatici coprono soprattutto backend, modelli e flussi REST.
- I test manuali/formali completano la copertura di frontend, mobile, admin e chat.
- I casi `Non eseguito` non vanno presentati come test automatici passati: vanno indicati come test case definiti o verifiche manuali candidate.
- Il risultato automatico aggiornato da riportare nella D3 e un esito locale del team: 8 suite passate, 74 test passati, 0 falliti.
- La riesecuzione in ambienti con restrizioni su socket/processi locali o senza dipendenze installate puo fallire per motivi ambientali, in particolare per `mongodb-memory-server` o per l'assenza di `supertest`.
