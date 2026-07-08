# Toilettatura Manager

Portale web PWA in Node.js per gestire:

- login amministratore e operatori;
- personalizzazione logo, colori, nome portale e dati azienda;
- calendario appuntamenti;
- schede animali con foto, proprietario, contatto, patologie, tempi stimati e note;
- storico appuntamenti a menu nella scheda cane con trattamento eseguito e importo pagato;
- ricerca schede;
- backup cifrato con password e import backup;
- impostazioni WhatsApp per promemoria appuntamenti;
- layout desktop, mobile e iPad.

## Anteprime

Le immagini del portale sono salvate in `docs/screenshots/` e vanno aggiornate a ogni release.

| Vista | Anteprima |
| --- | --- |
| Desktop | ![Vista desktop](docs/screenshots/desktop.png) |
| Dashboard iPad | ![Dashboard iPad](docs/screenshots/ipad-dashboard.png) |
| Schede in miniature | ![Schede in miniature su iPad](docs/screenshots/schede-miniature-ipad.png) |
| Scheda cane in popup | ![Scheda cane in popup su iPad](docs/screenshots/scheda-popup-ipad.png) |
| Storico appuntamenti | ![Storico appuntamenti su iPad](docs/screenshots/storico-appuntamenti-ipad.png) |
| Identita e WhatsApp | ![Impostazioni identita e WhatsApp su iPad](docs/screenshots/impostazioni-identita-whatsapp-ipad.png) |
| DuckDNS | ![Impostazioni DuckDNS su iPad](docs/screenshots/impostazioni-duckdns-ipad.png) |

## Accesso iniziale

- Amministratore: `admin` / `admin123`
- Operatore: `operatore` / `operatore123`

Cambia le password dalla sezione `Utenti` dopo il primo accesso.

## Avvio rapido

Serve Node.js 18 o superiore.

### Windows

Apri il prompt nella cartella del portale e avvia:

```powershell
node server.js
```

In alternativa usa `start-windows.bat`.

### Linux

Apri il terminale nella cartella del portale e avvia:

```bash
node server.js
```

In alternativa:

```bash
sh start-linux.sh
```

## Indirizzo web

Sul computer dove gira il portale:

```text
http://localhost:3017
```

Da altri dispositivi nella stessa rete:

```text
http://IP_DEL_COMPUTER:3017
```

Puoi cambiare porta con la variabile `PORT`.

Windows PowerShell:

```powershell
$env:PORT=8080; node server.js
```

Linux:

```bash
PORT=8080 node server.js
```

## PWA

Il portale include `manifest.json` e `service worker`, quindi puo essere installato dal browser come app. Su dominio pubblico con DuckDNS e dispositivi iPad e consigliato usare HTTPS, perche i browser moderni richiedono HTTPS per installazione PWA completa fuori da `localhost`.

## DuckDNS e accesso locale

Nella sezione `Impostazioni` l'amministratore puo configurare:

- dominio DuckDNS;
- token DuckDNS;
- protocollo e porta pubblica;
- aggiornamento manuale del record DuckDNS.

Il portale resta raggiungibile anche localmente dagli indirizzi mostrati in `Impostazioni`, ad esempio:

```text
http://IP_DEL_COMPUTER:3017
```

Per l'accesso web serve che il router inoltri la porta verso il computer dove gira il portale. Per installazione PWA completa su iPad usa HTTPS sul dominio DuckDNS.

## Identita azienda e WhatsApp

In `Impostazioni` puoi personalizzare:

- logo;
- nome portale;
- nome azienda;
- sottotitolo;
- telefono, email, indirizzo e informazioni aziendali;
- colori principali del portale.

La sezione `WhatsApp promemoria` prepara i dati per ricordare gli appuntamenti ai clienti:

- promemoria attivo/disattivo;
- prefisso telefonico predefinito;
- ore prima dell'appuntamento;
- testo messaggio con variabili come `{ownerName}`, `{dogName}`, `{date}` e `{time}`;
- campi per collegamento futuro a WhatsApp Cloud API.

## Backup

In `Impostazioni` l'amministratore puo:

- esportare un backup cifrato con password;
- importare un backup usando la stessa password.

Il backup include configurazione, utenti, password gia salvate in forma hash, schede, appuntamenti e foto. L'import sostituisce i dati correnti.

## Dati salvati

I dati sono nella cartella:

```text
data/
```

Le foto caricate sono in:

```text
data/uploads/
```

Per spostare il portale su un altro computer copia tutta la cartella oppure usa il backup cifrato.
