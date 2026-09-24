# Professore Digitale — istruzioni per chi mantiene il progetto (persone e assistenti IA)

Progetto di **Danilo D'Auria** (licenza MIT). App didattica offline per l'alfabetizzazione digitale su Linux
Debian/Ubuntu/Mint/FeniceOS: server locale Python (solo libreria standard) + interfaccia web in JS puro.
Leggere questo file per intero prima di modificare qualunque cosa.

## Regole del progetto (non negoziabili)
- **Offline e privato**: il programma non si collega a Internet da solo e non invia dati. Il server ascolta
  solo su 127.0.0.1 e controlla Host/Origin. Nessuna telemetria, nessuna libreria da CDN.
- **Server senza dipendenze**: `src/server/*.py` usa solo la libreria standard, compatibile **Python 3.7+**
  (verificare con `vermin -t=3.7- --no-tips --violations src/server/*.py packaging/professore-digitale`).
- **Interfaccia leggera**: JavaScript puro in stile ES5 (`var`, funzioni), niente framework né build step.
  Deve girare su PC ricondizionati e dentro `file://` (versione portatile).
- **Lingua**: tutto in italiano, tono semplice e gentile, pensato per anziani e principianti.
- **Mai perdere i dati degli allievi**: vedi "Compatibilità" sotto.
- Aggiornamenti solo su richiesta dell'utente; ogni file scaricato è verificato con SHA-256.

## Mappa del codice
| Percorso | Contenuto |
|---|---|
| `VERSION` | Unica fonte del numero di versione (non modificare a mano: lo fa `tools/rilascio.sh`) |
| `rilascio.conf` | Indirizzi di pubblicazione (GitHub Pages) e manutentore |
| `src/server/pd_server.py` | Server: API `/api/status, chat, tts, stt, data/*, packs*, update-check, update-download` |
| `src/server/pd_packs.py` | Formato e validazione dei pacchetti di contenuti (gemello di `src/web/js/packs.js`) |
| `src/server/pd_stt_worker.py` | Riconoscimento vocale (Vosk / faster-whisper) in processo separato |
| `src/web/js/data-lessons.js`, `data-kb.js` | 13 lezioni e 43 risposte di base |
| `src/contenuti/*.json` | Pacchetti di contenuti inclusi nel .deb e nella versione portatile |
| `src/web/js/app.js` | Interfaccia, ricerca nella guida (`PD.search`), voce, chat IA, impostazioni, `migrate()` |
| `src/web/js/packs.js` | Caricamento/validazione pacchetti lato browser (stesse regole di `pd_packs.py`) |
| `src/web/js/board.js`, `practice.js` | Lavagna; Palestra |
| `packaging/` | Avviatore, `professore-digitale-contenuti`, setup IA/voce, pulizia, .desktop, man, **changelog** |
| `tools/` | `rilascio.sh`, `pubblica-contenuti.sh`, `pubblica-sito.sh`, `pubblica-tutto.sh`, `repo-apt.sh`, `make_standalone.py`, `metainfo.py`, `prepara-ambiente.sh` |
| `tests/` | `esegui_test.sh` (tutto), `test_packs.py`, `test_ui.py` (Playwright), `mock_ollama.py` |
| `docs/` | Vademecum e Guida agli aggiornamenti (PDF); il vademecum entra nel .deb |
| `archivio/` | Tutti i .deb rilasciati (servono al repository APT). Non cancellare |

## Comandi
```bash
tools/prepara-ambiente.sh          # installa gli strumenti di sviluppo (idempotente)
tests/esegui_test.sh               # TUTTI i test: devono passare prima di ogni rilascio
python3 src/server/pd_server.py --port 8800   # prova dai sorgenti → http://127.0.0.1:8800
./build.sh                         # compila la versione scritta in VERSION (dist/)
tools/rilascio.sh correzione|minore|maggiore "Nota per gli utenti" ... [--apt] [--senza-git]
tools/pubblica-contenuti.sh        # pubblica solo contenuti modificati (versione pacchetto aumentata)
tools/pubblica-sito.sh             # carica dist/pubblica/ su GitHub Pages (lo esegue Danilo: servono le sue credenziali)
tools/pubblica-tutto.sh ZIP        # per Danilo: verifica + firma APT + sito + sorgenti in un solo comando
PD_SHARE_DIR=src python3 packaging/professore-digitale-contenuti valida src/contenuti/*.json
```

## Numerazione delle versioni (SemVer)
- **correzione** (2.1.1 → 2.1.2): solo errori corretti, nessuna novità da imparare.
- **minore** (2.1 → 2.2): novità compatibili, nuove funzioni, lezioni/domande incluse nel .deb.
- **maggiore** (2.x → 3.0): cambiamenti profondi (es. modalità aula, profili allievo, migrazione dati).
- Solo contenuti: **non** si rilascia il programma; si aumenta `versione` del pacchetto in `src/contenuti/`
  e si usa `tools/pubblica-contenuti.sh`.
- Un numero pubblicato non si riusa mai. Le note di rilascio sono scritte per gli utenti finali, in italiano semplice.

## Aggiungere contenuti (caso più frequente)
- Nuove domande/lezioni → in un pacchetto JSON in `src/contenuti/` (formato: `professore-digitale-contenuti modello`).
  Preferire un pacchetto per tema. Campi obbligatori e limiti in `pd_packs.py`.
- Ogni domanda: 3–8 `parole_chiave` realistiche (come parlano gli allievi), risposta 40–120 parole, passi
  numerati per le procedure, prudenza su soldi/salute/leggi, niente dati che invecchiano (prezzi, costi).
- Schemi Mermaid: max 5–6 riquadri, etichette sempre tra virgolette, `flowchart LR` o `TD`.
- Dopo ogni aggiunta: aggiungere 2–3 frasi tipiche con risposta attesa a `probe` in `tests/test_ui.py`
  (dentro il blocco `if ... pack === '<id>'`) e verificare che la ricerca le trovi (soglia `PD.KB_THRESHOLD`).
- `quiz.corretta` si conta da 0. Un `id` di lezione uguale a uno esistente la sostituisce.

## Compatibilità (mai perdere dati)
- Dati utente in `~/.local/share/professore-digitale/` (`settings.json`, `progress.json`, `history.json`, `contenuti/`).
- Nuove impostazioni → aggiungere il valore in `DEFAULTS` (`app.js`). Non rinominare/eliminare chiavi nelle versioni
  minori o di correzione. Non cambiare gli `id` delle lezioni (i progressi dipendono da essi).
- Cambi di struttura → incrementare `DATA_SCHEMA` e aggiungere un passo in `migrate()` (`app.js`).
- Il formato dei pacchetti ha `formato_versione: 1`; se cambia, continuare a leggere anche l'1.
- Le modifiche al validatore vanno fatte **in entrambi** `pd_packs.py` e `packs.js`; `tests/test_packs.py` ne verifica la parità.

## Procedura standard per un aggiornamento (anche per un assistente IA)
1. Estrarre l'archivio sorgenti (contiene `.git`), `cd professore-digitale`, leggere questo file e `git log --oneline -10`.
2. `tools/prepara-ambiente.sh`, poi `tests/esegui_test.sh` per partire da uno stato verde.
3. Fare le modifiche richieste; aggiungere test per ogni correzione e per le nuove domande.
4. `tests/esegui_test.sh` finché è tutto verde; per l'interfaccia, controllare anche gli screenshot (`test_ui.py` li salva).
5. Scegliere il tipo di versione e lanciare `tools/rilascio.sh TIPO "note…"` (senza `--apt`: la chiave di firma è solo di Danilo).
6. Consegnare: `dist/pubblica/` (zip, senza `apt/`), il nuovo .deb, la versione portatile e un **nuovo archivio sorgenti
   completo di `.git` e `archivio/`**:
   `tar --exclude=./build --exclude=./dist --exclude='__pycache__' --transform 's,^\.,professore-digitale,' -czf professore-digitale-X.Y.Z-sorgenti.tar.gz .`
7. Ricordare a Danilo che per pubblicare gli basta, dalla cartella dei NUOVI sorgenti estratti:
   `tools/pubblica-tutto.sh ~/Scaricati/professore-digitale-X.Y.Z-da-pubblicare.zip`
   (verifica le impronte, firma il repository APT con la sua chiave se presente, carica il sito su GitHub Pages
   e invia sorgenti e tag). Con `--prova` fa solo i controlli. Nel messaggio finale riportare il comando esatto
   con il nome dello zip consegnato. Il suo manuale di riferimento è `docs/Manuale_Aggiornamenti_con_Claude.pdf`.
8. Se è cambiato il comportamento visibile, aggiornare il Vademecum (`docs/`) e/o la Guida agli aggiornamenti.

## Note per l'ambiente di sviluppo
- I test UI richiedono Playwright (Python) con Chromium. Porte usate dai test: 18990–18992.
- In ambienti senza accesso a ollama.com / alphacephei.com l'IA e il microfono si provano con i finti
  server dei test (`mock_ollama.py`, modello Vosk finto): dichiararlo sempre quando si consegna.
- `pkill -f pd_server.py` può colpire anche la propria shell: usare `pkill -f "[p]d_server.py --port"`.
