# Integrazione Alexa per Groomly

Questa integrazione prepara Groomly per una skill Alexa personalizzata.

## Come funziona

Alexa non scrive direttamente nel database. La skill chiama gli endpoint protetti di Groomly:

- `GET /api/alexa/health` verifica collegamento e versione;
- `GET /api/alexa/dogs?search=penny` cerca il cane pronunciato;
- `GET /api/alexa/services` legge servizi/prodotti configurati;
- `POST /api/alexa/appointments` crea l'appuntamento nel calendario.

Tutte le chiamate devono includere il token:

```text
Authorization: Bearer TOKEN_ALEXA
```

In alternativa:

```text
x-groomly-alexa-token: TOKEN_ALEXA
```

## Configurazione in Groomly

1. Apri `Impostazioni > Alexa`.
2. Abilita l'integrazione.
3. Configura il nome invocazione, ad esempio `groomly`.
4. Genera una nuova chiave e copiala subito.
5. Imposta un PIN vocale se vuoi bloccare la creazione degli appuntamenti senza conferma.
6. Usa l'endpoint mostrato nel pannello come base URL della skill.

L'endpoint deve essere raggiungibile da internet con HTTPS valido. Con Caddy/DuckDNS va bene un indirizzo tipo:

```text
https://toelettatura-fuoriporta.duckdns.org/api/alexa
```

## Flusso vocale consigliato

Esempio:

```text
Utente: Alexa, apri Groomly.
Alexa: Per quale cane vuoi creare l'appuntamento?
Utente: Penny.
Alexa: Ho trovato Penny, Volpino. Che giorno?
Utente: Domani.
Alexa: A che ora?
Utente: Alle 10.
Alexa: Quali servizi o prodotti?
Utente: Bagno e taglio.
Alexa: Confermi Penny domani alle 10 per bagno e taglio?
Utente: Confermo.
Alexa: Appuntamento salvato in Groomly.
```

Se ci sono piu cani con nome simile, Groomly risponde con l'elenco dei possibili cani e la skill deve chiedere quale scegliere.

## Payload per creare appuntamento

```json
{
  "dogName": "Penny",
  "date": "2026-07-14",
  "startTime": "10:00",
  "services": ["Bagno", "Taglio"],
  "pin": "1234"
}
```

Risposta positiva:

```json
{
  "appointment": {
    "id": "...",
    "dogId": "...",
    "dogName": "Penny",
    "breed": "Volpino",
    "date": "2026-07-14",
    "startTime": "10:00",
    "endTime": "11:00",
    "services": ["Bagno", "Taglio"],
    "status": "programmato"
  }
}
```

## Skill Alexa

Nel developer portal Amazon va creata una Custom Skill. La prima versione puo avere un intent `CreateAppointmentIntent` con slot:

- `dogName`;
- `appointmentDate`;
- `appointmentTime`;
- `services`;
- `confirmationPin`, se il PIN e abilitato in Groomly.

Il backend della skill puo essere AWS Lambda oppure un servizio HTTPS. La skill usa le API Groomly per:

1. caricare cani e servizi;
2. risolvere eventuali nomi ambigui;
3. chiedere conferma finale;
4. salvare l'appuntamento.
