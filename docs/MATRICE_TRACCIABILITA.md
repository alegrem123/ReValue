# Matrice di Tracciabilita - RE-VALUE

Questa matrice collega requisiti funzionali, use case, vincoli OCL e implementazione attuale. Serve come allegato alla D3 e come supporto per la discussione orale.

## Legenda stato

| Stato | Significato |
| --- | --- |
| Implementato | Funzionalita presente nel codice e coerente con lo Sprint 1 |
| Parziale | Struttura presente, ma flusso non completo o non centrale nello Sprint 1 |
| Da documentare meglio | Elemento presente o commentato, ma non ancora dimostrato in modo forte |
| Solo progettato | Previsto in D1/D2, ma non implementato nello Sprint 1 |

## Matrice principale

| ID | Area | Descrizione sintetica | Evidenza nel codice | Stato | Note D3 |
| --- | --- | --- | --- | --- | --- |
| RF4 / UC8 | Annunci | Catalogo pubblico | `backend/src/controllers/annunciController.js`, `frontend/js/catalog.js`, `mobile/src/screens/CatalogScreen.js` | Implementato | Evidenziare privacy: lat/lng omessi per anonimi |
| RF15 / RF16 | Annunci | Creazione annuncio con oggetto, dati e foto | `annunciController.creaAnnuncio`, `annuncioModel.js`, `createAnnuncio.js` | Implementato | Massimo 5 foto validato dal modello |
| RF18 | Annunci | Modifica e cancellazione annuncio | `modificaAnnuncio`, `cancellaAnnuncio` | Implementato | Cancellazione logica tramite `isAttivo = false` |
| RF22 | Annunci | Filtri catalogo | `getCatalogo` | Implementato | Categoria, dimensione, materiale, scadenza, distanza, ordinamento |
| RF24 / UC2 | Prenotazioni | Prenotazione oggetto | `prenotazioniController.creaPrenotazione` | Implementato | Crea prenotazione e conversazione |
| RF25 | Prenotazioni | Svelare posizione dopo conferma | `creaPrenotazione` | Implementato | Requisito privacy utile da citare nella D3 |
| RF26 / OCL #10 | Prenotazioni | Annullamento entro 15 minuti | `annullaPrenotazione` | Implementato | Candidato forte per test case formale |
| RF19 | Prenotazioni | No-show / mancato ritiro | `segnalaMancatoRitiro` | Implementato | Incrementa malus e puo sospendere utente |
| RF20 | Prenotazioni | Disdetta del donatore | `disdiciPrenotazione` | Implementato | Disdetta entro finestra temporale implementata |
| RF5 / UC10 | Wallet | Saldo wallet | `walletController.saldo`, `walletService.getSaldo` | Implementato | Coperto da test automatici |
| RF6 / UC11 | Wallet | Storico transazioni | `walletController.storico`, `walletModel.js` | Implementato | Storico filtrabile/paginabile lato controller |
| RF10 / UC6 | Chat | Invio messaggi | `chatController.inviaMessaggio`, `messaggiController.invia` | Implementato | Sono presenti due API: conversazioni e messaggi per prenotazione |
| RF11 | Chat | Storico messaggi | `chatController.getMessaggi`, `messaggiController.getStorico` | Implementato | Lettura consentita ai partecipanti |
| RF12 | Chat | Non letti / badge | `chatController.getNonLettiCount`, `frontend/js/layout.js` | Implementato | Supporto UI per badge |
| RF13 | Chat | Solo partecipanti | `middleware/requireParticipant.js`, controlli nei controller messaggi | Implementato | Importante per sicurezza applicativa |
| RF14 | Auth | Solo autenticati sulle route protette | `middleware/authMiddleware.js` | Implementato | JWT via header Authorization |
| RF17 | QR | Generazione QR | `qrController.generaQR`, `qrRoutes.js` | Implementato | Flusso ufficiale: `/api/v1/qr/genera` |
| RF27 / UC3 | QR/Scambio | Validazione QR e chiusura scambio | `qrController.validaQR`, `services/scambioQrService.js` | Implementato | Flusso ufficiale: `/api/v1/qr/valida` |
| UC3 | Scambio | Donatore mostra QR, acquirente valida | `qr-display.js`, `qr-scan.js`, schermate mobile QR | Implementato | `/api/v1/qr` e il flusso ufficiale; `/api/v1/scambi` e legacy deprecato con `410 Gone` |
| RF29 | Admin | Sospensione/ban account | `adminController.bannaUtente`, `sospendiUtente` | Implementato | Admin non puo bannare altri admin |
| RF30 / UC14 | Admin | Dashboard statistiche | `adminController.getStatistiche` | Implementato | Restituisce scambi, utenti, segnalazioni, crediti |
| RF31 | Admin | Gestione annunci da admin | `forzaStatoAnnuncio`, `rimuoviAnnuncio` | Implementato | Moderazione tramite route admin |
| OCL #4 | Prenotazioni | Donatore non prenota proprio annuncio | `creaPrenotazione` | Implementato | Controllo esplicito su `annuncio.donatore` |
| OCL #5 | Annunci | Data scadenza nel futuro | `annuncioModel.js`, `creaAnnuncio` | Implementato | Validazione doppia: controller e modello |
| OCL #7 | Prenotazioni | Versione incrementata per lock ottimistico | `Annuncio.versione`, `findOneAndUpdate` | Implementato | Punto forte: test concorrenza |
| OCL #8 | Annunci | Modifica/cancellazione solo se `DISPONIBILE` | `modificaAnnuncio`, `cancellaAnnuncio` | Implementato | Transizioni controllate |
| OCL #9 | Prenotazioni | Una prenotazione attiva per annuncio | `creaPrenotazione`, lock su stato/versione | Implementato | Coperto da `concurrent.test.js` |
| OCL #11 | Prenotazioni | Ripristino annuncio dopo annullamento | `annullaPrenotazione` | Implementato | Stato torna `DISPONIBILE` |
| OCL #12 | Scambio | Prenotazione completata e annuncio ritirato | `scambioQrService.finalizzaScambio` | Implementato | Centralizzato nel service |
| OCL #14 | QR | Token non scaduto e non riusabile | `tokenQRModel.js`, `validaQR` | Implementato | Coperto da edge case test |
| OCL #16 | Wallet | Accredito con importo > 0 | `walletService.addPunti` | Implementato | Coperto da test wallet |
| OCL #17 | Wallet | Saldo mai negativo | `walletService.sottraiPunti`, `walletModel.js` | Implementato | Update atomico con `bilancio >= ammontare` |
| OCL #18 | Segnalazioni | Motivo obbligatorio | `segnalazioneModel.js` | Implementato | Validazione Mongoose |
| OCL #19 | Segnalazioni | Segnalante diverso da segnalato | commento nel modello, assenza service dedicato | Da documentare meglio | Non presentarlo come pienamente verificato |
| OCL #21 | Recensioni | Recensione solo su scambio completato | `recensioneModel.js` | Parziale | Modello presente, flusso applicativo da completare |

## Elementi progettati ma non completati nello Sprint 1

| Elemento D2 | Stato reale | Come dichiararlo nella D3 |
| --- | --- | --- |
| SPID/SSO | Solo progettato | Autenticazione reale implementata con email/password + JWT |
| Gestore Email | Solo progettato | Nessun servizio email attivo nello Sprint 1 |
| OpenStreetMap backend | Solo progettato/parziale | Coordinate e geolocalizzazione lato client presenti; nessun modulo backend dedicato |
| Specifica Apiary/OpenAPI | Presente localmente | Blueprint in `docs/apiary_blueprint.txt`, OpenAPI in `docs/openapi.yaml`; resta da pubblicare esternamente |
| Test frontend/mobile | Non presenti | Frontend/mobile prototipali, verifica principale sul backend |

## Osservazioni per la consegna

- La tracciabilita e forte sul dominio core: annunci, prenotazioni, QR, wallet e chat.
- Il flusso QR ufficiale da raccontare e `/api/v1/qr`; `/api/v1/scambi` va indicato come legacy deprecato con risposta `410 Gone`.
- I moduli esterni non implementati non devono essere descritti come completati.
- Nell'ambiente locale del team i test automatici aggiornati risultano: 8 suite passate e 74 test passati.
