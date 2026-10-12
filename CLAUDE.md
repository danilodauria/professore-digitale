# Professore Digitale — istruzioni per chi mantiene il progetto (persone e assistenti IA)

Progetto di **Danilo D'Auria** — **doppia licenza** (dalla 3.5.2, come «Il Grande Quiz dell'Informatica»): codice MIT (`LICENSE`), contenuti CC BY-NC-SA 4.0 (`LICENZA-CONTENUTI.md`). App didattica offline per l'alfabetizzazione digitale su Linux
Debian/Ubuntu/Mint/FeniceOS (server locale Python, solo libreria standard) **e su Windows da XP SP3 a 11**
(server nativo in C, `windows/`), con la stessa interfaccia web in JS puro (`src/web/`).
Leggere questo file per intero prima di modificare qualunque cosa.

## Regole del progetto (non negoziabili)
- **Offline e privato**: il programma non si collega a Internet da solo e non invia dati. Il server ascolta
  solo su 127.0.0.1 e controlla Host/Origin. Nessuna telemetria, nessuna libreria da CDN.
  Tre sole eccezioni (dalla 3.0 le prime due, dalla 3.4 la terza), tutte disattivabili e documentate nel vademecum:
  1. **Indicatore «Online»** (`/api/rete`, impostazione `netCheck`): al massimo una volta al minuto il server *apre e chiude*
     una connessione TCP verso un server pubblico neutrale (1.1.1.1, 9.9.9.9…) per sapere se Internet funziona. Nessun dato inviato.
  2. **Quadro dell'aula** (`pd_aula.py` / `pd_aula.c`), solo se l'utente sceglie un ruolo in Aula: il PC del facilitatore ascolta
     in rete locale SOLO `/aula/info` e `/aula/ciao` (TCP 8766) e risponde alla ricerca `PD-AULA?` (UDP 8767); il PC dell'allievo
     invia ogni 20 s nome, pagina in uso, lezioni completate, risultati dei quiz e attestati (mai le conversazioni).
     Solo indirizzi IP privati; un codice dell'aula facoltativo blocca i PC estranei. L'interfaccia resta su 127.0.0.1.
  3. **Condividi con i tablet dell'aula** (`pd_tablet.py` / `pd_tablet.c`, impostazione `tabletCondividi`): **spenta per
     impostazione predefinita**, si accende SOLO dal PC stesso (pagina `#/tablet`, API locale `/api/tablet`). Accesa, il server apre
     un SECONDO ascolto su tutte le interfacce, TCP **8768**, che accetta solo IP privati (10/8, 172.16/12, 192.168/16, 169.254/16),
     controlla Host (= IP di questo PC su cui arriva la connessione + porta) e Origin, e chiede un **codice di 6 cifre** mostrato sul
     PC (con QR code): `http://IP:8768/?c=CODICE` → cookie di sessione casuale (HttpOnly, SameSite=Strict, 12 ore); 10 tentativi al
     minuto per indirizzo. Con la sessione il tablet può avere SOLO: i file di `web/`, `GET /api/status` ridotta (`ospite: true`,
     niente percorsi né dati del PC), `GET /api/packs` (senza percorsi), `GET /api/rete`, `POST /api/tts`, `POST /api/chat`
     (2 alla volta) e `POST /api/ospite/presenza` (quadro dell'aula, stessa validazione di `/aula/ciao`). Tutto il resto → 403
     (dati, pacchetti, aggiornamenti, setup, aula, spegnimento, microfono). I progressi dei tablet restano nel loro browser.
     «Cambia codice» chiude tutte le sessioni, «Spegni» chiude la porta. L'ascolto principale resta solo su 127.0.0.1.
- **Microfono del telefono (3.5, `voce.js`)**: NON è un collegamento del programma ma un servizio del sistema del telefono.
  Solo nell'app per telefono e tablet (PWA) e sui tablet ospiti, dove la trascrizione locale del PC non c'è, «🎤 Parla con la voce»
  usa la Web Speech API del browser (`SpeechRecognition`, it-IT): su Chrome/Android e Safari/iOS la voce va ai server di
  **Google/Apple**. Per questo è **spento di base** (impostazione `micTelefono: false`), si accende solo dopo una spiegazione onesta
  («quello che dite viene inviato a loro; il Professore non salva nulla») con «Accendo»/«No grazie», e si spegne con un tocco
  (Impostazioni → 🎤 Microfono, o «🔇 Spegni il microfono» in «Chiedi al Professore»). Sul PC con il server si usa SEMPRE e solo
  la trascrizione locale (Vosk/whisper): mai proporre lì la Web Speech. Su http non sicuro (tablet collegato al PC) il browser
  non dà il microfono: si spiega e si rimanda all'app del sito (`SITO_APP` in `voce.js` = `BASE_URL` di `rilascio.conf` + `/app/`:
  aggiornarlo se cambia l'indirizzo del sito).
- **Server senza dipendenze**: `src/server/*.py` usa solo la libreria standard, compatibile **Python 3.7+**
  (verificare con `vermin -t=3.7- --no-tips --violations src/server/*.py packaging/professore-digitale`).
- **Interfaccia leggera**: JavaScript puro in stile ES5 (`var`, funzioni), niente framework né build step.
  Deve girare su PC ricondizionati e dentro `file://` (versione portatile).
- **Lingua**: tutto in italiano, tono semplice e gentile, pensato per anziani e principianti.
- **Mai perdere i dati degli allievi**: vedi "Compatibilità" sotto.
- Aggiornamenti solo su richiesta dell'utente; ogni file scaricato è verificato con SHA-256.

- **Licenze (dalla 3.5.2)**: il codice è MIT; lezioni, domande, quiz, pacchetti, percorsi, vademecum, immagini e grafica sono
  © Danilo D'Auria, **CC BY-NC-SA 4.0**. Costanti, bollino CC, `PD.piedeStampa(extra)` (piè di pagina di OGNI stampa),
  `PD.licenzaBreve()` e la pagina `#/licenza` stanno in `src/web/js/licenza.js`: nuove stampe usano `PD.piedeStampa`, mai un piè
  di pagina scritto a mano. I pacchetti del progetto hanno `"licenza": "CC BY-NC-SA 4.0"` (campo facoltativo, max 200, validato in
  `pd_packs.py` e `packs.js`). Nuovi file di contenuto o nuove immagini: stessa licenza, metadati con `tools/licenza-immagini.py`.
  Tenere allineati `LICENSE`, `LICENZA-CONTENUTI.md`, `packaging/copyright`, `windows/LICENZE.txt`, il sito (`tools/sito/pagina.html`) e i vademecum.

## Mappa del codice
| Percorso | Contenuto |
|---|---|
| `VERSION` | Unica fonte del numero di versione (non modificare a mano: lo fa `tools/rilascio.sh`) |
| `rilascio.conf` | Indirizzi di pubblicazione (GitHub Pages) e manutentore |
| `src/server/pd_server.py` | Server: API `/api/status, chat, tts, stt, data/*, packs*, update-check, update-download, aula*, tablet`; `TabletHandler` = ascolto dei tablet (lista bianca) |
| `src/server/pd_tablet.py`, `windows/src/pd_tablet.c` | **Tablet dell'aula** (3.4): stato della condivisione, codice, sessioni, limite dei tentativi, pagina del codice, IP ammessi |
| `src/server/pd_packs.py` | Formato e validazione dei pacchetti di contenuti (gemello di `src/web/js/packs.js`) |
| `src/server/pd_stt_worker.py` | Riconoscimento vocale (Vosk / faster-whisper) in processo separato |
| `src/web/js/data-lessons.js`, `data-kb.js` | 13 lezioni e 43 risposte di base |
| `src/contenuti/*.json` | Pacchetti di contenuti inclusi nel .deb e nella versione portatile |
| `src/web/js/app.js` | Interfaccia, ricerca nella guida (`PD.search`), voce, chat IA, impostazioni, `migrate()` |
| `src/web/js/packs.js` | Caricamento/validazione pacchetti lato browser (stesse regole di `pd_packs.py`) |
| `src/web/js/board.js`, `practice.js` | Lavagna; Palestra |
| `packaging/` | Avviatore, `professore-digitale-contenuti`, setup IA/voce, pulizia, .desktop, man, **changelog** |
| `tools/prepara-github.py`, `.github/workflows/pubblica-sito.yml` | Pubblicazione su GitHub (3.5.1): Release con i file grandi + sito pubblicato dal workflow |
| `tools/` | `rilascio.sh`, `pubblica-contenuti.sh`, `pubblica-sito.sh`, `pubblica-tutto.sh`, `pubblica-locale.sh`, `server-aggiornamenti.sh`, `backup-locale.sh`, `verifica_pubblicazione.py`, `repo-apt.sh`, `make_standalone.py`, `metainfo.py`, `prepara-ambiente.sh` |
| `tools/make_pwa.py`, `tools/pwa/`, `tools/make_sito.py`, `tools/sito/` | **App per telefono e tablet** (PWA) → `dist/pubblica/app/`: la portatile + manifest + `sw.js` (offline dopo la prima apertura, OCR salvato al primo uso) + icone già pronte in `src/web/img/pwa/` + `vendor/ocr/`; pagina del sito `dist/pubblica/index.html` (download, QR di `BASE_URL/app/`). Le crea `rilascio.sh`; test `tests/test_pwa.py` |
| `tests/` | `esegui_test.sh` (tutto), `test_packs.py`, `test_ui.py` (Playwright), `mock_ollama.py` |
| `docs/` | Vademecum e Guida agli aggiornamenti (PDF); il vademecum entra nel .deb |
| `windows/src/` | **Versione Windows**: server nativo C (API Win32, compatibile XP SP3). `pd_main.c` avvio/istanza unica/icona/browser, `pd_http.c` server, `pd_api.c` API (stesse risposte di `pd_server.py`), `pd_ai.c` Ollama e motore compatibile KoboldCpp (API OpenAI), `pd_voice.c` voce SAPI/Piper e microfono, `pd_setup.c` configurazione automatica e chiavetta, `pd_hw.c` hardware, `pd_net.c` WinHTTP, `pd_json.c`, `pd_zip.c`, `pd_util.c`; `pd_stt_main.c` = `pd-stt.exe` (64 bit, Vosk) |
| `windows/catalogo-ia.json` | Catalogo dei modelli di IA per Windows (fasce di RAM/VRAM). Si pubblica anche da solo (`catalogo_ia` in `aggiornamenti.json`) |
| `windows/contenuti/` | Pacchetti solo per Windows (es. `windows-primi-passi`): inclusi nell'installatore, nascosti su Linux |
| `windows/installer/`, `windows/res/` | Installatore NSIS (per tutti gli utenti o solo per me, `/S` silenzioso), icona, manifest, immagini |
| `windows/build-windows.sh` | Compila da Linux con mingw-w64 + NSIS → `dist/windows/` (lo chiama `build.sh`) |
| `windows/firma.sh` | **Firma digitale Authenticode** (3.5) di exe/dll, installatore e disinstallatore (`!finalize`/`!uninstfinalize` in NSIS). Senza firma, Windows 11 con «Controllo intelligente delle app» blocca il programma. Si attiva da sola se è configurata (`~/.config/professore-digitale/firma.conf` o variabili: `PD_FIRMA_PFX`+`PD_FIRMA_PASSWORD`, oppure PKCS#11 `PD_FIRMA_PKCS11_MODULE`+`PD_FIRMA_CERT`+`PD_FIRMA_PKCS11_KEY`, oppure `PD_FIRMA_COMANDO`), serve `osslsigncode`. Il certificato è di Danilo (es. Certum «Open Source Code Signing» su SimplySign): MAI chiederlo né conservarlo nei sorgenti |
| `src/web/js/eyes.js`, `setup.js`, `compat.js` | Occhi che seguono il mouse; pagina «Configura IA e voce» (solo Windows); avviso per browser troppo vecchi |
| `src/web/js/quiz.js` | Grandi quiz (chiave `prove` dei pacchetti) e **attestato** (SVG → stampa, oppure PDF generato in JS senza librerie) |
| `src/web/js/aree.js`, `data-fenice.js` | Percorsi tematici: Cultura generale (pacchetti `cultura-*`), FeniceOS (`feniceos` + dati della pagina), libro Tecnologia Gentile (`tecnologia-gentile`) |
| `src/web/js/aula.js`, `src/server/pd_aula.py`, `windows/src/pd_aula.c` | Quadro dell'aula in rete locale (facilitatore/allievo), messaggi a tutti, stato della connessione; presenza e mano alzata dei tablet ospiti (aula.js) |
| `src/web/js/tablet.js`, `qr.js`, `css/tablet.css` | Pagina `#/tablet` sul PC (accendi/spegni, codice grande, indirizzi, QR, tablet collegati) e riquadro in Aula/Impostazioni; `PD.qr` = generatore di QR code ES5 (byte, correzione M, versioni 1-6) |
| `src/web/js/voce.js`, `css/voce.css` | **Voce e microfono su telefoni e tablet** (3.5): invito «👋 Toccate qui per cominciare» quando il browser non lascia parlare (`PD.voceBloccata`, `PD.invitoVoce`, `PD.sbloccaAudio`, `PD.voceDaSbloccare`); microfono del telefono `PD.micWeb` (`stato()` = `no` sul PC/portatile, `insicuro`, `assente`, `spento`, `acceso`; consenso, Impostazioni, striscia «Vi ascolto…»), `PD.ascolta(cb, campo)` = `PD.recorder.toggle(cb, campo)` che sceglie il motore |
| `src/web/js/stampa.js`, `presenza.js` | Stampa della pagina o dell'argomento intero; saluti all'avvio, consigli quando è inattivo, attesa, uscita con promemoria |
| `src/web/js/sostieni.js`, `data-sostieni.js` | Pagina «❤️ Sostieni il progetto» (PayPal, bonifico, QR già pronti, pulsanti Copia). `data-sostieni.js` si rigenera con `tools/genera-sostieni.py` (serve `segno`) se cambiano IBAN o PayPal: mai pubblicare il numero della carta, solo l'IBAN |
| `src/web/js/vita.js`, `vita-sim2.js` | **Palestra della vita digitale** (dalla 3.2): simulatori sicuri con nomi di fantasia e fascia «PROVA»: `identita`, `visita`, `pagamento` (vita.js, che contiene il framework `PD.vita.registra(sim)` e `ctx.passo/bravo/errore/telefono/foglio/indirizzo/controlla/fine`), `banca`, `messaggi`, `posta` (vita-sim2.js). Risultati in `progress.vita` |
| `src/web/js/truffa.js` | «È una truffa?»: motore a regole offline `PD.truffa.analizza(testo, tipo)` → livello alto/medio/basso + segnali; IA locale facoltativa; storico anonimizzato in `progress.truffa` |
| `src/web/js/profili.js` | Profili allievo sullo stesso PC: il profilo attivo usa `progress`/`history` come prima; gli altri stanno nella chiave dati `profili`; `progress.profilo` = proprietario. API `PD.profili` |
| `src/web/js/ripasso.js` | Ripasso a scatole (Leitner) e domanda del giorno: `PD.registraRisposta(item, giusta)` chiamata dai quiz; dati in `progress.ripasso` |
| `src/web/js/accessibilita.js` | Comandi a voce (`PD.comando`), mani che tremano (`PD.tremore`), vedo poco, lettura di ciò che si indica |
| `src/web/js/data-digcomp.js`, `data-incontri.js`, `enti.js`, `registro.js` | Competenze DigComp 2.2 (`PD.digcomp`, vista `#/competenze`), pagina facilitatori `#/enti/{incontri,registro,resoconto,digcomp}`, 12 incontri pronti da 2 ore, registro presenze e resoconto per l'ente (chiave dati `registro`, CSV, stampa) |
| `src/web/js/lettera.js`, `src/web/vendor/ocr/` | «Spiegami questa lettera» (3.3): OCR offline con tesseract.js servito in locale (non nel portatile), motore a regole `PD.lettera.analizza`, nulla salvato |
| `src/web/js/mente.js`, `mente-giochi.js` | «Ginnastica per la mente» (3.3): framework `PD.mente.registra(gioco)`, diario in `progress.mente`; giochi di memoria/attenzione/calcolo (mente.js) e cruciverba, indovina la frase, parole (mente-giochi.js) |
| `src/web/js/data-percorsi.js`, `percorsi.js`, `css/percorsi.css` | **«Il nostro percorso»** (3.5): maschera all'avvio (dove si usa il Professore → chi lo usa → questionario di 8 domande), pagina `#/percorso` (mappa delle 8 fasi, «Continua da qui», spunte automatiche e manuali, stampa del programma per l'ente), riquadro in cima all'Inizio e nelle Impostazioni. `data-percorsi.js` = linea guida in 8 fasi uguale per tutti (accoglienza, dispositivo, comunicare, **sicurezza mai saltata**, servizi, quotidiano, mente e cultura, autonomia), biblioteca di tappe e 12 contesti; API `PD.percorsi` |
| `src/web/js/editor.js` | «Crea lezioni e quiz» (3.3): editor visuale di pacchetti di contenuti, salva con `PD.packs.importText`; campo facoltativo `senza_attestato` nelle prove |
| `tools/voci.sh`, `packaging/voci/` | Scarica e verifica (SHA-256) le **voci naturali incluse**: Piper Linux x86_64/aarch64 e Windows x64, voci **Giorgio** (m, predefinita), **Serena** (f) e Paola (f); Riccardo (x_low) tolto nella 3.3. I `.onnx.json` di Giorgio e Serena (CC BY 4.0) stanno ripuliti in `packaging/voci/` (`copia_voci DEST`). Cache in `~/.cache/professore-digitale/voci` |
| `archivio/` | .deb prodotti in questa copia (ignorato da git, escluso dall'archivio sorgenti). I .deb pubblicati si conservano sul PC di Danilo in `$ARCHIVIO` (`~/professore-digitale-archivio`, vedi `rilascio.conf`) |

## Comandi
```bash
tools/prepara-ambiente.sh          # installa gli strumenti di sviluppo (idempotente)
tests/esegui_test.sh               # TUTTI i test: devono passare prima di ogni rilascio
python3 src/server/pd_server.py --port 8800   # prova dai sorgenti → http://127.0.0.1:8800
./build.sh                         # compila la versione scritta in VERSION (dist/)
tools/rilascio.sh correzione|minore|maggiore "Nota per gli utenti" ... [--apt] [--senza-git]
tools/pubblica-contenuti.sh        # pubblica solo contenuti modificati (versione pacchetto aumentata)
tools/prepara-github.py PUB PAGINA BASE OUT   # (lo chiama rilascio.sh) → dist/github/rilascio-X.Y.Z/ da allegare alla Release
tools/pubblica-tutto.sh ZIP        # per Danilo da Linux con «gh»: verifica + sorgenti e tag + Release (il sito lo pubblica il workflow)
PD_SHARE_DIR=src python3 packaging/professore-digitale-contenuti valida src/contenuti/*.json
```

## Voci, quiz e percorsi (dalla 3.0)
- **Voci**: `/api/status` → `tts.voices` = `[{id, nome, genere: "m"|"f", motore, naturale}]`; `/api/tts` accetta `voice`.
  Linux: Piper incluso nel .deb (`/usr/lib/professore-digitale/piper/<arch>/`, voci in `/usr/share/professore-digitale/voci/`,
  avviabile solo se glibc ≥ 2.29: altrimenti si usano le varianti espeak-ng `it+m3`, `it+m1`, `it+f2`, `it+f4`), poi Pico.
  Windows: Piper (solo 64 bit, `piper\` e `voci\` nella cartella del programma) e tutte le voci italiane SAPI/OneCore con il genere.
  Voce predefinita: Giorgio (il Professore è un uomo), poi Serena e Paola. Le voci si scelgono in Impostazioni → Voce.
  Pausa tra le frasi `--sentence_silence 0.25`. Le voci addestrate con Piper 1.5 hanno nella `phoneme_id_map` simboli di 2
  caratteri che il motore Piper 2023 rifiuta: `pulisci_json_voce` (Python) e `pulisci_json_voce` (pd_voice.c) li tolgono
  dalle voci scaricate dall'utente; quelle incluse sono già pulite. Il catalogo Windows ha `voce.piper.voci` (3.3+) accanto a
  `file` (che resta per le versioni precedenti). `tests/test_voci.py` prova le voci con il vero Piper.
- **Pacchetti**: oltre a `domande` e `lezioni` possono avere `prove` (grandi quiz: `id, titolo, icona, descrizione, attestato,
  domande_per_prova 5-100, soglia 0.5-1, domande[{domanda, opzioni, corretta, spiegazione, categoria}]`). Validatori in
  `pd_packs.py` e `packs.js` (stesse regole). Palestra: `click, dblclick, drag, typing, scroll, rightclick, copypaste, select, keys, memory, scam`.
- **Percorsi**: le lezioni dei pacchetti `cultura-*` stanno in «Cultura generale», quelle di `feniceos` nella pagina FeniceOS,
  quelle di `tecnologia-gentile` nella pagina del libro; tutte le altre nel corso (pagina Lezioni e conteggio dell'Inizio).
- I contenuti di FeniceOS e del libro derivano dai materiali di Danilo (manuali, vademecum, script di build, libro): restare fedeli.
  Il «Grande Quiz dell'Informatica» (prova `informatica`, 264 domande) è il manuale di Danilo: non alterarne domande e risposte.
- Dati nuovi in `progress.json`: `quiz` (risultati per prova), `attestati`, `promemoria`, `ultimoAnnuncio`;
  dalla 3.2 `vita`, `truffa`, `ripasso`, `profilo`. Chiavi dati nuove (server Python e C): `profili`, `registro`.
  Dalla 3.5 `percorso` (per profilo): `{ contesto, chi, livello, risposte: {domanda: "si"|"poco"|"no"}, spunte: {chiave: true},
  iniziato, aggiornato, ultimaTappa, nonChiedere }`; le spunte usano chiavi di attività (`lezione:mouse`, `pratica:desideri`, `tappa:mouse`)
  e non dipendono dal contesto: cambiando contesto i progressi restano.
  Impostazioni nuove: `voiceId, netCheck, idleTips, greet, goodbye, studentName, aulaRuolo, aulaNome, aulaCodice, aulaServer`;
  dalla 3.2 `voiceCommands, tremore, vista, leggiFocus, domandaGiorno`; dalla 3.4 `tabletCondividi`; dalla 3.5 `micTelefono`, `percorsoContesto` (contesto proposto alle persone nuove).
- **Aula, mano alzata (3.3)**: `/aula/ciao` porta `mano: {alzata, da, messaggio}`; la risposta mirata torna nella risposta
  a quel PC (`mano: {da, stato: "arrivo"|"risolto"}`). API locali `/api/aula/mano` (allievo) e `/api/aula/rispondi`
  (facilitatore) in Python e C. Impostazione `aulaManoSuono`.
- **Moduli (dalla 3.2)**: si agganciano con `PD.hooks` (`dopoCaricamento`, `homeTiles`, `homeCards`, `settingsCards`, in app.js);
  CSS in `src/web/css/<modulo>.css` (make_standalone li incorpora tutti). Test di ogni modulo in `tests/ui_<modulo>.py`
  (`prova(page, ROOT, check, SHOTS)`), chiamati da `test_ui.py`. Nei test usare selettori dentro la vista
  (`#view-lessons .quiz-q`): la domanda del giorno nell'Inizio usa le stesse classi dei quiz.
  Profili nei test: `?noprofilo` o `sessionStorage['pd.profiloScelto']='1'` evitano la scelta all'avvio.
- **Voce sui telefoni (3.5)**: i browser mobili non parlano né suonano prima di un tocco. `PD.speak` (app.js) riconosce il
  blocco (errore `not-allowed` della sintesi, `NotAllowedError` dell'audio, oppure nessun avvio entro 1,5 s su telefono/pagina mai
  toccata) e chiama `PD.voceBloccata(riprova)`: invito grande la prima volta per sessione (`pd.invitoVisto`), poi solo un avviso e
  si riprova al tocco successivo. Il saluto (presenza.js) su telefono/tablet mostra subito l'invito; sul PC, se il saluto parte,
  nulla cambia. Sui telefoni (`PD.mobile`) un solo elemento audio (`PD.lettoreAudio()`) sbloccato al primo tocco, frasi ≤ 160
  caratteri, attesa delle voci (iOS) fino a 1,5 s, voce `it-IT` anche se il browser scrive `it_IT`, `resume()` se resta in pausa.
- **Microfono**: `PD.sttLocale()` = trascrizione del PC; `PD.sttReady()` (= `PD.micPronto()`) = locale OPPURE voce del telefono
  accesa. I moduli usano `PD.sttReady()` per mostrare il microfono e `PD.recorder.toggle(cb)` / `PD.ascolta(cb)` per ascoltare.
- Test: il saluto all'avvio si salta con `sessionStorage['pd.salutato']='1'` (test_ui.py) o con `?nosaluto`; i tempi dei consigli
  con `PD.idleConfig`. L'aula del server Python nei test usa `PD_AULA_PORT`/`PD_AULA_UDP`.
- **Percorsi (3.5)**: la maschera del percorso compare solo aprendo sull'Inizio senza contesto scelto; ordine profilo → percorso → saluto
  (se compare, imposta `pd.salutato` e saluta lei alla fine). Si salta come il saluto (`pd.salutato`, `?nosaluto`, `?noprofilo`) e anche con
  `sessionStorage['pd.percorsoVisto']='1'` o `?nopercorso`: i test che aprono un contesto nuovo sull'Inizio devono usarne uno.
  Ogni rimando delle attività (`lezione:ID`, `palestra:ID`, `vita:ID`, `mente:ID`, `quiz:ID`, `cultura:PACCHETTO`, `chiedi:DOMANDA DELLA GUIDA`…)
  deve esistere: lo controlla `tests/ui_percorsi.py`, che fa anche il **censimento** (ogni lezione, esercizio, simulatore, gioco, quiz,
  incontro e pagina è in almeno un percorso) e, per ogni contesto, pretende che ogni voce principale sia presente o in `ESCLUSI` con il
  motivo. **Aggiungendo contenuti** (lezione, simulatore, gioco, prova, pagina) inseriteli in `data-percorsi.js` (o in `ESCLUSI`), altrimenti il test fallisce.
  Cambiare il testo di una domanda della guida usata in `chiedi:` rompe il rimando: aggiornare anche `data-percorsi.js`.
- **Tablet dell'aula (3.4)**: API locali (solo 127.0.0.1) `GET /api/tablet` → `{attivo, porta, codice, ips, indirizzi, dispositivi:
  [{id, ip, nome, pagina, fa_s}], errore}` e `POST /api/tablet {azione: accendi|spegni|codice|togli, id}` (accendi fallita → 409).
  Sul tablet `/api/status` ha `ospite: true` → `PD.ospite` (app.js): `PD.server` resta vero (voce, IA, contenuti) ma `PD.store`
  usa SOLO localStorage; nascosti microfono del PC (resta solo «Parla con la voce» del tablet, spento di base), aggiornamenti, import/rimozione pacchetti, «Salva e usa» dell'editor, configurazione IA,
  aula del facilitatore; niente heartbeat né `/api/shutdown`. Nei moduli: usare `PD.server && !PD.ospite` per tutto ciò che scrive
  sul PC o usa API fuori dalla lista bianca. Presenza del tablet: `POST /api/ospite/presenza {nome, attivita, progressi, mano}` →
  `{ok, aula: false}` oppure la risposta di `/aula/ciao` con `aula: true` (id nel quadro `tablet-<id sessione>`).
  Test: `PD_TABLET_PORT` (Python 18968, Wine 18969) e `PD_TABLET_LOOPBACK=1` (permette 127.0.0.1, SOLO nei test); `tests/ui_tablet.py`.
  Dalla 3.5 il tablet ha il riquadro «🎤 Microfono» del telefono (`voce.js`) al posto di quello del PC; `/api/stt` resta vietata.
  `tests/ui_mobile.py` prova voce e microfono con un telefono emulato (Android Chrome, API del server bloccate = come la PWA)
  e `speechSynthesis`/`SpeechRecognition` finti (`FINTI`); `ATTIVAZIONE` sostituisce `navigator.userActivation` perché Playwright
  segna come «già toccata» anche una pagina appena aperta (lo usa anche `test_pwa.py`). Riconoscimento vero di Google/Apple,
  iOS e tablet reali in http non si provano qui: dichiararlo nella consegna.
  Installatore Windows: regola firewall «Professore Digitale (tablet)» TCP 8768, tolta alla disinstallazione.

## Versione per Windows (regole in più)
- **Compatibilità XP SP3 → Windows 11**: il programma principale è a 32 bit (`-D_WIN32_WINNT=0x0501`) e usa solo
  funzioni presenti in XP; quelle recenti (DXGI, RtlGetVersion, SHGetKnownFolderPath, IsWow64Process2) si caricano con
  `GetProcAddress`. `windows/tools/controlla_xp.py` controlla le importazioni a ogni compilazione: se fallisce, non rilasciare.
- **Stesse API del server Python**: ogni nuova API o campo di `/api/status` va aggiunta in **entrambi** `pd_server.py` e
  `windows/src/pd_api.c`. Il server Windows valida i pacchetti in modo essenziale; la validazione completa la fa
  `packs.js` nel browser (anche per gli elenchi del server).
- **IA**: Windows 10 22H2+/11 → Ollama; Windows 7/8/8.1 64 bit → KoboldCpp (`compatibile`, porta 5001, API OpenAI);
  XP/Vista/32 bit → solo guida interna. Il modello si sceglie da `windows/catalogo-ia.json` (l'ultimo adatto, saltando
  `solo_manuale`). Per proporre modelli nuovi basta aggiornare il catalogo (alzare `versione`) e pubblicarlo:
  non serve una nuova versione del programma. Tenere allineate le fasce di `recommended_model()` in `pd_server.py`
  e di `professore-digitale-setup-ia`.
- **Download**: solo dopo un clic dell'utente; impronta SHA-256 presa da GitHub (campo `digest`) o Hugging Face (`lfs.oid`)
  quando pubblicata, sempre calcolata e mostrata; la chiavetta (`kit.json`) contiene l'impronta di ogni file.
- **Dati** in `%APPDATA%\ProfessoreDigitale` (progressi) e `%LOCALAPPDATA%\ProfessoreDigitale` (modelli, registro
  `server.log`, `ia.json`); con `portatile.txt` accanto all'exe restano nella cartella `dati` (chiavetta).
- **Test**: `tests/test_windows.sh` (chiamato da `esegui_test.sh`) compila, avvia l'exe con **Wine** e ripete tutti i test
  dell'interfaccia più `tests/test_windows_api.py`. Microfono, Ollama vero, SAPI e download reali non si provano in Wine:
  dichiararlo nella consegna. Attenzione: `pkill -f` o `pgrep -f` con il nome dell'exe nella stessa riga di comando
  colpiscono la propria shell; per fermare Wine usare `wineserver -k`.
- Variabili utili ai test: `PD_DATA_DIR`, `PD_LOCAL_DIR`, `PD_DOWNLOAD_DIR`, `PD_NO_TRAY`, `PD_NO_ENGINE_START`, `OLLAMA_HOST`, `PD_DEBUG`,
  `PD_TABLET_PORT`, `PD_TABLET_LOOPBACK`.

## Pubblicazione: con GitHub oppure tutto in locale
- **GitHub** (predefinito, dalla 3.5.1): GitHub rifiuta i file oltre **100 MB** nel repository e in GitHub Pages, e
  installatore/.deb/zip superano i 200 MB. Quindi `rilascio.sh` chiama `tools/prepara-github.py` → `dist/github/rilascio-X.Y.Z/`
  = i 3 file grandi + `sito-X.Y.Z.zip` (tutto il resto di `dist/pubblica/`, con `aggiornamenti.json` e `index.html` che puntano
  ai file grandi in `PAGINA_PROGETTO/releases/download/vX.Y.Z/`, stesse impronte) + `NOTE-X.Y.Z.md`. Danilo crea la **Release**
  `vX.Y.Z` e allega quei file (da Windows: dal sito di GitHub, guida `docs/Pubblicare_su_GitHub.pdf`; da Linux con `gh`:
  `tools/pubblica-tutto.sh ZIP`); il workflow `.github/workflows/pubblica-sito.yml` scarica `sito-*.zip` dalla Release e lo
  pubblica su GitHub Pages (Settings → Pages → Source: GitHub Actions). Il ramo `gh-pages` e `pubblica-sito.sh` non si usano più.
  Il .deb si scarica a pezzi (limite 900 MB, `scarica_pacchetto_deb`), l'installatore Windows fino a 900 MB. Test: `tests/test_github.py`.
  I sorgenti si caricano con GitHub Desktop (repository con `.git`, consegnato come `professore-digitale-X.Y.Z-repository`).
- **Senza GitHub**: `tools/pubblica-locale.sh ZIP --cartella DEST [--indirizzo http://IP:8080]` prepara una cartella
  (chiavetta o PC server) con `installa-da-chiavetta.sh`, `LEGGIMI.txt` e, se c'è la chiave, `apt/` firmato;
  `tools/server-aggiornamenti.sh DEST [--servizio]` la serve in rete locale; `tools/backup-locale.sh DEST` sostituisce
  GitHub come copia di sicurezza (git bundle + archivio sorgenti).
- Il server accetta aggiornamenti da `https://` ovunque e da `http://` solo verso la rete locale
  (`indirizzo_locale()` in `pd_server.py`: IP privati, loopback, `.local`, `.lan`, `.home.arpa`). SHA-256 sempre obbligatorio.
- Se Danilo lavora solo in locale, in `rilascio.conf` `BASE_URL` punta al PC server dell'aula (es. `http://192.168.1.10:8080`):
  chiedergli l'indirizzo prima di un rilascio e nel messaggio finale indicare `pubblica-locale.sh` invece di `pubblica-tutto.sh`.
- Contenuti installati "per tutti gli utenti" (`--sistema`) vanno in `/var/lib/professore-digitale/contenuti`
  (mai in `/usr/share/...`, che appartiene al pacchetto); con lo stesso `id` vince la versione più alta.

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
1. Estrarre l'archivio sorgenti (contiene `.git`, non contiene i .deb), `cd professore-digitale`, leggere questo file e `git log --oneline -10`.
2. `tools/prepara-ambiente.sh`, poi `tests/esegui_test.sh` per partire da uno stato verde.
3. Fare le modifiche richieste; aggiungere test per ogni correzione e per le nuove domande.
4. `tests/esegui_test.sh` finché è tutto verde; per l'interfaccia, controllare anche gli screenshot (`test_ui.py` li salva).
5. Scegliere il tipo di versione e lanciare `tools/rilascio.sh TIPO "note…"` (senza `--apt`: la chiave di firma è solo di Danilo).
6. Consegnare: `dist/pubblica/` (zip, senza `apt/`), il nuovo .deb, l'installatore Windows `ProfessoreDigitale-Setup-X.Y.Z.exe`
   (e lo zip da chiavetta), la versione portatile, i vademecum aggiornati e un **nuovo archivio sorgenti
   completo di `.git`** (senza i .deb):
   `tar --exclude=./build --exclude=./dist --exclude=./archivio --exclude='__pycache__' --transform 's,^\.,professore-digitale,' -czf professore-digitale-X.Y.Z-sorgenti.tar.gz .`
   (deve restare sotto 30 MB: se cresce, `git gc --aggressive` e niente file binari pesanti in git)
7. Danilo pubblica da **Windows con GitHub Desktop** (dalla 3.5.1): consegnargli il repository aggiornato (con `.git`, remote
   rimosso) e la cartella `rilascio-X.Y.Z` (da `dist/github/`), e ricordargli i 3 passi del libretto `docs/Pubblicare_su_GitHub.pdf`:
   (1) GitHub Desktop: sostituire i file del repository, Commit, Push; (2) sul sito: Releases → Draft a new release → tag `vX.Y.Z`
   → trascinare i file di `rilascio-X.Y.Z` → Publish; (3) controllare Actions e il sito. Da Linux resta `tools/pubblica-tutto.sh ZIP`.
8. Se è cambiato il comportamento visibile, aggiornare i Vademecum (`docs/`, Linux e Windows) e/o la Guida agli aggiornamenti.
   Le sorgenti HTML dei PDF stanno in `docs/sorgenti/` (si stampano in PDF con `tools/pdf-da-html.py`).

## Prova dell'aggiornamento dalla versione precedente
Il .deb precedente non è nell'archivio sorgenti: ricostruirlo dal tag git, es.
`git worktree add /tmp/prec v2.2.0 && (cd /tmp/prec && ./build.sh) && sudo apt install ./dist/...` (nel worktree),
creare dei progressi, installare il nuovo .deb e controllare che i progressi restino.

## Note per l'ambiente di sviluppo
- I test UI richiedono Playwright (Python) con Chromium. Porte usate dai test: 18990–18993, aula 18966–18967, tablet 18968 (Python) e 18969 (Wine).
- In ambienti senza accesso a ollama.com / alphacephei.com l'IA e il microfono si provano con i finti
  server dei test (`mock_ollama.py`, modello Vosk finto): dichiararlo sempre quando si consegna.
- `pkill -f pd_server.py` può colpire anche la propria shell: usare `pkill -f "[p]d_server.py --port"`.
