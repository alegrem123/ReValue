# RE-VALUE Mobile

App mobile Expo/React Native che riusa il backend REST esistente del progetto RE-VALUE.

## Avvio

1. Avvia il backend dalla cartella `backend`.
2. Copia `.env.example` in `.env` se devi cambiare host API.
3. Installa e avvia l'app:

```bash
npm install
npm run ios
```

Per dispositivo fisico o Android emulator, imposta `EXPO_PUBLIC_API_BASE_URL` sull'indirizzo LAN del backend, per esempio:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:3000 npm start
```

La configurazione e le chiamate API sono centralizzate in `mobile/src/api/client.js`; il client aggiunge il prefisso `/api/v1` e usa `EXPO_PUBLIC_API_BASE_URL` quando non puo' derivare automaticamente l'host Expo.

## Flussi inclusi

- Login e registrazione con JWT.
- Catalogo annunci e dettaglio annuncio.
- Prenotazione da dettaglio.
- Creazione annuncio con immagini base64 e posizione corrente.
- Lista "I miei annunci" con eliminazione.
- Profilo con saldo wallet e ultime transazioni.
