/* Professore Digitale - Percorso didattico di alfabetizzazione digitale
 * Autore: Danilo D'Auria - Contenuti CC BY-NC-SA 4.0 (© 2026 Danilo D'Auria), codice MIT
 * Ogni lezione: passi (testo + schema facoltativo), esercizio in Palestra, quiz finale.
 * Sintassi testo: **grassetto**, *corsivo*, elenchi con "- " o "1. ", righe vuote = paragrafi.
 */
window.PD_LESSONS = [
{
  id: "computer", icon: "🖥️", title: "Il computer: com'è fatto", level: "Primi passi", minutes: 15,
  goal: "Conoscere le parti del computer, accenderlo e spegnerlo nel modo giusto.",
  steps: [
    { t: "Una scrivania elettronica",
      x: "Il computer è come una **scrivania elettronica**: ci scriviamo lettere, guardiamo foto, conserviamo documenti e parliamo con le persone care.\n\nNon si rompe se sbagliamo un clic: quasi tutto si può **annullare**. Qui non ci sono domande stupide.",
      tip: "Prendetevi il vostro tempo: nessuno vi mette fretta." },
    { t: "Le parti principali",
      x: "- **Monitor (schermo)**: è la finestra da cui vediamo il lavoro.\n- **Tastiera**: serve per scrivere.\n- **Mouse**: è il nostro dito elettronico, serve per indicare e scegliere.\n- **Case / unità centrale**: la scatola che contiene il *cervello* del computer. Nel portatile è tutto dentro un unico oggetto.\n- **Altoparlanti e microfono**: per sentire e per parlare.",
      d: "flowchart LR\n  T[\"⌨️ Tastiera\"] --> C[\"🧠 Unità centrale\"]\n  M[\"🖱️ Mouse\"] --> C\n  MIC[\"🎤 Microfono\"] --> C\n  C --> S[\"🖥️ Schermo\"]\n  C --> A[\"🔊 Altoparlanti\"]" },
    { t: "Ingresso e uscita",
      x: "Il computer riceve informazioni da noi (**ingresso**: tastiera, mouse, microfono) e ci restituisce risultati (**uscita**: schermo, altoparlanti, stampante).\n\nÈ come una cucina: gli ingredienti entrano, il cuoco lavora, il piatto esce.",
      d: "flowchart LR\n  I[\"Ingresso: tastiera, mouse\"] --> L[\"Lavoro: il processore pensa\"] --> U[\"Uscita: schermo, stampante\"]" },
    { t: "Accendere il computer",
      x: "1. Cercate il **pulsante di accensione**: di solito ha questo simbolo ⏻.\n2. Premetelo **una sola volta**, senza tenerlo premuto.\n3. Aspettate con pazienza: i computer più anziani, come noi, hanno bisogno di qualche minuto per svegliarsi.\n4. Quando vedete lo **sfondo con le icone** (il desktop), il computer è pronto.",
      tip: "Se compare una richiesta di password, è normale: serve a proteggere i vostri dati." },
    { t: "Spegnere nel modo giusto",
      x: "Il computer **non si spegne staccando la spina**: potrebbe perdere il lavoro o rovinarsi.\n\n1. Salvate e chiudete i programmi aperti.\n2. Aprite il **menu** (in basso a sinistra).\n3. Scegliete **Arresta** o **Spegni**.\n4. Aspettate che lo schermo diventi nero da solo.",
      d: "flowchart TD\n  A[\"Salvo il lavoro\"] --> B[\"Apro il menu\"] --> C[\"Scelgo Arresta\"] --> D[\"Aspetto lo schermo nero\"]" }
  ],
  quiz: [
    { q: "A cosa serve il mouse?", o: ["A scrivere lettere", "A indicare e scegliere le cose sullo schermo", "A stampare"], a: 1, e: "Il mouse è il nostro dito elettronico: muove la freccia sullo schermo." },
    { q: "Qual è il modo corretto di spegnere il computer?", o: ["Staccare la spina", "Menu → Arresta, poi aspettare", "Tenere premuto il pulsante per 10 secondi"], a: 1, e: "Staccare la spina può far perdere il lavoro. Si usa sempre il menu." },
    { q: "Lo schermo è un dispositivo di…", o: ["Ingresso", "Uscita"], a: 1, e: "Lo schermo ci mostra i risultati: è un dispositivo di uscita." }
  ]
},
{
  id: "mouse", icon: "🖱️", title: "Usare il mouse", level: "Primi passi", minutes: 20, practice: "click",
  goal: "Muovere la freccia, fare clic, doppio clic, clic destro e trascinare.",
  steps: [
    { t: "Come si impugna",
      x: "Appoggiate la mano sul mouse **rilassata**, come se accarezzaste un gattino.\n\n- Il **dito indice** sta sul tasto sinistro.\n- Il **dito medio** sta sul tasto destro.\n- Il pollice e l'anulare tengono il mouse ai lati.\n\nMuovendo il mouse sul tavolo, la **freccia** sullo schermo si muove allo stesso modo.",
      tip: "Se arrivate al bordo del tappetino, sollevate il mouse e riappoggiatelo al centro: la freccia resta ferma." },
    { t: "Il clic",
      x: "Fare **clic** vuol dire premere e rilasciare subito il tasto sinistro, *una volta sola*.\n\nServe per **selezionare** qualcosa o per premere un pulsante sullo schermo. È come bussare una volta a una porta.",
      d: "flowchart LR\n  A[\"Porto la freccia sopra\"] --> B[\"Premo il tasto sinistro\"] --> C[\"Lascio subito\"]" },
    { t: "Il doppio clic",
      x: "Il **doppio clic** sono due clic **rapidi**, uno dietro l'altro, senza muovere il mouse.\n\nServe per **aprire** le icone sul desktop e le cartelle. È come bussare due volte: toc-toc!",
      tip: "Se il doppio clic non funziona, spesso è perché il mouse si è mosso tra un clic e l'altro. Tenetelo ben fermo." },
    { t: "Il clic destro",
      x: "Premendo il **tasto destro** si apre un piccolo **menu di scelte** (menu contestuale): copia, incolla, rinomina, elimina…\n\nÈ come chiedere al computer: *\"cosa posso fare con questo oggetto?\"*" },
    { t: "Trascinare e la rotellina",
      x: "**Trascinare**: portate la freccia su un oggetto, **tenete premuto** il tasto sinistro, spostate il mouse e **lasciate** nel punto desiderato. Così si spostano i file nelle cartelle.\n\n**Rotellina**: girandola, la pagina scorre in alto e in basso, come srotolare un giornale.",
      d: "flowchart LR\n  A[\"Premo e tengo premuto\"] --> B[\"Sposto il mouse\"] --> C[\"Lascio il tasto\"]" }
  ],
  quiz: [
    { q: "Per aprire un'icona sul desktop di solito si usa…", o: ["Un clic", "Un doppio clic", "La rotellina"], a: 1, e: "Il doppio clic (toc-toc) apre icone e cartelle." },
    { q: "Il clic con il tasto destro serve a…", o: ["Spegnere il computer", "Aprire un menu di scelte", "Cancellare tutto"], a: 1, e: "Il clic destro mostra le azioni possibili sull'oggetto." },
    { q: "Cosa fate se il mouse arriva al bordo del tappetino?", o: ["Lo sollevo e lo rimetto al centro", "Mi fermo", "Riavvio il computer"], a: 0, e: "Sollevando il mouse la freccia resta ferma: potete ripartire dal centro." }
  ]
},
{
  id: "tastiera", icon: "⌨️", title: "La tastiera senza paura", level: "Primi passi", minutes: 20, practice: "typing",
  goal: "Scrivere, correggere, andare a capo, usare maiuscole e simboli come la chiocciola @.",
  steps: [
    { t: "Le zone della tastiera",
      x: "- **Lettere e numeri**: al centro, come in una macchina da scrivere.\n- **Barra spaziatrice**: il tasto lungo in basso, mette lo spazio tra le parole.\n- **Invio** (↵): va a capo, oppure conferma.\n- **Backspace** (⌫, freccia verso sinistra in alto a destra): cancella la lettera *prima* del cursore.\n- **Canc**: cancella la lettera *dopo* il cursore.\n- **Frecce**: spostano il cursore senza cancellare nulla." },
    { t: "Il cursore",
      x: "Il **cursore** è la lineetta verticale che lampeggia: indica **dove apparirà** la prossima lettera.\n\nPer scrivere in un punto preciso, fate clic lì con il mouse: il cursore si sposterà.",
      tip: "Se scrivete e non appare nulla, fate prima clic dentro lo spazio bianco dove volete scrivere." },
    { t: "Maiuscole e simboli",
      x: "- Tenendo premuto **Shift** (⇧, la freccia larga verso l'alto) e premendo una lettera, si ottiene la **maiuscola**.\n- **Bloc Maiusc** scrive tutto maiuscolo: premetelo di nuovo per tornare normali.\n- Sui tasti con **due simboli**, quello in alto si ottiene con **Shift**.\n- Il simbolo in basso a destra di un tasto (come la **@**) si ottiene con **Alt Gr**.",
      d: "flowchart LR\n  S[\"Shift + a\"] --> A[\"A maiuscola\"]\n  G[\"Alt Gr + ò\"] --> C[\"@ chiocciola\"]\n  H[\"Alt Gr + à\"] --> D[\"# cancelletto\"]" },
    { t: "Le scorciatoie utili",
      x: "Le **scorciatoie** fanno risparmiare tempo. Si tiene premuto **Ctrl** e si preme una lettera:\n\n- **Ctrl + C** = copia\n- **Ctrl + V** = incolla\n- **Ctrl + Z** = annulla l'ultima azione (il tasto *salvavita*!)\n- **Ctrl + S** = salva\n- **Ctrl + +** e **Ctrl + -** = ingrandisci e rimpicciolisci il testo" }
  ],
  quiz: [
    { q: "Come si scrive la chiocciola @ sulla tastiera italiana?", o: ["Shift + 2", "Alt Gr + ò", "Ctrl + A"], a: 1, e: "Sulla tastiera italiana la @ si ottiene con Alt Gr + ò." },
    { q: "Quale tasto cancella la lettera prima del cursore?", o: ["Invio", "Backspace", "Shift"], a: 1, e: "Backspace cancella all'indietro, verso sinistra." },
    { q: "Ho sbagliato qualcosa! Quale scorciatoia annulla l'ultima azione?", o: ["Ctrl + Z", "Ctrl + P", "Alt + F4"], a: 0, e: "Ctrl + Z è il tasto salvavita: annulla l'ultima operazione." }
  ]
},
{
  id: "desktop", icon: "🪟", title: "Il desktop e le finestre", level: "Primi passi", minutes: 15, practice: "dblclick",
  goal: "Orientarsi sul desktop, aprire programmi, ridurre, ingrandire e chiudere finestre.",
  steps: [
    { t: "Il desktop",
      x: "Il **desktop** (in inglese *scrivania*) è la schermata che vediamo appena il computer è pronto.\n\n- Le **icone** sono piccoli disegni: ognuna apre un programma, un file o una cartella.\n- La **barra delle applicazioni** (di solito in basso) mostra il menu, l'orologio e i programmi aperti.\n- Il **menu** raccoglie tutti i programmi installati, divisi per categorie." },
    { t: "Le finestre",
      x: "Ogni programma si apre in una **finestra**, proprio come un foglio appoggiato sulla scrivania. Si possono avere più finestre aperte, una sopra l'altra.\n\nIn alto a destra (o a sinistra) di ogni finestra ci sono tre pulsanti:\n\n- **—** riduce: mette la finestra *in tasca* nella barra in basso;\n- **□** ingrandisce: la finestra occupa tutto lo schermo;\n- **✕** chiude la finestra.",
      d: "flowchart LR\n  R[\"— Riduci: la metto da parte\"]\n  I[\"□ Ingrandisci: tutto schermo\"]\n  X[\"✕ Chiudi: ho finito\"]" },
    { t: "Passare da una finestra all'altra",
      x: "Per tornare a una finestra ridotta, fate clic sul suo nome nella **barra delle applicazioni**.\n\nScorciatoia: tenendo premuto **Alt** e premendo **Tab** si passa da una finestra all'altra.",
      tip: "Se una finestra \"sparisce\", quasi sempre è solo ridotta nella barra in basso." }
  ],
  quiz: [
    { q: "Il pulsante ✕ in una finestra serve a…", o: ["Chiudere la finestra", "Ingrandirla", "Spegnere il computer"], a: 0, e: "La ✕ chiude la finestra (non il computer)." },
    { q: "Una finestra è sparita: dove la cerco per prima cosa?", o: ["Nel cestino", "Nella barra delle applicazioni", "Dentro la tastiera"], a: 1, e: "Probabilmente è stata ridotta: basta un clic sul suo nome nella barra." }
  ]
},
{
  id: "file", icon: "📁", title: "File e cartelle: l'armadio digitale", level: "Intermedio", minutes: 20, practice: "drag",
  goal: "Capire file e cartelle, salvare, ritrovare e usare la chiavetta USB.",
  steps: [
    { t: "L'armadio con i cassetti",
      x: "Immaginate il computer come un **grande armadio**:\n\n- le **cartelle** sono i cassetti (e dentro un cassetto possono esserci altri cassetti);\n- i **file** sono i fogli, le foto, le lettere che mettiamo nei cassetti.\n\nUn file ha un **nome** e un **tipo**: documento, foto, musica, video…",
      d: "flowchart TD\n  H[\"🏠 Cartella personale\"] --> D[\"📁 Documenti\"]\n  H --> I[\"📁 Immagini\"]\n  H --> S[\"📁 Scaricati\"]\n  D --> L[\"📄 Lettera al Comune\"]\n  I --> V[\"📁 Vacanze 2025\"]\n  V --> F[\"🖼️ Foto al mare\"]" },
    { t: "Salvare un lavoro",
      x: "Quando scrivete una lettera, il computer la tiene solo *in memoria*: se si spegne, si perde. Per conservarla bisogna **salvarla**.\n\n1. Premete **Ctrl + S** (oppure menu **File → Salva**).\n2. Scegliete **dove** metterla (ad esempio *Documenti*).\n3. Datele un **nome chiaro**, come *Lettera al Comune marzo*.\n4. Premete **Salva**.",
      tip: "Nomi chiari oggi = niente caccia al tesoro domani." },
    { t: "Ritrovare i file",
      x: "Aprite il **gestore dei file** (l'icona a forma di cartella). A sinistra trovate i cassetti principali: *Documenti, Immagini, Scaricati*.\n\nI file presi da Internet o dalla posta finiscono quasi sempre in **Scaricati**.\n\nSe non ricordate dove l'avete messo, usate la **lente di ricerca** e scrivete una parte del nome." },
    { t: "Il cestino",
      x: "Quando eliminate un file, questo non sparisce subito: va nel **cestino**, come la carta straccia.\n\nFinché non svuotate il cestino, potete **ripristinarlo**: clic destro sul file nel cestino → *Ripristina*." },
    { t: "La chiavetta USB",
      x: "La **chiavetta USB** è un cassetto portatile.\n\n1. Inseritela nella porta USB (se non entra, giratela).\n2. Si apre una finestra, oppure compare un'icona nel gestore file.\n3. **Trascinate** i file dentro per copiarli.\n4. Prima di toglierla, fate clic su **Espelli** (il triangolino ⏏): così non si rovinano i dati.",
      d: "flowchart LR\n  A[\"Inserisco la chiavetta\"] --> B[\"Copio i file trascinandoli\"] --> C[\"Premo Espelli ⏏\"] --> D[\"Tolgo la chiavetta\"]" }
  ],
  quiz: [
    { q: "Dove finiscono di solito i file scaricati da Internet?", o: ["In Scaricati", "Nel cestino", "In Musica"], a: 0, e: "La cartella Scaricati raccoglie tutto ciò che arriva da Internet." },
    { q: "Ho eliminato per sbaglio una foto. Cosa faccio?", o: ["È persa per sempre", "La cerco nel cestino e la ripristino", "Spengo il computer"], a: 1, e: "Finché il cestino non è svuotato, si può ripristinare." },
    { q: "Prima di togliere la chiavetta USB bisogna…", o: ["Premere Espelli", "Spegnere lo schermo", "Nulla"], a: 0, e: "Espelli garantisce che i dati siano stati scritti completamente." }
  ]
},
{
  id: "internet", icon: "🌐", title: "Internet e il browser", level: "Intermedio", minutes: 20,
  goal: "Capire cos'è Internet, usare il browser, fare ricerche e riconoscere i siti affidabili.",
  steps: [
    { t: "Cos'è Internet",
      x: "**Internet** è una gigantesca **rete di strade** che collega i computer di tutto il mondo. Le informazioni viaggiano come **lettere** tra un computer e l'altro.\n\nIl **Wi-Fi** è la strada senza fili che collega il nostro computer al **router** di casa (la scatolina con le lucine), che a sua volta ci porta su Internet.",
      d: "flowchart LR\n  PC[\"💻 Il mio computer\"] -- \"Wi-Fi\" --> R[\"📶 Router di casa\"] --> I((\"🌍 Internet\")) --> S[\"🏛️ Sito del Comune\"]" },
    { t: "Il browser",
      x: "Il **browser** è il programma per *navigare*: Firefox, Chromium, Chrome, Edge…\n\n- In alto c'è la **barra degli indirizzi**: qui si scrive l'indirizzo di un sito, ad esempio *www.inps.it*.\n- Le **schede** permettono di tenere aperte più pagine insieme.\n- La **freccia indietro** ← torna alla pagina precedente." },
    { t: "Cercare informazioni",
      x: "Per cercare qualcosa, scrivete le **parole chiave** nella barra in alto e premete **Invio**: il **motore di ricerca** vi mostrerà un elenco di risultati.\n\nEsempio: invece di *\"vorrei sapere a che ora apre la farmacia\"*, scrivete **farmacia orari Roma Prati**.",
      tip: "I primi risultati con la scritta \"Sponsorizzato\" o \"Annuncio\" sono pubblicità." },
    { t: "Siti affidabili: il lucchetto",
      x: "Prima di inserire dati personali controllate sempre:\n\n1. Che l'indirizzo inizi con **https://** e ci sia il **lucchetto** 🔒.\n2. Che il **nome del sito** sia scritto giusto (attenzione a *poste-italiane-verifica.com*: non è Poste!).\n3. Che non ci siano **errori di ortografia** o fretta nel messaggio.\n\nIl lucchetto dice che la strada è protetta, **non** che il sito sia onesto: controllate anche il nome." }
  ],
  quiz: [
    { q: "A cosa serve il browser?", o: ["A navigare su Internet", "A scrivere lettere di carta", "A stampare foto"], a: 0, e: "Il browser è il programma per visitare i siti web." },
    { q: "Il lucchetto 🔒 accanto all'indirizzo significa che…", o: ["Il sito è sicuramente onesto", "La comunicazione è cifrata, ma bisogna controllare anche il nome del sito", "Il sito è a pagamento"], a: 1, e: "Il lucchetto protegge la strada, non garantisce l'onestà di chi c'è dall'altra parte." }
  ]
},
{
  id: "email", icon: "✉️", title: "La posta elettronica", level: "Intermedio", minutes: 20,
  goal: "Leggere e scrivere un'email, allegare una foto e riconoscere lo spam.",
  steps: [
    { t: "L'indirizzo email",
      x: "Un indirizzo email è come l'indirizzo di casa, ma digitale. Ha sempre la **chiocciola @**:\n\n**mario.rossi@esempio.it**\n\n- prima della @ c'è il **nome della cassetta**;\n- dopo la @ c'è il **fornitore** (il *palazzo* dove si trova la cassetta).",
      d: "flowchart LR\n  N[\"mario.rossi\"] --- C((\"@\")) --- P[\"esempio.it\"]" },
    { t: "Scrivere un messaggio",
      x: "1. Premete **Scrivi** o **Nuovo messaggio**.\n2. In **A:** scrivete l'indirizzo del destinatario.\n3. In **Oggetto** scrivete di cosa parla, in poche parole.\n4. Nello spazio grande scrivete il messaggio.\n5. Premete **Invia**.",
      d: "flowchart TD\n  A[\"Scrivi\"] --> B[\"A: indirizzo\"] --> C[\"Oggetto\"] --> D[\"Testo\"] --> E[\"Invia ✈️\"]" },
    { t: "Gli allegati",
      x: "Un **allegato** è un file che viaggia insieme all'email, come una foto infilata nella busta.\n\nPer allegare: premete la **graffetta 📎**, scegliete il file e premete *Apri*.\n\n**Attenzione**: non aprite mai allegati inattesi, anche se sembrano arrivare da persone conosciute. Nel dubbio, telefonate prima." },
    { t: "Lo spam",
      x: "Lo **spam** è la posta indesiderata, come i volantini nella cassetta. Alcune email sono **truffe**: promettono premi, eredità o minacciano di bloccare il conto.\n\nNon rispondete, non cliccate i link: spostatele nella cartella **Spam** o **Posta indesiderata**." }
  ],
  quiz: [
    { q: "Quale di questi è un indirizzo email valido?", o: ["www.mario.it", "mario.rossi@esempio.it", "mario rossi esempio"], a: 1, e: "Un indirizzo email contiene sempre la chiocciola @." },
    { q: "Ricevo un allegato inatteso dal \"mio nipote\" con scritto URGENTE. Cosa faccio?", o: ["Lo apro subito", "Telefono a mio nipote per verificare", "Lo inoltro a tutti"], a: 1, e: "Verificare con una telefonata è sempre la scelta più sicura." }
  ]
},
{
  id: "password", icon: "🔐", title: "Password e sicurezza", level: "Sicurezza", minutes: 20,
  goal: "Creare password forti e facili da ricordare, e proteggere gli account.",
  steps: [
    { t: "La password è una chiave",
      x: "La **password** è la chiave di casa dei nostri account. Non la daremmo mai a uno sconosciuto, né la lasceremmo sotto lo zerbino.\n\n**Regola d'oro**: nessuna banca, ufficio postale o tecnico vi chiederà **mai** la password per telefono, SMS o email." },
    { t: "La frase segreta",
      x: "Le password corte come *mario1950* si indovinano in pochi secondi. Molto meglio una **frase segreta**: più parole a caso, facili da ricordare per voi.\n\nEsempio: **Gatto-Rosso-Mangia-7-Ciliegie**\n\n- lunga almeno **12-15 caratteri**;\n- niente date di nascita o nomi dei nipoti;\n- una **password diversa** per ogni servizio importante.",
      d: "flowchart LR\n  D[\"mario1950: debole ❌\"] --> F[\"Gatto-Rosso-Mangia-7-Ciliegie: forte ✅\"]" },
    { t: "Dove conservarle",
      x: "Ricordare tante password è difficile. Due soluzioni sicure:\n\n- un **quaderno** tenuto in casa, in un posto riservato (mai nel portafoglio);\n- un **gestore di password** (come *KeePassXC*, gratuito e libero), che le custodisce in una cassaforte digitale protetta da una sola password principale." },
    { t: "La doppia chiave",
      x: "La **verifica in due passaggi** aggiunge una seconda serratura: oltre alla password serve un **codice** che arriva sul telefono.\n\nAnche se un ladro scoprisse la password, senza il vostro telefono non entrerebbe.\n\n**Mai** comunicare quel codice a nessuno: serve solo a voi.",
      d: "flowchart LR\n  P[\"🔑 Password\"] --> V{\"Codice sul telefono\"}\n  V -- \"corretto\" --> OK[\"✅ Accesso\"]\n  V -- \"manca\" --> NO[\"⛔ Ladro bloccato\"]" }
  ],
  quiz: [
    { q: "Quale password è più sicura?", o: ["anna1948", "123456", "Pane-Nuvola-Treno-42-Rosa"], a: 2, e: "Una frase lunga con parole a caso è molto più robusta." },
    { q: "Chiama un \"operatore della banca\" e chiede il codice arrivato via SMS. Cosa faccio?", o: ["Glielo detto", "Riattacco e chiamo io la banca al numero ufficiale", "Gli do solo metà codice"], a: 1, e: "La banca non chiede mai codici o password: è una truffa." }
  ]
},
{
  id: "truffe", icon: "🛡️", title: "Riconoscere le truffe online", level: "Sicurezza", minutes: 25,
  goal: "Riconoscere phishing, SMS falsi, telefonate truffa e sapere come reagire.",
  steps: [
    { t: "Il phishing",
      x: "Il **phishing** (si legge *fìsching*, cioè *pescare*) è quando un truffatore lancia un'esca: un'email o un SMS che **sembra** arrivare da banca, Poste, corriere o INPS.\n\nL'obiettivo è farvi cliccare un link e **inserire dati**: password, numero della carta, codici." },
    { t: "I campanelli d'allarme",
      x: "Fermatevi se il messaggio:\n\n- mette **fretta** (*\"entro 24 ore o il conto verrà bloccato\"*);\n- promette **premi** o rimborsi inattesi;\n- chiede **dati personali**, codici o password;\n- contiene un **link strano** o errori di italiano;\n- arriva da un numero o un indirizzo **sconosciuto**.",
      d: "flowchart TD\n  M[\"📩 Messaggio sospetto\"] --> Q{\"Mette fretta o chiede dati?\"}\n  Q -- \"Sì\" --> S[\"🚫 Non clicco, non rispondo\"]\n  Q -- \"Non sono sicuro\" --> V[\"📞 Chiamo l'ente al numero ufficiale\"]\n  S --> E[\"🗑️ Elimino e avviso un familiare\"]" },
    { t: "La truffa del \"figlio in difficoltà\"",
      x: "Molto diffusa su WhatsApp: *\"Ciao mamma, ho cambiato numero, il telefono si è rotto, mi serve un bonifico urgente\"*.\n\n**Cosa fare**: chiamate vostro figlio o nipote al **vecchio numero** che conoscete. Fatevi dire qualcosa che solo lui può sapere. Non inviate mai soldi a un numero nuovo." },
    { t: "Le telefonate e i finti tecnici",
      x: "Nessuna azienda seria vi chiama per dire che il computer ha un virus, né vi chiede di **installare programmi** per il *controllo remoto*.\n\nSe qualcuno insiste: **riattaccate**. Siete voi a decidere, non chi chiama." },
    { t: "Se ci siete cascati",
      x: "Può succedere a chiunque, non c'è da vergognarsi. Agite **subito**:\n\n1. Chiamate la **banca** al numero ufficiale e bloccate la carta.\n2. **Cambiate** le password coinvolte.\n3. Conservate messaggi e numeri come prova.\n4. Fate **denuncia** alla Polizia Postale o ai Carabinieri.\n5. Parlatene con una persona di fiducia." }
  ],
  quiz: [
    { q: "Un SMS dice: \"Il tuo pacco è fermo, paga 1,99 € a questo link\". Non aspettate pacchi. Cosa fate?", o: ["Pago, è poco", "Lo ignoro ed elimino", "Rispondo chiedendo spiegazioni"], a: 1, e: "È un classico phishing: la piccola cifra serve a rubare i dati della carta." },
    { q: "\"Ciao papà, nuovo numero, mi fai un bonifico?\" Qual è la mossa giusta?", o: ["Faccio subito il bonifico", "Chiamo mio figlio al vecchio numero", "Invio i dati della carta"], a: 1, e: "Verificate sempre con una chiamata al numero che conoscete." },
    { q: "Qual è il campanello d'allarme più comune?", o: ["La fretta e la richiesta di dati", "Un messaggio gentile", "Un'email con il logo"], a: 0, e: "Urgenza + richiesta di dati = quasi sempre una truffa." }
  ]
},
{
  id: "smartphone", icon: "📱", title: "Smartphone, messaggi e videochiamate", level: "Intermedio", minutes: 20,
  goal: "Usare le app di messaggistica e fare una videochiamata con i propri cari.",
  steps: [
    { t: "Lo smartphone è un piccolo computer",
      x: "Lo **smartphone** funziona come un computer tascabile: invece del mouse si usa il **dito**.\n\n- **Tocco**: come il clic.\n- **Tocco prolungato**: come il clic destro, mostra le opzioni.\n- **Scorrimento**: come la rotellina.\n- **Pizzico** con due dita: ingrandisce o rimpicciolisce." },
    { t: "Le app di messaggistica",
      x: "Con app come **WhatsApp**, **Signal** o **Telegram** si inviano messaggi, foto, messaggi vocali e si fanno videochiamate gratis usando Internet.\n\n- Il **microfono** tenuto premuto registra un **messaggio vocale**.\n- La **graffetta** o il **+** servono per inviare foto e documenti.\n- Le **due spunte** indicano che il messaggio è stato consegnato." },
    { t: "Fare una videochiamata",
      x: "1. Aprite la chat della persona.\n2. Toccate l'icona della **videocamera** 📹 in alto.\n3. Aspettate che risponda: vedrete il suo volto a tutto schermo.\n4. Per terminare toccate il **pulsante rosso**.",
      d: "flowchart LR\n  A[\"Apro la chat\"] --> B[\"Tocco 📹\"] --> C[\"Parlo e mi vedo\"] --> D[\"Tocco 🔴 per chiudere\"]",
      tip: "Tenete il telefono all'altezza del viso e con la luce davanti a voi, non alle spalle." }
  ],
  quiz: [
    { q: "Sullo smartphone, il tocco prolungato corrisponde a…", o: ["Il clic destro del mouse", "Lo spegnimento", "La tastiera"], a: 0, e: "Tenendo premuto si apre un menu di opzioni." },
    { q: "Per terminare una videochiamata tocco…", o: ["Il pulsante rosso", "Il microfono", "La graffetta"], a: 0, e: "Il pulsante rosso chiude la chiamata." }
  ]
},
{
  id: "pa", icon: "🏛️", title: "Servizi pubblici digitali", level: "Avanzato", minutes: 25,
  goal: "Capire SPID, CIE, l'app IO e i pagamenti pagoPA per usare i servizi pubblici online.",
  steps: [
    { t: "L'identità digitale",
      x: "Per usare online i servizi pubblici (INPS, Agenzia delle Entrate, Fascicolo Sanitario, Comune) bisogna dimostrare **chi siamo**. È come mostrare la carta d'identità allo sportello.\n\nIn Italia si usano principalmente:\n\n- **SPID**: il Sistema Pubblico di Identità Digitale, rilasciato da diversi gestori;\n- **CIE**: la Carta d'Identità Elettronica, usata con il telefono o un lettore e il suo **PIN**.",
      d: "flowchart LR\n  U[\"👤 Io\"] --> ID{\"SPID oppure CIE\"} --> S[\"🏛️ INPS, Entrate, Sanità, Comune\"]" },
    { t: "L'app IO",
      x: "**IO** è l'app dei servizi pubblici: riceve **messaggi** dagli enti (scadenze, avvisi), permette di **pagare** avvisi pagoPA e conserva documenti digitali.\n\nSi accede con SPID o CIE." },
    { t: "Pagare con pagoPA",
      x: "Molti pagamenti verso la Pubblica Amministrazione (tasse scolastiche, multe, ticket) passano da **pagoPA**.\n\nSull'avviso di pagamento c'è un **codice** e un **QR code**: si può pagare in banca, alle Poste, in tabaccheria o online, anche dall'app IO." },
    { t: "Attenzione ai falsi",
      x: "Gli enti pubblici **non chiedono mai** le credenziali SPID o il PIN della CIE per email, SMS o telefono.\n\nPer entrare nei servizi, scrivete voi l'indirizzo ufficiale nel browser o usate l'app ufficiale: **non** cliccate link ricevuti via messaggio.",
      tip: "Se non vi sentite sicuri, fatevi accompagnare da un familiare o da uno sportello di facilitazione digitale del vostro Comune." }
  ],
  quiz: [
    { q: "A cosa servono SPID e CIE?", o: ["A dimostrare la propria identità online", "A navigare più veloci", "A telefonare gratis"], a: 0, e: "Sono le chiavi d'accesso ai servizi pubblici digitali." },
    { q: "Un'email dell'\"INPS\" chiede di confermare le credenziali SPID da un link. È…", o: ["Normale", "Una truffa: gli enti non chiedono credenziali", "Obbligatorio"], a: 1, e: "Nessun ente chiede credenziali via email: è phishing." }
  ]
},
{
  id: "ia", icon: "🤖", title: "L'intelligenza artificiale, spiegata semplice", level: "Avanzato", minutes: 20,
  goal: "Capire cos'è l'IA, cosa sa fare, dove sbaglia e come usarla con buon senso.",
  steps: [
    { t: "Un pappagallo molto istruito",
      x: "Un programma di **intelligenza artificiale** come quello che parla in questa Cattedra ha *letto* moltissimi testi e ha imparato a **prevedere le parole** che di solito vengono dopo.\n\nÈ come un pappagallo che ha ascoltato migliaia di biblioteche: parla benissimo, ma **non sempre sa se ciò che dice è vero**.",
      d: "flowchart LR\n  T[\"📚 Tanti testi\"] --> A[\"🧠 Allenamento\"] --> M[\"🤖 Modello\"]\n  D[\"❓ La vostra domanda\"] --> M --> R[\"💬 Risposta probabile\"]" },
    { t: "Cosa sa fare bene",
      x: "- Spiegare concetti con parole semplici e **metafore**.\n- Riassumere un testo lungo.\n- Aiutare a scrivere una lettera o un'email.\n- Proporre idee ed esempi." },
    { t: "Dove può sbagliare",
      x: "L'IA può inventare fatti con grande sicurezza (si chiamano *allucinazioni*).\n\n- **Verificate** sempre le informazioni importanti: salute, soldi, leggi, scadenze.\n- **Non** scrivete dati personali sensibili nei servizi online.\n\nQuesto Professore Digitale funziona **tutto sul vostro computer**: le vostre domande **non** vengono inviate su Internet." },
    { t: "IA locale e privacy",
      x: "Molti assistenti famosi lavorano *nel cloud*, cioè su computer di grandi aziende lontane. Qui invece il **modello** gira in locale grazie a **Ollama**: niente abbonamenti, niente tracciamento, funziona anche senza connessione.\n\nÈ l'idea della **tecnologia gentile**: rispetta le persone, i loro dati e l'ambiente, anche su computer ricondizionati." }
  ],
  quiz: [
    { q: "Le risposte dell'IA sono sempre corrette?", o: ["Sì, sempre", "No, vanno verificate, soprattutto su temi importanti", "Solo di domenica"], a: 1, e: "L'IA può sbagliare anche con tono sicuro: verificate sempre." },
    { q: "In questa Cattedra le domande all'IA…", o: ["Vengono inviate a un'azienda", "Restano sul computer", "Vengono pubblicate online"], a: 1, e: "Il modello gira in locale: la privacy è tutelata." }
  ]
},
{
  id: "linux", icon: "🐧", title: "Linux, software libero e riuso", level: "Avanzato", minutes: 15,
  goal: "Scoprire perché un computer vecchio può rinascere con Linux e il software libero.",
  steps: [
    { t: "Il sistema operativo",
      x: "Il **sistema operativo** è il *direttore d'orchestra* del computer: fa lavorare insieme schermo, tastiera, memoria e programmi.\n\nI più conosciuti sono Windows, macOS e **Linux**.",
      d: "flowchart TD\n  U[\"👤 Voi\"] --> P[\"Programmi: browser, posta, scrittura\"] --> SO[\"🎼 Sistema operativo\"] --> H[\"🔩 Hardware: processore, memoria, disco\"]" },
    { t: "Il software libero",
      x: "Il **software libero** si può usare, studiare, modificare e condividere liberamente. È come una **ricetta** che tutti possono leggere e migliorare.\n\nEsempi: Linux, Firefox, LibreOffice, VLC, GIMP, e anche questo Professore Digitale (codice con licenza MIT; lezioni e quiz con licenza Creative Commons BY-NC-SA 4.0)." },
    { t: "Riuso ed economia circolare",
      x: "Molti computer vengono buttati perché *\"sono lenti\"*, ma spesso il problema è il software, non l'hardware.\n\nCon una **distribuzione Linux leggera** (come Linux Mint XFCE, Q4OS, antiX o una live dedicata) un computer di 10 anni torna utile: meno rifiuti elettronici, più persone connesse.",
      d: "flowchart LR\n  V[\"💻 PC vecchio\"] --> L[\"🐧 Linux leggero\"] --> N[\"✨ PC rinato\"] --> S[\"🤝 Scuola, centro anziani, famiglia\"]" }
  ],
  quiz: [
    { q: "Cosa fa il sistema operativo?", o: ["Coordina hardware e programmi", "Solo la stampa", "Serve solo per i giochi"], a: 0, e: "È il direttore d'orchestra del computer." },
    { q: "Perché installare Linux su un PC datato?", o: ["Per renderlo più lento", "Per dargli nuova vita e ridurre i rifiuti", "Perché è obbligatorio"], a: 1, e: "Riuso = meno e-waste e più inclusione digitale." }
  ]
}
];
