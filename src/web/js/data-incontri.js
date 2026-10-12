/* ==============================================================================
 *  PROFESSORE DIGITALE - «Incontri pronti» per facilitatori digitali
 *  Dodici incontri da 2 ore (pausa compresa) per gruppi di principianti e persone anziane:
 *  dal primo contatto con il computer ai servizi pubblici online e alla sicurezza.
 *  Ogni passo della scaletta può aprire una lezione, un esercizio della Palestra,
 *  un simulatore della «Vita digitale», la pagina «È una truffa?», il ripasso o un quiz.
 *  Competenze secondo il quadro europeo DigComp 2.2 (vedi data-digcomp.js).
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Contenuti CC BY-NC-SA 4.0 (© 2026 Danilo D'Auria), codice MIT
 * ============================================================================== */
window.PD_INCONTRI = [
  {
    id: "primo-contatto", n: 1, icona: "🖥️", titolo: "Piacere, computer!",
    obiettivi: ["Conoscere le parti del computer e a cosa servono", "Accendere e spegnere nel modo giusto", "Fare i primi clic senza paura"],
    digcomp: ["5.1", "5.2"], durata: 120,
    materiali: ["Un computer ogni 1-2 persone, con il Professore Digitale", "Proiettore o schermo grande (facoltativo)", "Cartellini con il nome dei partecipanti", "Fogli e penne per gli appunti"],
    scaletta: [
      { min: 15, titolo: "Accoglienza e presentazioni", cosa: "Ognuno dice il proprio nome e perché è venuto. Raccogliete le paure («Se tocco qualcosa si rompe?») e rassicurate: il computer non si rompe con un clic.", vai: null },
      { min: 25, titolo: "Com'è fatto il computer", cosa: "Lezione insieme: schermo, tastiera, mouse, la scatola che «pensa». Fate toccare le parti mentre il Professore le nomina.", vai: "#/lessons/computer" },
      { min: 20, titolo: "Il primo clic", cosa: "Esercizio dei palloncini. Lasciate provare con calma; chi finisce aiuta il vicino.", vai: "#/practice/click" },
      { min: 15, titolo: "Pausa", cosa: "Un caffè e quattro chiacchiere. Chi vuole può continuare a provare il mouse.", vai: null },
      { min: 25, titolo: "Come si impugna il mouse", cosa: "Prima parte della lezione sul mouse: impugnatura, la freccia, il clic sinistro. Ripetete il gesto più volte.", vai: "#/lessons/mouse" },
      { min: 20, titolo: "Spegnere bene e salutarsi", cosa: "Mostrate come si spegne il computer dal menu (mai staccando la spina). Consegnate la scheda per gli allievi con il compito.", vai: null }
    ],
    compito: "A casa (o in biblioteca) guardate un computer e provate a nominare le sue parti: schermo, tastiera, mouse. Se potete, accendetelo e spegnetelo dal menu.",
    consigli: "Il primo incontro serve soprattutto a togliere la paura. Andate piano, lodate ogni progresso e non usate parole inglesi senza spiegarle. Annotate chi non ha un computer a casa: potrà allenarsi in sede."
  },
  {
    id: "mouse", n: 2, icona: "🖱️", titolo: "Il mouse senza paura",
    obiettivi: ["Fare clic, doppio clic e clic destro", "Trascinare un oggetto", "Usare la rotellina per scorrere"],
    digcomp: ["5.1", "1.3"], durata: 120,
    materiali: ["Un computer per persona, con mouse (meglio non il tappetino del portatile)", "Tappetini per il mouse", "Scheda per gli allievi dell'incontro precedente"],
    scaletta: [
      { min: 10, titolo: "Accoglienza e ripasso", cosa: "Chi ricorda le parti del computer? Chi è riuscito a fare il compito?", vai: null },
      { min: 20, titolo: "La lezione sul mouse", cosa: "Clic, doppio clic, clic destro, trascinare, rotellina: un gesto alla volta, guardando lo schermo grande.", vai: "#/lessons/mouse" },
      { min: 15, titolo: "Il doppio clic", cosa: "Esercizio delle cartelle: «toc-toc», veloce e senza muovere il mouse.", vai: "#/practice/dblclick" },
      { min: 15, titolo: "Trascinare", cosa: "Esercizio dei fogli da portare nella cartella: tenere premuto, spostare, lasciare.", vai: "#/practice/drag" },
      { min: 15, titolo: "Pausa", cosa: "Fate muovere polsi e spalle: anche questo è benessere digitale.", vai: null },
      { min: 15, titolo: "Il clic destro", cosa: "Esercizio del menu con il tasto destro: si apre, si sceglie, si chiude con Esc.", vai: "#/practice/rightclick" },
      { min: 15, titolo: "La rotellina", cosa: "Esercizio delle stelle nascoste: scorrere su e giù.", vai: "#/practice/scroll" },
      { min: 15, titolo: "Gioco finale e compito", cosa: "Memory digitale a coppie, poi il compito per casa.", vai: "#/practice/memory" }
    ],
    compito: "Allenatevi 10 minuti al giorno con un esercizio della Palestra, quello che vi è sembrato più difficile.",
    consigli: "Il doppio clic è il gesto più difficile per chi ha la mano poco ferma: rassicurate e mostrate che si può aprire anche con clic destro → Apri. Per chi ha difficoltà, nelle Impostazioni si possono ingrandire i caratteri."
  },
  {
    id: "tastiera", n: 3, icona: "⌨️", titolo: "La tastiera e la scrittura",
    obiettivi: ["Scrivere parole e frasi, con maiuscole e accenti", "Correggere con Cancella e Backspace", "Selezionare, copiare e incollare un testo"],
    digcomp: ["3.1", "3.2", "5.1"], durata: 120,
    materiali: ["Un computer per persona", "Tastiera stampata in grande (si può stampare la lezione)", "Un breve testo da ricopiare (una ricetta o una poesia)"],
    scaletta: [
      { min: 10, titolo: "Accoglienza e ripasso del mouse", cosa: "Un giro veloce: clic, doppio clic, trascinare.", vai: null },
      { min: 25, titolo: "La tastiera senza paura", cosa: "Le zone della tastiera, il cursore, maiuscole, la chiocciola @.", vai: "#/lessons/tastiera" },
      { min: 20, titolo: "Scrivere le parole", cosa: "Esercizio di scrittura: dalle parole facili alla chiocciola.", vai: "#/practice/typing" },
      { min: 15, titolo: "Pausa", cosa: null, vai: null },
      { min: 15, titolo: "I tasti speciali", cosa: "Invio, Spazio, Cancella, frecce, Esc: trovarli senza guardare troppo.", vai: "#/practice/keys" },
      { min: 15, titolo: "Selezionare il testo", cosa: "Doppio clic su una parola, triplo clic su una riga.", vai: "#/practice/select" },
      { min: 15, titolo: "Copia e incolla", cosa: "Ctrl + C e Ctrl + V: copiare una frase e incollarla altrove.", vai: "#/practice/copypaste" },
      { min: 5, titolo: "Compito e saluti", cosa: "Consegnate la scheda per gli allievi.", vai: null }
    ],
    compito: "Scrivete al computer la lista della spesa o una ricetta che conoscete bene, con le maiuscole al punto giusto.",
    consigli: "Fate scrivere cose che appartengono alla vita dei partecipanti (nomi dei nipoti, ricette, il proprio paese): si impara prima. Gli accenti (à, è, ù) sono tasti a parte: mostrateli bene."
  },
  {
    id: "desktop-file", n: 4, icona: "🗂️", titolo: "Finestre, file e cartelle",
    obiettivi: ["Aprire, ridurre, ingrandire e chiudere una finestra", "Capire file e cartelle come un armadio con i cassetti", "Salvare un lavoro e ritrovarlo"],
    digcomp: ["1.3", "5.1", "5.2"], durata: 120,
    materiali: ["Un computer per persona", "Una chiavetta USB di prova (facoltativa)", "Un vero raccoglitore con cartelline, per l'esempio"],
    scaletta: [
      { min: 10, titolo: "Accoglienza e ripasso", cosa: "Chi ha scritto la lista della spesa? Leggiamone una insieme.", vai: null },
      { min: 25, titolo: "Il desktop e le finestre", cosa: "Lezione: icone, barra, i tre pulsanti della finestra (riduci, ingrandisci, chiudi).", vai: "#/lessons/desktop" },
      { min: 25, titolo: "L'armadio digitale", cosa: "Lezione su file e cartelle: salvare, ritrovare, il cestino, la chiavetta.", vai: "#/lessons/file" },
      { min: 15, titolo: "Pausa", cosa: null, vai: null },
      { min: 20, titolo: "Mettere in ordine", cosa: "Esercizio del trascinamento: i fogli nella cartella giusta. Poi, sul computer vero, create insieme la cartella «Corso».", vai: "#/practice/drag" },
      { min: 15, titolo: "Ritrovare un file", cosa: "Ognuno salva un testo nella cartella «Corso» e poi lo ritrova. Chi non lo trova chiede al vicino.", vai: null },
      { min: 10, titolo: "Compito e saluti", cosa: "Consegnate la scheda per gli allievi.", vai: null }
    ],
    compito: "Create una cartella con il vostro nome e salvateci dentro un testo di prova. Chiudete tutto e provate a ritrovarlo.",
    consigli: "La metafora dell'armadio con i cassetti funziona molto bene: tenetela per tutto il corso. Avvisate che il cestino si può svuotare, ma che prima conviene guardarci dentro."
  },
  {
    id: "internet", n: 5, icona: "🌐", titolo: "Internet: cercare e capire",
    obiettivi: ["Capire cos'è Internet e cos'è il browser", "Fare una ricerca con le parole giuste", "Riconoscere un sito affidabile e una notizia falsa"],
    digcomp: ["1.1", "1.2", "2.5"], durata: 120,
    materiali: ["Computer collegati a Internet (se possibile)", "Proiettore", "Due o tre notizie di giornale, una vera e una palesemente falsa, per la discussione"],
    scaletta: [
      { min: 10, titolo: "Accoglienza e ripasso", cosa: "Cartelle e file: chi ha ritrovato il proprio testo?", vai: null },
      { min: 25, titolo: "Internet e il browser", cosa: "Lezione: cos'è Internet, la barra degli indirizzi, cercare, il lucchetto.", vai: "#/lessons/internet" },
      { min: 15, titolo: "Scorrere una pagina", cosa: "Esercizio della rotellina: utile per leggere le pagine lunghe.", vai: "#/practice/scroll" },
      { min: 15, titolo: "Pausa", cosa: null, vai: null },
      { min: 25, titolo: "Informarsi bene", cosa: "Lezione sulle notizie false: le domande da farsi prima di credere e di condividere.", vai: "#/lessons/informarsi" },
      { min: 20, titolo: "Ricerca guidata", cosa: "Se c'è Internet: ognuno cerca l'orario della farmacia o della biblioteca del paese. Altrimenti fate domande al Professore.", vai: "#/ask" },
      { min: 10, titolo: "Compito e saluti", cosa: "Consegnate la scheda per gli allievi.", vai: null }
    ],
    compito: "Cercate su Internet una cosa che vi interessa davvero (una ricetta, un orario, una località) e notate se il sito ha il lucchetto.",
    consigli: "Se in sede non c'è Internet, il Professore Digitale funziona comunque: usate la guida «Chiedi al Professore» per simulare la ricerca. Non mostrate siti di notizie reali con nomi di persone private."
  },
  {
    id: "posta", n: 6, icona: "📧", titolo: "La posta elettronica",
    obiettivi: ["Capire com'è fatto un indirizzo email", "Leggere, scrivere e rispondere a un messaggio", "Riconoscere lo spam e non aprire allegati sospetti"],
    digcomp: ["2.1", "2.2", "4.2"], durata: 120,
    materiali: ["Un computer per persona", "Indirizzi email dei partecipanti, se li hanno (mai le password: le scrivono loro)", "Una busta e una lettera vera, per il paragone"],
    scaletta: [
      { min: 10, titolo: "Accoglienza e ripasso", cosa: "Che cosa avete cercato su Internet?", vai: null },
      { min: 25, titolo: "La posta elettronica", cosa: "Lezione: l'indirizzo con la chiocciola, scrivere, allegare, lo spam.", vai: "#/lessons/email" },
      { min: 25, titolo: "Prova con la posta finta", cosa: "Simulatore: leggere, rispondere e scoprire il messaggio truffa. Niente è reale.", vai: "#/vita/posta" },
      { min: 15, titolo: "Pausa", cosa: null, vai: null },
      { min: 20, titolo: "Scrivere bene", cosa: "Esercizio di scrittura con la chiocciola, poi ognuno scrive (sul foglio o nel simulatore) un'email a un parente.", vai: "#/practice/typing" },
      { min: 15, titolo: "Spam e allegati", cosa: "Riconosci la truffa: messaggi veri o falsi? Commentate insieme i campanelli d'allarme.", vai: "#/practice/scam" },
      { min: 10, titolo: "Compito e saluti", cosa: "Consegnate la scheda per gli allievi.", vai: null }
    ],
    compito: "Se avete un indirizzo email, mandate un messaggio a un familiare. Altrimenti chiedete a un familiare di aiutarvi a crearne uno, con calma.",
    consigli: "Non create indirizzi email per i partecipanti in sede senza il loro consenso e senza che siano loro a scegliere e conservare la password. Ricordate che nessuna banca o ufficio chiede codici per email."
  },
  {
    id: "smartphone", n: 7, icona: "📱", titolo: "Smartphone, messaggi e foto",
    obiettivi: ["Mandare un messaggio, una foto o un vocale", "Fare una videochiamata", "Mettere al sicuro le foto con la regola 3-2-1"],
    digcomp: ["2.1", "2.2", "2.5", "1.3"], durata: 120,
    materiali: ["Gli smartphone dei partecipanti (carichi)", "Un computer per persona o per coppia", "Un cavo USB per il telefono (facoltativo)"],
    scaletta: [
      { min: 10, titolo: "Accoglienza e ripasso", cosa: "Chi ha mandato la sua prima email?", vai: null },
      { min: 25, titolo: "Smartphone, messaggi e videochiamate", cosa: "Lezione: le app di messaggistica, i gruppi, la videochiamata.", vai: "#/lessons/smartphone" },
      { min: 20, titolo: "Prova con la chat finta", cosa: "Simulatore dei messaggi: scrivere, mandare una foto, riconoscere il messaggio sospetto. Le buone maniere nei gruppi.", vai: "#/vita/messaggi" },
      { min: 15, titolo: "Pausa", cosa: "Chi vuole fa una videochiamata vera a un familiare (con il suo consenso).", vai: null },
      { min: 30, titolo: "Foto e ricordi al sicuro", cosa: "Lezione: dove stanno le foto, portarle sul computer, la regola 3-2-1.", vai: "#/lessons/foto-ricordi" },
      { min: 20, titolo: "Domande, compito e saluti", cosa: "Rispondete alle domande sui telefoni di ciascuno (con prudenza: non toccate le impostazioni di sicurezza altrui).", vai: null }
    ],
    compito: "Fate una videochiamata a un familiare o a un amico, oppure mandategli una foto con una frase gentile.",
    consigli: "I telefoni sono tutti diversi: lavorate per coppie con chi ha lo stesso tipo. Chiedete sempre il permesso prima di prendere in mano il telefono di qualcuno e non leggete i messaggi privati."
  },
  {
    id: "password", n: 8, icona: "🔑", titolo: "Password e account sicuri",
    obiettivi: ["Creare una password forte e facile da ricordare", "Sapere dove (non) conservarla", "Capire la «doppia chiave» (verifica in due passaggi)"],
    digcomp: ["4.1", "4.2", "2.6"], durata: 120,
    materiali: ["Un computer per persona", "Un quadernetto da tenere a casa per le password, in un posto sicuro", "Dadi (facoltativi) per inventare frasi segrete"],
    scaletta: [
      { min: 10, titolo: "Accoglienza e ripasso", cosa: "Videochiamate e foto: com'è andata?", vai: null },
      { min: 30, titolo: "La password è una chiave", cosa: "Lezione: la frase segreta, dove conservarla, la doppia chiave.", vai: "#/lessons/password" },
      { min: 20, titolo: "Inventiamo una frase segreta", cosa: "Ognuno inventa una frase (che NON dice ad alta voce) e la trasforma in password. Esercitatevi a scriverla.", vai: "#/practice/typing" },
      { min: 15, titolo: "Pausa", cosa: null, vai: null },
      { min: 25, titolo: "La banca online, per finta", cosa: "Simulatore della banca: entrare con codice e conferma sul telefono, riconoscere la richiesta falsa.", vai: "#/vita/banca" },
      { min: 10, titolo: "Ripasso con il quiz", cosa: "Le domande sbagliate nelle lezioni tornano qui, finché non sono chiare.", vai: "#/ripasso" },
      { min: 10, titolo: "Compito e saluti", cosa: "Consegnate la scheda per gli allievi.", vai: null }
    ],
    compito: "Controllate le vostre password: ce n'è una troppo semplice (data di nascita, nome del cane)? Cambiatela con una frase segreta, con l'aiuto di una persona di fiducia.",
    consigli: "Non chiedete mai le password dei partecipanti e non guardate mentre le scrivono: è il primo esempio di buona pratica. Ricordate a tutti che nessuno, nemmeno il facilitatore, deve conoscerle."
  },
  {
    id: "truffe", n: 9, icona: "🕵️", titolo: "Riconoscere le truffe",
    obiettivi: ["Riconoscere phishing, SMS falsi e telefonate truffa", "Conoscere i campanelli d'allarme", "Sapere cosa fare se si è cascati"],
    digcomp: ["4.2", "1.2", "4.1"], durata: 120,
    materiali: ["Un computer per persona", "Esempi stampati di messaggi truffa (senza nomi di persone reali)", "Il cartello dei campanelli d'allarme stampato dalla lezione"],
    scaletta: [
      { min: 10, titolo: "Accoglienza e racconti", cosa: "Qualcuno ha ricevuto messaggi strani? Raccontare aiuta tutti (senza vergogna).", vai: null },
      { min: 25, titolo: "Riconoscere le truffe online", cosa: "Lezione: phishing, «figlio in difficoltà», finti tecnici, cosa fare dopo.", vai: "#/lessons/truffe" },
      { min: 25, titolo: "È una truffa?", cosa: "Esaminate insieme i messaggi: vero o falso? Ognuno spiega quale indizio ha visto.", vai: "#/truffa" },
      { min: 15, titolo: "Pausa", cosa: null, vai: null },
      { min: 20, titolo: "Allenare l'occhio", cosa: "Esercizio «Riconosci la truffa» della Palestra, a coppie.", vai: "#/practice/scam" },
      { min: 15, titolo: "Cosa fare se…", cosa: "Ripassate i passi: fermarsi, non dare codici, chiamare la banca dal numero sul retro della carta, parlarne con qualcuno di fiducia, denunciare.", vai: null },
      { min: 10, titolo: "Compito e saluti", cosa: "Consegnate la scheda per gli allievi.", vai: null }
    ],
    compito: "Raccontate a un amico o a un familiare i tre campanelli d'allarme che ricordate: fretta, richiesta di codici, mittente strano.",
    consigli: "Argomento delicato: chi è stato truffato può provare vergogna. Sottolineate che capita a tutti, anche ai giovani. Non date numeri di telefono a memoria: indicate di usare sempre quelli scritti sui documenti ufficiali o sulla carta."
  },
  {
    id: "servizi-pubblici", n: 10, icona: "🏛️", titolo: "Identità digitale e servizi pubblici",
    obiettivi: ["Capire a cosa servono SPID, CIE e l'app IO", "Entrare in un servizio pubblico con l'identità digitale (per finta)", "Prenotare una visita online (per finta)"],
    digcomp: ["2.3", "2.6", "4.2"], durata: 120,
    materiali: ["Un computer per persona", "Per chi ce l'ha: la carta d'identità elettronica (non serve usarla)", "Elenco degli sportelli del Comune per l'identità digitale (preparato dal facilitatore)"],
    scaletta: [
      { min: 10, titolo: "Accoglienza e ripasso", cosa: "Le truffe: chi ricorda i campanelli d'allarme?", vai: null },
      { min: 25, titolo: "Servizi pubblici digitali", cosa: "Lezione: identità digitale, app IO, pagamenti verso la pubblica amministrazione, attenzione ai falsi.", vai: "#/lessons/pa" },
      { min: 25, titolo: "L'identità digitale, per finta", cosa: "Simulatore dell'identità digitale: nome utente, password, conferma sul telefono. Niente è reale.", vai: "#/vita/identita" },
      { min: 15, titolo: "Pausa", cosa: null, vai: null },
      { min: 30, titolo: "Prenotare una visita, per finta", cosa: "Simulatore della prenotazione: scegliere la prestazione, il giorno, leggere il promemoria.", vai: "#/vita/visita" },
      { min: 15, titolo: "Domande, compito e saluti", cosa: "Spiegate dove si chiede l'identità digitale nel vostro territorio (dati preparati da voi).", vai: null }
    ],
    compito: "Informatevi (in Comune, in farmacia o con un familiare) su come ottenere l'identità digitale, se ancora non l'avete.",
    consigli: "Non attivate identità digitali per conto dei partecipanti e non fatevi dare credenziali: accompagnate, non sostituite. Preparate prima le informazioni locali aggiornate (orari e sportelli cambiano)."
  },
  {
    id: "pagamenti", n: 11, icona: "💶", titolo: "Pagamenti, banca e acquisti online",
    obiettivi: ["Pagare un avviso della pubblica amministrazione (per finta)", "Usare la banca online con prudenza", "Comprare online in modo sicuro"],
    digcomp: ["2.3", "4.2", "4.1", "5.2"], durata: 120,
    materiali: ["Un computer per persona", "Un avviso di pagamento di esempio (inventato)", "Mai carte di credito vere"],
    scaletta: [
      { min: 10, titolo: "Accoglienza e ripasso", cosa: "Identità digitale: com'è andata la ricerca dello sportello?", vai: null },
      { min: 25, titolo: "Pagare un avviso, per finta", cosa: "Simulatore del pagamento: il codice dell'avviso, l'importo, la ricevuta.", vai: "#/vita/pagamento" },
      { min: 20, titolo: "La banca online, per finta", cosa: "Simulatore della banca: controllare il saldo, riconoscere l'avviso falso.", vai: "#/vita/banca" },
      { min: 15, titolo: "Pausa", cosa: null, vai: null },
      { min: 30, titolo: "Acquisti online sicuri", cosa: "Lezione: scegliere il negozio, pagare in modo protetto, dopo l'acquisto.", vai: "#/lessons/acquisti-sicuri" },
      { min: 10, titolo: "Allenare l'occhio", cosa: "Qualche messaggio dalla pagina «È una truffa?» sui finti pacchi e finti rimborsi.", vai: "#/truffa" },
      { min: 10, titolo: "Compito e saluti", cosa: "Consegnate la scheda per gli allievi.", vai: null }
    ],
    compito: "Guardate un sito di un negozio che conoscete: trovate il lucchetto, i contatti e le condizioni di reso. Non comprate nulla se non siete sicuri.",
    consigli: "Argomento delicato: non toccate mai i soldi veri dei partecipanti, non fate pagamenti per loro e non chiedete dati della carta. Nei simulatori tutto è finto: ripetetelo spesso."
  },
  {
    id: "ia-ripasso", n: 12, icona: "🎓", titolo: "Intelligenza artificiale, ripasso e attestato",
    obiettivi: ["Capire cos'è l'intelligenza artificiale e dove può sbagliare", "Ripassare tutto il percorso", "Ottenere l'attestato del corso"],
    digcomp: ["5.3", "1.2", "5.4"], durata: 120,
    materiali: ["Un computer per persona", "Stampante per gli attestati (facoltativa)", "Qualcosa per festeggiare!"],
    scaletta: [
      { min: 10, titolo: "Accoglienza", cosa: "Che cosa vi è piaciuto di più del corso? Che cosa vi ha fatto più paura all'inizio?", vai: null },
      { min: 25, titolo: "L'intelligenza artificiale, spiegata semplice", cosa: "Lezione: il pappagallo molto istruito, cosa sa fare, dove sbaglia, la privacy.", vai: "#/lessons/ia" },
      { min: 15, titolo: "Chiedi al Professore", cosa: "Ognuno fa una domanda al Professore e controlla insieme agli altri se la risposta è sensata.", vai: "#/ask" },
      { min: 15, titolo: "Pausa", cosa: null, vai: null },
      { min: 15, titolo: "Ripasso", cosa: "Le domande più difficili tornano per un ultimo ripasso.", vai: "#/ripasso" },
      { min: 25, titolo: "Il Quiz del Corso", cosa: "Il quiz finale, con calma. Chi lo supera stampa il proprio attestato.", vai: "#/quiz/corso" },
      { min: 15, titolo: "Le mie competenze e saluti", cosa: "Ognuno guarda (e stampa) le proprie competenze digitali europee raggiunte. Consegna degli attestati e foto di gruppo (con il consenso di tutti).", vai: "#/competenze" }
    ],
    compito: "Continuate ad allenarvi: una lezione o un esercizio a settimana. E insegnate una cosa che avete imparato a qualcun altro!",
    consigli: "Chiudete con una festa: è un traguardo importante. Raccogliete un breve parere dei partecipanti per il resoconto dell'ente. Chi non supera il quiz può ripeterlo: non è un esame."
  }
];
