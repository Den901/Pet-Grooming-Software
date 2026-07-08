# Toilettatura Manager

Release corrente: `0.0.1 beta 1` (`0.0.1-beta.1`).

Portale web PWA in Node.js per gestire:

- login amministratore e operatori;
- personalizzazione logo, colori, tema chiaro/scuro, sfondo login, nome portale e dati azienda;
- calendario appuntamenti;
- schede animali con foto, proprietario, contatto, patologie, tempi stimati e note;
- storico appuntamenti a menu nella scheda cane con trattamento eseguito e importo pagato;
- chiusura prestazione da scheda cane o calendario;
- ricerca schede;
- backup cifrato con password e import backup;
- impostazioni WhatsApp per promemoria appuntamenti;
- aggiornamento software da file locale o URL web con pacchetto `.pgs-update`;
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
| Aggiornamento portale | ![Aggiornamento portale su iPad](docs/screenshots/impostazioni-update-ipad.png) |

## Accesso iniziale

- Amministratore: `admin` / `admin123`
- Operatore: `operatore` / `operatore123`

Al primo accesso con la password admin di default il portale mostra un avviso e obbliga il cambio password.

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

## Pacchetti installativi

Per creare i pacchetti di distribuzione:

```powershell
npm.cmd run release:packages
```

Il comando genera nella cartella `dist/`:

- `Pet-Grooming-Software-0.0.1-beta.1-windows.zip`;
- `Pet-Grooming-Software-0.0.1-beta.1-linux.tar.gz`;
- `Pet-Grooming-Software-0.0.1-beta.1.pgs-update`.

Se `npm` non e bloccato dalla policy PowerShell puoi usare anche `npm run release:packages`.

### Installazione Windows

Prerequisito: Node.js 18 o superiore installato sul PC.

1. Estrai `Pet-Grooming-Software-0.0.1-beta.1-windows.zip`.
2. Apri PowerShell nella cartella estratta. Per installare in `ProgramData` e creare l'avvio automatico e consigliato aprirlo come amministratore.
3. Per installare in `C:\ProgramData\Pet Grooming Software` e creare l'avvio automatico all'accesso:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -Port 3017 -CreateStartupTask
```

Se preferisci installare senza privilegi nella cartella utente:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -InstallDir "$env:USERPROFILE\Pet Grooming Software" -Port 3017
```

Avvio manuale dopo l'installazione standard:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\ProgramData\Pet Grooming Software\start-pet-grooming.ps1"
```

Per riavviare dopo un update, chiudi la finestra dove gira Node.js e rilancia lo stesso comando di avvio. Se hai usato `-CreateStartupTask`, al prossimo accesso Windows riapre il portale automaticamente.

### Installazione Linux

Prerequisito: Node.js 18 o superiore installato sul server.

1. Copia `Pet-Grooming-Software-0.0.1-beta.1-linux.tar.gz` sul server.
2. Estrai il pacchetto e entra nella cartella:

```bash
tar -xzf Pet-Grooming-Software-0.0.1-beta.1-linux.tar.gz
cd Pet-Grooming-Software-0.0.1-beta.1
```

3. Installazione consigliata in `/opt` con servizio systemd:

```bash
chmod +x scripts/install-linux.sh
INSTALL_DIR=/opt/pet-grooming-software PORT=3017 ./scripts/install-linux.sh
```

Comandi utili per il servizio:

```bash
sudo systemctl status pet-grooming-software
sudo systemctl restart pet-grooming-software
sudo systemctl stop pet-grooming-software
```

Installazione manuale senza systemd:

```bash
chmod +x scripts/install-linux.sh
INSTALL_DIR="$HOME/pet-grooming-software" PORT=3017 CREATE_SERVICE=0 ./scripts/install-linux.sh
"$HOME/pet-grooming-software/start-pet-grooming.sh"
```

Dopo l'installazione apri:

```text
http://localhost:3017
```

Da altri dispositivi della rete usa l'IP del computer o server:

```text
http://IP_DEL_SERVER:3017
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

## Release e aggiornamenti

La versione iniziale e `0.0.1 beta 1`. A ogni modifica di release fai avanzare la beta di 1:

```powershell
npm run release:bump
npm run release:packages
```

Il file `.pgs-update` puo essere caricato in una release GitHub oppure scelto localmente da `Impostazioni > Aggiornamento portale`. Il portale accetta solo il formato personalizzato `PET_GROOMING_SOFTWARE_UPDATE` con estensione `.pgs-update`, app id corretto, hash dei file e percorsi software ammessi.

L'aggiornamento non modifica database, foto, backup o `node_modules`. Dopo l'installazione dell'update bisogna riavviare il servizio Node.js.

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
- tema chiaro, scuro o palette personalizzata;
- sfondo login con pattern, colore singolo, immagine o sfumatura verticale a due colori;
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
