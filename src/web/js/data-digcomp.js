/* ==============================================================================
 *  PROFESSORE DIGITALE - Quadro europeo delle competenze digitali DigComp 2.2
 *  Le 21 competenze nelle 5 aree (titoli italiani diffusi da AgID / Repubblica Digitale),
 *  con una spiegazione in parole semplici, e la mappa: quali lezioni, simulatori della
 *  «Vita digitale» ed esercizi della Palestra allenano ciascuna competenza.
 *  Fonte del quadro: Commissione europea, JRC, «DigComp 2.2» (2022).
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
window.PD_DIGCOMP = {
  versione: "2.2",
  aree: [
    { n: 1, icona: "🔎", titolo: "Alfabetizzazione su informazioni e dati", colore: "#1d5c8f",
      semplice: "Cercare le informazioni, capire se sono affidabili e conservarle in ordine.",
      competenze: [
        { c: "1.1", titolo: "Navigare, ricercare e filtrare dati, informazioni e contenuti digitali",
          semplice: "Saper cercare su Internet quello che serve e trovarlo, scegliendo le parole giuste." },
        { c: "1.2", titolo: "Valutare dati, informazioni e contenuti digitali",
          semplice: "Capire se una notizia o un sito sono affidabili, prima di crederci o di condividerli." },
        { c: "1.3", titolo: "Gestire dati, informazioni e contenuti digitali",
          semplice: "Salvare, mettere in ordine e ritrovare file, foto e documenti." }
      ] },
    { n: 2, icona: "💬", titolo: "Comunicazione e collaborazione", colore: "#15803d",
      semplice: "Parlare, scriversi e collaborare con gli altri; usare i servizi online da cittadini.",
      competenze: [
        { c: "2.1", titolo: "Interagire attraverso le tecnologie digitali",
          semplice: "Scrivere un messaggio o un'email, fare una videochiamata con i propri cari." },
        { c: "2.2", titolo: "Condividere informazioni attraverso le tecnologie digitali",
          semplice: "Mandare una foto, un documento o un collegamento alla persona giusta." },
        { c: "2.3", titolo: "Esercitare la cittadinanza attraverso le tecnologie digitali",
          semplice: "Usare i servizi pubblici online: Comune, sanità, pagamenti, documenti." },
        { c: "2.4", titolo: "Collaborare attraverso le tecnologie digitali",
          semplice: "Lavorare insieme ad altri a distanza: gruppi, documenti condivisi, appuntamenti." },
        { c: "2.5", titolo: "Netiquette",
          semplice: "Le buone maniere in rete: rispetto, toni gentili, niente catene e niente inoltri a caso." },
        { c: "2.6", titolo: "Gestire l'identità digitale",
          semplice: "Avere e proteggere la propria identità in rete (come lo SPID o la carta d'identità elettronica)." }
      ] },
    { n: 3, icona: "✍️", titolo: "Creazione di contenuti digitali", colore: "#7c3aed",
      semplice: "Scrivere, creare e modificare contenuti, rispettando il lavoro degli altri.",
      competenze: [
        { c: "3.1", titolo: "Sviluppare contenuti digitali",
          semplice: "Scrivere un testo al computer, fare una foto o un piccolo documento." },
        { c: "3.2", titolo: "Integrare e rielaborare contenuti digitali",
          semplice: "Copiare, incollare e modificare testi e immagini per farne qualcosa di nuovo." },
        { c: "3.3", titolo: "Copyright e licenze",
          semplice: "Sapere che foto, musica e programmi hanno un autore e delle regole d'uso (anche il software libero)." },
        { c: "3.4", titolo: "Programmazione",
          semplice: "Capire che il computer segue delle istruzioni passo passo, scritte da persone." }
      ] },
    { n: 4, icona: "🛡️", titolo: "Sicurezza", colore: "#c2410c",
      semplice: "Proteggere il computer, i propri dati, la salute e l'ambiente.",
      competenze: [
        { c: "4.1", titolo: "Proteggere i dispositivi",
          semplice: "Tenere al sicuro computer e telefono: aggiornamenti, password, attenzione a ciò che si installa." },
        { c: "4.2", titolo: "Proteggere i dati personali e la privacy",
          semplice: "Non dare a nessuno codici e dati personali, riconoscere le truffe." },
        { c: "4.3", titolo: "Proteggere la salute e il benessere",
          semplice: "Usare la tecnologia senza farsi male: pause, postura, niente ansia da notifiche." },
        { c: "4.4", titolo: "Proteggere l'ambiente",
          semplice: "Consumare meno, riusare i vecchi apparecchi e smaltirli nel modo giusto." }
      ] },
    { n: 5, icona: "🧩", titolo: "Risolvere problemi", colore: "#a16207",
      semplice: "Cavarsela quando qualcosa non va e scegliere lo strumento adatto.",
      competenze: [
        { c: "5.1", titolo: "Risolvere problemi tecnici",
          semplice: "Accendere, spegnere, usare mouse e tastiera e sapere cosa fare quando qualcosa si blocca." },
        { c: "5.2", titolo: "Individuare fabbisogni e risposte tecnologiche",
          semplice: "Capire quale programma, app o servizio serve per fare una certa cosa." },
        { c: "5.3", titolo: "Utilizzare in modo creativo le tecnologie digitali",
          semplice: "Usare il digitale per risolvere un problema in modo nuovo (anche con l'intelligenza artificiale)." },
        { c: "5.4", titolo: "Individuare i divari di competenze digitali",
          semplice: "Capire cosa si sa già, cosa manca e come continuare a imparare." }
      ] }
  ],

  /* lezioni → competenze (corso, vita quotidiana, cultura con un legame reale, FeniceOS, libro) */
  lezioni: {
    /* corso di base */
    computer: ["5.1", "5.2"],
    mouse: ["5.1"],
    tastiera: ["5.1", "3.1"],
    desktop: ["5.1", "5.2"],
    file: ["1.3", "3.1"],
    internet: ["1.1", "1.2", "4.1"],
    email: ["2.1", "2.2", "4.2"],
    password: ["4.1", "4.2", "2.6"],
    truffe: ["4.2", "1.2", "4.1"],
    smartphone: ["2.1", "2.2", "2.4", "2.5"],
    pa: ["2.3", "2.6"],
    ia: ["5.3", "1.2", "4.2"],
    linux: ["5.2", "3.3", "4.4"],
    /* il digitale nella vita quotidiana */
    "acquisti-sicuri": ["4.2", "1.2", "5.2"],
    "foto-ricordi": ["1.3", "2.2", "4.1"],
    /* cultura generale: solo dove c'è un legame reale con il digitale */
    informarsi: ["1.2", "1.1", "2.5"],
    sostenibilita: ["4.4", "5.4"],
    "mappe-orientarsi": ["1.1"],
    /* FeniceOS e riuso */
    feniceos: ["4.4", "5.2"],
    "tecnologia-gentile": ["4.3", "4.4"],
    "economia-circolare": ["4.4"],
    obsolescenza: ["4.4"],
    "vecchio-pc": ["4.4", "5.1"],
    "software-libero": ["3.3", "5.2"],
    "fenice-chiavetta": ["5.1"],
    "fenice-primi-passi": ["5.1", "5.2"],
    "fenice-programmi": ["5.2", "3.1"],
    "fenice-rinascita": ["5.1", "3.4"],
    "universo-informatico": ["5.4"],
    "insegnare-con-fenice": ["5.4", "2.4"],
    /* libro Tecnologia Gentile */
    "tg-manifesto": ["4.3", "4.4"],
    "tg-storia": ["5.4"],
    "tg-anatomia": ["5.1"],
    "tg-sistemi-operativi": ["5.1", "5.2"],
    "tg-ia-prompt": ["5.3", "3.1"],
    "tg-sicurezza": ["4.1", "4.2"],
    "tg-smartphone": ["2.1", "5.2"],
    "tg-nipoti-digitali": ["5.4", "2.4"],
    "tg-fenice-os": ["4.4", "5.2"],
    "tg-diritti-digitali": ["2.3", "4.2"],
    "tg-economia-rigenerazione": ["4.4"],
    "tg-cloud": ["1.3", "2.4"],
    "tg-igiene-digitale": ["4.3", "4.1"],
    "tg-rete-quartiere": ["2.4", "2.3"],
    "tg-attenzione": ["4.3"],
    "tg-scuola": ["5.4"],
    "tg-eco-informatica": ["4.4"],
    "tg-ia-gentile": ["5.3", "1.2"],
    "tg-futuro": ["5.4"]
  },

  /* simulatori della «Vita digitale» → competenze */
  vita: {
    identita: ["2.6", "2.3", "4.2"],
    visita: ["2.3", "1.1"],
    pagamento: ["2.3", "4.2"],
    banca: ["4.2", "4.1", "2.6"],
    messaggi: ["2.1", "2.2", "2.5"],
    posta: ["2.1", "2.2", "4.2"]
  },
  vitaNomi: {
    identita: "🪪 L'identità digitale (prova)",
    visita: "🩺 Prenotare una visita (prova)",
    pagamento: "💶 Pagare un avviso (prova)",
    banca: "🏦 La banca online (prova)",
    messaggi: "📱 Messaggi e chat (prova)",
    posta: "📧 La posta elettronica (prova)"
  },

  /* esercizi della Palestra → competenze (rinforzano, non bastano da soli) */
  palestra: {
    click: ["5.1"], dblclick: ["5.1"], drag: ["5.1", "1.3"], rightclick: ["5.1"], scroll: ["5.1", "1.1"],
    typing: ["3.1"], keys: ["5.1"], select: ["3.2"], copypaste: ["3.2"], scam: ["4.2"]
  },
  palestraNomi: {
    click: "🎯 Il clic", dblclick: "📂 Il doppio clic", drag: "✋ Trascinare", rightclick: "🖱️ Il clic destro", scroll: "🖲️ Scorrere la pagina",
    typing: "⌨️ La tastiera", keys: "⏎ I tasti speciali", select: "🖍️ Selezionare il testo", copypaste: "📋 Copia e incolla", scam: "🚩 Riconosci la truffa"
  }
};
