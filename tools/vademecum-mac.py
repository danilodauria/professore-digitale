#!/usr/bin/env python3
"""Crea docs/sorgenti/vademecum-mac.html dal vademecum per Linux (dalla 3.8): stessi capitoli sull'uso del programma,
capitoli propri per installazione, voci del Mac, IA con Ollama per Mac, manutenzione e problemi.
Si rilancia a ogni versione, DOPO aver aggiornato vademecum-linux.html; poi tools/pdf-da-html.py.
Se un testo del vademecum per Linux cambia, lo script si ferma con «MANCA: ...»: aggiornate qui la frase.
Uso: python3 tools/vademecum-mac.py        Autore: Danilo D'Auria - Licenza MIT"""
import os
RADICE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
VER = os.environ.get("PD_VER") or open(os.path.join(RADICE, "VERSION")).read().strip()   # PD_VER: prima del rilascio
USCITA = os.path.join(RADICE, "docs/sorgenti/vademecum-mac.html")
import re, sys
src = open(os.path.join(RADICE, 'docs/sorgenti/vademecum-linux.html'), encoding='utf-8').read().replace(VER, '@VER@')
s = src

def sezione(n):
    a = s.index('<section class="capitolo"><span class="marca">§§c%d§§</span>' % n)
    b = s.index('</section>', a) + len('</section>')
    return a, b

def sostituisci_sezione(n, html):
    global s
    a, b = sezione(n)
    s = s[:a] + html.strip() + s[b:]

def r(old, new, count=1, obbligo=True):
    global s
    if obbligo and old not in s:
        raise SystemExit('MANCA: ' + old[:90])
    s = s.replace(old, new, count) if count else s.replace(old, new)

def testa(n, titolo):
    return ('<section class="capitolo"><span class="marca">§§c%d§§</span>\n<div class="capitolo-testa"><span class="num">%d</span>'
            '<div><div class="eti">CAPITOLO</div><h1>%s</h1></div></div>\n') % (n, n, titolo)

# ------------------------------------------------------------- copertina e presentazione
r('<span class="pill">Debian · Ubuntu · Mint · FeniceOS</span><span class="pill">Voci italiane incluse</span>',
  '<span class="pill">macOS 10.15 e successivi</span><span class="pill">Mac Intel e Apple</span><span class="pill">Voci italiane del Mac</span>')
r('Questo libretto accompagna chi installa il Professore Digitale su computer <b>Linux</b>, chi conduce gli incontri e chi lo usa per imparare.\nNon serve leggerlo tutto: ogni capitolo sta in piedi da solo. Esiste un vademecum gemello per i computer Windows (da XP a Windows 11):\nle lezioni, i quiz, la guida e i pacchetti di contenuti sono gli stessi.',
  'Questo libretto accompagna chi installa il Professore Digitale su un <b>Mac</b> (macOS), chi conduce gli incontri e chi lo usa per imparare.\nNon serve leggerlo tutto: ogni capitolo sta in piedi da solo. Esistono vademecum gemelli per i computer Linux e Windows:\nle lezioni, i quiz, la guida e i pacchetti di contenuti sono gli stessi. Le immagini mostrano il programma su un PC: sul Mac le pagine sono identiche, cambia solo la cornice della finestra.')
r('I comandi da scrivere nel <b>Terminale</b>', 'I pochi comandi da scrivere nel <b>Terminale</b> (Launchpad → Altro → Terminale)')
r('I tasti sono indicati così: <kbd>Invio</kbd>, <kbd>Ctrl</kbd> + <kbd>Z</kbd>. I percorsi dei menu sono in <b>grassetto</b>: <b>Applicazioni → Istruzione</b>.',
  'I tasti sono indicati così: <kbd>Invio</kbd>, <kbd>⌘ Cmd</kbd> + <kbd>Z</kbd>: sul Mac il tasto <kbd>Ctrl</kbd> dei PC di solito diventa <kbd>⌘ Cmd</kbd>. I percorsi dei menu sono in <b>grassetto</b>: <b>Impostazioni di Sistema → Accessibilità</b>.')
r('versione @VER@ per Linux.', 'versione @VER@ per macOS.')
r('Kokoro e sherpa-onnx (Apache 2.0) con le voci «Nicola» e «Sara», Piper (MIT) e le voci italiane «Giorgio» di kirys79 e «Serena» di committa (Creative Commons <b>CC BY 4.0</b>) e «Paola» (MIT);\nquelli facoltativi (espeak-ng, Pico, Vosk, Ollama, modelli di IA) hanno le proprie licenze, indicate in <code>/usr/share/doc/professore-digitale/copyright</code>.',
  'le voci sono quelle di macOS, fornite da Apple con il sistema; quelli facoltativi (Ollama, modelli di IA, FFmpeg) hanno le proprie licenze, indicate nel file <code>LICENZE.txt</code> che accompagna l\'app.')
r('Questo vademecum può essere stampato, copiato e distribuito liberamente, anche allegato ai computer rigenerati,',
  'Questo vademecum può essere stampato, copiato e distribuito liberamente,')

# ------------------------------------------------------------- capitolo 2
sostituisci_sezione(2, testa(2, "Di cosa avete bisogno") + '''<p class="intro">Il Professore Digitale si accontenta di poco: gira su quasi tutti i Mac degli ultimi anni.
Solo l'intelligenza artificiale, facoltativa, chiede un po' più di memoria.</p>
<h2>Il Mac</h2>
<table><thead><tr><th>Che cosa</th><th>Che cosa serve</th></tr></thead><tbody>
<tr><td><b>Sistema</b></td><td><b>macOS 10.15 Catalina</b> o successivo: Big Sur, Monterey, Ventura, Sonoma, Sequoia e seguenti.</td></tr>
<tr><td><b>Processore</b></td><td>Intel oppure Apple (M1, M2, M3, M4…): lo stesso file va bene per tutti.</td></tr>
<tr><td><b>Python 3</b></td><td>Il Professore lo usa per il suo piccolo server interno. Se manca, alla prima apertura macOS propone di installare gli
<b>Strumenti da riga di comando</b> di Apple, gratuiti, che lo contengono (capitolo 3).</td></tr>
<tr><td><b>Browser</b></td><td>Chrome, Edge o Brave danno una finestra «da programma», senza barre; altrimenti si usa <b>Safari</b>, che va benissimo.</td></tr>
</tbody></table>
<h2>Memoria e spazio</h2>
<table><thead><tr><th>Uso</th><th>Memoria (RAM)</th><th>Spazio su disco</th></tr></thead><tbody>
<tr><td><b>Programma di base</b><br><span class="small">lezioni, quiz, guida, lavagna, palestra, aula, voci, lingue</span></td><td>2 GB</td><td>circa 60 MB</td></tr>
<tr><td><b>Con IA locale</b>, Mac datato</td><td>8 GB</td><td>+ 1–3 GB</td></tr>
<tr><td><b>Con IA locale</b>, Mac con processore Apple (M1 e successivi)</td><td>16 GB o più</td><td>+ 3–8 GB</td></tr>
</tbody></table>
<p>Servono altoparlanti o cuffie per la voce. Per il <b>quadro dell'aula</b> e per i <b>tablet</b> i computer devono essere collegati alla stessa rete (Wi-Fi o cavo); Internet non serve.</p>
<h2>Le voci</h2>
<p>Sul Mac il Professore parla con le <b>voci italiane del sistema</b>: <b>Luca</b> (uomo), <b>Alice</b> e <b>Federica</b> (donne) e, se le scaricate, le
versioni «migliorate» o «premium», molto più naturali (capitolo 17). Le voci naturali incluse nelle versioni per Linux e Windows (Nicola, Sara, Giorgio, Serena e Paola)
usano un motore che sul Mac non c'è: per questo l'app è molto più leggera.</p>
<h2>I file che ricevete</h2>
<table><thead><tr><th>File</th><th>Cos'è</th></tr></thead><tbody>
<tr><td><code>ProfessoreDigitale-@VER@-macOS.zip</code></td><td>L'app per il Mac: dentro c'è <b>Professore Digitale.app</b>, con il foglio <code>LEGGIMI-MAC.txt</code>, le licenze e questo vademecum.</td></tr>
<tr><td><code>professore-digitale-portatile.html</code></td><td>La versione da aprire con doppio clic in Safari, senza installazione (senza IA, aula e lettura delle foto).</td></tr>
<tr><td><b>App per telefono e tablet</b></td><td>Non è un file da copiare: si apre dal sito del progetto e si mette sulla schermata Home di iPhone e iPad (capitolo 22).</td></tr>
<tr><td><code>SHA256SUMS</code></td><td>Le «impronte digitali» dei file, per verificare che siano integri.</td></tr>
</tbody></table>
<table><thead><tr><th>Funzione</th><th>App per Mac</th><th>Versione portatile</th></tr></thead><tbody>
<tr><td>Lezioni, quiz e attestati, cultura, guida interna, lavagna, palestra, sei lingue</td><td class="si">✔</td><td class="si">✔</td></tr>
<tr><td>Lettura ad alta voce</td><td class="si">✔ voci italiane del Mac</td><td class="si">✔ voce di Safari</td></tr>
<tr><td>Intelligenza artificiale locale</td><td class="si">✔ con Ollama per Mac</td><td class="no">—</td></tr>
<tr><td>Domande a voce (microfono)</td><td class="no">— non ancora sul Mac</td><td class="no">—</td></tr>
<tr><td>Quadro dell'aula, mano alzata, tablet</td><td class="si">✔</td><td class="no">—</td></tr>
<tr><td>«Spiegami questa lettera»</td><td class="si">✔ foto, webcam o testo</td><td class="si">✔ solo testo scritto o incollato</td></tr>
<tr><td>Nonni Teach</td><td class="si">✔ (il podcast in un solo MP3 con FFmpeg)</td><td class="si">✔ solo ascolto</td></tr>
<tr><td>Progressi salvati</td><td class="si">✔ nella cartella dell'utente</td><td class="si">✔ in Safari</td></tr>
</tbody></table>
</section>''')

# ------------------------------------------------------------- capitolo 3
sostituisci_sezione(3, testa(3, "Installazione") + '''<p class="intro">Si installa come tutte le app del Mac: si apre lo zip e si trascina l'app nella cartella Applicazioni. Non servono password né Internet.</p>
<h2>Installare</h2>
<ol class="passi">
<li>Scaricate <code>ProfessoreDigitale-@VER@-macOS.zip</code> dal sito del progetto (finisce nella cartella <b>Download</b>) oppure copiatelo da una chiavetta.</li>
<li>Fate <b>doppio clic</b> sullo zip: accanto compare la cartella con <b>Professore Digitale.app</b>.</li>
<li>Aprite il <b>Finder</b> e trascinate <b>Professore Digitale.app</b> nella cartella <b>Applicazioni</b> (colonna a sinistra).</li>
</ol>
<h2>La prima apertura</h2>
<p>L'app non è ancora «autenticata» da Apple (costa una quota annuale): macOS la riconosce come proveniente da Internet e la prima volta chiede conferma.
È una precauzione normale e si fa una volta sola.</p>
<ol class="passi">
<li>Nella cartella <b>Applicazioni</b> fate <b>clic con il tasto destro</b> (oppure <kbd>Ctrl</kbd> + clic) su <b>Professore Digitale</b> e scegliete <b>Apri</b>.</li>
<li>Nella finestra che compare premete ancora <b>Apri</b>.</li>
<li>Su <b>macOS 15 Sequoia</b> e successivi la finestra offre solo «Fine»: premetelo, poi aprite <b>Impostazioni di Sistema → Privacy e sicurezza</b>,
scorrete in basso fino a «Professore Digitale è stato bloccato» e premete <b>Apri comunque</b>; confermate con la password o con Touch ID.</li>
</ol>
<p>Dalla seconda volta basta il solito clic, dal Launchpad, dal Dock o dalla cartella Applicazioni. Per averlo sempre a portata di mano:
con il programma aperto, tasto destro sull'icona nel Dock → <b>Opzioni → Mantieni nel Dock</b>.</p>
<h2>Se manca Python 3</h2>
<p>Sui Mac dove non è mai stato installato nulla per programmare, alla prima apertura compare il messaggio
«Il Professore Digitale ha bisogno di Python 3» e subito dopo macOS propone di installare gli <b>Strumenti da riga di comando</b>.</p>
<ol class="passi">
<li>Premete <b>Installa</b> e accettate la licenza di Apple: lo scaricamento dura qualche minuto (serve Internet, una volta sola).</li>
<li>Quando ha finito, riaprite il Professore.</li>
</ol>
<div class="box"><span class="t">In alternativa</span>Va bene anche Python 3 scaricato da <b>python.org</b> o installato con Homebrew (<code>brew install python</code>): il Professore lo trova da solo.</div>
<h2>Aggiornare</h2>
<p>Per passare a una versione nuova si scarica il nuovo zip e si trascina la nuova app in <b>Applicazioni</b>, scegliendo <b>Sostituisci</b>.
Progressi, impostazioni, persone e registro <b>restano</b>, perché non stanno dentro l'app ma nella vostra cartella personale (capitolo 27).
Il Professore può anche scaricare lo zip da solo: <b>Impostazioni → Aggiornamenti → Controlla aggiornamenti</b>.</p>
<h2>Verificare l'integrità del file (facoltativo)</h2>
<p>Nel <b>Terminale</b>, dentro la cartella dove si trovano lo zip e <code>SHA256SUMS</code>:</p>
<pre>shasum -a 256 -c SHA256SUMS --ignore-missing          <span class="c"># deve rispondere: OK</span></pre>
<h2>La versione portatile</h2>
<p>Fate doppio clic su <code>professore-digitale-portatile.html</code>: si apre in Safari e funziona subito, anche da chiavetta USB. Lezioni, quiz con attestato,
cultura generale, palestra e lavagna ci sono tutti; i progressi vengono ricordati da Safari di quel Mac.</p>
</section>''')

# ------------------------------------------------------------- capitolo 4
r('''<p class="intro">Aprite il menu delle applicazioni, categoria <b>Istruzione</b>, e fate clic su <b>Professore Digitale</b>.''',
  '''<p class="intro">Aprite <b>Professore Digitale</b> dal Launchpad, dal Dock o dalla cartella <b>Applicazioni</b>.''')
r('''L'icona avvia un piccolo programma invisibile''', '''L'app avvia un piccolo programma invisibile''')
r('''Se l'icona viene premuta di nuovo, il programma non si duplica: riapre la finestra.''',
  '''Se l'app viene aperta di nuovo, il programma non si duplica: riapre la finestra.''')
r('''<div class="box"><span class="t">Quale browser?</span>Il programma preferisce Chromium o Chrome, che permettono una finestra «da applicazione» senza barre;
altrimenti usa Firefox o il browser predefinito. Si può scegliere un browser preciso con la variabile <code>PD_BROWSER</code> (capitolo 29).</div>''',
  '''<div class="box"><span class="t">Quale browser?</span>Il programma preferisce Google Chrome, Microsoft Edge o Brave, se sono nella cartella Applicazioni:
aprono una finestra «da programma» senza barre. Altrimenti usa il browser predefinito, di solito <b>Safari</b>.</div>''')

# ------------------------------------------------------------- capitolo 17: voci
a = s.index('<h2>Le voci italiane, maschili e femminili</h2>')
b = s.index('<h2>Il saluto all\'avvio</h2>')
s = s[:a] + '''<h2>Le voci italiane, maschili e femminili</h2>
<p>Sul Mac il Professore usa le <b>voci italiane di macOS</b>. Di serie ci sono almeno <b>Luca</b> (uomo) e <b>Alice</b> (donna); su molti Mac anche <b>Federica</b>.</p>
<table><thead><tr><th></th><th style="width:22%">Voce</th><th>Com'è</th></tr></thead><tbody>
<tr><td class="ico">👨</td><td><b>Luca</b></td><td>Voce maschile. È la <b>voce predefinita</b>, perché il Professore è un uomo.</td></tr>
<tr><td class="ico">👩</td><td><b>Alice</b>, <b>Federica</b></td><td>Voci femminili. Neura, in Nonni Teach, usa una voce femminile.</td></tr>
<tr><td class="ico">✨</td><td>Voci «Migliorata» o «Premium»</td><td>Versioni molto più naturali delle stesse voci: si scaricano gratis da Apple e compaiono nell'elenco come «voce naturale».</td></tr>
</tbody></table>
<h3>Scaricare le voci migliori (una volta, con Internet)</h3>
<ol class="passi">
<li>Aprite <b>Impostazioni di Sistema → Accessibilità → Contenuto letto ad alta voce</b> (su macOS meno recenti: <b>Preferenze di Sistema → Accessibilità → Voce</b>).</li>
<li>Accanto a <b>Voce di sistema</b> premete <b>ⓘ</b> o <b>Gestisci voci…</b> e cercate <b>Italiano</b>.</li>
<li>Spuntate <b>Luca (Migliorata)</b> e, se volete, <b>Alice</b> o <b>Federica</b> in versione migliorata: il Mac le scarica (alcune centinaia di MB).</li>
<li>Nel Professore premete <b>Impostazioni → 🔄 Ricontrolla i componenti</b>, oppure chiudetelo e riapritelo.</li>
</ol>
<ol class="passi">
<li>Aprite <b>⚙️ Impostazioni</b> e cercate il riquadro <b>🔊 Voce</b>.</li>
<li>Fate clic su <b>Voce del Professore</b> e scegliete la voce che preferite. Appena scelta, il Professore dice «Buongiorno! Questa è la mia nuova voce.».</li>
<li>Se volete, regolate la <b>velocità</b> (per le persone anziane tra 0,85 e 0,95) e premete <b>▶ Prova la voce</b>.</li>
</ol>
<p>Con <b>Automatica (consigliata)</b> il Professore usa Luca, poi le altre voci italiane del Mac. Quando avete scelto un'altra lingua del programma (capitolo 18),
il Professore legge con le voci di Safari o di Chrome per quella lingua.</p>
''' + s[b:]

# ------------------------------------------------------------- capitolo 18
r('<li><b>Voce del Professore</b>: Nicola, Sara, Giorgio, Serena, Paola o una voce leggera, maschile o femminile (capitolo 17).</li>',
  '<li><b>Voce del Professore</b>: una delle voci italiane del Mac, maschile o femminile (capitolo 17).</li>')
r('Se qualcosa manca, indicano il comando da dare nel terminale (capitolo 20).', 'Se qualcosa manca, spiegano come aggiungerlo (capitolo 20).')
r('''Il controllo degli aggiornamenti parte solo premendo il pulsante: se c'è una versione nuova il Professore la scarica
nella cartella Scaricati, ne verifica l'impronta e mostra il comando per installarla (capitolo 27).''',
  '''Il controllo degli aggiornamenti parte solo premendo il pulsante: se c'è una versione nuova il Professore scarica lo zip per Mac
nella cartella Download, ne verifica l'impronta e spiega come sostituire l'app (capitolo 27).''')

# ------------------------------------------------------------- capitolo 20
sostituisci_sezione(20, testa(20, "IA, microfono e voci sul Mac") + '''<p class="intro">Il programma di base è completo e ha già le voci. L'<b>intelligenza artificiale locale</b> si aggiunge in pochi minuti, con Internet una sola volta; poi funziona offline.</p>
<h2>L'intelligenza artificiale locale (Ollama per Mac)</h2>
<ol class="passi">
<li>Aprite <b>ollama.com</b>, premete <b>Download → macOS</b> e aprite il file scaricato: trascinate <b>Ollama</b> in Applicazioni e apritelo
(compare un lamatino nella barra in alto).</li>
<li>Aprite il <b>Terminale</b> (Launchpad → Altro → Terminale) e scaricate il modello consigliato nelle Impostazioni del Professore, per esempio:
<pre>ollama pull qwen3.5:2b</pre></li>
<li>Nel Professore premete <b>Impostazioni → 🔄 Ricontrolla i componenti</b>: la pastiglia in alto mostra il nome del modello.</li>
</ol>
<table><thead><tr><th>Modello</th><th>Dimensione</th><th>Adatto a</th></tr></thead><tbody>
<tr><td><code>qwen3.5:0.8b</code></td><td>~1 GB</td><td>Mac con 4–6 GB di RAM</td></tr>
<tr><td><code>qwen3.5:2b</code></td><td>~2,7 GB</td><td>Mac con 8 GB di RAM (scelta tipica)</td></tr>
<tr><td><code>qwen3.5:4b</code></td><td>~3,4 GB</td><td>Mac con processore Apple e 16 GB</td></tr>
<tr><td><code>qwen3.5:9b</code></td><td>~6,6 GB</td><td>Mac con processore Apple e 24 GB o più</td></tr>
</tbody></table>
<p>Si possono scaricare più modelli e scegliere quello da usare in <b>Impostazioni → Intelligenza artificiale → Modello</b>.
Ollama deve essere aperto quando usate il Professore: per averlo sempre, lasciate attiva la sua opzione di avvio automatico.</p>
<div class="box consiglio"><span class="t">Regola pratica</span>Meglio un modello piccolo che risponde in 10 secondi di uno grande che fa aspettare un minuto:
davanti a un gruppo, l'attenzione vale più della raffinatezza. Sui Mac con processore Apple l'IA è particolarmente veloce.</div>
<h2>Il microfono</h2>
<p>Il riconoscimento vocale del Professore (le domande a voce) <b>non è ancora disponibile sul Mac</b>: le domande si scrivono.
Sui telefoni e sugli iPad, l'app del sito ha «🎤 Parla con la voce» (capitolo 22).</p>
<h2>Le voci</h2>
<p>Sono quelle del Mac (capitolo 17): non serve installare nulla. Le versioni «migliorate» si scaricano da <b>Impostazioni di Sistema → Accessibilità → Contenuto letto ad alta voce</b>.</p>
<h2>FFmpeg per i podcast di Nonni Teach</h2>
<p>Per unire le risposte di un'intervista in un unico podcast MP3 con i capitoli serve <b>FFmpeg</b>, libero e gratuito. Il modo più semplice è con <b>Homebrew</b>:</p>
<pre><span class="c"># 1. una volta sola: le istruzioni aggiornate sono su https://brew.sh</span>
<span class="c"># 2. poi</span>
brew install ffmpeg</pre>
<p>Poi in Nonni Teach premete «🔄 L'ho installato: controlla di nuovo». Senza FFmpeg le risposte si ascoltano e si pubblicano una per una.</p>
<h2>Togliere i componenti</h2>
<pre>ollama list                 <span class="c"># i modelli dell'IA installati</span>
ollama rm qwen3.5:2b        <span class="c"># toglie un modello</span></pre>
<p>Ollama si toglie come ogni app: trascinatelo nel Cestino.</p>
</section>''')

# ------------------------------------------------------------- capitolo 27
sostituisci_sezione(27, testa(27, "Manutenzione, aggiornamenti e disinstallazione") + '''<h2>Salvare i progressi</h2>
<p>In <b>Impostazioni → Dati e progressi → Esporta progressi</b> si ottiene un file da conservare su chiavetta, con lezioni, quiz, attestati e promemoria
della persona che sta usando il computer. Il registro delle presenze ha la sua copia: <b>📋 Registro e incontri → ⬇️ Salva copia del registro</b> (capitolo 24).
Per un salvataggio completo basta copiare la cartella <code>~/Library/Application Support/ProfessoreDigitale</code>
(nel Finder: menu <b>Vai → Vai alla cartella…</b> e incollate il percorso). Gli attestati salvati in PDF stanno nella cartella <b>Download</b>.
Anche <b>Time Machine</b> la salva da sola.</p>
<h2>Aggiornare</h2>
<ol class="passi">
<li>In <b>Impostazioni → Aggiornamenti</b> premete <b>🌐 Controlla aggiornamenti</b> (serve Internet in quel momento, oppure un PC dell'aula che fa da server).</li>
<li>Se c'è una versione nuova, leggete le novità e premete <b>⬇️ Scarica il nuovo pacchetto</b>: lo zip va nella cartella <b>Download</b> e viene verificato con la sua impronta.</li>
<li>Chiudete il Professore con <b>🚪 Esci</b>, aprite lo zip e trascinate la nuova <b>Professore Digitale.app</b> in <b>Applicazioni</b>, scegliendo <b>Sostituisci</b>.</li>
<li>Riaprite il Professore (la prima volta di nuovo con tasto destro → <b>Apri</b>, capitolo 3). Impostazioni e progressi ci sono tutti.</li>
</ol>
<p>Nella stessa scheda si possono aggiungere i nuovi contenuti (domande, lezioni e quiz) con un clic, senza aggiornare il programma.</p>
<h2>Ripristino dopo un problema</h2>
<p>Se il Professore non si comporta bene: premete <b>🚪 Esci</b>, aspettate qualche secondo e riapritelo. Se non basta, riavviate il Mac.
Se ancora non va, scaricate di nuovo lo zip della stessa versione e sostituite l'app: i progressi restano.</p>
<h2>Disinstallazione</h2>
<ol class="passi">
<li>Trascinate <b>Professore Digitale</b> dalla cartella Applicazioni nel <b>Cestino</b>.</li>
<li>Per togliere anche i progressi di un utente (per esempio prima di regalare il Mac): nel Finder <b>Vai → Vai alla cartella…</b>,
scrivete <code>~/Library/Application Support/ProfessoreDigitale</code> e mettete la cartella nel Cestino; fate lo stesso con <code>~/Library/Logs/ProfessoreDigitale</code>.</li>
<li>Facoltativo, l'IA: <code>ollama rm NOME</code> per ogni modello, poi Ollama nel Cestino.</li>
</ol>
</section>''')

# ------------------------------------------------------------- capitolo 28
a, b = sezione(28)
cap = s[a:b]
righe = re.findall(r'<tr><td>.*?</tr>', cap)
via = ('apt ', 'ufw', 'espeak', 'Giorgio', 'Piper', 'lock', 'unsandboxed', 'fonts-noto', 'Chromium', '.deb', 'setup-voce', 'systemctl',
       'pd_tablet.py', 'Riccardo', 'Comandi a voce', 'Il microfono è grigio', 'Non ho sentito nulla', 'permesso per il microfono', 'Clic sull\'icona')
tenute = [x for x in righe if not any(v in x for v in via)]
nuove = '''<tr><td>«Impossibile aprire Professore Digitale perché lo sviluppatore non può essere verificato»</td><td>Prima apertura di un'app scaricata</td><td>Tasto destro sull'app → <b>Apri</b> → <b>Apri</b>; su macOS 15 e successivi <b>Impostazioni di Sistema → Privacy e sicurezza → Apri comunque</b> (capitolo 3).</td></tr>
<tr><td>«Professore Digitale è danneggiato e non può essere aperto»</td><td>macOS ha messo in quarantena la copia arrivata da Internet o da una chiavetta</td><td>Rimettete l'app in Applicazioni e ripetete <b>tasto destro → Apri</b>. Se non basta, nel Terminale: <code>xattr -dr com.apple.quarantine "/Applications/Professore Digitale.app"</code>, poi riapritela.</td></tr>
<tr><td>«Il Professore Digitale ha bisogno di Python 3»</td><td>Mancano gli Strumenti da riga di comando</td><td>Premete <b>Installa</b> nella finestra di macOS; quando ha finito, riaprite il Professore (capitolo 3).</td></tr>
<tr><td>Clic sull'app e non succede nulla</td><td>Mac lento o server interno che non parte</td><td>Aspettate fino a 45 secondi. Poi guardate il registro: Finder → <b>Vai → Vai alla cartella…</b> → <code>~/Library/Logs/ProfessoreDigitale/server.log</code>.</td></tr>
<tr><td>Si apre Safari con barre e schede</td><td>Chrome, Edge o Brave non sono installati</td><td>È normale. Per una finestra pulita installate Google Chrome nella cartella Applicazioni.</td></tr>
<tr><td>Il Professore non parla</td><td>Volume basso, voce spenta, nessuna voce italiana</td><td>Controllate il volume del Mac; in Impostazioni «Voce attiva» e «Prova la voce». Se l'elenco delle voci è vuoto, scaricate una voce italiana (capitolo 17).</td></tr>
<tr><td>La voce è un po' robotica</td><td>Si usa la versione di base della voce</td><td>Scaricate <b>Luca (Migliorata)</b> o un'altra voce «Premium» (capitolo 17) e sceglietela in Impostazioni → Voce.</td></tr>
<tr><td>Risponde sempre la «Guida interna»</td><td>IA spenta, Ollama chiuso o senza modelli</td><td>Aprite Ollama (lamatino nella barra in alto); nel Terminale <code>ollama list</code>; se è vuoto <code>ollama pull qwen3.5:2b</code>. Poi Impostazioni → «Usa l'IA» attivo e 🔄 Ricontrolla i componenti.</td></tr>
<tr><td>Nonni Teach: «Per unire le registrazioni in un unico MP3 serve FFmpeg»</td><td>FFmpeg non è installato</td><td><code>brew install ffmpeg</code> (capitolo 20), poi «🔄 controlla di nuovo». Intanto le risposte si ascoltano una per una.</td></tr>
<tr><td>Aula o tablet: macOS chiede «Consentire a python3 di accettare connessioni in entrata?»</td><td>Firewall del Mac acceso</td><td>Sul PC del facilitatore e quando accendete i tablet premete <b>Consenti</b>. Se avete risposto «Rifiuta»: <b>Impostazioni di Sistema → Rete → Firewall → Opzioni</b> e consentite <b>python3</b>.</td></tr>
<tr><td>Il microfono non c'è</td><td>Sul Mac il riconoscimento vocale non è ancora disponibile</td><td>Scrivete le domande. Su iPhone e iPad l'app del sito ha «🎤 Parla con la voce» (capitolo 22).</td></tr>
<tr><td>Dopo l'aggiornamento i progressi non ci sono</td><td>Sta usando il Mac un altro utente, o un'altra persona del Professore</td><td>I progressi stanno nella cartella dell'utente del Mac: entrate con lo stesso utente e toccate il vostro nome in alto (capitolo 16).</td></tr>
'''
nuovo_cap = (testa(28, "Risoluzione dei problemi") + '''<p class="intro">Prima di tutto: <b>Impostazioni → Diagnostica</b> mostra cosa è attivo e cosa no. Il registro tecnico è in
<code>~/Library/Logs/ProfessoreDigitale/server.log</code> (Finder → <b>Vai → Vai alla cartella…</b>).</p>
<table><thead><tr><th style="width:27%">Sintomo</th><th style="width:25%">Causa probabile</th><th>Rimedio</th></tr></thead><tbody>
''' + nuove + "\n".join(tenute) + '\n</tbody></table>\n</section>')
s = s[:a] + nuovo_cap + s[b:]

# ------------------------------------------------------------- capitolo 29: solo le parti valide sul Mac
a, b = sezione(29)
cap = s[a:b]
i = cap.index('<h2>Scorciatoie da tastiera</h2>')
resto = cap[i:]
resto = resto.replace('<kbd>Ctrl</kbd> + <kbd>+</kbd>', '<kbd>⌘</kbd> + <kbd>+</kbd>')
resto = re.sub(r'<kbd>Ctrl</kbd>', '<kbd>⌘ Cmd</kbd>', resto)
s = s[:a] + testa(29, "Riferimento rapido") + '''<h2>Dove sono le cose</h2>
<table><thead><tr><th>Percorso</th><th>Cosa contiene</th></tr></thead><tbody>
<tr><td><code>/Applications/Professore Digitale.app</code></td><td>Il programma: server interno in Python (solo libreria standard), interfaccia, contenuti, lettore delle foto (OCR), dizionari delle sei lingue</td></tr>
<tr><td><code>~/Library/Application Support/ProfessoreDigitale</code></td><td>Progressi, persone, impostazioni, registro, contenuti aggiunti, interviste di Nonni Teach</td></tr>
<tr><td><code>~/Library/Logs/ProfessoreDigitale/server.log</code></td><td>Registro tecnico, da allegare quando si chiede aiuto</td></tr>
<tr><td><code>~/Downloads</code></td><td>Attestati in PDF, esportazioni, aggiornamenti scaricati</td></tr>
</tbody></table>
<h2>Rete, aula e firewall</h2>
<table><thead><tr><th>Indirizzo o porta</th><th>Uso</th></tr></thead><tbody>
<tr><td><code>127.0.0.1:8765</code></td><td>Interfaccia del Professore, solo dentro il computer</td></tr>
<tr><td>8766 TCP · 8767 UDP</td><td>Quadro dell'aula: solo rete locale, solo sul PC del facilitatore e solo se attivato</td></tr>
<tr><td>8768 TCP</td><td>Tablet dell'aula: solo rete locale, solo se accendete la condivisione, con il codice di 6 cifre</td></tr>
<tr><td>Firewall del Mac</td><td>Alla prima richiesta «Consentire a python3…» rispondete <b>Consenti</b> (capitolo 28)</td></tr>
</tbody></table>
''' + resto + s[b:]
'''

# ------------------------------------------------------------- sostituzioni generali
''' 
for vecchio, nuovo in (
    ('~/.local/share/professore-digitale', '~/Library/Application Support/ProfessoreDigitale'),
    ('~/.local/state/professore-digitale', '~/Library/Logs/ProfessoreDigitale'),
    ('cartella <b>Scaricati</b>', 'cartella <b>Download</b>'),
    ('cartella Scaricati', 'cartella Download'),
    ('<code>sudo apt install ffmpeg</code>', '<code>brew install ffmpeg</code>'),
    ('Professore Digitale @VER@ per Linux', 'Professore Digitale @VER@ per macOS'),
    ('Vademecum per Linux', 'Vademecum per macOS'),
):
    s = s.replace(vecchio, nuovo)
open(USCITA, 'w', encoding='utf-8').write(s.replace('@VER@', VER))
print("ok", len(s))

# ------------------------------------------------------------- seconda passata: dettagli
s = open(USCITA, encoding='utf-8').read().replace(VER, '@VER@')
def q(old, new):
    global s
    if old not in s:
        raise SystemExit('MANCA2: ' + old[:90])
    s = s.replace(old, new)
q('Voci naturali Nicola, Sara e Giorgio · Quadro', 'Voci italiane del Mac · Sei lingue · Quadro')
q('<b>Dalla 3.5.3</b>: corretto il pacchetto per Linux che, nelle versioni dalla 3.4 alla 3.5.2, poteva non avviarsi («Il server locale non si è avviato»): vedete il capitolo dei problemi.<br>\n', '')
q('<b>🔊 voci più naturali</b> Giorgio e Serena (capitolo 17)', '<b>🔊 voci più naturali</b> sui PC Linux e Windows')
q('Installazione<small>Pacchetto .deb, aggiornamento dalla 2.x, versione portatile</small>', 'Installazione<small>L\'app nella cartella Applicazioni, la prima apertura, Python 3, aggiornare</small>')
q('<small>Nicola, Sara, Giorgio, Serena e Paola · il Professore', '<small>Le voci italiane del Mac · il Professore')
q('<tr><td>🔊 voce naturale / espeak-ng / pico</td>', '<tr><td>🔊 say (voci del Mac)</td>')
q('<b>Scaricati</b>, da conservare', '<b>Download</b>, da conservare')
q('(Sara, Serena o Paola se ci sono le voci naturali, altrimenti una voce femminile del computer)', '(Alice o Federica, le voci femminili del Mac)')
q('Aprite il <b>Terminale</b> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>T</kbd>) e scrivete <code>brew install ffmpeg</code>: è nei repository di Debian, Ubuntu, Mint e FeniceOS.',
  'Sul Mac si installa con Homebrew (<b>brew.sh</b>): aprite il <b>Terminale</b> (Launchpad → Altro → Terminale) e scrivete <code>brew install ffmpeg</code> (capitolo 20).')
q('Scorciatoia: <kbd>Ctrl</kbd> + <kbd>Maiusc</kbd> + <kbd>P</kbd>', 'Scorciatoia: <kbd>⌘ Cmd</kbd> + <kbd>Maiusc</kbd> + <kbd>P</kbd>')
q('''Su molte distribuzioni il firewall è spento e non serve fare nulla. Se sul PC del facilitatore è attivo <b>ufw</b> (lo vedete con <code>sudo ufw status</code>),
consentite le due porte e riavviate il Professore:
<pre>sudo ufw allow 8766/tcp
sudo ufw allow 8767/udp</pre>''',
  '''Sul Mac del facilitatore, se il firewall è acceso, la prima volta macOS chiede «Consentire a python3 di accettare connessioni in entrata?»: premete <b>Consenti</b>.
Se avevate risposto «Rifiuta»: <b>Impostazioni di Sistema → Rete → Firewall → Opzioni</b> e consentite <b>python3</b>, poi riavviate il Professore.''')
q('Se nell\'aula ci sono anche PC Windows con il ruolo di facilitatore, vedete il vademecum per Windows.', 'Se il facilitatore usa un PC Linux o Windows, vedete il vademecum di quel sistema.')
q('(non Nicola, Sara, Giorgio, Serena e Paola)', '(non quelle del Mac)')
q('<b>voci naturali del PC</b> (Nicola, Sara, Giorgio, Serena e Paola)', '<b>voci del Mac</b> dell\'aula')
q('''Su molte distribuzioni il firewall è spento e non serve fare nulla. Se è attivo <b>ufw</b> (lo vedete con <code>sudo ufw status</code>), aprite la porta <b>solo alla rete locale</b> e riaccendete la condivisione:
<pre>sudo ufw allow from 192.168.0.0/16 to any port 8768 proto tcp</pre>
Se gli indirizzi della vostra rete iniziano con <code>10.</code> o con <code>172.</code>, scrivete <code>10.0.0.0/8</code> oppure <code>172.16.0.0/12</code> al posto di <code>192.168.0.0/16</code>.''',
  '''Se il firewall del Mac è acceso, alla prima accensione macOS chiede «Consentire a python3 di accettare connessioni in entrata?»: premete <b>Consenti</b>
(il Professore accetta comunque solo i dispositivi della rete locale con il codice).''')
q('Voce scelta (Nicola, Sara, Giorgio, Serena o Paola)', 'Voce scelta (Luca o un\'altra voce italiana del Mac)')
q('si può creare un utente Linux per ciascuno', 'si può creare un utente del Mac per ciascuno')
q('Funziona anche sui computer Linux.', 'Funziona anche sui computer Linux e Windows.')
q('''(le cartelle che iniziano con il punto sono nascoste: nel gestore dei file si vedono con
<kbd>Ctrl</kbd> + <kbd>H</kbd>)''', '''(la cartella Libreria è nascosta: nel Finder la aprite con <b>Vai → Vai alla cartella…</b>,
oppure tenendo premuto <kbd>⌥ Opzione</kbd> mentre aprite il menu <b>Vai</b>)''')
q('<td>Le voci naturali Nicola, Sara, Giorgio, Serena e Paola</td>', '<td>Le voci italiane del Mac</td>')
for a, b in (('<kbd>Ctrl</kbd> + <kbd>V</kbd>', '<kbd>⌘ Cmd</kbd> + <kbd>V</kbd>'), ('<kbd>Ctrl</kbd> + <kbd>Invio</kbd>', '<kbd>⌘ Cmd</kbd> + <kbd>Invio</kbd>'),
             ('Mostrate <kbd>Ctrl</kbd> + <kbd>Z</kbd>', 'Mostrate <kbd>⌘ Cmd</kbd> + <kbd>Z</kbd>'),
             ('<kbd>Ctrl</kbd> + <kbd>C</kbd> e <kbd>Ctrl</kbd> + <kbd>V</kbd>', '<kbd>⌘ Cmd</kbd> + <kbd>C</kbd> e <kbd>⌘ Cmd</kbd> + <kbd>V</kbd> (sul PC <kbd>Ctrl</kbd>)')):
    s = s.replace(a, b)
open(USCITA, 'w', encoding='utf-8').write(s.replace('@VER@', VER))
print("seconda passata ok")
s = open(USCITA, encoding='utf-8').read().replace(VER, '@VER@')
q('per Linux · Debian, Ubuntu, Mint, FeniceOS</div>', 'per Mac · macOS 10.15 e successivi</div>')
q('<kbd>Ctrl</kbd> + <kbd>C</kbd> e <kbd>⌘ Cmd</kbd> + <kbd>V</kbd>', '<kbd>⌘ Cmd</kbd> + <kbd>C</kbd> e <kbd>⌘ Cmd</kbd> + <kbd>V</kbd> (sul PC <kbd>Ctrl</kbd>)')
q('si installa con lo stesso pacchetto <code>.deb</code> (capitolo 3).', 'si installa con il pacchetto <code>.deb</code> descritto nel vademecum per Linux.')
open(USCITA, 'w', encoding='utf-8').write(s.replace('@VER@', VER))
print("terza passata ok")
s = open(USCITA, encoding='utf-8').read().replace(VER, '@VER@')
q('<b>👨 Nicola</b>, la nuova voce del Professore, molto più naturale e scorrevole, e <b>👩 Sara</b> (capitolo 17) · il <b>vademecum per Mac</b>.',
  'questo <b>vademecum per Mac</b>, con l\'installazione, le voci del Mac, l\'IA con Ollama e i problemi più comuni · sui PC Linux e Windows arriva <b>Nicola</b>, la nuova voce naturale del Professore, con <b>Sara</b>.')
open(USCITA, 'w', encoding='utf-8').write(s.replace('@VER@', VER))
print("quarta passata ok")
s = open(USCITA, encoding='utf-8').read().replace(VER, '@VER@')
q('<div><dt>apt</dt><dd>Il programma che installa e aggiorna i pacchetti su Debian, Ubuntu, Mint e FeniceOS.</dd></div>',
  '<div><dt>App (.app)</dt><dd>Un programma per il Mac: si installa trascinandolo nella cartella Applicazioni e si toglie mettendolo nel Cestino.</dd></div>')
q('<kbd>Ctrl</kbd> + <kbd>C</kbd> per copiare, <kbd>⌘ Cmd</kbd> + <kbd>V</kbd> per incollare.', '<kbd>⌘ Cmd</kbd> + <kbd>C</kbd> per copiare, <kbd>⌘ Cmd</kbd> + <kbd>V</kbd> per incollare (sui PC <kbd>Ctrl</kbd>).')
q('<div><dt>Pacchetto .deb</dt><dd>Il «pacco» che contiene un programma da installare su Debian, Ubuntu, Mint e FeniceOS.</dd></div>',
  '<div><dt>Gatekeeper</dt><dd>La protezione del Mac che, la prima volta, chiede conferma prima di aprire un\'app scaricata da Internet.</dd></div>')
q('I componenti di altri autori (Mermaid, tesseract.js, Piper, Kokoro e sherpa-onnx, le voci\nNicola, Sara, Giorgio, Serena e Paola, Vosk) mantengono la propria licenza, elencata in <code>/usr/share/doc/professore-digitale/copyright</code>.',
  'I componenti di altri autori (Mermaid, tesseract.js) mantengono la propria licenza, elencata nel file <code>LICENZE.txt</code> che accompagna l\'app.')
n = [0]
def numera(m):
    n[0] += 1
    return '<b>Figura %d.</b>' % n[0]
s = re.sub(r'<b>Figura \d+\.</b>', numera, s)
open(USCITA, 'w', encoding='utf-8').write(s.replace('@VER@', VER))
print("quinta passata ok, figure", n[0])
