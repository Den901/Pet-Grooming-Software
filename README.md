# Groomly

Release corrente: `1.0.16` stabile.

Portale web PWA in Node.js per gestire:

- login amministratore e operatori;
- login rapido da tendina utenti con inserimento della sola password;
- foto profilo utenti visibile nella sidebar e stato online in lista utenti;
- personalizzazione logo, nome portale e dati azienda comuni, con colori, tema chiaro/scuro, sfondo login e dimensione interfaccia salvati come preferenze personali per utente;
- aggiornamento live multiutente di schede, appuntamenti, utenti e impostazioni;
- calendario appuntamenti con vista giorno planning orario, settimana tablet a blocchi leggibili, mese piu ampio su desktop e agenda compatta su iPhone;
- drag and drop appuntamenti su desktop/tablet attivo di default e disattivabile da Impostazioni: in settimana spostamento diretto sul giorno, in mese apertura del planning giornaliero dopo 2 secondi, uscita dal popup giorno per passare a un'altra giornata, appuntamento agganciato al punto del mouse durante il trascinamento, nel planning scelta precisa dell'orario a scatti di 5 minuti e chiusura automatica dopo il rilascio; su telefono e disattivato;
- stati appuntamento a semaforo: rosso da confermare, giallo confermato/da fare, verde completato e blu annullato, visibili su calendario, storico e bordo popup;
- sezione `Monitor` per mostrare su schermo esterno gli appuntamenti della giornata con foto cane, nome, razza, tempi, servizi/prodotti e conto alla rovescia;
- menu mobile persistente in basso con icone tonde su una riga, quattro voci visibili e scorrimento verso utenti, impostazioni ed esci;
- icone menu per calendario, monitor, dashboard, schede, storico servizi e utenti;
- dashboard statistiche con priorita a servizi e incassi, grafici piu leggibili, incasso separato per servizio, andamento incassi giorno/settimana/mese/anno, servizi fatti/da fare, razze, servizi piu usati, animale piu presente con mini foto, cane piu redditizio e tempi medi;
- schede animali con foto o immagine predefinita, cornice cliente top manuale o automatica, razza, eta, colore, sesso, contatti, patologie, tempi stimati, reminder WhatsApp e consenso immagini;
- badge nella scheda cliente con conteggio degli interventi annullati;
- impostazioni scheda animale per razze, colori cane, prestazioni cumulabili e soglia cliente top;
- storico appuntamenti a menu nella scheda cane con servizio eseguito, importo pagato, galleria foto prima/dopo e foto ingrandibili;
- sezione `Storico servizi` con ricerca animale a suggerimenti, riepilogo incasso, appuntamenti annullati, modifica/eliminazione prestazioni e foto zoomabili;
- chiusura prestazione da scheda cane o calendario con schermata cassa rapida, servizi precompilati, orari modificabili e leggibili, prezzo separato per ogni servizio e avvisi chiari sui campi mancanti;
- appuntamenti completati riapribili dal calendario come appuntamenti normali, con pulsante `Modifica prestazione` dentro il popup appuntamento e conferma prima di riaprire la cassa;
- pulsante `Annulla appuntamento` dentro il popup appuntamento, vicino alle azioni finali, con conferma prima di segnare e salvare lo stato annullato;
- ricerca schede;
- backup cifrato con password e import backup;
- impostazioni WhatsApp per promemoria appuntamenti cliente e impostazioni globali per il promemoria interno operatori;
- integrazione Alexa protetta da token per leggere cani/servizi e creare appuntamenti via skill vocale;
- aggiornamento software da file locale o release GitHub con pacchetto `.pgs-update`;
- notifica nel pannello impostazioni e badge sidebar quando e disponibile un nuovo update web;
- changelog visibile nel controllo update web insieme alla nuova versione;
- popup PWA quando una nuova versione dell'app e pronta, con aggiornamento senza reinstallazione;
- layout desktop, mobile e iPad;
- icona PWA/iPhone e badge cliente top con zampa personalizzata trasparente.

## Anteprime

Le immagini del portale sono salvate in `docs/screenshots/` e vanno aggiornate a ogni release.

| Vista | Anteprima |
| --- | --- |
| Desktop | ![Vista desktop](docs/screenshots/desktop.png) |
| Dashboard iPad | ![Dashboard iPad](docs/screenshots/ipad-dashboard.png) |
| Schede in miniature | ![Schede in miniature su iPad](docs/screenshots/schede-miniature-ipad.png) |
| Scheda cane in popup | ![Scheda cane in popup su iPad](docs/screenshots/scheda-popup-ipad.png) |
| Storico appuntamenti | ![Storico appuntamenti su iPad](docs/screenshots/storico-appuntamenti-ipad.png) |
| Identita portale | ![Impostazioni identita su iPad](docs/screenshots/impostazioni-identita-whatsapp-ipad.png) |
| Scheda animale | ![Impostazioni scheda animale su iPad](docs/screenshots/impostazioni-scheda-animale-ipad.png) |
| DuckDNS | ![Impostazioni DuckDNS su iPad](docs/screenshots/impostazioni-duckdns-ipad.png) |
| Aggiornamento portale | ![Aggiornamento portale su iPad](docs/screenshots/impostazioni-update-ipad.png) |
| Agenda iPhone | ![Agenda iPhone](docs/screenshots/iphone-agenda.png) |
| Calendario semaforo | ![Calendario semaforo appuntamenti](docs/screenshots/release-1.0.6-day-semaforo.png) |
| Avvisi compilazione | ![Avviso campi mancanti appuntamento](docs/screenshots/release-1.0.6-validation-warning.png) |
| Orari senza quadrante Android | ![Selettori ore e minuti appuntamento](docs/screenshots/release-1.0.6-time-selects.png) |
| Cassa rapida prestazione | ![Cassa rapida per concludere una prestazione](docs/screenshots/release-1.0.8-completion-checkout.png) |

## Accesso iniziale

- Amministratore: `admin` / `admin123`
- Operatore: `operatore` / `operatore123`

Al primo accesso con la password admin di default il portale mostra un avviso e obbliga il cambio password.

Il riquadro con le credenziali iniziali nella schermata login appare solo finche l'admin usa ancora la password di default. Dopo il primo cambio password non viene piu mostrato.

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

- `Pet-Grooming-Software-1.0.16-windows.zip`;
- `Pet-Grooming-Software-1.0.16-linux.tar.gz`;
- `Pet-Grooming-Software-1.0.16.pgs-update`;
- `pet-grooming-update.json`.

Se `npm` non e bloccato dalla policy PowerShell puoi usare anche `npm run release:packages`.

### Installazione Windows

Prerequisito: Node.js 18 o superiore installato sul PC.

1. Estrai `Pet-Grooming-Software-1.0.16-windows.zip`.
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

1. Copia `Pet-Grooming-Software-1.0.16-linux.tar.gz` sul server.
2. Estrai il pacchetto e entra nella cartella:

```bash
tar -xzf Pet-Grooming-Software-1.0.16-linux.tar.gz
cd Pet-Grooming-Software-1.0.16
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

## HTTPS e certificato

Il portale Node.js ascolta in HTTP locale, ad esempio `http://127.0.0.1:3017`. Per usarlo da internet con DuckDNS, installazione PWA e iPhone serve invece HTTPS con un certificato TLS valido e riconosciuto dal browser.

La soluzione consigliata e mettere davanti al portale un reverse proxy come Caddy o Nginx:

```text
browser -> https://toilettatura-fuoriporta.duckdns.org -> reverse proxy HTTPS -> http://127.0.0.1:3017
```

Con Caddy, quando le porte standard `80` e `443` sono raggiungibili da internet, il certificato Let's Encrypt viene richiesto e rinnovato automaticamente. Esempio Caddyfile:

```text
toilettatura-fuoriporta.duckdns.org {
  reverse_proxy 127.0.0.1:3017
}
```

Su Linux il file di solito e `/etc/caddy/Caddyfile`; dopo la modifica:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Se vuoi restare su una porta esterna non standard, ad esempio `30443`, il browser puo comunque usare HTTPS, ma il certificato automatico richiede comunque una verifica valida del dominio. Di solito servono le porte `80/443` aperte oppure una verifica DNS DuckDNS.

## PWA

Il portale include `manifest.json` e `service worker`, quindi puo essere installato dal browser come app. Su dominio pubblico con DuckDNS e dispositivi iPad e consigliato usare HTTPS, perche i browser moderni richiedono HTTPS per installazione PWA completa fuori da `localhost`.

## Alexa

Da `Impostazioni > Alexa` l'amministratore puo abilitare l'integrazione, generare una chiave API dedicata, configurare un PIN opzionale e vedere l'endpoint HTTPS da collegare a una Custom Skill Alexa.

La skill puo cercare cani e servizi/prodotti e creare appuntamenti nel calendario Groomly. La guida operativa e in `docs/alexa-integrazione.md`.

## Release e aggiornamenti

La release corrente e `1.0.16` stabile. Per preparare i pacchetti della versione impostata in `package.json`:

```powershell
npm.cmd run release:packages
```

Il file `.pgs-update` puo essere caricato in una release GitHub oppure scelto localmente da `Impostazioni > Aggiornamento portale`. Il portale accetta solo il formato personalizzato `PET_GROOMING_SOFTWARE_UPDATE` con estensione `.pgs-update`, app id corretto, hash dei file e percorsi software ammessi.

Per l'update web carica nella stessa release GitHub anche `pet-grooming-update.json`. Il portale controlla di default `https://github.com/Den901/Pet-Grooming-Software/releases/latest/download/pet-grooming-update.json` e mostra un avviso nel pannello impostazioni quando trova una versione piu recente. Il controllo update mostra anche il changelog pubblicato nel manifest. Se un domani vuoi usare un altro server puoi avviare Node.js con la variabile `UPDATE_MANIFEST_URL`.

L'aggiornamento non modifica database, foto, backup o `node_modules`. Dopo l'installazione dell'update bisogna riavviare il servizio Node.js. Nel pannello `Impostazioni > Aggiornamento portale` l'amministratore puo usare il pulsante `Riavvia servizio`: su Linux funziona quando il portale e installato come servizio systemd con `Restart=always`, come nello script `scripts/install-linux.sh`.


Riavvio manuale su Linux:

```bash
sudo systemctl restart pet-grooming-software
sudo systemctl status pet-grooming-software --no-pager
```

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
