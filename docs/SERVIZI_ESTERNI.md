# Servizi esterni D2

La D3 dichiara SPID/SSO, servizio email e modulo backend OpenStreetMap come elementi progettuali o parziali. Per lo Sprint 2 questi elementi sono stati chiariti formalmente:

- SPID/SSO: non attivo nel prototipo locale; autenticazione implementata con email/password e JWT.
- Email: adapter opzionale via Nodemailer in `backend/src/services/emailService.js`; invia solo se `SMTP_USER` e `SMTP_PASS` sono configurati, altrimenti salta senza bloccare il flusso applicativo.
- OpenStreetMap backend: non attivo come servizio backend; mappa e geolocalizzazione restano lato client.

Questa scelta evita integrazioni esterne simulate come complete. Le API implementate restano documentate in `docs/openapi.yaml`.
