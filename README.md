# Professore Digitale — Cattedra Digitale Portatile

**Ideato e sviluppato da Danilo D'Auria** — Tecnico IT & Divulgatore Digitale per il Sociale
Codice: licenza **MIT** · Contenuti: **CC BY-NC-SA 4.0** · Contatti: danilodauria.site@gmail.com

Piattaforma didattica **offline** per l'alfabetizzazione informatica in centri anziani, scuole,
biblioteche e associazioni. Pensata per girare anche su **computer ricondizionati**.

## ⬇️ Scarica

- **Sito con tutti i download e l'app per telefono e tablet:** https://danilodauria.github.io/professore-digitale/
- **Tutte le versioni** (installatore Windows, pacchetto Linux, app per macOS, versione da chiavetta):
  [Releases](https://github.com/danilodauria/professore-digitale/releases/latest)

## Cosa offre

| Sezione | Funzione |
|---|---|
| 📚 **Lezioni** | 15 lezioni guidate (computer, mouse, tastiera, file, Internet, email, password, truffe, smartphone, SPID/CIE/IO, IA, Linux) con schemi alla lavagna, lettura ad alta voce e quiz finale. Progressi salvati. |
| 💬 **Chiedi al Professore** | Domande scritte o a voce. Risponde la **guida interna** (sempre disponibile) oppure l'**IA locale** (Ollama) se installata, con schema disegnato sulla lavagna e risposta letta ad alta voce. |
| 🖊️ **Lavagna** | 28 schemi pronti da proiettare + disegno libero con gessetti colorati, cancellino, annulla, salvataggio PNG. |
| 🎯 **Palestra** | Esercizi di clic, doppio clic, trascinamento e tastiera (fino a @ e maiuscole), con record personali. |
| 🌐 **Sei lingue** | Italiano, inglese, francese, spagnolo, tedesco e rumeno: interfaccia tradotta a mano, lezioni e risposte lunghe tradotte dall'IA locale (se c'è), sul computer. |
| ⚙️ **Impostazioni** | Testo ingrandibile, tema chiaro/scuro/alto contrasto, modalità proiettore, voce e velocità, scelta del modello IA, esportazione progressi, diagnostica, controllo aggiornamenti *solo su richiesta*. |

## Due modi di usarlo

1. **Pacchetto `.deb`** (consigliato) — `professore-digitale_<versione>_all.deb`, circa 1 MB.
   Un solo pacchetto per PC moderni **e** datati: non crea ambienti virtuali, non scarica nulla
   all'installazione, `Architecture: all` (funziona su amd64, i386, arm64, armhf).
2. **Installatore per Windows** — vedi la sezione dedicata più sotto.
3. **App per macOS** — `ProfessoreDigitale-<versione>-macOS.zip` (macOS 10.15 e successivi): si trascina
   «Professore Digitale.app» in Applicazioni; usa le voci italiane del Mac, l'IA con Ollama per Mac se installata.
4. **Versione portatile** — `professore-digitale-portatile.html`: un unico file da aprire con doppio clic
   in qualsiasi browser, anche da chiavetta USB e su Windows/macOS. Include lezioni, guida interna,
   lavagna, palestra e voce del browser (senza IA e senza microfono).

## Versione per Windows (da XP a Windows 11)

`ProfessoreDigitale-Setup-<versione>.exe` — un solo installatore per **Windows XP SP3, Vista, 7, 8, 8.1, 10 e 11**,
a 32 e 64 bit. Si installa per tutti gli utenti oppure solo per sé (senza password); per le aule:
`ProfessoreDigitale-Setup-<versione>.exe /S /AllUsers`. Esiste anche lo zip **da chiavetta**, senza installazione.

* **Server nativo in C** (nessun Python, nessuna libreria da installare): stesse lezioni, guida, lavagna, palestra,
  stessi pacchetti di contenuti e aggiornamenti del pacchetto Linux. Icona accanto all'orologio, finestra "da applicazione"
  in Edge/Chrome (Supermium su XP e Vista), voce italiana di Windows (SAPI).
* **Configurazione automatica dell'IA** (*Configura IA e voce*): riconosce sistema, processore (AVX/AVX2), RAM,
  scheda video e memoria video, spazio libero; sceglie dal catalogo il modello migliore per quel PC e installa tutto:
  **Ollama** su Windows 10 22H2/11, **KoboldCpp** (motore compatibile) su Windows 7/8/8.1 a 64 bit.
  XP, Vista e i sistemi a 32 bit usano la guida interna. Il catalogo (`windows/catalogo-ia.json`) si aggiorna online.
* **Microfono offline** (Vosk, 64 bit), facoltativo. **Voci naturali incluse** (64 bit): Nicola e Sara (Kokoro, dalla 3.8), Giorgio, Serena e Paola (Piper).
* **Chiavetta per le aule senza Internet**: si prepara su un PC collegato e si installa sugli altri; ogni file è verificato
  con SHA-256.
* Vademecum dedicato: `docs/Vademecum_Professore_Digitale_Windows.pdf`.

Compilazione (da Linux): `windows/build-windows.sh` (servono `mingw-w64`, `nsis`, `libz-mingw-w64-dev`; li installa
`tools/prepara-ambiente.sh`). I test girano con Wine: `tests/esegui_test.sh`.

## Installazione del .deb

```bash
sudo apt install ./professore-digitale_<versione>_all.deb
```

Oppure doppio clic sul file (Software Center / GDebi). Il programma compare nel menu, categoria *Istruzione*.
Unica dipendenza obbligatoria: `python3` (già presente in ogni distribuzione Debian/Ubuntu/Mint).
Consigliati (installati in automatico da apt): `espeak-ng` (voce), un browser, `fonts-noto-color-emoji`.

### Componenti facoltativi (serve Internet una sola volta)

| Comando | Cosa fa |
|---|---|
| `professore-digitale-setup-ia` | Installa Ollama e un modello scelto in base alla RAM (da qwen2.5:0.5b per PC con 2 GB a gemma3:4b per PC recenti). |
| `professore-digitale-setup-voce` | Attiva il **microfono offline** (Vosk, modello italiano da ~50 MB) nella cartella dell'utente, senza password. |
| `professore-digitale-setup-voce --voce-naturale` | Aggiunge la voce naturale Piper "Paola". |
| `professore-digitale-setup-voce --modello-da FILE.zip` | Installazione del modello vocale **senza Internet** (es. da chiavetta, per aule senza rete). |

Anche dal menu: *Professore Digitale: configura IA* e *configura microfono*.

## Architettura

```
Browser (interfaccia HTML/JS, nessuna libreria esterna salvo Mermaid incluso)
   │  http://127.0.0.1:8765  (solo locale, controllo Host/Origin)
   ▼
pd_server.py  — Python 3 standard library, nessun pip
   ├── /api/chat  → Ollama locale (facoltativo, streaming)
   ├── /api/tts   → kokoro › piper › pico2wave › espeak-ng  (voce offline)
   ├── /api/stt   → pd_stt_worker.py (Vosk / faster-whisper nel venv utente)
   └── /api/data  → ~/.local/share/professore-digitale/*.json
```

* Il server si avvia con l'icona, riusa l'istanza già aperta e **si spegne da solo** dopo 4 minuti senza finestre aperte.
* Nessun privilegio di root durante l'uso: i dati stanno nella cartella dell'utente (il vecchio progetto
  scriveva in `/usr/share`, cosa che falliva senza root).
* Nessuna connessione a Internet all'avvio: il controllo aggiornamenti avviene solo premendo il pulsante.
* Se l'IA non c'è o non risponde, il Professore risponde con la guida interna: **non si blocca mai**.

## Uso da terminale

```bash
professore-digitale            # apre l'applicazione
professore-digitale --status   # stato dei componenti
professore-digitale --stop     # chiude il server
PD_BROWSER=firefox professore-digitale   # forza un browser
```

## Disinstallazione radicale

```bash
professore-digitale-pulizia          # elimina dati e progressi dell'utente corrente
sudo apt purge professore-digitale   # rimuove il programma
# facoltativo: ollama rm <modello>
```

## Ampliare domande e lezioni: i pacchetti di contenuti

Domande e lezioni si aggiungono **senza reinstallare** il programma, con file JSON in italiano:

```bash
professore-digitale-contenuti modello > mie-domande.json   # crea un modello da compilare
professore-digitale-contenuti valida mie-domande.json      # controlla gli errori
professore-digitale-contenuti installa mie-domande.json    # per l'utente (sudo ... --sistema per tutti)
professore-digitale-contenuti elenco
```

Oppure dall'app: *Impostazioni → Contenuti aggiuntivi → Importa pacchetto*. I pacchetti inclusi nel
programma stanno in `src/contenuti/`.

## Pubblicare una nuova versione

```bash
tools/rilascio.sh minore "Nuove domande sulla stampa" "Correzioni varie"   # 2.1.0 -> 2.2.0
```

Lo script aggiorna `VERSION` e il changelog, esegue i test, compila e prepara `dist/pubblica/`
(con `aggiornamenti.json`) da caricare sul sito indicato in `rilascio.conf`. Tutti i dettagli sono
nella *Guida agli aggiornamenti* (`docs/`).

## Compilare dai sorgenti

```bash
./build.sh              # compila la versione scritta nel file VERSION
tests/esegui_test.sh    # esegue tutti i test automatici
```

## Risoluzione problemi

* **Non si apre nulla**: `professore-digitale --status`; registro in `~/.local/state/professore-digitale/server.log`.
* **Nessuna voce**: `sudo apt install espeak-ng`, poi in Impostazioni → «Prova la voce».
* **IA lenta**: scegliete un modello più piccolo in Impostazioni o con `professore-digitale-setup-ia`.
* **Microfono non attivo**: `professore-digitale-setup-voce`, poi Impostazioni → «Ricontrolla i componenti».

## 📜 Licenze

- **Contenuti** (lezioni, domande e risposte, quiz — compreso «Il Grande Quiz dell'Informatica» —, percorsi,
  vademecum, immagini, grafica, il personaggio del Professore e il marchio della fenice):
  © 2026 Danilo D'Auria, [Creative Commons BY-NC-SA 4.0](LICENZA-CONTENUTI.md) — citare sempre l'autore,
  niente usi commerciali, stessa licenza per le versioni modificate.
- **Codice**: [MIT](LICENSE).
- **Componenti di altri autori** (Mermaid, tesseract.js, Piper, Kokoro e sherpa-onnx, voci Nicola/Sara/Giorgio/Serena/Paola, Vosk): ognuno con la propria
  licenza, vedi `packaging/copyright` e `windows/LICENZE.txt`.

Citazione consigliata:
> «Professore Digitale – Cattedra Digitale Portatile» di Danilo D'Auria — un progetto FeniceOS — licenza CC BY-NC-SA 4.0 —
> https://danilodauria.github.io/professore-digitale/
