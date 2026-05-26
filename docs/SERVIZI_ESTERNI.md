# Servizi esterni D2

La D3 dichiara SPID/SSO, servizio email e modulo backend OpenStreetMap come elementi progettuali o parziali. Per lo Sprint 2 questi elementi sono ridimensionati formalmente:

- SPID/SSO: non attivo nel prototipo locale; autenticazione implementata con email/password e JWT.
- Email: non attivo nel prototipo locale; nessun invio automatico da backend.
- OpenStreetMap backend: non attivo come servizio backend; mappa e geolocalizzazione restano lato client.

Questa scelta evita integrazioni esterne simulate come complete. Le API implementate restano documentate in `docs/openapi.yaml`.
