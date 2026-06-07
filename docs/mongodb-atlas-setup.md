# MongoDB Atlas Setup

- Cluster: Atlas M0, regione EU/Frankfurt.
- Database user: utente applicativo dedicato, configurato solo su MongoDB Atlas.
- Network access: `0.0.0.0/0` per il prototipo Render free; usare whitelist piu restrittiva in ambienti non accademici.
- Segreti: connection string e password sono configurate come variabili d'ambiente Render, mai committate nel repository.
