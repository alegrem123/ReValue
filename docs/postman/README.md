# Postman evidence checklist

Base URL locale: `http://localhost:3000/api/v1`.

Collection importabile: `docs/postman/revalue-sprint2.postman_collection.json`.

Variabili consigliate:

| Variabile | Esempio | Note |
|---|---|---|
| `baseUrl` | `http://localhost:3000/api/v1` | Prefisso API ufficiale. |
| `userToken` | JWT utente normale | Da `POST /auth/login` o `/auth/register`. |
| `adminToken` | JWT admin | Necessario per gruppo Admin. |
| `annuncioId` | ObjectId | Creato da un donatore. |
| `prenotazioneId` | ObjectId | Creato da un acquirente. |
| `qrCode` | string | Restituito da `/qr/genera`. |
| `conversazioneId` | ObjectId | Conversazione legata a scambio/prenotazione. |
| `notificaId` | ObjectId | Notifica dell'utente. |
| `couponId` | ObjectId | Coupon attivo. |
| `riscattoId` | ObjectId | Riscatto dell'utente. |
| `segnalazioneId` | ObjectId | Segnalazione da gestire lato admin. |
| `ticketId` | ObjectId | Ticket supporto. |

## Auth

| Metodo | Endpoint | Auth | Body / query minimo | Expected |
|---|---|---|---|---|
| POST | `{{baseUrl}}/auth/register` | No | `nome`, `cognome`, `email`, `password` | 201 con token. |
| POST | `{{baseUrl}}/auth/login` | No | `email`, `password` | 200 con token. |
| POST | `{{baseUrl}}/auth/logout` | Bearer `userToken` | Nessuno | Logout accettato. |

## Annunci

| Metodo | Endpoint | Auth | Body / query minimo | Expected |
|---|---|---|---|---|
| GET | `{{baseUrl}}/annunci?page=1&limit=20` | Opzionale | Filtri: `categoria`, `dimensione`, `materiale`, `stato` | Catalogo paginato. |
| GET | `{{baseUrl}}/annunci/me` | Bearer `userToken` | Nessuno | Annunci dell'utente. |
| GET | `{{baseUrl}}/annunci/{{annuncioId}}` | Opzionale | Nessuno | Dettaglio annuncio. |
| POST | `{{baseUrl}}/annunci` | Bearer `userToken` | `titolo`, `dataScadenza`, `latitudine`, `longitudine`, `oggetto` | 201 annuncio creato. |
| PUT | `{{baseUrl}}/annunci/{{annuncioId}}` | Bearer `userToken` | Campi modificabili | Annuncio aggiornato se disponibile. |
| PATCH | `{{baseUrl}}/annunci/{{annuncioId}}/stato` | Bearer `userToken` | `stato` | Stato aggiornato se transizione valida. |
| DELETE | `{{baseUrl}}/annunci/{{annuncioId}}` | Bearer `userToken` | Nessuno | Soft-delete se consentito. |

## Prenotazioni

| Metodo | Endpoint | Auth | Body / query minimo | Expected |
|---|---|---|---|---|
| POST | `{{baseUrl}}/prenotazioni` | Bearer `userToken` | `annuncioId` | 201 se disponibile, 409 se gia' prenotato. |
| GET | `{{baseUrl}}/prenotazioni/me` | Bearer `userToken` | Nessuno | Prenotazioni dell'utente. |
| GET | `{{baseUrl}}/prenotazioni/{{prenotazioneId}}` | Bearer `userToken` | Nessuno | Dettaglio prenotazione. |
| DELETE | `{{baseUrl}}/prenotazioni/{{prenotazioneId}}` | Bearer `userToken` | Nessuno | Annullamento se consentito. |
| POST | `{{baseUrl}}/prenotazioni/{{prenotazioneId}}/no-show` | Bearer `userToken` | Motivo opzionale | Mancato ritiro segnalato. |
| POST | `{{baseUrl}}/prenotazioni/{{prenotazioneId}}/disdici` | Bearer `userToken` | Nessuno | Disdetta se consentita. |

## QR

| Metodo | Endpoint | Auth | Body / query minimo | Expected |
|---|---|---|---|---|
| POST | `{{baseUrl}}/qr/genera` | Bearer donatore | `prenotazioneId` | QR generato. |
| POST | `{{baseUrl}}/qr/valida` | Bearer acquirente | `codice` o payload QR previsto dal controller | Scambio completato, wallet aggiornati. |

## Wallet

| Metodo | Endpoint | Auth | Body / query minimo | Expected |
|---|---|---|---|---|
| GET | `{{baseUrl}}/wallet/me` | Bearer `userToken` | Nessuno | Wallet utente. |
| GET | `{{baseUrl}}/wallet/saldo` | Bearer `userToken` | Nessuno | Saldo corrente. |
| GET | `{{baseUrl}}/wallet/storico` | Bearer `userToken` | Nessuno | Storico transazioni. |

## Chat

| Metodo | Endpoint | Auth | Body / query minimo | Expected |
|---|---|---|---|---|
| GET | `{{baseUrl}}/conversazioni/me` | Bearer `userToken` | Nessuno | Conversazioni dell'utente. |
| GET | `{{baseUrl}}/conversazioni/me/non-letti` | Bearer `userToken` | Nessuno | Count non letti. |
| GET | `{{baseUrl}}/conversazioni/{{conversazioneId}}/messaggi` | Bearer participant | Paginazione opzionale | Storico messaggi. |
| GET | `{{baseUrl}}/conversazioni/{{conversazioneId}}/messaggi/recenti?since=<timestamp>` | Bearer participant | `since` opzionale | Messaggi recenti. |
| POST | `{{baseUrl}}/conversazioni/{{conversazioneId}}/messaggi` | Bearer participant | `testo` | Messaggio inviato. |
| POST | `{{baseUrl}}/conversazioni/{{conversazioneId}}/typing` | Bearer participant | Stato typing opzionale | Typing aggiornato. |
| GET | `{{baseUrl}}/messaggi/{{prenotazioneId}}` | Bearer `userToken` | Nessuno | Storico messaggi legacy/prenotazione. |
| POST | `{{baseUrl}}/messaggi/{{prenotazioneId}}` | Bearer `userToken` | `testo` | Messaggio inviato. |
| PATCH | `{{baseUrl}}/messaggi/{{messageId}}/letto` | Bearer `userToken` | Nessuno | Messaggio marcato letto. |

## Notifiche

| Metodo | Endpoint | Auth | Body / query minimo | Expected |
|---|---|---|---|---|
| GET | `{{baseUrl}}/notifiche/me?page=1&limit=20` | Bearer `userToken` | Filtro `letta` opzionale | Lista paginata. |
| PATCH | `{{baseUrl}}/notifiche/{{notificaId}}/letta` | Bearer `userToken` | Nessuno | Notifica propria marcata letta. |
| PATCH | `{{baseUrl}}/notifiche/me/leggi-tutte` | Bearer `userToken` | Nessuno | Tutte le proprie notifiche lette. |
| PATCH | `{{baseUrl}}/users/me/push-token` | Bearer `userToken` | `pushToken` Expo valido | Token push salvato. |

## Recensioni

| Metodo | Endpoint | Auth | Body / query minimo | Expected |
|---|---|---|---|---|
| POST | `{{baseUrl}}/recensioni` | Bearer `userToken` | `prenotazioneId`, `valutazione`, `commento` | 201 solo dopo scambio completato. |
| GET | `{{baseUrl}}/recensioni/me/ricevute` | Bearer `userToken` | Nessuno | Recensioni ricevute. |
| GET | `{{baseUrl}}/recensioni/me/scritte` | Bearer `userToken` | Nessuno | Recensioni scritte. |
| DELETE | `{{baseUrl}}/recensioni/{{recensioneId}}` | Bearer `userToken` | Nessuno | Cancellazione se consentita. |
| GET | `{{baseUrl}}/users/{{userId}}/recensioni` | No | Nessuno | Recensioni pubbliche utente. |

## Premi

| Metodo | Endpoint | Auth | Body / query minimo | Expected |
|---|---|---|---|---|
| GET | `{{baseUrl}}/premi` | Bearer `userToken` | `costoMax` opzionale | Lista coupon attivi. |
| POST | `{{baseUrl}}/premi/{{couponId}}/riscatta` | Bearer `userToken` | Nessuno | Riscatto se saldo sufficiente. |
| GET | `{{baseUrl}}/premi/miei` | Bearer `userToken` | Nessuno | Riscatti personali. |
| PATCH | `{{baseUrl}}/premi/riscatti/{{riscattoId}}/usato` | Bearer `userToken` | Nessuno | Riscatto proprio marcato usato. |

## Segnalazioni

| Metodo | Endpoint | Auth | Body / query minimo | Expected |
|---|---|---|---|---|
| POST | `{{baseUrl}}/segnalazioni` | Bearer `userToken` | `segnalato`, `motivo` | 201 se valida; auto-segnalazione rifiutata. |
| GET | `{{baseUrl}}/segnalazioni/me` | Bearer `userToken` | Nessuno | Segnalazioni inviate dall'utente. |

## Admin

| Metodo | Endpoint | Auth | Body / query minimo | Expected |
|---|---|---|---|---|
| GET | `{{baseUrl}}/admin/statistiche` | Bearer `adminToken` | Nessuno | Statistiche dashboard. |
| GET | `{{baseUrl}}/admin/users` | Bearer `adminToken` | Nessuno | Lista utenti. |
| GET | `{{baseUrl}}/admin/annunci` | Bearer `adminToken` | Nessuno | Lista annunci admin. |
| GET | `{{baseUrl}}/admin/segnalazioni` | Bearer `adminToken` | Nessuno | Lista segnalazioni. |
| POST | `{{baseUrl}}/admin/segnalazioni/{{segnalazioneId}}/malus` | Bearer `adminToken` | Nessuno/motivo | Malus applicato. |
| POST | `{{baseUrl}}/admin/utenti/{{userId}}/ban` | Bearer `adminToken` | Nessuno/motivo | Utente bannato. |
| POST | `{{baseUrl}}/admin/utenti/{{userId}}/sospendi` | Bearer `adminToken` | Nessuno/motivo | Utente sospeso. |
| POST | `{{baseUrl}}/admin/utenti/{{userId}}/riabilita` | Bearer `adminToken` | Nessuno | Utente riabilitato se non bannato. |
| PATCH | `{{baseUrl}}/admin/annunci/{{annuncioId}}/forza` | Bearer `adminToken` | `stato` | Stato annuncio forzato. |
| DELETE | `{{baseUrl}}/admin/annunci/{{annuncioId}}` | Bearer `adminToken` | Nessuno | Annuncio rimosso/moderato. |

## Supporto

| Metodo | Endpoint | Auth | Body / query minimo | Expected |
|---|---|---|---|---|
| POST | `{{baseUrl}}/supporto/ticket` | Bearer `userToken` | `oggetto`, `messaggio` o campi previsti dal controller | Ticket creato. |
| GET | `{{baseUrl}}/supporto/ticket/me` | Bearer `userToken` | Nessuno | Ticket dell'utente. |

## Sequenza demo minima

1. Registrare donatore e acquirente.
2. Donatore crea annuncio.
3. Acquirente legge catalogo e prenota annuncio.
4. Donatore genera QR.
5. Acquirente valida QR.
6. Entrambi leggono wallet/storico.
7. Utente lascia recensione.
8. Utente crea segnalazione o ticket supporto.
9. Admin legge dashboard e gestisce segnalazione/utente.
