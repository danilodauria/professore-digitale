# Professore Digitale 2.0 — Cattedra Digitale Portatile

**Ideato e sviluppato da Danilo D'Auria** — Tecnico IT & Divulgatore Digitale per il Sociale
Licenza **MIT** · Contatti: danilodauria.site@gmail.com

Piattaforma didattica **offline** per l'alfabetizzazione informatica in centri anziani, scuole,
biblioteche e associazioni. Pensata per girare anche su **computer ricondizionati**.

## Cosa offre

| Sezione | Funzione |
|---|---|
| 📚 **Lezioni** | 13 lezioni guidate (computer, mouse, tastiera, file, Internet, email, password, truffe, smartphone, SPID/CIE/IO, IA, Linux) con schemi alla lavagna, lettura ad alta voce e quiz finale. Progressi salvati. |
| 💬 **Chiedi al Professore** | Domande scritte o a voce. Risponde la **guida interna** (sempre disponibile) oppure l'**IA locale** (Ollama) se installata, con schema disegnato sulla lavagna e risposta letta ad alta voce. |
| 🖊️ **Lavagna** | 28 schemi pronti da proiettare + disegno libero con gessetti colorati, cancellino, annulla, salvataggio PNG. |
| 🎯 **Palestra** | Esercizi di clic, doppio clic, trascinamento e tastiera (fino a @ e maiuscole), con record personali. |
| ⚙️ **Impostazioni** | Testo ingrandibile, tema chiaro/scuro/alto contrasto, modalità proiettore, voce e velocità, scelta del modello IA, esportazione progressi, diagnostica, controllo aggiornamenti *solo su richiesta*. |

## Due modi di usarlo

1. **Pacchetto `.deb`** (consigliato) — `professore-digitale_2.0.0_all.deb`, circa 1 MB.
   Un solo pacchetto per PC moderni **e** datati: non crea ambienti virtuali, non scarica nulla
   all'installazione, `Architecture: all` (funziona su amd64, i386, arm64, armhf).
2. **Versione portatile** — `professore-digitale-portatile.html`: un unico file da aprire con doppio clic
   in qualsiasi browser, anche da chiavetta USB e su Windows/macOS. Include lezioni, guida interna,
   lavagna, palestra e voce del browser (senza IA e senza microfono).

## Installazione del .deb

```bash
sudo apt install ./professore-digitale_2.0.0_all.deb
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
   ├── /api/tts   → piper › pico2wave › espeak-ng  (voce offline)
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

## Compilare dai sorgenti

```bash
./build.sh      # produce dist/*.deb, dist/professore-digitale-portatile.html, sorgenti e SHA256SUMS
```

## Risoluzione problemi

* **Non si apre nulla**: `professore-digitale --status`; registro in `~/.local/state/professore-digitale/server.log`.
* **Nessuna voce**: `sudo apt install espeak-ng`, poi in Impostazioni → «Prova la voce».
* **IA lenta**: scegliete un modello più piccolo in Impostazioni o con `professore-digitale-setup-ia`.
* **Microfono non attivo**: `professore-digitale-setup-voce`, poi Impostazioni → «Ricontrolla i componenti».
