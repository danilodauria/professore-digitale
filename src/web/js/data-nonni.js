/* ==========================================================================
 *  PROFESSORE DIGITALE - NONNI TEACH: la banca delle domande (dalla 3.6, dal Consulente Digitale)
 *  Contesti (centro anziani, scuola primaria, biblioteca…) e temi, ciascuno con molte domande.
 *  Segnaposto: {nome} = chi viene intervistato (es. «nonno Pippo»), {luogo} = quartiere o paese.
 *  Le domande sono aperte, gentili e rispettose: niente argomenti dolorosi o troppo personali
 *  (chi intervista può sempre saltare una domanda).
 *  Testi originali di Danilo D'Auria - CC BY-NC-SA 4.0
 * ========================================================================== */
(function () {
  "use strict";
  var PD = window.PD;
  PD.NONNI = {
    contesti: {
      centro: { nome: "Centro anziani", icona: "🏡", testo: "Ricordi e saperi raccontati al centro, per le famiglie e il quartiere.",
        temi: ["quartiere", "infanzia", "lavoro", "mestieri", "cucina", "feste", "musica", "consigli", "riuso"],
        extra: ["Cosa ti piace di più fare qui al centro?", "Chi hai conosciuto qui che ti ha cambiato le giornate?", "Cosa vorresti che i giovani venissero a imparare da voi, qui al centro?"] },
      scuola: { nome: "Scuola primaria", icona: "🎒", testo: "I bambini intervistano i nonni: domande semplici, curiose e allegre.",
        temi: ["infanzia", "scuola", "giochi", "quartiere", "cucina", "animali", "tecnologia", "feste", "consigli", "riuso"],
        extra: ["Nonno, nonna: cosa avresti voluto chiedere tu ai tuoi nonni?", "Qual era il tuo supereroe o il tuo personaggio preferito da bambino?", "Cosa ti fa ridere ancora oggi come quando eri piccolo?", "Se potessi tornare bambino per un giorno, cosa faresti?"] },
      biblioteca: { nome: "Biblioteca", icona: "📚", testo: "Storie, letture, parole e memoria del territorio, da conservare nell'archivio sonoro.",
        temi: ["libri", "parole", "quartiere", "storia", "cinema", "musica", "viaggi", "consigli"],
        extra: ["Qual è il libro che ti ha accompagnato di più nella vita?", "Una storia che ti raccontavano da bambino e che vorresti non andasse persa?"] },
      famiglia: { nome: "Famiglia", icona: "👪", testo: "Le radici della famiglia raccontate ai nipoti, da riascoltare negli anni.",
        temi: ["famiglia", "infanzia", "casa", "cucina", "feste", "lavoro", "viaggi", "consigli"],
        extra: ["Com'era la casa dei tuoi nonni?", "C'è un oggetto di famiglia con una storia speciale?", "Cosa vorresti che i tuoi nipoti ricordassero sempre di te?"] },
      quartiere: { nome: "Quartiere, paese, associazione", icona: "🏘️", testo: "La memoria collettiva di strade, botteghe, piazze e persone.",
        temi: ["quartiere", "mestieri", "botteghe", "trasporti", "feste", "storia", "sport", "riuso"],
        extra: ["Qual è il posto di {luogo} che non esiste più e che ti manca?", "Chi era il personaggio che tutti a {luogo} conoscevano?", "Se dovessi fare da guida a {luogo}, dove porteresti un turista?"] },
      rsa: { nome: "Casa di riposo / RSA", icona: "🌷", testo: "Conversazioni tranquille, brevi, per far emergere ricordi belli.",
        temi: ["infanzia", "musica", "cucina", "feste", "natura", "consigli"],
        extra: ["Qual è la canzone che ti mette di buon umore?", "Qual è il profumo che ti ricorda casa?", "Raccontami una giornata bella che ricordi con piacere."] },
      ecologia: { nome: "Scuola o gruppo di ecologia", icona: "♻️", testo: "Come si viveva consumando meno: riparare, riusare, non sprecare.",
        temi: ["riuso", "cucina", "natura", "casa", "mestieri", "tecnologia"],
        extra: ["Cosa si riparava una volta che oggi si butta via?", "Come si faceva la spesa senza plastica?", "Quale consiglio daresti per sprecare meno?"] }
    },
    temi: {
      quartiere: { nome: "Il quartiere", icona: "🏘️", d: [
        "{nome}, com'era {luogo} quando eri bambino?", "Quali erano le botteghe e i negozi di {luogo} che ricordi meglio?", "Dove giocavate voi bambini a {luogo}?",
        "Com'era la strada dove abitavi? Passavano macchine, carretti, biciclette?", "C'era una piazza dove ci si trovava? Cosa succedeva lì?",
        "Chi erano i vicini di casa? Vi aiutavate tra di voi?", "Quali rumori, voci e profumi sentivi passeggiando per {luogo}?", "Cosa è cambiato di più a {luogo} in questi anni?",
        "C'è un edificio o un luogo di {luogo} che ha una storia curiosa?", "Come si chiamavano le strade o i luoghi con i nomi di una volta?", "Cosa ti piacerebbe che {luogo} avesse ancora oggi, come una volta?",
        "Quale festa o evento animava di più {luogo}?", "Dove andavate a prendere l'acqua, il latte, il pane?"] },
      infanzia: { nome: "Infanzia", icona: "🧸", d: [
        "{nome}, qual è il tuo primo ricordo da bambino?", "Com'era una tua giornata tipo da bambino, dalla mattina alla sera?", "Qual era il tuo gioco preferito e come si giocava?",
        "Avevi un amico o un'amica del cuore? Cosa facevate insieme?", "Qual era il dolce o la merenda che aspettavi di più?", "Cosa facevi durante le vacanze d'estate?",
        "Avevi dei compiti da fare in casa? Quali?", "Cosa volevi fare da grande?", "Qual è stata la marachella più divertente che hai combinato?",
        "Com'erano i vestiti e le scarpe dei bambini allora?", "Qual era il regalo più bello che hai ricevuto?", "Chi ti raccontava le storie prima di dormire?"] },
      scuola: { nome: "La scuola", icona: "🏫", d: [
        "{nome}, com'era la tua scuola? Quanti eravate in classe?", "Com'era la tua maestra o il tuo maestro?", "Cosa portavi nella cartella?",
        "Scrivevi con il pennino e il calamaio? Raccontaci com'era.", "Quale materia ti piaceva di più e perché?", "Come andavi a scuola: a piedi, in bicicletta, con il pulmino?",
        "Cosa si mangiava a ricreazione?", "C'erano punizioni? Quali?", "Qual è la poesia o la canzone imparata a scuola che ricordi ancora?",
        "Fino a che età sei andato a scuola? Poi cosa hai fatto?", "Com'erano le pagelle e gli esami?"] },
      giochi: { nome: "Giochi e divertimenti", icona: "🪀", d: [
        "{nome}, a quali giochi si giocava in cortile o in strada?", "Ci insegni le regole di un gioco di una volta?", "Con cosa costruivate i giocattoli?",
        "Si giocava con le biglie, la trottola, la corda? Come?", "Cosa facevate nei giorni di pioggia?", "C'erano giochi diversi per maschi e femmine?",
        "Qual era la filastrocca o la conta per decidere chi stava sotto?", "Che giochi si facevano a Natale o alle feste di famiglia?", "Come vi divertivate senza televisione?"] },
      lavoro: { nome: "Il lavoro", icona: "🛠️", d: [
        "{nome}, quale è stato il tuo primo lavoro? Quanti anni avevi?", "Com'era una giornata di lavoro, dall'inizio alla fine?", "Cosa hai imparato dal tuo lavoro che vale ancora oggi?",
        "Chi ti ha insegnato il mestiere?", "Quali attrezzi o macchine usavi?", "Qual è il ricordo più bello legato al tuo lavoro?",
        "Com'erano i colleghi? C'era solidarietà?", "Cosa è cambiato di più nel modo di lavorare?", "Cosa diresti a un ragazzo che sta scegliendo che lavoro fare?",
        "Ti è capitato di cambiare città per lavoro?", "Con il primo stipendio cosa hai comprato?"] },
      mestieri: { nome: "Mestieri di una volta", icona: "🧵", d: [
        "{nome}, quali mestieri c'erano una volta che oggi sono scomparsi?", "Ti ricordi l'arrotino, lo stagnino, il lattaio? Come lavoravano?",
        "Chi riparava le scarpe, le pentole, gli ombrelli?", "C'era una sarta o un sarto nel quartiere? Com'era andare da loro?", "Come lavorava il fabbro o il falegname?",
        "Chi passava per le strade a vendere qualcosa? Cosa gridava?", "Quale mestiere antico ti sarebbe piaciuto fare?", "Quale mestiere di una volta servirebbe ancora oggi?",
        "Come si imparava un mestiere a bottega?"] },
      botteghe: { nome: "Botteghe e spesa", icona: "🧺", d: [
        "{nome}, come si faceva la spesa una volta?", "Cosa si comprava sfuso e come si portava a casa?", "Esisteva il libretto per segnare la spesa e pagare a fine mese?",
        "Quanto costavano il pane, il latte, un gelato, in lire?", "Com'era il mercato? Cosa si trovava?", "C'era il negozio dove si trovava di tutto? Com'era dentro?",
        "Come si conservavano i cibi senza frigorifero?", "Quando è arrivato il primo supermercato? Che effetto vi fece?"] },
      cucina: { nome: "Cucina e tavola", icona: "🍝", d: [
        "{nome}, qual è il piatto della tua infanzia che ti fa venire l'acquolina?", "Ci racconti una ricetta di famiglia, passo per passo?", "Cosa si mangiava nei giorni normali e cosa nei giorni di festa?",
        "Chi cucinava in casa? Cosa hai imparato guardando?", "Come si usavano gli avanzi? Ci racconti una ricetta di recupero?", "Si faceva il pane in casa? Come?",
        "Cosa si preparava in estate per l'inverno: conserve, marmellate, salse?", "Com'era la tavola della domenica?", "Quale dolce si preparava per le feste?",
        "C'era l'orto? Cosa si coltivava?", "Qual è un trucco di cucina che i giovani dovrebbero conoscere?"] },
      feste: { nome: "Feste e tradizioni", icona: "🎉", d: [
        "{nome}, come si festeggiava il Natale quando eri bambino?", "Com'era il Carnevale? Come vi vestivate?", "Qual era la festa del patrono a {luogo}? Cosa succedeva?",
        "Come si festeggiavano i compleanni?", "C'erano tradizioni particolari per Pasqua?", "Com'erano i matrimoni di una volta?",
        "Si ballava? Dove e con quale musica?", "Quali dolci o cibi erano legati alle feste?", "C'è una tradizione che vorresti tornasse?", "Come si passava il Capodanno?"] },
      musica: { nome: "Musica e canzoni", icona: "🎶", d: [
        "{nome}, qual è la canzone della tua giovinezza?", "Ci canti un pezzetto di una canzone che ti piaceva?", "Come si ascoltava la musica: radio, giradischi, juke-box?",
        "Chi era il cantante che piaceva a tutti?", "C'erano canzoni in dialetto che si cantavano insieme?", "Sapevi suonare uno strumento? Chi te l'ha insegnato?",
        "Dove si andava a ballare?", "C'è una canzone legata a un ricordo speciale?"] },
      consigli: { nome: "Consigli ai giovani", icona: "💌", d: [
        "{nome}, qual è il consiglio più importante che hai ricevuto nella vita?", "Cosa diresti a un ragazzo di oggi per vivere bene?", "Cosa avete fatto voi meglio di noi, e cosa noi meglio di voi?",
        "Qual è la cosa più importante che hai imparato dagli errori?", "Cosa significa per te essere una brava persona?", "Come si fa a restare amici per tanti anni?",
        "Cosa non bisogna mai smettere di fare, a ogni età?", "Quale proverbio usi più spesso? Cosa vuol dire?", "Cosa ti rende felice nelle piccole cose di ogni giorno?",
        "Se potessi scrivere una lettera ai bambini di oggi, cosa ci scriveresti?"] },
      riuso: { nome: "Riparare, riusare, non sprecare", icona: "♻️", d: [
        "{nome}, cosa si riparava in casa invece di buttarlo?", "Come si riusavano i vestiti quando diventavano piccoli o vecchi?", "Come si faceva a non sprecare il cibo?",
        "Si rammendavano le calze? Ci spieghi come?", "Cosa si faceva con il vetro, la carta, gli stracci?", "Quante volte si risuolavano le scarpe?",
        "Chi riparava la radio o gli elettrodomestici quando si rompevano?", "Cosa pensi dell'abitudine di oggi di buttare e ricomprare?", "Qual è un trucco per far durare le cose che vorresti insegnare?",
        "Com'era il rapporto con l'acqua e la luce: si stava attenti a non consumare?"] },
      tecnologia: { nome: "Tecnologia di una volta", icona: "📻", d: [
        "{nome}, ti ricordi la prima volta che hai visto la televisione?", "Com'era telefonare una volta? C'era il gettone?", "Quando è arrivato il primo elettrodomestico in casa? Quale?",
        "Come si scrivevano e spedivano le lettere?", "Come si facevano le foto e quanto tempo ci voleva per vederle?", "Qual è stata l'invenzione che ti ha stupito di più?",
        "Cosa pensi dei telefonini e di Internet?", "C'è qualcosa di tecnologico che ti piacerebbe imparare a usare?", "Com'era andare al cinema? Quanto costava il biglietto?"] },
      famiglia: { nome: "La famiglia", icona: "🏠", d: [
        "{nome}, com'era composta la tua famiglia da bambino?", "Chi erano i tuoi nonni e cosa ricordi di loro?", "Quali lavori facevano i tuoi genitori?",
        "Come si stava tutti insieme in casa?", "Come vi siete conosciuti tu e la persona con cui hai vissuto la vita? (se ti va di raccontarlo)", "Quali valori ti hanno trasmesso in famiglia?",
        "C'è una frase che diceva sempre qualcuno della tua famiglia?", "Com'era la domenica in famiglia?"] },
      casa: { nome: "La casa", icona: "🛏️", d: [
        "{nome}, com'era la casa dove sei cresciuto?", "Come ci si scaldava in inverno?", "Com'era il bagno? E come si lavavano i panni?",
        "Quali mobili e oggetti ricordi meglio?", "C'era il cortile o il balcone? Cosa si faceva lì?", "Com'erano le sere in casa prima della televisione?"] },
      animali: { nome: "Animali e natura", icona: "🐓", d: [
        "{nome}, avevate degli animali in casa o in cortile?", "Che animali si vedevano in giro a {luogo}?", "Hai mai aiutato in campagna? Cosa si faceva?",
        "Quali frutti si raccoglievano dagli alberi?", "Qual è l'animale che ti è rimasto nel cuore?", "Com'erano i campi e i boschi vicino a casa?"] },
      natura: { nome: "Campagna, stagioni, natura", icona: "🌾", d: [
        "{nome}, come si capiva che tempo avrebbe fatto, senza le previsioni?", "Cosa si faceva in ogni stagione, in campagna o in città?", "Com'era la vendemmia o la raccolta delle olive?",
        "Quali erbe e piante si usavano in casa?", "Dove si andava a fare il bagno d'estate?", "Qual è il paesaggio che ricordi con più affetto?"] },
      trasporti: { nome: "Viaggi e trasporti", icona: "🚂", d: [
        "{nome}, come ci si spostava una volta?", "Ti ricordi la tua prima bicicletta, motorino o automobile?", "Com'era viaggiare in treno o in corriera?",
        "Qual è stato il primo viaggio lontano da casa?", "Come si andava al mare o in villeggiatura?"] },
      viaggi: { nome: "Viaggi e lontananze", icona: "🧳", d: [
        "{nome}, qual è il posto più lontano in cui sei stato?", "Qualcuno della tua famiglia è partito per lavorare lontano? Come si restava in contatto?",
        "Che cosa portavi in valigia?", "Qual è un luogo che sogni ancora di vedere?"] },
      storia: { nome: "Storia e cambiamenti", icona: "🕰️", d: [
        "{nome}, qual è il primo grande avvenimento che ricordi di aver sentito alla radio o visto in televisione?", "Com'è cambiata {luogo} negli anni del boom economico?",
        "Quale cambiamento della società ti ha colpito di più?", "Cosa raccontavano i tuoi genitori dei loro tempi?", "C'è un fatto di {luogo} che i libri non raccontano?"] },
      libri: { nome: "Libri e letture", icona: "📖", d: [
        "{nome}, qual è il primo libro che hai letto?", "Dove si trovavano i libri? C'erano biblioteche?", "Leggevi i fumetti o i giornalini? Quali?",
        "C'è un personaggio dei libri che senti amico?", "Qual è il libro che regaleresti a un ragazzo?"] },
      parole: { nome: "Parole, dialetto e proverbi", icona: "🗣️", d: [
        "{nome}, ci dici una parola in dialetto che i giovani non conoscono più? Cosa vuol dire?", "Qual è il proverbio che usi di più?", "C'era un modo di dire tipico di {luogo}?",
        "Come si salutava una volta, per strada o nei negozi?", "Ci racconti una filastrocca in dialetto?", "Quali soprannomi si davano alle persone e perché?"] },
      cinema: { nome: "Cinema, radio e TV", icona: "🎬", d: [
        "{nome}, qual è il film che ti è rimasto nel cuore?", "Com'era la sala del cinema? Si poteva fumare, mangiare, parlare?", "Quali programmi si ascoltavano alla radio?",
        "Chi aveva il primo televisore nel palazzo? Andavate tutti da lui?", "Quale programma televisivo aspettavi ogni settimana?"] },
      sport: { nome: "Sport e tempo libero", icona: "⚽", d: [
        "{nome}, quale sport si praticava a {luogo}?", "Per quale squadra tifavi e perché?", "Com'erano i campi da gioco una volta?", "Qual è stata la partita o la gara indimenticabile?",
        "Cosa facevate la domenica pomeriggio?"] }
    },
    /* domande di apertura e di chiusura, sempre presenti */
    apertura: ["Ciao {nome}, grazie di essere qui. Vuoi presentarti? Come ti chiami e dove sei nato?"],
    chiusura: ["{nome}, c'è qualcosa che non ti abbiamo chiesto e che vorresti raccontare?", "Grazie {nome}. Vuoi lasciare un saluto a chi ascolterà questo racconto?"]
  };
  /* numero totale di domande (per la ricerca e il vademecum) */
  PD.NONNI.totale = function () {
    var n = PD.NONNI.apertura.length + PD.NONNI.chiusura.length;
    Object.keys(PD.NONNI.temi).forEach(function (k) { n += PD.NONNI.temi[k].d.length; });
    Object.keys(PD.NONNI.contesti).forEach(function (k) { n += PD.NONNI.contesti[k].extra.length; });
    return n;
  };
})();
