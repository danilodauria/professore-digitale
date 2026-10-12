/* ==============================================================================
 *  PROFESSORE DIGITALE - «Ginnastica per la mente»: giochi di parole
 *  Cruciverba (generato da un dizionario incorporato, uguale per tutta la giornata),
 *  Indovina la frase, Parole mescolate, Completa il proverbio, Parole a catena.
 *  Si registrano nel framework di mente.js con PD.mente.registra(gioco): se il framework
 *  non c'e', questo file non fa nulla. Tutto offline: nessun dato esce dal computer.
 *  JavaScript puro (ES5). Ideato e sviluppato da Danilo D'Auria - Licenza MIT
 * ============================================================================== */
(function () {
  "use strict";
  var PD = window.PD;
  if (!PD || !PD.mente || typeof PD.mente.registra !== "function") return;
  var esc = PD.esc;

  /* ================================================================== DIZIONARIO
   * «PAROLA|definizione»: parole maiuscole senza accenti e senza apostrofi (3-12 lettere; nella griglia al massimo 10),
   * definizioni facili. Il nome del gruppo serve come aiuto in «Parole mescolate». */
  var DIZ_GRUPPI = {
    "La casa": [
      "CASA|Dove si abita con la famiglia", "TETTO|Copre la casa e la ripara dalla pioggia",
      "PORTA|Si apre per entrare in una stanza", "FINESTRA|Si apre per far entrare aria e luce",
      "SCALA|Ha i gradini per salire al piano di sopra", "CUCINA|La stanza dove si preparano i pasti",
      "SALOTTO|La stanza con il divano dove si ricevono gli ospiti", "BAGNO|La stanza con il lavandino e la vasca",
      "LETTO|Ci si dorme la notte", "DIVANO|Sedile imbottito per due o tre persone",
      "SEDIA|Ha quattro gambe e lo schienale, ma non cammina", "TAVOLO|Mobile su cui si apparecchia per mangiare",
      "ARMADIO|Mobile dove si appendono i vestiti", "CASSETTO|Si apre tirandolo verso di sé, dentro un mobile",
      "CUSCINO|Ci si appoggia la testa per dormire", "COPERTA|Tiene al caldo nel letto d'inverno",
      "TAPPETO|Copre il pavimento ed è spesso decorato", "SPECCHIO|Riflette la nostra immagine",
      "BALCONE|Sporge dalla facciata: ci si mettono i vasi di fiori", "GIARDINO|Spazio verde intorno alla casa",
      "CANTINA|Locale sotto casa dove si tiene il vino", "SOFFITTA|Locale sotto il tetto, pieno di vecchie cose",
      "CHIAVE|Serve per aprire la serratura", "CAMINO|Ci si accende il fuoco d'inverno",
      "LAMPADA|Fa luce sul comodino o sulla scrivania", "TENDA|Si tira davanti alla finestra",
      "MURO|Parete fatta di mattoni", "CORTILE|Spazio aperto dentro il palazzo",
      "CAMPANELLO|Si suona per farsi aprire", "PAVIMENTO|Ci si cammina sopra in casa",
      "COMODINO|Piccolo mobile accanto al letto", "SCOPA|Serve per spazzare il pavimento",
      "TERRAZZO|Grande balcone dove si stende il bucato", "CORRIDOIO|Passaggio lungo che collega le stanze",
      "RUBINETTO|Si apre per far scorrere l'acqua", "VASCA|Ci si fa il bagno con la schiuma"
    ],
    "In cucina": [
      "PANE|Si compra fresco dal fornaio", "PASTA|Spaghetti, penne o fusilli",
      "SUGO|Condimento di pomodoro per la pasta", "OLIO|Quello extravergine si fa con le olive",
      "SALE|Si mette nell'acqua della pasta quando bolle", "PEPE|Spezia nera che pizzica",
      "ACETO|Si usa con l'olio per condire l'insalata", "FARINA|Polvere bianca per fare pane e dolci",
      "UOVO|Lo depone la gallina", "LATTE|Bevanda bianca della colazione",
      "BURRO|Si spalma sul pane e si fa con la panna", "FORMAGGIO|Parmigiano, pecorino o gorgonzola",
      "PIZZA|Margherita o capricciosa, cotta nel forno a legna", "RISOTTO|Piatto di riso cotto piano piano con il brodo",
      "BRODO|Acqua bollita con carne o verdure, ottima d'inverno", "MINESTRA|Piatto caldo di verdure da mangiare con il cucchiaio",
      "PENTOLA|Recipiente alto per cuocere la pasta", "PADELLA|Ci si frigge l'uovo",
      "FORNO|Ci si cuociono torte e arrosti", "TEGAME|Recipiente basso con due manici",
      "PIATTO|Ci si serve il cibo in tavola", "BICCHIERE|Ci si versa l'acqua per bere",
      "FORCHETTA|Posata con i rebbi", "COLTELLO|Posata che taglia",
      "CUCCHIAIO|Posata per il brodo", "TOVAGLIA|Si stende sul tavolo prima di apparecchiare",
      "MOKA|Caffettiera italiana da mettere sul fuoco", "ZUCCHERO|Rende dolce il caffè",
      "TORTA|Dolce delle feste di compleanno", "BISCOTTO|Si inzuppa nel latte a colazione",
      "GELATO|Dolce freddo in coppetta o nel cono", "MIELE|Lo producono le api",
      "MARMELLATA|Si spalma sulle fette biscottate", "POLENTA|Si fa con la farina di mais",
      "LASAGNE|Sfoglie di pasta al forno con ragù e besciamella", "CENA|Il pasto della sera",
      "PRANZO|Il pasto di mezzogiorno", "MERENDA|Lo spuntino del pomeriggio",
      "RICETTA|Spiega come preparare un piatto", "GREMBIULE|Si indossa per non sporcarsi ai fornelli",
      "TAGLIERE|Asse di legno su cui si taglia il pane", "MESTOLO|Grande cucchiaio per girare il sugo",
      "ARROSTO|Carne cotta al forno la domenica", "FRITTATA|Si fa con le uova sbattute in padella",
      "CROSTATA|Torta di pasta frolla con la marmellata", "PANETTONE|Dolce milanese di Natale con l'uvetta"
    ],
    "Frutta e verdura": [
      "MELA|Frutto rosso o verde: una al giorno toglie il medico di torno", "PERA|Frutto dolce a forma di goccia",
      "UVA|Si raccoglie con la vendemmia", "ARANCIA|Agrume ricco di vitamina C",
      "LIMONE|Agrume giallo e aspro", "BANANA|Frutto giallo e lungo da sbucciare",
      "FRAGOLA|Piccolo frutto rosso di primavera", "CILIEGIA|Frutto rosso con il nocciolo: una tira l'altra",
      "PESCA|Frutto estivo dalla buccia vellutata", "ALBICOCCA|Frutto arancione con il nocciolo",
      "ANGURIA|Grande frutto estivo, rosso dentro e verde fuori", "MELONE|Si mangia con il prosciutto",
      "FICO|Frutto dolce di fine estate", "NOCE|Frutto secco con il guscio duro",
      "CASTAGNA|Si arrostisce in autunno", "POMODORO|Rosso e succoso, serve per il sugo",
      "CAROTA|Ortaggio arancione che piace ai conigli", "PATATA|Tubero buono fritto o al forno",
      "CIPOLLA|Fa lacrimare quando si taglia", "AGLIO|Ha gli spicchi e un odore forte",
      "INSALATA|Lattuga condita con olio e aceto", "ZUCCHINA|Ortaggio verde e lungo dell'estate",
      "MELANZANA|Ortaggio viola: con lei si fa la parmigiana", "PEPERONE|Ortaggio rosso, giallo o verde",
      "FAGIOLI|Legumi borlotti o cannellini", "PISELLI|Piccoli legumi verdi nel baccello",
      "CARCIOFO|Ortaggio con le foglie spinose, buono alla romana", "SEDANO|Ortaggio a coste per il soffritto",
      "BASILICO|Erba profumata del pesto", "PREZZEMOLO|Erba aromatica che sta bene dappertutto",
      "CAVOLO|Ortaggio d'inverno a palla, verde o viola", "SPINACI|Verdura a foglie che rendeva forte Braccio di Ferro",
      "LENTICCHIE|Legumi che si mangiano a Capodanno", "OLIVA|Piccolo frutto da cui si ricava l'olio",
      "ZUCCA|Grande ortaggio arancione d'autunno", "MANDARINO|Piccolo agrume dolce dell'inverno",
      "KIWI|Frutto peloso fuori e verde dentro", "LAMPONE|Piccolo frutto rosso del bosco",
      "NOCCIOLA|Frutto secco del Piemonte, ottimo nel cioccolato", "MANDORLA|Frutto secco dei confetti"
    ],
    "La natura": [
      "SOLE|La stella che ci riscalda", "LUNA|Brilla di notte e cambia forma ogni settimana",
      "STELLA|Brilla in cielo la notte", "CIELO|È azzurro nelle belle giornate",
      "NUVOLA|Bianca e soffice, quando è grigia porta la pioggia", "PIOGGIA|Acqua che cade dal cielo",
      "NEVE|Fiocchi bianchi d'inverno", "VENTO|Aria che si muove e fa volare gli aquiloni",
      "MARE|Grande distesa d'acqua salata", "ONDA|Il mare la porta sulla spiaggia",
      "SPIAGGIA|Distesa di sabbia vicino al mare", "SABBIA|Ci giocano i bambini con paletta e secchiello",
      "FIUME|Corso d'acqua che sfocia nel mare", "LAGO|Specchio d'acqua circondato dalla terra, come il Garda",
      "MONTAGNA|Si scala fino alla vetta", "COLLINA|Rilievo più basso della montagna",
      "BOSCO|Luogo con tanti alberi", "ALBERO|Ha tronco, rami e foglie",
      "FOGLIA|Cade dagli alberi in autunno", "FIORE|Rosa, margherita o tulipano",
      "ROSA|Fiore profumato con le spine", "PRATO|Distesa d'erba verde",
      "ERBA|Verde, cresce nel prato", "SASSO|Piccola pietra",
      "ISOLA|Terra circondata dal mare", "VULCANO|Montagna che sputa fuoco, come l'Etna",
      "ARCOBALENO|Ha sette colori e appare dopo la pioggia", "TRAMONTO|Quando il sole scende la sera",
      "ALBA|Il sorgere del sole", "RUGIADA|Goccioline sull'erba al mattino",
      "NEBBIA|Rende difficile vedere lontano, tipica della pianura padana", "QUERCIA|Albero robusto che fa le ghiande",
      "PINO|Albero sempreverde con le pigne", "GIRASOLE|Fiore giallo che segue il sole",
      "VIOLA|Piccolo fiore profumato di primavera", "MARGHERITA|Fiore bianco con il centro giallo",
      "TULIPANO|Fiore tipico dell'Olanda", "GELSOMINO|Piccolo fiore bianco molto profumato",
      "CASCATA|Acqua che salta giù dalle rocce", "TEMPORALE|Pioggia forte con tuoni e lampi"
    ],
    "Gli animali": [
      "CANE|Il migliore amico dell'uomo", "GATTO|Fa le fusa e miagola",
      "CAVALLO|Nitrisce e galoppa", "MUCCA|Ci dà il latte",
      "PECORA|Ci dà la lana", "CAPRA|Ama arrampicarsi sulle rocce",
      "MAIALE|Animale della fattoria che grufola nel fango", "GALLINA|Depone le uova",
      "GALLO|Canta al mattino: chicchirichì", "ASINO|Raglia ed è un po' testardo",
      "CONIGLIO|Ha le orecchie lunghe e mangia carote", "TOPO|Piccolo roditore goloso di formaggio",
      "LEONE|Il re della foresta", "TIGRE|Grande felino con le strisce",
      "ELEFANTE|Ha la proboscide", "GIRAFFA|Ha il collo lunghissimo",
      "ORSO|Va in letargo d'inverno", "LUPO|Ulula alla luna",
      "VOLPE|Furba, con la coda folta", "CERVO|Ha grandi corna ramificate",
      "SCOIATTOLO|Vive sugli alberi e raccoglie nocciole", "RONDINE|Uccello che annuncia la primavera",
      "PASSERO|Piccolo uccello dei tetti di città", "AQUILA|Rapace che vola altissimo",
      "GUFO|Uccello notturno con grandi occhi", "CIVETTA|Piccolo rapace notturno",
      "PAPPAGALLO|Uccello colorato che ripete le parole", "DELFINO|Mammifero del mare molto intelligente",
      "BALENA|Il più grande animale del mare", "PESCE|Nuota e respira con le branchie",
      "TARTARUGA|Si porta la casa sulla schiena", "LUMACA|Lenta, con il guscio a spirale",
      "FARFALLA|Insetto con le ali colorate", "APE|Insetto che produce il miele",
      "FORMICA|Piccolo insetto che lavora tutta l'estate", "COCCINELLA|Insetto rosso a puntini neri, porta fortuna",
      "CICALA|Canta nelle giornate d'estate", "GRILLO|Canta nei prati di notte",
      "ANATRA|Fa qua qua nello stagno", "OCA|Uccello bianco della fattoria che dà il nome a un gioco con i dadi",
      "CIGNO|Elegante uccello bianco dei laghi", "PULCINO|Il piccolo della gallina",
      "CAMMELLO|Ha le gobbe e vive nel deserto", "ZEBRA|Cavallo a strisce bianche e nere",
      "PINGUINO|Uccello che non vola, simbolo di Linux", "CANARINO|Uccellino giallo che canta in gabbia",
      "RICCIO|Piccolo animale coperto di aculei", "SCIMMIA|Animale agile che si arrampica sugli alberi"
    ],
    "Città italiane": [
      "ROMA|La capitale d'Italia", "MILANO|La città del Duomo e del teatro alla Scala",
      "NAPOLI|La città del Vesuvio e della pizza", "TORINO|La città della Mole Antonelliana",
      "FIRENZE|La città di Dante e del Ponte Vecchio", "VENEZIA|La città dei canali e delle gondole",
      "BOLOGNA|La dotta e la grassa, città dei portici", "GENOVA|La città della Lanterna e del pesto",
      "PALERMO|Il capoluogo della Sicilia", "BARI|Capoluogo della Puglia, città di San Nicola",
      "VERONA|La città di Romeo e Giulietta", "PISA|La città della torre pendente",
      "SIENA|La città del Palio in piazza del Campo", "PERUGIA|Capoluogo dell'Umbria, famosa per il cioccolato",
      "ASSISI|La città di San Francesco", "TRIESTE|Città di mare con piazza Unità d'Italia",
      "CAGLIARI|Il capoluogo della Sardegna", "ANCONA|Il capoluogo delle Marche",
      "AOSTA|Capoluogo della regione più piccola d'Italia", "TRENTO|Il capoluogo del Trentino",
      "PARMA|Città famosa per il prosciutto e il formaggio", "MODENA|La città dell'aceto balsamico",
      "LECCE|La Firenze del Sud, città del barocco", "MATERA|La città dei Sassi",
      "COMO|Città lombarda sul lago caro al Manzoni", "BERGAMO|Città lombarda con la Città Alta",
      "PADOVA|La città di Sant'Antonio", "RAVENNA|La città dei mosaici",
      "CATANIA|Città siciliana ai piedi dell'Etna", "SALERNO|Città campana vicina alla costiera amalfitana",
      "POTENZA|Il capoluogo della Basilicata", "CAMPOBASSO|Il capoluogo del Molise",
      "ITALIA|Il nostro Paese, a forma di stivale", "PESCARA|Città di mare in Abruzzo, patria di D'Annunzio",
      "MANTOVA|Città dei Gonzaga, circondata dai laghi", "AREZZO|Città toscana della Giostra del Saracino"
    ],
    "I mestieri": [
      "FORNAIO|Fa il pane all'alba", "CUOCO|Lavora ai fornelli del ristorante",
      "MEDICO|Ci visita quando non stiamo bene", "MAESTRO|Insegna ai bambini delle elementari",
      "POSTINO|Porta le lettere a casa", "SARTO|Cuce e aggiusta i vestiti",
      "FALEGNAME|Lavora il legno", "IDRAULICO|Ripara i tubi e i rubinetti",
      "MURATORE|Costruisce muri con mattoni e cemento", "CONTADINO|Coltiva i campi",
      "PESCATORE|Va in mare con la barca e le reti", "BARBIERE|Taglia barba e capelli: ce n'è uno famoso a Siviglia",
      "FARMACISTA|Ci consegna le medicine al banco", "INFERMIERE|Aiuta il medico e assiste i malati",
      "PITTORE|Dipinge quadri", "MUSICISTA|Suona uno strumento",
      "CANTANTE|Fa musica con la voce", "ATTORE|Recita al cinema o a teatro",
      "PILOTA|Guida l'aereo", "AUTISTA|Guida l'autobus",
      "VIGILE|Dirige il traffico all'incrocio", "POMPIERE|Spegne gli incendi",
      "MACELLAIO|Vende la carne", "OROLOGIAIO|Ripara gli orologi",
      "CALZOLAIO|Ripara le scarpe", "GELATAIO|Prepara coni e coppette",
      "FIORAIO|Vende mazzi di fiori", "EDICOLANTE|Vende giornali e riviste",
      "ARCHITETTO|Progetta case e palazzi", "GIUDICE|Pronuncia la sentenza in tribunale",
      "AVVOCATO|Difende i suoi clienti in tribunale", "NOTAIO|Ci si va per firmare l'atto di acquisto della casa",
      "DENTISTA|Cura i denti", "PASTORE|Porta al pascolo le pecore",
      "APICOLTORE|Alleva le api", "VASAIO|Modella vasi di argilla",
      "MECCANICO|Ripara le automobili", "SCRITTORE|Scrive romanzi e racconti",
      "GIORNALISTA|Scrive le notizie sul giornale", "BIDELLO|Apre e custodisce la scuola"
    ],
    "Gli oggetti": [
      "OROLOGIO|Segna le ore", "OCCHIALI|Aiutano a leggere meglio",
      "OMBRELLO|Ripara dalla pioggia", "BORSA|Ci si mettono portafoglio e chiavi",
      "VALIGIA|Si prepara prima di partire", "FORBICI|Servono per tagliare la carta",
      "AGO|Ha la cruna e serve per cucire", "FILO|Si infila nella cruna dell'ago",
      "BOTTONE|Si cuce sulla camicia", "MATITA|Si usa per scrivere e si cancella con la gomma",
      "PENNA|Si scrive con l'inchiostro", "GOMMA|Cancella i segni della matita",
      "QUADERNO|Ha le pagine a righe o a quadretti", "LIBRO|Ha la copertina e tante pagine da leggere",
      "GIORNALE|Si legge al mattino per sapere le notizie", "LETTERA|Si scrive a mano e si spedisce in una busta",
      "BUSTA|Ci si mette la lettera da spedire", "CANDELA|Fa luce con una fiammella",
      "FIAMMIFERO|Si sfrega per accendere il fuoco", "SCATOLA|Contenitore di cartone",
      "CESTINO|Ci si buttano le carte", "SECCHIO|Contenitore per l'acqua con il manico",
      "VASO|Contiene i fiori", "PETTINE|Serve per pettinare i capelli",
      "SAPONE|Si usa per lavarsi le mani", "SPAZZOLINO|Si usa per lavarsi i denti",
      "BICICLETTA|Ha due ruote e i pedali", "ANELLO|Si porta al dito, simbolo del matrimonio",
      "COLLANA|Si porta al collo", "MARTELLO|Serve per piantare i chiodi",
      "CHIODO|Si pianta con il martello", "CACCIAVITE|Serve per avvitare le viti",
      "CARTOLINA|Si spedisce dalle vacanze con un saluto", "TAZZA|Ci si beve il tè o il latte",
      "BARATTOLO|Contenitore di vetro per la marmellata", "PORTAFOGLIO|Ci si tengono i documenti e i soldi",
      "BASTONE|Aiuta a camminare in montagna", "VENTAGLIO|Si agita per farsi fresco d'estate",
      "CESTO|Contenitore di vimini per il picnic", "SVEGLIA|Suona al mattino per farci alzare"
    ],
    "Tecnologia gentile": [
      "TELEFONO|Serve per chiamare parenti e amici", "CELLULARE|Telefono senza fili da portare in tasca",
      "COMPUTER|Si accende per scrivere, navigare e giocare", "MOUSE|Si muove sul tavolo per spostare la freccia sullo schermo",
      "TASTIERA|Ha i tasti con tutte le lettere", "SCHERMO|Mostra immagini e scritte",
      "STAMPANTE|Mette su carta ciò che vediamo sul computer", "INTERNET|La grande rete che collega i computer del mondo",
      "EMAIL|Lettera elettronica che arriva in un attimo", "CHIOCCIOLA|Il simbolo degli indirizzi di posta elettronica",
      "PASSWORD|Parola segreta per entrare, da non dire a nessuno", "CLIC|Si fa premendo il tasto del mouse",
      "FILE|Documento salvato nel computer", "CARTELLA|Contiene i documenti, come un raccoglitore",
      "ICONA|Piccola immagine da cliccare sullo schermo", "BATTERIA|Va ricaricata quando è scarica",
      "RADIO|Si ascolta per sentire musica e notizie", "TELEVISORE|Si accende per vedere i programmi",
      "FOTO|Si scatta per ricordare un bel momento", "VIDEO|Filmato da guardare sullo schermo",
      "MESSAGGIO|Si scrive e si invia con il telefono", "SITO|Pagina che si visita su Internet",
      "LINUX|Sistema operativo libero con il pinguino", "CAVO|Filo elettrico per collegare due apparecchi",
      "PRESA|Ci si infila la spina della corrente", "SPINA|Si infila nella presa della corrente",
      "LAMPADINA|Si avvita e fa luce", "ANTENNA|Sta sul tetto e riceve il segnale della televisione",
      "VIRUS|Programma dannoso da tenere lontano dal computer", "PROGRAMMA|Applicazione che fa un lavoro nel computer",
      "TABLET|Schermo piatto da toccare con le dita, più grande del telefono", "CHIAVETTA|Piccola memoria da infilare nella porta USB",
      "APP|Piccolo programma da installare sul telefono", "CUFFIE|Si mettono sulle orecchie per ascoltare senza disturbare",
      "MICROFONO|Raccoglie la voce", "ROBOT|Macchina che fa dei lavori da sola",
      "SALVATAGGIO|Si fa per non perdere il lavoro fatto", "CALCOLATRICE|Fa i conti al posto nostro"
    ],
    "I vestiti": [
      "CAMICIA|Ha il colletto e i bottoni", "GIACCA|Si indossa sopra la camicia",
      "CAPPOTTO|Si mette d'inverno sopra tutto", "MAGLIONE|Si fa con la lana e tiene caldo",
      "SCIARPA|Si avvolge al collo d'inverno", "GUANTI|Scaldano le mani",
      "CAPPELLO|Si mette in testa", "CRAVATTA|Si annoda al collo della camicia",
      "GONNA|Indumento femminile che scende dalla vita", "PANTALONI|Hanno due gambe e si tengono con la cintura",
      "CINTURA|Tiene su i pantaloni", "SCARPE|Si allacciano ai piedi",
      "CALZE|Si mettono ai piedi prima delle scarpe", "STIVALI|Scarpe alte per la pioggia e la neve",
      "PANTOFOLE|Scarpe comode da casa", "PIGIAMA|Si indossa per dormire",
      "VESTAGLIA|Si indossa sopra il pigiama", "TASCA|Ci si mettono le mani o le chiavi",
      "COLLETTO|Parte della camicia attorno al collo", "MANICA|Parte del vestito che copre il braccio",
      "LANA|Viene dalle pecore e si usa per i maglioni", "COTONE|Tessuto fresco che viene da una pianta",
      "SETA|Tessuto prezioso prodotto dai bachi", "BERRETTO|Cappello di lana d'inverno",
      "COSTUME|Si indossa per fare il bagno al mare", "GILET|Giacca senza maniche",
      "SANDALI|Scarpe aperte per l'estate", "IMPERMEABILE|Soprabito che non fa passare la pioggia"
    ],
    "Il tempo e le feste": [
      "GENNAIO|Il primo mese dell'anno", "FEBBRAIO|Il mese più corto",
      "MARZO|Il mese in cui arriva la primavera", "APRILE|Il mese del pesce burlone",
      "MAGGIO|Il mese delle rose", "GIUGNO|Il mese in cui comincia l'estate",
      "LUGLIO|Mese di piena estate", "AGOSTO|Il mese delle ferie e di Ferragosto",
      "SETTEMBRE|Il mese della vendemmia e del ritorno a scuola", "OTTOBRE|Il decimo mese dell'anno",
      "NOVEMBRE|Il mese dell'estate di San Martino", "DICEMBRE|Il mese di Natale",
      "SABATO|Il giorno prima della domenica", "DOMENICA|Il giorno di festa della settimana",
      "ESTATE|La stagione più calda", "INVERNO|La stagione più fredda",
      "AUTUNNO|La stagione delle foglie che cadono", "PRIMAVERA|La stagione dei fiori",
      "MATTINA|Parte del giorno subito dopo l'alba", "SERA|Parte del giorno dopo il tramonto",
      "NOTTE|Si dorme e si vedono le stelle", "GIORNO|Dura ventiquattro ore",
      "SETTIMANA|Ha sette giorni", "MESE|Dura circa trenta giorni",
      "ANNO|Ha dodici mesi", "ORA|Ha sessanta minuti",
      "MINUTO|Ha sessanta secondi", "SECONDO|La sessantesima parte del minuto",
      "NATALE|La festa del 25 dicembre", "PASQUA|Festa di primavera con le uova di cioccolato",
      "CAPODANNO|Si festeggia il primo gennaio", "BEFANA|Riempie le calze il 6 gennaio",
      "CARNEVALE|La festa delle maschere e dei coriandoli", "COMPLEANNO|Si festeggia con la torta e le candeline",
      "FERRAGOSTO|La festa di mezza estate, il 15 agosto", "VACANZA|Periodo di riposo lontano dal lavoro"
    ],
    "Sport e giochi": [
      "CALCIO|Sport con il pallone e due porte", "PALLONE|Si prende a calci sul campo",
      "TENNIS|Si gioca con racchetta e palline", "NUOTO|Sport che si fa in piscina",
      "CORSA|Si fa con le scarpe da ginnastica", "CICLISMO|Lo sport del Giro d'Italia",
      "BOCCE|Gioco con le palle da avvicinare al pallino", "CARTE|Scopa e briscola si giocano con queste",
      "BRISCOLA|Gioco di carte in cui un seme comanda", "TOMBOLA|Si gioca a Natale con le cartelle e i numeri",
      "DAMA|Si gioca con pedine bianche e nere", "SCACCHI|Gioco con re, regina, alfieri e torri",
      "DADO|Ha sei facce con i puntini", "ALTALENA|Gioco del parco che va avanti e indietro",
      "BAMBOLA|Giocattolo a forma di bimba", "TROTTOLA|Giocattolo che gira su se stesso",
      "AQUILONE|Si fa volare con il vento", "PALESTRA|Ci si allena con gli attrezzi",
      "SCI|Si usano per scendere sulla neve", "STADIO|Ci si gioca la partita davanti al pubblico",
      "ARBITRO|Fischia i falli in partita", "SQUADRA|Gruppo di giocatori che giocano insieme",
      "PORTIERE|Para i tiri in porta", "GOL|Si segna mandando il pallone in rete",
      "MEDAGLIA|Si vince alle Olimpiadi", "COPPA|Trofeo per chi vince il torneo",
      "BALLO|Valzer, tango o liscio", "CRUCIVERBA|Gioco di parole con caselle bianche e nere",
      "GARA|Competizione per vedere chi arriva primo", "RACCHETTA|Si usa per colpire la pallina",
      "BIGLIARDO|Si gioca con le stecche e le palle colorate", "PALLAVOLO|Sport con la rete alta in mezzo al campo"
    ],
    "Musica e spettacolo": [
      "CHITARRA|Strumento a sei corde", "PIANOFORTE|Strumento con tasti bianchi e neri",
      "VIOLINO|Strumento ad arco che si appoggia sotto il mento", "TAMBURO|Si suona battendo con le bacchette",
      "TROMBA|Strumento a fiato squillante", "FLAUTO|Strumento a fiato con tanti forellini",
      "CANZONE|Si canta con parole e musica", "CORO|Gruppo di persone che cantano insieme",
      "OPERA|Spettacolo cantato, come la Traviata", "TEATRO|Ci si va per vedere uno spettacolo dal vivo",
      "CINEMA|Si vede il film sul grande schermo", "FILM|Si guarda al cinema",
      "QUADRO|Dipinto da appendere al muro", "MUSEO|Conserva opere d'arte da visitare",
      "STATUA|Scultura di marmo o di bronzo", "POESIA|Componimento in versi",
      "ROMANZO|Libro che racconta una lunga storia", "FAVOLA|Racconto per bambini con una morale",
      "NOTA|Do, re, mi, fa, sol, la o si", "FESTIVAL|Quello di Sanremo è dedicato alla canzone",
      "ORCHESTRA|Tanti musicisti guidati da un direttore", "BALLERINA|Danza sulle punte",
      "ARMONICA|Piccolo strumento a bocca", "PALCO|Ci salgono gli artisti per lo spettacolo",
      "APPLAUSO|Si fa battendo le mani alla fine dello spettacolo", "MELODIA|La parte di una canzone che si fischietta"
    ],
    "Paese e città": [
      "PIAZZA|Il centro del paese, spesso con la fontana", "CHIESA|Ha il campanile",
      "CAMPANILE|Torre con le campane", "FONTANA|Getta acqua in piazza",
      "MERCATO|Ci si comprano frutta e verdura dalle bancarelle", "NEGOZIO|Ci si fanno gli acquisti",
      "FARMACIA|Ci si comprano le medicine", "BANCA|Custodisce i risparmi",
      "POSTA|Ufficio dove si spediscono lettere e pacchi", "SCUOLA|Ci vanno i bambini a imparare",
      "OSPEDALE|Ci lavorano medici e infermieri", "STAZIONE|Ci si prende il treno",
      "TRENO|Viaggia sui binari", "AUTOBUS|Mezzo pubblico con le fermate",
      "TRAM|Mezzo pubblico che corre sulle rotaie in città", "AEREO|Vola tra le nuvole",
      "NAVE|Grande imbarcazione che attraversa il mare", "BARCA|Piccola imbarcazione a remi o a vela",
      "PORTO|Ci attraccano le navi", "PONTE|Si costruisce per attraversare il fiume",
      "STRADA|Ci passano le automobili", "SEMAFORO|Ha tre luci: rosso, giallo e verde",
      "PARCO|Giardino pubblico con le panchine", "PANCHINA|Ci si siede al parco",
      "BAR|Ci si beve il caffè al banco", "EDICOLA|Chiosco dove si comprano i giornali",
      "BIBLIOTECA|Ci si prendono i libri in prestito", "MUNICIPIO|La sede del Comune",
      "SINDACO|Guida il Comune", "CASTELLO|Ha torri e mura: ci vivevano re e principi",
      "TORRE|Costruzione alta e stretta", "PAESE|Piccolo centro abitato",
      "CAMPAGNA|Fuori città, tra campi e cascine", "AUTOMOBILE|Ha quattro ruote e un motore",
      "VIAGGIO|Si fa per visitare posti nuovi", "ROTONDA|Incrocio dove le auto girano in tondo"
    ],
    "Il corpo": [
      "TESTA|Ci stanno i capelli", "OCCHIO|Serve per vedere",
      "NASO|Serve per sentire i profumi", "BOCCA|Serve per mangiare e parlare",
      "ORECCHIO|Serve per sentire i suoni", "MANO|Ha cinque dita",
      "DITO|Ne abbiamo cinque per mano", "PIEDE|Ci si mette la scarpa",
      "GAMBA|Serve per camminare", "BRACCIO|Va dalla spalla alla mano",
      "SPALLA|Ci si appoggia lo zaino", "CUORE|Batte nel petto ed è simbolo dell'amore",
      "SORRISO|Si fa quando si è contenti", "CAPELLI|Si pettinano e si tagliano dal parrucchiere",
      "DENTE|Si lava con lo spazzolino", "LINGUA|Sente i sapori",
      "GOMITO|Si piega a metà del braccio", "GINOCCHIO|Si piega a metà della gamba",
      "VOCE|Si usa per parlare e cantare", "MEMORIA|Si allena con la ginnastica per la mente"
    ],
    "Famiglia e parole belle": [
      "NONNO|Il papà del papà o della mamma", "NONNA|La mamma della mamma o del papà",
      "NIPOTE|Il figlio del figlio", "MAMMA|Una delle prime parole dei bambini",
      "FRATELLO|Figlio degli stessi genitori", "SORELLA|Figlia degli stessi genitori",
      "ZIO|Il fratello del papà o della mamma", "CUGINO|Il figlio dello zio",
      "FAMIGLIA|Genitori, figli e nonni tutti insieme", "AMICO|Persona a cui si vuole bene e di cui ci si fida",
      "SPOSI|Si scambiano gli anelli il giorno delle nozze", "FESTA|Si fa con amici, musica e dolci",
      "REGALO|Si scarta il giorno del compleanno", "AMORE|Il sentimento di chi si vuole bene",
      "GIOIA|Grande felicità", "PACE|Il contrario della guerra",
      "SALUTE|Si augura con un brindisi", "GRAZIE|Si dice per ringraziare",
      "CIAO|Saluto tra amici", "PAROLA|Insieme di lettere che ha un significato",
      "STORIA|Si racconta ai bambini, ed è anche una materia di scuola", "ALFABETO|Va dalla A alla Z",
      "NUMERO|Si usa per contare", "PAZIENZA|È la virtù dei forti",
      "SOGNO|Lo si fa dormendo", "ABBRACCIO|Si dà stringendo qualcuno tra le braccia",
      "RICORDO|Una cosa del passato che teniamo nella mente", "SPERANZA|Fiducia che le cose andranno bene"
    ]
  };

  /* Parole in piu' (senza definizione) accettate in «Parole a catena» */
  var PAROLE_IN_PIU = ("ACQUA ADESSO AFFETTO AGENDA AIUTO ALA ALLEGRIA ALTO AMACA AMICA ANATRA ANGOLO ANIMA ANTICO APERTO ARANCIONE " +
    "ARGENTO ARIA ARMA ARTE ASCIUGAMANO ASSE ATTESA AULA AVVENTURA AZZURRO BACIO BAGAGLIO BALENO BAMBINO BANCO BANDIERA " +
    "BARBA BASE BASSO BAULE BECCO BELLO BENE BIANCO BIRRA BOTTEGA BOTTIGLIA BRACCIALE BRAVO BREVE BRINDISI BUCATO BUIO BUONO " +
    "CACAO CALDO CALMA CAMERA CAMINETTO CAMPO CANALE CANE CANTO CAPO CARA CARNE CARO CARRO CARTA CASCINA CATENA CAVOLFIORE CENTRO " +
    "CERA CERCHIO CHIARO CIMA CINQUE CITOFONO COLORE COMODO CONTO CORDA CORPO CORTO COSA COSTA CREMA CROCE CUOCA CURA " +
    "DANZA DATO DECORO DESTRA DIARIO DIECI DIPINTO DISCO DOCCIA DOLCE DONO DOPO DORO DOTTORE DUE DUOMO " +
    "ECCO EDERA ELICA ENTRATA EROE ESEMPIO FAMA FARO FATA FATICA FAVORE FEBBRE FELICE FERRO FETTA FIABA FIGLIO FILA FINE " +
    "FIOCCO FOGLIO FONDO FORTE FORTUNA FRESCO FRUTTA FUMO FUNGO FUOCO GALLERIA GATTA GELO GENTE GHIACCIO GIALLO GIOCO GIRO GIUSTO " +
    "GOCCIA GOLA GRANDE GRANO GRATO GRIGIO GUSTO IDEA ISOLATO LAMPO LAVORO LEGNO LENTO LEZIONE LIBERO LIBRERIA LIMONATA LINEA " +
    "LUCE LUNGO MACCHINA MADRE MAGIA MAGRO MALE MANTELLO MAPPA MARITO MATTONE MAZZO MEDIO MENTA METRO MEZZO MODA MOGLIE MOLLA " +
    "MONDO MONETA MOTO MUSICA NASTRO NATURA NERO NIDO NODO NOME NONO NOTIZIA NUOVO OCCHIATA OMBRA ONORE ORARIO ORO ORTO OSTERIA " +
    "PADRE PAGINA PAGLIA PALAZZO PALLA PANCA PANINO PANNA PARETE PARTE PASSO PASTO PATTO PELO PENSIERO PERLA PESO PETALO PIANO " +
    "PIANTA PICCOLO PIENO PIETRA PIUMA POLLO POMERIGGIO PONTILE PORTONE POSTO POZZO PRIMO PROFUMO PUNTO QUADRATO QUIETE " +
    "RAGAZZO RAMO RANA RE REGINA RETE RIDERE RISO RIVA RONDA ROSSO RUOTA SACCO SALA SALAME SALSA SALTO SANO SAPORE SCARPA " +
    "SCIROPPO SEDE SEGNO SEME SENTIERO SERENO SETE SIGNORA SIGNORE SILENZIO SOFFIO SOLDO SOLE SONNO SORTE SPAZIO SPESA SPIGA " +
    "SPORT SQUILLO STAGIONE STANZA STRADINA SUCCO SUONO TACCO TAPPO TARDI TAVOLA TELA TEMPO TERRA TESORO TETTO TIMONE TINTA " +
    "TONDO TOPOLINO TORO TORTELLINI TRAMA TRENTA TRE TROTA TUBO TUONO UCCELLO UFFICIO ULIVO UNO UOMO VALLE VELA VELOCE VERDE " +
    "VERO VESTITO VETRO VIA VICINO VIGNA VINO VITA VOLO VOLTO ZAINO ZAMPA ZERO ZUPPA").split(" ");

  /* ================================================================== FRASI
   * «tipo|testo|spiegazione|parola che manca|tre parole sbagliate» (le ultime due solo per i proverbi
   * usati anche in «Completa il proverbio»). Tipi: P proverbio, M modo di dire, C titolo di canzone
   * italiana (solo il titolo), F film, R frase celebre. */
  var TIPI = { P: "Proverbio", M: "Modo di dire", C: "Titolo di una canzone italiana", F: "Titolo di un film", R: "Frase celebre" };
  var FRASI_TXT = [
    "P|Chi dorme non piglia pesci|Chi resta con le mani in mano non ottiene niente: bisogna darsi da fare.|pesci|treni,funghi,mosche",
    "P|Chi va piano va sano e va lontano|Fare le cose con calma e attenzione porta più lontano che correre.|lontano|forte,presto,dritto",
    "P|Tra il dire e il fare c'è di mezzo il mare|Promettere è facile, mantenere è un'altra cosa.|mare|monte,fiume,ponte",
    "P|L'abito non fa il monaco|Non si giudica una persona dal vestito o dall'aspetto.|monaco|sarto,signore,cuoco",
    "P|Meglio un uovo oggi che una gallina domani|Meglio poco ma sicuro adesso, che tanto ma incerto più avanti.|gallina|frittata,torta,mucca",
    "P|Chi trova un amico trova un tesoro|Un vero amico vale più di ogni ricchezza.|tesoro|lavoro,regalo,castello",
    "P|Rosso di sera, bel tempo si spera|Il cielo rosso al tramonto annuncia di solito una bella giornata.|sera|mattina,notte,maggio",
    "P|Natale con i tuoi, Pasqua con chi vuoi|Natale si passa in famiglia; a Pasqua si è più liberi.|Pasqua|Capodanno,Ferragosto,Carnevale",
    "P|Aprile, dolce dormire|In primavera, con le giornate più tiepide, viene voglia di dormire.|dormire|mangiare,cantare,partire",
    "P|Chi semina vento raccoglie tempesta|Chi crea discordia prima o poi riceve guai ancora più grandi.|tempesta|pioggia,grano,nuvole",
    "P|Il mattino ha l'oro in bocca|Le prime ore del giorno sono le migliori per lavorare.|oro|pane,sole,miele",
    "P|Can che abbaia non morde|Chi minaccia tanto a parole spesso poi non fa nulla.|morde|dorme,corre,mangia",
    "P|A caval donato non si guarda in bocca|I regali si accettano con gratitudine, senza criticarli.|bocca|coda,sella,zampa",
    "P|Chi fa da sé fa per tre|Chi si arrangia da solo spesso fa meglio e prima.|tre|due,cento,dieci",
    "P|Una mela al giorno toglie il medico di torno|Mangiare frutta ogni giorno aiuta a stare bene.|medico|vicino,sindaco,postino",
    "P|Ride bene chi ride ultimo|Non bisogna rallegrarsi troppo presto: conta come va a finire.|ultimo|primo,forte,sempre",
    "P|Il buongiorno si vede dal mattino|Da come comincia una cosa si capisce già come andrà.|mattino|tramonto,balcone,caffè",
    "P|Paese che vai, usanza che trovi|Ogni luogo ha le sue abitudini, ed è bello rispettarle.|usanza|amico,strada,piazza",
    "P|L'appetito vien mangiando|Più si fa una cosa, più viene voglia di farla.|mangiando|dormendo,cucinando,camminando",
    "P|Chi la dura la vince|Con la costanza e la pazienza si arriva al risultato.|vince|perde,trova,mangia",
    "P|Volere è potere|Con la forza di volontà si ottengono grandi cose.|potere|sapere,avere,dovere",
    "P|Non tutte le ciambelle riescono col buco|Non sempre le cose vengono come si vorrebbe, e va bene così.|buco|zucchero,miele,nodo",
    "P|Ogni promessa è debito|Quello che si promette va mantenuto.|debito|regalo,segreto,favore",
    "P|Il tempo è denaro|Il tempo è prezioso e non va sprecato.|denaro|pane,vento,poesia",
    "P|Chi tace acconsente|Chi non dice di no sembra d'accordo.|acconsente|dimentica,sbaglia,ascolta",
    "P|Sbagliando s'impara|Gli errori sono un modo per imparare: non bisogna averne paura.|impara|cresce,ride,canta",
    "P|L'unione fa la forza|Insieme si è più forti che da soli.|forza|festa,pace,fretta",
    "P|Moglie e buoi dei paesi tuoi|Meglio scegliere persone e cose che si conoscono bene.|buoi|cavalli,galline,vicini",
    "P|Quando il gatto non c'è, i topi ballano|Quando manca chi controlla, ognuno fa quel che vuole.|ballano|dormono,cantano,mangiano",
    "P|Gallina vecchia fa buon brodo|Le persone con esperienza hanno un grande valore.|brodo|uovo,pane,sugo",
    "P|Non c'è rosa senza spine|Ogni cosa bella porta con sé anche qualche difficoltà.|spine|foglie,profumo,petali",
    "P|Chi ben comincia è a metà dell'opera|Un buon inizio è già mezzo lavoro fatto.|metà|fine,porta,festa",
    "P|Il lupo perde il pelo ma non il vizio|Le cattive abitudini sono difficili da perdere.|vizio|dente,passo,sonno",
    "P|Chi cerca trova|Chi si impegna a cercare, alla fine trova quello che vuole.|trova|perde,dorme,aspetta",
    "P|Occhio non vede, cuore non duole|Quello che non si sa non fa soffrire.|duole|batte,canta,ride",
    "P|Batti il ferro finché è caldo|Bisogna approfittare del momento giusto.|ferro|tamburo,tappeto,chiodo",
    "P|Tanto va la gatta al lardo che ci lascia lo zampino|A forza di correre lo stesso rischio, prima o poi si viene scoperti.|zampino|codino,cappello,gomitolo",
    "P|Chi si accontenta gode|Chi sa essere contento di quello che ha vive più sereno.|gode|dorme,parla,corre",
    "P|Anno nuovo, vita nuova|Con l'anno nuovo si cominciano buone abitudini.|vita|casa,scarpa,strada",
    "P|Meglio tardi che mai|Meglio fare una cosa in ritardo che non farla per niente.|mai|presto,domani,sempre",
    "P|Chi ha tempo non aspetti tempo|Non bisogna rimandare quello che si può fare subito.",
    "P|Una rondine non fa primavera|Un solo segnale non basta per trarre conclusioni.|primavera|estate,nido,festa",
    "P|Non si può avere la botte piena e la moglie ubriaca|Non si possono avere due vantaggi che si escludono a vicenda.",
    "P|Il riso fa buon sangue|Ridere fa bene alla salute e all'umore.|sangue|brodo,pane,viso",
    "P|Chi non risica non rosica|Chi non rischia un po' non ottiene niente.",
    "P|Acqua passata non macina più|Il passato è passato: non vale la pena tormentarsi.|macina|bagna,scorre,disseta",
    "P|Dimmi con chi vai e ti dirò chi sei|Una persona si riconosce dagli amici che frequenta.",
    "P|Fidarsi è bene, non fidarsi è meglio|La prudenza non è mai troppa: vale anche per i messaggi strani al telefono!|meglio|peggio,giusto,facile",
    "P|Le bugie hanno le gambe corte|Le bugie vengono scoperte presto.|gambe|braccia,ali,orecchie",
    "P|A buon intenditor poche parole|A chi è sveglio basta poco per capire.|parole|domande,righe,carte",
    "P|L'erba del vicino è sempre più verde|Quello che hanno gli altri ci sembra sempre migliore del nostro.|vicino|giardino,parco,nonno",
    "P|Chi rompe paga e i cocci sono suoi|Chi fa un danno deve ripararlo.|cocci|piatti,soldi,vetri",
    "P|Ogni lasciata è persa|Le occasioni che si lasciano andare non tornano.",
    "P|Lontano dagli occhi, lontano dal cuore|Quando si sta lontani, a poco a poco ci si pensa meno.|cuore|mare,naso,paese",
    "P|Impara l'arte e mettila da parte|Saper fare un mestiere torna sempre utile, prima o poi.|arte|lezione,ricetta,strada",
    "P|A ogni uccello il suo nido è bello|Per ognuno la propria casa è la più bella.|nido|ramo,volo,canto",
    "P|Casa mia, casa mia, per piccina che tu sia, tu mi sembri una badia|La propria casa, anche se piccola, sembra grande come un'abbazia.",
    "P|Patti chiari, amicizia lunga|Accordi chiari fin dall'inizio evitano litigi.|amicizia|strada,vita,giornata",
    "P|Non fare il passo più lungo della gamba|Non bisogna impegnarsi oltre le proprie possibilità.|gamba|strada,scarpa,porta",
    "P|Mal comune, mezzo gaudio|Un problema condiviso con altri pesa meno.",
    "P|L'ospite è come il pesce: dopo tre giorni puzza|Non bisogna trattenersi troppo a lungo a casa d'altri.|pesce|pane,formaggio,latte",
    "P|Chi va al mulino s'infarina|Chi frequenta certi ambienti finisce per portarne i segni.",
    "P|Campa cavallo che l'erba cresce|È inutile aspettare: ci vorrà troppo tempo.|cavallo|asino,gatto,coniglio",
    "P|Il gioco è bello quando dura poco|Le cose belle non vanno tirate per le lunghe.|poco|tanto,sempre,molto",
    "P|Vivi e lascia vivere|Bisogna rispettare la libertà degli altri.",
    "P|Nella botte piccola c'è il vino buono|Le cose di valore possono stare anche in piccole dimensioni.|vino|olio,latte,sugo",
    "P|Cielo a pecorelle, acqua a catinelle|Le nuvole a batuffoli, come un gregge, annunciano pioggia.|catinelle|secchielli,fiumi,bottiglie",
    "P|A San Martino ogni mosto diventa vino|A novembre il vino nuovo è pronto da assaggiare.|vino|olio,aceto,latte",
    "P|Non rimandare a domani quello che puoi fare oggi|Le cose da fare è meglio farle subito.|domani|stasera,settembre,Natale",
    "P|Meglio soli che male accompagnati|Meglio stare da soli che con le persone sbagliate.|soli|ricchi,tardi,piano",
    "P|Prevenire è meglio che curare|Meglio evitare un problema prima che arrivi.|curare|parlare,pagare,aspettare",
    "P|Il silenzio è d'oro|A volte tacere è la scelta migliore.|oro|argento,ferro,legno",
    "P|Ogni medaglia ha il suo rovescio|Ogni cosa ha un lato buono e uno meno buono.|rovescio|nastro,colore,peso",
    "P|Tutte le strade portano a Roma|Si può arrivare allo stesso risultato in tanti modi diversi.|Roma|Milano,Napoli,Firenze",
    "P|Roma non fu fatta in un giorno|Le grandi cose richiedono tempo e pazienza.|giorno|anno,mese,minuto",
    "P|Chi lascia la strada vecchia per la nuova sa quel che lascia ma non sa quel che trova|Cambiare porta con sé qualche incertezza.|trova|perde,prende,compra",
    "P|Fatta la legge, trovato l'inganno|Per ogni regola c'è chi trova il modo di aggirarla.",
    "P|Cosa fatta capo ha|Una volta fatta, una cosa è decisa: non ci si pensa più.",
    "P|L'occasione fa l'uomo ladro|Le situazioni troppo facili possono spingere a sbagliare: meglio non lasciare tentazioni in giro.|ladro|ricco,felice,sindaco",
    "P|Errare è umano|Sbagliare capita a tutti: l'importante è rimediare.|umano|facile,strano,vietato",
    "P|Vale più la pratica che la grammatica|L'esperienza fatta con le mani conta più della teoria: provate e riprovate!|pratica|musica,pazienza,fortuna",
    "P|Presto e bene raro avviene|Le cose fatte in fretta raramente vengono bene.",
    "P|La gatta frettolosa fa i gattini ciechi|Chi ha troppa fretta fa le cose male.",
    "P|Uomo avvisato, mezzo salvato|Chi è avvertito di un pericolo può evitarlo più facilmente.|salvato|bagnato,contento,arrivato",
    "P|Dopo la pioggia viene il sereno|Dopo i momenti difficili tornano quelli belli.|sereno|vento,freddo,temporale",
    "P|Chi si loda s'imbroda|Chi si vanta troppo finisce per fare brutta figura.",
    "P|Tra moglie e marito non mettere il dito|Non bisogna intromettersi nelle discussioni di coppia.|dito|naso,piede,cappello",
    "P|Sposa bagnata, sposa fortunata|Si dice che la pioggia il giorno delle nozze porti fortuna.|fortunata|arrabbiata,raffreddata,stancata",
    "P|Verba volant, scripta manent|In latino: le parole volano, gli scritti restano. Gli accordi importanti si mettono per iscritto.",
    "P|Chi si somiglia si piglia|Le persone simili si trovano bene insieme.",
    "P|A tavola non s'invecchia|A tavola, in buona compagnia, il tempo vola.|tavola|teatro,mercato,scuola",
    "P|A Carnevale ogni scherzo vale|Durante il Carnevale si può scherzare un po' di più.|scherzo|vestito,regalo,dolce",
    "P|Chi tardi arriva male alloggia|Chi arriva per ultimo trova i posti peggiori.|alloggia|mangia,dorme,parcheggia",
    "P|Il lavoro nobilita l'uomo|Lavorare con impegno dà dignità.",
    "P|Chi non fa non sbaglia|Solo chi non fa nulla non commette errori.",
    "P|Il troppo stroppia|L'esagerazione rovina anche le cose buone.",
    "P|Ogni cosa a suo tempo|C'è un momento giusto per ogni cosa.",
    "P|Ogni bel gioco dura poco|Anche le cose belle devono finire, per poterle ricordare con piacere.",
    "P|Al cuor non si comanda|I sentimenti non si possono decidere a tavolino.",
    "P|Non è tutto oro quel che luccica|Le apparenze possono ingannare: attenzione alle offerte troppo belle.|oro|argento,sole,vetro",
    "P|Chi ha orecchie per intendere intenda|Chi vuole capire, capisca.",
    "P|La volpe che non arriva all'uva dice che è acerba|Si disprezza quello che non si riesce a ottenere.|uva|mela,fragola,ciliegia",
    "P|Il mondo è bello perché è vario|Le differenze tra le persone rendono il mondo interessante.|vario|grande,rotondo,antico",
    "P|Tutto il mondo è paese|Dovunque si vada, le persone hanno pregi e difetti simili.|paese|mare,festa,giardino",
    "P|Chi semina raccoglie|Chi lavora con pazienza ne vedrà i frutti.",
    "P|Chi vuole vada, chi non vuole mandi|Se si vuole una cosa fatta bene, è meglio occuparsene di persona.",
    "P|Contadino, scarpe grosse e cervello fino|Le persone semplici sono spesso molto sagge.",
    "P|Aiutati che il ciel t'aiuta|Bisogna darsi da fare per primi, poi l'aiuto arriva.",
    "P|Piano piano si arriva lontano|Un passo alla volta si raggiungono anche le mete più lontane.",
    "P|Dove c'è gusto non c'è perdenza|Se una cosa ci piace, il tempo e la fatica non sono mai sprecati.",
    "P|Chi è in difetto è in sospetto|Chi ha qualcosa da nascondere sospetta degli altri.",
    "P|Anno di neve, anno di bene|Un inverno nevoso promette un buon raccolto.|neve|sole,vento,festa",
    "P|Chi ha fatto trenta può fare trentuno|Dopo tanta fatica, un piccolo sforzo in più si può fare.",
    "P|Di notte tutti i gatti sono bigi|Al buio non si distinguono le differenze.",
    "M|Avere le mani in pasta|Essere coinvolti in tante faccende.",
    "M|Essere al settimo cielo|Essere felicissimi.",
    "M|Prendere due piccioni con una fava|Ottenere due risultati con un solo sforzo.",
    "M|Costare un occhio della testa|Costare moltissimo.",
    "M|Fare orecchie da mercante|Fingere di non sentire.",
    "M|Avere la testa tra le nuvole|Essere distratti e sognanti.",
    "M|Come il cacio sui maccheroni|Arrivare proprio al momento giusto, come il formaggio sulla pasta.",
    "M|Non avere peli sulla lingua|Dire le cose come stanno, con franchezza.",
    "M|Rompere il ghiaccio|Fare il primo passo per conoscersi, superando l'imbarazzo.",
    "M|Andare a gonfie vele|Andare benissimo, come una barca spinta dal vento.",
    "M|Mettere il carro davanti ai buoi|Fare le cose nell'ordine sbagliato, con troppa fretta.",
    "M|Cercare un ago in un pagliaio|Cercare una cosa quasi impossibile da trovare.",
    "M|Essere in alto mare|Essere ancora lontani dalla fine di un lavoro.",
    "M|Avere un cuore d'oro|Essere molto generosi e buoni.",
    "M|Dormire come un ghiro|Dormire profondamente e a lungo.",
    "M|Essere sano come un pesce|Essere in ottima salute.",
    "M|Essere buono come il pane|Essere una persona molto buona.",
    "M|Toccare il cielo con un dito|Provare una grandissima felicità.",
    "M|Acqua in bocca|Mantenere un segreto, non dire niente a nessuno.",
    "M|In bocca al lupo|Augurio di buona fortuna prima di una prova.",
    "M|Gatta ci cova|C'è qualcosa di nascosto sotto.",
    "M|Fare di necessità virtù|Adattarsi e trarre il meglio da una situazione.",
    "M|Essere una buona forchetta|Mangiare volentieri e con gusto.",
    "M|Prendere lucciole per lanterne|Confondere una cosa con un'altra.",
    "M|Tagliare la corda|Andarsene di nascosto, senza farsi notare.",
    "M|Piove sul bagnato|Le cose arrivano sempre a chi ne ha già tante.",
    "M|Essere come il prezzemolo|Trovarsi dappertutto.",
    "M|Fare castelli in aria|Fantasticare progetti difficili da realizzare.",
    "M|Avere il pollice verde|Essere bravi a curare le piante.",
    "M|Mettere la pulce nell'orecchio|Far nascere un dubbio in qualcuno.",
    "M|Chi più ne ha più ne metta|E così via: ce ne sarebbero tanti altri.",
    "M|Fare il diavolo a quattro|Agitarsi e insistere in tutti i modi per ottenere qualcosa.",
    "M|Essere nelle nuvole|Essere distratti, pensare ad altro.",
    "M|Vedere tutto rosa|Essere molto ottimisti.",
    "M|Fare quattro passi|Fare una breve passeggiata.",
    "M|Alzarsi con il piede sbagliato|Cominciare la giornata di cattivo umore.",
    "M|Avere le mani d'oro|Essere molto abili nei lavori manuali.",
    "M|Parlare del più e del meno|Chiacchierare di cose leggere.",
    "C|Nel blu dipinto di blu|Canzone di Domenico Modugno: vinse il Festival di Sanremo nel 1958. Tutti la conoscono come «Volare».",
    "C|Azzurro|Canzone cantata da Adriano Celentano nel 1968, scritta da Paolo Conte con Vito Pallavicini.",
    "C|O sole mio|Celebre canzone napoletana del 1898, di Giovanni Capurro ed Eduardo Di Capua.",
    "C|Funiculì funiculà|Canzone napoletana del 1880, scritta per la funicolare del Vesuvio.",
    "C|Il ragazzo della via Gluck|Canzone di Adriano Celentano presentata a Sanremo nel 1966.",
    "C|Il cielo in una stanza|Canzone di Gino Paoli resa famosa da Mina nel 1960.",
    "C|Grande grande grande|Successo di Mina del 1972.",
    "C|La bambola|Successo di Patty Pravo del 1968.",
    "C|Senza fine|Canzone di Gino Paoli del 1961.",
    "C|Il mondo|Successo di Jimmy Fontana del 1965.",
    "C|Nessuno mi può giudicare|Canzone portata al successo da Caterina Caselli a Sanremo nel 1966.",
    "C|Una rotonda sul mare|Successo estivo di Fred Bongusto del 1964.",
    "C|Arrivederci Roma|Canzone di Renato Rascel del 1955.",
    "C|Parlami d'amore Mariù|Canzone del 1932, cantata da Vittorio De Sica in un film.",
    "C|Il cuore è uno zingaro|Vinse Sanremo nel 1971, cantata da Nada e Nicola Di Bari.",
    "C|Sapore di sale|Canzone estiva di Gino Paoli del 1963.",
    "C|Tintarella di luna|Successo di Mina del 1959.",
    "C|Marina|Successo di Rocco Granata del 1959.",
    "C|Quando quando quando|Canzone di Tony Renis del 1962, famosa in tutto il mondo.",
    "C|Una carezza in un pugno|Canzone di Adriano Celentano del 1968.",
    "C|Montagne verdi|Canzone di Marcella Bella del 1972.",
    "C|Gianna|Canzone di Rino Gaetano presentata a Sanremo nel 1978.",
    "C|Ma il cielo è sempre più blu|Canzone di Rino Gaetano del 1975.",
    "C|La donna cannone|Canzone di Francesco De Gregori del 1983.",
    "C|L'italiano|Canzone di Toto Cutugno presentata a Sanremo nel 1983.",
    "C|Nel sole|Canzone di Al Bano del 1967.",
    "C|Felicità|Successo di Al Bano e Romina Power del 1982.",
    "C|Ci vuole un fiore|Canzone per bambini di Sergio Endrigo su parole di Gianni Rodari, del 1974.",
    "C|Emozioni|Canzone di Lucio Battisti del 1970.",
    "C|Acqua azzurra, acqua chiara|Canzone di Lucio Battisti del 1969.",
    "C|La canzone del sole|Canzone di Lucio Battisti del 1971, suonata da intere generazioni con la chitarra.",
    "C|Rose rosse|Successo di Massimo Ranieri del 1969.",
    "C|Cuore matto|Canzone di Little Tony presentata a Sanremo nel 1967.",
    "C|Tu vuò fà l'americano|Canzone di Renato Carosone del 1956.",
    "C|Torna a Surriento|Classico napoletano dei fratelli De Curtis, dei primi del Novecento.",
    "C|Santa Lucia|Canzone napoletana dell'Ottocento dedicata al borgo marinaro di Napoli.",
    "C|Che sarà|Canzone presentata a Sanremo nel 1971 dai Ricchi e Poveri e da José Feliciano.",
    "C|Sarà perché ti amo|Successo dei Ricchi e Poveri del 1981.",
    "C|Piccolo grande amore|Canzone di Claudio Baglioni del 1972.",
    "C|Grazie dei fiori|Canzone di Nilla Pizzi: vinse il primo Festival di Sanremo, nel 1951.",
    "C|Vola colomba|Canzone di Nilla Pizzi che vinse Sanremo nel 1952.",
    "C|Papaveri e papere|Canzone di Nilla Pizzi del 1952.",
    "C|Quando vedrai la mia ragazza|Canzone di Little Tony del 1964.",
    "F|La dolce vita|Film di Federico Fellini del 1960, con Marcello Mastroianni e Anita Ekberg nella Fontana di Trevi.",
    "F|Ladri di biciclette|Film di Vittorio De Sica del 1948, capolavoro del cinema italiano.",
    "F|Il gattopardo|Film di Luchino Visconti del 1963, dal romanzo di Tomasi di Lampedusa.",
    "F|Nuovo Cinema Paradiso|Film di Giuseppe Tornatore del 1988, premiato con l'Oscar.",
    "F|Pane, amore e fantasia|Film di Luigi Comencini del 1953, con Gina Lollobrigida e Vittorio De Sica.",
    "F|Don Camillo|Film del 1952 con Fernandel e Gino Cervi, dai racconti di Giovannino Guareschi.",
    "F|Miseria e nobiltà|Film del 1954 con Totò, dalla commedia di Eduardo Scarpetta.",
    "F|I soliti ignoti|Commedia di Mario Monicelli del 1958.",
    "F|Amarcord|Film di Federico Fellini del 1973: in dialetto romagnolo significa «mi ricordo».",
    "F|Vacanze romane|Film del 1953 con Audrey Hepburn e Gregory Peck in giro per Roma in Vespa.",
    "F|Matrimonio all'italiana|Film di Vittorio De Sica del 1964, con Sophia Loren e Marcello Mastroianni.",
    "F|C'era una volta il West|Film di Sergio Leone del 1968, con la musica di Ennio Morricone.",
    "F|Totò, Peppino e la malafemmina|Commedia del 1956 con Totò e Peppino De Filippo, famosa per la lettera.",
    "F|Mary Poppins|Film del 1964 con la tata che vola con l'ombrello.",
    "F|Via col vento|Grande film del 1939 ambientato nel Sud degli Stati Uniti.",
    "F|Il mago di Oz|Film del 1939 con Dorothy e la strada di mattoni gialli.",
    "F|Cenerentola|Cartone animato di Walt Disney del 1950, con la scarpetta di cristallo.",
    "F|L'armata Brancaleone|Commedia di Mario Monicelli del 1966, con Vittorio Gassman.",
    "F|Amici miei|Commedia di Mario Monicelli del 1975, famosa per le zingarate.",
    "F|Il postino|Film del 1994 con Massimo Troisi, ambientato su un'isola del Sud.",
    "F|Ricomincio da tre|Primo film di Massimo Troisi, del 1981.",
    "F|Il marchese del Grillo|Film di Mario Monicelli del 1981, con Alberto Sordi.",
    "F|Un americano a Roma|Film del 1954 con Alberto Sordi e il suo piatto di maccheroni.",
    "R|Eppur si muove|Frase attribuita a Galileo Galilei: la Terra gira intorno al Sole.",
    "R|Il dado è tratto|Frase attribuita a Giulio Cesare quando attraversò il fiume Rubicone: ormai la decisione è presa.",
    "R|Obbedisco|Il telegramma di Giuseppe Garibaldi del 1866.",
    "R|Fatti non foste a viver come bruti|Verso di Dante, Inferno: siamo fatti per cercare la virtù e la conoscenza.",
    "R|Nel mezzo del cammin di nostra vita|Il primo verso della Divina Commedia di Dante.",
    "R|E quindi uscimmo a riveder le stelle|L'ultimo verso dell'Inferno di Dante.",
    "R|Quel ramo del lago di Como|L'inizio dei Promessi sposi di Alessandro Manzoni.",
    "R|Sempre caro mi fu quest'ermo colle|Il primo verso dell'Infinito di Giacomo Leopardi.",
    "R|M'illumino d'immenso|La poesia «Mattina» di Giuseppe Ungaretti, tutta in due parole.",
    "R|Chi vuol esser lieto, sia: di doman non c'è certezza|Versi di Lorenzo il Magnifico: godiamoci il presente.",
    "R|Conosci te stesso|Il motto del tempio di Apollo a Delfi, nell'antica Grecia.",
    "R|Carpe diem|Parole del poeta latino Orazio: cogli l'attimo.",
    "R|Gli esami non finiscono mai|Titolo di una commedia di Eduardo De Filippo, del 1973.",
    "R|Siamo uomini o caporali?|Frase resa celebre da Totò.",
    "R|Ogni limite ha una pazienza|Battuta di Totò che rovescia il detto «ogni pazienza ha un limite».",
    "R|Veni, vidi, vici|In latino: venni, vidi, vinsi. Giulio Cesare annunciò così una vittoria lampo."
  ];

  /* ================================================================== utilita' */
  var ACC = { "À": "A", "Á": "A", "Â": "A", "Ä": "A", "È": "E", "É": "E", "Ê": "E", "Ë": "E", "Ì": "I", "Í": "I", "Î": "I", "Ï": "I",
    "Ò": "O", "Ó": "O", "Ô": "O", "Ö": "O", "Ù": "U", "Ú": "U", "Û": "U", "Ü": "U" };
  /* maiuscolo senza accenti: «città» -> «CITTA» */
  function norm(s) {
    s = String(s == null ? "" : s).toUpperCase();
    var out = "";
    for (var i = 0; i < s.length; i++) { var c = s.charAt(i); out += ACC[c] || c; }
    return out;
  }
  function soloLettere(s) { return norm(s).replace(/[^A-Z]/g, ""); }
  function lettera(c) { var n = norm(c); return /^[A-Z]$/.test(n) ? n : ""; }

  /* generatore pseudo-casuale con seme (mulberry32) */
  function hash(s) {
    var h = 2166136261; s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul ? Math.imul(h, 16777619) : (h * 16777619) | 0; }
    return h >>> 0;
  }
  function imul(a, b) {
    if (Math.imul) return Math.imul(a, b);
    var ah = (a >>> 16) & 0xffff, al = a & 0xffff, bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
    return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0) | 0);
  }
  function rng(seme) {
    var a = hash(seme);
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = imul(a ^ (a >>> 15), 1 | a);
      t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mescola(arr, r) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  /* soluzione della partita in corso, solo per le prove automatiche (tests/ui_mente_giochi.py) */
  function perProve(gioco, soluzione) { if (PD.menteGiochi) PD.menteGiochi.corrente = { gioco: gioco, soluzione: soluzione }; }
  function caso(ctx) { return ctx && typeof ctx.casuale === "function" ? function () { var x = ctx.casuale(); return typeof x === "number" ? x : Math.random(); } : Math.random; }
  function oggi() {
    var A = PD.mente && PD.mente.aiuti, d = null;
    try { if (A && A.oggi) d = A.oggi(); } catch (e) { d = null; }   // rispetta la data finta dei test
    if (!d || !d.getFullYear) d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1) + "-" + (d.getDate() < 10 ? "0" : "") + d.getDate();
  }
  /* voce per gli esiti: solo se la voce e' attiva nelle impostazioni (forza = pulsante 🔊) */
  function parla(ctx, t, forza) { try { if (PD.speak && (forza || (PD.settings && PD.settings.voice))) PD.speak(t, !!forza); } catch (e) { /* voce non disponibile */ } }
  /* consegna del gioco: il framework la mostra in alto e la legge («🔊 Leggi» la ripete) */
  function consegna(ctx, t) { try { if (ctx && ctx.parla) ctx.parla(t); } catch (e) { /* niente */ } }
  function dopo(ctx, fn, ms) { if (ctx && typeof ctx.dopo === "function") return ctx.dopo(fn, ms); return setTimeout(fn, ms); }
  function aiuto(ctx, t) { try { if (ctx && ctx.suggerimento) ctx.suggerimento(t); } catch (e) { /* niente */ } }

  /* ------------------------------------------------------------------ dati pronti */
  var DIZ = [], DIZ_MAPPA = {};
  (function () {
    for (var g in DIZ_GRUPPI) {
      if (!Object.prototype.hasOwnProperty.call(DIZ_GRUPPI, g)) continue;
      var L = DIZ_GRUPPI[g];
      for (var i = 0; i < L.length; i++) {
        var p = L[i].split("|"), w = p[0];
        if (DIZ_MAPPA[w]) continue;      // niente doppioni
        var voce = { parola: w, def: p[1], gruppo: g };
        DIZ.push(voce); DIZ_MAPPA[w] = voce;
      }
    }
  })();
  var CATENA_OK = {};
  (function () {
    var i;
    for (i = 0; i < DIZ.length; i++) CATENA_OK[DIZ[i].parola] = 1;
    for (i = 0; i < PAROLE_IN_PIU.length; i++) if (PAROLE_IN_PIU[i]) CATENA_OK[PAROLE_IN_PIU[i]] = 1;
  })();
  var FRASI = [];
  (function () {
    for (var i = 0; i < FRASI_TXT.length; i++) {
      var p = FRASI_TXT[i].split("|");
      FRASI.push({ tipo: p[0], categoria: TIPI[p[0]], testo: p[1], spiega: p[2] || "", manca: p[3] || "", sbagliate: p[4] ? p[4].split(",") : [] });
    }
  })();

  /* ================================================================== GENERATORE DEL CRUCIVERBA */
  var CW_LIV = {
    1: { dims: [6, 6, 5], min: 5, max: 6, maxLen: 6, prove: 80 },
    2: { dims: [7, 8, 8], min: 8, max: 10, maxLen: 8, prove: 80 },
    3: { dims: [9, 10, 10], min: 12, max: 14, maxLen: 10, prove: 120 }
  };

  function provaGriglia(N, cfg, r, candidati) {
    var G = [], i, j;
    for (i = 0; i < N; i++) { G.push([]); for (j = 0; j < N; j++) G[i].push(null); }   // {ch, o, v}
    var parole = [], usate = {};
    function cella(rr, cc) { return rr >= 0 && cc >= 0 && rr < N && cc < N ? G[rr][cc] : null; }
    function valuta(w, r0, c0, dir) {   // numero di incroci, -1 se non si puo'
      var dr = dir === "v" ? 1 : 0, dc = dir === "o" ? 1 : 0, L = w.length, incroci = 0;
      if (r0 < 0 || c0 < 0 || r0 + dr * (L - 1) >= N || c0 + dc * (L - 1) >= N) return -1;
      if (cella(r0 - dr, c0 - dc) || cella(r0 + dr * L, c0 + dc * L)) return -1;
      for (var k = 0; k < L; k++) {
        var rr = r0 + dr * k, cc = c0 + dc * k, x = G[rr][cc];
        if (x) {
          if (x.ch !== w.charAt(k) || x[dir]) return -1;
          incroci++;
        } else if (cella(rr + dc, cc + dr) || cella(rr - dc, cc - dr)) return -1;
      }
      if (incroci === L) return -1;
      return incroci;
    }
    function metti(w, r0, c0, dir) {
      var dr = dir === "v" ? 1 : 0, dc = dir === "o" ? 1 : 0;
      for (var k = 0; k < w.length; k++) {
        var rr = r0 + dr * k, cc = c0 + dc * k;
        if (!G[rr][cc]) G[rr][cc] = { ch: w.charAt(k) };
        G[rr][cc][dir] = true;
      }
      parole.push({ parola: w, r: r0, c: c0, dir: dir }); usate[w] = 1;
    }
    // prima parola: lunga, in orizzontale o in verticale
    var lunghe = [];
    for (i = 0; i < candidati.length; i++) if (candidati[i].length >= N - 2) lunghe.push(candidati[i]);
    if (!lunghe.length) lunghe = candidati;
    var w0 = lunghe[Math.floor(r() * lunghe.length)], d0 = r() < 0.5 ? "o" : "v";
    var fisso = Math.floor(r() * N), libero = Math.floor(r() * (N - w0.length + 1));
    if (d0 === "o") metti(w0, fisso, libero, "o"); else metti(w0, libero, fisso, "v");
    for (var giro = 0; giro < 3 && parole.length < cfg.max; giro++) {
      var lista = mescola(candidati, r);
      for (var n = 0; n < lista.length && parole.length < cfg.max; n++) {
        var w = lista[n];
        if (usate[w]) continue;
        var posti = [], migliori = 0;
        for (var rr = 0; rr < N; rr++) for (var cc = 0; cc < N; cc++) {
          var x = G[rr][cc]; if (!x) continue;
          for (var k = 0; k < w.length; k++) {
            if (w.charAt(k) !== x.ch) continue;
            if (!x.o) { var s1 = valuta(w, rr, cc - k, "o"); if (s1 > 0) { posti.push([rr, cc - k, "o", s1]); if (s1 > migliori) migliori = s1; } }
            if (!x.v) { var s2 = valuta(w, rr - k, cc, "v"); if (s2 > 0) { posti.push([rr - k, cc, "v", s2]); if (s2 > migliori) migliori = s2; } }
          }
        }
        if (!posti.length) continue;
        var buoni = [];
        for (k = 0; k < posti.length; k++) if (posti[k][3] === migliori) buoni.push(posti[k]);
        var p = buoni[Math.floor(r() * buoni.length)];
        metti(w, p[0], p[1], p[2]);
      }
    }
    return { N: N, G: G, parole: parole };
  }

  function chiudiGriglia(g) {
    // ritaglia le righe e colonne vuote, numera le caselle iniziali in ordine di lettura
    var N = g.N, r0 = N, r1 = -1, c0 = N, c1 = -1, i, j;
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) if (g.G[i][j]) { if (i < r0) r0 = i; if (i > r1) r1 = i; if (j < c0) c0 = j; if (j > c1) c1 = j; }
    var R = r1 - r0 + 1, C = c1 - c0 + 1, sol = [];
    for (i = 0; i < R; i++) { sol.push([]); for (j = 0; j < C; j++) { var x = g.G[i + r0][j + c0]; sol[i].push(x ? x.ch : ""); } }
    var parole = [];
    for (i = 0; i < g.parole.length; i++) {
      var p = g.parole[i];
      parole.push({ parola: p.parola, r: p.r - r0, c: p.c - c0, dir: p.dir, def: DIZ_MAPPA[p.parola].def, len: p.parola.length });
    }
    parole.sort(function (a, b) { return a.r - b.r || a.c - b.c || (a.dir === "o" ? -1 : 1); });
    var num = 0, numeri = {};
    for (i = 0; i < parole.length; i++) {
      var k = parole[i].r + "," + parole[i].c;
      if (!numeri[k]) numeri[k] = ++num;
      parole[i].num = numeri[k];
    }
    return { righe: R, colonne: C, sol: sol, parole: parole, numeri: numeri };
  }

  /* genera(seme, livello) -> { righe, colonne, sol[r][c] ("" = casella nera), parole[{num, dir "o"|"v", r, c, parola, def, len}] } */
  function genera(seme, livello) {
    var cfg = CW_LIV[livello] || CW_LIV[1], r = rng("cruciverba|" + seme + "|" + livello);
    var best = null;
    for (var t = 0; t < cfg.prove; t++) {
      var N = cfg.dims[Math.floor(r() * cfg.dims.length)], cand = [];
      for (var i = 0; i < DIZ.length; i++) { var L = DIZ[i].parola.length; if (L >= 3 && L <= Math.min(N, cfg.maxLen)) cand.push(DIZ[i].parola); }
      var g = provaGriglia(N, cfg, r, cand);
      if (!best || g.parole.length > best.parole.length) best = g;
      if (g.parole.length >= cfg.min) break;
    }
    var out = chiudiGriglia(best);
    out.seme = seme; out.livello = livello;
    return out;
  }

  /* ================================================================== aiuti comuni dell'interfaccia */
  /* ascolta i tasti della tastiera fisica finche' il riquadro del gioco e' nella pagina */
  function ascoltaTasti(box, fn) {
    function h(e) {
      if (!document.documentElement.contains(box)) { document.removeEventListener("keydown", h); return; }
      if (!box.offsetParent && box.offsetWidth === 0) return;     // vista nascosta
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (fn(e) === true) e.preventDefault();
    }
    document.addEventListener("keydown", h);
    return function () { document.removeEventListener("keydown", h); };
  }
  /* tastiera a schermo grande: onTasto(lettera) con "⌫" per cancellare e "OK" per confermare */
  function tastieraHTML(extra, disattive) {
    var righe = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"], h = '<div class="mg-tastiera" role="group" aria-label="Tastiera grande sullo schermo">';
    for (var i = 0; i < righe.length; i++) {
      h += '<div class="mg-triga">';
      for (var j = 0; j < righe[i].length; j++) {
        var c = righe[i].charAt(j), off = disattive && disattive[c];
        var voc = extra && extra.vocali && "AEIOU".indexOf(c) >= 0;
        h += '<button type="button" class="mg-tasto' + (voc ? " vocale" : "") + '" data-t="' + c + '"' + (off ? " disabled" : "") +
          ' aria-label="Lettera ' + c + (voc ? ", costa un punto" : "") + '">' + c + (voc ? "<small>−1</small>" : "") + "</button>";
      }
      if (i === 2 && extra && extra.cancella) h += '<button type="button" class="mg-tasto largo" data-t="⌫" aria-label="Cancella">⌫</button>';
      if (i === 2 && extra && extra.ok) h += '<button type="button" class="mg-tasto largo ok" data-t="OK" aria-label="Conferma">OK</button>';
      h += "</div>";
    }
    return h + "</div>";
  }
  function legaTastiera(el, fn) {
    el.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".mg-tasto") : null;
      if (b && !b.disabled) fn(b.getAttribute("data-t"));
    });
  }
  function cuori(n, tot) {
    var h = "";
    for (var i = 0; i < tot; i++) h += i < n ? "❤️" : "🤍";
    return '<span class="mg-cuori" aria-label="' + n + " cuori su " + tot + '">' + h + "</span>";
  }
  function titoloHTML(t) { return '<div class="mg-testa"><h2>' + esc(t) + "</h2></div>"; }

  /* ================================================================== a) CRUCIVERBA */
  function cruciverbaStampa(cw, titolo) {
    function tab(conSol) {
      var h = '<table style="border-collapse:collapse;margin:6mm auto">';
      for (var r = 0; r < cw.righe; r++) {
        h += "<tr>";
        for (var c = 0; c < cw.colonne; c++) {
          var s = cw.sol[r][c], n = cw.numeri[r + "," + c];
          h += s ? '<td style="width:11mm;height:11mm;border:1.5px solid #000;position:relative;text-align:center;vertical-align:middle;font:bold 16pt sans-serif">' +
            (n ? '<span style="position:absolute;top:1px;left:2px;font:8pt sans-serif">' + n + "</span>" : "") + (conSol ? s : "") + "</td>"
            : '<td style="width:11mm;height:11mm;background:#222;border:1.5px solid #000"></td>';
        }
        h += "</tr>";
      }
      return h + "</table>";
    }
    function defs(dir, nome) {
      var h = "<h3>" + nome + '</h3><ol style="list-style:none;padding:0;font-size:13pt;line-height:1.5">';
      for (var i = 0; i < cw.parole.length; i++) {
        var p = cw.parole[i];
        if (p.dir === dir) h += "<li><b>" + p.num + ".</b> " + esc(p.def) + " <i>(" + p.len + ")</i></li>";
      }
      return h + "</ol>";
    }
    return '<div style="font-family:sans-serif;color:#000"><h1 style="font-size:20pt">🧩 ' + esc(titolo) + "</h1>" +
      '<p>Scrivete una lettera per casella. Il numero tra parentesi dice quante lettere ha la parola.</p>' + tab(false) +
      '<div style="display:flex;gap:10mm"><div style="flex:1">' + defs("o", "Orizzontali") + '</div><div style="flex:1">' + defs("v", "Verticali") + "</div></div>" +
      '<div style="page-break-before:always;break-before:page"></div><h2>Soluzioni</h2>' + tab(true) +
      '<p style="font-size:9pt">Stampato dal Professore Digitale · Ginnastica per la mente · ' + esc(PD.licenzaBreve()) + "</p></div>";
  }

  function avviaCruciverba(box, ctx) {
    var liv = ctx.livello || 1, r = caso(ctx), seme = oggi(), diOggi = true;
    var cw, inp, riv, rivedere, sel, finito, rivelate;
    var stop = ascoltaTasti(box, tasto);

    function nuovo() {
      cw = genera(seme, liv); perProve("cruciverba", cw); inp = []; riv = []; rivedere = {}; finito = false; rivelate = 0;
      for (var i = 0; i < cw.righe; i++) { inp.push([]); riv.push([]); for (var j = 0; j < cw.colonne; j++) { inp[i].push(""); riv[i].push(false); } }
      sel = { p: 0, k: 0 };
      disegna();
    }
    function parolaDi(p) { return cw.parole[p]; }
    function celle(p) {
      var w = parolaDi(p), out = [];
      for (var k = 0; k < w.len; k++) out.push(w.dir === "o" ? [w.r, w.c + k] : [w.r + k, w.c]);
      return out;
    }
    function paroleInCella(r0, c0) {
      var out = [];
      for (var i = 0; i < cw.parole.length; i++) {
        var w = cw.parole[i];
        if (w.dir === "o" && w.r === r0 && c0 >= w.c && c0 < w.c + w.len) out.push([i, c0 - w.c]);
        if (w.dir === "v" && w.c === c0 && r0 >= w.r && r0 < w.r + w.len) out.push([i, r0 - w.r]);
      }
      return out;
    }
    function cellaSel() { return celle(sel.p)[sel.k]; }
    function scegliCella(r0, c0, preferisci) {
      var pw = paroleInCella(r0, c0); if (!pw.length) return;
      var cur = cellaSel(), scelta = pw[0];
      if (cur[0] === r0 && cur[1] === c0 && pw.length > 1) scelta = pw[0][0] === sel.p ? pw[1] : pw[0];   // stesso clic: cambia direzione
      else for (var i = 0; i < pw.length; i++) if (cw.parole[pw[i][0]].dir === (preferisci || cw.parole[sel.p].dir)) scelta = pw[i];
      sel = { p: scelta[0], k: scelta[1] };
    }
    function completa(p) { var c = celle(p); for (var i = 0; i < c.length; i++) if (!inp[c[i][0]][c[i][1]]) return false; return true; }
    function giusta(p) { var c = celle(p); for (var i = 0; i < c.length; i++) if (inp[c[i][0]][c[i][1]] !== cw.sol[c[i][0]][c[i][1]]) return false; return true; }
    function totaleLettere() { var n = 0; for (var i = 0; i < cw.righe; i++) for (var j = 0; j < cw.colonne; j++) if (cw.sol[i][j]) n++; return n; }
    function controllaFine() {
      var pieno = true, ok = true;
      for (var i = 0; i < cw.righe; i++) for (var j = 0; j < cw.colonne; j++) if (cw.sol[i][j]) {
        if (!inp[i][j]) pieno = false; else if (inp[i][j] !== cw.sol[i][j]) ok = false;
      }
      if (pieno && ok) {
        finito = true; disegna();
        var tot = totaleLettere(), punti = Math.max(0, Math.round(10 * (tot - rivelate) / tot));
        parla(ctx, "Bravissimi! Cruciverba completato.");
        dopo(ctx, function () {
          stop();
          ctx.fine({ punti: punti, massimo: 10, messaggio: rivelate ? "Cruciverba completato con " + rivelate + (rivelate === 1 ? " lettera rivelata" : " lettere rivelate") + ". Bravissimi!" : "Cruciverba completato senza aiuti: complimenti!" });
        }, 900);
      } else if (pieno) {
        avviso("Il cruciverba è pieno, ma qualche lettera non torna. Premete «Controlla» per vedere quali.", "warn");
      }
    }
    function scrivi(ch) {
      if (finito) return;
      var c = cellaSel();
      if (!riv[c[0]][c[1]]) { inp[c[0]][c[1]] = ch; delete rivedere[c[0] + "," + c[1]]; }
      // avanti di una casella: chi scrive tutta la parola la ritrova sempre allineata
      var cs = celle(sel.p);
      if (sel.k < cs.length - 1) sel.k++;
      else if (completa(sel.p)) prossimaParola(1, true);
      disegna(); controllaFine();
    }
    function cancella() {
      if (finito) return;
      var c = cellaSel();
      if (inp[c[0]][c[1]] && !riv[c[0]][c[1]]) inp[c[0]][c[1]] = "";
      else if (sel.k > 0) { sel.k--; c = cellaSel(); if (!riv[c[0]][c[1]]) inp[c[0]][c[1]] = ""; }
      delete rivedere[c[0] + "," + c[1]];
      disegna();
    }
    function sposta(dr, dc) {
      var c = cellaSel(), r0 = c[0] + dr, c0 = c[1] + dc;
      while (r0 >= 0 && c0 >= 0 && r0 < cw.righe && c0 < cw.colonne) {
        if (cw.sol[r0][c0]) { scegliCella(r0, c0, dr ? "v" : "o"); disegna(); return; }
        r0 += dr; c0 += dc;
      }
    }
    function prossimaParola(verso, soloIncomplete) {
      var n = cw.parole.length;
      for (var i = 1; i <= n; i++) {
        var p = (sel.p + verso * i + n * 2) % n;
        if (!soloIncomplete || !completa(p)) { sel = { p: p, k: 0 }; return; }
      }
    }
    function tasto(e) {
      if (finito) return false;
      var k = e.key || "";
      if (k === "Backspace" || k === "Delete") { cancella(); return true; }
      if (k === "ArrowRight") { sposta(0, 1); return true; }
      if (k === "ArrowLeft") { sposta(0, -1); return true; }
      if (k === "ArrowDown") { sposta(1, 0); return true; }
      if (k === "ArrowUp") { sposta(-1, 0); return true; }
      if (k === "Tab" || k === "Enter") { prossimaParola(e.shiftKey ? -1 : 1, false); disegna(); return true; }
      if (k === " ") { var c = cellaSel(); scegliCella(c[0], c[1]); disegna(); return true; }
      var l = k.length === 1 ? lettera(k) : "";
      if (l) { scrivi(l); return true; }
      return false;
    }
    function avviso(t, tipo) { var a = box.querySelector(".mg-cw-esito"); if (a) { a.className = "mg-cw-esito notice " + (tipo || "info"); a.textContent = t; a.hidden = false; } }

    function grigliaHTML() {
      var att = {}, cs = celle(sel.p), cur = cellaSel(), i;
      for (i = 0; i < cs.length; i++) att[cs[i][0] + "," + cs[i][1]] = 1;
      var h = '<div class="mg-cw-griglia" style="grid-template-columns:repeat(' + cw.colonne + ',1fr);max-width:' + (cw.colonne * 3.6) + 'rem" role="grid" aria-label="Griglia del cruciverba">';
      for (var r0 = 0; r0 < cw.righe; r0++) for (var c0 = 0; c0 < cw.colonne; c0++) {
        var s = cw.sol[r0][c0], key = r0 + "," + c0;
        if (!s) { h += '<div class="mg-cw-nera" aria-hidden="true"></div>'; continue; }
        var cls = "mg-cw-cella" + (att[key] ? " attiva" : "") + (cur[0] === r0 && cur[1] === c0 ? " corrente" : "") +
          (riv[r0][c0] ? " rivelata" : "") + (rivedere[key] ? " rivedere" : "") + (finito ? " finita" : "");
        var n = cw.numeri[key];
        h += '<button type="button" class="' + cls + '" data-r="' + r0 + '" data-c="' + c0 + '" aria-label="Riga ' + (r0 + 1) + " colonna " + (c0 + 1) +
          (inp[r0][c0] ? ", lettera " + inp[r0][c0] : ", vuota") + '">' + (n ? '<span class="n">' + n + "</span>" : "") + '<span class="l">' + esc(inp[r0][c0]) + "</span></button>";
      }
      return h + "</div>";
    }
    function defsHTML(dir, nome) {
      var h = '<div class="mg-cw-defs"><h3>' + nome + "</h3><ul>";
      for (var i = 0; i < cw.parole.length; i++) {
        var p = cw.parole[i]; if (p.dir !== dir) continue;
        var cls = (i === sel.p ? "attiva" : "") + (completa(i) && (finito || giusta(i)) ? " fatta" : "");
        h += '<li><button type="button" class="mg-cw-def ' + cls + '" data-p="' + i + '"><b>' + p.num + ".</b> " + esc(p.def) + ' <span class="muted">(' + p.len + ")</span></button></li>";
      }
      return h + "</ul></div>";
    }
    function disegna() {
      var p = parolaDi(sel.p);
      var aperto = box.querySelector(".mg-cw-esito"), esitoVecchio = aperto && !aperto.hidden ? aperto.outerHTML : "";
      box.innerHTML = '<div class="mg mg-cw">' +
        titoloHTML(diOggi ? "📅 Il cruciverba di oggi" : "🔄 Un altro cruciverba") +
        '<div class="mg-cw-corrente" aria-live="polite"><span class="mg-cw-num">' + p.num + (p.dir === "o" ? " orizzontale" : " verticale") + "</span> " + esc(p.def) +
        ' <span class="muted">(' + p.len + ' lettere)</span> <button type="button" class="btn ghost mg-cw-leggi" title="Leggi ad alta voce">🔊</button></div>' +
        '<div class="mg-cw-corpo"><div class="mg-cw-sx">' + grigliaHTML() + tastieraHTML({ cancella: true }) + "</div>" +
        '<div class="mg-cw-dx">' + defsHTML("o", "➡️ Orizzontali") + defsHTML("v", "⬇️ Verticali") + "</div></div>" +
        (esitoVecchio || '<div class="mg-cw-esito notice info" hidden></div>') +
        '<div class="row mg-azioni">' +
        '<button type="button" class="btn" data-a="controlla">✔️ Controlla</button>' +
        '<button type="button" class="btn ghost" data-a="lettera">💡 Rivela una lettera</button>' +
        '<button type="button" class="btn ghost" data-a="parola">📖 Rivela la parola</button>' +
        '<button type="button" class="btn ghost" data-a="stampa">🖨️ Stampa su carta</button>' +
        '<button type="button" class="btn ghost" data-a="altro">🔄 Un altro cruciverba</button>' +
        (diOggi ? "" : '<button type="button" class="btn ghost" data-a="oggi">📅 Torna a quello di oggi</button>') +
        "</div></div>";
    }
    box.addEventListener("click", function (e) {
      var t = e.target, b;
      if (!cw) return;
      if ((b = t.closest(".mg-cw-cella"))) { if (!finito) { scegliCella(+b.getAttribute("data-r"), +b.getAttribute("data-c")); disegna(); } return; }
      if ((b = t.closest(".mg-cw-def"))) { sel = { p: +b.getAttribute("data-p"), k: 0 }; disegna(); return; }
      if ((b = t.closest(".mg-cw-leggi"))) { var p = parolaDi(sel.p); parla(ctx, p.num + (p.dir === "o" ? " orizzontale: " : " verticale: ") + p.def + ". " + p.len + " lettere.", true); return; }
      if ((b = t.closest(".mg-tasto"))) { var x = b.getAttribute("data-t"); if (x === "⌫") cancella(); else scrivi(x); return; }
      if (!(b = t.closest("[data-a]"))) return;
      var a = b.getAttribute("data-a");
      if (a === "controlla") {
        var n = 0;
        rivedere = {};
        for (var i = 0; i < cw.righe; i++) for (var j = 0; j < cw.colonne; j++) if (inp[i][j] && inp[i][j] !== cw.sol[i][j]) { rivedere[i + "," + j] = 1; n++; }
        disegna();
        avviso(n ? (n === 1 ? "C'è una lettera da rivedere: è colorata in arancione." : "Ci sono " + n + " lettere da rivedere: sono colorate in arancione.") + " Nessuna fretta!"
          : "Finora è tutto giusto. Bravi, continuate così!", n ? "warn" : "ok");
      } else if (a === "lettera" || a === "parola") {
        if (finito) return;
        var cs = celle(sel.p), fatte = 0;
        for (var k = 0; k < cs.length; k++) {
          var rr = cs[k][0], cc = cs[k][1];
          if (a === "lettera" && k < sel.k && inp[rr][cc] === cw.sol[rr][cc]) continue;
          if (inp[rr][cc] === cw.sol[rr][cc] && (a === "parola" || riv[rr][cc])) continue;
          inp[rr][cc] = cw.sol[rr][cc]; riv[rr][cc] = true; delete rivedere[rr + "," + cc]; rivelate++; fatte++;
          if (a === "lettera") { sel.k = k; break; }
        }
        if (!fatte) { avviso("Questa parola è già giusta: sceglietene un'altra.", "info"); return; }
        if (a === "parola") aiuto(ctx, "La parola era " + parolaDi(sel.p).parola + ".");
        prossimaVuota(); disegna(); controllaFine();
      } else if (a === "stampa") {
        if (PD.printHTML) PD.printHTML(cruciverbaStampa(cw, diOggi ? "Il cruciverba di oggi" : "Cruciverba"), "verticale");
      } else if (a === "altro") {
        seme = "altro-" + Math.floor(r() * 1e9); diOggi = false; nuovo();
      } else if (a === "oggi") {
        seme = oggi(); diOggi = true; nuovo();
      }
    });
    function prossimaVuota() { var cs = celle(sel.p); for (var k = 0; k < cs.length; k++) if (!inp[cs[k][0]][cs[k][1]]) { sel.k = k; return; } }
    consegna(ctx, "Toccate una casella o una definizione, poi scrivete le lettere con la tastiera (o con quella grande sullo schermo). " +
      "Le lettere accentate si scrivono senza accento: CITTÀ diventa CITTA. Toccando di nuovo la stessa casella si cambia direzione.");
    aiuto(ctx, "Cominciate dalle definizioni che vi sembrano più facili: le lettere che trovate aiutano a indovinare le parole che si incrociano.");
    nuovo();
  }

  /* ================================================================== b) INDOVINA LA FRASE */
  function avviaFrase(box, ctx) {
    var liv = ctx.livello || 1, r = caso(ctx), CUORI = liv === 1 ? 8 : liv === 2 ? 6 : 4;
    var f = FRASI[Math.floor(r() * FRASI.length)];
    var lettere = soloLettere(f.testo), presenti = {}, provate = {}, vite = CUORI, vocali = 0, finito = false, msg = "";
    for (var i = 0; i < lettere.length; i++) presenti[lettere.charAt(i)] = 1;
    perProve("frase", f);
    var stop = ascoltaTasti(box, function (e) {
      var l = e.key && e.key.length === 1 ? lettera(e.key) : "";
      if (l && !finito) { prova(l); return true; }
      return false;
    });
    function mancanti() { var n = 0; for (var k in presenti) if (presenti.hasOwnProperty(k) && !provate[k]) n++; return n; }
    function tabellone() {
      var parole = f.testo.split(" "), lunga = 0;
      for (var w0 = 0; w0 < parole.length; w0++) if (parole[w0].length > lunga) lunga = parole[w0].length;
      var h = '<div class="mg-fr-tab' + (lunga > 11 ? " lunghissime" : lunga > 8 ? " lunghe" : "") + '" aria-label="Frase da indovinare">';
      for (var w = 0; w < parole.length; w++) {
        h += '<span class="mg-fr-parola">';
        for (var k = 0; k < parole[w].length; k++) {
          var c = parole[w].charAt(k), l = lettera(c);
          if (!l) h += '<span class="mg-fr-segno">' + esc(c) + "</span>";
          else if (provate[l] || finito) h += '<span class="mg-fr-casella vista' + (!provate[l] ? " svelata" : "") + '">' + esc(c.toUpperCase()) + "</span>";
          else h += '<span class="mg-fr-casella" aria-label="lettera nascosta"></span>';
        }
        h += "</span>";
      }
      return h + "</div>";
    }
    function disegna() {
      box.innerHTML = '<div class="mg mg-fr">' + 
        '<div class="mg-fr-info"><span class="mg-fr-cat">🏷️ ' + esc(f.categoria) + "</span>" + cuori(vite, CUORI) +
        '<span class="mg-fr-voc">Vocali usate: <b>' + vocali + "</b></span></div>" + tabellone() +
        '<div class="mg-fr-msg" aria-live="polite">' + msg + "</div>" +
        (finito ? "" : tastieraHTML({ vocali: true }, provate) +
          '<div class="row mg-azioni"><button type="button" class="btn ghost" data-a="tutta">💬 So la frase: la scrivo</button></div>' +
          '<form class="mg-fr-tutta row" hidden><input type="text" class="mg-input" autocomplete="off" aria-label="Scrivete tutta la frase" placeholder="Scrivete qui tutta la frase">' +
          '<button class="btn" type="submit">Va bene</button></form>') + "</div>";
    }
    function prova(l) {
      if (finito || provate[l]) return;
      provate[l] = 1;
      var voc = "AEIOU".indexOf(l) >= 0;
      if (voc) vocali++;
      if (presenti[l]) {
        var n = 0; for (var i = 0; i < lettere.length; i++) if (lettere.charAt(i) === l) n++;
        msg = "✅ Sì! La lettera <b>" + l + "</b> c'è " + (n === 1 ? "una volta" : n + " volte") + ".";
      } else {
        vite--;
        msg = "La lettera <b>" + l + "</b> non c'è. " + (vite > 0 ? "Nessun problema, provate con un'altra!" : "");
      }
      if (!mancanti()) return vinto();
      if (vite <= 0) return perso();
      disegna();
    }
    function vinto() {
      finito = true;
      var punti = Math.max(1, 10 - vocali - (CUORI - vite));
      msg = "🎉 Bravissimi, avete indovinato!" + (f.spiega ? '<p class="mg-spiega"><b>' + (f.tipo === "P" || f.tipo === "M" ? "Che cosa significa: " : "Lo sapevate? ") + "</b>" + esc(f.spiega) + "</p>" : "");
      disegna(); parla(ctx, "Bravissimi! " + f.testo + ". " + f.spiega); stop();
      dopo(ctx, function () { ctx.fine({ punti: punti, massimo: 10, messaggio: "Avete indovinato: «" + f.testo + "»." }); }, 1600);
    }
    function perso() {
      finito = true;
      var tot = 0, viste = 0; for (var k in presenti) if (presenti.hasOwnProperty(k)) { tot++; if (provate[k]) viste++; }
      msg = "I cuoricini sono finiti, ma non importa: ecco la frase!" + (f.spiega ? '<p class="mg-spiega"><b>' + (f.tipo === "P" || f.tipo === "M" ? "Che cosa significa: " : "Lo sapevate? ") + "</b>" + esc(f.spiega) + "</p>" : "");
      disegna(); stop();
      dopo(ctx, function () { ctx.fine({ punti: Math.round(4 * viste / tot), massimo: 10, messaggio: "La frase era: «" + f.testo + "». La prossima volta andrà meglio!" }); }, 2200);
    }
    box.addEventListener("click", function (e) {
      var b = e.target.closest(".mg-tasto");
      if (b && !b.disabled) { prova(b.getAttribute("data-t")); return; }
      if (e.target.closest('[data-a="tutta"]')) {
        var fm = box.querySelector(".mg-fr-tutta"); fm.hidden = false; fm.querySelector("input").focus();
      }
    });
    box.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = soloLettere(box.querySelector(".mg-fr-tutta input").value);
      if (!v) return;
      if (v === lettere) { for (var k in presenti) if (presenti.hasOwnProperty(k)) provate[k] = 1; vinto(); return; }
      vite--;
      msg = "Non è proprio questa. " + (vite > 0 ? "Avete perso un cuoricino: continuate con le lettere." : "");
      if (vite <= 0) perso(); else disegna();
    });
    consegna(ctx, "Scegliete una lettera alla volta. Le consonanti sono gratis; le vocali costano un punto. Ogni lettera che non c'è toglie un cuoricino. Aiuto: «" + f.categoria + "».");
    aiuto(ctx, "Cominciate dalle consonanti più comuni in italiano: R, N, T, L, S, C.");
    disegna();
  }

  /* ================================================================== c) PAROLE MESCOLATE */
  function avviaAnagramma(box, ctx) {
    var liv = ctx.livello || 1, r = caso(ctx), TURNI = 5, min = liv === 1 ? 4 : liv === 2 ? 6 : 8, max = liv === 1 ? 5 : liv === 2 ? 7 : 10;
    var pool = [];
    for (var i = 0; i < DIZ.length; i++) { var L = DIZ[i].parola.length; if (L >= min && L <= max) pool.push(DIZ[i]); }
    var scelte = mescola(pool, r).slice(0, TURNI), turno = 0, punti = 0, voce, tessere, risposta, aiuti, stato;
    var stop = ascoltaTasti(box, function (e) {
      if (stato !== "gioco") { if (e.key === "Enter" && stato === "ok") { avanti(); return true; } return false; }
      if (e.key === "Backspace") { togli(risposta.length - 1); return true; }
      var l = e.key && e.key.length === 1 ? lettera(e.key) : "";
      if (l) { for (var i = 0; i < tessere.length; i++) if (!tessere[i].usata && tessere[i].ch === l) { metti(i); return true; } }
      return false;
    });
    function prepara() {
      voce = scelte[turno]; perProve("anagramma", voce); aiuti = 0; stato = "gioco"; risposta = [];
      var lett = voce.parola.split(""), m;
      for (var t = 0; t < 20; t++) { m = mescola(lett, r); if (m.join("") !== voce.parola) break; }
      tessere = [];
      for (var k = 0; k < m.length; k++) tessere.push({ ch: m[k], usata: false });
      disegna("");
    }
    function disegna(msg) {
      var h = '<div class="mg mg-an">' + 
        '<div class="mg-an-info"><span class="mg-fr-cat">🏷️ ' + esc(voce.gruppo) + '</span><span class="muted">Parola ' + (turno + 1) + " di " + TURNI + " · " + voce.parola.length + " lettere</span></div>" +
        '<div class="mg-an-risposta' + (stato === "ok" ? " giusta" : "") + '" aria-label="La vostra parola">';
      for (var k = 0; k < voce.parola.length; k++) {
        var x = risposta[k];
        h += '<button type="button" class="mg-an-posto' + (x != null ? " pieno" : "") + (x != null && tessere[x].aiuto ? " aiuto" : "") + '" data-k="' + k + '"' + (stato !== "gioco" ? " disabled" : "") + ">" + (x != null ? tessere[x].ch : "") + "</button>";
      }
      h += '</div><div class="mg-an-tessere">';
      for (k = 0; k < tessere.length; k++) h += '<button type="button" class="mg-an-tessera" data-i="' + k + '"' + (tessere[k].usata || stato !== "gioco" ? " disabled" : "") + ">" + (tessere[k].usata ? "" : tessere[k].ch) + "</button>";
      h += '</div><div class="mg-an-msg" aria-live="polite">' + (msg || "") + "</div>";
      if (stato === "gioco") h += '<div class="row mg-azioni"><button type="button" class="btn ghost" data-a="aiuto">💡 Aiutino</button><button type="button" class="btn ghost" data-a="rimescola">🔀 Rimescola</button><button type="button" class="btn ghost" data-a="vuota">↩️ Ricomincia la parola</button><button type="button" class="btn ghost" data-a="salta">⏭️ Non la so</button></div>';
      else h += '<div class="row mg-azioni"><button type="button" class="btn big" data-a="avanti">' + (turno + 1 < TURNI ? "Avanti ➜" : "Ho finito ➜") + "</button></div>";
      box.innerHTML = h + "</div>";
    }
    function metti(i) {
      if (tessere[i].usata) return;
      tessere[i].usata = true; risposta.push(i);
      if (risposta.length === voce.parola.length) verifica(); else disegna("");
    }
    function togli(k) {
      if (k < 0 || risposta[k] == null) return;
      if (tessere[risposta[k]].aiuto) { disegna("Le lettere dell'aiutino restano al loro posto."); return; }
      var tolte = risposta.splice(k);
      for (var j = 0; j < tolte.length; j++) { if (tessere[tolte[j]].aiuto) risposta.push(tolte[j]); else tessere[tolte[j]].usata = false; }
      disegna("");
    }
    function verifica() {
      var w = "";
      for (var k = 0; k < risposta.length; k++) w += tessere[risposta[k]].ch;
      if (w === voce.parola) {
        stato = "ok"; var p = aiuti ? 1 : 2; punti += p;
        disegna("🎉 Giusto: <b>" + esc(voce.parola) + "</b>! " + esc(voce.def) + ".");
        parla(ctx, "Giusto! " + voce.parola);
      } else if (DIZ_MAPPA[w]) {
        disegna("«" + w + "» è una parola vera, bravi! Ma non è quella che cerco: guardate l'aiuto «" + esc(voce.gruppo) + "». Toccate una lettera per toglierla.");
      } else disegna("Non è ancora giusta: toccate una lettera in alto per toglierla e riprovate. Con calma!");
    }
    function avanti() { turno++; if (turno < TURNI) prepara(); else { stop(); ctx.fine({ punti: punti, massimo: TURNI * 2, messaggio: "Avete ricomposto " + punti + " punti su " + TURNI * 2 + "." }); } }
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b || b.disabled) return;
      if (b.classList.contains("mg-an-tessera")) return metti(+b.getAttribute("data-i"));
      if (b.classList.contains("mg-an-posto")) return togli(+b.getAttribute("data-k"));
      var a = b.getAttribute("data-a");
      if (a === "avanti") avanti();
      else if (a === "rimescola") {
        var lib = []; for (var i = 0; i < tessere.length; i++) if (!tessere[i].usata) lib.push(i);
        var ch = mescola(lib, r);
        var vecchie = []; for (i = 0; i < lib.length; i++) vecchie.push(tessere[lib[i]].ch);
        for (i = 0; i < lib.length; i++) tessere[lib[i]].ch = vecchie[lib.indexOf(ch[i])];
        disegna("");
      } else if (a === "vuota") { while (risposta.length && !tessere[risposta[risposta.length - 1]].aiuto) togli(risposta.length - 1); disegna(""); }
      else if (a === "aiuto") {
        // rimette in ordine le lettere iniziali giuste e aggiunge la successiva
        var k, giuste = 0;
        for (k = 0; k < risposta.length; k++) if (tessere[risposta[k]].ch === voce.parola.charAt(k)) giuste++; else break;
        var tolte = risposta.splice(giuste); for (k = 0; k < tolte.length; k++) tessere[tolte[k]].usata = false;
        var serve = voce.parola.charAt(giuste);
        for (k = 0; k < tessere.length; k++) if (!tessere[k].usata && tessere[k].ch === serve) { tessere[k].aiuto = true; aiuti++; metti(k); break; }
        aiuto(ctx, "La parola comincia con " + voce.parola.slice(0, giuste + 1) + ".");
      } else if (a === "salta") {
        stato = "saltata";
        disegna("Era <b>" + esc(voce.parola) + "</b>: " + esc(voce.def) + ". Non importa, la prossima andrà meglio!");
      }
    });
    consegna(ctx, "Toccate le lettere nell'ordine giusto (o scrivetele con la tastiera) per formare la parola. Toccate una lettera in alto per toglierla.");
    ctx.aiutino = function () { return "Guardate la categoria: «" + voce.gruppo + "». La parola comincia con la lettera " + voce.parola.charAt(0) + "."; };
    prepara();
  }

  /* ================================================================== d) COMPLETA IL PROVERBIO */
  function avviaProverbio(box, ctx) {
    var liv = ctx.livello || 1, r = caso(ctx), N = liv === 1 ? 5 : liv === 2 ? 6 : 8, NOPZ = liv === 1 ? 3 : 4;
    var pool = [];
    for (var i = 0; i < FRASI.length; i++) if (FRASI[i].manca) pool.push(FRASI[i]);
    var domande = mescola(pool, r).slice(0, N), n = 0, giuste = 0, risposto = false;
    var stop = ascoltaTasti(box, function (e) {
      if (risposto && e.key === "Enter") { avanti(); return true; }
      var x = "ABCD".indexOf(String(e.key || "").toUpperCase());
      if (!risposto && x >= 0) { var b = box.querySelectorAll(".quiz-opt")[x]; if (b) { b.click(); return true; } }
      return false;
    });
    function conBuco(f) {
      var re = new RegExp("(^|[^A-Za-zÀ-ÿ])(" + f.manca + ")(?![A-Za-zÀ-ÿ])", "i");
      return esc(f.testo.replace(re, "$1\u0001")).replace("\u0001", '<span class="mg-buco">_____</span>');
    }
    function disegna() {
      var f = domande[n]; perProve("proverbio", f);
      var opz = mescola([f.manca].concat(mescola(f.sbagliate, r).slice(0, NOPZ - 1)), r);
      var h = '<div class="mg mg-pr">' + 
        '<p class="muted">Proverbio ' + (n + 1) + " di " + domande.length + '</p><div class="mg-pr-testo">' + conBuco(f) + "</div><div class=\"mg-pr-opz\">";
      for (var k = 0; k < opz.length; k++) h += '<button type="button" class="quiz-opt" data-v="' + esc(opz[k]) + '"><span class="lett">' + "ABCD".charAt(k) + "</span> " + esc(opz[k]) + "</button>";
      box.innerHTML = h + '</div><div class="mg-pr-esito" aria-live="polite"></div></div>';
    }
    function avanti() {
      n++; risposto = false;
      if (n < domande.length) disegna();
      else { stop(); ctx.fine({ punti: giuste, massimo: domande.length, messaggio: "Avete completato " + giuste + " proverbi su " + domande.length + "." }); }
    }
    box.addEventListener("click", function (e) {
      var b = e.target.closest(".quiz-opt");
      if (b && !risposto) {
        risposto = true;
        var f = domande[n], ok = b.getAttribute("data-v") === f.manca, bs = box.querySelectorAll(".quiz-opt");
        for (var k = 0; k < bs.length; k++) { bs[k].disabled = true; if (bs[k].getAttribute("data-v") === f.manca) bs[k].className += " right"; }
        if (!ok) b.className += " wrong"; else giuste++;
        box.querySelector(".mg-pr-testo").innerHTML = esc(f.testo).replace(new RegExp("(^|[^A-Za-zÀ-ÿ])(" + f.manca + ")(?![A-Za-zÀ-ÿ])", "i"), '$1<b class="mg-pr-parola">$2</b>');
        box.querySelector(".mg-pr-esito").innerHTML = '<div class="explain notice ' + (ok ? "ok" : "info") + '"><b>' + (ok ? "✅ Giusto!" : "La parola giusta è «" + esc(f.manca) + "».") +
          "</b> " + esc(f.spiega) + '</div><div class="row mg-azioni"><button type="button" class="btn big" data-a="avanti">' + (n + 1 < domande.length ? "Avanti ➜" : "Ho finito ➜") + "</button></div>";
        parla(ctx, f.testo + ". " + f.spiega);
        return;
      }
      if (e.target.closest('[data-a="avanti"]')) avanti();
    });
    consegna(ctx, "Scegliete la parola che manca. Prendetevi tutto il tempo che serve.");
    ctx.aiutino = function () { var f = domande[n]; return f ? "La parola che manca comincia con «" + f.manca.charAt(0).toUpperCase() + "»." : ""; };
    disegna();
  }

  /* ================================================================== e) PAROLE A CATENA */
  var CAT_INDICE = null;
  function indiceCatena() {
    if (CAT_INDICE) return CAT_INDICE;
    CAT_INDICE = [];
    for (var w in CATENA_OK) if (CATENA_OK.hasOwnProperty(w) && w.length >= 3) CAT_INDICE.push(w);
    CAT_INDICE.sort();
    return CAT_INDICE;
  }
  function avviaCatena(box, ctx) {
    var liv = ctx.livello || 1, r = caso(ctx), TURNI = liv === 1 ? 5 : liv === 2 ? 6 : 8, QUANTE = liv === 1 ? 1 : 2, MINLEN = liv === 3 ? 5 : 3;
    var usate = {}, catena = [], turno = 0, punti = 0, attuale, inDubbio = "", msg = "", aiutoVisto = false, tastiera = false, accettate = {};
    function coda(w) { return w.slice(-QUANTE); }
    function inizianoCon(pre, escludi) {
      var L = indiceCatena(), out = [];
      for (var i = 0; i < L.length; i++) if (L[i].indexOf(pre) === 0 && L[i] !== pre && !usate[L[i]] && L[i] !== escludi) out.push(L[i]);
      return out;
    }
    function buonaPerIniziare(w) { return /[AEIOU]$/.test(w) && inizianoCon(coda(w), w).length >= 3; }
    function parolaComputer(pre) {
      var c = pre ? inizianoCon(pre) : [], L, i;
      if (pre) { var buone = []; for (i = 0; i < c.length; i++) if (buonaPerIniziare(c[i])) buone.push(c[i]); if (buone.length) c = buone; }
      else { L = DIZ; for (i = 0; i < L.length; i++) if (!usate[L[i].parola] && L[i].parola.length >= 4 && buonaPerIniziare(L[i].parola)) c.push(L[i].parola); }
      return c.length ? c[Math.floor(r() * c.length)] : "";
    }
    function aggiungi(w, chi) { usate[w] = 1; catena.push({ w: w, chi: chi }); attuale = w; }
    function disegna() {
      var pre = coda(attuale), h = '<div class="mg mg-ca">' + 
        '<div class="mg-ca-catena">';
      var da = Math.max(0, catena.length - 6);
      for (var i = da; i < catena.length; i++) h += (i > da ? '<span class="mg-ca-freccia" aria-hidden="true">→</span>' : "") + '<span class="mg-ca-anello ' + catena[i].chi + '">' + esc(catena[i].w) + "</span>";
      h += '</div><div class="mg-ca-turno"><span class="muted">Turno ' + (turno + 1) + " di " + TURNI + "</span></div>" +
        '<div class="mg-ca-richiesta">La parola è <b>' + esc(attuale.slice(0, -pre.length)) + '<span class="mg-ca-coda">' + esc(pre) + "</span></b>: ora una parola che comincia con «<b>" + esc(pre) + "</b>»</div>" +
        '<div class="mg-ca-msg" aria-live="polite">' + msg + "</div>";
      if (inDubbio) {
        h += '<div class="notice info mg-ca-dubbio"><p>«<b>' + esc(inDubbio) + "</b>» non è nel mio dizionario. <b>È una parola italiana?</b> Mi fido di voi!</p>" +
          '<div class="row"><button type="button" class="btn" data-a="si">👍 Sì, è italiana</button><button type="button" class="btn ghost" data-a="no">✏️ No, ne scrivo un\'altra</button></div></div>';
      } else {
        h += '<form class="mg-ca-form row"><input type="text" class="mg-input" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="La vostra parola" value="' + esc(pre) + '">' +
          '<button class="btn big" type="submit">Va bene</button></form>' +
          '<div class="row mg-azioni"><button type="button" class="btn ghost" data-a="aiuto">💡 Aiutino</button><button type="button" class="btn ghost" data-a="salta">⏭️ Non mi viene</button>' +
          '<button type="button" class="btn ghost" data-a="tastiera" aria-pressed="' + tastiera + '">⌨️ ' + (tastiera ? "Nascondi" : "Mostra") + " la tastiera grande</button></div>" +
          (tastiera ? tastieraHTML({ cancella: true, ok: true }) : "");
      }
      box.innerHTML = h + "</div>";
      var inp = box.querySelector(".mg-input");
      if (inp && !("ontouchstart" in window)) { try { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) { /* niente */ } }
    }
    function prossimoTurno() {
      turno++; aiutoVisto = false;
      if (turno >= TURNI) { ctx.fine({ punti: punti, massimo: TURNI, messaggio: "Avete trovato " + punti + (punti === 1 ? " parola" : " parole") + " a catena. Bravi!" }); return; }
      var pre = coda(attuale), w = parolaComputer(pre);
      if (w) { aggiungi(w, "prof"); msg += " Tocca a me: <b>" + esc(w) + "</b>."; }
      else { w = parolaComputer(""); aggiungi(w, "prof"); msg += " Non me ne viene nessuna con «" + esc(pre) + "»: bravissimi! Ricomincio con <b>" + esc(w) + "</b>."; }
      disegna();
    }
    function accetta(w, fiducia) {
      aggiungi(w, "voi"); punti++; inDubbio = "";
      if (fiducia) accettate[w] = 1;
      msg = "✅ " + (fiducia ? "Mi fido: «" + esc(w) + "» va benissimo." : "Bravi, «" + esc(w) + "» va benissimo!");
      prossimoTurno();
    }
    function invia(val) {
      var w = soloLettere(val), pre = coda(attuale);
      if (!w) return;
      if (w.indexOf(pre) !== 0) { msg = "La parola deve cominciare con «<b>" + esc(pre) + "</b>». Riprovate con calma."; return disegna(); }
      if (w.length < MINLEN || w === pre) { msg = "Ci vuole una parola di almeno " + MINLEN + " lettere."; return disegna(); }
      if (usate[w]) { msg = "«" + esc(w) + "» l'abbiamo già usata: provatene un'altra."; return disegna(); }
      if (CATENA_OK[w] || accettate[w]) return accetta(w, false);
      inDubbio = w; msg = ""; disegna();
    }
    box.addEventListener("submit", function (e) { e.preventDefault(); invia(box.querySelector(".mg-input").value); });
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.classList.contains("mg-tasto")) {
        var t = b.getAttribute("data-t"), inp = box.querySelector(".mg-input"); if (!inp) return;
        if (t === "⌫") inp.value = inp.value.slice(0, -1); else if (t === "OK") invia(inp.value); else inp.value += t;
        return;
      }
      var a = b.getAttribute("data-a");
      if (a === "si") accetta(inDubbio, true);
      else if (a === "no") { inDubbio = ""; msg = "Va bene, provatene un'altra."; disegna(); }
      else if (a === "tastiera") { var v = box.querySelector(".mg-input"); tastiera = !tastiera; var val = v ? v.value : ""; disegna(); var n = box.querySelector(".mg-input"); if (n) n.value = val; }
      else if (a === "aiuto") {
        var c = inizianoCon(coda(attuale)), buone = [];
        for (var i = 0; i < c.length; i++) if (c[i].length >= MINLEN && DIZ_MAPPA[c[i]]) buone.push(c[i]);
        if (!buone.length) for (i = 0; i < c.length; i++) if (c[i].length >= MINLEN) buone.push(c[i]);
        if (!buone.length) { msg = "Anche per me è difficile! Premete «Non mi viene» e cambiamo parola."; return disegna(); }
        var w = buone[Math.floor(r() * buone.length)], d = DIZ_MAPPA[w];
        msg = "💡 Per esempio una parola di " + w.length + " lettere: <b>" + esc(w.slice(0, coda(attuale).length + 1)) + "…</b>" + (d ? " (" + esc(d.def) + ")" : "");
        aiutoVisto = true; aiuto(ctx, "Provate con " + w.slice(0, coda(attuale).length + 1) + "…"); disegna();
      } else if (a === "salta") {
        msg = "Nessun problema!"; turno++;
        if (turno >= TURNI) { ctx.fine({ punti: punti, massimo: TURNI, messaggio: "Avete trovato " + punti + (punti === 1 ? " parola" : " parole") + " a catena." }); return; }
        var nw = parolaComputer(""); aggiungi(nw, "prof"); msg += " Ricomincio con <b>" + esc(nw) + "</b>."; disegna();
      }
    });
    aggiungi(parolaComputer(""), "prof");
    msg = "Comincio io!";
    consegna(ctx, "Scrivete una parola che comincia con " + (QUANTE === 1 ? "l'ultima lettera" : "le ultime due lettere") + " della parola precedente." + (MINLEN > 3 ? " Almeno " + MINLEN + " lettere!" : "") + " Poi tocca a me.");
    disegna();
  }

  /* ================================================================== registrazione */
  PD.mente.registra({ id: "cruciverba", icona: "✏️", titolo: "Cruciverba", categoria: "parole", durata: "10 minuti", ordine: 20, livelli: 3,
    descrizione: "Il cruciverba di oggi, con definizioni facili. Si può anche stampare.", avvia: avviaCruciverba });
  PD.mente.registra({ id: "frase", icona: "🎡", titolo: "Indovina la frase", categoria: "parole", durata: "5 minuti", ordine: 21, livelli: 3,
    descrizione: "Proverbi, canzoni e film da scoprire una lettera alla volta.", avvia: avviaFrase });
  PD.mente.registra({ id: "anagramma", icona: "🔤", titolo: "Parole mescolate", categoria: "parole", durata: "5 minuti", ordine: 22, livelli: 3,
    descrizione: "Rimettete in ordine le lettere per trovare la parola.", avvia: avviaAnagramma });
  PD.mente.registra({ id: "proverbio", icona: "📜", titolo: "Completa il proverbio", categoria: "parole", durata: "5 minuti", ordine: 23, livelli: 3,
    descrizione: "Scegliete la parola che manca e scoprite che cosa significa.", avvia: avviaProverbio });
  PD.mente.registra({ id: "catena", icona: "🔗", titolo: "Parole a catena", categoria: "parole", durata: "5 minuti", ordine: 24, livelli: 3,
    descrizione: "Una parola tira l'altra: si comincia con la fine della precedente.", avvia: avviaCatena });

  /* per le prove automatiche e per chi vuole curiosare */
  PD.menteGiochi = { genera: genera, dizionario: DIZ, frasi: FRASI, parole: CATENA_OK, norm: norm, stampa: cruciverbaStampa };
})();
